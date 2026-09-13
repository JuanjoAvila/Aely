-- ============================================================
-- Aely — Topes a `app_events` (13/9/2026, OPS-06 P2).
--
-- Cualquier usuario con sesión podía insertar SUS eventos sin límite de número ni de tamaño: un
-- cliente en bucle (o malicioso) inflaba la tabla y enterraba los errores de verdad.
--  1. Tamaño: message ≤ 1.000 y detail ≤ 16.000 caracteres. `not valid`: no revalida las filas
--     viejas, solo las nuevas. El cliente ya recorta a 300 / 8.000.
--  2. Número: 600 eventos cada 10 minutos por usuario. Al pasarse, el evento se DESCARTA sin error
--     (se pierde un log, nunca un gasto). La service role (Edge) no pasa por el freno.
-- Idempotente.
-- ============================================================

alter table public.app_events drop constraint if exists app_events_len;
alter table public.app_events add constraint app_events_len
  check (char_length(coalesce(message, '')) <= 1000 and char_length(coalesce(detail, '')) <= 16000) not valid;

create or replace function public.app_events_freno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or new.user_id is null then
    return new;
  end if;
  if not public.check_rate_limit('ev:' || new.user_id::text, 600, 600) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.app_events_freno() from public;

drop trigger if exists app_events_freno on public.app_events;
create trigger app_events_freno
  before insert on public.app_events
  for each row execute function public.app_events_freno();
