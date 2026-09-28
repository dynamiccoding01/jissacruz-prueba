-- ============================================================
-- SISREP — 42: Resumen de rentabilidad para el dashboard (PLAN_6 · T3)
-- Ejecutar en el SQL Editor sobre AMBAS bases (dev y prod). Idempotente.
--
-- QUÉ HACE:
--   RPC fn_resumen_rentabilidad(p_periodo) — SOLO ADMIN — que suma en la base
--   (sin el tope de 1000 filas de la API) las ventas del período:
--     ingresos        = total de las ventas SIN impuesto: total / (1 + impuesto%)
--     costo_ventas    = cantidad × costo_fifo_unitario de cada línea vendida
--                       (el costo real de compra, por FIFO, que ya guarda la venta)
--     utilidad_bruta  = ingresos − costo_ventas
--     lineas_sin_costo= líneas vendidas con costo 0 (p. ej. stock cargado por
--                       ajuste sin costo): si hay, la utilidad está inflada.
--   p_periodo: 'hoy' | 'mes' | 'anio'. Los cortes se calculan en HORA DE BOLIVIA
--   (America/La_Paz), no en la del servidor (UTC).
-- ============================================================

create or replace function public.fn_resumen_rentabilidad(p_periodo text)
returns table (
  desde            timestamptz,
  hasta            timestamptz,
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
declare
  v_hoy_local date := (now() at time zone 'America/La_Paz')::date;
  v_inicio    date;
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
  desde := v_inicio::timestamp at time zone 'America/La_Paz';
  hasta := now();

  select count(*)::integer,
         coalesce(sum(round(v.total / (1 + v.impuesto_porcentaje / 100), 2)), 0)
    into cantidad_ventas, ingresos
  from public.ventas v
  where v.creado_en >= desde and v.creado_en <= hasta;

  select coalesce(sum(round(vi.cantidad * vi.costo_fifo_unitario, 2)), 0),
         (count(*) filter (where vi.costo_fifo_unitario = 0))::integer
    into costo_ventas, lineas_sin_costo
  from public.venta_items vi
  join public.ventas v on v.id = vi.venta_id
  where v.creado_en >= desde and v.creado_en <= hasta;

  utilidad_bruta := ingresos - costo_ventas;
  return next;
end;
$$;
revoke execute on function public.fn_resumen_rentabilidad(text) from public, anon;
grant  execute on function public.fn_resumen_rentabilidad(text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte, logueado como admin desde la app; en el SQL
-- Editor fn_es_admin() da false porque no hay sesión de usuario)
--   -- a) la función existe:
--   select proname from pg_proc where proname = 'fn_resumen_rentabilidad';   -- 1 fila
--   -- b) cruce manual del mes (sin el chequeo de admin):
--   select sum(round(v.total / (1 + v.impuesto_porcentaje / 100), 2)) as ingresos
--   from public.ventas v
--   where v.creado_en >= date_trunc('month', now() at time zone 'America/La_Paz')
--                        at time zone 'America/La_Paz';
-- ============================================================
