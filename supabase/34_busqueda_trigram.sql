-- ============================================================
-- SISREP — 34: Búsqueda acelerada con índices de trigramas (pg_trgm)
-- Ejecutar en el SQL Editor sobre la base real. Requiere el 26 (unaccent) y el 25.
--
-- QUÉ HACE: hace que la búsqueda por texto (`ILIKE '%...%'`) use un ÍNDICE en vez
-- de escanear la tabla, así se mantiene rápida aunque el catálogo crezca a miles.
--   1. Instala pg_trgm.
--   2. Crea `public.f_unaccent`: un unaccent IMMUTABLE (misma salida que
--      extensions.unaccent, pero marcado immutable para poder INDEXARLO).
--   3. Crea índices GIN de trigramas sobre f_unaccent(campo) en los campos que se
--      buscan (código, descripción, línea/marca, equivalente, original).
--   4. Reescribe fn_buscar_productos usando f_unaccent (RESULTADOS IDÉNTICOS a la
--      versión del 25 — solo cambia que ahora puede usar el índice).
--
-- SEGURO: corre como transacción. Si algo falla (p. ej. el esquema de un opclass
-- difiere en tu instancia), revierte TODO y la búsqueda sigue como estaba (25).
-- Como f_unaccent devuelve lo mismo que unaccent, aunque el índice no llegara a
-- usarse, la búsqueda igual funciona bien (solo que sin la aceleración).
--
-- ⚠️ No se pudo ejecutar en esta sesión (sin acceso a la BD): correlo y verificá
--    con un par de búsquedas (abajo). Si diera error en la creación de índices por
--    el esquema del opclass, avisá y ajusto la calificación de esquema.
--
-- Idempotente.
-- ============================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------- 1. unaccent INMUTABLE (indexable) ----------
-- La forma de 2 argumentos (con el diccionario fijo) permite marcarla IMMUTABLE.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

-- ---------- 2. Índices GIN de trigramas ----------
create index if not exists idx_productos_codigo_trgm
  on public.productos using gin (public.f_unaccent(codigo) extensions.gin_trgm_ops);
create index if not exists idx_productos_descripcion_trgm
  on public.productos using gin (public.f_unaccent(descripcion) extensions.gin_trgm_ops);
create index if not exists idx_productos_linea_trgm
  on public.productos using gin (public.f_unaccent(linea_marca) extensions.gin_trgm_ops);
create index if not exists idx_equivalentes_codigo_trgm
  on public.producto_codigos_equivalentes using gin (public.f_unaccent(codigo_equivalente) extensions.gin_trgm_ops);
create index if not exists idx_originales_codigo_trgm
  on public.producto_codigos_originales using gin (public.f_unaccent(codigo_original) extensions.gin_trgm_ops);

-- ---------- 3. fn_buscar_productos con f_unaccent (mismos resultados) ----------
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

  return query
    select p.*
    from public.productos p
    where p.activo
      and (
        select count(*) = array_length(v_tokens, 1)
        from unnest(v_tokens) tok
        where (
          ('codigo' = any(v_campos)
            and public.f_unaccent(p.codigo) ilike '%' || public.f_unaccent(tok) || '%')
          or ('descripcion' = any(v_campos)
            and public.f_unaccent(p.descripcion) ilike '%' || public.f_unaccent(tok) || '%')
          or ('linea_marca' = any(v_campos)
            and public.f_unaccent(p.linea_marca) ilike '%' || public.f_unaccent(tok) || '%')
          or ('equivalente' = any(v_campos) and exists (
                select 1 from public.producto_codigos_equivalentes e
                where e.producto_id = p.id
                  and public.f_unaccent(e.codigo_equivalente) ilike '%' || public.f_unaccent(tok) || '%'))
          or ('original' = any(v_campos) and exists (
                select 1 from public.producto_codigos_originales o
                where o.producto_id = p.id
                  and public.f_unaccent(o.codigo_original) ilike '%' || public.f_unaccent(tok) || '%'))
          or ('vehiculo' = any(v_campos) and exists (
                select 1 from public.producto_vehiculos_compatibles pvc
                join public.vehiculos v on v.id = pvc.vehiculo_id
                where pvc.producto_id = p.id
                  and (public.f_unaccent(v.marca) ilike '%' || public.f_unaccent(tok) || '%'
                    or public.f_unaccent(v.modelo) ilike '%' || public.f_unaccent(tok) || '%')))
          or ('medida' = any(v_campos) and exists (
                select 1 from public.producto_medidas m
                where m.producto_id = p.id
                  and public.f_unaccent(m.etiqueta || ' ' || m.valor::text || m.unidad)
                      ilike '%' || public.f_unaccent(replace(tok, ',', '.')) || '%'))
        )
      )
    order by p.descripcion;
end;
$$;

revoke execute on function public.fn_buscar_productos(text, text[]) from public, anon;
grant  execute on function public.fn_buscar_productos(text, text[]) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- 1) sigue encontrando lo mismo (sin acentos):
--   select count(*) from public.fn_buscar_productos('valvula', array['descripcion']);  -- ~113
--   -- 2) el plan usa el índice de trigramas (buscar "Bitmap Index Scan ... _trgm"):
--   explain analyze select * from public.fn_buscar_productos('valvula', array['descripcion']);
-- ============================================================
