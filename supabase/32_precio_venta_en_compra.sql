-- ============================================================
-- SISREP — 32: Precio de venta en la orden de compra
-- Ejecutar en el SQL Editor sobre la base real.
--
-- POR QUÉ
-- Al comprar se define el costo, pero el precio de VENTA se cargaba aparte en la
-- ficha del producto, o directamente no se cargaba. Resultado real: productos
-- comprados a Bs 800 que seguían vendiéndose a Bs 324 (o a 0), sin que nada
-- avisara. La regla del cliente es simple: **el precio de venta tiene que ser
-- mayor al costo de compra**, y el momento natural para fijarlo es cuando se
-- decide el costo, o sea al armar la orden.
--
-- QUÉ HACE
--  1. `orden_compra_items.precio_venta` (nullable por las órdenes históricas).
--  2. Check en la BD: si viene, tiene que ser > costo_unitario. No alcanza con
--     validarlo en la app — es una regla de negocio y va donde no se puede saltear.
--  3. `fn_recibir_orden_compra` aplica ese precio a `productos.precio` AL RECIBIR.
--     No al crear la orden: una orden pendiente se puede cancelar y la mercadería
--     todavía no existe; cambiar el precio antes dejaría vendiendo a un precio
--     que corresponde a stock que nunca llegó.
--
-- Idempotente.
-- ============================================================

-- ---------- 1. Columna ----------
alter table public.orden_compra_items
  add column if not exists precio_venta numeric(12,2);

-- ---------- 2. La regla, en la BD ----------
alter table public.orden_compra_items
  drop constraint if exists orden_compra_items_precio_venta_check;
alter table public.orden_compra_items
  add constraint orden_compra_items_precio_venta_check
  check (precio_venta is null or precio_venta > costo_unitario);

-- ---------- 3. Recepción: aplica el precio de venta ----------
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

  select * into v_orden from public.ordenes_compra where id = p_orden_id for update;
  if not found then raise exception 'La orden de compra no existe'; end if;
  if v_orden.estado <> 'pendiente' then
    raise exception 'La orden ya esta en estado: %', v_orden.estado;
  end if;

  -- sucursal destino de la orden; si la orden no la trae (creada antes de este
  -- cambio), cae a la del usuario que recibe.
  v_sucursal := coalesce(v_orden.sucursal_id, public.fn_mi_sucursal());
  if v_sucursal is null then
    raise exception 'No hay sucursal destino para la orden';
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

  -- Recién ahora, con la mercadería adentro, se actualiza el precio de venta.
  -- Las órdenes viejas no traen precio_venta: a esas no se les toca el precio.
  update public.productos p
  set precio = i.precio_venta
  from public.orden_compra_items i
  where i.orden_compra_id = p_orden_id
    and i.producto_id = p.id
    and i.precio_venta is not null;

  update public.ordenes_compra
  set estado = 'recibida', fecha_recepcion = now()
  where id = p_orden_id;
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) la columna y el check existen:
--   select column_name from information_schema.columns
--   where table_name='orden_compra_items' and column_name='precio_venta';   -- 1 fila
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname='orden_compra_items_precio_venta_check';
--
--   -- b) el check rechaza vender por debajo del costo (debe FALLAR):
--   -- insert into orden_compra_items (orden_compra_id, producto_id, cantidad,
--   --   costo_unitario, precio_venta) values (..., 730, 700);
--
--   -- c) tras recibir una orden, el producto quedó con el precio de la orden:
--   select p.codigo, p.precio, i.precio_venta, i.costo_unitario
--   from orden_compra_items i join productos p on p.id = i.producto_id
--   join ordenes_compra oc on oc.id = i.orden_compra_id
--   where oc.estado = 'recibida' and i.precio_venta is not null
--   order by oc.fecha_recepcion desc limit 10;
-- ============================================================
