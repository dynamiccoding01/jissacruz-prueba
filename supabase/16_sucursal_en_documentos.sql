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
