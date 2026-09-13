-- ============================================================
-- Aely — Freno al unirse a un Hogar por código (13/9/2026, OPS-06 P1).
--
-- El código de invitación eran 6 caracteres y `join_household_by_code` (SECURITY DEFINER,
-- cualquier usuario con sesión) no tenía límite: con registro abierto se podía probar códigos
-- hasta entrar en un hogar ajeno y leer `household_snapshots` (cuentas y saldos).
-- Ahora: 10 intentos cada 10 minutos por usuario, contando aciertos y fallos, ANTES de buscar.
-- Los códigos nuevos son de 10 caracteres (cliente); los viejos siguen valiendo.
-- `check_rate_limit` está revocada a `authenticated`, pero esta función es SECURITY DEFINER y su
-- dueño sí puede llamarla. Idempotente (create or replace).
-- ============================================================

create or replace function public.join_household_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.check_rate_limit('hh-join:' || auth.uid()::text, 10, 600) then
    raise exception 'too_many_attempts';
  end if;
  select id into hid
  from public.households
  where upper(trim(invite_code)) = upper(trim(p_code))
  limit 1;
  if hid is null then
    raise exception 'invalid_code';
  end if;
  insert into public.household_members (household_id, user_id, role)
  values (hid, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;
  return hid;
end;
$$;

revoke all on function public.join_household_by_code(text) from public;
grant execute on function public.join_household_by_code(text) to authenticated;
