-- ============================================================================
-- SISREP — SETUP COMPLETO DE PRODUCCIÓN (base de datos desde cero)
-- ----------------------------------------------------------------------------
-- Reproduce EXACTAMENTE el estado actual de la base (scripts 01–33) en un
-- proyecto Supabase NUEVO y VACÍO, en una sola corrida.
--
-- Es la concatenación de los scripts reales que construyeron producción, en el
-- ORDEN DE DEPENDENCIA correcto (no numérico): p. ej. 29 va antes que 22, y 26
-- antes que 25. Las partes de "migración/backfill" quedan como no-ops sobre una
-- base vacía.
--
-- CÓMO USARLO:
--   1. Crear el proyecto Supabase de producción (vacío).
--   2. Pegar TODO este archivo en el SQL Editor y ejecutarlo una sola vez.
--   3. Crear el primer usuario admin desde Supabase Auth con
--      user_metadata: { "rol": "admin" }  (el trigger crea el perfil + sucursal).
--   4. Los DATOS (productos, precios, etc.) se cargan aparte.
--
-- Generado por concatenación de los scripts del repo. Si algún script cambia,
-- regenerar este archivo.
-- ============================================================================


-- ============================================================================
-- >>> 01_tablas.sql
-- ============================================================================
-- ============================================================
-- SISREP — 01: Tablas
-- Ejecutar PRIMERO en el SQL Editor de Supabase.
-- Fuente: BACKEND.md seccion 2 (+ decisiones aprobadas:
--   stock_actual cacheado, configuracion_empresa, sin tabla lineas)
-- ============================================================

-- ---------- Usuarios internos (extiende auth.users) ----------
create table public.perfiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol             text not null check (rol in ('admin','vendedor')),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now()
);

-- ---------- Configuracion de la empresa (fila unica, usada en PDFs) ----------
create table public.configuracion_empresa (
  id                   smallint primary key default 1 check (id = 1),
  nombre               text not null default 'JISSACRUZ',
  nit                  text,
  direccion            text,
  telefono             text,
  logo_url             text,
  stock_minimo_default integer not null default 0,
  actualizado_en       timestamptz not null default now()
);

insert into public.configuracion_empresa (id) values (1);

-- ---------- Catalogo ----------
create table public.productos (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique,
  descripcion    text not null,
  linea_marca    text,
  unidad_medida  text not null default 'unidad',
  precio         numeric(12,2) not null default 0,
  imagen_url     text,
  stock_minimo   integer not null default 0,
  -- cache mantenido por trigger desde kardex_movimientos; nunca editar directo
  stock_actual   integer not null default 0,
  activo         boolean not null default true,
  creado_por     uuid references public.perfiles(id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.producto_codigos_equivalentes (
  id                 uuid primary key default gen_random_uuid(),
  producto_id        uuid not null references public.productos(id) on delete cascade,
  codigo_equivalente text not null,
  fabricante         text
);

-- Catalogo de vehiculos (marca+modelo): evita texto libre repetido/inconsistente
-- en cada compatibilidad producto-vehiculo.
create table public.vehiculos (
  id     uuid primary key default gen_random_uuid(),
  marca  text not null,
  modelo text not null,
  unique (marca, modelo)
);

create table public.producto_vehiculos_compatibles (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  vehiculo_id uuid not null references public.vehiculos(id),
  -- rango de anios en el que aplica ESTA compatibilidad especifica
  -- (el mismo vehiculo puede compatibilizar distinto rango con otro producto)
  anio_desde  integer,
  anio_hasta  integer
);

-- ---------- Compras ----------
create table public.proveedores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  contacto  text,
  nit       text,
  direccion text,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.ordenes_compra (
  id              uuid primary key default gen_random_uuid(),
  proveedor_id    uuid not null references public.proveedores(id),
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente','recibida','cancelada')),
  fecha_orden     timestamptz not null default now(),
  fecha_recepcion timestamptz,
  creado_por      uuid references public.perfiles(id),
  notas           text
);

create table public.orden_compra_items (
  id              uuid primary key default gen_random_uuid(),
  orden_compra_id uuid not null references public.ordenes_compra(id) on delete cascade,
  producto_id     uuid not null references public.productos(id),
  cantidad        integer not null check (cantidad > 0),
  costo_unitario  numeric(12,2) not null check (costo_unitario >= 0)
);

-- ---------- Clientes ----------
create table public.clientes (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  ci_nit    text,
  telefono  text,
  direccion text,
  creado_en timestamptz not null default now()
);

-- ---------- Comercial ----------
-- proformas se crea SIN venta_id; el FK se agrega con ALTER despues de crear
-- ventas (referencia circular proformas <-> ventas)
create table public.proformas (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,  -- asignado por trigger (PRO-0001)
  cliente_id          uuid not null references public.clientes(id),
  tipo_pago           text,
  plazo_validez_dias  integer not null default 15,
  glosa               text,
  subtotal            numeric(12,2) not null default 0,
  descuento_tipo      text check (descuento_tipo in ('porcentaje','monto_fijo')),
  descuento_valor     numeric(12,2) not null default 0,
  impuesto_porcentaje numeric(5,2) not null default 0,
  total               numeric(12,2) not null default 0,
  estado              text not null default 'vigente'
                      check (estado in ('vigente','convertida','vencida')),
  creado_por          uuid references public.perfiles(id),
  creado_en           timestamptz not null default now()
);

create table public.proforma_items (
  id              uuid primary key default gen_random_uuid(),
  proforma_id     uuid not null references public.proformas(id) on delete cascade,
  producto_id     uuid not null references public.productos(id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null,
  descuento_tipo  text check (descuento_tipo in ('porcentaje','monto_fijo')),
  descuento_valor numeric(12,2) not null default 0,
  subtotal_linea  numeric(12,2) not null
);

create table public.ventas (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,  -- asignado por trigger (VEN-0001)
  cliente_id          uuid references public.clientes(id),  -- venta sin cliente permitida
  proforma_origen_id  uuid references public.proformas(id),
  subtotal            numeric(12,2) not null default 0,
  descuento_tipo      text check (descuento_tipo in ('porcentaje','monto_fijo')),
  descuento_valor     numeric(12,2) not null default 0,
  impuesto_porcentaje numeric(5,2) not null default 0,
  total               numeric(12,2) not null default 0,
  vendido_por         uuid references public.perfiles(id),
  creado_en           timestamptz not null default now()
);

create table public.venta_items (
  id                  uuid primary key default gen_random_uuid(),
  venta_id            uuid not null references public.ventas(id) on delete cascade,
  producto_id         uuid not null references public.productos(id),
  cantidad            integer not null check (cantidad > 0),
  precio_unitario     numeric(12,2) not null,
  descuento_tipo      text check (descuento_tipo in ('porcentaje','monto_fijo')),
  descuento_valor     numeric(12,2) not null default 0,
  costo_fifo_unitario numeric(12,2) not null default 0,
  subtotal_linea      numeric(12,2) not null
);

-- cierre de la referencia circular: ambos campos los escribe solo
-- fn_convertir_proforma_a_venta para que nunca se contradigan
alter table public.proformas
  add column venta_id uuid references public.ventas(id);

-- ---------- Inventario (fuente de verdad del stock) ----------
create table public.kardex_movimientos (
  id                     uuid primary key default gen_random_uuid(),
  -- orden real de insercion: desempata el FIFO cuando dos movimientos
  -- comparten timestamp (now() es fijo dentro de una transaccion)
  consecutivo            bigint generated always as identity,
  producto_id            uuid not null references public.productos(id),
  tipo_movimiento        text not null check (tipo_movimiento in
                         ('entrada_compra','salida_venta','ajuste_entrada','ajuste_salida')),
  cantidad               integer not null check (cantidad > 0),
  costo_unitario         numeric(12,2) not null default 0,
  -- solo en entradas: saldo disponible del lote para el algoritmo FIFO
  cantidad_restante_lote integer,
  referencia_tipo        text not null check (referencia_tipo in
                         ('orden_compra','venta','ajuste_manual')),
  referencia_id          uuid,  -- polimorfico: sin FK real, integridad via RPC
  motivo                 text,
  creado_por             uuid references public.perfiles(id),
  creado_en              timestamptz not null default now(),
  constraint motivo_obligatorio_en_ajustes check (
    tipo_movimiento not in ('ajuste_entrada','ajuste_salida') or motivo is not null
  )
);

-- ---------- Vista: estado efectivo de proformas ----------
-- 'vencida' se deriva de la fecha, no se actualiza con jobs
create view public.vista_proformas
  with (security_invoker = true) as
select
  p.*,
  case
    when p.estado = 'vigente'
     and p.creado_en + make_interval(days => p.plazo_validez_dias) < now()
    then 'vencida'
    else p.estado
  end as estado_efectivo
from public.proformas p;


-- ============================================================================
-- >>> 02_secuencias_triggers.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 03_funciones_rpc.sql
-- ============================================================================
-- ============================================================
-- SISREP — 03: Funciones RPC transaccionales
-- Ejecutar despues de 02_secuencias_triggers.sql
-- Todo cambio de stock pasa por estas funciones (PLAN.md).
-- Son SECURITY DEFINER: saltan RLS, por eso validan rol adentro.
-- ============================================================

-- ---------- Helpers de rol ----------
-- SECURITY DEFINER evita la recursion infinita de RLS al consultar
-- perfiles desde las politicas de la propia tabla perfiles.
create or replace function public.fn_es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin' and activo
  );
$$;

create or replace function public.fn_es_usuario_activo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and activo
  );
$$;

-- ---------- Consumo FIFO (helper interno, no expuesto por API) ----------
-- Bloquea el producto, valida stock suficiente, consume lotes de entrada
-- del mas antiguo al mas nuevo y devuelve el costo unitario promedio.
create or replace function public.fn_fifo_consumir(p_producto_id uuid, p_cantidad integer)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock       integer;
  v_pendiente   integer := p_cantidad;
  v_costo_total numeric := 0;
  v_toma        integer;
  v_lote        record;
begin
  select stock_actual into v_stock
  from public.productos
  where id = p_producto_id and activo
  for update;  -- serializa las salidas del mismo producto

  if v_stock is null then
    raise exception 'Producto % no existe o esta inactivo', p_producto_id;
  end if;
  if v_stock < p_cantidad then
    raise exception 'Stock insuficiente (disponible: %, solicitado: %)', v_stock, p_cantidad;
  end if;

  for v_lote in
    select id, cantidad_restante_lote, costo_unitario
    from public.kardex_movimientos
    where producto_id = p_producto_id
      and tipo_movimiento in ('entrada_compra','ajuste_entrada')
      and cantidad_restante_lote > 0
    order by creado_en asc, consecutivo asc
    for update
  loop
    exit when v_pendiente <= 0;
    v_toma := least(v_lote.cantidad_restante_lote, v_pendiente);
    update public.kardex_movimientos
      set cantidad_restante_lote = cantidad_restante_lote - v_toma
      where id = v_lote.id;
    v_costo_total := v_costo_total + v_toma * v_lote.costo_unitario;
    v_pendiente := v_pendiente - v_toma;
  end loop;

  if v_pendiente > 0 then
    raise exception 'Inconsistencia FIFO en producto %: stock_actual no coincide con lotes', p_producto_id;
  end if;

  return round(v_costo_total / p_cantidad, 2);
end;
$$;

-- ---------- fn_recibir_orden_compra ----------
create or replace function public.fn_recibir_orden_compra(p_orden_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden record;
  v_items integer;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede recibir mercaderia';
  end if;

  select * into v_orden from public.ordenes_compra
  where id = p_orden_id for update;

  if not found then
    raise exception 'La orden de compra no existe';
  end if;
  if v_orden.estado <> 'pendiente' then
    raise exception 'La orden ya esta en estado: %', v_orden.estado;
  end if;

  -- ordenado por producto para evitar interbloqueos con otras recepciones
  -- u operaciones concurrentes sobre los mismos productos (mismo criterio
  -- que fn_registrar_venta)
  insert into public.kardex_movimientos
    (producto_id, tipo_movimiento, cantidad, costo_unitario,
     cantidad_restante_lote, referencia_tipo, referencia_id, creado_por)
  select i.producto_id, 'entrada_compra', i.cantidad, i.costo_unitario,
         i.cantidad, 'orden_compra', p_orden_id, auth.uid()
  from public.orden_compra_items i
  where i.orden_compra_id = p_orden_id
  order by i.producto_id;

  get diagnostics v_items = row_count;
  if v_items = 0 then
    raise exception 'La orden no tiene items';
  end if;

  update public.ordenes_compra
  set estado = 'recibida', fecha_recepcion = now()
  where id = p_orden_id;
end;
$$;

-- ---------- fn_registrar_venta ----------
-- payload esperado:
-- {
--   "cliente_id": "uuid | null",
--   "proforma_origen_id": "uuid | null",
--   "descuento_tipo": "porcentaje | monto_fijo | null",
--   "descuento_valor": 0,
--   "impuesto_porcentaje": 0,
--   "items": [ { "producto_id": "uuid", "cantidad": 1,
--                "precio_unitario": 0, "descuento_tipo": null,
--                "descuento_valor": 0 } ]
-- }
create or replace function public.fn_registrar_venta(p_venta jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id    uuid;
  v_item        jsonb;
  v_producto_id uuid;
  v_cantidad    integer;
  v_precio      numeric;
  v_desc_tipo   text;
  v_desc_valor  numeric;
  v_linea       numeric;
  v_costo       numeric;
  v_subtotal    numeric := 0;
  v_desc_global numeric := 0;
  v_impuesto    numeric;
  v_base        numeric;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado o inactivo';
  end if;
  if p_venta->'items' is null or jsonb_typeof(p_venta->'items') <> 'array'
     or jsonb_array_length(p_venta->'items') = 0 then
    raise exception 'La venta debe tener al menos un item';
  end if;

  v_impuesto := coalesce((p_venta->>'impuesto_porcentaje')::numeric, 0);

  insert into public.ventas
    (cliente_id, proforma_origen_id, descuento_tipo, descuento_valor,
     impuesto_porcentaje, vendido_por)
  values (
    (p_venta->>'cliente_id')::uuid,
    (p_venta->>'proforma_origen_id')::uuid,
    p_venta->>'descuento_tipo',
    coalesce((p_venta->>'descuento_valor')::numeric, 0),
    v_impuesto,
    auth.uid()
  )
  returning id into v_venta_id;

  -- items ordenados por producto para evitar interbloqueos entre ventas concurrentes
  for v_item in
    select value from jsonb_array_elements(p_venta->'items')
    order by value->>'producto_id'
  loop
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::integer;
    v_precio      := (v_item->>'precio_unitario')::numeric;
    v_desc_tipo   := v_item->>'descuento_tipo';
    v_desc_valor  := coalesce((v_item->>'descuento_valor')::numeric, 0);

    if v_producto_id is null or v_cantidad is null or v_cantidad <= 0
       or v_precio is null or v_precio < 0 then
      raise exception 'Item invalido: %', v_item;
    end if;

    v_linea := v_cantidad * v_precio - case v_desc_tipo
      when 'porcentaje' then round(v_cantidad * v_precio * v_desc_valor / 100, 2)
      when 'monto_fijo' then v_desc_valor
      else 0
    end;
    if v_linea < 0 then
      raise exception 'El descuento supera el importe de la linea';
    end if;

    v_costo := public.fn_fifo_consumir(v_producto_id, v_cantidad);

    insert into public.venta_items
      (venta_id, producto_id, cantidad, precio_unitario,
       descuento_tipo, descuento_valor, costo_fifo_unitario, subtotal_linea)
    values (v_venta_id, v_producto_id, v_cantidad, v_precio,
            v_desc_tipo, v_desc_valor, v_costo, round(v_linea, 2));

    insert into public.kardex_movimientos
      (producto_id, tipo_movimiento, cantidad, costo_unitario,
       referencia_tipo, referencia_id, creado_por)
    values (v_producto_id, 'salida_venta', v_cantidad, v_costo,
            'venta', v_venta_id, auth.uid());

    v_subtotal := v_subtotal + round(v_linea, 2);
  end loop;

  v_desc_global := case p_venta->>'descuento_tipo'
    when 'porcentaje' then round(v_subtotal * coalesce((p_venta->>'descuento_valor')::numeric,0) / 100, 2)
    when 'monto_fijo' then coalesce((p_venta->>'descuento_valor')::numeric, 0)
    else 0
  end;
  v_base := v_subtotal - v_desc_global;
  if v_base < 0 then
    raise exception 'El descuento global supera el subtotal';
  end if;

  update public.ventas
  set subtotal = v_subtotal,
      total    = round(v_base * (1 + v_impuesto / 100), 2)
  where id = v_venta_id;

  return v_venta_id;
end;
$$;

-- ---------- fn_convertir_proforma_a_venta ----------
create or replace function public.fn_convertir_proforma_a_venta(p_proforma_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proforma record;
  v_items    jsonb;
  v_venta_id uuid;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado o inactivo';
  end if;

  select * into v_proforma from public.proformas
  where id = p_proforma_id for update;

  if not found then
    raise exception 'La proforma no existe';
  end if;
  if v_proforma.estado = 'convertida' then
    raise exception 'La proforma % ya fue convertida', v_proforma.numero;
  end if;

  select jsonb_agg(jsonb_build_object(
           'producto_id',     producto_id,
           'cantidad',        cantidad,
           'precio_unitario', precio_unitario,
           'descuento_tipo',  descuento_tipo,
           'descuento_valor', descuento_valor))
  into v_items
  from public.proforma_items
  where proforma_id = p_proforma_id;

  if v_items is null then
    raise exception 'La proforma no tiene items';
  end if;

  v_venta_id := public.fn_registrar_venta(jsonb_build_object(
    'cliente_id',          v_proforma.cliente_id,
    'proforma_origen_id',  p_proforma_id,
    'descuento_tipo',      v_proforma.descuento_tipo,
    'descuento_valor',     v_proforma.descuento_valor,
    'impuesto_porcentaje', v_proforma.impuesto_porcentaje,
    'items',               v_items
  ));

  update public.proformas
  set estado = 'convertida', venta_id = v_venta_id
  where id = p_proforma_id;

  return v_venta_id;
end;
$$;

-- ---------- fn_ajuste_stock ----------
-- p_tipo: 'entrada' | 'salida'. Solo admin, motivo obligatorio.
-- En entradas, si no se indica costo se usa el de la ultima entrada.
create or replace function public.fn_ajuste_stock(
  p_producto_id    uuid,
  p_cantidad       integer,
  p_tipo           text,
  p_motivo         text,
  p_costo_unitario numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_costo numeric;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede ajustar stock';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'El motivo del ajuste es obligatorio';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  if p_tipo = 'entrada' then
    v_costo := coalesce(
      p_costo_unitario,
      (select costo_unitario from public.kardex_movimientos
       where producto_id = p_producto_id
         and tipo_movimiento in ('entrada_compra','ajuste_entrada')
       order by creado_en desc limit 1),
      0);
    insert into public.kardex_movimientos
      (producto_id, tipo_movimiento, cantidad, costo_unitario,
       cantidad_restante_lote, referencia_tipo, motivo, creado_por)
    values (p_producto_id, 'ajuste_entrada', p_cantidad, v_costo,
            p_cantidad, 'ajuste_manual', p_motivo, auth.uid());

  elsif p_tipo = 'salida' then
    v_costo := public.fn_fifo_consumir(p_producto_id, p_cantidad);
    insert into public.kardex_movimientos
      (producto_id, tipo_movimiento, cantidad, costo_unitario,
       referencia_tipo, motivo, creado_por)
    values (p_producto_id, 'ajuste_salida', p_cantidad, v_costo,
            'ajuste_manual', p_motivo, auth.uid());

  else
    raise exception 'Tipo de ajuste invalido: use entrada o salida';
  end if;
end;
$$;

-- ---------- Permisos de ejecucion ----------
-- Solo usuarios autenticados llaman las RPC; el helper FIFO y los helpers
-- de trigger no se exponen por la API.
revoke execute on function public.fn_fifo_consumir(uuid, integer) from public, anon, authenticated;
revoke execute on function public.fn_recibir_orden_compra(uuid) from public, anon;
revoke execute on function public.fn_registrar_venta(jsonb) from public, anon;
revoke execute on function public.fn_convertir_proforma_a_venta(uuid) from public, anon;
revoke execute on function public.fn_ajuste_stock(uuid, integer, text, text, numeric) from public, anon;
revoke execute on function public.fn_es_admin() from public, anon;
revoke execute on function public.fn_es_usuario_activo() from public, anon;

grant execute on function public.fn_recibir_orden_compra(uuid) to authenticated;
grant execute on function public.fn_registrar_venta(jsonb) to authenticated;
grant execute on function public.fn_convertir_proforma_a_venta(uuid) to authenticated;
grant execute on function public.fn_ajuste_stock(uuid, integer, text, text, numeric) to authenticated;
grant execute on function public.fn_es_admin() to authenticated;
grant execute on function public.fn_es_usuario_activo() to authenticated;


-- ============================================================================
-- >>> 04_rls_politicas.sql
-- ============================================================================
-- ============================================================
-- SISREP — 04: Row Level Security y politicas
-- Ejecutar despues de 03_funciones_rpc.sql (usa fn_es_admin)
--
-- Modelo de seguridad:
--   * anon (clave publica sin login): CERO acceso a datos.
--   * authenticated + rol vendedor: opera POS, proformas, clientes;
--     solo lectura de catalogo e inventario.
--   * authenticated + rol admin: todo.
--   * ventas y kardex NO tienen politicas de escritura: solo se
--     escriben via funciones RPC (SECURITY DEFINER).
-- ============================================================

-- ---------- Activar RLS en todas las tablas ----------
alter table public.perfiles                        enable row level security;
alter table public.configuracion_empresa          enable row level security;
alter table public.productos                       enable row level security;
alter table public.producto_codigos_equivalentes  enable row level security;
alter table public.vehiculos                       enable row level security;
alter table public.producto_vehiculos_compatibles enable row level security;
alter table public.proveedores                     enable row level security;
alter table public.ordenes_compra                  enable row level security;
alter table public.orden_compra_items              enable row level security;
alter table public.clientes                        enable row level security;
alter table public.proformas                       enable row level security;
alter table public.proforma_items                  enable row level security;
alter table public.ventas                          enable row level security;
alter table public.venta_items                     enable row level security;
alter table public.kardex_movimientos              enable row level security;

-- Refuerzo: anon no tiene ningun privilegio sobre las tablas del sistema
revoke all on all tables in schema public from anon;

-- ---------- perfiles ----------
-- Cada usuario ve su propio perfil; el admin ve y administra todos.
-- El alta la hace el trigger de auth.users (SECURITY DEFINER), no la API.
create policy "perfiles_select_propio_o_admin" on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.fn_es_admin());

create policy "perfiles_update_solo_admin" on public.perfiles
  for update to authenticated
  using (public.fn_es_admin())
  with check (public.fn_es_admin());

-- ---------- configuracion_empresa ----------
create policy "config_select_autenticados" on public.configuracion_empresa
  for select to authenticated
  using (true);

create policy "config_update_solo_admin" on public.configuracion_empresa
  for update to authenticated
  using (public.fn_es_admin())
  with check (public.fn_es_admin());

-- ---------- productos (vendedor: solo lectura) ----------
create policy "productos_select_autenticados" on public.productos
  for select to authenticated
  using (true);

create policy "productos_insert_solo_admin" on public.productos
  for insert to authenticated
  with check (public.fn_es_admin());

-- sin politica DELETE: el borrado es logico (activo = false) via UPDATE
create policy "productos_update_solo_admin" on public.productos
  for update to authenticated
  using (public.fn_es_admin())
  with check (public.fn_es_admin());

-- ---------- codigos equivalentes y vehiculos compatibles ----------
create policy "codigos_select_autenticados" on public.producto_codigos_equivalentes
  for select to authenticated using (true);
create policy "codigos_insert_solo_admin" on public.producto_codigos_equivalentes
  for insert to authenticated with check (public.fn_es_admin());
create policy "codigos_update_solo_admin" on public.producto_codigos_equivalentes
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());
create policy "codigos_delete_solo_admin" on public.producto_codigos_equivalentes
  for delete to authenticated using (public.fn_es_admin());

-- catalogo de vehiculos: mismo criterio (lectura abierta, escritura solo admin)
create policy "vehiculos_select_autenticados" on public.vehiculos
  for select to authenticated using (true);
create policy "vehiculos_insert_solo_admin" on public.vehiculos
  for insert to authenticated with check (public.fn_es_admin());
create policy "vehiculos_update_solo_admin" on public.vehiculos
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());
create policy "vehiculos_delete_solo_admin" on public.vehiculos
  for delete to authenticated using (public.fn_es_admin());

-- compatibilidad producto-vehiculo (tabla intermedia)
create policy "pvc_select_autenticados" on public.producto_vehiculos_compatibles
  for select to authenticated using (true);
create policy "pvc_insert_solo_admin" on public.producto_vehiculos_compatibles
  for insert to authenticated with check (public.fn_es_admin());
create policy "pvc_update_solo_admin" on public.producto_vehiculos_compatibles
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());
create policy "pvc_delete_solo_admin" on public.producto_vehiculos_compatibles
  for delete to authenticated using (public.fn_es_admin());

-- ---------- proveedores (solo admin, incluso lectura — FLUJO.md §10) ----------
create policy "proveedores_select_solo_admin" on public.proveedores
  for select to authenticated using (public.fn_es_admin());
create policy "proveedores_insert_solo_admin" on public.proveedores
  for insert to authenticated with check (public.fn_es_admin());
create policy "proveedores_update_solo_admin" on public.proveedores
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());

