-- ============================================================
-- SISREP — 41: Precio mínimo y sin descuentos en Proforma y POS (PLAN_6 · T1 + T2)
-- Ejecutar en el SQL Editor sobre AMBAS bases (dev y prod). Idempotente.
-- Requiere el 40 (ventas_pendientes / fn_crear_venta_pendiente).
--
-- QUÉ HACE:
--   T1: las proformas ya no llevan descuentos (ni global ni por línea).
--   T2: el precio unitario no puede quedar por debajo del precio del sistema
--       para esa cantidad: el precio por mayor VIGENTE de la escala alcanzada,
--       o el precio normal del producto (misma regla que precioSegunCantidad
--       en lib/precios-mayor.ts). Se puede subir, nunca bajar.
--       Aplica a proforma_items y a los pedidos del POS (fn_crear_venta_pendiente),
--       que además deja de aceptar descuentos.
--
--   NO toca filas viejas: los checks corren al INSERTAR (o al cambiar precio,
--   cantidad o descuento). Convertir/revalidar proformas viejas con descuento
--   sigue funcionando. Cotización S/F y fn_registrar_venta NO cambian.
-- ============================================================

-- ---------- 1. Precio mínimo por producto y cantidad ----------
create or replace function public.fn_precio_minimo(p_producto_id uuid, p_cantidad integer)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pm.precio
       from public.producto_precios_mayor pm
      where pm.producto_id = p_producto_id
        and pm.cantidad_minima <= p_cantidad
        and (pm.vigente_hasta is null or pm.vigente_hasta >= current_date)
      order by pm.cantidad_minima desc
      limit 1),
    (select p.precio from public.productos p where p.id = p_producto_id),
    0
  );
$$;
revoke execute on function public.fn_precio_minimo(uuid, integer) from public, anon;
grant  execute on function public.fn_precio_minimo(uuid, integer) to authenticated;

-- ---------- 2. Líneas de proforma: sin descuento y con precio mínimo ----------
-- Mismo trigger del script 02 (trg_proforma_items_validar), con los checks nuevos.
create or replace function public.fn_proforma_items_validar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_subtotal numeric;
  v_revisar  boolean;
  v_minimo   numeric;
  v_codigo   text;
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
    select codigo into v_codigo from public.productos where id = new.producto_id;
    if new.precio_unitario <= 0 then
      raise exception 'El producto % no tiene precio', v_codigo;
    end if;
    v_minimo := public.fn_precio_minimo(new.producto_id, new.cantidad);
    if round(new.precio_unitario, 2) < round(v_minimo, 2) then
      raise exception 'El precio de % no puede ser menor a Bs % (precio del sistema)',
        v_codigo, round(v_minimo, 2);
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

-- ---------- 3. Cabecera de proforma: sin descuento global ----------
-- Solo dispara al insertar o cuando el UPDATE toca las columnas de descuento
-- (convertir/revalidar no las tocan, así que las viejas siguen funcionando).
create or replace function public.fn_proformas_sin_descuento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.descuento_valor, 0) > 0 then
    raise exception 'Las proformas ya no admiten descuento global';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proformas_sin_descuento on public.proformas;
create trigger trg_proformas_sin_descuento
  before insert or update of descuento_tipo, descuento_valor on public.proformas
  for each row execute function public.fn_proformas_sin_descuento();

-- ---------- 4. POS: pedido pendiente sin descuentos y con precio mínimo ----------
-- Misma función del script 40, con los checks de PLAN_6.
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

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) precio mínimo de un producto (cambiar el código):
--   select p.codigo, p.precio, public.fn_precio_minimo(p.id, 1) as min_1u,
--          public.fn_precio_minimo(p.id, 100) as min_100u
--   from public.productos p where p.codigo = 'XXXX';
--   -- b) el trigger nuevo existe:
--   select tgname from pg_trigger where tgname = 'trg_proformas_sin_descuento';   -- 1 fila
-- ============================================================
