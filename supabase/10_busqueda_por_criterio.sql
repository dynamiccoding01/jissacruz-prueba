-- ============================================================
-- SISREP — 10: Busqueda de productos POR CRITERIO seleccionable
-- Ejecutar en el SQL Editor sobre una base que ya corrio 00 (o 01-09).
-- Reemplaza la firma de fn_buscar_productos: ahora recibe ademas
-- p_campos (los criterios que el usuario marca en la UI).
-- OBLIGATORIO: la app llama a la funcion con 2 argumentos, asi que
-- este script debe correrse para que la busqueda siga funcionando.
-- ============================================================

-- Quitamos la firma vieja de 1 argumento para evitar ambiguedad de
-- sobrecarga (Postgres/PostgREST no sabria cual elegir si conviven las dos).
drop function if exists public.fn_buscar_productos(text);

-- p_campos: subconjunto de
--   'codigo' | 'descripcion' | 'equivalente' | 'linea_marca' | 'vehiculo'
-- Busca solo en los campos marcados (OR entre ellos). Si viene null o vacio,
-- busca en todos (comportamiento equivalente al historico).
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
  v_clean  text;
  v_tsq    tsquery;
  v_campos text[];
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
        ('codigo'      = any(v_campos) and p.codigo ilike '%' || p_query || '%')
        or ('descripcion' = any(v_campos) and to_tsvector('spanish', p.descripcion) @@ v_tsq)
        or ('linea_marca' = any(v_campos) and p.linea_marca ilike '%' || p_query || '%')
        or ('equivalente' = any(v_campos) and pce.codigo_equivalente ilike '%' || p_query || '%')
        or ('vehiculo'    = any(v_campos) and (
              v.marca ilike '%' || p_query || '%'
              or v.modelo ilike '%' || p_query || '%'
           ))
      )
    order by p.descripcion;
end;
$$;

revoke execute on function public.fn_buscar_productos(text, text[]) from public, anon;
grant  execute on function public.fn_buscar_productos(text, text[]) to authenticated;
