-- ============================================================
-- SISREP — 18: Precios por mayor escalonados (C3 · paso 1)
-- Ejecutar en el SQL Editor sobre una base que ya corrio 00 (o 01-17).
--
-- Por producto, varias escalas de precio segun cantidad minima
-- (ej. >=20 -> Bs 90, >=100 -> Bs 80), cada una con fecha de
-- vigencia opcional ("Lim" en el sistema del cliente): pasada la
-- fecha, la escala deja de aplicar.
--
-- Este paso crea la tabla + su ABM (se administra desde la ficha
-- del producto). El paso 2 aplica el precio en proforma/POS segun
-- cantidad y fecha.
--
-- Idempotente.
-- ============================================================

create table if not exists public.producto_precios_mayor (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references public.productos(id) on delete cascade,
  cantidad_minima integer not null check (cantidad_minima > 1),
  precio          numeric not null check (precio >= 0),
  vigente_hasta   date,               -- null = sin fecha limite
  creado_en       timestamptz not null default now(),
  unique (producto_id, cantidad_minima)
);

create index if not exists idx_precios_mayor_producto
  on public.producto_precios_mayor (producto_id);

-- RLS: todos los autenticados leen (el POS/proforma necesita consultar la
-- escala); solo el admin administra (mismo criterio que el CRUD de productos).
alter table public.producto_precios_mayor enable row level security;

drop policy if exists "ppm_select_autenticados" on public.producto_precios_mayor;
create policy "ppm_select_autenticados" on public.producto_precios_mayor
  for select to authenticated using (true);

drop policy if exists "ppm_insert_admin" on public.producto_precios_mayor;
create policy "ppm_insert_admin" on public.producto_precios_mayor
  for insert to authenticated with check (public.fn_es_admin());

drop policy if exists "ppm_update_admin" on public.producto_precios_mayor;
create policy "ppm_update_admin" on public.producto_precios_mayor
  for update to authenticated using (public.fn_es_admin());

drop policy if exists "ppm_delete_admin" on public.producto_precios_mayor;
create policy "ppm_delete_admin" on public.producto_precios_mayor
  for delete to authenticated using (public.fn_es_admin());

-- ============================================================
-- VERIFICACION (correr aparte; no modifica nada)
--
--   select table_name from information_schema.tables
--   where table_name = 'producto_precios_mayor';
--   -- Esperado: 1 fila
--
--   select policyname from pg_policies
--   where tablename = 'producto_precios_mayor' order by policyname;
--   -- Esperado: 4 politicas (select/insert/update/delete)
-- ============================================================