-- ---------- compras (solo admin) ----------
create policy "ordenes_select_solo_admin" on public.ordenes_compra
  for select to authenticated using (public.fn_es_admin());
create policy "ordenes_insert_solo_admin" on public.ordenes_compra
  for insert to authenticated with check (public.fn_es_admin());
-- el paso a 'recibida' lo hace fn_recibir_orden_compra; este UPDATE cubre
-- notas y cancelacion
create policy "ordenes_update_solo_admin" on public.ordenes_compra
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());

create policy "oc_items_select_solo_admin" on public.orden_compra_items
  for select to authenticated using (public.fn_es_admin());
create policy "oc_items_insert_solo_admin" on public.orden_compra_items
  for insert to authenticated with check (public.fn_es_admin());
create policy "oc_items_update_solo_admin" on public.orden_compra_items
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());
create policy "oc_items_delete_solo_admin" on public.orden_compra_items
  for delete to authenticated using (public.fn_es_admin());

-- ---------- clientes (ambos roles crean y consultan) ----------
create policy "clientes_select_autenticados" on public.clientes
  for select to authenticated using (true);
create policy "clientes_insert_autenticados" on public.clientes
  for insert to authenticated with check (true);
create policy "clientes_update_autenticados" on public.clientes
  for update to authenticated using (true) with check (true);
create policy "clientes_delete_solo_admin" on public.clientes
  for delete to authenticated using (public.fn_es_admin());

-- ---------- proformas (ambos roles; edicion solo mientras este vigente) ----------
create policy "proformas_select_autenticados" on public.proformas
  for select to authenticated using (true);
create policy "proformas_insert_autenticados" on public.proformas
  for insert to authenticated with check (creado_por = auth.uid());
-- la conversion a venta la hace la RPC (salta RLS); esto cubre la edicion
create policy "proformas_update_vigentes" on public.proformas
  for update to authenticated
  using (estado = 'vigente' or public.fn_es_admin())
  with check (true);
create policy "proformas_delete_solo_admin" on public.proformas
  for delete to authenticated using (public.fn_es_admin());

create policy "pro_items_select_autenticados" on public.proforma_items
  for select to authenticated using (true);
create policy "pro_items_insert_vigentes" on public.proforma_items
  for insert to authenticated
  with check (exists (
    select 1 from public.proformas p
    where p.id = proforma_id and (p.estado = 'vigente' or public.fn_es_admin())
  ));
create policy "pro_items_update_vigentes" on public.proforma_items
  for update to authenticated
  using (exists (
    select 1 from public.proformas p
    where p.id = proforma_id and (p.estado = 'vigente' or public.fn_es_admin())
  ))
  with check (true);
create policy "pro_items_delete_vigentes" on public.proforma_items
  for delete to authenticated
  using (exists (
    select 1 from public.proformas p
    where p.id = proforma_id and (p.estado = 'vigente' or public.fn_es_admin())
  ));

-- ---------- ventas (lectura si; escritura SOLO via fn_registrar_venta) ----------
create policy "ventas_select_autenticados" on public.ventas
  for select to authenticated using (true);

create policy "venta_items_select_autenticados" on public.venta_items
  for select to authenticated using (true);

-- ---------- kardex (lectura si; escritura SOLO via RPC) ----------
create policy "kardex_select_autenticados" on public.kardex_movimientos
  for select to authenticated using (true);


-- ============================================================================
-- >>> 05_indices_storage.sql
-- ============================================================================
-- ============================================================
-- SISREP — 05: Indices y Storage
-- Ejecutar despues de 04_rls_politicas.sql
-- ============================================================

-- ---------- Indices (BACKEND.md §7) ----------
-- Nota: productos.codigo, proformas.numero y ventas.numero ya tienen
-- indice por sus constraints UNIQUE; no se duplican aqui.

create index idx_productos_descripcion
  on public.productos using gin (to_tsvector('spanish', descripcion));

create index idx_codigos_equivalentes_codigo
  on public.producto_codigos_equivalentes (codigo_equivalente);

create index idx_codigos_equivalentes_producto
  on public.producto_codigos_equivalentes (producto_id);

-- vehiculos.marca/modelo ya tiene indice implicito por el unique(marca, modelo)

create index idx_pvc_vehiculo
  on public.producto_vehiculos_compatibles (vehiculo_id);

create index idx_pvc_producto
  on public.producto_vehiculos_compatibles (producto_id);

create index idx_kardex_producto_fecha
  on public.kardex_movimientos (producto_id, creado_en);

-- acelera el recorrido de lotes abiertos en fn_fifo_consumir
create index idx_kardex_lotes_abiertos
  on public.kardex_movimientos (producto_id, creado_en)
  where cantidad_restante_lote > 0;

create index idx_kardex_referencia
  on public.kardex_movimientos (referencia_tipo, referencia_id);

create index idx_proformas_estado on public.proformas (estado);
create index idx_proformas_cliente on public.proformas (cliente_id);
create index idx_proformas_fecha on public.proformas (creado_en);

create index idx_ventas_fecha on public.ventas (creado_en);
create index idx_ventas_cliente on public.ventas (cliente_id);

create index idx_oc_proveedor on public.ordenes_compra (proveedor_id);
create index idx_oc_items_orden on public.orden_compra_items (orden_compra_id);
create index idx_pro_items_proforma on public.proforma_items (proforma_id);
create index idx_venta_items_venta on public.venta_items (venta_id);
-- para el reporte de productos mas vendidos
create index idx_venta_items_producto on public.venta_items (producto_id);

-- ---------- Storage: buckets ----------
insert into storage.buckets (id, name, public)
values
  ('productos-imagenes', 'productos-imagenes', true),
  ('logo-empresa', 'logo-empresa', true)
on conflict (id) do nothing;

-- ---------- Storage: politicas ----------
-- Lectura publica via URL publica (bucket public = true).
-- Listado por API solo autenticados; escritura solo admin.
create policy "storage_select_autenticados" on storage.objects
  for select to authenticated
  using (bucket_id in ('productos-imagenes','logo-empresa'));

create policy "storage_insert_solo_admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('productos-imagenes','logo-empresa')
    and public.fn_es_admin()
  );

create policy "storage_update_solo_admin" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('productos-imagenes','logo-empresa')
    and public.fn_es_admin()
  )
  with check (
    bucket_id in ('productos-imagenes','logo-empresa')
    and public.fn_es_admin()
  );

create policy "storage_delete_solo_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('productos-imagenes','logo-empresa')
    and public.fn_es_admin()
  );


-- ============================================================================
-- >>> 09_busqueda_productos.sql
-- ============================================================================
-- ============================================================
-- SISREP — 09: Busqueda avanzada de productos (Fase 3)
-- Ejecutar en el SQL Editor sobre una base que ya tiene 00 (o 01-05).
-- ============================================================

-- Busca por: codigo, descripcion (texto completo, prefijo por palabra),
-- linea/marca, codigo equivalente, marca/modelo de vehiculo compatible.
-- Devuelve una fila por producto (sin duplicar por cada match de codigo/vehiculo).
create or replace function public.fn_buscar_productos(p_query text)
returns setof public.productos
language plpgsql
stable
set search_path = public
as $$
declare
  v_clean text;
  v_tsq   tsquery;
begin
  if p_query is null or btrim(p_query) = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- saca caracteres especiales de tsquery para que el texto del usuario
  -- nunca rompa el parseo (ej. "frenos & (delantero)")
  v_clean := regexp_replace(p_query, '[&|!():*'']', ' ', 'g');
  v_clean := btrim(regexp_replace(v_clean, '\s+', ' ', 'g'));

  if v_clean = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- prefijo por cada palabra: "fren del" -> "fren:* & del:*"
  v_tsq := to_tsquery('spanish', regexp_replace(v_clean, '\s+', ':* & ', 'g') || ':*');

  return query
    select distinct p.*
    from public.productos p
    left join public.producto_codigos_equivalentes pce on pce.producto_id = p.id
    left join public.producto_vehiculos_compatibles pvc on pvc.producto_id = p.id
    left join public.vehiculos v on v.id = pvc.vehiculo_id
    where p.activo
      and (
        p.codigo ilike '%' || p_query || '%'
        or to_tsvector('spanish', p.descripcion) @@ v_tsq
        or p.linea_marca ilike '%' || p_query || '%'
        or pce.codigo_equivalente ilike '%' || p_query || '%'
        or v.marca ilike '%' || p_query || '%'
        or v.modelo ilike '%' || p_query || '%'
      )
    order by p.descripcion;
end;
$$;

revoke execute on function public.fn_buscar_productos(text) from public, anon;
grant execute on function public.fn_buscar_productos(text) to authenticated;


-- ============================================================================
-- >>> 10_busqueda_por_criterio.sql
-- ============================================================================
-- ============================================================
-- SISREP — 10: Busqueda de productos POR CRITERIO seleccionable
-- Ejecutar en el SQL Editor sobre una base que ya corrio 00 (o 01-09).
-- Reemplaza la firma de fn_buscar_productos: ahora recibe ademas
-- p_campos (los criterios que el usuario marca en la UI).
-- OBLIGATORIO: la app llama a la funcion con 2 argumentos, asi que
-- este script debe correrse para que la busqueda siga funcionando.
-- ============================================================

-- Quitamos la firma vieja de 1 argumento para evitar ambiguedad de
-- sobrecarga (Postgres/PostgREST no sabria cual elegir si conviven las dos).
drop function if exists public.fn_buscar_productos(text);

-- p_campos: subconjunto de
--   'codigo' | 'descripcion' | 'equivalente' | 'linea_marca' | 'vehiculo'
-- Busca solo en los campos marcados (OR entre ellos). Si viene null o vacio,
-- busca en todos (comportamiento equivalente al historico).
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
  v_clean  text;
  v_tsq    tsquery;
  v_campos text[];
begin
  if p_query is null or btrim(p_query) = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- null o arreglo vacio => todos los criterios
  v_campos := coalesce(
    nullif(p_campos, '{}'::text[]),
    array['codigo', 'descripcion', 'equivalente', 'linea_marca', 'vehiculo']
  );

  -- saca caracteres especiales de tsquery para que el texto del usuario
  -- nunca rompa el parseo (ej. "frenos & (delantero)")
  v_clean := regexp_replace(p_query, '[&|!():*'']', ' ', 'g');
  v_clean := btrim(regexp_replace(v_clean, '\s+', ' ', 'g'));

  if v_clean = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- prefijo por cada palabra: "fren del" -> "fren:* & del:*"
  v_tsq := to_tsquery('spanish', regexp_replace(v_clean, '\s+', ':* & ', 'g') || ':*');

  return query
    select distinct p.*
    from public.productos p
    left join public.producto_codigos_equivalentes pce on pce.producto_id = p.id
    left join public.producto_vehiculos_compatibles pvc on pvc.producto_id = p.id
    left join public.vehiculos v on v.id = pvc.vehiculo_id
    where p.activo
      and (
        ('codigo'      = any(v_campos) and p.codigo ilike '%' || p_query || '%')
        or ('descripcion' = any(v_campos) and to_tsvector('spanish', p.descripcion) @@ v_tsq)
        or ('linea_marca' = any(v_campos) and p.linea_marca ilike '%' || p_query || '%')
        or ('equivalente' = any(v_campos) and pce.codigo_equivalente ilike '%' || p_query || '%')
        or ('vehiculo'    = any(v_campos) and (
              v.marca ilike '%' || p_query || '%'
              or v.modelo ilike '%' || p_query || '%'
           ))
      )
    order by p.descripcion;
end;
$$;

revoke execute on function public.fn_buscar_productos(text, text[]) from public, anon;
grant  execute on function public.fn_buscar_productos(text, text[]) to authenticated;


