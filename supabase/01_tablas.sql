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
