-- ============================================================
-- SISREP — 45: Medidas viejas a texto (PLAN_7 · T2)
-- Ejecutar en el SQL Editor sobre AMBAS bases (dev y prod). Idempotente.
-- ⚠️ Escrito sin acceso a la BD: no se pudo ejecutar. Correr primero en
--    desarrollo y verificar con las consultas del final.
-- Requiere el 44.
--
-- QUÉ HACE:
--   Las medidas cargadas antes de PLAN_7 · T2 tienen etiqueta + valor + unidad
--   (p. ej. A / 45.40 / MM). Este script las pasa a un solo texto en la
--   etiqueta ("A: 45,40MM") y deja `valor` en NULL. No se pierde ninguna.
--   Es el mismo texto que la app ya muestra para esas medidas.
--
-- CUÁNDO CORRERLO: DESPUÉS de desplegar el código de PLAN_7 · T2. La versión
-- anterior de la app mostraría mal las medidas ya convertidas.
-- No es urgente: la app nueva muestra bien las medidas con o sin este script.
--
-- Antes de correrlo, para saber cuántas va a convertir:
--   select count(*) from public.producto_medidas where valor is not null;
-- ============================================================

-- ---------- 0. Comprobación: tiene que haber corrido el 44 ----------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'producto_medidas'
      and column_name = 'valor' and is_nullable = 'NO'
  ) then
    raise exception 'Falta el script 44 (producto_medidas.valor todavía es obligatorio). Correr 44_medidas_solo_etiqueta.sql antes que este.';
  end if;
end;
$$;

-- ---------- 1. Conversión ----------
-- Solo toca las filas que todavía tienen valor: correrlo dos veces no cambia nada.
update public.producto_medidas
set etiqueta = etiqueta || ': '
               || replace(to_char(valor, 'FM999999999990.00'), '.', ',')
               || coalesce(unidad, ''),
    valor = null
where valor is not null;

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) no queda ninguna medida con valor (debe dar 0):
--   select count(*) from public.producto_medidas where valor is not null;
--   -- b) cómo quedaron:
--   select etiqueta from public.producto_medidas order by etiqueta limit 20;
-- ============================================================
