-- ============================================================
-- Aely — Hogar: expulsar, caducidad del código y un freno que cuenta los fallos (18/11/2026).
-- Auditoría de seguridad del 14/11, P3-05 (triage SEG-10). Solo servidor: los botones de la app
-- (expulsar, rotar el código, usar la función nueva) son de otra ronda y llegan después.
--
-- Unirse a un hogar da lectura de los saldos de todos sus miembros (`household_snapshots`), así
-- que el código de invitación es una llave. Lo que faltaba:
--
-- 1. EL FRENO DE LA 0022 NO CONTABA LOS FALLOS. `join_household_by_code` llama a
--    `check_rate_limit` y, si el código no existe, lanza `invalid_code`. Una excepción deshace la
--    transacción entera de la RPC, contador incluido: solo quedaban contados los ACIERTOS. Probar
--    códigos no gastaba ni un intento del cupo de 10 cada 10 minutos. Para que un fallo cuente,
--    la función no puede lanzar: la nueva `join_household` devuelve `{ok, code}` y su contador
--    sí se queda. La vieja se conserva porque la app instalada la llama y espera la excepción
--    (`invalid`, `too_many`); se retira cuando la app use la nueva.
-- 2. Tope GLOBAL de fallos: el freno por usuario se multiplica con el registro abierto (una
--    cuenta nueva, diez intentos más). 200 códigos fallidos por hora entre todos cierran las dos
--    funciones para todos durante esa hora. Unirse a un hogar es algo de una vez; que un atacante
--    pueda bloquearlo una hora es el precio, y es mucho menor que dejarle probar sin techo.
-- 3. Caducidad: `invite_expires_at` (NULL = no caduca, como hasta hoy). Un código caducado se
--    contesta igual que uno inexistente, para no confirmar que existió.
-- 4. Longitud: los códigos nuevos o cambiados tienen al menos 10 letras/cifras (la app los genera
--    de 10 desde el 13/9). Los viejos de 6 siguen valiendo hasta que su dueño los rote: cerrarlos
--    aquí dejaría fuera a quien todavía no se ha unido, sin aviso.
-- 5. El dueño puede expulsar a un miembro (antes solo podía irse cada uno), y al salir o ser
--    expulsado se borra su foto del hogar: si no, los demás la seguían leyendo.
--
-- Idempotente (if not exists / create or replace / drop … if exists). No toca filas existentes.
-- ============================================================

alter table public.households add column if not exists invite_expires_at timestamptz;

-- Sin pasar por RLS (el patrón de la 0014): una política de household_members que consultara
-- households, cuya política consulta household_members, vuelve a la recursión infinita.
create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.households h
    where h.id = hid and h.created_by = auth.uid()
  );
$$;

revoke all on function public.is_household_owner(uuid) from public;
revoke execute on function public.is_household_owner(uuid) from anon;
grant execute on function public.is_household_owner(uuid) to authenticated;

drop policy if exists household_members_delete_owner on public.household_members;
create policy household_members_delete_owner on public.household_members
  for delete to authenticated
  using (user_id <> auth.uid() and public.is_household_owner(household_id));

-- La foto se va con el miembro, salga como salga. SECURITY DEFINER: quien expulsa no puede borrar
-- por RLS la foto de otro (`household_snapshots_upsert` solo deja la propia).
create or replace function public.household_member_salida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.household_snapshots
  where household_id = old.household_id and user_id = old.user_id;
  return old;
end;
$$;

-- Como `app_events_freno` (0023): una función de trigger no se puede llamar por RPC; basta con public.
revoke all on function public.household_member_salida() from public;

drop trigger if exists household_member_salida on public.household_members;
create trigger household_member_salida
  after delete on public.household_members
  for each row execute function public.household_member_salida();

-- Longitud mínima solo al crear o CAMBIAR el código (`update of invite_code`): renombrar un hogar
-- con código viejo sigue funcionando.
create or replace function public.households_codigo_largo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if char_length(regexp_replace(coalesce(new.invite_code, ''), '[^A-Za-z0-9]', '', 'g')) < 10 then
    raise exception 'invite_code_too_short' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Como `app_events_freno` (0023): una función de trigger no se puede llamar por RPC; basta con public.
revoke all on function public.households_codigo_largo() from public;

drop trigger if exists households_codigo_largo on public.households;
create trigger households_codigo_largo
  before insert or update of invite_code on public.households
  for each row execute function public.households_codigo_largo();

-- ¿Se ha pasado ya el tope global de fallos en la última hora? Solo mira: no cuenta.
create or replace function public.hogar_fallos_globales_agotados()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select r.hits >= 200 from public.rate_limits r
    where r.bucket = 'hh-join-miss-global'
      and r.window_start >= now() - interval '1 hour'
  ), false);
$$;

revoke all on function public.hogar_fallos_globales_agotados() from public;
revoke execute on function public.hogar_fallos_globales_agotados() from anon, authenticated;

-- La nueva: nunca lanza, para que el contador de fallos se quede.
create or replace function public.join_household(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  caduca timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if public.hogar_fallos_globales_agotados() then
    return jsonb_build_object('ok', false, 'code', 'too_many_attempts');
  end if;
  if not public.check_rate_limit('hh-join:' || auth.uid()::text, 10, 600) then
    return jsonb_build_object('ok', false, 'code', 'too_many_attempts');
  end if;
  select h.id, h.invite_expires_at into hid, caduca
  from public.households h
  where upper(trim(h.invite_code)) = upper(trim(p_code))
  limit 1;
  if hid is null or (caduca is not null and caduca < now()) then
    perform public.check_rate_limit('hh-join-miss-global', 200, 3600);
    return jsonb_build_object('ok', false, 'code', 'invalid_code');
  end if;
  insert into public.household_members (household_id, user_id, role)
  values (hid, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;
  return jsonb_build_object('ok', true, 'household_id', hid);
end;
$$;

revoke all on function public.join_household(text) from public;
revoke execute on function public.join_household(text) from anon;
grant execute on function public.join_household(text) to authenticated;

-- La de siempre, con el mismo contrato de excepciones que espera la app instalada, más la
-- caducidad y el tope global (que sí se alimenta de los fallos de la nueva).
create or replace function public.join_household_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  caduca timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if public.hogar_fallos_globales_agotados() then
    raise exception 'too_many_attempts';
  end if;
  if not public.check_rate_limit('hh-join:' || auth.uid()::text, 10, 600) then
    raise exception 'too_many_attempts';
  end if;
  select h.id, h.invite_expires_at into hid, caduca
  from public.households h
  where upper(trim(h.invite_code)) = upper(trim(p_code))
  limit 1;
  if hid is null or (caduca is not null and caduca < now()) then
    raise exception 'invalid_code';
  end if;
  insert into public.household_members (household_id, user_id, role)
  values (hid, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;
  return hid;
end;
$$;

revoke all on function public.join_household_by_code(text) from public;
revoke execute on function public.join_household_by_code(text) from anon;
grant execute on function public.join_household_by_code(text) to authenticated;
