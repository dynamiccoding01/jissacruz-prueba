-- ============================================================
-- SISREP — Setup completo de base de datos (00 = 01+02+03+04+05)
-- Pegar este archivo COMPLETO en el SQL Editor de Supabase y
-- ejecutarlo de un solo saque, en un proyecto nuevo/vacio.
--
-- Que hace, en orden:
--   1) Tablas (15) + vista de proformas
--   2) Secuencias + triggers (numeracion, cache de stock, validaciones)
--   3) Funciones RPC transaccionales (venta, compra, ajuste de stock)
--   4) Row Level Security + politicas por rol
--   5) Indices + buckets de Storage
--
-- Despues de correr esto, los pasos manuales que faltan son:
--   a) Crear un usuario ADMIN de prueba en Authentication (user_metadata
--      {"rol":"admin"}) y correr 06_verificacion.sql
--   b) Crear un usuario VENDEDOR de prueba (user_metadata {"rol":"vendedor"})
--      y correr 08_verificacion_rls_vendedor.sql
-- Ver supabase/README.md para el detalle de cada paso.
--
-- NO ejecutar 07_fix_fifo_desempate.sql: es un parche para bases viejas,
-- este setup ya incluye esa correccion desde el principio.
-- ============================================================


-- ============================================================
-- 1) TABLAS
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


-- ============================================================
-- 2) SECUENCIAS Y TRIGGERS
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


-- ============================================================
-- 3) FUNCIONES RPC TRANSACCIONALES
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

-- ---------- Busqueda avanzada de productos (Fase 3) ----------
-- Busca por: codigo, descripcion (texto completo, prefijo por palabra),
-- linea/marca, codigo equivalente, marca/modelo de vehiculo compatible.
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

  v_clean := regexp_replace(p_query, '[&|!():*'']', ' ', 'g');
  v_clean := btrim(regexp_replace(v_clean, '\s+', ' ', 'g'));

  if v_clean = '' then
    return query select * from public.productos where activo order by descripcion;
    return;
  end if;

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


-- ============================================================
-- 4) ROW LEVEL SECURITY Y POLITICAS
-- ============================================================
-- Modelo de seguridad:
--   * anon (clave publica sin login): CERO acceso a datos.
--   * authenticated + rol vendedor: opera POS, proformas, clientes;
--     solo lectura de catalogo e inventario.
--   * authenticated + rol admin: todo.
--   * ventas y kardex NO tienen politicas de escritura: solo se
--     escriben via funciones RPC (SECURITY DEFINER).

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


-- ============================================================
-- 5) INDICES Y STORAGE
-- ============================================================

-- ---------- Indices ----------
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

-- ============================================================
-- FIN — si no hubo errores, la base esta lista.
-- ============================================================
do $$
begin
  raise notice 'SISREP: setup completo OK (15 tablas + 1 vista, RPC, RLS, indices, storage).';
end;
$$;
