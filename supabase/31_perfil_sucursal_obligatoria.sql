-- ============================================================
-- SISREP — 31: `perfiles.sucursal_id` obligatoria (cierra el hueco del script 30)
-- Ejecutar en el SQL Editor sobre la base real, DESPUÉS del 30.
--
-- POR QUÉ
-- El script 30 hizo que el vendedor vea solo lo de SU sucursal:
--     using (fn_es_admin() or sucursal_id = fn_mi_sucursal())
-- Si `perfiles.sucursal_id` es null, `fn_mi_sucursal()` devuelve null, la
-- comparación da NULL (no `true`) y ese usuario deja de ver ventas, proformas y
-- pedidos — SIN mensaje de error, con listados vacíos. El catálogo sí se ve, así
-- que la app "parece" funcionar mientras toda su operación está invisible.
--
-- VERIFICADO el 29 jul 2026 simulando la sesión (rol `authenticated` + claims):
--   vendedor de Casa Matriz     -> 12 ventas, 5 proformas, 10 pedidos   ✔ correcto
--   vendedor de Almacén Centro  ->  2 ventas, 0 proformas, 10 pedidos   ✔ correcto
--   el MISMO vendedor con sucursal_id = null -> 0 / 0 / 0, pero 239 productos ← el hueco
--
-- QUÉ HACE
--  1. El trigger de alta de usuarios pasa a resolver una sucursal por defecto
--     cuando el `user_metadata` no trae una (caso típico: usuario invitado desde
--     el panel de Supabase Auth en vez de la pantalla de Configuración, que sí
--     la exige). Si no hay ninguna sucursal activa, falla con un mensaje claro
--     en vez de dejar el perfil a medias.
--  2. Backfill de los perfiles que ya estuvieran en null (al 29 jul: ninguno).
--  3. `not null` en `perfiles.sucursal_id`: vuelve el fallo IMPOSIBLE por
--     construcción, en vez de depender de que nadie se olvide.
--
-- Idempotente. No toca las políticas del 30 (están bien).
-- ============================================================

-- ---------- 1. Trigger con sucursal por defecto ----------
create or replace function public.fn_crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sucursal uuid;
begin
  -- La que venga en el metadata (la pantalla de Configuración siempre la manda).
  v_sucursal := (new.raw_user_meta_data->>'sucursal_id')::uuid;

  -- Si no vino, o apunta a una sucursal que no existe/está inactiva, se usa la
  -- primera sucursal activa por código. Determinista y sin sorpresas.
  if v_sucursal is null
     or not exists (select 1 from public.sucursales where id = v_sucursal and activo) then
    select id into v_sucursal
    from public.sucursales
    where activo
    order by codigo
    limit 1;
  end if;

  -- Antes esto dejaba el perfil con sucursal_id null y el usuario quedaba ciego
  -- para ventas/proformas/pedidos sin saber por qué. Mejor fallar acá y claro.
  if v_sucursal is null then
    raise exception 'No hay ninguna sucursal activa: creá una sucursal antes de dar de alta usuarios';
  end if;

  insert into public.perfiles (id, nombre_completo, rol, sucursal_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre_completo', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'vendedor'),
    v_sucursal
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------- 2. Backfill de los que ya estén en null ----------
update public.perfiles p
set sucursal_id = (select id from public.sucursales where activo order by codigo limit 1)
where p.sucursal_id is null;

-- ---------- 3. Obligatoria de acá en adelante ----------
do $$
begin
  if exists (select 1 from public.perfiles where sucursal_id is null) then
    raise exception 'Quedan perfiles sin sucursal: revisalos antes de aplicar el not null';
  end if;

  alter table public.perfiles alter column sucursal_id set not null;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICACION (correr aparte)
--   -- a) la columna es obligatoria:
--   select is_nullable from information_schema.columns
--   where table_name = 'perfiles' and column_name = 'sucursal_id';   -- 'NO'
--
--   -- b) nadie quedó sin sucursal:
--   select count(*) from public.perfiles where sucursal_id is null;  -- 0
--
--   -- c) simular a un vendedor y confirmar que ve lo suyo (adaptar el uuid):
--   begin;
--     set local role authenticated;
--     set local request.jwt.claims = '{"sub":"<uuid-del-vendedor>","role":"authenticated"}';
--     select (select count(*) from public.ventas)    as ventas,
--            (select count(*) from public.proformas) as proformas,
--            (select count(*) from public.productos where activo) as productos;
--   rollback;
--   -- ventas/proformas deben coincidir con las de SU sucursal; productos, con el
--   -- total del catálogo (el catálogo no se restringe).
-- ============================================================
