-- ============================================================
-- SISREP — 19: Módulo de Pedidos y Traspasos entre Sucursales (C4)
-- Permite transferir productos de una sucursal/almacen origen a otra destino,
-- con registro de salida FIFO en origen y entrada de lote FIFO en destino.
-- ============================================================

-- ---------- 1. Actualizar constraints de kardex_movimientos ----------
alter table public.kardex_movimientos
  drop constraint if exists kardex_movimientos_tipo_movimiento_check;

alter table public.kardex_movimientos
  add constraint kardex_movimientos_tipo_movimiento_check
  check (tipo_movimiento = any (array[
    'entrada_compra'::text,
    'salida_venta'::text,
    'ajuste_entrada'::text,
    'ajuste_salida'::text,
    'salida_traspaso'::text,
    'entrada_traspaso'::text
  ]));

alter table public.kardex_movimientos
  drop constraint if exists kardex_movimientos_referencia_tipo_check;

alter table public.kardex_movimientos
  add constraint kardex_movimientos_referencia_tipo_check
  check (referencia_tipo = any (array[
    'orden_compra'::text,
    'venta'::text,
    'ajuste_manual'::text,
    'traspaso'::text
  ]));

-- ---------- 2. Secuencia y tablas de traspaso ----------
create sequence if not exists public.pedidos_traspaso_seq start with 1 increment by 1;

create table if not exists public.pedidos_traspaso (
  id uuid not null default gen_random_uuid(),
  numero text not null unique,
  sucursal_origen_id uuid not null references public.sucursales(id),
  sucursal_destino_id uuid not null references public.sucursales(id),
  estado text not null default 'pendiente' check (estado = any (array['pendiente'::text, 'enviado'::text, 'recibido'::text, 'cancelado'::text])),
  creado_por uuid references public.perfiles(id),
  creado_en timestamp with time zone not null default now(),
  fecha_envio timestamp with time zone,
  fecha_recepcion timestamp with time zone,
  notas text,
  constraint pedidos_traspaso_pkey primary key (id),
  constraint pedidos_traspaso_sucursales_diff check (sucursal_origen_id <> sucursal_destino_id)
);

