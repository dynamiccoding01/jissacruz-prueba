-- ============================================================
-- SISREP — 13: Sucursal del usuario (C2 · paso 2)
-- Liga cada perfil a una sucursal. NO toca el stock (eso es el paso 3).
-- Ejecutar en el SQL Editor sobre una base que ya corrio 12_sucursales.sql.
-- Idempotente.
-- ============================================================

-- Columna: sucursal a la que pertenece el usuario.
alter table public.perfiles
  add column if not exists sucursal_id uuid references public.sucursales(id);

-- Backfill: los usuarios existentes quedan en la sucursal por defecto
-- (la de codigo mas bajo, normalmente 'Casa Matriz').
update public.perfiles p
set sucursal_id = (select id from public.sucursales where activo order by codigo limit 1)
where p.sucursal_id is null;

-- El trigger que crea el perfil al invitar un usuario ahora tambien lee
-- sucursal_id de user_metadata (lo manda la pantalla de Configuracion).
create or replace function public.fn_crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre_completo, rol, sucursal_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre_completo', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'vendedor'),
    (new.raw_user_meta_data->>'sucursal_id')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
