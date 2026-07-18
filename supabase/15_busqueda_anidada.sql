-- ============================================================
-- SISREP — 15: Busqueda ANIDADA de productos por fragmentos (C1.1)
-- Ejecutar en el SQL Editor sobre una base que ya corrio 00 (o 01-10).
-- Idempotente: reemplaza el cuerpo de fn_buscar_productos(texto, campos[]).
-- La firma NO cambia, asi que la app (catalogo, compras, POS, proformas)
-- sigue llamando igual y hereda la mejora sin tocar cliente.
--
-- QUE CAMBIA vs. 10_busqueda_por_criterio.sql:
--   Antes, para codigo/linea_marca/equivalente/vehiculo se hacia UN solo
--   `ilike '%' || p_query || '%'` sobre TODA la cadena: al escribir dos
--   trozos separados por espacio ("piston comp") buscaba literalmente
--   '%piston comp%' y no encontraba "PISTON COMPRESOR".
--   Ahora la consulta se parte en fragmentos por espacio y el campo debe
--   cumplir TODOS (ilike all) -> "piston comp 85" resuelve
--   "PISTON COMPRESOR 85MM" aunque se escriban trozos parciales.
--   Se conserva `%` como comodin intencional para replicar el patron
--   "Piston%comp%85" del sistema del cliente.
--   descripcion mantiene ADEMAS su tsquery historico (stemming es/plurales),
--   asi que nada de lo que antes hacia match deja de hacerlo.
-- ============================================================

create or replace function public.fn_buscar_productos(
  p_query  text,
  p_campos text[] default null
)
returns setof public.productos
language plpgsql
stable
set search_path = public
as $$
declare
  v_clean    text;
  v_tsq      tsquery;
  v_campos   text[];
  v_patterns text[];
begin
  if p_query is null or btrim(p_query) = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- null o arreglo vacio => todos los criterios
  v_campos := coalesce(
    nullif(p_campos, '{}'::text[]),
    array['codigo', 'descripcion', 'equivalente', 'linea_marca', 'vehiculo']
  );

  -- saca caracteres que romperian el tsquery; CONSERVA % (comodin del usuario)
  v_clean := regexp_replace(p_query, '[&|!():*'']', ' ', 'g');
  v_clean := btrim(regexp_replace(v_clean, '\s+', ' ', 'g'));

  if v_clean = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- tsquery por prefijo: comportamiento historico de descripcion
  -- "fren del" -> "fren:* & del:*"
  v_tsq := to_tsquery('spanish', regexp_replace(v_clean, '\s+', ':* & ', 'g') || ':*');

  -- BUSQUEDA ANIDADA (C1.1): un patron ilike '%frag%' por cada fragmento.
  -- Se escapan \ y _ (para que un _ del texto no actue como comodin de ilike);
  -- se DEJA % como comodin intencional (patron "Piston%comp%85" del cliente).
  select array_agg('%' || replace(replace(frag, '\', '\\'), '_', '\_') || '%')
    into v_patterns
  from unnest(string_to_array(v_clean, ' ')) as frag
  where frag <> '';

  return query
    select distinct p.*
    from public.productos p
    left join public.producto_codigos_equivalentes pce on pce.producto_id = p.id
    left join public.producto_vehiculos_compatibles pvc on pvc.producto_id = p.id
    left join public.vehiculos v on v.id = pvc.vehiculo_id
    where p.activo
      and (
        ('codigo'      = any(v_campos) and p.codigo ilike all(v_patterns))
        or ('descripcion' = any(v_campos) and (
              to_tsvector('spanish', p.descripcion) @@ v_tsq
              or p.descripcion ilike all(v_patterns)
           ))
        or ('linea_marca' = any(v_campos) and p.linea_marca ilike all(v_patterns))
        or ('equivalente' = any(v_campos) and pce.codigo_equivalente ilike all(v_patterns))
        or ('vehiculo'    = any(v_campos) and (
              v.marca ilike all(v_patterns)
              or v.modelo ilike all(v_patterns)
              or (coalesce(v.marca, '') || ' ' || coalesce(v.modelo, '')) ilike all(v_patterns)
           ))
      )
    order by p.descripcion;
end;
$$;

revoke execute on function public.fn_buscar_productos(text, text[]) from public, anon;
grant  execute on function public.fn_buscar_productos(text, text[]) to authenticated;
