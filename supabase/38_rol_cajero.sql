-- ============================================================
-- SISREP — 38: Rol "cajero" (T12)
-- Ejecutar en el SQL Editor sobre la base real (dev y prod). Idempotente.
--
-- T12 (Flujo B): el cajero es el único rol (junto con admin) que cierra/cobra
-- ventas en el POS. Acá SOLO se habilita el rol en el check de perfiles.rol; el
-- resto del control (nav, guarda de la página /ventas y de registrarVenta) vive
-- en el front. No hace falta tocar RLS: fn_registrar_venta corre como
-- security definer (valida usuario activo) y la política de select de ventas ya
-- es por sucursal (fn_es_admin() or sucursal_id = fn_mi_sucursal()).
--
-- Crear un usuario cajero: desde Supabase Auth, con
--   user_metadata = { "rol": "cajero", "sucursal_id": "<uuid-de-su-sucursal>" }
-- El trigger on_auth_user_created crea la fila en perfiles con ese rol y sucursal.
-- ============================================================

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles
  add constraint perfiles_rol_check check (rol in ('admin', 'vendedor', 'cajero'));
