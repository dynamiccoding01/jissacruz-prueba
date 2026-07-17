-- ============================================================
-- SISREP — 14: Stock por sucursal (C2 · paso 3a — BACKEND)
-- Ejecutar en el SQL Editor sobre una base que ya corrio 12 y 13.
--
-- Reescribe el nucleo de inventario: el stock pasa de ser "un numero por
-- producto" a ser por (producto x sucursal). Cada operacion impacta la
-- sucursal del usuario que la ejecuta (fn_mi_sucursal).
--
-- TRANSICION: durante este paso se MANTIENE productos.stock_actual como TOTAL
-- (suma de sucursales) para no romper las pantallas actuales. En el paso 3b se
-- elimina y el total pasa a calcularse por vista (sin dato repetido).
--
-- Idempotente en lo posible. Al final hay una VERIFICACION.
-- ============================================================

-- ---------- 0. Helper: sucursal del usuario logueado ----------
create or replace function public.fn_mi_sucursal()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sucursal_id from public.perfiles where id = auth.uid();
$$;
revoke execute on function public.fn_mi_sucursal() from public, anon;
grant execute on function public.fn_mi_sucursal() to authenticated;

-- ---------- 1. Cache de stock por sucursal ----------
-- Unico lugar donde se guarda el stock. Solo lo escribe el trigger del kardex
-- (SECURITY DEFINER); sin politicas de insert/update para authenticated.
create table if not exists public.producto_stock_sucursal (
  producto_id  uuid not null references public.productos(id),
  sucursal_id  uuid not null references public.sucursales(id),
  stock_actual integer not null default 0,
  primary key (producto_id, sucursal_id)
);

alter table public.producto_stock_sucursal enable row level security;
drop policy if exists "pss_select_autenticados" on public.producto_stock_sucursal;
create policy "pss_select_autenticados" on public.producto_stock_sucursal
  for select to authenticated using (true);

-- ---------- 2. sucursal_id en el kardex ----------
alter table public.kardex_movimientos
  add column if not exists sucursal_id uuid references public.sucursales(id);

-- backfill del historico a la sucursal por defecto (la de codigo mas bajo)
update public.kardex_movimientos
set sucursal_id = (select id from public.sucursales where activo order by codigo limit 1)
where sucursal_id is null;

alter table public.kardex_movimientos alter column sucursal_id set not null;
create index if not exists idx_kardex_prod_suc
  on public.kardex_movimientos (producto_id, sucursal_id);

-- ---------- 3. Migracion del stock actual -> por sucursal ----------
-- Lo que hoy vive en productos.stock_actual pasa a la sucursal por defecto.
insert into public.producto_stock_sucursal (producto_id, sucursal_id, stock_actual)
select p.id,
       (select id from public.sucursales where activo order by codigo limit 1),
       p.stock_actual
from public.productos p
on conflict (producto_id, sucursal_id) do update
  set stock_actual = excluded.stock_actual;

-- ---------- 4. Trigger de stock: por sucursal (+ total transicional) ----------
create or replace function public.fn_kardex_aplica_stock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_delta integer;
begin
  v_delta := case when new.tipo_movimiento in ('entrada_compra','ajuste_entrada')
                  then new.cantidad else -new.cantidad end;

  -- cache por sucursal (la fuente para la UI a partir del paso 3b)
  insert into public.producto_stock_sucursal (producto_id, sucursal_id, stock_actual)
  values (new.producto_id, new.sucursal_id, v_delta)
  on conflict (producto_id, sucursal_id) do update
    set stock_actual = public.producto_stock_sucursal.stock_actual + v_delta;

  -- TOTAL transicional (se elimina en el paso 3b). pg_trigger_depth() > 1 aca,
  -- asi que pasa el guard de productos.
  update public.productos
  set stock_actual = stock_actual + v_delta
  where id = new.producto_id;

  return new;
end;
$$;

