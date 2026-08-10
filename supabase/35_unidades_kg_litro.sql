-- ============================================================
-- SISREP — 35: Unidades de medida Kilogramo y Litro (T1)
-- Ejecutar en el SQL Editor sobre la base real (dev y prod). Idempotente.
--
-- T1 (decisión 2026-08-10): los productos en kilos/litros se venden en
-- cantidades ENTERAS. Basta con tener las unidades en el catálogo; NO se toca
-- el modelo de stock/FIFO ni las cantidades (siguen siendo enteras).
-- ============================================================

insert into public.unidades_medida (codigo, nombre, abreviatura)
values
  ('KG', 'Kilogramo', 'kg'),
  ('LT', 'Litro', 'lt')
on conflict (codigo) do nothing;
