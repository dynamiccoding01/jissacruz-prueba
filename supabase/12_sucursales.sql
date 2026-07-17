-- ============================================================
-- SISREP — 12: Sucursales (C2 · paso 1)
-- Solo crea la tabla y su ABM. NO toca el stock todavia (eso es el paso 3).
-- Ejecutar en el SQL Editor sobre una base que ya corrio 00 (o 01-11).
-- Idempotente.
-- ============================================================

create table if not exists public.sucursales (
  id        uuid primary key default gen_random_uuid(),
  codigo    text not null unique,   -- ej "1" -> se muestra como "Sucursal 1"
  nombre    text not null,
  direccion text,
  telefono  text,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Sucursal por defecto: sirve para migrar el historico (paso 3) y para arrancar
-- hoy. Solo se inserta si la tabla esta vacia.
insert into public.sucursales (codigo, nombre)
select '1', 'Casa Matriz'
where not exists (select 1 from public.sucursales);

-- ---------- RLS ----------
-- Lectura para todos los autenticados (se necesita ver las sucursales en la UI);
-- alta/edicion solo admin. El borrado es logico (activo = false) via update.
alter table public.sucursales enable row level security;

create policy "sucursales_select_autenticados" on public.sucursales
  for select to authenticated using (true);
create policy "sucursales_insert_solo_admin" on public.sucursales
  for insert to authenticated with check (public.fn_es_admin());
create policy "sucursales_update_solo_admin" on public.sucursales
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());
