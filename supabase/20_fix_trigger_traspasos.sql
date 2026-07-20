-- ============================================================
-- SISREP — 20: FIX CRITICO — el trigger de stock no conocia los traspasos
-- Ejecutar en el SQL Editor sobre una base que ya corrio 19. URGENTE si se
-- va a usar el modulo /traspasos.
--
-- BUG: fn_kardex_aplica_stock (script 14) trataba como ENTRADA solo
-- 'entrada_compra' y 'ajuste_entrada'; cualquier otro tipo RESTA. El script 19
-- agrego 'entrada_traspaso' sin actualizar el trigger, asi que al RECIBIR un
-- traspaso el stock del DESTINO se restaba en vez de sumarse (el producto
-- "salia" de ambas sucursales). 'salida_traspaso' si estaba bien (resta).
--
-- Este script:
--   1. Corrige el trigger: 'entrada_traspaso' suma.
--   2. Repara el stock si ya se recibieron traspasos con el trigger roto
--      (recomputa el cache desde el kardex, la fuente de verdad).
--   3. Bonus: agrega el UNIQUE que le falta a producto_precios_mayor
--      (la version aplicada en la BD no lo traia; el ABM de la app
--      reemplaza el set completo, pero el candado evita duplicados por
--      inserciones concurrentes o cargas externas).
--
-- Idempotente.
-- ============================================================

-- ---------- 1. Trigger corregido ----------
create or replace function public.fn_kardex_aplica_stock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_delta integer;
begin
  -- entradas: compra, ajuste de entrada y RECEPCION de traspaso.
  -- salidas: venta, ajuste de salida y ENVIO de traspaso.
  v_delta := case when new.tipo_movimiento in
                    ('entrada_compra','ajuste_entrada','entrada_traspaso')
                  then new.cantidad else -new.cantidad end;

  -- cache por sucursal (la fuente para la UI)
  insert into public.producto_stock_sucursal (producto_id, sucursal_id, stock_actual)
  values (new.producto_id, new.sucursal_id, v_delta)
  on conflict (producto_id, sucursal_id) do update
    set stock_actual = public.producto_stock_sucursal.stock_actual + v_delta;

  -- TOTAL transicional (se elimina cuando C2 paso 4 lo convierta en vista).
  -- pg_trigger_depth() > 1 aca, asi que pasa el guard de productos.
  update public.productos
  set stock_actual = stock_actual + v_delta
  where id = new.producto_id;

  return new;
end;
$$;

-- ---------- 2. Reparacion del cache (por si ya hubo recepciones rotas) ----------
-- Recomputa producto_stock_sucursal y productos.stock_actual desde el kardex.
-- Seguro de correr siempre: si no hubo traspasos rotos, deja los mismos valores.
with esperado as (
  select producto_id, sucursal_id,
         sum(case when tipo_movimiento in
                    ('entrada_compra','ajuste_entrada','entrada_traspaso')
                  then cantidad else -cantidad end) as stock
  from public.kardex_movimientos
  group by producto_id, sucursal_id
)
update public.producto_stock_sucursal pss
set stock_actual = e.stock
from esperado e
where e.producto_id = pss.producto_id
  and e.sucursal_id = pss.sucursal_id
  and pss.stock_actual <> e.stock;

update public.productos p
set stock_actual = coalesce(t.total, 0)
from (
  select producto_id, sum(stock_actual) as total
  from public.producto_stock_sucursal
  group by producto_id
) t
where t.producto_id = p.id
  and p.stock_actual <> coalesce(t.total, 0);

-- ---------- 3. UNIQUE faltante en precios por mayor ----------
-- Primero elimina duplicados (conserva la escala mas reciente por producto+cantidad).
delete from public.producto_precios_mayor a
using public.producto_precios_mayor b
where a.producto_id = b.producto_id
  and a.cantidad_minima = b.cantidad_minima
  and a.creado_en < b.creado_en;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'producto_precios_mayor_producto_cantidad_key'
  ) then
    alter table public.producto_precios_mayor
      add constraint producto_precios_mayor_producto_cantidad_key
      unique (producto_id, cantidad_minima);
  end if;
end $$;

-- ============================================================
-- VERIFICACION (correr aparte; no modifica nada)
--
--   -- a) el trigger ya conoce los traspasos:
--   select prosrc like '%entrada_traspaso%' as trigger_corregido
--   from pg_proc where proname = 'fn_kardex_aplica_stock';
--   -- Esperado: true
--
--   -- b) el cache cuadra con el kardex (0 filas = todo consistente):
--   select k.producto_id, k.sucursal_id, k.stock as kardex, pss.stock_actual as cache
--   from (
--     select producto_id, sucursal_id,
--            sum(case when tipo_movimiento in
--                      ('entrada_compra','ajuste_entrada','entrada_traspaso')
--                    then cantidad else -cantidad end) as stock
--     from public.kardex_movimientos group by producto_id, sucursal_id
--   ) k
--   join public.producto_stock_sucursal pss
--     on pss.producto_id = k.producto_id and pss.sucursal_id = k.sucursal_id
--   where pss.stock_actual <> k.stock;
--   -- Esperado: 0 filas
--
--   -- c) el unique de precios existe:
--   select conname from pg_constraint
--   where conname = 'producto_precios_mayor_producto_cantidad_key';
--   -- Esperado: 1 fila
-- ============================================================
