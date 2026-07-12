-- ============================================================
-- SISREP — 05: Indices y Storage
-- Ejecutar despues de 04_rls_politicas.sql
-- ============================================================

-- ---------- Indices (BACKEND.md §7) ----------
-- Nota: productos.codigo, proformas.numero y ventas.numero ya tienen
-- indice por sus constraints UNIQUE; no se duplican aqui.

create index idx_productos_descripcion
  on public.productos using gin (to_tsvector('spanish', descripcion));

create index idx_codigos_equivalentes_codigo
  on public.producto_codigos_equivalentes (codigo_equivalente);

create index idx_codigos_equivalentes_producto
  on public.producto_codigos_equivalentes (producto_id);

-- vehiculos.marca/modelo ya tiene indice implicito por el unique(marca, modelo)

create index idx_pvc_vehiculo
  on public.producto_vehiculos_compatibles (vehiculo_id);

create index idx_pvc_producto
  on public.producto_vehiculos_compatibles (producto_id);

create index idx_kardex_producto_fecha
  on public.kardex_movimientos (producto_id, creado_en);

-- acelera el recorrido de lotes abiertos en fn_fifo_consumir
create index idx_kardex_lotes_abiertos
  on public.kardex_movimientos (producto_id, creado_en)
  where cantidad_restante_lote > 0;

create index idx_kardex_referencia
  on public.kardex_movimientos (referencia_tipo, referencia_id);

create index idx_proformas_estado on public.proformas (estado);
create index idx_proformas_cliente on public.proformas (cliente_id);
create index idx_proformas_fecha on public.proformas (creado_en);

create index idx_ventas_fecha on public.ventas (creado_en);
create index idx_ventas_cliente on public.ventas (cliente_id);

create index idx_oc_proveedor on public.ordenes_compra (proveedor_id);
create index idx_oc_items_orden on public.orden_compra_items (orden_compra_id);
create index idx_pro_items_proforma on public.proforma_items (proforma_id);
create index idx_venta_items_venta on public.venta_items (venta_id);
-- para el reporte de productos mas vendidos
create index idx_venta_items_producto on public.venta_items (producto_id);

-- ---------- Storage: buckets ----------
insert into storage.buckets (id, name, public)
values
  ('productos-imagenes', 'productos-imagenes', true),
  ('logo-empresa', 'logo-empresa', true)
on conflict (id) do nothing;

-- ---------- Storage: politicas ----------
-- Lectura publica via URL publica (bucket public = true).
-- Listado por API solo autenticados; escritura solo admin.
create policy "storage_select_autenticados" on storage.objects
  for select to authenticated
  using (bucket_id in ('productos-imagenes','logo-empresa'));

create policy "storage_insert_solo_admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('productos-imagenes','logo-empresa')
    and public.fn_es_admin()
  );

create policy "storage_update_solo_admin" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('productos-imagenes','logo-empresa')
    and public.fn_es_admin()
  )
  with check (
    bucket_id in ('productos-imagenes','logo-empresa')
    and public.fn_es_admin()
  );

create policy "storage_delete_solo_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('productos-imagenes','logo-empresa')
    and public.fn_es_admin()
  );