-- ============================================================================
-- >>> 11_cliente_datos_factura.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 12_sucursales.sql
-- ============================================================================
-- ============================================================
-- SISREP — 12: Sucursales (C2 · paso 1)
-- Solo crea la tabla y su ABM. NO toca el stock todavia (eso es el paso 3).
-- Ejecutar en el SQL Editor sobre una base que ya corrio 00 (o 01-11).
-- Idempotente.
-- ============================================================

create table if not exists public.sucursales (
  id        uuid primary key default gen_random_uuid(),
  codigo    text not null unique,   -- ej "1" -> se muestra como "Sucursal 1"
  nombre    text not null,
  direccion text,
  telefono  text,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Sucursal por defecto: sirve para migrar el historico (paso 3) y para arrancar
-- hoy. Solo se inserta si la tabla esta vacia.
insert into public.sucursales (codigo, nombre)
select '1', 'Casa Matriz'
where not exists (select 1 from public.sucursales);

-- ---------- RLS ----------
-- Lectura para todos los autenticados (se necesita ver las sucursales en la UI);
-- alta/edicion solo admin. El borrado es logico (activo = false) via update.
alter table public.sucursales enable row level security;

create policy "sucursales_select_autenticados" on public.sucursales
  for select to authenticated using (true);
create policy "sucursales_insert_solo_admin" on public.sucursales
  for insert to authenticated with check (public.fn_es_admin());
create policy "sucursales_update_solo_admin" on public.sucursales
  for update to authenticated using (public.fn_es_admin()) with check (public.fn_es_admin());


-- ============================================================================
-- >>> 13_perfil_sucursal.sql
-- ============================================================================
-- ============================================================
-- SISREP — 13: Sucursal del usuario (C2 · paso 2)
-- Liga cada perfil a una sucursal. NO toca el stock (eso es el paso 3).
-- Ejecutar en el SQL Editor sobre una base que ya corrio 12_sucursales.sql.
-- Idempotente.
-- ============================================================

-- Columna: sucursal a la que pertenece el usuario.
alter table public.perfiles
  add column if not exists sucursal_id uuid references public.sucursales(id);

-- Backfill: los usuarios existentes quedan en la sucursal por defecto
-- (la de codigo mas bajo, normalmente 'Casa Matriz').
update public.perfiles p
set sucursal_id = (select id from public.sucursales where activo order by codigo limit 1)
where p.sucursal_id is null;

-- El trigger que crea el perfil al invitar un usuario ahora tambien lee
-- sucursal_id de user_metadata (lo manda la pantalla de Configuracion).
create or replace function public.fn_crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre_completo, rol, sucursal_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre_completo', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'vendedor'),
    (new.raw_user_meta_data->>'sucursal_id')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ============================================================================
-- >>> 14_stock_por_sucursal.sql
-- ============================================================================
-- ============================================================
-- SISREP — 14: Stock por sucursal (C2 · paso 3a — BACKEND)
-- Ejecutar en el SQL Editor sobre una base que ya corrio 12 y 13.
--
-- Reescribe el nucleo de inventario: el stock pasa de ser "un numero por
-- producto" a ser por (producto x sucursal). Cada operacion impacta la
-- sucursal del usuario que la ejecuta (fn_mi_sucursal).
--
-- TRANSICION: durante este paso se MANTIENE productos.stock_actual como TOTAL
-- (suma de sucursales) para no romper las pantallas actuales. En el paso 3b se
-- elimina y el total pasa a calcularse por vista (sin dato repetido).
--
-- Idempotente en lo posible. Al final hay una VERIFICACION.
-- ============================================================

-- ---------- 0. Helper: sucursal del usuario logueado ----------
create or replace function public.fn_mi_sucursal()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sucursal_id from public.perfiles where id = auth.uid();
$$;
revoke execute on function public.fn_mi_sucursal() from public, anon;
grant execute on function public.fn_mi_sucursal() to authenticated;

-- ---------- 1. Cache de stock por sucursal ----------
-- Unico lugar donde se guarda el stock. Solo lo escribe el trigger del kardex
-- (SECURITY DEFINER); sin politicas de insert/update para authenticated.
create table if not exists public.producto_stock_sucursal (
  producto_id  uuid not null references public.productos(id),
  sucursal_id  uuid not null references public.sucursales(id),
  stock_actual integer not null default 0,
  primary key (producto_id, sucursal_id)
);

alter table public.producto_stock_sucursal enable row level security;
drop policy if exists "pss_select_autenticados" on public.producto_stock_sucursal;
create policy "pss_select_autenticados" on public.producto_stock_sucursal
  for select to authenticated using (true);

-- ---------- 2. sucursal_id en el kardex ----------
alter table public.kardex_movimientos
  add column if not exists sucursal_id uuid references public.sucursales(id);

-- backfill del historico a la sucursal por defecto (la de codigo mas bajo)
update public.kardex_movimientos
set sucursal_id = (select id from public.sucursales where activo order by codigo limit 1)
where sucursal_id is null;

alter table public.kardex_movimientos alter column sucursal_id set not null;
create index if not exists idx_kardex_prod_suc
  on public.kardex_movimientos (producto_id, sucursal_id);

-- ---------- 3. Migracion del stock actual -> por sucursal ----------
-- Lo que hoy vive en productos.stock_actual pasa a la sucursal por defecto.
insert into public.producto_stock_sucursal (producto_id, sucursal_id, stock_actual)
select p.id,
       (select id from public.sucursales where activo order by codigo limit 1),
       p.stock_actual
from public.productos p
on conflict (producto_id, sucursal_id) do update
  set stock_actual = excluded.stock_actual;

-- ---------- 4. Trigger de stock: por sucursal (+ total transicional) ----------
create or replace function public.fn_kardex_aplica_stock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_delta integer;
begin
  v_delta := case when new.tipo_movimiento in ('entrada_compra','ajuste_entrada')
                  then new.cantidad else -new.cantidad end;

  -- cache por sucursal (la fuente para la UI a partir del paso 3b)
  insert into public.producto_stock_sucursal (producto_id, sucursal_id, stock_actual)
  values (new.producto_id, new.sucursal_id, v_delta)
  on conflict (producto_id, sucursal_id) do update
    set stock_actual = public.producto_stock_sucursal.stock_actual + v_delta;

  -- TOTAL transicional (se elimina en el paso 3b). pg_trigger_depth() > 1 aca,
  -- asi que pasa el guard de productos.
  update public.productos
  set stock_actual = stock_actual + v_delta
  where id = new.producto_id;

  return new;
end;
$$;

-- ---------- 5. FIFO por sucursal (helper interno) ----------
create or replace function public.fn_fifo_consumir(
  p_producto_id uuid,
  p_sucursal_id uuid,
  p_cantidad    integer
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock       integer;
  v_pendiente   integer := p_cantidad;
  v_costo_total numeric := 0;
  v_toma        integer;
  v_lote        record;
begin
  -- bloquea la fila de stock de ESA sucursal y valida disponibilidad
  select stock_actual into v_stock
  from public.producto_stock_sucursal
  where producto_id = p_producto_id and sucursal_id = p_sucursal_id
  for update;

  if v_stock is null then
    raise exception 'El producto no tiene stock en esta sucursal';
  end if;
  if v_stock < p_cantidad then
    raise exception 'Stock insuficiente en la sucursal (disponible: %, solicitado: %)', v_stock, p_cantidad;
  end if;

  for v_lote in
    select id, cantidad_restante_lote, costo_unitario
    from public.kardex_movimientos
    where producto_id = p_producto_id
      and sucursal_id = p_sucursal_id
      and tipo_movimiento in ('entrada_compra','ajuste_entrada')
      and cantidad_restante_lote > 0
    order by creado_en asc, consecutivo asc
    for update
  loop
    exit when v_pendiente <= 0;
    v_toma := least(v_lote.cantidad_restante_lote, v_pendiente);
    update public.kardex_movimientos
      set cantidad_restante_lote = cantidad_restante_lote - v_toma
      where id = v_lote.id;
    v_costo_total := v_costo_total + v_toma * v_lote.costo_unitario;
    v_pendiente := v_pendiente - v_toma;
  end loop;

  if v_pendiente > 0 then
    raise exception 'Inconsistencia FIFO en producto % / sucursal %', p_producto_id, p_sucursal_id;
  end if;

  return round(v_costo_total / p_cantidad, 2);
end;
$$;
revoke execute on function public.fn_fifo_consumir(uuid, uuid, integer) from public, anon, authenticated;

-- ---------- 6. Recepcion de compra: entra a la sucursal del receptor ----------
create or replace function public.fn_recibir_orden_compra(p_orden_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden    record;
  v_items    integer;
  v_sucursal uuid;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede recibir mercaderia';
  end if;

  v_sucursal := public.fn_mi_sucursal();
  if v_sucursal is null then
    raise exception 'Tu usuario no tiene una sucursal asignada';
  end if;

  select * into v_orden from public.ordenes_compra where id = p_orden_id for update;
  if not found then raise exception 'La orden de compra no existe'; end if;
  if v_orden.estado <> 'pendiente' then
    raise exception 'La orden ya esta en estado: %', v_orden.estado;
  end if;

  insert into public.kardex_movimientos
    (producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
     cantidad_restante_lote, referencia_tipo, referencia_id, creado_por)
  select i.producto_id, v_sucursal, 'entrada_compra', i.cantidad, i.costo_unitario,
         i.cantidad, 'orden_compra', p_orden_id, auth.uid()
  from public.orden_compra_items i
  where i.orden_compra_id = p_orden_id
  order by i.producto_id;

  get diagnostics v_items = row_count;
  if v_items = 0 then raise exception 'La orden no tiene items'; end if;

  update public.ordenes_compra
  set estado = 'recibida', fecha_recepcion = now()
  where id = p_orden_id;
end;
$$;

-- ---------- 7. Registrar venta: sale de la sucursal del vendedor ----------
create or replace function public.fn_registrar_venta(p_venta jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id    uuid;
  v_item        jsonb;
  v_producto_id uuid;
  v_cantidad    integer;
  v_precio      numeric;
  v_desc_tipo   text;
  v_desc_valor  numeric;
  v_linea       numeric;
  v_costo       numeric;
  v_subtotal    numeric := 0;
  v_desc_global numeric := 0;
  v_impuesto    numeric;
  v_base        numeric;
  v_sucursal    uuid;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado o inactivo';
  end if;
  if p_venta->'items' is null or jsonb_typeof(p_venta->'items') <> 'array'
     or jsonb_array_length(p_venta->'items') = 0 then
    raise exception 'La venta debe tener al menos un item';
  end if;

  -- sucursal: la del payload si viene, si no la del usuario logueado
  v_sucursal := coalesce((p_venta->>'sucursal_id')::uuid, public.fn_mi_sucursal());
  if v_sucursal is null then
    raise exception 'Tu usuario no tiene una sucursal asignada';
  end if;

  v_impuesto := coalesce((p_venta->>'impuesto_porcentaje')::numeric, 0);

  insert into public.ventas
    (cliente_id, proforma_origen_id, descuento_tipo, descuento_valor,
     impuesto_porcentaje, vendido_por)
  values (
    (p_venta->>'cliente_id')::uuid,
    (p_venta->>'proforma_origen_id')::uuid,
    p_venta->>'descuento_tipo',
    coalesce((p_venta->>'descuento_valor')::numeric, 0),
    v_impuesto,
    auth.uid()
  )
  returning id into v_venta_id;

  for v_item in
    select value from jsonb_array_elements(p_venta->'items')
    order by value->>'producto_id'
  loop
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::integer;
    v_precio      := (v_item->>'precio_unitario')::numeric;
    v_desc_tipo   := v_item->>'descuento_tipo';
    v_desc_valor  := coalesce((v_item->>'descuento_valor')::numeric, 0);

    if v_producto_id is null or v_cantidad is null or v_cantidad <= 0
       or v_precio is null or v_precio < 0 then
      raise exception 'Item invalido: %', v_item;
    end if;

    v_linea := v_cantidad * v_precio - case v_desc_tipo
      when 'porcentaje' then round(v_cantidad * v_precio * v_desc_valor / 100, 2)
      when 'monto_fijo' then v_desc_valor
      else 0
    end;
    if v_linea < 0 then
      raise exception 'El descuento supera el importe de la linea';
    end if;

    v_costo := public.fn_fifo_consumir(v_producto_id, v_sucursal, v_cantidad);

    insert into public.venta_items
      (venta_id, producto_id, cantidad, precio_unitario,
       descuento_tipo, descuento_valor, costo_fifo_unitario, subtotal_linea)
    values (v_venta_id, v_producto_id, v_cantidad, v_precio,
            v_desc_tipo, v_desc_valor, v_costo, round(v_linea, 2));

    insert into public.kardex_movimientos
      (producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
       referencia_tipo, referencia_id, creado_por)
    values (v_producto_id, v_sucursal, 'salida_venta', v_cantidad, v_costo,
            'venta', v_venta_id, auth.uid());

    v_subtotal := v_subtotal + round(v_linea, 2);
  end loop;

  v_desc_global := case p_venta->>'descuento_tipo'
    when 'porcentaje' then round(v_subtotal * coalesce((p_venta->>'descuento_valor')::numeric,0) / 100, 2)
    when 'monto_fijo' then coalesce((p_venta->>'descuento_valor')::numeric, 0)
    else 0
  end;
  v_base := v_subtotal - v_desc_global;
  if v_base < 0 then
    raise exception 'El descuento global supera el subtotal';
  end if;

  update public.ventas
  set subtotal = v_subtotal,
      total    = round(v_base * (1 + v_impuesto / 100), 2)
  where id = v_venta_id;

  return v_venta_id;
end;
$$;

-- ---------- 8. Ajuste de stock: por sucursal ----------
-- Se agrega p_sucursal_id (default: la del usuario). Hay que DROP + CREATE
-- porque cambia la firma. La app la llama sin p_sucursal_id => usa la del user.
drop function if exists public.fn_ajuste_stock(uuid, integer, text, text, numeric);
create or replace function public.fn_ajuste_stock(
  p_producto_id    uuid,
  p_cantidad       integer,
  p_tipo           text,
  p_motivo         text,
  p_costo_unitario numeric default null,
  p_sucursal_id    uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_costo    numeric;
  v_sucursal uuid;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede ajustar stock';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'El motivo del ajuste es obligatorio';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  v_sucursal := coalesce(p_sucursal_id, public.fn_mi_sucursal());
  if v_sucursal is null then
    raise exception 'No hay sucursal para el ajuste';
  end if;

  if p_tipo = 'entrada' then
    v_costo := coalesce(
      p_costo_unitario,
      (select costo_unitario from public.kardex_movimientos
       where producto_id = p_producto_id and sucursal_id = v_sucursal
         and tipo_movimiento in ('entrada_compra','ajuste_entrada')
       order by creado_en desc limit 1),
      0);
    insert into public.kardex_movimientos
      (producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
       cantidad_restante_lote, referencia_tipo, motivo, creado_por)
    values (p_producto_id, v_sucursal, 'ajuste_entrada', p_cantidad, v_costo,
            p_cantidad, 'ajuste_manual', p_motivo, auth.uid());

  elsif p_tipo = 'salida' then
    v_costo := public.fn_fifo_consumir(p_producto_id, v_sucursal, p_cantidad);
    insert into public.kardex_movimientos
      (producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
       referencia_tipo, motivo, creado_por)
    values (p_producto_id, v_sucursal, 'ajuste_salida', p_cantidad, v_costo,
            'ajuste_manual', p_motivo, auth.uid());

  else
    raise exception 'Tipo de ajuste invalido: use entrada o salida';
  end if;
end;
$$;
revoke execute on function public.fn_ajuste_stock(uuid, integer, text, text, numeric, uuid) from public, anon;
grant  execute on function public.fn_ajuste_stock(uuid, integer, text, text, numeric, uuid) to authenticated;

-- fn_convertir_proforma_a_venta no cambia: llama a fn_registrar_venta, que ahora
-- deriva la sucursal del usuario que convierte.

-- ---------- 9. Limpieza: quitar el FIFO viejo de 2 argumentos ----------
drop function if exists public.fn_fifo_consumir(uuid, integer);

-- ============================================================
-- VERIFICACION (correr aparte). Debe devolver 0 filas: confirma que el stock
-- por sucursal suma exactamente el total que habia en productos.stock_actual.
-- ============================================================
-- select p.codigo, p.stock_actual as total_producto,
--        coalesce(sum(pss.stock_actual),0) as suma_sucursales
-- from public.productos p
-- left join public.producto_stock_sucursal pss on pss.producto_id = p.id
-- group by p.codigo, p.stock_actual
-- having p.stock_actual <> coalesce(sum(pss.stock_actual),0);


-- ============================================================================
-- >>> 15_busqueda_anidada.sql
-- ============================================================================
-- ============================================================
-- SISREP — 15: Busqueda ANIDADA de productos por fragmentos (C1.1)
-- Ejecutar en el SQL Editor sobre una base que ya corrio 00 (o 01-10).
-- Idempotente: reemplaza el cuerpo de fn_buscar_productos(texto, campos[]).
-- La firma NO cambia, asi que la app (catalogo, compras, POS, proformas)
-- sigue llamando igual y hereda la mejora sin tocar cliente.
--
-- QUE CAMBIA vs. 10_busqueda_por_criterio.sql:
--   Antes, para codigo/linea_marca/equivalente/vehiculo se hacia UN solo
--   `ilike '%' || p_query || '%'` sobre TODA la cadena: al escribir dos
--   trozos separados por espacio ("piston comp") buscaba literalmente
--   '%piston comp%' y no encontraba "PISTON COMPRESOR".
--   Ahora la consulta se parte en fragmentos por espacio y el campo debe
--   cumplir TODOS (ilike all) -> "piston comp 85" resuelve
--   "PISTON COMPRESOR 85MM" aunque se escriban trozos parciales.
--   Se conserva `%` como comodin intencional para replicar el patron
--   "Piston%comp%85" del sistema del cliente.
--   descripcion mantiene ADEMAS su tsquery historico (stemming es/plurales),
--   asi que nada de lo que antes hacia match deja de hacerlo.
-- ============================================================

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
  v_clean    text;
  v_tsq      tsquery;
  v_campos   text[];
  v_patterns text[];
begin
  if p_query is null or btrim(p_query) = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- null o arreglo vacio => todos los criterios
  v_campos := coalesce(
    nullif(p_campos, '{}'::text[]),
    array['codigo', 'descripcion', 'equivalente', 'linea_marca', 'vehiculo']
  );

  -- saca caracteres que romperian el tsquery; CONSERVA % (comodin del usuario)
  v_clean := regexp_replace(p_query, '[&|!():*'']', ' ', 'g');
  v_clean := btrim(regexp_replace(v_clean, '\s+', ' ', 'g'));

  if v_clean = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

  -- tsquery por prefijo: comportamiento historico de descripcion
  -- "fren del" -> "fren:* & del:*"
  v_tsq := to_tsquery('spanish', regexp_replace(v_clean, '\s+', ':* & ', 'g') || ':*');

  -- BUSQUEDA ANIDADA (C1.1): un patron ilike '%frag%' por cada fragmento.
  -- Se escapan \ y _ (para que un _ del texto no actue como comodin de ilike);
  -- se DEJA % como comodin intencional (patron "Piston%comp%85" del cliente).
  select array_agg('%' || replace(replace(frag, '\', '\\'), '_', '\_') || '%')
    into v_patterns
  from unnest(string_to_array(v_clean, ' ')) as frag
  where frag <> '';

  return query
    select distinct p.*
    from public.productos p
    left join public.producto_codigos_equivalentes pce on pce.producto_id = p.id
    left join public.producto_vehiculos_compatibles pvc on pvc.producto_id = p.id
    left join public.vehiculos v on v.id = pvc.vehiculo_id
    where p.activo
      and (
        ('codigo'      = any(v_campos) and p.codigo ilike all(v_patterns))
        or ('descripcion' = any(v_campos) and (
              to_tsvector('spanish', p.descripcion) @@ v_tsq
              or p.descripcion ilike all(v_patterns)
           ))
        or ('linea_marca' = any(v_campos) and p.linea_marca ilike all(v_patterns))
        or ('equivalente' = any(v_campos) and pce.codigo_equivalente ilike all(v_patterns))
        or ('vehiculo'    = any(v_campos) and (
              v.marca ilike all(v_patterns)
              or v.modelo ilike all(v_patterns)
              or (coalesce(v.marca, '') || ' ' || coalesce(v.modelo, '')) ilike all(v_patterns)
           ))
      )
    order by p.descripcion;
end;
$$;

revoke execute on function public.fn_buscar_productos(text, text[]) from public, anon;
grant  execute on function public.fn_buscar_productos(text, text[]) to authenticated;


-- ============================================================================
-- >>> 16_sucursal_en_documentos.sql
-- ============================================================================
-- ============================================================
-- SISREP — 16: Sucursal en los documentos (C2 · paso 3c)
-- Ejecutar en el SQL Editor sobre una base que ya corrio 12, 13 y 14.
--
-- El stock ya es por sucursal (14), pero los DOCUMENTOS todavia no guardan
-- de que sucursal salieron. Este script agrega sucursal_id a:
--   - ordenes_compra  (sucursal DESTINO: a donde entra la mercaderia)
--   - ventas          (sucursal de la venta)
--   - proformas       (sucursal de emision; se propaga a la venta al convertir)
-- y conecta las 3 RPC para que la usen.
--
-- SEGURO / NO ROMPE LA APP: las columnas quedan NULLABLE. El backfill llena el
-- historico con la sucursal por defecto, y las RPC caen a la sucursal del
-- usuario (fn_mi_sucursal) cuando el documento no trae sucursal. El NOT NULL
-- se deja para un paso posterior, cuando la app ya mande siempre la sucursal.
--
-- Idempotente.
-- ============================================================

-- ---------- 1. Columnas nuevas (nullable) ----------
alter table public.proformas
  add column if not exists sucursal_id uuid references public.sucursales(id);
alter table public.ventas
  add column if not exists sucursal_id uuid references public.sucursales(id);
alter table public.ordenes_compra
  add column if not exists sucursal_id uuid references public.sucursales(id);

-- ---------- 2. Backfill del historico a la sucursal por defecto ----------
-- (la de codigo mas bajo entre las activas — mismo criterio que el script 14)
update public.proformas
set sucursal_id = (select id from public.sucursales where activo order by codigo limit 1)
where sucursal_id is null;

update public.ventas
set sucursal_id = (select id from public.sucursales where activo order by codigo limit 1)
where sucursal_id is null;

update public.ordenes_compra
set sucursal_id = (select id from public.sucursales where activo order by codigo limit 1)
where sucursal_id is null;

-- ---------- 3. Indices para reportes/filtros por sucursal ----------
create index if not exists idx_proformas_sucursal on public.proformas (sucursal_id);
create index if not exists idx_ventas_sucursal    on public.ventas (sucursal_id);
create index if not exists idx_ordenes_sucursal   on public.ordenes_compra (sucursal_id);

-- ---------- 4. Recepcion de compra: entra a la sucursal DESTINO de la orden ----------
-- (antes usaba siempre fn_mi_sucursal; ahora respeta ordenes_compra.sucursal_id)
create or replace function public.fn_recibir_orden_compra(p_orden_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden    record;
  v_items    integer;
  v_sucursal uuid;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede recibir mercaderia';
  end if;

  select * into v_orden from public.ordenes_compra where id = p_orden_id for update;
  if not found then raise exception 'La orden de compra no existe'; end if;
  if v_orden.estado <> 'pendiente' then
    raise exception 'La orden ya esta en estado: %', v_orden.estado;
  end if;

  -- sucursal destino de la orden; si la orden no la trae (creada antes de este
  -- cambio), cae a la del usuario que recibe.
  v_sucursal := coalesce(v_orden.sucursal_id, public.fn_mi_sucursal());
  if v_sucursal is null then
    raise exception 'No hay sucursal destino para la orden';
  end if;

  insert into public.kardex_movimientos
    (producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
     cantidad_restante_lote, referencia_tipo, referencia_id, creado_por)
  select i.producto_id, v_sucursal, 'entrada_compra', i.cantidad, i.costo_unitario,
         i.cantidad, 'orden_compra', p_orden_id, auth.uid()
  from public.orden_compra_items i
  where i.orden_compra_id = p_orden_id
  order by i.producto_id;

  get diagnostics v_items = row_count;
  if v_items = 0 then raise exception 'La orden no tiene items'; end if;

  update public.ordenes_compra
  set estado = 'recibida', fecha_recepcion = now()
  where id = p_orden_id;
end;
$$;

-- ---------- 5. Registrar venta: ahora GUARDA ventas.sucursal_id ----------
-- Identica a la version del script 14, con un solo cambio: el insert en
-- public.ventas agrega la columna sucursal_id con el valor v_sucursal.
create or replace function public.fn_registrar_venta(p_venta jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id    uuid;
  v_item        jsonb;
  v_producto_id uuid;
  v_cantidad    integer;
  v_precio      numeric;
  v_desc_tipo   text;
  v_desc_valor  numeric;
  v_linea       numeric;
  v_costo       numeric;
  v_subtotal    numeric := 0;
  v_desc_global numeric := 0;
  v_impuesto    numeric;
  v_base        numeric;
  v_sucursal    uuid;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado o inactivo';
  end if;
  if p_venta->'items' is null or jsonb_typeof(p_venta->'items') <> 'array'
     or jsonb_array_length(p_venta->'items') = 0 then
    raise exception 'La venta debe tener al menos un item';
  end if;

  -- sucursal: la del payload si viene, si no la del usuario logueado
  v_sucursal := coalesce((p_venta->>'sucursal_id')::uuid, public.fn_mi_sucursal());
  if v_sucursal is null then
    raise exception 'Tu usuario no tiene una sucursal asignada';
  end if;

  v_impuesto := coalesce((p_venta->>'impuesto_porcentaje')::numeric, 0);

  insert into public.ventas
    (cliente_id, proforma_origen_id, descuento_tipo, descuento_valor,
     impuesto_porcentaje, vendido_por, sucursal_id)
  values (
    (p_venta->>'cliente_id')::uuid,
    (p_venta->>'proforma_origen_id')::uuid,
    p_venta->>'descuento_tipo',
    coalesce((p_venta->>'descuento_valor')::numeric, 0),
    v_impuesto,
    auth.uid(),
    v_sucursal
  )
  returning id into v_venta_id;

  for v_item in
    select value from jsonb_array_elements(p_venta->'items')
    order by value->>'producto_id'
  loop
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::integer;
    v_precio      := (v_item->>'precio_unitario')::numeric;
    v_desc_tipo   := v_item->>'descuento_tipo';
    v_desc_valor  := coalesce((v_item->>'descuento_valor')::numeric, 0);

    if v_producto_id is null or v_cantidad is null or v_cantidad <= 0
       or v_precio is null or v_precio < 0 then
      raise exception 'Item invalido: %', v_item;
    end if;

    v_linea := v_cantidad * v_precio - case v_desc_tipo
      when 'porcentaje' then round(v_cantidad * v_precio * v_desc_valor / 100, 2)
      when 'monto_fijo' then v_desc_valor
      else 0
    end;
    if v_linea < 0 then
      raise exception 'El descuento supera el importe de la linea';
    end if;

    v_costo := public.fn_fifo_consumir(v_producto_id, v_sucursal, v_cantidad);

    insert into public.venta_items
      (venta_id, producto_id, cantidad, precio_unitario,
       descuento_tipo, descuento_valor, costo_fifo_unitario, subtotal_linea)
    values (v_venta_id, v_producto_id, v_cantidad, v_precio,
            v_desc_tipo, v_desc_valor, v_costo, round(v_linea, 2));

    insert into public.kardex_movimientos
      (producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
       referencia_tipo, referencia_id, creado_por)
    values (v_producto_id, v_sucursal, 'salida_venta', v_cantidad, v_costo,
            'venta', v_venta_id, auth.uid());

    v_subtotal := v_subtotal + round(v_linea, 2);
  end loop;

  v_desc_global := case p_venta->>'descuento_tipo'
    when 'porcentaje' then round(v_subtotal * coalesce((p_venta->>'descuento_valor')::numeric,0) / 100, 2)
    when 'monto_fijo' then coalesce((p_venta->>'descuento_valor')::numeric, 0)
    else 0
  end;
  v_base := v_subtotal - v_desc_global;
  if v_base < 0 then
    raise exception 'El descuento global supera el subtotal';
  end if;

  update public.ventas
  set subtotal = v_subtotal,
      total    = round(v_base * (1 + v_impuesto / 100), 2)
  where id = v_venta_id;

  return v_venta_id;
end;
$$;

-- ---------- 6. Conversion de proforma: propaga proformas.sucursal_id ----------
-- Identica a la version del script 03, con un solo cambio: el payload que se
-- pasa a fn_registrar_venta agrega 'sucursal_id' = la sucursal de la proforma.
create or replace function public.fn_convertir_proforma_a_venta(p_proforma_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proforma record;
  v_items    jsonb;
  v_venta_id uuid;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado o inactivo';
  end if;

  select * into v_proforma from public.proformas
  where id = p_proforma_id for update;

  if not found then
    raise exception 'La proforma no existe';
  end if;
  if v_proforma.estado = 'convertida' then
    raise exception 'La proforma % ya fue convertida', v_proforma.numero;
  end if;

  select jsonb_agg(jsonb_build_object(
           'producto_id',     producto_id,
           'cantidad',        cantidad,
           'precio_unitario', precio_unitario,
           'descuento_tipo',  descuento_tipo,
           'descuento_valor', descuento_valor))
  into v_items
  from public.proforma_items
  where proforma_id = p_proforma_id;

  if v_items is null then
    raise exception 'La proforma no tiene items';
  end if;

  v_venta_id := public.fn_registrar_venta(jsonb_build_object(
    'cliente_id',          v_proforma.cliente_id,
    'proforma_origen_id',  p_proforma_id,
    'sucursal_id',         v_proforma.sucursal_id,
    'descuento_tipo',      v_proforma.descuento_tipo,
    'descuento_valor',     v_proforma.descuento_valor,
    'impuesto_porcentaje', v_proforma.impuesto_porcentaje,
    'items',               v_items
  ));

  update public.proformas
  set estado = 'convertida', venta_id = v_venta_id
  where id = p_proforma_id;

  return v_venta_id;
end;
$$;

-- ============================================================
-- VERIFICACION (correr aparte para confirmar; no modifica nada)
--
--   -- a) las 3 columnas existen y no quedaron filas sin sucursal:
--   select
--     (select count(*) from public.proformas      where sucursal_id is null) as proformas_sin_suc,
--     (select count(*) from public.ventas         where sucursal_id is null) as ventas_sin_suc,
--     (select count(*) from public.ordenes_compra where sucursal_id is null) as ordenes_sin_suc;
--   -- Esperado: 0, 0, 0
--
--   -- b) las 3 funciones se recrearon:
--   select proname from pg_proc
--   where proname in ('fn_recibir_orden_compra','fn_registrar_venta','fn_convertir_proforma_a_venta')
--   order by proname;
-- ============================================================


-- ============================================================================
-- >>> 17_tiempo_entrega.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 18_precios_mayor.sql
-- ============================================================================
-- ============================================================
-- SISREP — 18: Precios por mayor escalonados (C3 · paso 1)
-- Ejecutar en el SQL Editor sobre una base que ya corrio 00 (o 01-17).
--
-- Por producto, varias escalas de precio segun cantidad minima
-- (ej. >=20 -> Bs 90, >=100 -> Bs 80), cada una con fecha de
-- vigencia opcional ("Lim" en el sistema del cliente): pasada la
-- fecha, la escala deja de aplicar.
--
-- Este paso crea la tabla + su ABM (se administra desde la ficha
-- del producto). El paso 2 aplica el precio en proforma/POS segun
-- cantidad y fecha.
--
-- Idempotente.
-- ============================================================

create table if not exists public.producto_precios_mayor (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references public.productos(id) on delete cascade,
  cantidad_minima integer not null check (cantidad_minima > 1),
  precio          numeric not null check (precio >= 0),
  vigente_hasta   date,               -- null = sin fecha limite
  creado_en       timestamptz not null default now(),
  unique (producto_id, cantidad_minima)
);

create index if not exists idx_precios_mayor_producto
  on public.producto_precios_mayor (producto_id);

-- RLS: todos los autenticados leen (el POS/proforma necesita consultar la
-- escala); solo el admin administra (mismo criterio que el CRUD de productos).
alter table public.producto_precios_mayor enable row level security;

drop policy if exists "ppm_select_autenticados" on public.producto_precios_mayor;
create policy "ppm_select_autenticados" on public.producto_precios_mayor
  for select to authenticated using (true);

drop policy if exists "ppm_insert_admin" on public.producto_precios_mayor;
create policy "ppm_insert_admin" on public.producto_precios_mayor
  for insert to authenticated with check (public.fn_es_admin());

drop policy if exists "ppm_update_admin" on public.producto_precios_mayor;
create policy "ppm_update_admin" on public.producto_precios_mayor
  for update to authenticated using (public.fn_es_admin());

drop policy if exists "ppm_delete_admin" on public.producto_precios_mayor;
create policy "ppm_delete_admin" on public.producto_precios_mayor
  for delete to authenticated using (public.fn_es_admin());

-- ============================================================
-- VERIFICACION (correr aparte; no modifica nada)
--
--   select table_name from information_schema.tables
--   where table_name = 'producto_precios_mayor';
--   -- Esperado: 1 fila
--
--   select policyname from pg_policies
--   where tablename = 'producto_precios_mayor' order by policyname;
--   -- Esperado: 4 politicas (select/insert/update/delete)
-- ============================================================


-- ============================================================================
-- >>> 19_pedidos_traspaso.sql
-- ============================================================================
-- ============================================================
-- SISREP — 19: Módulo de Pedidos y Traspasos entre Sucursales (C4)
-- Permite transferir productos de una sucursal/almacen origen a otra destino,
-- con registro de salida FIFO en origen y entrada de lote FIFO en destino.
-- ============================================================

-- ---------- 1. Actualizar constraints de kardex_movimientos ----------
alter table public.kardex_movimientos
  drop constraint if exists kardex_movimientos_tipo_movimiento_check;

alter table public.kardex_movimientos
  add constraint kardex_movimientos_tipo_movimiento_check
  check (tipo_movimiento = any (array[
    'entrada_compra'::text,
    'salida_venta'::text,
    'ajuste_entrada'::text,
    'ajuste_salida'::text,
    'salida_traspaso'::text,
    'entrada_traspaso'::text
  ]));

alter table public.kardex_movimientos
  drop constraint if exists kardex_movimientos_referencia_tipo_check;

alter table public.kardex_movimientos
  add constraint kardex_movimientos_referencia_tipo_check
  check (referencia_tipo = any (array[
    'orden_compra'::text,
    'venta'::text,
    'ajuste_manual'::text,
    'traspaso'::text
  ]));

-- ---------- 2. Secuencia y tablas de traspaso ----------
create sequence if not exists public.pedidos_traspaso_seq start with 1 increment by 1;

create table if not exists public.pedidos_traspaso (
  id uuid not null default gen_random_uuid(),
  numero text not null unique,
  sucursal_origen_id uuid not null references public.sucursales(id),
  sucursal_destino_id uuid not null references public.sucursales(id),
  estado text not null default 'pendiente' check (estado = any (array['pendiente'::text, 'enviado'::text, 'recibido'::text, 'cancelado'::text])),
  creado_por uuid references public.perfiles(id),
  creado_en timestamp with time zone not null default now(),
  fecha_envio timestamp with time zone,
  fecha_recepcion timestamp with time zone,
  notas text,
  constraint pedidos_traspaso_pkey primary key (id),
  constraint pedidos_traspaso_sucursales_diff check (sucursal_origen_id <> sucursal_destino_id)
);

create table if not exists public.pedido_traspaso_items (
  id uuid not null default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_traspaso(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  cantidad integer not null check (cantidad > 0),
  costo_fifo_unitario numeric not null default 0 check (costo_fifo_unitario >= 0),
  constraint pedido_traspaso_items_pkey primary key (id)
);

-- Trigger de numeracion autogenerada (PED-000001)
create or replace function public.fn_pedidos_traspaso_numero()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.numero is null or btrim(new.numero) = '' then
    new.numero := 'PED-' || lpad(nextval('public.pedidos_traspaso_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedidos_traspaso_numero on public.pedidos_traspaso;
create trigger trg_pedidos_traspaso_numero
  before insert on public.pedidos_traspaso
  for each row execute function public.fn_pedidos_traspaso_numero();

-- RLS
alter table public.pedidos_traspaso enable row level security;
alter table public.pedido_traspaso_items enable row level security;

drop policy if exists "pt_select_autenticados" on public.pedidos_traspaso;
create policy "pt_select_autenticados" on public.pedidos_traspaso
  for select to authenticated using (true);

drop policy if exists "pti_select_autenticados" on public.pedido_traspaso_items;
create policy "pti_select_autenticados" on public.pedido_traspaso_items
  for select to authenticated using (true);

-- ---------- 3. RPC Transaccionales ----------

-- A) Crear Pedido de Traspaso
create or replace function public.fn_crear_pedido_traspaso(
  p_sucursal_destino_id uuid,
  p_items jsonb,
  p_notas text default null,
  p_sucursal_origen_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido_id uuid;
  v_origen_id uuid;
  v_item jsonb;
  v_producto_id uuid;
  v_cantidad integer;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario inactivo o no autorizado';
  end if;

  v_origen_id := coalesce(p_sucursal_origen_id, public.fn_mi_sucursal());
  if v_origen_id is null then
    raise exception 'No se pudo determinar la sucursal de origen';
  end if;

  if v_origen_id = p_sucursal_destino_id then
    raise exception 'La sucursal de origen y destino deben ser distintas';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Debe incluir al menos un producto en el traspaso';
  end if;

  insert into public.pedidos_traspaso (sucursal_origen_id, sucursal_destino_id, creado_por, notas)
  values (v_origen_id, p_sucursal_destino_id, auth.uid(), p_notas)
  returning id into v_pedido_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::integer;
    if v_producto_id is null or v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Ítem inválido en el pedido de traspaso';
    end if;

    insert into public.pedido_traspaso_items (pedido_id, producto_id, cantidad)
    values (v_pedido_id, v_producto_id, v_cantidad);
  end loop;

  return v_pedido_id;
end;
$$;

-- B) Enviar Traspaso (Salida FIFO de Origen)
create or replace function public.fn_enviar_traspaso(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido record;
  v_item record;
  v_costo numeric;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_pedido from public.pedidos_traspaso where id = p_pedido_id for update;
  if not found then raise exception 'El pedido de traspaso no existe'; end if;
  if v_pedido.estado <> 'pendiente' then
    raise exception 'El traspaso debe estar en estado pendiente para enviarse (estado actual: %)', v_pedido.estado;
  end if;

  for v_item in select * from public.pedido_traspaso_items where pedido_id = p_pedido_id loop
    v_costo := public.fn_fifo_consumir(v_item.producto_id, v_pedido.sucursal_origen_id, v_item.cantidad);

    update public.pedido_traspaso_items
    set costo_fifo_unitario = v_costo
    where id = v_item.id;

    insert into public.kardex_movimientos (
      producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
      referencia_tipo, referencia_id, creado_por
    ) values (
      v_item.producto_id, v_pedido.sucursal_origen_id, 'salida_traspaso', v_item.cantidad, v_costo,
      'traspaso', p_pedido_id, auth.uid()
    );
  end loop;

  update public.pedidos_traspaso
  set estado = 'enviado', fecha_envio = now()
  where id = p_pedido_id;
end;
$$;

-- C) Recibir Traspaso (Entrada Lote FIFO en Destino)
create or replace function public.fn_recibir_traspaso(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido record;
  v_item record;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_pedido from public.pedidos_traspaso where id = p_pedido_id for update;
  if not found then raise exception 'El pedido de traspaso no existe'; end if;
  if v_pedido.estado <> 'enviado' then
    raise exception 'El traspaso debe estar en estado enviado para recibirse (estado actual: %)', v_pedido.estado;
  end if;

  for v_item in select * from public.pedido_traspaso_items where pedido_id = p_pedido_id loop
    insert into public.kardex_movimientos (
      producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
      cantidad_restante_lote, referencia_tipo, referencia_id, creado_por
    ) values (
      v_item.producto_id, v_pedido.sucursal_destino_id, 'entrada_traspaso', v_item.cantidad, v_item.costo_fifo_unitario,
      v_item.cantidad, 'traspaso', p_pedido_id, auth.uid()
    );
  end loop;

  update public.pedidos_traspaso
  set estado = 'recibido', fecha_recepcion = now()
  where id = p_pedido_id;
end;
$$;

-- D) Cancelar Traspaso
create or replace function public.fn_cancelar_traspaso(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido record;
begin
  select * into v_pedido from public.pedidos_traspaso where id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe'; end if;
  if v_pedido.estado <> 'pendiente' then
    raise exception 'Solo se pueden cancelar pedidos en estado pendiente';
  end if;

  update public.pedidos_traspaso set estado = 'cancelado' where id = p_pedido_id;
end;
$$;

revoke execute on function public.fn_crear_pedido_traspaso(uuid, jsonb, text, uuid) from public, anon;
grant execute on function public.fn_crear_pedido_traspaso(uuid, jsonb, text, uuid) to authenticated;

revoke execute on function public.fn_enviar_traspaso(uuid) from public, anon;
grant execute on function public.fn_enviar_traspaso(uuid) to authenticated;

revoke execute on function public.fn_recibir_traspaso(uuid) from public, anon;
grant execute on function public.fn_recibir_traspaso(uuid) to authenticated;

revoke execute on function public.fn_cancelar_traspaso(uuid) from public, anon;
grant execute on function public.fn_cancelar_traspaso(uuid) to authenticated;


-- ============================================================================
-- >>> 20_fix_trigger_traspasos.sql
-- ============================================================================
-- ============================================================
-- SISREP — 20: FIX CRITICO — el trigger de stock no conocia los traspasos
-- Ejecutar en el SQL Editor sobre una base que ya corrio 19. URGENTE si se
-- va a usar el modulo /traspasos.
--
-- BUG: fn_kardex_aplica_stock (script 14) trataba como ENTRADA solo
-- 'entrada_compra' y 'ajuste_entrada'; cualquier otro tipo RESTA. El script 19
-- agrego 'entrada_traspaso' sin actualizar el trigger, asi que al RECIBIR un
-- traspaso el stock del DESTINO se restaba en vez de sumarse (el producto
-- "salia" de ambas sucursales). 'salida_traspaso' si estaba bien (resta).
--
-- Este script:
--   1. Corrige el trigger: 'entrada_traspaso' suma.
--   2. Repara el stock si ya se recibieron traspasos con el trigger roto
--      (recomputa el cache desde el kardex, la fuente de verdad).
--   3. Bonus: agrega el UNIQUE que le falta a producto_precios_mayor
--      (la version aplicada en la BD no lo traia; el ABM de la app
--      reemplaza el set completo, pero el candado evita duplicados por
--      inserciones concurrentes o cargas externas).
--
-- Idempotente.
-- ============================================================

-- ---------- 1. Trigger corregido ----------
create or replace function public.fn_kardex_aplica_stock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_delta integer;
begin
  -- entradas: compra, ajuste de entrada y RECEPCION de traspaso.
  -- salidas: venta, ajuste de salida y ENVIO de traspaso.
  v_delta := case when new.tipo_movimiento in
                    ('entrada_compra','ajuste_entrada','entrada_traspaso')
                  then new.cantidad else -new.cantidad end;

  -- cache por sucursal (la fuente para la UI)
  insert into public.producto_stock_sucursal (producto_id, sucursal_id, stock_actual)
  values (new.producto_id, new.sucursal_id, v_delta)
  on conflict (producto_id, sucursal_id) do update
    set stock_actual = public.producto_stock_sucursal.stock_actual + v_delta;

  -- TOTAL transicional (se elimina cuando C2 paso 4 lo convierta en vista).
  -- pg_trigger_depth() > 1 aca, asi que pasa el guard de productos.
  update public.productos
  set stock_actual = stock_actual + v_delta
  where id = new.producto_id;

  return new;
end;
$$;

-- ---------- 2. Reparacion del cache (por si ya hubo recepciones rotas) ----------
-- Recomputa producto_stock_sucursal y productos.stock_actual desde el kardex.
-- Seguro de correr siempre: si no hubo traspasos rotos, deja los mismos valores.
with esperado as (
  select producto_id, sucursal_id,
         sum(case when tipo_movimiento in
                    ('entrada_compra','ajuste_entrada','entrada_traspaso')
                  then cantidad else -cantidad end) as stock
  from public.kardex_movimientos
  group by producto_id, sucursal_id
)
update public.producto_stock_sucursal pss
set stock_actual = e.stock
from esperado e
where e.producto_id = pss.producto_id
  and e.sucursal_id = pss.sucursal_id
  and pss.stock_actual <> e.stock;

update public.productos p
set stock_actual = coalesce(t.total, 0)
from (
  select producto_id, sum(stock_actual) as total
  from public.producto_stock_sucursal
  group by producto_id
) t
where t.producto_id = p.id
  and p.stock_actual <> coalesce(t.total, 0);

-- ---------- 3. UNIQUE faltante en precios por mayor ----------
-- Primero elimina duplicados (conserva la escala mas reciente por producto+cantidad).
delete from public.producto_precios_mayor a
using public.producto_precios_mayor b
where a.producto_id = b.producto_id
  and a.cantidad_minima = b.cantidad_minima
  and a.creado_en < b.creado_en;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'producto_precios_mayor_producto_cantidad_key'
  ) then
    alter table public.producto_precios_mayor
      add constraint producto_precios_mayor_producto_cantidad_key
      unique (producto_id, cantidad_minima);
  end if;
end $$;

-- ============================================================
-- VERIFICACION (correr aparte; no modifica nada)
--
--   -- a) el trigger ya conoce los traspasos:
--   select prosrc like '%entrada_traspaso%' as trigger_corregido
--   from pg_proc where proname = 'fn_kardex_aplica_stock';
--   -- Esperado: true
--
--   -- b) el cache cuadra con el kardex (0 filas = todo consistente):
--   select k.producto_id, k.sucursal_id, k.stock as kardex, pss.stock_actual as cache
--   from (
--     select producto_id, sucursal_id,
--            sum(case when tipo_movimiento in
--                      ('entrada_compra','ajuste_entrada','entrada_traspaso')
--                    then cantidad else -cantidad end) as stock
--     from public.kardex_movimientos group by producto_id, sucursal_id
--   ) k
--   join public.producto_stock_sucursal pss
--     on pss.producto_id = k.producto_id and pss.sucursal_id = k.sucursal_id
--   where pss.stock_actual <> k.stock;
--   -- Esperado: 0 filas
--
--   -- c) el unique de precios existe:
--   select conname from pg_constraint
--   where conname = 'producto_precios_mayor_producto_cantidad_key';
--   -- Esperado: 1 fila
-- ============================================================


-- ============================================================================
-- >>> 21_fix_fifo_traspaso.sql
-- ============================================================================
-- ============================================================
-- SISREP — 21: FIX CRITICO — el FIFO no consumia los lotes de traspaso
-- Ejecutar en el SQL Editor sobre una base que ya corrio 14, 19 y 20.
-- URGENTE si se usa el modulo /traspasos: sin este fix no se puede VENDER
-- (ni ajustar, ni re-traspasar) el stock que entro por una recepcion de
-- traspaso.
--
-- BUG (contraparte del que arreglo el script 20):
--   El script 20 corrigio el TRIGGER para que 'entrada_traspaso' SUME al cache
--   de stock (producto_stock_sucursal), asi que el inventario muestra el stock
--   como "Disponible". Pero fn_fifo_consumir (script 14) solo recorre lotes de
--   tipo 'entrada_compra' y 'ajuste_entrada' — NUNCA 'entrada_traspaso'.
--   Resultado: al vender/ajustar/re-traspasar un producto cuyo stock vino por
--   un traspaso recibido, el cache dice "hay stock" (pasa la validacion) pero
--   el bucle FIFO no encuentra lotes que consumir => queda cantidad pendiente
--   => lanza 'Inconsistencia FIFO en producto % / sucursal %'.
--
-- FIX: agregar 'entrada_traspaso' a los tipos de lote que consume el FIFO.
--   Los lotes de recepcion de traspaso ya traen cantidad_restante_lote seteado
--   (script 19), asi que quedan disponibles para consumo por orden FIFO
--   (creado_en, consecutivo) igual que compras y ajustes de entrada.
--
-- Idempotente (create or replace).
-- ============================================================

create or replace function public.fn_fifo_consumir(
  p_producto_id uuid,
  p_sucursal_id uuid,
  p_cantidad    integer
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock       integer;
  v_pendiente   integer := p_cantidad;
  v_costo_total numeric := 0;
  v_toma        integer;
  v_lote        record;
begin
  -- bloquea la fila de stock de ESA sucursal y valida disponibilidad
  select stock_actual into v_stock
  from public.producto_stock_sucursal
  where producto_id = p_producto_id and sucursal_id = p_sucursal_id
  for update;

  if v_stock is null then
    raise exception 'El producto no tiene stock en esta sucursal';
  end if;
  if v_stock < p_cantidad then
    raise exception 'Stock insuficiente en la sucursal (disponible: %, solicitado: %)', v_stock, p_cantidad;
  end if;

  for v_lote in
    select id, cantidad_restante_lote, costo_unitario
    from public.kardex_movimientos
    where producto_id = p_producto_id
      and sucursal_id = p_sucursal_id
      -- FIX 21: incluir 'entrada_traspaso' (lote generado al recibir un traspaso)
      and tipo_movimiento in ('entrada_compra','ajuste_entrada','entrada_traspaso')
      and cantidad_restante_lote > 0
    order by creado_en asc, consecutivo asc
    for update
  loop
    exit when v_pendiente <= 0;
    v_toma := least(v_lote.cantidad_restante_lote, v_pendiente);
    update public.kardex_movimientos
      set cantidad_restante_lote = cantidad_restante_lote - v_toma
      where id = v_lote.id;
    v_costo_total := v_costo_total + v_toma * v_lote.costo_unitario;
    v_pendiente := v_pendiente - v_toma;
  end loop;

  if v_pendiente > 0 then
    raise exception 'Inconsistencia FIFO en producto % / sucursal %', p_producto_id, p_sucursal_id;
  end if;

  return round(v_costo_total / p_cantidad, 2);
end;
$$;
revoke execute on function public.fn_fifo_consumir(uuid, uuid, integer) from public, anon, authenticated;

-- ============================================================
-- VERIFICACION (correr aparte; no modifica nada)
--
--   -- a) el FIFO ya conoce los lotes de traspaso:
--   select prosrc like '%entrada_traspaso%' as fifo_corregido
--   from pg_proc where proname = 'fn_fifo_consumir';
--   -- Esperado: true
--
--   -- b) productos con stock cacheado pero SIN lotes consumibles suficientes
--   --    (deberia dar 0 filas tras el fix; si hay filas, ese stock nunca se
--   --     podra vender aunque el cache lo muestre disponible):
--   select pss.producto_id, pss.sucursal_id,
--          pss.stock_actual as cache,
--          coalesce(sum(k.cantidad_restante_lote), 0) as lotes_disponibles
--   from public.producto_stock_sucursal pss
--   left join public.kardex_movimientos k
--     on k.producto_id = pss.producto_id
--    and k.sucursal_id = pss.sucursal_id
--    and k.tipo_movimiento in ('entrada_compra','ajuste_entrada','entrada_traspaso')
--    and k.cantidad_restante_lote > 0
--   where pss.stock_actual > 0
--   group by pss.producto_id, pss.sucursal_id, pss.stock_actual
--   having pss.stock_actual <> coalesce(sum(k.cantidad_restante_lote), 0);
--   -- Esperado: 0 filas
-- ============================================================


-- ============================================================================
-- >>> 29_fn_guardar_producto.sql
-- ============================================================================
-- ============================================================
-- SISREP — 29: Guardado transaccional del producto (Sprint 6 · R8 / Q4)
-- Ejecutar en el SQL Editor sobre la base real.
--
-- PROBLEMA (R8): crear/editar un producto hacía varios INSERT/DELETE por HTTP
-- SIN transacción. Si el guardado de hijos fallaba después de borrar los
-- anteriores, el producto quedaba SIN códigos, SIN vehículos y SIN precios por
-- mayor, de forma permanente. Grave porque un producto puede tener 8–10 códigos
-- OEM que salieron de parsear un catálogo. La mitigación mínima (dedup + chequeo
-- de errores) reducía el disparador; ESTO lo cierra del todo.
--
-- SOLUCIÓN: una sola función SECURITY DEFINER que hace TODO en una transacción
-- (cabecera + reemplazo de hijos). Si algo falla, Postgres revierte todo → nunca
-- queda un producto a medias. Es además lo que manda la regla del proyecto
-- ("toda operación crítica pasa por RPC transaccional").
--
-- p_id NULL  => crea el producto.  p_id con valor => lo edita.
-- Devuelve el id del producto.
--
-- NOTA: maneja el esquema ACTUAL de hijos (equivalentes con `fabricante`,
-- vehículos y precios por mayor). Cuando entre la Parte I (códigos originales,
-- medidas, y se elimine `fabricante`), hay que EXTENDER esta función.
--
-- Idempotente (create or replace). notify pgrst al final.
-- ============================================================

create or replace function public.fn_guardar_producto(
  p_id            uuid,
  p_producto      jsonb,
  p_equivalentes  jsonb default '[]'::jsonb,
  p_vehiculos     jsonb default '[]'::jsonb,
  p_precios_mayor jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id          uuid;
  v_item        jsonb;
  v_vehiculo_id uuid;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede guardar productos';
  end if;

  -- ---------- Cabecera (crear o editar) ----------
  if p_id is null then
    insert into public.productos
      (codigo, descripcion, linea_marca, unidad_medida, precio, stock_minimo, imagen_url, creado_por)
    values (
      p_producto->>'codigo',
      p_producto->>'descripcion',
      nullif(p_producto->>'linea_marca', ''),
      p_producto->>'unidad_medida',
      coalesce((p_producto->>'precio')::numeric, 0),
      coalesce((p_producto->>'stock_minimo')::integer, 0),
      nullif(p_producto->>'imagen_url', ''),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.productos set
      codigo        = p_producto->>'codigo',
      descripcion   = p_producto->>'descripcion',
      linea_marca   = nullif(p_producto->>'linea_marca', ''),
      unidad_medida = p_producto->>'unidad_medida',
      precio        = coalesce((p_producto->>'precio')::numeric, 0),
      stock_minimo  = coalesce((p_producto->>'stock_minimo')::integer, 0),
      imagen_url    = nullif(p_producto->>'imagen_url', '')
      -- OJO: NO se toca stock_actual (lo protege el trigger fn_productos_before_update)
    where id = p_id;
    if not found then
      raise exception 'El producto no existe';
    end if;
    v_id := p_id;
  end if;

  -- ---------- Reemplazo de hijos (todo en la misma transacción) ----------
  delete from public.producto_codigos_equivalentes where producto_id = v_id;
  delete from public.producto_vehiculos_compatibles where producto_id = v_id;
  delete from public.producto_precios_mayor where producto_id = v_id;

  -- Códigos equivalentes
  for v_item in select value from jsonb_array_elements(coalesce(p_equivalentes, '[]'::jsonb)) loop
    insert into public.producto_codigos_equivalentes (producto_id, codigo_equivalente, fabricante)
    values (v_id, v_item->>'codigo_equivalente', nullif(v_item->>'fabricante', ''));
  end loop;

  -- Vehículos compatibles (upsert del catálogo + relación)
  for v_item in select value from jsonb_array_elements(coalesce(p_vehiculos, '[]'::jsonb)) loop
    insert into public.vehiculos (marca, modelo)
    values (v_item->>'marca', v_item->>'modelo')
    on conflict (marca, modelo) do update set marca = excluded.marca
    returning id into v_vehiculo_id;

    insert into public.producto_vehiculos_compatibles (producto_id, vehiculo_id, anio_desde, anio_hasta)
    values (
      v_id,
      v_vehiculo_id,
      nullif(v_item->>'anio_desde', '')::integer,
      nullif(v_item->>'anio_hasta', '')::integer
    );
  end loop;

  -- Precios por mayor
  for v_item in select value from jsonb_array_elements(coalesce(p_precios_mayor, '[]'::jsonb)) loop
    insert into public.producto_precios_mayor (producto_id, cantidad_minima, precio, vigente_hasta)
    values (
      v_id,
      (v_item->>'cantidad_minima')::integer,
      (v_item->>'precio')::numeric,
      nullif(v_item->>'vigente_hasta', '')::date
    );
  end loop;

  return v_id;
end;
$$;
revoke execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) la función existe con la firma esperada:
--   select proname, pg_get_function_identity_arguments(oid)
--   from pg_proc where proname = 'fn_guardar_producto';
--   -- b) atomicidad: crear un producto con un código equivalente repetido debe
--   --    FALLAR entero (no crear el producto ni los hijos) — pero la app ya
--   --    deduplica antes, así que en la práctica no llega repetido.
-- ============================================================


-- ============================================================================
-- >>> 22_codigos_originales.sql
-- ============================================================================
-- ============================================================
-- SISREP — 22: Códigos originales (Sprint 6 · Parte I · Fase 1)
-- Ejecutar en el SQL Editor sobre la base real, DESPUÉS del 29.
--
-- ⚠️⚠️ HACER UN SNAPSHOT / BACKUP DE LA BD ANTES DE CORRER ESTE SCRIPT.
-- Es la ÚNICA operación del Sprint 6 que MUEVE datos existentes y DROPEA una
-- columna: mueve las 810 filas de `producto_codigos_equivalentes` (todas OEM mal
-- clasificadas) a la tabla nueva `producto_codigos_originales`, vacía la de
-- equivalentes y elimina la columna `fabricante` (Q1). Es reversible con el insert
-- inverso, pero el snapshot lo cierra sin riesgo.
--
-- Los 3 niveles de código quedan: `productos.codigo` (tienda) · códigos ORIGINALES
-- (OEM, tabla nueva, N) · códigos EQUIVALENTES (otro fabricante, tabla existente, N).
--
-- Incluye la RPC `fn_guardar_producto` REESCRITA: suma `p_originales` y deja de
-- usar `fabricante`. Cambia la firma (de 5 a 6 args) → la app llama la nueva.
--
-- Idempotente: la migración solo corre mientras `fabricante` exista (primera vez).
-- ============================================================

-- ---------- 1. Tabla de códigos originales ----------
create table if not exists public.producto_codigos_originales (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references public.productos(id) on delete cascade,
  codigo_original text not null,
  creado_en       timestamptz not null default now(),
  unique (producto_id, codigo_original)
);
create index if not exists idx_codigos_originales_codigo
  on public.producto_codigos_originales (codigo_original);

alter table public.producto_codigos_originales enable row level security;

drop policy if exists "pco_select_autenticados" on public.producto_codigos_originales;
create policy "pco_select_autenticados" on public.producto_codigos_originales
  for select to authenticated using (true);

drop policy if exists "pco_admin_insert" on public.producto_codigos_originales;
create policy "pco_admin_insert" on public.producto_codigos_originales
  for insert to authenticated with check (public.fn_es_admin());

drop policy if exists "pco_admin_update" on public.producto_codigos_originales;
create policy "pco_admin_update" on public.producto_codigos_originales
  for update to authenticated using (public.fn_es_admin());

drop policy if exists "pco_admin_delete" on public.producto_codigos_originales;
create policy "pco_admin_delete" on public.producto_codigos_originales
  for delete to authenticated using (public.fn_es_admin());

-- ---------- 2. Migración de los 810 (ANTES de borrar `fabricante`) ----------
-- Solo corre mientras `fabricante` exista: así re-correr el script no vuelve a
-- mover equivalentes reales que se hayan cargado después.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'producto_codigos_equivalentes'
      and column_name = 'fabricante'
  ) then
    insert into public.producto_codigos_originales (producto_id, codigo_original)
    select producto_id, codigo_equivalente
    from public.producto_codigos_equivalentes
    on conflict (producto_id, codigo_original) do nothing;

    delete from public.producto_codigos_equivalentes;
  end if;
end $$;

-- ---------- 3. UNIQUE que le faltaba a equivalentes ----------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'producto_codigos_equivalentes_producto_codigo_key'
  ) then
    alter table public.producto_codigos_equivalentes
      add constraint producto_codigos_equivalentes_producto_codigo_key
      unique (producto_id, codigo_equivalente);
  end if;
end $$;

-- ---------- 4. Quitar la columna `fabricante` (Q1) ----------
alter table public.producto_codigos_equivalentes drop column if exists fabricante;

-- ---------- 5. RPC de guardado reescrita: suma originales, sin fabricante ----------
drop function if exists public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb);
create or replace function public.fn_guardar_producto(
  p_id            uuid,
  p_producto      jsonb,
  p_equivalentes  jsonb default '[]'::jsonb,
  p_originales    jsonb default '[]'::jsonb,
  p_vehiculos     jsonb default '[]'::jsonb,
  p_precios_mayor jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id          uuid;
  v_item        jsonb;
  v_vehiculo_id uuid;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede guardar productos';
  end if;

  if p_id is null then
    insert into public.productos
      (codigo, descripcion, linea_marca, unidad_medida, precio, stock_minimo, imagen_url, creado_por)
    values (
      p_producto->>'codigo',
      p_producto->>'descripcion',
      nullif(p_producto->>'linea_marca', ''),
      p_producto->>'unidad_medida',
      coalesce((p_producto->>'precio')::numeric, 0),
      coalesce((p_producto->>'stock_minimo')::integer, 0),
      nullif(p_producto->>'imagen_url', ''),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.productos set
      codigo        = p_producto->>'codigo',
      descripcion   = p_producto->>'descripcion',
      linea_marca   = nullif(p_producto->>'linea_marca', ''),
      unidad_medida = p_producto->>'unidad_medida',
      precio        = coalesce((p_producto->>'precio')::numeric, 0),
      stock_minimo  = coalesce((p_producto->>'stock_minimo')::integer, 0),
      imagen_url    = nullif(p_producto->>'imagen_url', '')
    where id = p_id;
    if not found then
      raise exception 'El producto no existe';
    end if;
    v_id := p_id;
  end if;

  -- Reemplazo de hijos (todo en la misma transacción)
  delete from public.producto_codigos_equivalentes where producto_id = v_id;
  delete from public.producto_codigos_originales where producto_id = v_id;
  delete from public.producto_vehiculos_compatibles where producto_id = v_id;
  delete from public.producto_precios_mayor where producto_id = v_id;

  -- Códigos equivalentes (otro fabricante) — ya sin columna `fabricante`
  for v_item in select value from jsonb_array_elements(coalesce(p_equivalentes, '[]'::jsonb)) loop
    insert into public.producto_codigos_equivalentes (producto_id, codigo_equivalente)
    values (v_id, v_item->>'codigo_equivalente');
  end loop;

  -- Códigos originales (OEM)
  for v_item in select value from jsonb_array_elements(coalesce(p_originales, '[]'::jsonb)) loop
    insert into public.producto_codigos_originales (producto_id, codigo_original)
    values (v_id, v_item->>'codigo_original');
  end loop;

  -- Vehículos compatibles
  for v_item in select value from jsonb_array_elements(coalesce(p_vehiculos, '[]'::jsonb)) loop
    insert into public.vehiculos (marca, modelo)
    values (v_item->>'marca', v_item->>'modelo')
    on conflict (marca, modelo) do update set marca = excluded.marca
    returning id into v_vehiculo_id;

    insert into public.producto_vehiculos_compatibles (producto_id, vehiculo_id, anio_desde, anio_hasta)
    values (
      v_id,
      v_vehiculo_id,
      nullif(v_item->>'anio_desde', '')::integer,
      nullif(v_item->>'anio_hasta', '')::integer
    );
  end loop;

  -- Precios por mayor
  for v_item in select value from jsonb_array_elements(coalesce(p_precios_mayor, '[]'::jsonb)) loop
    insert into public.producto_precios_mayor (producto_id, cantidad_minima, precio, vigente_hasta)
    values (
      v_id,
      (v_item->>'cantidad_minima')::integer,
      (v_item->>'precio')::numeric,
      nullif(v_item->>'vigente_hasta', '')::date
    );
  end loop;

  return v_id;
end;
$$;
revoke execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   select (select count(*) from producto_codigos_originales)   as originales,   -- esperado: 810
--          (select count(*) from producto_codigos_equivalentes) as equivalentes; -- esperado: 0
--   -- la columna fabricante ya no existe:
--   select count(*) from information_schema.columns
--   where table_name='producto_codigos_equivalentes' and column_name='fabricante';  -- 0
-- ============================================================


-- ============================================================================
-- >>> 23_producto_medidas.sql
-- ============================================================================
-- ============================================================
-- SISREP — 23: Medidas estructuradas (Sprint 6 · Parte I · Fase 2)
-- Ejecutar en el SQL Editor DESPUÉS del 22.
--
-- Guarda las medidas del producto etiquetadas y estructuradas (no texto libre):
--   A: 45,40MM   B: 17,00MM
-- La etiqueta es obligatoria (Q2): el usuario siempre pone la letra.
--
-- Suma `p_medidas` a `fn_guardar_producto` (pasa de 6 a 7 args → se dropea la de 6).
-- Requiere el 22 (la RPC de 6 args y la tabla de originales). Idempotente.
-- ============================================================

-- ---------- 1. Tabla de medidas ----------
create table if not exists public.producto_medidas (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  etiqueta    text not null,                       -- 'A', 'B', 'DIÁMETRO', 'LARGO'
  valor       numeric(12,2) not null check (valor > 0),
  unidad      text not null default 'MM',          -- MM, CM, PULG
  orden       smallint not null default 0,         -- para renderizar A antes que B
  unique (producto_id, etiqueta)
);
create index if not exists idx_producto_medidas_producto
  on public.producto_medidas (producto_id);

alter table public.producto_medidas enable row level security;

drop policy if exists "pm_select_autenticados" on public.producto_medidas;
create policy "pm_select_autenticados" on public.producto_medidas
  for select to authenticated using (true);

drop policy if exists "pm_admin_insert" on public.producto_medidas;
create policy "pm_admin_insert" on public.producto_medidas
  for insert to authenticated with check (public.fn_es_admin());

drop policy if exists "pm_admin_update" on public.producto_medidas;
create policy "pm_admin_update" on public.producto_medidas
  for update to authenticated using (public.fn_es_admin());

drop policy if exists "pm_admin_delete" on public.producto_medidas;
create policy "pm_admin_delete" on public.producto_medidas
  for delete to authenticated using (public.fn_es_admin());

-- ---------- 2. fn_guardar_producto: suma p_medidas ----------
drop function if exists public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb);
create or replace function public.fn_guardar_producto(
  p_id            uuid,
  p_producto      jsonb,
  p_equivalentes  jsonb default '[]'::jsonb,
  p_originales    jsonb default '[]'::jsonb,
  p_vehiculos     jsonb default '[]'::jsonb,
  p_precios_mayor jsonb default '[]'::jsonb,
  p_medidas       jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id          uuid;
  v_item        jsonb;
  v_vehiculo_id uuid;
  v_orden       smallint := 0;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede guardar productos';
  end if;

  if p_id is null then
    insert into public.productos
      (codigo, descripcion, linea_marca, unidad_medida, precio, stock_minimo, imagen_url, creado_por)
    values (
      p_producto->>'codigo',
      p_producto->>'descripcion',
      nullif(p_producto->>'linea_marca', ''),
      p_producto->>'unidad_medida',
      coalesce((p_producto->>'precio')::numeric, 0),
      coalesce((p_producto->>'stock_minimo')::integer, 0),
      nullif(p_producto->>'imagen_url', ''),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.productos set
      codigo        = p_producto->>'codigo',
      descripcion   = p_producto->>'descripcion',
      linea_marca   = nullif(p_producto->>'linea_marca', ''),
      unidad_medida = p_producto->>'unidad_medida',
      precio        = coalesce((p_producto->>'precio')::numeric, 0),
      stock_minimo  = coalesce((p_producto->>'stock_minimo')::integer, 0),
      imagen_url    = nullif(p_producto->>'imagen_url', '')
    where id = p_id;
    if not found then
      raise exception 'El producto no existe';
    end if;
    v_id := p_id;
  end if;

  -- Reemplazo de hijos (todo en la misma transacción)
  delete from public.producto_codigos_equivalentes where producto_id = v_id;
  delete from public.producto_codigos_originales where producto_id = v_id;
  delete from public.producto_vehiculos_compatibles where producto_id = v_id;
  delete from public.producto_precios_mayor where producto_id = v_id;
  delete from public.producto_medidas where producto_id = v_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_equivalentes, '[]'::jsonb)) loop
    insert into public.producto_codigos_equivalentes (producto_id, codigo_equivalente)
    values (v_id, v_item->>'codigo_equivalente');
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_originales, '[]'::jsonb)) loop
    insert into public.producto_codigos_originales (producto_id, codigo_original)
    values (v_id, v_item->>'codigo_original');
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_vehiculos, '[]'::jsonb)) loop
    insert into public.vehiculos (marca, modelo)
    values (v_item->>'marca', v_item->>'modelo')
    on conflict (marca, modelo) do update set marca = excluded.marca
    returning id into v_vehiculo_id;

    insert into public.producto_vehiculos_compatibles (producto_id, vehiculo_id, anio_desde, anio_hasta)
    values (
      v_id,
      v_vehiculo_id,
      nullif(v_item->>'anio_desde', '')::integer,
      nullif(v_item->>'anio_hasta', '')::integer
    );
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_precios_mayor, '[]'::jsonb)) loop
    insert into public.producto_precios_mayor (producto_id, cantidad_minima, precio, vigente_hasta)
    values (
      v_id,
      (v_item->>'cantidad_minima')::integer,
      (v_item->>'precio')::numeric,
      nullif(v_item->>'vigente_hasta', '')::date
    );
  end loop;

  -- Medidas (conserva el orden en que llegan del formulario)
  for v_item in select value from jsonb_array_elements(coalesce(p_medidas, '[]'::jsonb)) loop
    insert into public.producto_medidas (producto_id, etiqueta, valor, unidad, orden)
    values (
      v_id,
      v_item->>'etiqueta',
      (v_item->>'valor')::numeric,
      coalesce(nullif(v_item->>'unidad', ''), 'MM'),
      v_orden
    );
    v_orden := v_orden + 1;
  end loop;

  return v_id;
