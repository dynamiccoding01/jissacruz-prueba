-- ============================================================
-- SISREP — 44: Medidas con solo etiqueta (PLAN_7 · T2)
-- Ejecutar en el SQL Editor sobre AMBAS bases (dev y prod). Idempotente.
-- ⚠️ Escrito sin acceso a la BD: no se pudo ejecutar. Correr primero en
--    desarrollo y verificar con las consultas del final.
-- Requiere el 34 (usa public.f_unaccent).
--
-- QUÉ HACE:
--   En el formulario de productos la medida pasa a ser SOLO la etiqueta: un
--   texto libre (p. ej. "110X140X12/2"). Se quitan el valor numérico y la unidad.
--   1. `producto_medidas.valor` pasa a aceptar NULL (la app nueva ya no lo manda).
--      `fn_guardar_producto` NO se toca: ya inserta NULL cuando el valor no
--      llega, y a `unidad` le pone 'MM' (queda sin uso cuando valor es NULL).
--   2. Reescribe `fn_buscar_productos`, criterio 'medida': busca en el texto de
--      la etiqueta. Las medidas viejas (con valor) se siguen encontrando igual
--      que antes, hasta que el script 45 las pase a texto.
--      Es IDÉNTICA a la versión del script 34 salvo ese criterio.
--
-- CUÁNDO CORRERLO: ANTES de desplegar el código de PLAN_7 · T2. Es compatible
-- con la versión publicada (que sigue mandando valor y unidad). Sin este script,
-- la app nueva no puede guardar un producto que tenga medidas.
--
-- ⚠️ La función que corre en la base tiene que ser la del script 34 (la que usa
--    `public.f_unaccent`). El primer bloque lo comprueba y, si no es así, corta
--    con un mensaje y no cambia nada. Para verla a mano:
--      select prosrc from pg_proc
--      where oid = 'public.fn_buscar_productos(text, text[])'::regprocedure;
-- ============================================================

-- ---------- 0. Comprobación: la base tiene que estar en el script 34 ----------
do $$
declare
  v_src text;
begin
  if to_regprocedure('public.f_unaccent(text)') is null then
    raise exception 'Falta el script 34 (no existe public.f_unaccent). Correr 34_busqueda_trigram.sql antes que este.';
  end if;

  select prosrc into v_src
  from pg_proc
  where oid = to_regprocedure('public.fn_buscar_productos(text, text[])');

  if v_src is null then
    raise exception 'No existe public.fn_buscar_productos(text, text[]).';
  end if;
  if position('f_unaccent' in v_src) = 0 then
    raise exception 'La fn_buscar_productos de esta base no es la del script 34. Correr 34_busqueda_trigram.sql antes que este.';
  end if;
end;
$$;

-- ---------- 1. El valor de la medida deja de ser obligatorio ----------
-- El check (valor > 0) se conserva: no rechaza NULL.
alter table public.producto_medidas alter column valor drop not null;

-- ---------- 2. fn_buscar_productos: el criterio 'medida' busca en la etiqueta ----------
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
          -- PLAN_7 · T2: la medida es el texto de la etiqueta. Se compara tal
          -- como se escribe y también con el punto cambiado por coma, para que
          -- "45.40" siga encontrando una medida guardada como "45,40".
          or ('medida' = any(v_campos) and exists (
                select 1 from public.producto_medidas m
                where m.producto_id = p.id
                  and (public.f_unaccent(m.etiqueta) ilike '%' || public.f_unaccent(tok) || '%'
                    or public.f_unaccent(m.etiqueta) ilike '%' || public.f_unaccent(replace(tok, '.', ',')) || '%'
                    -- medidas viejas, todavía con valor y unidad (hasta el script 45)
                    or (m.valor is not null
                        and public.f_unaccent(m.etiqueta || ' ' || m.valor::text || coalesce(m.unidad, ''))
                            ilike '%' || public.f_unaccent(replace(tok, ',', '.')) || '%'))))
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
--   -- a) el valor ya no es obligatorio (debe dar YES):
--   select is_nullable from information_schema.columns
--   where table_schema = 'public' and table_name = 'producto_medidas' and column_name = 'valor';
--   -- b) la búsqueda sigue encontrando lo mismo que antes:
--   select count(*) from public.fn_buscar_productos('valvula', array['descripcion']);
--   -- c) una medida existente se sigue encontrando por el criterio 'medida'
--   --    (reemplazar por una etiqueta o un valor que exista):
--   select codigo from public.fn_buscar_productos('45,40', array['medida']);
-- ============================================================
