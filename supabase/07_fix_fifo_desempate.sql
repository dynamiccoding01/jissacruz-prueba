-- ============================================================
-- SISREP — 07: FIX — desempate determinista del FIFO
-- Ejecutar SOLO si la base ya fue creada con la version original
-- de 01/03 (el bug: dos lotes creados en la misma transaccion
-- comparten creado_en y el desempate por UUID era aleatorio).
-- Las instalaciones nuevas ya incluyen esto en 01 y 03.
-- ============================================================

-- Orden real de insercion como desempate del FIFO
alter table public.kardex_movimientos
  add column consecutivo bigint generated always as identity;

create or replace function public.fn_fifo_consumir(p_producto_id uuid, p_cantidad integer)
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
  select stock_actual into v_stock
  from public.productos
  where id = p_producto_id and activo
  for update;  -- serializa las salidas del mismo producto

  if v_stock is null then
    raise exception 'Producto % no existe o esta inactivo', p_producto_id;
  end if;
  if v_stock < p_cantidad then
    raise exception 'Stock insuficiente (disponible: %, solicitado: %)', v_stock, p_cantidad;
  end if;

  for v_lote in
    select id, cantidad_restante_lote, costo_unitario
    from public.kardex_movimientos
    where producto_id = p_producto_id
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
    raise exception 'Inconsistencia FIFO en producto %: stock_actual no coincide con lotes', p_producto_id;
  end if;

  return round(v_costo_total / p_cantidad, 2);
end;
$$;
