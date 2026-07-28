-- ============================================================
-- SISREP — 22: Códigos originales (Sprint 6 · Parte I · Fase 1)
-- Ejecutar en el SQL Editor sobre la base real, DESPUÉS del 29.
--
-- ⚠️⚠️ HACER UN SNAPSHOT / BACKUP DE LA BD ANTES DE CORRER ESTE SCRIPT.
-- Es la ÚNICA operación del Sprint 6 que MUEVE datos existentes y DROPEA una
-- columna: mueve las 810 filas de `producto_codigos_equivalentes` (todas OEM mal
-- clasificadas) a la tabla nueva `producto_codigos_originales`, vacía la de
-- equivalentes y elimina la columna `fabricante` (Q1). Es reversible con el insert
-- inverso, pero el snapshot lo cierra sin riesgo.
--
-- Los 3 niveles de código quedan: `productos.codigo` (tienda) · códigos ORIGINALES
-- (OEM, tabla nueva, N) · códigos EQUIVALENTES (otro fabricante, tabla existente, N).
--
-- Incluye la RPC `fn_guardar_producto` REESCRITA: suma `p_originales` y deja de
-- usar `fabricante`. Cambia la firma (de 5 a 6 args) → la app llama la nueva.
--
-- Idempotente: la migración solo corre mientras `fabricante` exista (primera vez).
-- ============================================================

-- ---------- 1. Tabla de códigos originales ----------
create table if not exists public.producto_codigos_originales (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references public.productos(id) on delete cascade,
  codigo_original text not null,
  creado_en       timestamptz not null default now(),
  unique (producto_id, codigo_original)
);
create index if not exists idx_codigos_originales_codigo
  on public.producto_codigos_originales (codigo_original);

alter table public.producto_codigos_originales enable row level security;

drop policy if exists "pco_select_autenticados" on public.producto_codigos_originales;
create policy "pco_select_autenticados" on public.producto_codigos_originales
  for select to authenticated using (true);

drop policy if exists "pco_admin_insert" on public.producto_codigos_originales;
create policy "pco_admin_insert" on public.producto_codigos_originales
  for insert to authenticated with check (public.fn_es_admin());

drop policy if exists "pco_admin_update" on public.producto_codigos_originales;
create policy "pco_admin_update" on public.producto_codigos_originales
  for update to authenticated using (public.fn_es_admin());

drop policy if exists "pco_admin_delete" on public.producto_codigos_originales;
create policy "pco_admin_delete" on public.producto_codigos_originales
  for delete to authenticated using (public.fn_es_admin());

-- ---------- 2. Migración de los 810 (ANTES de borrar `fabricante`) ----------
-- Solo corre mientras `fabricante` exista: así re-correr el script no vuelve a
-- mover equivalentes reales que se hayan cargado después.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'producto_codigos_equivalentes'
      and column_name = 'fabricante'
  ) then
    insert into public.producto_codigos_originales (producto_id, codigo_original)
    select producto_id, codigo_equivalente
    from public.producto_codigos_equivalentes
    on conflict (producto_id, codigo_original) do nothing;

    delete from public.producto_codigos_equivalentes;
  end if;
end $$;

-- ---------- 3. UNIQUE que le faltaba a equivalentes ----------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'producto_codigos_equivalentes_producto_codigo_key'
  ) then
    alter table public.producto_codigos_equivalentes
      add constraint producto_codigos_equivalentes_producto_codigo_key
      unique (producto_id, codigo_equivalente);
  end if;
end $$;

-- ---------- 4. Quitar la columna `fabricante` (Q1) ----------
alter table public.producto_codigos_equivalentes drop column if exists fabricante;

