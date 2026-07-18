-- ============================================================
-- SISREP — 17: Tiempo de entrega en la proforma (P10)
-- Ejecutar en el SQL Editor sobre una base que ya corrio 00 (o 01-16).
--
-- El modelo de proforma del cliente lleva la leyenda
-- "Tiempo de entrega: N dia(s)". Se agrega el campo a la proforma
-- (formulario + PDF). Nullable: las proformas viejas y las que no
-- indiquen tiempo de entrega simplemente no muestran la leyenda.
--
-- Idempotente.
-- ============================================================

alter table public.proformas
  add column if not exists tiempo_entrega_dias integer
  check (tiempo_entrega_dias is null or tiempo_entrega_dias >= 0);

-- ============================================================
-- VERIFICACION (correr aparte; no modifica nada)
--
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_name = 'proformas' and column_name = 'tiempo_entrega_dias';
--   -- Esperado: 1 fila (integer, YES)
-- ============================================================
