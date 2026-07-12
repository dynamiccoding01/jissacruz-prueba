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
