-- ============================================================
-- SISREP — 40: Módulo CAJA / ventas en dos pasos (PLAN_5 · T5)
-- Ejecutar en el SQL Editor sobre AMBAS bases (dev y prod). Idempotente.
--
-- QUÉ HACE:
--   Separa la venta en DOS pasos:
--     1) El POS crea un PEDIDO DE VENTA pendiente (PDV-0001) SIN mover stock.
--        (lo arma el vendedor; el admin también puede).
--     2) En CAJA, el cajero (o admin) lo CONFIRMA: recién ahí se corre
--        fn_registrar_venta (atómica: revalida stock, FIFO, kardex, VEN-xxxx) y
--        se genera la factura. También puede CANCELARLO.
--   No rompe la atomicidad: fn_registrar_venta sigue igual; esto agrega una capa
--   de pendientes encima (mismo patrón que Proforma → Venta).
--
--   Tipo de pago y con/sin factura los elige el CAJERO al confirmar.
--   Ojo: la venta resultante queda con vendido_por = el cajero que confirma
--   (el vendedor que armó el pedido queda en ventas_pendientes.creado_por).
-- ============================================================

-- ---------- 1. Secuencia + numeración PDV-0001 ----------
create sequence if not exists public.ventas_pendientes_numero_seq start 1;
grant usage, select on sequence public.ventas_pendientes_numero_seq to authenticated;

