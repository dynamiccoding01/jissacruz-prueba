-- ============================================================
-- SISREP — 43: Ganancias separadas con factura / sin factura (PLAN_6 · T4)
-- Ejecutar en el SQL Editor sobre AMBAS bases (dev y prod). Idempotente.
-- Requiere 37 (con_factura), 40 (ventas_pendientes) y 41 (precio mínimo).
--
-- QUÉ HACE:
--   Criterio (decisión del cliente): una venta es "con factura" o "sin factura"
--   según se haya emitido factura (ventas.con_factura). Nunca se suman juntas.
--   Para que esa separación sea confiable:
--   1. Un producto S/F (productos.con_factura = false) NUNCA se vende con factura:
--      fn_registrar_venta lo rechaza, y si el payload no trae con_factura lo
--      DERIVA de los productos (así la conversión de proformas deja de salir
--      siempre "con factura").
--   2. No se mezclan tipos: un pedido del POS (fn_crear_venta_pendiente) y una
--      proforma (trigger de proforma_items) son todo con factura o todo S/F.
--   3. RPC fn_rentabilidad_por_factura(p_periodo): dashboard, 2 filas fijas.
--   4. RPC fn_reporte_rentabilidad(p_desde, p_hasta, p_agrupacion): reporte.
--   Ambas SOLO ADMIN, sumadas en SQL y con cortes en hora de Bolivia.
--   fn_resumen_rentabilidad (script 42) queda sin uso; se puede borrar después.
-- ============================================================

-- ---------- 1. fn_registrar_venta: S/F nunca con factura ----------
-- Idéntica a la del script 37 salvo el bloque "PLAN_6 · T4".
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
  v_hay_sf      boolean;
  v_con_factura boolean;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado o inactivo';
  end if;
  if p_venta->'items' is null or jsonb_typeof(p_venta->'items') <> 'array'
     or jsonb_array_length(p_venta->'items') = 0 then
    raise exception 'La venta debe tener al menos un item';
  end if;

  -- PLAN_6 · T4: un producto S/F no se vende con factura. Si no viene el dato,
  -- se deriva: con factura salvo que haya algún producto S/F.
  select exists (
    select 1
    from jsonb_array_elements(p_venta->'items') e
    join public.productos p on p.id = (e.value->>'producto_id')::uuid
    where not p.con_factura
  ) into v_hay_sf;
  v_con_factura := coalesce((p_venta->>'con_factura')::boolean, not v_hay_sf);
  if v_con_factura and v_hay_sf then
    raise exception 'Un producto sin factura (S/F) no se puede vender con factura';
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
    v_con_factura
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

