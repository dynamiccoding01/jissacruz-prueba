-- ============================================================
-- SISREP — 36: Tipo de pago en la venta/factura (T8)
-- Ejecutar en el SQL Editor sobre la base real (dev y prod). Idempotente.
--
-- QUÉ HACE:
--   1. Agrega la columna `ventas.tipo_pago` (texto, opcional).
--   2. Reescribe fn_registrar_venta para que lea 'tipo_pago' del JSON y lo guarde.
--      Es IDÉNTICA a la versión vigente (la del consolidado): el ÚNICO cambio es
--      que el `insert into ventas` suma la columna tipo_pago. El resto (FIFO,
--      kardex, totales, validaciones) no se toca.
--
-- La lista de opciones (Efectivo, QR, Transferencia, Tarjeta, Crédito) vive en
-- el front (lib/tipos-pago.ts); acá se guarda el texto elegido tal cual.
-- ============================================================

alter table public.ventas
  add column if not exists tipo_pago text;

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
     impuesto_porcentaje, vendido_por, sucursal_id, tipo_pago)
  values (
    (p_venta->>'cliente_id')::uuid,
    (p_venta->>'proforma_origen_id')::uuid,
    p_venta->>'descuento_tipo',
    coalesce((p_venta->>'descuento_valor')::numeric, 0),
    v_impuesto,
    auth.uid(),
    v_sucursal,
    nullif(p_venta->>'tipo_pago', '')
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
