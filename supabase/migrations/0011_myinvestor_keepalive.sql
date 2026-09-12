-- ============================================================
-- Aely — keep-alive de la sesión de MyInvestor (feedback 2026-07-13: «caduca la sesión»).
--
-- El refresh del token solo ocurría al SINCRONIZAR: si el refresh token de MyInvestor
-- caducaba entre dos usos, el enlace moría y tocaba reconectar con contraseña + OTP.
-- Arreglo: pg_cron llama cada 10 min a la Edge Function myinvestor-keepalive, que
-- refresca los tokens de TODOS los enlaces activos (rotan y siguen vivos).
--
-- Seguridad SIN secretos en el repo (es público): el secreto se genera AQUÍ en la BD
-- (gen_random_uuid), vive en public.cron_secrets con RLS sin políticas (solo service
-- role y postgres lo leen), el cron lo manda en la cabecera x-cron-key y la función
-- lo compara leyéndolo con service role. Nadie más puede disparar el keep-alive.
--
-- Aditiva y aislada: NO toca datos existentes. Aplicar es seguro.
-- ============================================================

create table if not exists public.cron_secrets (
  name       text primary key,
  secret     uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.cron_secrets enable row level security;

-- Sin políticas a propósito: ni anon ni authenticated leen NADA (RLS niega por defecto).
-- Cinturón y tirantes: fuera también los grants por defecto de Supabase.
revoke all on table public.cron_secrets from anon, authenticated;
grant select on table public.cron_secrets to service_role;

insert into public.cron_secrets (name) values ('myinvestor-keepalive')
on conflict (name) do nothing;

-- pg_cron + pg_net (ya vienen instalables en Supabase; el IF NOT EXISTS lo hace idempotente)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-programable sin fallar si el job no existe todavía
do $do$
begin
  perform cron.unschedule('myinvestor-keepalive');
exception when others then
  null;
end
$do$;

select cron.schedule(
  'myinvestor-keepalive',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url     := 'https://sfyfjagbnhbplrljpbvh.supabase.co/functions/v1/myinvestor-keepalive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select secret::text from public.cron_secrets where name = 'myinvestor-keepalive')
    ),
    body    := '{}'::jsonb
  );
  $job$
);