end;
$$;
revoke execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   select column_name from information_schema.columns
--   where table_name = 'producto_medidas';   -- id, producto_id, etiqueta, valor, unidad, orden
-- ============================================================


-- ============================================================================
-- >>> 24_unidades_medida.sql
-- ============================================================================
-- ============================================================
-- SISREP — 24: Catálogo de unidades de medida (Sprint 6 · Parte I · Fase 3)
-- Ejecutar en el SQL Editor DESPUÉS del 22 y 23.
--
-- Crea el catálogo administrable de unidades (Pieza, Docena, Juego…) y una FK
-- opcional en productos. SIN CONVERSIÓN: la unidad es solo un atributo del
-- producto; el stock/kardex/FIFO no se tocan.
--
-- La tabla se crea VACÍA (decisión del cliente): las unidades reales las carga el
-- admin desde el ABM. Por eso `unidad_medida_id` es NULLABLE y NO se borra la
-- columna de texto `productos.unidad_medida` (conviven; la UI lee id ?? texto).
-- La columna de texto se elimina en un paso posterior (3.4), cuando el catálogo
-- esté cargado y asignado.
--
-- Suma `unidad_medida_id` a `fn_guardar_producto` (dentro de p_producto, sin
-- cambiar la firma) e incorpora la GUARDA R1: no se puede cambiar la unidad
-- (texto) de un producto que ya tiene movimientos de kardex.
--
-- Requiere el 22 y el 23. Idempotente.
-- ============================================================

