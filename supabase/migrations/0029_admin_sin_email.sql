-- ============================================================
-- Aely — El admin ya no se decide por un correo escrito en el SQL (18/11/2026).
-- Auditoría de seguridad del 14/11, P3-08 (triage SEG-13).
--
-- `handle_new_user` (0016) marcaba `is_admin` a quien se diera de alta con un correo concreto,
-- escrito tal cual en una migración de un repo público. Mientras esa cuenta exista no pasa nada
-- (el correo es único en auth.users), pero si algún día se borra, el primero que se registre con
-- ese correo antes de que vuelva el dueño heredaría el admin, y el admin lee TODA la telemetría.
--
-- Desde aquí, una cuenta nueva nunca nace admin. Lo que ya está NO cambia: esta migración no
-- toca ninguna fila de `profiles`, así que el admin de hoy sigue siéndolo. Si hubiera que darlo
-- otra vez, se hace a mano por `user_id` en el SQL Editor (docs/SETUP-SUPABASE.md, «Admin por
-- user_id»), nunca por correo.
--
-- Comprobar antes de aplicarla (solo lectura): `select count(*) from public.profiles where is_admin;`
-- debe dar 1. Si da 0, primero la sentencia manual; si no, después nadie vería Actividad.
-- Idempotente (create or replace).
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, is_admin)
  values (new.id, false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Sin cambiar permisos: es la función del alta (la dispara Auth) y no se toca más de lo necesario.
