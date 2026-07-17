-- ============================================================
-- SISREP — 11: Datos de factura del cliente (C1)
-- Ejecutar en el SQL Editor sobre una base que ya corrio 00 (o 01-10).
-- Agrega los campos que se autocompletan al buscar el cliente por
-- codigo/NIT en proforma y venta. Idempotente: se puede correr una vez.
-- ============================================================

alter table public.clientes
  add column if not exists nombre_factura text,
  add column if not exists complemento    text;

-- Indice para acelerar la busqueda por codigo/NIT (ci_nit) del cliente.
create index if not exists idx_clientes_ci_nit on public.clientes (ci_nit);