-- ---------- 1. Catálogo de unidades ----------
create table if not exists public.unidades_medida (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,        -- 'PZA','DOC','JGO','PAR','CAJ'
  nombre      text not null,               -- 'Pieza','Docena','Juego'
  abreviatura text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

alter table public.unidades_medida enable row level security;

drop policy if exists "um_select_autenticados" on public.unidades_medida;
create policy "um_select_autenticados" on public.unidades_medida
  for select to authenticated using (true);

drop policy if exists "um_admin_insert" on public.unidades_medida;
create policy "um_admin_insert" on public.unidades_medida
  for insert to authenticated with check (public.fn_es_admin());

drop policy if exists "um_admin_update" on public.unidades_medida;
create policy "um_admin_update" on public.unidades_medida
  for update to authenticated using (public.fn_es_admin());

drop policy if exists "um_admin_delete" on public.unidades_medida;
create policy "um_admin_delete" on public.unidades_medida
  for delete to authenticated using (public.fn_es_admin());

-- ---------- 2. FK en productos (nullable, no borra el texto) ----------
alter table public.productos
  add column if not exists unidad_medida_id uuid references public.unidades_medida(id) on delete restrict;

-- ---------- 3. fn_guardar_producto: unidad_medida_id + guarda R1 ----------
create or replace function public.fn_guardar_producto(
  p_id            uuid,
  p_producto      jsonb,
  p_equivalentes  jsonb default '[]'::jsonb,
  p_originales    jsonb default '[]'::jsonb,
  p_vehiculos     jsonb default '[]'::jsonb,
  p_precios_mayor jsonb default '[]'::jsonb,
  p_medidas       jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id          uuid;
  v_item        jsonb;
  v_vehiculo_id uuid;
  v_orden       smallint := 0;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede guardar productos';
  end if;

  if p_id is null then
    insert into public.productos
      (codigo, descripcion, linea_marca, unidad_medida, unidad_medida_id,
       precio, stock_minimo, imagen_url, creado_por)
    values (
      p_producto->>'codigo',
      p_producto->>'descripcion',
      nullif(p_producto->>'linea_marca', ''),
      p_producto->>'unidad_medida',
      nullif(p_producto->>'unidad_medida_id', '')::uuid,
      coalesce((p_producto->>'precio')::numeric, 0),
      coalesce((p_producto->>'stock_minimo')::integer, 0),
      nullif(p_producto->>'imagen_url', ''),
      auth.uid()
    )
    returning id into v_id;
  else
    -- R1: no cambiar la unidad (texto) de un producto que ya tiene movimientos.
    if exists (select 1 from public.kardex_movimientos where producto_id = p_id)
       and exists (
         select 1 from public.productos
         where id = p_id
           and unidad_medida is distinct from (p_producto->>'unidad_medida')
       ) then
      raise exception 'No se puede cambiar la unidad de un producto que ya tiene movimientos de stock';
    end if;

    update public.productos set
      codigo           = p_producto->>'codigo',
      descripcion      = p_producto->>'descripcion',
      linea_marca      = nullif(p_producto->>'linea_marca', ''),
      unidad_medida    = p_producto->>'unidad_medida',
      unidad_medida_id = nullif(p_producto->>'unidad_medida_id', '')::uuid,
      precio           = coalesce((p_producto->>'precio')::numeric, 0),
      stock_minimo     = coalesce((p_producto->>'stock_minimo')::integer, 0),
      imagen_url       = nullif(p_producto->>'imagen_url', '')
    where id = p_id;
    if not found then
      raise exception 'El producto no existe';
    end if;
    v_id := p_id;
  end if;

  delete from public.producto_codigos_equivalentes where producto_id = v_id;
  delete from public.producto_codigos_originales where producto_id = v_id;
  delete from public.producto_vehiculos_compatibles where producto_id = v_id;
  delete from public.producto_precios_mayor where producto_id = v_id;
  delete from public.producto_medidas where producto_id = v_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_equivalentes, '[]'::jsonb)) loop
    insert into public.producto_codigos_equivalentes (producto_id, codigo_equivalente)
    values (v_id, v_item->>'codigo_equivalente');
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_originales, '[]'::jsonb)) loop
    insert into public.producto_codigos_originales (producto_id, codigo_original)
    values (v_id, v_item->>'codigo_original');
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_vehiculos, '[]'::jsonb)) loop
    insert into public.vehiculos (marca, modelo)
    values (v_item->>'marca', v_item->>'modelo')
    on conflict (marca, modelo) do update set marca = excluded.marca
    returning id into v_vehiculo_id;

    insert into public.producto_vehiculos_compatibles (producto_id, vehiculo_id, anio_desde, anio_hasta)
    values (
      v_id,
      v_vehiculo_id,
      nullif(v_item->>'anio_desde', '')::integer,
      nullif(v_item->>'anio_hasta', '')::integer
    );
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_precios_mayor, '[]'::jsonb)) loop
    insert into public.producto_precios_mayor (producto_id, cantidad_minima, precio, vigente_hasta)
    values (
      v_id,
      (v_item->>'cantidad_minima')::integer,
      (v_item->>'precio')::numeric,
      nullif(v_item->>'vigente_hasta', '')::date
    );
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_medidas, '[]'::jsonb)) loop
    insert into public.producto_medidas (producto_id, etiqueta, valor, unidad, orden)
    values (
      v_id,
      v_item->>'etiqueta',
      (v_item->>'valor')::numeric,
      coalesce(nullif(v_item->>'unidad', ''), 'MM'),
      v_orden
    );
    v_orden := v_orden + 1;
  end loop;

  return v_id;
