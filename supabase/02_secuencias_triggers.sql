-- ============================================================
-- SISREP — 02: Secuencias y triggers
-- Ejecutar despues de 01_tablas.sql
-- ============================================================

-- ---------- Numeracion correlativa (atomica, sin duplicados) ----------
create sequence public.proformas_numero_seq start 1;
create sequence public.ventas_numero_seq start 1;

grant usage, select on sequence public.proformas_numero_seq to authenticated;
grant usage, select on sequence public.ventas_numero_seq to authenticated;

create or replace function public.fn_asignar_numero_proforma()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.numero is null or new.numero = '' then
    new.numero := 'PRO-' || lpad(nextval('public.proformas_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_proformas_numero
  before insert on public.proformas
  for each row execute function public.fn_asignar_numero_proforma();

create or replace function public.fn_asignar_numero_venta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.numero is null or new.numero = '' then
    new.numero := 'VEN-' || lpad(nextval('public.ventas_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_ventas_numero
  before insert on public.ventas
  for each row execute function public.fn_asignar_numero_venta();

-- Nota: numero es NOT NULL, pero el insert puede omitirlo porque el
-- trigger BEFORE INSERT lo asigna antes de validar la restriccion.

-- ---------- Stock cacheado en productos ----------
-- Cada movimiento de kardex ajusta productos.stock_actual.
-- El kardex sigue siendo la fuente de verdad; esto es solo cache de lectura.
create or replace function public.fn_kardex_aplica_stock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.productos
  set stock_actual = stock_actual
      + case when new.tipo_movimiento in ('entrada_compra','ajuste_entrada')
             then new.cantidad else -new.cantidad end
  where id = new.producto_id;
  return new;
end;
$$;

create trigger trg_kardex_stock
  after insert on public.kardex_movimientos
  for each row execute function public.fn_kardex_aplica_stock();

-- ---------- Guarda de productos ----------
-- 1) actualiza actualizado_en
-- 2) impide editar stock_actual directo (solo el trigger del kardex puede;
--    en ese caso pg_trigger_depth() > 1)
create or replace function public.fn_productos_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actualizado_en := now();
  if pg_trigger_depth() = 1 then
    new.stock_actual := old.stock_actual;
  end if;
  return new;
end;
$$;

create trigger trg_productos_update
  before update on public.productos
  for each row execute function public.fn_productos_before_update();

-- ---------- actualizado_en generico (configuracion_empresa) ----------
create or replace function public.fn_touch_actualizado_en()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger trg_configuracion_touch
  before update on public.configuracion_empresa
  for each row execute function public.fn_touch_actualizado_en();

-- ---------- Validacion de lineas de proforma ----------
-- proforma_items se inserta directo desde el cliente (no via RPC, ya que
-- una proforma no toca stock). Este trigger recalcula subtotal_linea en el
-- servidor y valida limites de descuento, para que el dato nunca dependa
-- de lo que envie el cliente (mismo criterio que ya aplica fn_registrar_venta
-- a venta_items).
create or replace function public.fn_proforma_items_validar()
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

create trigger trg_proforma_items_validar
  before insert or update on public.proforma_items
  for each row execute function public.fn_proforma_items_validar();

-- ---------- Alta automatica de perfil al crear usuario en Auth ----------
-- Al invitar/crear un usuario, se crea su perfil. El rol puede venir en
-- user_metadata ({"rol":"admin"}); si no viene, queda como vendedor.
create or replace function public.fn_crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre_completo, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre_completo', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'vendedor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_crear_perfil_nuevo_usuario();
