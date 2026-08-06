-- ============================================================
-- SISREP — 30: RLS por sucursal para el vendedor (Sprint 5 · C2 paso 4 · parte B)
-- Ejecutar en el SQL Editor sobre la base real.
--
-- DECISIÓN DEL CLIENTE (27 jul): el VENDEDOR ve solo ventas, proformas y pedidos
-- de SU sucursal. El admin sigue viendo todo. El catálogo de productos y el stock
-- por sucursal (producto_stock_sucursal) NO se restringen: todos los ven para
-- poder decidir traspasos. El kardex tampoco se toca.
--
-- Cómo: se reescriben SOLO las políticas de SELECT de ventas, proformas y
-- pedidos_traspaso (+ sus tablas de ítems), usando fn_es_admin() y fn_mi_sucursal()
-- (ambas SECURITY DEFINER → sin recursión de RLS). Las RPC de movimiento son
-- SECURITY DEFINER y siguen funcionando (saltan RLS), así que crear/convertir/
-- despachar no se ve afectado; solo cambia QUÉ FILAS ve el vendedor al listar.
--
-- NOTA: NO se elimina productos.stock_actual (C2 paso 4 parte A): esa columna la
-- mantiene un trigger, es correcta y quitarla es alto riesgo / bajo valor. Queda
-- como deuda aceptada.
--
-- Idempotente (drop policy if exists + create).
-- ============================================================

-- ---------- proformas ----------
drop policy if exists "proformas_select_autenticados" on public.proformas;
drop policy if exists "proformas_select_por_sucursal" on public.proformas;
create policy "proformas_select_por_sucursal" on public.proformas
  for select to authenticated
  using (public.fn_es_admin() or sucursal_id = public.fn_mi_sucursal());

drop policy if exists "pro_items_select_autenticados" on public.proforma_items;
drop policy if exists "pro_items_select_por_sucursal" on public.proforma_items;
create policy "pro_items_select_por_sucursal" on public.proforma_items
  for select to authenticated
  using (
    public.fn_es_admin()
    or exists (
      select 1 from public.proformas p
      where p.id = proforma_id and p.sucursal_id = public.fn_mi_sucursal()
    )
  );

-- ---------- ventas ----------
drop policy if exists "ventas_select_autenticados" on public.ventas;
drop policy if exists "ventas_select_por_sucursal" on public.ventas;
create policy "ventas_select_por_sucursal" on public.ventas
  for select to authenticated
  using (public.fn_es_admin() or sucursal_id = public.fn_mi_sucursal());

drop policy if exists "venta_items_select_autenticados" on public.venta_items;
drop policy if exists "venta_items_select_por_sucursal" on public.venta_items;
create policy "venta_items_select_por_sucursal" on public.venta_items
  for select to authenticated
  using (
    public.fn_es_admin()
    or exists (
      select 1 from public.ventas v
      where v.id = venta_id and v.sucursal_id = public.fn_mi_sucursal()
    )
  );

-- ---------- pedidos de traspaso (el vendedor participa como ORIGEN o DESTINO) ----------
drop policy if exists "pt_select_autenticados" on public.pedidos_traspaso;
drop policy if exists "pt_select_por_sucursal" on public.pedidos_traspaso;
create policy "pt_select_por_sucursal" on public.pedidos_traspaso
  for select to authenticated
  using (
    public.fn_es_admin()
    or sucursal_origen_id = public.fn_mi_sucursal()
    or sucursal_destino_id = public.fn_mi_sucursal()
  );

drop policy if exists "pti_select_autenticados" on public.pedido_traspaso_items;
drop policy if exists "pti_select_por_sucursal" on public.pedido_traspaso_items;
create policy "pti_select_por_sucursal" on public.pedido_traspaso_items
  for select to authenticated
  using (
    public.fn_es_admin()
    or exists (
      select 1 from public.pedidos_traspaso p
      where p.id = pedido_id
        and (p.sucursal_origen_id = public.fn_mi_sucursal()
          or p.sucursal_destino_id = public.fn_mi_sucursal())
    )
  );

-- ============================================================
-- VERIFICACION (correr aparte). Como admin, debe seguir viendo todo. Para probar
-- el vendedor de verdad hay que iniciar sesión con un usuario vendedor y confirmar
-- que sus listados solo muestran su sucursal. Que las políticas quedaron:
--   select tablename, policyname from pg_policies
--   where policyname like '%_por_sucursal' order by tablename;
--   -- Esperado: 6 filas (proformas, proforma_items, ventas, venta_items,
--   --           pedidos_traspaso, pedido_traspaso_items)
-- ============================================================
