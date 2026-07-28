-- ============================================================
-- SISREP — 29: Guardado transaccional del producto (Sprint 6 · R8 / Q4)
-- Ejecutar en el SQL Editor sobre la base real.
--
-- PROBLEMA (R8): crear/editar un producto hacía varios INSERT/DELETE por HTTP
-- SIN transacción. Si el guardado de hijos fallaba después de borrar los
-- anteriores, el producto quedaba SIN códigos, SIN vehículos y SIN precios por
-- mayor, de forma permanente. Grave porque un producto puede tener 8–10 códigos
-- OEM que salieron de parsear un catálogo. La mitigación mínima (dedup + chequeo
-- de errores) reducía el disparador; ESTO lo cierra del todo.
--
-- SOLUCIÓN: una sola función SECURITY DEFINER que hace TODO en una transacción
-- (cabecera + reemplazo de hijos). Si algo falla, Postgres revierte todo → nunca
-- queda un producto a medias. Es además lo que manda la regla del proyecto
-- ("toda operación crítica pasa por RPC transaccional").
--
-- p_id NULL  => crea el producto.  p_id con valor => lo edita.
-- Devuelve el id del producto.
--
-- NOTA: maneja el esquema ACTUAL de hijos (equivalentes con `fabricante`,
-- vehículos y precios por mayor). Cuando entre la Parte I (códigos originales,
-- medidas, y se elimine `fabricante`), hay que EXTENDER esta función.
--
-- Idempotente (create or replace). notify pgrst al final.
-- ============================================================

create or replace function public.fn_guardar_producto(
  p_id            uuid,
  p_producto      jsonb,
  p_equivalentes  jsonb default '[]'::jsonb,
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

  -- ---------- Cabecera (crear o editar) ----------
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
      -- OJO: NO se toca stock_actual (lo protege el trigger fn_productos_before_update)
    where id = p_id;
    if not found then
      raise exception 'El producto no existe';
    end if;
    v_id := p_id;
  end if;

  -- ---------- Reemplazo de hijos (todo en la misma transacción) ----------
  delete from public.producto_codigos_equivalentes where producto_id = v_id;
  delete from public.producto_vehiculos_compatibles where producto_id = v_id;
  delete from public.producto_precios_mayor where producto_id = v_id;

  -- Códigos equivalentes
  for v_item in select value from jsonb_array_elements(coalesce(p_equivalentes, '[]'::jsonb)) loop
    insert into public.producto_codigos_equivalentes (producto_id, codigo_equivalente, fabricante)
    values (v_id, v_item->>'codigo_equivalente', nullif(v_item->>'fabricante', ''));
  end loop;

  -- Vehículos compatibles (upsert del catálogo + relación)
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
revoke execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) la función existe con la firma esperada:
--   select proname, pg_get_function_identity_arguments(oid)
--   from pg_proc where proname = 'fn_guardar_producto';
--   -- b) atomicidad: crear un producto con un código equivalente repetido debe
--   --    FALLAR entero (no crear el producto ni los hijos) — pero la app ya
--   --    deduplica antes, así que en la práctica no llega repetido.
-- ============================================================
