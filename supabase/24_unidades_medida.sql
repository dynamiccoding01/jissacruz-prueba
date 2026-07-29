-- ============================================================
-- SISREP — 24: Catálogo de unidades de medida (Sprint 6 · Parte I · Fase 3)
-- Ejecutar en el SQL Editor DESPUÉS del 22 y 23.
--
-- Crea el catálogo administrable de unidades (Pieza, Docena, Juego…) y una FK
-- opcional en productos. SIN CONVERSIÓN: la unidad es solo un atributo del
-- producto; el stock/kardex/FIFO no se tocan.
--
-- La tabla se crea VACÍA (decisión del cliente): las unidades reales las carga el
-- admin desde el ABM. Por eso `unidad_medida_id` es NULLABLE y NO se borra la
-- columna de texto `productos.unidad_medida` (conviven; la UI lee id ?? texto).
-- La columna de texto se elimina en un paso posterior (3.4), cuando el catálogo
-- esté cargado y asignado.
--
-- Suma `unidad_medida_id` a `fn_guardar_producto` (dentro de p_producto, sin
-- cambiar la firma) e incorpora la GUARDA R1: no se puede cambiar la unidad
-- (texto) de un producto que ya tiene movimientos de kardex.
--
-- Requiere el 22 y el 23. Idempotente.
-- ============================================================

-- ---------- 1. Catálogo de unidades ----------
create table if not exists public.unidades_medida (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,        -- 'PZA','DOC','JGO','PAR','CAJ'
  nombre      text not null,               -- 'Pieza','Docena','Juego'
  abreviatura text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

alter table public.unidades_medida enable row level security;

drop policy if exists "um_select_autenticados" on public.unidades_medida;
create policy "um_select_autenticados" on public.unidades_medida
  for select to authenticated using (true);

drop policy if exists "um_admin_insert" on public.unidades_medida;
create policy "um_admin_insert" on public.unidades_medida
  for insert to authenticated with check (public.fn_es_admin());

drop policy if exists "um_admin_update" on public.unidades_medida;
create policy "um_admin_update" on public.unidades_medida
  for update to authenticated using (public.fn_es_admin());

drop policy if exists "um_admin_delete" on public.unidades_medida;
create policy "um_admin_delete" on public.unidades_medida
  for delete to authenticated using (public.fn_es_admin());

-- ---------- 2. FK en productos (nullable, no borra el texto) ----------
alter table public.productos
  add column if not exists unidad_medida_id uuid references public.unidades_medida(id) on delete restrict;

-- ---------- 3. fn_guardar_producto: unidad_medida_id + guarda R1 ----------
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
      (codigo, descripcion, linea_marca, unidad_medida, unidad_medida_id,
       precio, stock_minimo, imagen_url, creado_por)
    values (
      p_producto->>'codigo',
      p_producto->>'descripcion',
      nullif(p_producto->>'linea_marca', ''),
      p_producto->>'unidad_medida',
      nullif(p_producto->>'unidad_medida_id', '')::uuid,
      coalesce((p_producto->>'precio')::numeric, 0),
      coalesce((p_producto->>'stock_minimo')::integer, 0),
      nullif(p_producto->>'imagen_url', ''),
      auth.uid()
    )
    returning id into v_id;
  else
    -- R1: no cambiar la unidad (texto) de un producto que ya tiene movimientos.
    if exists (select 1 from public.kardex_movimientos where producto_id = p_id)
       and exists (
         select 1 from public.productos
         where id = p_id
           and unidad_medida is distinct from (p_producto->>'unidad_medida')
       ) then
      raise exception 'No se puede cambiar la unidad de un producto que ya tiene movimientos de stock';
    end if;

    update public.productos set
      codigo           = p_producto->>'codigo',
      descripcion      = p_producto->>'descripcion',
      linea_marca      = nullif(p_producto->>'linea_marca', ''),
      unidad_medida    = p_producto->>'unidad_medida',
      unidad_medida_id = nullif(p_producto->>'unidad_medida_id', '')::uuid,
      precio           = coalesce((p_producto->>'precio')::numeric, 0),
      stock_minimo     = coalesce((p_producto->>'stock_minimo')::integer, 0),
      imagen_url       = nullif(p_producto->>'imagen_url', '')
    where id = p_id;
    if not found then
      raise exception 'El producto no existe';
    end if;
    v_id := p_id;
  end if;

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
--   where table_name='productos' and column_name='unidad_medida_id';  -- 1 fila
--   select count(*) from public.unidades_medida;  -- 0 (se crea vacía)
-- ============================================================