-- ---------- 5. RPC de guardado reescrita: suma originales, sin fabricante ----------
drop function if exists public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb);
create or replace function public.fn_guardar_producto(
  p_id            uuid,
  p_producto      jsonb,
  p_equivalentes  jsonb default '[]'::jsonb,
  p_originales    jsonb default '[]'::jsonb,
  p_vehiculos     jsonb default '[]'::jsonb,
  p_precios_mayor jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id          uuid;
  v_item        jsonb;
  v_vehiculo_id uuid;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede guardar productos';
  end if;

  if p_id is null then
    insert into public.productos
      (codigo, descripcion, linea_marca, unidad_medida, precio, stock_minimo, imagen_url, creado_por)
    values (
      p_producto->>'codigo',
      p_producto->>'descripcion',
      nullif(p_producto->>'linea_marca', ''),
      p_producto->>'unidad_medida',
      coalesce((p_producto->>'precio')::numeric, 0),
      coalesce((p_producto->>'stock_minimo')::integer, 0),
      nullif(p_producto->>'imagen_url', ''),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.productos set
      codigo        = p_producto->>'codigo',
      descripcion   = p_producto->>'descripcion',
      linea_marca   = nullif(p_producto->>'linea_marca', ''),
      unidad_medida = p_producto->>'unidad_medida',
      precio        = coalesce((p_producto->>'precio')::numeric, 0),
      stock_minimo  = coalesce((p_producto->>'stock_minimo')::integer, 0),
      imagen_url    = nullif(p_producto->>'imagen_url', '')
    where id = p_id;
    if not found then
      raise exception 'El producto no existe';
    end if;
    v_id := p_id;
  end if;

  -- Reemplazo de hijos (todo en la misma transacción)
  delete from public.producto_codigos_equivalentes where producto_id = v_id;
  delete from public.producto_codigos_originales where producto_id = v_id;
  delete from public.producto_vehiculos_compatibles where producto_id = v_id;
  delete from public.producto_precios_mayor where producto_id = v_id;

  -- Códigos equivalentes (otro fabricante) — ya sin columna `fabricante`
  for v_item in select value from jsonb_array_elements(coalesce(p_equivalentes, '[]'::jsonb)) loop
    insert into public.producto_codigos_equivalentes (producto_id, codigo_equivalente)
    values (v_id, v_item->>'codigo_equivalente');
  end loop;

  -- Códigos originales (OEM)
  for v_item in select value from jsonb_array_elements(coalesce(p_originales, '[]'::jsonb)) loop
    insert into public.producto_codigos_originales (producto_id, codigo_original)
    values (v_id, v_item->>'codigo_original');
  end loop;

  -- Vehículos compatibles
  for v_item in select value from jsonb_array_elements(coalesce(p_vehiculos, '[]'::jsonb)) loop
    insert into public.vehiculos (marca, modelo)
    values (v_item->>'marca', v_item->>'modelo')
    on conflict (marca, modelo) do update set marca = excluded.marca
    returning id into v_vehiculo_id;

    insert into public.producto_vehiculos_compatibles (producto_id, vehiculo_id, anio_desde, anio_hasta)
    values (
      v_id,
      v_vehiculo_id,
      nullif(v_item->>'anio_desde', '')::integer,
      nullif(v_item->>'anio_hasta', '')::integer
    );
  end loop;

  -- Precios por mayor
  for v_item in select value from jsonb_array_elements(coalesce(p_precios_mayor, '[]'::jsonb)) loop
    insert into public.producto_precios_mayor (producto_id, cantidad_minima, precio, vigente_hasta)
    values (
      v_id,
      (v_item->>'cantidad_minima')::integer,
      (v_item->>'precio')::numeric,
      nullif(v_item->>'vigente_hasta', '')::date
    );
  end loop;

  return v_id;
end;
$$;
revoke execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   select (select count(*) from producto_codigos_originales)   as originales,   -- esperado: 810
--          (select count(*) from producto_codigos_equivalentes) as equivalentes; -- esperado: 0
--   -- la columna fabricante ya no existe:
--   select count(*) from information_schema.columns
--   where table_name='producto_codigos_equivalentes' and column_name='fabricante';  -- 0
-- ============================================================