end;
$$;
revoke execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.fn_guardar_producto(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   select column_name from information_schema.columns
--   where table_name='productos' and column_name='unidad_medida_id';  -- 1 fila
--   select count(*) from public.unidades_medida;  -- 0 (se crea vacía)
-- ============================================================


-- ============================================================================
-- >>> 26_busqueda_unaccent.sql
-- ============================================================================
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


-- ============================================================================
-- >>> 25_busqueda_original_medida.sql
-- ============================================================================
-- ============================================================
-- SISREP — 25: Búsqueda por código original y por medida (Sprint 6 · Parte I · Fase 4)
-- Ejecutar en el SQL Editor DESPUÉS del 22, 23, 24 y 26.
--
-- ⚠️ Se construye SOBRE LA VERSIÓN VIVA de fn_buscar_productos (la del script 26,
-- con `unaccent`, cross-field, ILIKE por token). Los scripts 25 y 26 reescriben
-- la MISMA función: este 25 incluye TODO lo del 26 (unaccent) + los criterios
-- nuevos. Correrlo pisa la del 26 conservando su comportamiento.
--
-- QUÉ SUMA:
--  · Criterios nuevos `'original'` (producto_codigos_originales) y `'medida'`
--    (producto_medidas), con la misma lógica cross-field + unaccent.
--  · R9: `'original'` y `'medida'` entran también en el arreglo por defecto (si no,
--    la búsqueda "en todos los campos" nunca los miraría).
--  · R11: los criterios de tablas hijas pasan de LEFT JOIN + DISTINCT a EXISTS
--    (sin multiplicación de filas ni DISTINCT — más rápido a medida que crece el
--    catálogo). codigo/descripcion/linea_marca van directos sobre productos.
--  · Medida: se compara contra `etiqueta || ' ' || valor || unidad` y se normaliza
--    la coma decimal del usuario (`45,40` → `45.40`).
--
-- Idempotente (create or replace, misma firma). Requiere 22–24 y 26.
-- ============================================================

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

  -- R9: los criterios nuevos entran en el arreglo por defecto (búsqueda "en todos")
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

  -- R11: sin LEFT JOIN ni DISTINCT — las tablas hijas se consultan con EXISTS.
  return query
    select p.*
    from public.productos p
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
          or ('equivalente' = any(v_campos) and exists (
                select 1 from public.producto_codigos_equivalentes e
                where e.producto_id = p.id
                  and extensions.unaccent(e.codigo_equivalente) ilike '%' || extensions.unaccent(tok) || '%'))
          or ('original' = any(v_campos) and exists (
                select 1 from public.producto_codigos_originales o
                where o.producto_id = p.id
                  and extensions.unaccent(o.codigo_original) ilike '%' || extensions.unaccent(tok) || '%'))
          or ('vehiculo' = any(v_campos) and exists (
                select 1 from public.producto_vehiculos_compatibles pvc
                join public.vehiculos v on v.id = pvc.vehiculo_id
                where pvc.producto_id = p.id
                  and (extensions.unaccent(v.marca) ilike '%' || extensions.unaccent(tok) || '%'
                    or extensions.unaccent(v.modelo) ilike '%' || extensions.unaccent(tok) || '%')))
          or ('medida' = any(v_campos) and exists (
                select 1 from public.producto_medidas m
                where m.producto_id = p.id
                  and extensions.unaccent(m.etiqueta || ' ' || m.valor::text || m.unidad)
                      ilike '%' || extensions.unaccent(replace(tok, ',', '.')) || '%'))
        )
      )
    order by p.descripcion;
