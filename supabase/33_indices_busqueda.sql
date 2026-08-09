-- ============================================================
-- SISREP — 33: Índice faltante para la búsqueda (performance)
-- Ejecutar en el SQL Editor sobre la base real (idempotente).
--
-- producto_codigos_originales tenía índice por `codigo_original` pero NO por
-- `producto_id`. La búsqueda enriquecida hace `... where producto_id in (...)`
-- y `fn_buscar_productos` hace `exists (... where o.producto_id = p.id ...)`;
-- sin este índice esas consultas escanean la tabla entera de códigos OEM.
-- Las demás tablas hijas (equivalentes, medidas, precios por mayor, vehículos)
-- ya tienen su índice por producto_id.
-- ============================================================

create index if not exists idx_codigos_originales_producto
  on public.producto_codigos_originales (producto_id);

-- ============================================================
-- Nota para escalar (NO se aplica ahora): con ~240 productos, la búsqueda por
-- texto (ILIKE '%...%' con unaccent) hace un scan que igual resuelve en pocos ms.
-- Si el catálogo crece a miles de productos y la búsqueda "en vivo" se sintiera
-- lenta, la mejora de fondo es un índice GIN de trigramas (pg_trgm) sobre una
-- función IMMUTABLE de unaccent aplicada a codigo/descripcion/linea_marca. Es un
-- cambio mayor (extensión pg_trgm + wrapper immutable + reescribir la comparación
-- de fn_buscar_productos para que use el índice) y conviene medir antes de hacerlo.
-- ============================================================
