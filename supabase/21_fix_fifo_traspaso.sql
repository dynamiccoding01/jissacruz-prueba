-- ============================================================
-- SISREP — 21: FIX CRITICO — el FIFO no consumia los lotes de traspaso
-- Ejecutar en el SQL Editor sobre una base que ya corrio 14, 19 y 20.
-- URGENTE si se usa el modulo /traspasos: sin este fix no se puede VENDER
-- (ni ajustar, ni re-traspasar) el stock que entro por una recepcion de
-- traspaso.
--
-- BUG (contraparte del que arreglo el script 20):
--   El script 20 corrigio el TRIGGER para que 'entrada_traspaso' SUME al cache
--   de stock (producto_stock_sucursal), asi que el inventario muestra el stock
--   como "Disponible". Pero fn_fifo_consumir (script 14) solo recorre lotes de
--   tipo 'entrada_compra' y 'ajuste_entrada' — NUNCA 'entrada_traspaso'.
--   Resultado: al vender/ajustar/re-traspasar un producto cuyo stock vino por
--   un traspaso recibido, el cache dice "hay stock" (pasa la validacion) pero
--   el bucle FIFO no encuentra lotes que consumir => queda cantidad pendiente
--   => lanza 'Inconsistencia FIFO en producto % / sucursal %'.
--
-- FIX: agregar 'entrada_traspaso' a los tipos de lote que consume el FIFO.
--   Los lotes de recepcion de traspaso ya traen cantidad_restante_lote seteado
--   (script 19), asi que quedan disponibles para consumo por orden FIFO
--   (creado_en, consecutivo) igual que compras y ajustes de entrada.
--
-- Idempotente (create or replace).
-- ============================================================

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
      -- FIX 21: incluir 'entrada_traspaso' (lote generado al recibir un traspaso)
      and tipo_movimiento in ('entrada_compra','ajuste_entrada','entrada_traspaso')
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

-- ============================================================
-- VERIFICACION (correr aparte; no modifica nada)
--
--   -- a) el FIFO ya conoce los lotes de traspaso:
--   select prosrc like '%entrada_traspaso%' as fifo_corregido
--   from pg_proc where proname = 'fn_fifo_consumir';
--   -- Esperado: true
--
--   -- b) productos con stock cacheado pero SIN lotes consumibles suficientes
--   --    (deberia dar 0 filas tras el fix; si hay filas, ese stock nunca se
--   --     podra vender aunque el cache lo muestre disponible):
--   select pss.producto_id, pss.sucursal_id,
--          pss.stock_actual as cache,
--          coalesce(sum(k.cantidad_restante_lote), 0) as lotes_disponibles
--   from public.producto_stock_sucursal pss
--   left join public.kardex_movimientos k
--     on k.producto_id = pss.producto_id
--    and k.sucursal_id = pss.sucursal_id
--    and k.tipo_movimiento in ('entrada_compra','ajuste_entrada','entrada_traspaso')
--    and k.cantidad_restante_lote > 0
--   where pss.stock_actual > 0
--   group by pss.producto_id, pss.sucursal_id, pss.stock_actual
--   having pss.stock_actual <> coalesce(sum(k.cantidad_restante_lote), 0);
--   -- Esperado: 0 filas
-- ============================================================
