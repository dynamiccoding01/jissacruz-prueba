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

update public.proformas
set plazo_validez_dias = 3
where plazo_validez_dias is distinct from 3;

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
