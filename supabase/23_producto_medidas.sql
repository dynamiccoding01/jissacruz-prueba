-- ============================================================
-- SISREP — 23: Medidas estructuradas (Sprint 6 · Parte I · Fase 2)
-- Ejecutar en el SQL Editor DESPUÉS del 22.
--
-- Guarda las medidas del producto etiquetadas y estructuradas (no texto libre):
--   A: 45,40MM   B: 17,00MM
-- La etiqueta es obligatoria (Q2): el usuario siempre pone la letra.
--
-- Suma `p_medidas` a `fn_guardar_producto` (pasa de 6 a 7 args → se dropea la de 6).
-- Requiere el 22 (la RPC de 6 args y la tabla de originales). Idempotente.
-- ============================================================

-- ---------- 1. Tabla de medidas ----------
create table if not exists public.producto_medidas (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  etiqueta    text not null,                       -- 'A', 'B', 'DIÁMETRO', 'LARGO'
  valor       numeric(12,2) not null check (valor > 0),
  unidad      text not null default 'MM',          -- MM, CM, PULG
  orden       smallint not null default 0,         -- para renderizar A antes que B
  unique (producto_id, etiqueta)
);
create index if not exists idx_producto_medidas_producto
  on public.producto_medidas (producto_id);

alter table public.producto_medidas enable row level security;

drop policy if exists "pm_select_autenticados" on public.producto_medidas;
create policy "pm_select_autenticados" on public.producto_medidas
  for select to authenticated using (true);

drop policy if exists "pm_admin_insert" on public.producto_medidas;
create policy "pm_admin_insert" on public.producto_medidas
  for insert to authenticated with check (public.fn_es_admin());

drop policy if exists "pm_admin_update" on public.producto_medidas;
create policy "pm_admin_update" on public.producto_medidas
  for update to authenticated using (public.fn_es_admin());

drop policy if exists "pm_admin_delete" on public.producto_medidas;
create policy "pm_admin_delete" on public.producto_medidas
  for delete to authenticated using (public.fn_es_admin());

-- ---------- 2. fn_guardar_producto: suma p_medidas ----------
drop function if exists public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb);
create or replace function public.fn_guardar_producto(
  p_id            uuid,
  p_producto      jsonb,
  p_equivalentes  jsonb default '[]'::jsonb,
  p_originales    jsonb default '[]'::jsonb,
  p_vehiculos     jsonb default '[]'::jsonb,
  p_precios_mayor jsonb default '[]'::jsonb,
  p_medidas       jsonb default '[]'::jsonb
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
  v_orden       smallint := 0;
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
  delete from public.producto_medidas where producto_id = v_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_equivalentes, '[]'::jsonb)) loop
    insert into public.producto_codigos_equivalentes (producto_id, codigo_equivalente)
    values (v_id, v_item->>'codigo_equivalente');
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_originales, '[]'::jsonb)) loop
    insert into public.producto_codigos_originales (producto_id, codigo_original)
    values (v_id, v_item->>'codigo_original');
  end loop;

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

  for v_item in select value from jsonb_array_elements(coalesce(p_precios_mayor, '[]'::jsonb)) loop
    insert into public.producto_precios_mayor (producto_id, cantidad_minima, precio, vigente_hasta)
    values (
      v_id,
      (v_item->>'cantidad_minima')::integer,
      (v_item->>'precio')::numeric,
      nullif(v_item->>'vigente_hasta', '')::date
    );
  end loop;

  -- Medidas (conserva el orden en que llegan del formulario)
  for v_item in select value from jsonb_array_elements(coalesce(p_medidas, '[]'::jsonb)) loop
    insert into public.producto_medidas (producto_id, etiqueta, valor, unidad, orden)
    values (
      v_id,
      v_item->>'etiqueta',
      (v_item->>'valor')::numeric,
      coalesce(nullif(v_item->>'unidad', ''), 'MM'),
      v_orden
    );
    v_orden := v_orden + 1;
  end loop;

  return v_id;
end;
$$;
revoke execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   select column_name from information_schema.columns
--   where table_name = 'producto_medidas';   -- id, producto_id, etiqueta, valor, unidad, orden
-- ============================================================
