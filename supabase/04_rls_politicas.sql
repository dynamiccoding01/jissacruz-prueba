-- ============================================================
-- SISREP — 04: Row Level Security y politicas
-- Ejecutar despues de 03_funciones_rpc.sql (usa fn_es_admin)
--
-- Modelo de seguridad:
--   * anon (clave publica sin login): CERO acceso a datos.
--   * authenticated + rol vendedor: opera POS, proformas, clientes;
--     solo lectura de catalogo e inventario.
--   * authenticated + rol admin: todo.
--   * ventas y kardex NO tienen politicas de escritura: solo se
--     escriben via funciones RPC (SECURITY DEFINER).
-- ============================================================

-- ---------- Activar RLS en todas las tablas ----------
alter table public.perfiles                        enable row level security;
alter table public.configuracion_empresa          enable row level security;
alter table public.productos                       enable row level security;
alter table public.producto_codigos_equivalentes  enable row level security;
alter table public.vehiculos                       enable row level security;
alter table public.producto_vehiculos_compatibles enable row level security;
alter table public.proveedores                     enable row level security;
alter table public.ordenes_compra                  enable row level security;
alter table public.orden_compra_items              enable row level security;
alter table public.clientes                        enable row level security;
alter table public.proformas                       enable row level security;
alter table public.proforma_items                  enable row level security;
alter table public.ventas                          enable row level security;
alter table public.venta_items                     enable row level security;
alter table public.kardex_movimientos              enable row level security;

-- Refuerzo: anon no tiene ningun privilegio sobre las tablas del sistema
revoke all on all tables in schema public from anon;

-- ---------- perfiles ----------
-- Cada usuario ve su propio perfil; el admin ve y administra todos.
-- El alta la hace el trigger de auth.users (SECURITY DEFINER), no la API.
create policy "perfiles_select_propio_o_admin" on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.fn_es_admin());

create policy "perfiles_update_solo_admin" on public.perfiles
  for update to authenticated
  using (public.fn_es_admin())
  with check (public.fn_es_admin());

-- ---------- configuracion_empresa ----------
create policy "config_select_autenticados" on public.configuracion_empresa
  for select to authenticated
  using (true);

create policy "config_update_solo_admin" on public.configuracion_empresa
  for update to authenticated
  using (public.fn_es_admin())
  with check (public.fn_es_admin());

-- ---------- productos (vendedor: solo lectura) ----------
create policy "productos_select_autenticados" on public.productos
  for select to authenticated
  using (true);

create policy "productos_insert_solo_admin" on public.productos
  for insert to authenticated
  with check (public.fn_es_admin());

-- sin politica DELETE: el borrado es logico (activo = false) via UPDATE
create policy "productos_update_solo_admin" on public.productos
  for update to authenticated
  using (public.fn_es_admin())
  with check (public.fn_es_admin());

-- ---------- codigos equivalentes y vehiculos compatibles ----------
create policy "codigos_select_autenticados" on public.producto_codigos_equivalentes
  for select to authenticated using (true);
create policy "codigos_insert_solo_admin" on public.producto_codigos_equivalentes
  for insert to authenticated with check (public.fn_es_admin());
create policy "codigos_update_solo_admin" on public.producto_codigos_equivalentes
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());
create policy "codigos_delete_solo_admin" on public.producto_codigos_equivalentes
  for delete to authenticated using (public.fn_es_admin());

-- catalogo de vehiculos: mismo criterio (lectura abierta, escritura solo admin)
create policy "vehiculos_select_autenticados" on public.vehiculos
  for select to authenticated using (true);
create policy "vehiculos_insert_solo_admin" on public.vehiculos
  for insert to authenticated with check (public.fn_es_admin());
create policy "vehiculos_update_solo_admin" on public.vehiculos
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());
create policy "vehiculos_delete_solo_admin" on public.vehiculos
  for delete to authenticated using (public.fn_es_admin());

-- compatibilidad producto-vehiculo (tabla intermedia)
create policy "pvc_select_autenticados" on public.producto_vehiculos_compatibles
  for select to authenticated using (true);