end;
$$;

revoke execute on function public.fn_buscar_productos(text, text[]) from public, anon;
grant  execute on function public.fn_buscar_productos(text, text[]) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte, DESPUÉS de correr el 22 que carga los 810 originales)
--   -- buscar por un código OEM con el criterio 'original' debe encontrarlo:
--   select codigo from public.fn_buscar_productos('9730025210', array['original']) limit 5;
--   -- buscar una medida (coma o punto) con el criterio 'medida':
--   select codigo from public.fn_buscar_productos('45,40', array['medida']) limit 5;
-- ============================================================


-- ============================================================================
-- >>> 27_proformas_vigencia.sql
-- ============================================================================
-- ============================================================
-- SISREP — 27: Vigencia de proformas (Sprint 6 · Parte IV)
-- Ejecutar en el SQL Editor sobre la base real.
--
-- QUE HACE (decisiones Q20–Q32 del documento del Sprint 6):
--  1. Agrega proformas.revalidada_en: al revisar precios se setea = now() y la
--     proforma vuelve a estar vigente 3 dias mas. Sin esto, una proforma vencida
--     no podria volver a convertirse nunca (el vencimiento se mide desde creado_en,
--     que no cambia al editar).
--  2. plazo_validez_dias: default 3 (Q20) + update RETROACTIVO de las existentes (Q28).
--  3. vista_proformas con TRES estados derivados (Q21):
--       convertida  -> ya se convirtio en venta
--       vencida     -> TOPE DURO: 3 meses desde la creacion (Q30). Gana sobre todo.
--       vigente     -> dentro de los N dias desde creacion o ultima revalidacion
--       pendiente   -> paso el plazo corto pero no los 3 meses: hay que revisar precios
--  4. fn_convertir_proforma_a_venta: RECHAZA si el estado efectivo no es 'vigente'
--     (hoy el bloqueo es SOLO cosmetico en la UI; la RPC convierte una vencida sin
--     protestar porque solo mira estado = 'convertida').
--
-- No borra plazo_validez_dias (lo usa la leyenda P9 del PDF y deja el plazo
-- configurable). Idempotente.
-- ============================================================

-- ---------- 1. Columna de revalidacion ----------
alter table public.proformas
  add column if not exists revalidada_en timestamptz;

-- ---------- 2. Plazo por defecto 3 + retroactivo (Q20, Q28) ----------
alter table public.proformas
  alter column plazo_validez_dias set default 3;

-- R16: NO se toca el plazo de las ya convertidas (su PDF documenta la validez
-- pactada en su momento). Solo aplica a las que aún pueden convertirse.
update public.proformas
set plazo_validez_dias = 3
where plazo_validez_dias is distinct from 3
  and estado <> 'convertida';

-- ---------- 3. Vista con 3 estados ----------
-- Se DROPEA y recrea (no create-or-replace) porque p.* ahora trae una columna
-- nueva (revalidada_en) y eso cambia la posicion de estado_efectivo, que
-- create-or-replace no admite. Los consumidores (lib/reportes.ts y el dashboard)
-- solo leen numero/creado_en/total/estado_efectivo/clientes -> siguen existiendo.
drop view if exists public.vista_proformas;
create view public.vista_proformas
  with (security_invoker = true) as
select
  p.*,
  case
    when p.estado = 'convertida' then 'convertida'
    -- TOPE DURO (Q30): 3 meses desde la creacion. Se evalua primero: gana sobre todo.
    when p.creado_en + interval '3 months' < now() then 'vencida'
    -- vigente: dentro de los N dias desde la creacion o desde la ultima revalidacion
    when coalesce(p.revalidada_en, p.creado_en) + make_interval(days => p.plazo_validez_dias) >= now()
      then 'vigente'
    else 'pendiente'
  end as estado_efectivo
from public.proformas p;

-- ---------- 4. Conversion valida la vigencia (no solo la UI) ----------
create or replace function public.fn_convertir_proforma_a_venta(p_proforma_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proforma record;
  v_items    jsonb;
  v_venta_id uuid;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado o inactivo';
  end if;

  select * into v_proforma from public.proformas
  where id = p_proforma_id for update;

  if not found then
    raise exception 'La proforma no existe';
  end if;

  -- Validacion de estado efectivo (misma regla que vista_proformas). Antes esto
  -- vivia solo en el frontend; ahora la RPC lo hace cumplir.
  if v_proforma.estado = 'convertida' then
    raise exception 'La proforma % ya fue convertida', v_proforma.numero;
  end if;
  if v_proforma.creado_en + interval '3 months' < now() then
    raise exception 'La proforma % esta vencida (mas de 3 meses) y no se puede convertir', v_proforma.numero;
  end if;
  if coalesce(v_proforma.revalidada_en, v_proforma.creado_en)
       + make_interval(days => v_proforma.plazo_validez_dias) < now() then
    raise exception 'La proforma % esta pendiente de revision de precios; revisala antes de convertir', v_proforma.numero;
  end if;

  select jsonb_agg(jsonb_build_object(
           'producto_id',     producto_id,
           'cantidad',        cantidad,
           'precio_unitario', precio_unitario,
           'descuento_tipo',  descuento_tipo,
           'descuento_valor', descuento_valor))
  into v_items
  from public.proforma_items
  where proforma_id = p_proforma_id;

  if v_items is null then
    raise exception 'La proforma no tiene items';
  end if;

  v_venta_id := public.fn_registrar_venta(jsonb_build_object(
    'cliente_id',          v_proforma.cliente_id,
    'proforma_origen_id',  p_proforma_id,
    'sucursal_id',         v_proforma.sucursal_id,
    'descuento_tipo',      v_proforma.descuento_tipo,
    'descuento_valor',     v_proforma.descuento_valor,
    'impuesto_porcentaje', v_proforma.impuesto_porcentaje,
    'items',               v_items
  ));

  update public.proformas
  set estado = 'convertida', venta_id = v_venta_id
  where id = p_proforma_id;

  return v_venta_id;
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) la columna existe:
--   select column_name from information_schema.columns
--   where table_name = 'proformas' and column_name = 'revalidada_en';   -- 1 fila
--
--   -- b) los 3 estados se derivan bien (PRO-0005 / PRO-0010 deberian salir 'pendiente'
--   --    si se crearon hace mas de 3 dias y menos de 3 meses):
--   select numero, creado_en, plazo_validez_dias, revalidada_en, estado, estado_efectivo
--   from public.vista_proformas order by creado_en desc;
--
--   -- c) convertir una 'pendiente' o 'vencida' por SQL debe FALLAR:
--   -- select public.fn_convertir_proforma_a_venta('<id-de-una-pendiente>');
-- ============================================================


-- ============================================================================
-- >>> 28_pedidos_flujo.sql
-- ============================================================================
-- ============================================================
-- SISREP — 28: Rediseño del módulo Pedido (Sprint 6 · Parte III)
-- Ejecutar en el SQL Editor sobre una base que ya corrió 19 y 20.
--
-- CAMBIOS (decisiones Q13–Q19 + huecos H6/H7/H8 del documento):
--  1. Se INVIERTE el flujo: ahora el pedido lo crea la sucursal que NECESITA el
--     producto (DESTINO / solicitante) y elige a qué sucursal le pide (ORIGEN).
--     Las columnas sucursal_origen_id / sucursal_destino_id NO cambian de
--     significado (origen = de donde sale el stock) -> los pedidos históricos
--     siguen siendo válidos, sin migración.
--  2. cantidad_solicitada: lo que pidió el destino. `cantidad` pasa a ser lo que
--     el origen realmente despacha (puede recortarlo, incluso a 0). Trazabilidad
--     "pedí 80, me mandaron 50" (Q15). Se relaja el check de cantidad a >= 0 (Q,
--     micro-detalle 1) y fn_enviar saltea los ítems en 0.
--  3. El origen ajusta cantidades y despacha en UN solo paso (Q13): fn_enviar
--     acepta las cantidades ajustadas.
--  4. Permisos (H7/H8): las 4 RPC validan usuario activo y la sucursal según la
--     matriz: crear = cualquiera activo (destino = su sucursal); despachar =
--     origen o admin; recibir = destino o admin; cancelar = creador o admin.
--
-- Idempotente. notify pgrst al final.
-- ============================================================

-- ---------- 1. cantidad_solicitada + relajar el check ----------
alter table public.pedido_traspaso_items
  add column if not exists cantidad_solicitada integer;

update public.pedido_traspaso_items
set cantidad_solicitada = cantidad
where cantidad_solicitada is null;

alter table public.pedido_traspaso_items
  alter column cantidad_solicitada set not null;

-- lo despachado puede bajar a 0 (= no se manda ese ítem)
alter table public.pedido_traspaso_items
  drop constraint if exists pedido_traspaso_items_cantidad_check;
alter table public.pedido_traspaso_items
  add constraint pedido_traspaso_items_cantidad_check check (cantidad >= 0);

-- lo solicitado siempre es > 0
alter table public.pedido_traspaso_items
  drop constraint if exists pedido_traspaso_items_cantsol_check;
alter table public.pedido_traspaso_items
  add constraint pedido_traspaso_items_cantsol_check check (cantidad_solicitada > 0);