create or replace function public.fn_asignar_numero_venta_pendiente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.numero is null or new.numero = '' then
    new.numero := 'PDV-' || lpad(nextval('public.ventas_pendientes_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

-- ---------- 2. Tablas ----------
create table if not exists public.ventas_pendientes (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,               -- PDV-0001 (trigger)
  cliente_id          uuid references public.clientes(id),      -- opcional (SIN NOMBRE)
  descuento_tipo      text check (descuento_tipo in ('porcentaje','monto_fijo')),
  descuento_valor     numeric(12,2) not null default 0,
  impuesto_porcentaje numeric(5,2) not null default 0,
  subtotal            numeric(12,2) not null default 0,
  total               numeric(12,2) not null default 0,
  estado              text not null default 'pendiente'
                      check (estado in ('pendiente','confirmada','cancelada')),
  sucursal_id         uuid references public.sucursales(id),
  creado_por          uuid references public.perfiles(id),      -- el vendedor que lo arma
  creado_en           timestamptz not null default now(),
  venta_id            uuid references public.ventas(id),        -- se setea al confirmar
  confirmado_por      uuid references public.perfiles(id),      -- el cajero
  confirmado_en       timestamptz
);

create table if not exists public.venta_pendiente_items (
  id              uuid primary key default gen_random_uuid(),
  pendiente_id    uuid not null references public.ventas_pendientes(id) on delete cascade,
  producto_id     uuid not null references public.productos(id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null,
  descuento_tipo  text check (descuento_tipo in ('porcentaje','monto_fijo')),
  descuento_valor numeric(12,2) not null default 0,
  subtotal_linea  numeric(12,2) not null
);

create index if not exists idx_ventas_pendientes_estado    on public.ventas_pendientes (estado);
create index if not exists idx_ventas_pendientes_sucursal  on public.ventas_pendientes (sucursal_id);
create index if not exists idx_vp_items_pendiente          on public.venta_pendiente_items (pendiente_id);

drop trigger if exists trg_ventas_pendientes_numero on public.ventas_pendientes;
create trigger trg_ventas_pendientes_numero
  before insert on public.ventas_pendientes
  for each row execute function public.fn_asignar_numero_venta_pendiente();

-- ---------- 3. RPC: crear pedido pendiente (sin stock) ----------
-- Igual que fn_registrar_venta en el cálculo de totales, pero SIN FIFO/kardex.
create or replace function public.fn_crear_venta_pendiente(p_pedido jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id          uuid;
  v_item        jsonb;
  v_pid         uuid;
  v_cant        integer;
  v_precio      numeric;
  v_dt          text;
  v_dv          numeric;
  v_linea       numeric;
  v_subtotal    numeric := 0;
  v_desc_global numeric;
  v_base        numeric;
  v_imp         numeric;
  v_sucursal    uuid;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado o inactivo';
  end if;
  if p_pedido->'items' is null or jsonb_typeof(p_pedido->'items') <> 'array'
     or jsonb_array_length(p_pedido->'items') = 0 then
    raise exception 'El pedido debe tener al menos un item';
  end if;

  v_sucursal := coalesce((p_pedido->>'sucursal_id')::uuid, public.fn_mi_sucursal());
  if v_sucursal is null then
    raise exception 'Tu usuario no tiene una sucursal asignada';
  end if;
  v_imp := coalesce((p_pedido->>'impuesto_porcentaje')::numeric, 0);

  insert into public.ventas_pendientes
    (cliente_id, descuento_tipo, descuento_valor, impuesto_porcentaje, creado_por, sucursal_id)
  values (
    (p_pedido->>'cliente_id')::uuid,
    p_pedido->>'descuento_tipo',
    coalesce((p_pedido->>'descuento_valor')::numeric, 0),
    v_imp,
    auth.uid(),
    v_sucursal
  )
  returning id into v_id;

  for v_item in select value from jsonb_array_elements(p_pedido->'items') loop
    v_pid    := (v_item->>'producto_id')::uuid;
    v_cant   := (v_item->>'cantidad')::integer;
    v_precio := (v_item->>'precio_unitario')::numeric;
    v_dt     := v_item->>'descuento_tipo';
    v_dv     := coalesce((v_item->>'descuento_valor')::numeric, 0);

    if v_pid is null or v_cant is null or v_cant <= 0 or v_precio is null or v_precio < 0 then
      raise exception 'Item invalido: %', v_item;
    end if;

    v_linea := v_cant * v_precio - case v_dt
      when 'porcentaje' then round(v_cant * v_precio * v_dv / 100, 2)
      when 'monto_fijo' then v_dv
      else 0
    end;
    if v_linea < 0 then
      raise exception 'El descuento supera el importe de la linea';
    end if;

    insert into public.venta_pendiente_items
      (pendiente_id, producto_id, cantidad, precio_unitario, descuento_tipo, descuento_valor, subtotal_linea)
    values (v_id, v_pid, v_cant, v_precio, v_dt, v_dv, round(v_linea, 2));

    v_subtotal := v_subtotal + round(v_linea, 2);
  end loop;

  v_desc_global := case p_pedido->>'descuento_tipo'
    when 'porcentaje' then round(v_subtotal * coalesce((p_pedido->>'descuento_valor')::numeric,0) / 100, 2)
    when 'monto_fijo' then coalesce((p_pedido->>'descuento_valor')::numeric, 0)
    else 0
  end;
  v_base := v_subtotal - v_desc_global;
  if v_base < 0 then
    raise exception 'El descuento global supera el subtotal';
  end if;

  update public.ventas_pendientes
  set subtotal = v_subtotal,
      total    = round(v_base * (1 + v_imp / 100), 2)
  where id = v_id;

  return v_id;
end;
$$;
revoke execute on function public.fn_crear_venta_pendiente(jsonb) from public, anon;
grant  execute on function public.fn_crear_venta_pendiente(jsonb) to authenticated;

-- ---------- 4. RPC: confirmar (cajero/admin) → corre fn_registrar_venta ----------
create or replace function public.fn_confirmar_venta_pendiente(
  p_id uuid,
  p_tipo_pago text,
  p_con_factura boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol      text;
  v_ped      record;
  v_items    jsonb;
  v_venta_id uuid;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol not in ('cajero','admin') then
    raise exception 'Solo un cajero o administrador puede confirmar ventas';
  end if;

  select * into v_ped from public.ventas_pendientes where id = p_id for update;
  if not found then
    raise exception 'El pedido no existe';
  end if;
  if v_ped.estado <> 'pendiente' then
    raise exception 'El pedido ya esta %', v_ped.estado;
  end if;

  select jsonb_agg(jsonb_build_object(
           'producto_id',     producto_id,
           'cantidad',        cantidad,
           'precio_unitario', precio_unitario,
           'descuento_tipo',  descuento_tipo,
           'descuento_valor', descuento_valor))
  into v_items
  from public.venta_pendiente_items
  where pendiente_id = p_id;

  if v_items is null then
    raise exception 'El pedido no tiene items';
  end if;

  -- Reusa la venta atómica (revalida stock / FIFO / kardex / VEN-xxxx).
  v_venta_id := public.fn_registrar_venta(jsonb_build_object(
    'cliente_id',          v_ped.cliente_id,
    'proforma_origen_id',  null,
    'sucursal_id',         v_ped.sucursal_id,
    'descuento_tipo',      v_ped.descuento_tipo,
    'descuento_valor',     v_ped.descuento_valor,
    'impuesto_porcentaje', v_ped.impuesto_porcentaje,
    'tipo_pago',           p_tipo_pago,
    'con_factura',         coalesce(p_con_factura, true),
    'items',               v_items
  ));

  update public.ventas_pendientes
  set estado = 'confirmada', venta_id = v_venta_id,
      confirmado_por = auth.uid(), confirmado_en = now()
  where id = p_id;

  return v_venta_id;
end;
$$;
revoke execute on function public.fn_confirmar_venta_pendiente(uuid, text, boolean) from public, anon;
grant  execute on function public.fn_confirmar_venta_pendiente(uuid, text, boolean) to authenticated;

-- ---------- 5. RPC: cancelar (cajero/admin) ----------
create or replace function public.fn_cancelar_venta_pendiente(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol not in ('cajero','admin') then
    raise exception 'Solo un cajero o administrador puede cancelar pedidos';
  end if;

  update public.ventas_pendientes
  set estado = 'cancelada'
  where id = p_id and estado = 'pendiente';

  if not found then
    raise exception 'El pedido no existe o no esta pendiente';
  end if;
end;
$$;
revoke execute on function public.fn_cancelar_venta_pendiente(uuid) from public, anon;
grant  execute on function public.fn_cancelar_venta_pendiente(uuid) to authenticated;

-- ---------- 6. RLS (solo SELECT por sucursal; las escrituras van por las RPC) ----------
alter table public.ventas_pendientes     enable row level security;
alter table public.venta_pendiente_items enable row level security;

drop policy if exists "vp_select_por_sucursal" on public.ventas_pendientes;
create policy "vp_select_por_sucursal" on public.ventas_pendientes
  for select to authenticated
  using (public.fn_es_admin() or sucursal_id = public.fn_mi_sucursal());

drop policy if exists "vpi_select_por_sucursal" on public.venta_pendiente_items;
create policy "vpi_select_por_sucursal" on public.venta_pendiente_items
  for select to authenticated
  using (
    public.fn_es_admin()
    or exists (
      select 1 from public.ventas_pendientes p
      where p.id = pendiente_id and p.sucursal_id = public.fn_mi_sucursal()
    )
  );

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) tablas y funciones existen:
--   select table_name from information_schema.tables
--   where table_name in ('ventas_pendientes','venta_pendiente_items');   -- 2 filas
--   -- b) crear un pedido desde el POS y luego:
--   select numero, estado, total, creado_en from public.ventas_pendientes order by creado_en desc;
-- ============================================================
