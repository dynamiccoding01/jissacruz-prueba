-- ============================================================
-- SISREP — 37: Con/Sin factura (S/F) en productos y ventas (T6/T7/T10)
-- Ejecutar en el SQL Editor sobre la base real (dev y prod). Idempotente.
-- Requiere el 36 (esta versión de fn_registrar_venta incluye también tipo_pago).
--
-- QUÉ HACE:
--   1. `productos.con_factura`  boolean not null default true  (marca "S/F" cuando false)
--   2. `ventas.con_factura`     boolean not null default true  (condición de la venta)
--   3. fn_guardar_producto: lee 'con_factura' del JSON y lo guarda (insert y update).
--   4. fn_registrar_venta: lee 'con_factura' del JSON y lo guarda (mantiene 'tipo_pago').
--   Ambas funciones son IDÉNTICAS a la versión vigente salvo el agregado de con_factura.
-- ============================================================

alter table public.productos
  add column if not exists con_factura boolean not null default true;

alter table public.ventas
  add column if not exists con_factura boolean not null default true;

-- ---------- fn_guardar_producto (+ con_factura) ----------
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
       precio, stock_minimo, imagen_url, con_factura, creado_por)
    values (
      p_producto->>'codigo',
      p_producto->>'descripcion',
      nullif(p_producto->>'linea_marca', ''),
      p_producto->>'unidad_medida',
      nullif(p_producto->>'unidad_medida_id', '')::uuid,
      coalesce((p_producto->>'precio')::numeric, 0),
      coalesce((p_producto->>'stock_minimo')::integer, 0),
      nullif(p_producto->>'imagen_url', ''),
      coalesce((p_producto->>'con_factura')::boolean, true),
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
      imagen_url       = nullif(p_producto->>'imagen_url', ''),
      con_factura      = coalesce((p_producto->>'con_factura')::boolean, true)
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

-- ---------- fn_registrar_venta (+ con_factura, conserva tipo_pago del 36) ----------
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
     impuesto_porcentaje, vendido_por, sucursal_id, tipo_pago, con_factura)
  values (
    (p_venta->>'cliente_id')::uuid,
    (p_venta->>'proforma_origen_id')::uuid,
    p_venta->>'descuento_tipo',
    coalesce((p_venta->>'descuento_valor')::numeric, 0),
    v_impuesto,
    auth.uid(),
    v_sucursal,
    nullif(p_venta->>'tipo_pago', ''),
    coalesce((p_venta->>'con_factura')::boolean, true)
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

notify pgrst, 'reload schema';
