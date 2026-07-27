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
