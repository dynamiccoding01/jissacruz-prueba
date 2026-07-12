-- ============================================================
-- SISREP — 09: Busqueda avanzada de productos (Fase 3)
-- Ejecutar en el SQL Editor sobre una base que ya tiene 00 (o 01-05).
-- ============================================================

-- Busca por: codigo, descripcion (texto completo, prefijo por palabra),
-- linea/marca, codigo equivalente, marca/modelo de vehiculo compatible.
-- Devuelve una fila por producto (sin duplicar por cada match de codigo/vehiculo).
create or replace function public.fn_buscar_productos(p_query text)
returns setof public.productos
language plpgsql
stable
set search_path = public
as $$
declare
  v_clean text;
  v_tsq   tsquery;
begin
  if p_query is null or btrim(p_query) = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- saca caracteres especiales de tsquery para que el texto del usuario
  -- nunca rompa el parseo (ej. "frenos & (delantero)")
  v_clean := regexp_replace(p_query, '[&|!():*'']', ' ', 'g');
  v_clean := btrim(regexp_replace(v_clean, '\s+', ' ', 'g'));

  if v_clean = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- prefijo por cada palabra: "fren del" -> "fren:* & del:*"
  v_tsq := to_tsquery('spanish', regexp_replace(v_clean, '\s+', ':* & ', 'g') || ':*');

  return query
    select distinct p.*
    from public.productos p
    left join public.producto_codigos_equivalentes pce on pce.producto_id = p.id
    left join public.producto_vehiculos_compatibles pvc on pvc.producto_id = p.id
    left join public.vehiculos v on v.id = pvc.vehiculo_id
    where p.activo
      and (
        p.codigo ilike '%' || p_query || '%'
        or to_tsvector('spanish', p.descripcion) @@ v_tsq
        or p.linea_marca ilike '%' || p_query || '%'
        or pce.codigo_equivalente ilike '%' || p_query || '%'
        or v.marca ilike '%' || p_query || '%'
        or v.modelo ilike '%' || p_query || '%'
      )
    order by p.descripcion;
end;
$$;

revoke execute on function public.fn_buscar_productos(text) from public, anon;
grant execute on function public.fn_buscar_productos(text) to authenticated;