-- ---------- 2. Crear pedido: lo crea el DESTINO, elige el ORIGEN ----------
drop function if exists public.fn_crear_pedido_traspaso(uuid, jsonb, text, uuid);
create or replace function public.fn_crear_pedido_traspaso(
  p_sucursal_origen_id  uuid,          -- a quién le pido (de dónde sale el stock)
  p_items               jsonb,
  p_notas               text default null,
  p_sucursal_destino_id uuid default null  -- por defecto, mi sucursal (solicitante)
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_destino     uuid;
  v_pedido_id   uuid;
  v_item        jsonb;
  v_producto_id uuid;
  v_cantidad    integer;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario inactivo o no autorizado';
  end if;

  v_destino := coalesce(p_sucursal_destino_id, public.fn_mi_sucursal());
  if v_destino is null then
    raise exception 'No se pudo determinar tu sucursal (destino del pedido)';
  end if;
  if p_sucursal_origen_id is null then
    raise exception 'Elegí la sucursal a la que le pedís (origen)';
  end if;
  if p_sucursal_origen_id = v_destino then
    raise exception 'La sucursal de origen y la de destino deben ser distintas';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Incluí al menos un producto en el pedido';
  end if;

  insert into public.pedidos_traspaso (sucursal_origen_id, sucursal_destino_id, creado_por, notas)
  values (p_sucursal_origen_id, v_destino, auth.uid(), p_notas)
  returning id into v_pedido_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::integer;
    if v_producto_id is null or v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Ítem inválido en el pedido';
    end if;
    -- al crear, lo a-despachar arranca igual a lo solicitado; el origen lo ajusta luego
    insert into public.pedido_traspaso_items (pedido_id, producto_id, cantidad, cantidad_solicitada)
    values (v_pedido_id, v_producto_id, v_cantidad, v_cantidad);
  end loop;

  return v_pedido_id;
end;
$$;
revoke execute on function public.fn_crear_pedido_traspaso(uuid, jsonb, text, uuid) from public, anon;
grant  execute on function public.fn_crear_pedido_traspaso(uuid, jsonb, text, uuid) to authenticated;

-- ---------- 3. Enviar: el ORIGEN ajusta cantidades y despacha (1 paso) ----------
create or replace function public.fn_enviar_traspaso(
  p_pedido_id uuid,
  p_items     jsonb default null   -- [{producto_id, cantidad}] cantidades ajustadas; null = tal cual
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido    record;
  v_item      record;
  v_aj        jsonb;
  v_costo     numeric;
  v_enviados  integer := 0;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_pedido from public.pedidos_traspaso where id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe'; end if;
  if v_pedido.estado <> 'pendiente' then
    raise exception 'El pedido debe estar pendiente para despacharse (estado actual: %)', v_pedido.estado;
  end if;

  -- Permiso (H8): solo la sucursal ORIGEN o un admin puede despachar
  if not public.fn_es_admin()
     and public.fn_mi_sucursal() is distinct from v_pedido.sucursal_origen_id then
    raise exception 'Solo la sucursal de origen (o un administrador) puede despachar este pedido';
  end if;

  -- Aplica las cantidades ajustadas por el origen (0 = no despachar ese ítem)
  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for v_aj in select value from jsonb_array_elements(p_items) loop
      update public.pedido_traspaso_items
      set cantidad = greatest(0, coalesce((v_aj->>'cantidad')::integer, 0))
      where pedido_id = p_pedido_id
        and producto_id = (v_aj->>'producto_id')::uuid;
    end loop;
  end if;

  -- Consume FIFO en el origen por cada ítem con cantidad > 0 (saltea los 0)
  for v_item in select * from public.pedido_traspaso_items where pedido_id = p_pedido_id loop
    continue when v_item.cantidad <= 0;
    v_costo := public.fn_fifo_consumir(v_item.producto_id, v_pedido.sucursal_origen_id, v_item.cantidad);

    update public.pedido_traspaso_items
    set costo_fifo_unitario = v_costo
    where id = v_item.id;

    insert into public.kardex_movimientos (
      producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
      referencia_tipo, referencia_id, creado_por
    ) values (
      v_item.producto_id, v_pedido.sucursal_origen_id, 'salida_traspaso', v_item.cantidad, v_costo,
      'traspaso', p_pedido_id, auth.uid()
    );
    v_enviados := v_enviados + 1;
  end loop;

  if v_enviados = 0 then
    raise exception 'No hay cantidades para despachar (todas quedaron en 0)';
  end if;

  update public.pedidos_traspaso
  set estado = 'enviado', fecha_envio = now()
  where id = p_pedido_id;
end;
$$;
revoke execute on function public.fn_enviar_traspaso(uuid, jsonb) from public, anon;
grant  execute on function public.fn_enviar_traspaso(uuid, jsonb) to authenticated;
-- limpia la firma vieja de 1 argumento
drop function if exists public.fn_enviar_traspaso(uuid);

-- ---------- 4. Recibir: permiso destino o admin; saltea los 0 ----------
create or replace function public.fn_recibir_traspaso(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido record;
  v_item   record;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_pedido from public.pedidos_traspaso where id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe'; end if;
  if v_pedido.estado <> 'enviado' then
    raise exception 'El pedido debe estar enviado para recibirse (estado actual: %)', v_pedido.estado;
  end if;

  -- Permiso (H8): solo la sucursal DESTINO o un admin puede recibir
  if not public.fn_es_admin()
     and public.fn_mi_sucursal() is distinct from v_pedido.sucursal_destino_id then
    raise exception 'Solo la sucursal de destino (o un administrador) puede recibir este pedido';
  end if;

  for v_item in select * from public.pedido_traspaso_items where pedido_id = p_pedido_id loop
    continue when v_item.cantidad <= 0;
    insert into public.kardex_movimientos (
      producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
      cantidad_restante_lote, referencia_tipo, referencia_id, creado_por
    ) values (
      v_item.producto_id, v_pedido.sucursal_destino_id, 'entrada_traspaso', v_item.cantidad,
      v_item.costo_fifo_unitario, v_item.cantidad, 'traspaso', p_pedido_id, auth.uid()
    );
  end loop;

  update public.pedidos_traspaso
  set estado = 'recibido', fecha_recepcion = now()
  where id = p_pedido_id;
end;
$$;
revoke execute on function public.fn_recibir_traspaso(uuid) from public, anon;
grant  execute on function public.fn_recibir_traspaso(uuid) to authenticated;

-- ---------- 5. Cancelar: usuario activo (H7) + creador o admin ----------
create or replace function public.fn_cancelar_traspaso(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido record;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_pedido from public.pedidos_traspaso where id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe'; end if;
  if v_pedido.estado <> 'pendiente' then
    raise exception 'Solo se pueden cancelar pedidos en estado pendiente';
  end if;

  -- Permiso: quien lo creó o un admin
  if not public.fn_es_admin() and v_pedido.creado_por is distinct from auth.uid() then
    raise exception 'Solo quien creó el pedido (o un administrador) puede cancelarlo';
  end if;

  update public.pedidos_traspaso set estado = 'cancelado' where id = p_pedido_id;
end;
$$;
revoke execute on function public.fn_cancelar_traspaso(uuid) from public, anon;
grant  execute on function public.fn_cancelar_traspaso(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) la columna existe:
--   select column_name from information_schema.columns
--   where table_name = 'pedido_traspaso_items' and column_name = 'cantidad_solicitada';  -- 1 fila
--
--   -- b) el FIFO/permisos: crear un pedido desde la UI (destino = tu sucursal),
--   --    despachar ajustando una cantidad a menos, recibir, y verificar que
--   --    cantidad_solicitada conserva lo pedido y cantidad lo despachado:
--   select numero, i.producto_id, i.cantidad_solicitada, i.cantidad
--   from public.pedido_traspaso_items i
--   join public.pedidos_traspaso p on p.id = i.pedido_id
--   order by p.creado_en desc limit 20;
-- ============================================================


-- ============================================================================
-- >>> 30_rls_vendedor_sucursal.sql
-- ============================================================================
-- ============================================================
-- SISREP — 30: RLS por sucursal para el vendedor (Sprint 5 · C2 paso 4 · parte B)
-- Ejecutar en el SQL Editor sobre la base real.
--
-- DECISIÓN DEL CLIENTE (27 jul): el VENDEDOR ve solo ventas, proformas y pedidos
-- de SU sucursal. El admin sigue viendo todo. El catálogo de productos y el stock
-- por sucursal (producto_stock_sucursal) NO se restringen: todos los ven para
-- poder decidir traspasos. El kardex tampoco se toca.
--
-- Cómo: se reescriben SOLO las políticas de SELECT de ventas, proformas y
-- pedidos_traspaso (+ sus tablas de ítems), usando fn_es_admin() y fn_mi_sucursal()
-- (ambas SECURITY DEFINER → sin recursión de RLS). Las RPC de movimiento son
-- SECURITY DEFINER y siguen funcionando (saltan RLS), así que crear/convertir/
-- despachar no se ve afectado; solo cambia QUÉ FILAS ve el vendedor al listar.
--
-- NOTA: NO se elimina productos.stock_actual (C2 paso 4 parte A): esa columna la
-- mantiene un trigger, es correcta y quitarla es alto riesgo / bajo valor. Queda
-- como deuda aceptada.
--
-- Idempotente (drop policy if exists + create).
-- ============================================================

-- ---------- proformas ----------
drop policy if exists "proformas_select_autenticados" on public.proformas;
drop policy if exists "proformas_select_por_sucursal" on public.proformas;
create policy "proformas_select_por_sucursal" on public.proformas
  for select to authenticated
  using (public.fn_es_admin() or sucursal_id = public.fn_mi_sucursal());

drop policy if exists "pro_items_select_autenticados" on public.proforma_items;
drop policy if exists "pro_items_select_por_sucursal" on public.proforma_items;
create policy "pro_items_select_por_sucursal" on public.proforma_items
  for select to authenticated
  using (
    public.fn_es_admin()
    or exists (
      select 1 from public.proformas p
      where p.id = proforma_id and p.sucursal_id = public.fn_mi_sucursal()
    )
  );

-- ---------- ventas ----------
drop policy if exists "ventas_select_autenticados" on public.ventas;
drop policy if exists "ventas_select_por_sucursal" on public.ventas;
create policy "ventas_select_por_sucursal" on public.ventas
  for select to authenticated
  using (public.fn_es_admin() or sucursal_id = public.fn_mi_sucursal());

drop policy if exists "venta_items_select_autenticados" on public.venta_items;
drop policy if exists "venta_items_select_por_sucursal" on public.venta_items;
create policy "venta_items_select_por_sucursal" on public.venta_items
  for select to authenticated
  using (
    public.fn_es_admin()
    or exists (
      select 1 from public.ventas v
      where v.id = venta_id and v.sucursal_id = public.fn_mi_sucursal()
    )
  );

-- ---------- pedidos de traspaso (el vendedor participa como ORIGEN o DESTINO) ----------
drop policy if exists "pt_select_autenticados" on public.pedidos_traspaso;
drop policy if exists "pt_select_por_sucursal" on public.pedidos_traspaso;
create policy "pt_select_por_sucursal" on public.pedidos_traspaso
  for select to authenticated
  using (
    public.fn_es_admin()
    or sucursal_origen_id = public.fn_mi_sucursal()
    or sucursal_destino_id = public.fn_mi_sucursal()
  );

drop policy if exists "pti_select_autenticados" on public.pedido_traspaso_items;
drop policy if exists "pti_select_por_sucursal" on public.pedido_traspaso_items;
create policy "pti_select_por_sucursal" on public.pedido_traspaso_items
  for select to authenticated
  using (
    public.fn_es_admin()
    or exists (
      select 1 from public.pedidos_traspaso p
      where p.id = pedido_id
        and (p.sucursal_origen_id = public.fn_mi_sucursal()
          or p.sucursal_destino_id = public.fn_mi_sucursal())
    )
  );

-- ============================================================
-- VERIFICACION (correr aparte). Como admin, debe seguir viendo todo. Para probar
-- el vendedor de verdad hay que iniciar sesión con un usuario vendedor y confirmar
-- que sus listados solo muestran su sucursal. Que las políticas quedaron:
--   select tablename, policyname from pg_policies
--   where policyname like '%_por_sucursal' order by tablename;
--   -- Esperado: 6 filas (proformas, proforma_items, ventas, venta_items,
--   --           pedidos_traspaso, pedido_traspaso_items)
-- ============================================================


-- ============================================================================
-- >>> 31_perfil_sucursal_obligatoria.sql
-- ============================================================================
-- ============================================================
-- SISREP — 31: `perfiles.sucursal_id` obligatoria (cierra el hueco del script 30)
-- Ejecutar en el SQL Editor sobre la base real, DESPUÉS del 30.
--
-- POR QUÉ
-- El script 30 hizo que el vendedor vea solo lo de SU sucursal:
--     using (fn_es_admin() or sucursal_id = fn_mi_sucursal())
-- Si `perfiles.sucursal_id` es null, `fn_mi_sucursal()` devuelve null, la
-- comparación da NULL (no `true`) y ese usuario deja de ver ventas, proformas y
-- pedidos — SIN mensaje de error, con listados vacíos. El catálogo sí se ve, así
-- que la app "parece" funcionar mientras toda su operación está invisible.
--
-- VERIFICADO el 29 jul 2026 simulando la sesión (rol `authenticated` + claims):
--   vendedor de Casa Matriz     -> 12 ventas, 5 proformas, 10 pedidos   ✔ correcto
--   vendedor de Almacén Centro  ->  2 ventas, 0 proformas, 10 pedidos   ✔ correcto
--   el MISMO vendedor con sucursal_id = null -> 0 / 0 / 0, pero 239 productos ← el hueco
--
-- QUÉ HACE
--  1. El trigger de alta de usuarios pasa a resolver una sucursal por defecto
--     cuando el `user_metadata` no trae una (caso típico: usuario invitado desde
--     el panel de Supabase Auth en vez de la pantalla de Configuración, que sí
--     la exige). Si no hay ninguna sucursal activa, falla con un mensaje claro
--     en vez de dejar el perfil a medias.
--  2. Backfill de los perfiles que ya estuvieran en null (al 29 jul: ninguno).
--  3. `not null` en `perfiles.sucursal_id`: vuelve el fallo IMPOSIBLE por
--     construcción, en vez de depender de que nadie se olvide.
--
-- Idempotente. No toca las políticas del 30 (están bien).
-- ============================================================

-- ---------- 1. Trigger con sucursal por defecto ----------
create or replace function public.fn_crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sucursal uuid;
begin
  -- La que venga en el metadata (la pantalla de Configuración siempre la manda).
  v_sucursal := (new.raw_user_meta_data->>'sucursal_id')::uuid;

  -- Si no vino, o apunta a una sucursal que no existe/está inactiva, se usa la
  -- primera sucursal activa por código. Determinista y sin sorpresas.
  if v_sucursal is null
     or not exists (select 1 from public.sucursales where id = v_sucursal and activo) then
    select id into v_sucursal
    from public.sucursales
    where activo
    order by codigo
    limit 1;
  end if;

  -- Antes esto dejaba el perfil con sucursal_id null y el usuario quedaba ciego
  -- para ventas/proformas/pedidos sin saber por qué. Mejor fallar acá y claro.
  if v_sucursal is null then
    raise exception 'No hay ninguna sucursal activa: creá una sucursal antes de dar de alta usuarios';
  end if;

  insert into public.perfiles (id, nombre_completo, rol, sucursal_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre_completo', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'vendedor'),
    v_sucursal
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------- 2. Backfill de los que ya estén en null ----------
update public.perfiles p
set sucursal_id = (select id from public.sucursales where activo order by codigo limit 1)
where p.sucursal_id is null;

-- ---------- 3. Obligatoria de acá en adelante ----------
do $$
begin
  if exists (select 1 from public.perfiles where sucursal_id is null) then
    raise exception 'Quedan perfiles sin sucursal: revisalos antes de aplicar el not null';
  end if;

  alter table public.perfiles alter column sucursal_id set not null;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) la columna es obligatoria:
--   select is_nullable from information_schema.columns
--   where table_name = 'perfiles' and column_name = 'sucursal_id';   -- 'NO'
--
--   -- b) nadie quedó sin sucursal:
--   select count(*) from public.perfiles where sucursal_id is null;  -- 0
--
--   -- c) simular a un vendedor y confirmar que ve lo suyo (adaptar el uuid):
--   begin;
--     set local role authenticated;
--     set local request.jwt.claims = '{"sub":"<uuid-del-vendedor>","role":"authenticated"}';
--     select (select count(*) from public.ventas)    as ventas,
--            (select count(*) from public.proformas) as proformas,
--            (select count(*) from public.productos where activo) as productos;
--   rollback;
--   -- ventas/proformas deben coincidir con las de SU sucursal; productos, con el
--   -- total del catálogo (el catálogo no se restringe).
-- ============================================================


-- ============================================================================
-- >>> 32_precio_venta_en_compra.sql
-- ============================================================================
-- ============================================================
-- SISREP — 32: Precio de venta en la orden de compra
-- Ejecutar en el SQL Editor sobre la base real.
--
-- POR QUÉ
-- Al comprar se define el costo, pero el precio de VENTA se cargaba aparte en la
-- ficha del producto, o directamente no se cargaba. Resultado real: productos
-- comprados a Bs 800 que seguían vendiéndose a Bs 324 (o a 0), sin que nada
-- avisara. La regla del cliente es simple: **el precio de venta tiene que ser
-- mayor al costo de compra**, y el momento natural para fijarlo es cuando se
-- decide el costo, o sea al armar la orden.
--
-- QUÉ HACE
--  1. `orden_compra_items.precio_venta` (nullable por las órdenes históricas).
--  2. Check en la BD: si viene, tiene que ser > costo_unitario. No alcanza con
--     validarlo en la app — es una regla de negocio y va donde no se puede saltear.
--  3. `fn_recibir_orden_compra` aplica ese precio a `productos.precio` AL RECIBIR.
--     No al crear la orden: una orden pendiente se puede cancelar y la mercadería
--     todavía no existe; cambiar el precio antes dejaría vendiendo a un precio
--     que corresponde a stock que nunca llegó.
--
-- Idempotente.
-- ============================================================

-- ---------- 1. Columna ----------
alter table public.orden_compra_items
  add column if not exists precio_venta numeric(12,2);

-- ---------- 2. La regla, en la BD ----------
alter table public.orden_compra_items
  drop constraint if exists orden_compra_items_precio_venta_check;
alter table public.orden_compra_items
  add constraint orden_compra_items_precio_venta_check
  check (precio_venta is null or precio_venta > costo_unitario);

-- ---------- 3. Recepción: aplica el precio de venta ----------
create or replace function public.fn_recibir_orden_compra(p_orden_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden    record;
  v_items    integer;
  v_sucursal uuid;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un administrador puede recibir mercaderia';
  end if;

  select * into v_orden from public.ordenes_compra where id = p_orden_id for update;
  if not found then raise exception 'La orden de compra no existe'; end if;
  if v_orden.estado <> 'pendiente' then
    raise exception 'La orden ya esta en estado: %', v_orden.estado;
  end if;

  -- sucursal destino de la orden; si la orden no la trae (creada antes de este
  -- cambio), cae a la del usuario que recibe.
  v_sucursal := coalesce(v_orden.sucursal_id, public.fn_mi_sucursal());
  if v_sucursal is null then
    raise exception 'No hay sucursal destino para la orden';
  end if;

  insert into public.kardex_movimientos
    (producto_id, sucursal_id, tipo_movimiento, cantidad, costo_unitario,
     cantidad_restante_lote, referencia_tipo, referencia_id, creado_por)
  select i.producto_id, v_sucursal, 'entrada_compra', i.cantidad, i.costo_unitario,
         i.cantidad, 'orden_compra', p_orden_id, auth.uid()
  from public.orden_compra_items i
  where i.orden_compra_id = p_orden_id
  order by i.producto_id;

  get diagnostics v_items = row_count;
  if v_items = 0 then raise exception 'La orden no tiene items'; end if;

  -- Recién ahora, con la mercadería adentro, se actualiza el precio de venta.
  -- Las órdenes viejas no traen precio_venta: a esas no se les toca el precio.
  update public.productos p
  set precio = i.precio_venta
  from public.orden_compra_items i
  where i.orden_compra_id = p_orden_id
    and i.producto_id = p.id
    and i.precio_venta is not null;

  update public.ordenes_compra
  set estado = 'recibida', fecha_recepcion = now()
  where id = p_orden_id;
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) la columna y el check existen:
--   select column_name from information_schema.columns
--   where table_name='orden_compra_items' and column_name='precio_venta';   -- 1 fila
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname='orden_compra_items_precio_venta_check';
--
--   -- b) el check rechaza vender por debajo del costo (debe FALLAR):
--   -- insert into orden_compra_items (orden_compra_id, producto_id, cantidad,
--   --   costo_unitario, precio_venta) values (..., 730, 700);
--
--   -- c) tras recibir una orden, el producto quedó con el precio de la orden:
--   select p.codigo, p.precio, i.precio_venta, i.costo_unitario
--   from orden_compra_items i join productos p on p.id = i.producto_id
--   join ordenes_compra oc on oc.id = i.orden_compra_id
--   where oc.estado = 'recibida' and i.precio_venta is not null
--   order by oc.fecha_recepcion desc limit 10;
-- ============================================================


-- ============================================================================
-- >>> 33_indices_busqueda.sql
-- ============================================================================
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

