-- ============================================================
-- SISREP — 25: Búsqueda por código original y por medida (Sprint 6 · Parte I · Fase 4)
-- Ejecutar en el SQL Editor DESPUÉS del 22, 23, 24 y 26.
--
-- ⚠️ Se construye SOBRE LA VERSIÓN VIVA de fn_buscar_productos (la del script 26,
-- con `unaccent`, cross-field, ILIKE por token). Los scripts 25 y 26 reescriben
-- la MISMA función: este 25 incluye TODO lo del 26 (unaccent) + los criterios
-- nuevos. Correrlo pisa la del 26 conservando su comportamiento.
--
-- QUÉ SUMA:
--  · Criterios nuevos `'original'` (producto_codigos_originales) y `'medida'`
--    (producto_medidas), con la misma lógica cross-field + unaccent.
--  · R9: `'original'` y `'medida'` entran también en el arreglo por defecto (si no,
--    la búsqueda "en todos los campos" nunca los miraría).
--  · R11: los criterios de tablas hijas pasan de LEFT JOIN + DISTINCT a EXISTS
--    (sin multiplicación de filas ni DISTINCT — más rápido a medida que crece el
--    catálogo). codigo/descripcion/linea_marca van directos sobre productos.
--  · Medida: se compara contra `etiqueta || ' ' || valor || unidad` y se normaliza
--    la coma decimal del usuario (`45,40` → `45.40`).
--
-- Idempotente (create or replace, misma firma). Requiere 22–24 y 26.
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
  v_campos text[];
  v_tokens text[];
begin
  if p_query is null or btrim(p_query) = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- R9: los criterios nuevos entran en el arreglo por defecto (búsqueda "en todos")
  v_campos := coalesce(
    nullif(p_campos, '{}'::text[]),
    array['codigo', 'descripcion', 'equivalente', 'original', 'linea_marca', 'vehiculo', 'medida']
  );

  v_tokens := array(
    select t from unnest(regexp_split_to_array(btrim(p_query), '[\s%]+')) t
    where btrim(t) <> ''
  );

  if array_length(v_tokens, 1) is null or array_length(v_tokens, 1) = 0 then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- R11: sin LEFT JOIN ni DISTINCT — las tablas hijas se consultan con EXISTS.
  return query
    select p.*
    from public.productos p
    where p.activo
      and (
        select count(*) = array_length(v_tokens, 1)
        from unnest(v_tokens) tok
        where (
          ('codigo' = any(v_campos)
            and extensions.unaccent(p.codigo) ilike '%' || extensions.unaccent(tok) || '%')
          or ('descripcion' = any(v_campos)
            and extensions.unaccent(p.descripcion) ilike '%' || extensions.unaccent(tok) || '%')
          or ('linea_marca' = any(v_campos)
            and extensions.unaccent(p.linea_marca) ilike '%' || extensions.unaccent(tok) || '%')
          or ('equivalente' = any(v_campos) and exists (
                select 1 from public.producto_codigos_equivalentes e
                where e.producto_id = p.id
                  and extensions.unaccent(e.codigo_equivalente) ilike '%' || extensions.unaccent(tok) || '%'))
          or ('original' = any(v_campos) and exists (
                select 1 from public.producto_codigos_originales o
                where o.producto_id = p.id
                  and extensions.unaccent(o.codigo_original) ilike '%' || extensions.unaccent(tok) || '%'))
          or ('vehiculo' = any(v_campos) and exists (
                select 1 from public.producto_vehiculos_compatibles pvc
                join public.vehiculos v on v.id = pvc.vehiculo_id
                where pvc.producto_id = p.id
                  and (extensions.unaccent(v.marca) ilike '%' || extensions.unaccent(tok) || '%'
                    or extensions.unaccent(v.modelo) ilike '%' || extensions.unaccent(tok) || '%')))
          or ('medida' = any(v_campos) and exists (
                select 1 from public.producto_medidas m
                where m.producto_id = p.id
                  and extensions.unaccent(m.etiqueta || ' ' || m.valor::text || m.unidad)
                      ilike '%' || extensions.unaccent(replace(tok, ',', '.')) || '%'))
        )
      )
    order by p.descripcion;
end;
$$;

revoke execute on function public.fn_buscar_productos(text, text[]) from public, anon;
grant  execute on function public.fn_buscar_productos(text, text[]) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte, DESPUÉS de correr el 22 que carga los 810 originales)
--   -- buscar por un código OEM con el criterio 'original' debe encontrarlo:
--   select codigo from public.fn_buscar_productos('9730025210', array['original']) limit 5;
--   -- buscar una medida (coma o punto) con el criterio 'medida':
--   select codigo from public.fn_buscar_productos('45,40', array['medida']) limit 5;
-- ============================================================