create table if not exists public.pedido_traspaso_items (
  id uuid not null default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_traspaso(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  cantidad integer not null check (cantidad > 0),
  costo_fifo_unitario numeric not null default 0 check (costo_fifo_unitario >= 0),
  constraint pedido_traspaso_items_pkey primary key (id)
);

-- Trigger de numeracion autogenerada (PED-000001)
create or replace function public.fn_pedidos_traspaso_numero()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.numero is null or btrim(new.numero) = '' then
    new.numero := 'PED-' || lpad(nextval('public.pedidos_traspaso_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedidos_traspaso_numero on public.pedidos_traspaso;
create trigger trg_pedidos_traspaso_numero
  before insert on public.pedidos_traspaso
  for each row execute function public.fn_pedidos_traspaso_numero();

-- RLS
alter table public.pedidos_traspaso enable row level security;
alter table public.pedido_traspaso_items enable row level security;

drop policy if exists "pt_select_autenticados" on public.pedidos_traspaso;
create policy "pt_select_autenticados" on public.pedidos_traspaso
  for select to authenticated using (true);

drop policy if exists "pti_select_autenticados" on public.pedido_traspaso_items;
create policy "pti_select_autenticados" on public.pedido_traspaso_items
  for select to authenticated using (true);

-- ---------- 3. RPC Transaccionales ----------

-- A) Crear Pedido de Traspaso
create or replace function public.fn_crear_pedido_traspaso(
  p_sucursal_destino_id uuid,
  p_items jsonb,
  p_notas text default null,
  p_sucursal_origen_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido_id uuid;
  v_origen_id uuid;
  v_item jsonb;
  v_producto_id uuid;
  v_cantidad integer;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario inactivo o no autorizado';
  end if;

  v_origen_id := coalesce(p_sucursal_origen_id, public.fn_mi_sucursal());
  if v_origen_id is null then
    raise exception 'No se pudo determinar la sucursal de origen';
  end if;

  if v_origen_id = p_sucursal_destino_id then
    raise exception 'La sucursal de origen y destino deben ser distintas';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Debe incluir al menos un producto en el traspaso';
  end if;

  insert into public.pedidos_traspaso (sucursal_origen_id, sucursal_destino_id, creado_por, notas)
  values (v_origen_id, p_sucursal_destino_id, auth.uid(), p_notas)
  returning id into v_pedido_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::integer;
    if v_producto_id is null or v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Ítem inválido en el pedido de traspaso';
    end if;

    insert into public.pedido_traspaso_items (pedido_id, producto_id, cantidad)
    values (v_pedido_id, v_producto_id, v_cantidad);
  end loop;

  return v_pedido_id;
end;
$$;

-- B) Enviar Traspaso (Salida FIFO de Origen)
create or replace function public.fn_enviar_traspaso(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido record;
  v_item record;
  v_costo numeric;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_pedido from public.pedidos_traspaso where id = p_pedido_id for update;
  if not found then raise exception 'El pedido de traspaso no existe'; end if;
  if v_pedido.estado <> 'pendiente' then
    raise exception 'El traspaso debe estar en estado pendiente para enviarse (estado actual: %)', v_pedido.estado;
  end if;

  for v_item in select * from public.pedido_traspaso_items where pedido_id = p_pedido_id loop
    v_costo := public.fn_fifo_consumir(v_item.producto_id, v_pedido.sucursal_origen_id, v_item.cantidad);

    update public.pedido_traspaso_items
    set costo_fifo_unitario = v_costo
    where id = v_item.id;

    insert into public.kardex_movimientos (
      producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
      referencia_tipo, referencia_id, creado_por
    ) values (
      v_item.producto_id, v_pedido.sucursal_origen_id, 'salida_traspaso', v_item.cantidad, v_costo,
      'traspaso', p_pedido_id, auth.uid()
    );
  end loop;

  update public.pedidos_traspaso
  set estado = 'enviado', fecha_envio = now()
  where id = p_pedido_id;
end;
$$;

-- C) Recibir Traspaso (Entrada Lote FIFO en Destino)
create or replace function public.fn_recibir_traspaso(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido record;
  v_item record;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_pedido from public.pedidos_traspaso where id = p_pedido_id for update;
  if not found then raise exception 'El pedido de traspaso no existe'; end if;
  if v_pedido.estado <> 'enviado' then
    raise exception 'El traspaso debe estar en estado enviado para recibirse (estado actual: %)', v_pedido.estado;
  end if;

  for v_item in select * from public.pedido_traspaso_items where pedido_id = p_pedido_id loop
    insert into public.kardex_movimientos (
      producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
      cantidad_restante_lote, referencia_tipo, referencia_id, creado_por
    ) values (
      v_item.producto_id, v_pedido.sucursal_destino_id, 'entrada_traspaso', v_item.cantidad, v_item.costo_fifo_unitario,
      v_item.cantidad, 'traspaso', p_pedido_id, auth.uid()
    );
  end loop;

  update public.pedidos_traspaso
  set estado = 'recibido', fecha_recepcion = now()
  where id = p_pedido_id;
end;
$$;

-- D) Cancelar Traspaso
create or replace function public.fn_cancelar_traspaso(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido record;
begin
  select * into v_pedido from public.pedidos_traspaso where id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe'; end if;
  if v_pedido.estado <> 'pendiente' then
    raise exception 'Solo se pueden cancelar pedidos en estado pendiente';
  end if;

  update public.pedidos_traspaso set estado = 'cancelado' where id = p_pedido_id;
end;
$$;

revoke execute on function public.fn_crear_pedido_traspaso(uuid, jsonb, text, uuid) from public, anon;
grant execute on function public.fn_crear_pedido_traspaso(uuid, jsonb, text, uuid) to authenticated;

revoke execute on function public.fn_enviar_traspaso(uuid) from public, anon;
grant execute on function public.fn_enviar_traspaso(uuid) to authenticated;

revoke execute on function public.fn_recibir_traspaso(uuid) from public, anon;
grant execute on function public.fn_recibir_traspaso(uuid) to authenticated;

revoke execute on function public.fn_cancelar_traspaso(uuid) from public, anon;
grant execute on function public.fn_cancelar_traspaso(uuid) to authenticated;
