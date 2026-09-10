-- ============================================================
-- SISREP — 39: Cotizaciones persistidas (PLAN_4 · T5/T6/T7)
-- Ejecutar en el SQL Editor sobre AMBAS bases (dev y prod).
--
-- QUE HACE:
--   La "Cotización S/F" deja de ser efímera: se guarda con historial, como una
--   Proforma pero para productos SIN factura. Espeja proformas/proforma_items:
--     - cliente OPCIONAL (una cotización puede ir SIN NOMBRE)
--     - numeración correlativa COT-0001 (secuencia + trigger BEFORE INSERT)
--     - trigger de validación de línea (recalcula subtotal_linea) — NO usa RPC
--       porque una cotización no toca stock (misma red que fn_proforma_items_validar)
--     - glosa, plazo de validez y tiempo de entrega (para el PDF)
--     - SIN ciclo de estados: es referencial (se guarda, se lista, se imprime)
--   RLS: mismo criterio que proformas tras el script 30 — admin ve todo; el resto
--   ve las cotizaciones de su sucursal.
-- Idempotente.
-- ============================================================

-- ---------- 1. Secuencia + numeración COT-0001 ----------
create sequence if not exists public.cotizaciones_numero_seq start 1;
grant usage, select on sequence public.cotizaciones_numero_seq to authenticated;

create or replace function public.fn_asignar_numero_cotizacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.numero is null or new.numero = '' then
    new.numero := 'COT-' || lpad(nextval('public.cotizaciones_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

-- ---------- 2. Tablas ----------
create table if not exists public.cotizaciones (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,        -- asignado por trigger (COT-0001)
  cliente_id          uuid references public.clientes(id),   -- OPCIONAL (SIN NOMBRE)
  tipo_pago           text,
  plazo_validez_dias  integer not null default 3,
  tiempo_entrega_dias integer check (tiempo_entrega_dias is null or tiempo_entrega_dias >= 0),
  glosa               text,
  subtotal            numeric(12,2) not null default 0,
  descuento_tipo      text check (descuento_tipo in ('porcentaje','monto_fijo')),
  descuento_valor     numeric(12,2) not null default 0,
  impuesto_porcentaje numeric(5,2) not null default 0,
  total               numeric(12,2) not null default 0,
  sucursal_id         uuid references public.sucursales(id),
  creado_por          uuid references public.perfiles(id),
  creado_en           timestamptz not null default now()
);

create table if not exists public.cotizacion_items (
  id              uuid primary key default gen_random_uuid(),
  cotizacion_id   uuid not null references public.cotizaciones(id) on delete cascade,
  producto_id     uuid not null references public.productos(id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null,
  descuento_tipo  text check (descuento_tipo in ('porcentaje','monto_fijo')),
  descuento_valor numeric(12,2) not null default 0,
  subtotal_linea  numeric(12,2) not null
);

create index if not exists idx_cotizaciones_creado_en      on public.cotizaciones (creado_en);
create index if not exists idx_cotizaciones_sucursal       on public.cotizaciones (sucursal_id);
create index if not exists idx_cotizacion_items_cotizacion on public.cotizacion_items (cotizacion_id);

-- Trigger de numeración (se crea después de la tabla).
drop trigger if exists trg_cotizaciones_numero on public.cotizaciones;
create trigger trg_cotizaciones_numero
  before insert on public.cotizaciones
  for each row execute function public.fn_asignar_numero_cotizacion();

-- ---------- 3. Validación de línea (misma regla que proforma_items) ----------
create or replace function public.fn_cotizacion_items_validar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_subtotal numeric;
begin
  if new.cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;
  if new.precio_unitario < 0 then
    raise exception 'El precio unitario no puede ser negativo';
  end if;
  if new.descuento_valor < 0 then
    raise exception 'El descuento no puede ser negativo';
  end if;
  if new.descuento_tipo = 'porcentaje' and new.descuento_valor > 100 then
    raise exception 'El descuento porcentual no puede superar 100%%';
  end if;

  v_subtotal := new.cantidad * new.precio_unitario - case new.descuento_tipo
    when 'porcentaje' then round(new.cantidad * new.precio_unitario * new.descuento_valor / 100, 2)
    when 'monto_fijo' then new.descuento_valor
    else 0
  end;

  if v_subtotal < 0 then
    raise exception 'El descuento supera el importe de la linea';
  end if;

  new.subtotal_linea := round(v_subtotal, 2);
  return new;
end;
$$;

drop trigger if exists trg_cotizacion_items_validar on public.cotizacion_items;
create trigger trg_cotizacion_items_validar
  before insert or update on public.cotizacion_items
  for each row execute function public.fn_cotizacion_items_validar();

-- ---------- 4. RLS ----------
alter table public.cotizaciones     enable row level security;
alter table public.cotizacion_items enable row level security;

-- Cabecera: admin ve todo; el resto ve las de su sucursal (como proformas tras el 30).
drop policy if exists "cotizaciones_select_por_sucursal" on public.cotizaciones;
create policy "cotizaciones_select_por_sucursal" on public.cotizaciones
  for select to authenticated
  using (public.fn_es_admin() or sucursal_id = public.fn_mi_sucursal());

drop policy if exists "cotizaciones_insert_autenticados" on public.cotizaciones;
create policy "cotizaciones_insert_autenticados" on public.cotizaciones
  for insert to authenticated
  with check (creado_por = auth.uid());

drop policy if exists "cotizaciones_delete_solo_admin" on public.cotizaciones;
create policy "cotizaciones_delete_solo_admin" on public.cotizaciones
  for delete to authenticated using (public.fn_es_admin());

-- Ítems: select por la sucursal de la cabecera; insert si existe la cabecera; delete admin.
drop policy if exists "cot_items_select_por_sucursal" on public.cotizacion_items;
create policy "cot_items_select_por_sucursal" on public.cotizacion_items
  for select to authenticated
  using (
    public.fn_es_admin()
    or exists (
      select 1 from public.cotizaciones c
      where c.id = cotizacion_id and c.sucursal_id = public.fn_mi_sucursal()
    )
  );

drop policy if exists "cot_items_insert_autenticados" on public.cotizacion_items;
create policy "cot_items_insert_autenticados" on public.cotizacion_items
  for insert to authenticated
  with check (exists (select 1 from public.cotizaciones c where c.id = cotizacion_id));

drop policy if exists "cot_items_delete_solo_admin" on public.cotizacion_items;
create policy "cot_items_delete_solo_admin" on public.cotizacion_items
  for delete to authenticated using (public.fn_es_admin());

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) las tablas existen:
--   select table_name from information_schema.tables
--   where table_name in ('cotizaciones','cotizacion_items');   -- 2 filas
--
--   -- b) el correlativo funciona (crear una cotización desde la app y luego):
--   select numero, cliente_id, total, creado_en from public.cotizaciones order by creado_en desc;
-- ============================================================