create policy "pvc_insert_solo_admin" on public.producto_vehiculos_compatibles
  for insert to authenticated with check (public.fn_es_admin());
create policy "pvc_update_solo_admin" on public.producto_vehiculos_compatibles
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());
create policy "pvc_delete_solo_admin" on public.producto_vehiculos_compatibles
  for delete to authenticated using (public.fn_es_admin());

-- ---------- proveedores (solo admin, incluso lectura — FLUJO.md §10) ----------
create policy "proveedores_select_solo_admin" on public.proveedores
  for select to authenticated using (public.fn_es_admin());
create policy "proveedores_insert_solo_admin" on public.proveedores
  for insert to authenticated with check (public.fn_es_admin());
create policy "proveedores_update_solo_admin" on public.proveedores
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());

-- ---------- compras (solo admin) ----------
create policy "ordenes_select_solo_admin" on public.ordenes_compra
  for select to authenticated using (public.fn_es_admin());
create policy "ordenes_insert_solo_admin" on public.ordenes_compra
  for insert to authenticated with check (public.fn_es_admin());
-- el paso a 'recibida' lo hace fn_recibir_orden_compra; este UPDATE cubre
-- notas y cancelacion
create policy "ordenes_update_solo_admin" on public.ordenes_compra
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());

create policy "oc_items_select_solo_admin" on public.orden_compra_items
  for select to authenticated using (public.fn_es_admin());
create policy "oc_items_insert_solo_admin" on public.orden_compra_items
  for insert to authenticated with check (public.fn_es_admin());
create policy "oc_items_update_solo_admin" on public.orden_compra_items
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());
create policy "oc_items_delete_solo_admin" on public.orden_compra_items
  for delete to authenticated using (public.fn_es_admin());

-- ---------- clientes (ambos roles crean y consultan) ----------
create policy "clientes_select_autenticados" on public.clientes
  for select to authenticated using (true);
create policy "clientes_insert_autenticados" on public.clientes
  for insert to authenticated with check (true);
create policy "clientes_update_autenticados" on public.clientes
  for update to authenticated using (true) with check (true);
create policy "clientes_delete_solo_admin" on public.clientes
  for delete to authenticated using (public.fn_es_admin());

-- ---------- proformas (ambos roles; edicion solo mientras este vigente) ----------
create policy "proformas_select_autenticados" on public.proformas
  for select to authenticated using (true);
create policy "proformas_insert_autenticados" on public.proformas
  for insert to authenticated with check (creado_por = auth.uid());
-- la conversion a venta la hace la RPC (salta RLS); esto cubre la edicion
create policy "proformas_update_vigentes" on public.proformas
  for update to authenticated
  using (estado = 'vigente' or public.fn_es_admin())
  with check (true);
create policy "proformas_delete_solo_admin" on public.proformas
  for delete to authenticated using (public.fn_es_admin());

create policy "pro_items_select_autenticados" on public.proforma_items
  for select to authenticated using (true);
create policy "pro_items_insert_vigentes" on public.proforma_items
  for insert to authenticated
  with check (exists (
    select 1 from public.proformas p
    where p.id = proforma_id and (p.estado = 'vigente' or public.fn_es_admin())
  ));
create policy "pro_items_update_vigentes" on public.proforma_items
  for update to authenticated
  using (exists (
    select 1 from public.proformas p
    where p.id = proforma_id and (p.estado = 'vigente' or public.fn_es_admin())
  ))
  with check (true);
create policy "pro_items_delete_vigentes" on public.proforma_items
  for delete to authenticated
  using (exists (
    select 1 from public.proformas p
    where p.id = proforma_id and (p.estado = 'vigente' or public.fn_es_admin())
  ));

-- ---------- ventas (lectura si; escritura SOLO via fn_registrar_venta) ----------
create policy "ventas_select_autenticados" on public.ventas
  for select to authenticated using (true);

create policy "venta_items_select_autenticados" on public.venta_items
  for select to authenticated using (true);

-- ---------- kardex (lectura si; escritura SOLO via RPC) ----------
create policy "kardex_select_autenticados" on public.kardex_movimientos
  for select to authenticated using (true);
