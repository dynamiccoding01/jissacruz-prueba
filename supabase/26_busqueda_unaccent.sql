-- ============================================================
-- SISREP — 26: Busqueda ignorando acentos (Sprint 6 · Parte II · F1)
-- Ejecutar en el SQL Editor sobre la base real.
--
-- PROBLEMA (medido en la BD real): 147 de 239 productos (61%) tienen acentos en
-- la descripcion. Hoy 'valvula' (sin tilde) devuelve 1 producto; 'válvula'
-- (con tilde) devuelve 112. Un vendedor que teclea sin acentos en el mostrador
-- no encuentra el 61% del catalogo. No es cosmetico: bloquea el uso real del POS.
--
-- ⚠️ IMPORTANTE (ver F1 del documento SPRINT6): la version de fn_buscar_productos
-- que REALMENTE corre en la BD NO es la del script 15_busqueda_anidada.sql
-- (tsvector + ilike all por campo), sino la que vive dentro de
-- 00_setup_completo.sql: ILIKE puro, CROSS-FIELD (cada token puede matchear en
-- cualquier campo; el producto entra si cumple TODOS los tokens), tokens partidos
-- por [\s%]+. ESTE SCRIPT PARTE DE ESA VERSION VIVA, solo le agrega unaccent.
-- Si se partiera del script 15 se revertiria en silencio el comportamiento actual.
--
-- QUE CAMBIA vs. la version viva:
--   Se envuelven AMBOS lados de cada comparacion con extensions.unaccent(...),
--   en TODOS los campos de texto (Q7): codigo, descripcion, linea_marca,
--   equivalente, vehiculo. Nada mas. Se conserva la logica cross-field (Q8b) y
--   NO se recupera el stemming/plurales (Q8): el usuario escribe el singular.
--
-- ⚠️ unaccent hay que CALIFICARLA como extensions.unaccent porque la funcion
--    tiene `set search_path = public` y no veria la extension de otro modo.
-- 📝 unaccent() es STABLE, no IMMUTABLE -> no se puede indexar directo. Con 239
--    productos no importa (ya hoy hace scan); anotar para cuando el catalogo crezca.
--
-- Idempotente: create extension if not exists + create or replace.
-- ============================================================

create extension if not exists unaccent with schema extensions;

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
    array['codigo', 'descripcion', 'equivalente', 'linea_marca', 'vehiculo']
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
    select distinct p.*
    from public.productos p
    left join public.producto_codigos_equivalentes pce on pce.producto_id = p.id
    left join public.producto_vehiculos_compatibles pvc on pvc.producto_id = p.id
    left join public.vehiculos v on v.id = pvc.vehiculo_id
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
          or ('equivalente' = any(v_campos)
            and extensions.unaccent(pce.codigo_equivalente) ilike '%' || extensions.unaccent(tok) || '%')
          or ('vehiculo' = any(v_campos) and (
                extensions.unaccent(v.marca) ilike '%' || extensions.unaccent(tok) || '%'
                or extensions.unaccent(v.modelo) ilike '%' || extensions.unaccent(tok) || '%'
             ))
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
--   -- Antes del fix: 'valvula' devolvia 1; ahora debe devolver ~113.
--   select count(*) from public.fn_buscar_productos('valvula', array['descripcion']);
--   -- Debe coincidir (o casi) con la busqueda con tilde:
--   select count(*) from public.fn_buscar_productos('válvula', array['descripcion']);
--   -- Cross-field + varios tokens sin acento:
--   select codigo, descripcion from public.fn_buscar_productos('valvula descarga', '{}');
-- ============================================================