-- ---------- 2. POS: un pedido no mezcla con factura y S/F ----------
-- Idéntica a la del script 41 salvo el bloque "PLAN_6 · T4".
create or replace function public.fn_crear_venta_pendiente(p_pedido jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id          uuid;
  v_item        jsonb;
  v_pid         uuid;
  v_cant        integer;
  v_precio      numeric;
  v_minimo      numeric;
  v_codigo      text;
  v_linea       numeric;
  v_subtotal    numeric := 0;
  v_imp         numeric;
  v_sucursal    uuid;
  v_tipos       integer;
begin
  if not public.fn_es_usuario_activo() then
    raise exception 'Usuario no autorizado o inactivo';
  end if;
  if p_pedido->'items' is null or jsonb_typeof(p_pedido->'items') <> 'array'
     or jsonb_array_length(p_pedido->'items') = 0 then
    raise exception 'El pedido debe tener al menos un item';
  end if;
  if coalesce((p_pedido->>'descuento_valor')::numeric, 0) > 0 then
    raise exception 'El punto de venta no admite descuentos';
  end if;

  -- PLAN_6 · T4: todo con factura o todo S/F.
  select count(distinct p.con_factura) into v_tipos
  from jsonb_array_elements(p_pedido->'items') e
  join public.productos p on p.id = (e.value->>'producto_id')::uuid;
  if v_tipos > 1 then
    raise exception 'Un pedido no puede mezclar productos con factura y sin factura (S/F)';
  end if;

  v_sucursal := coalesce((p_pedido->>'sucursal_id')::uuid, public.fn_mi_sucursal());
  if v_sucursal is null then
    raise exception 'Tu usuario no tiene una sucursal asignada';
  end if;
  v_imp := coalesce((p_pedido->>'impuesto_porcentaje')::numeric, 0);

  insert into public.ventas_pendientes
    (cliente_id, descuento_tipo, descuento_valor, impuesto_porcentaje, creado_por, sucursal_id)
  values (
    (p_pedido->>'cliente_id')::uuid,
    null,
    0,
    v_imp,
    auth.uid(),
    v_sucursal
  )
  returning id into v_id;

  for v_item in select value from jsonb_array_elements(p_pedido->'items') loop
    v_pid    := (v_item->>'producto_id')::uuid;
    v_cant   := (v_item->>'cantidad')::integer;
    v_precio := (v_item->>'precio_unitario')::numeric;

    if v_pid is null or v_cant is null or v_cant <= 0 or v_precio is null or v_precio < 0 then
      raise exception 'Item invalido: %', v_item;
    end if;
    if coalesce((v_item->>'descuento_valor')::numeric, 0) > 0 then
      raise exception 'El punto de venta no admite descuentos';
    end if;

    select codigo into v_codigo from public.productos where id = v_pid;
    if v_precio <= 0 then
      raise exception 'El producto % no tiene precio', v_codigo;
    end if;
    v_minimo := public.fn_precio_minimo(v_pid, v_cant);
    if round(v_precio, 2) < round(v_minimo, 2) then
      raise exception 'El precio de % no puede ser menor a Bs % (precio del sistema)',
        v_codigo, round(v_minimo, 2);
    end if;

    v_linea := round(v_cant * v_precio, 2);

    insert into public.venta_pendiente_items
      (pendiente_id, producto_id, cantidad, precio_unitario, descuento_tipo, descuento_valor, subtotal_linea)
    values (v_id, v_pid, v_cant, v_precio, null, 0, v_linea);

    v_subtotal := v_subtotal + v_linea;
  end loop;

  update public.ventas_pendientes
  set subtotal = v_subtotal,
      total    = round(v_subtotal * (1 + v_imp / 100), 2)
  where id = v_id;

  return v_id;
end;
$$;
revoke execute on function public.fn_crear_venta_pendiente(jsonb) from public, anon;
grant  execute on function public.fn_crear_venta_pendiente(jsonb) to authenticated;

-- ---------- 3. Proforma: tampoco mezcla con factura y S/F ----------
-- Idéntica a la del script 41 salvo el bloque "PLAN_6 · T4". En un insert de
-- varias filas, las filas ya procesadas del mismo insert son visibles acá, así
-- que una proforma mezclada se rechaza aunque llegue en un solo insert.
create or replace function public.fn_proforma_items_validar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_subtotal     numeric;
  v_revisar      boolean;
  v_minimo       numeric;
  v_codigo       text;
  v_con_factura  boolean;
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

  -- PLAN_6: solo filas nuevas o cambios de precio/cantidad/descuento (las
  -- proformas históricas no se revalidan solas).
  if tg_op = 'INSERT' then
    v_revisar := true;
  else
    v_revisar := new.precio_unitario is distinct from old.precio_unitario
              or new.cantidad        is distinct from old.cantidad
              or new.descuento_valor is distinct from old.descuento_valor
              or new.descuento_tipo  is distinct from old.descuento_tipo;
  end if;

  if v_revisar then
    if coalesce(new.descuento_valor, 0) > 0 then
      raise exception 'Las proformas ya no admiten descuentos';
    end if;
    select codigo, con_factura into v_codigo, v_con_factura
    from public.productos where id = new.producto_id;
    if new.precio_unitario <= 0 then
      raise exception 'El producto % no tiene precio', v_codigo;
    end if;
    v_minimo := public.fn_precio_minimo(new.producto_id, new.cantidad);
    if round(new.precio_unitario, 2) < round(v_minimo, 2) then
      raise exception 'El precio de % no puede ser menor a Bs % (precio del sistema)',
        v_codigo, round(v_minimo, 2);
    end if;
  end if;

  -- PLAN_6 · T4: una proforma es toda con factura o toda S/F (solo al insertar).
  if tg_op = 'INSERT' then
    if v_con_factura is null then
      select con_factura into v_con_factura from public.productos where id = new.producto_id;
    end if;
    if exists (
      select 1
      from public.proforma_items pi
      join public.productos p on p.id = pi.producto_id
      where pi.proforma_id = new.proforma_id
        and pi.id <> new.id
        and p.con_factura <> v_con_factura
    ) then
      raise exception 'Una proforma no puede mezclar productos con factura y sin factura (S/F)';
    end if;
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

-- ---------- 4. Dashboard: rentabilidad del período, una fila por tipo ----------
-- Devuelve SIEMPRE 2 filas (con_factura true y false), aunque alguna esté en 0.
create or replace function public.fn_rentabilidad_por_factura(p_periodo text)
returns table (
  con_factura      boolean,
  desde            timestamptz,
  cantidad_ventas  integer,
  ingresos         numeric,
  costo_ventas     numeric,
  utilidad_bruta   numeric,
  lineas_sin_costo integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_hoy_local date := (now() at time zone 'America/La_Paz')::date;
  v_inicio    date;
  v_desde     timestamptz;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo el administrador puede ver la rentabilidad';
  end if;

  v_inicio := case p_periodo
    when 'hoy'  then v_hoy_local
    when 'mes'  then date_trunc('month', v_hoy_local::timestamp)::date
    when 'anio' then date_trunc('year',  v_hoy_local::timestamp)::date
  end;
  if v_inicio is null then
    raise exception 'Periodo invalido: % (use hoy, mes o anio)', p_periodo;
  end if;
  -- medianoche de Bolivia del día de inicio, como instante absoluto
  v_desde := v_inicio::timestamp at time zone 'America/La_Paz';

  return query
  with tipos(cf) as (values (true), (false)),
  vta as (
    select v.id, v.con_factura as cf,
           round(v.total / (1 + v.impuesto_porcentaje / 100), 2) as ingreso
    from public.ventas v
    where v.creado_en >= v_desde and v.creado_en <= now()
  ),
  cst as (
    select vi.venta_id,
           sum(round(vi.cantidad * vi.costo_fifo_unitario, 2)) as costo,
           count(*) filter (where vi.costo_fifo_unitario = 0) as sin_costo
    from public.venta_items vi
    join vta on vta.id = vi.venta_id
    group by vi.venta_id
  )
  select t.cf,
         v_desde,
         count(vta.id)::integer,
         coalesce(sum(vta.ingreso), 0),
         coalesce(sum(cst.costo), 0),
         coalesce(sum(vta.ingreso), 0) - coalesce(sum(cst.costo), 0),
         coalesce(sum(cst.sin_costo), 0)::integer
  from tipos t
  left join vta on vta.cf = t.cf
  left join cst on cst.venta_id = vta.id
  group by t.cf
  order by t.cf desc;
end;
$$;
revoke execute on function public.fn_rentabilidad_por_factura(text) from public, anon;
grant  execute on function public.fn_rentabilidad_por_factura(text) to authenticated;

-- ---------- 5. Reporte: rentabilidad por período y tipo de factura ----------
-- p_desde / p_hasta: fechas de Bolivia (ambas inclusive).
-- p_agrupacion: 'diario' | 'semanal' (lunes) | 'mensual'.
-- Una fila por (período, con_factura) con ventas; los períodos sin ventas no salen.
create or replace function public.fn_reporte_rentabilidad(
  p_desde date,
  p_hasta date,
  p_agrupacion text
)
returns table (
  periodo          date,
  con_factura      boolean,
  cantidad_ventas  integer,
  ingresos         numeric,
  costo_ventas     numeric,
  lineas_sin_costo integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.fn_es_admin() then
    raise exception 'Solo el administrador puede ver la rentabilidad';
  end if;
  if p_agrupacion not in ('diario', 'semanal', 'mensual') then
    raise exception 'Agrupacion invalida: % (use diario, semanal o mensual)', p_agrupacion;
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Rango de fechas invalido';
  end if;

  return query
  with vta as (
    select v.id, v.con_factura as cf,
           round(v.total / (1 + v.impuesto_porcentaje / 100), 2) as ingreso,
           case p_agrupacion
             when 'mensual' then date_trunc('month', v.creado_en at time zone 'America/La_Paz')::date
             when 'semanal' then date_trunc('week',  v.creado_en at time zone 'America/La_Paz')::date
             else (v.creado_en at time zone 'America/La_Paz')::date
           end as per
    from public.ventas v
    where v.creado_en >= (p_desde::timestamp at time zone 'America/La_Paz')
      and v.creado_en <  ((p_hasta + 1)::timestamp at time zone 'America/La_Paz')
  ),
  cst as (
    select vi.venta_id,
           sum(round(vi.cantidad * vi.costo_fifo_unitario, 2)) as costo,
           count(*) filter (where vi.costo_fifo_unitario = 0) as sin_costo
    from public.venta_items vi
    join vta on vta.id = vi.venta_id
    group by vi.venta_id
  )
  select vta.per,
         vta.cf,
         count(vta.id)::integer,
         sum(vta.ingreso),
         coalesce(sum(cst.costo), 0),
         coalesce(sum(cst.sin_costo), 0)::integer
  from vta
  left join cst on cst.venta_id = vta.id
  group by vta.per, vta.cf
  order by vta.per, vta.cf desc;
end;
$$;
revoke execute on function public.fn_reporte_rentabilidad(date, date, text) from public, anon;
grant  execute on function public.fn_reporte_rentabilidad(date, date, text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) las funciones nuevas existen:
--   select proname from pg_proc
--   where proname in ('fn_rentabilidad_por_factura', 'fn_reporte_rentabilidad');   -- 2 filas
--   -- b) historial consistente (debe dar 0 filas: ventas CON factura con productos S/F):
--   select v.numero from public.ventas v
--   where v.con_factura and exists (
--     select 1 from public.venta_items vi join public.productos p on p.id = vi.producto_id
--     where vi.venta_id = v.id and not p.con_factura);
-- ============================================================