-- ---------- 5. FIFO por sucursal (helper interno) ----------
create or replace function public.fn_fifo_consumir(
  p_producto_id uuid,
  p_sucursal_id uuid,
  p_cantidad    integer
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock       integer;
  v_pendiente   integer := p_cantidad;
  v_costo_total numeric := 0;
  v_toma        integer;
  v_lote        record;
begin
  -- bloquea la fila de stock de ESA sucursal y valida disponibilidad
  select stock_actual into v_stock
  from public.producto_stock_sucursal
  where producto_id = p_producto_id and sucursal_id = p_sucursal_id
  for update;

  if v_stock is null then
    raise exception 'El producto no tiene stock en esta sucursal';
  end if;
  if v_stock < p_cantidad then
    raise exception 'Stock insuficiente en la sucursal (disponible: %, solicitado: %)', v_stock, p_cantidad;
  end if;

  for v_lote in
    select id, cantidad_restante_lote, costo_unitario
    from public.kardex_movimientos
    where producto_id = p_producto_id
      and sucursal_id = p_sucursal_id
      and tipo_movimiento in ('entrada_compra','ajuste_entrada')
      and cantidad_restante_lote > 0
    order by creado_en asc, consecutivo asc
    for update
  loop
    exit when v_pendiente <= 0;
    v_toma := least(v_lote.cantidad_restante_lote, v_pendiente);
    update public.kardex_movimientos
      set cantidad_restante_lote = cantidad_restante_lote - v_toma
      where id = v_lote.id;
    v_costo_total := v_costo_total + v_toma * v_lote.costo_unitario;
    v_pendiente := v_pendiente - v_toma;
  end loop;

  if v_pendiente > 0 then
    raise exception 'Inconsistencia FIFO en producto % / sucursal %', p_producto_id, p_sucursal_id;
  end if;

  return round(v_costo_total / p_cantidad, 2);
end;
$$;
revoke execute on function public.fn_fifo_consumir(uuid, uuid, integer) from public, anon, authenticated;

-- ---------- 6. Recepcion de compra: entra a la sucursal del receptor ----------
create or replace function public.fn_recibir_orden_compra(p_orden_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden    record;
  v_items    integer;
  v_sucursal uuid;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede recibir mercaderia';
  end if;

  v_sucursal := public.fn_mi_sucursal();
  if v_sucursal is null then
    raise exception 'Tu usuario no tiene una sucursal asignada';
  end if;

  select * into v_orden from public.ordenes_compra where id = p_orden_id for update;
  if not found then raise exception 'La orden de compra no existe'; end if;
  if v_orden.estado <> 'pendiente' then
    raise exception 'La orden ya esta en estado: %', v_orden.estado;
  end if;

  insert into public.kardex_movimientos
    (producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
     cantidad_restante_lote, referencia_tipo, referencia_id, creado_por)
  select i.producto_id, v_sucursal, 'entrada_compra', i.cantidad, i.costo_unitario,
         i.cantidad, 'orden_compra', p_orden_id, auth.uid()
  from public.orden_compra_items i
  where i.orden_compra_id = p_orden_id
  order by i.producto_id;

  get diagnostics v_items = row_count;
  if v_items = 0 then raise exception 'La orden no tiene items'; end if;

  update public.ordenes_compra
  set estado = 'recibida', fecha_recepcion = now()
  where id = p_orden_id;
end;
$$;

-- ---------- 7. Registrar venta: sale de la sucursal del vendedor ----------
create or replace function public.fn_registrar_venta(p_venta jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id    uuid;
  v_item        jsonb;
  v_producto_id uuid;
  v_cantidad    integer;
  v_precio      numeric;
  v_desc_tipo   text;
  v_desc_valor  numeric;
  v_linea       numeric;
  v_costo       numeric;
  v_subtotal    numeric := 0;
  v_desc_global numeric := 0;
  v_impuesto    numeric;
  v_base        numeric;
  v_sucursal    uuid;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado o inactivo';
  end if;
  if p_venta->'items' is null or jsonb_typeof(p_venta->'items') <> 'array'
     or jsonb_array_length(p_venta->'items') = 0 then
    raise exception 'La venta debe tener al menos un item';
  end if;

  -- sucursal: la del payload si viene, si no la del usuario logueado
  v_sucursal := coalesce((p_venta->>'sucursal_id')::uuid, public.fn_mi_sucursal());
  if v_sucursal is null then
    raise exception 'Tu usuario no tiene una sucursal asignada';
  end if;

  v_impuesto := coalesce((p_venta->>'impuesto_porcentaje')::numeric, 0);

  insert into public.ventas
    (cliente_id, proforma_origen_id, descuento_tipo, descuento_valor,
     impuesto_porcentaje, vendido_por)
  values (
    (p_venta->>'cliente_id')::uuid,
    (p_venta->>'proforma_origen_id')::uuid,
    p_venta->>'descuento_tipo',
    coalesce((p_venta->>'descuento_valor')::numeric, 0),
    v_impuesto,
    auth.uid()
  )
  returning id into v_venta_id;

  for v_item in
    select value from jsonb_array_elements(p_venta->'items')
    order by value->>'producto_id'
  loop
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::integer;
    v_precio      := (v_item->>'precio_unitario')::numeric;
    v_desc_tipo   := v_item->>'descuento_tipo';
    v_desc_valor  := coalesce((v_item->>'descuento_valor')::numeric, 0);

    if v_producto_id is null or v_cantidad is null or v_cantidad <= 0
       or v_precio is null or v_precio < 0 then
      raise exception 'Item invalido: %', v_item;
    end if;

    v_linea := v_cantidad * v_precio - case v_desc_tipo
      when 'porcentaje' then round(v_cantidad * v_precio * v_desc_valor / 100, 2)
      when 'monto_fijo' then v_desc_valor
      else 0
    end;
    if v_linea < 0 then
      raise exception 'El descuento supera el importe de la linea';
    end if;

    v_costo := public.fn_fifo_consumir(v_producto_id, v_sucursal, v_cantidad);

    insert into public.venta_items
      (venta_id, producto_id, cantidad, precio_unitario,
       descuento_tipo, descuento_valor, costo_fifo_unitario, subtotal_linea)
    values (v_venta_id, v_producto_id, v_cantidad, v_precio,
            v_desc_tipo, v_desc_valor, v_costo, round(v_linea, 2));

    insert into public.kardex_movimientos
      (producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
       referencia_tipo, referencia_id, creado_por)
    values (v_producto_id, v_sucursal, 'salida_venta', v_cantidad, v_costo,
            'venta', v_venta_id, auth.uid());

    v_subtotal := v_subtotal + round(v_linea, 2);
  end loop;

  v_desc_global := case p_venta->>'descuento_tipo'
    when 'porcentaje' then round(v_subtotal * coalesce((p_venta->>'descuento_valor')::numeric,0) / 100, 2)
    when 'monto_fijo' then coalesce((p_venta->>'descuento_valor')::numeric, 0)
    else 0
  end;
  v_base := v_subtotal - v_desc_global;
  if v_base < 0 then
    raise exception 'El descuento global supera el subtotal';
  end if;

  update public.ventas
  set subtotal = v_subtotal,
      total    = round(v_base * (1 + v_impuesto / 100), 2)
  where id = v_venta_id;

  return v_venta_id;
end;
$$;

-- ---------- 8. Ajuste de stock: por sucursal ----------
-- Se agrega p_sucursal_id (default: la del usuario). Hay que DROP + CREATE
-- porque cambia la firma. La app la llama sin p_sucursal_id => usa la del user.
drop function if exists public.fn_ajuste_stock(uuid, integer, text, text, numeric);
create or replace function public.fn_ajuste_stock(
  p_producto_id    uuid,
  p_cantidad       integer,
  p_tipo           text,
  p_motivo         text,
  p_costo_unitario numeric default null,
  p_sucursal_id    uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_costo    numeric;
  v_sucursal uuid;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede ajustar stock';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'El motivo del ajuste es obligatorio';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  v_sucursal := coalesce(p_sucursal_id, public.fn_mi_sucursal());
  if v_sucursal is null then
    raise exception 'No hay sucursal para el ajuste';
  end if;

  if p_tipo = 'entrada' then
    v_costo := coalesce(
      p_costo_unitario,
      (select costo_unitario from public.kardex_movimientos
       where producto_id = p_producto_id and sucursal_id = v_sucursal
         and tipo_movimiento in ('entrada_compra','ajuste_entrada')
       order by creado_en desc limit 1),
      0);
    insert into public.kardex_movimientos
      (producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
       cantidad_restante_lote, referencia_tipo, motivo, creado_por)
    values (p_producto_id, v_sucursal, 'ajuste_entrada', p_cantidad, v_costo,
            p_cantidad, 'ajuste_manual', p_motivo, auth.uid());

  elsif p_tipo = 'salida' then
    v_costo := public.fn_fifo_consumir(p_producto_id, v_sucursal, p_cantidad);
    insert into public.kardex_movimientos
      (producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
       referencia_tipo, motivo, creado_por)
    values (p_producto_id, v_sucursal, 'ajuste_salida', p_cantidad, v_costo,
            'ajuste_manual', p_motivo, auth.uid());

  else
    raise exception 'Tipo de ajuste invalido: use entrada o salida';
  end if;
end;
$$;
revoke execute on function public.fn_ajuste_stock(uuid, integer, text, text, numeric, uuid) from public, anon;
grant  execute on function public.fn_ajuste_stock(uuid, integer, text, text, numeric, uuid) to authenticated;

-- fn_convertir_proforma_a_venta no cambia: llama a fn_registrar_venta, que ahora
-- deriva la sucursal del usuario que convierte.

-- ---------- 9. Limpieza: quitar el FIFO viejo de 2 argumentos ----------
drop function if exists public.fn_fifo_consumir(uuid, integer);

-- ============================================================
-- VERIFICACION (correr aparte). Debe devolver 0 filas: confirma que el stock
-- por sucursal suma exactamente el total que habia en productos.stock_actual.
-- ============================================================
-- select p.codigo, p.stock_actual as total_producto,
--        coalesce(sum(pss.stock_actual),0) as suma_sucursales
-- from public.productos p
-- left join public.producto_stock_sucursal pss on pss.producto_id = p.id
-- group by p.codigo, p.stock_actual
-- having p.stock_actual <> coalesce(sum(pss.stock_actual),0);
