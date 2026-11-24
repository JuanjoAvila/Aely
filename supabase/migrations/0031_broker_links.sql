-- ============================================================
-- Aely — Brókers por conexión automática (IBKR Flex, Kraken), 19/11/2026.
--
-- El dueño pidió que nadie tenga que bajar ficheros de su bróker: conexión como Trade Republic o
-- MyInvestor. Molde MyInvestor (0010): la credencial vive en el servidor, CIFRADA (enc:v1:,
-- AES-256-GCM con TOKEN_ENCRYPTION_KEY), y el cliente solo lee el estado. A diferencia de
-- MyInvestor, aquí solo entran credenciales de SOLO LECTURA (token Flex de IBKR; clave de Kraken
-- con «Consultar fondos» y nada que opere o retire, comprobado por `broker-connect` antes de
-- guardar y por `broker-sync` en cada lectura).
--
-- Aditiva y aislada: no toca ninguna tabla existente. NO se aplica desde la rama de la ronda:
-- va desde main con el OK del dueño (docs/SETUP-SUPABASE.md).
-- ============================================================

create table if not exists public.broker_links (
  user_id            uuid not null references auth.users(id) on delete cascade,
  broker             text not null check (broker in ('ibkr','kraken','binance','degiro')),
  cred_a             text,                       -- cifrado: token Flex / clave pública de Kraken
  cred_b             text,                       -- cifrado: Query ID / clave privada de Kraken
  meta               jsonb not null default '{}'::jsonb,  -- NO sensible: nº de cuentas, permisos vistos, caducidad
  status             text not null default 'pending',     -- pending | active | expired | rejected | error
  last_sync          timestamptz,
  last_code          text,                       -- último código cerrado (flex_1012, kraken_nonce…), nunca texto del bróker
  nonce              bigint not null default 0,  -- Kraken: el nonce de la clave, siempre creciente
  connection_version uuid not null default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (user_id, broker)
);

alter table public.broker_links enable row level security;

drop policy if exists "broker_links_own_read" on public.broker_links;
create policy "broker_links_own_read" on public.broker_links
  for select using (auth.uid() = user_id);

-- GRANT POR COLUMNA, como 0010: el cliente ve su ESTADO, nunca `cred_*` ni el nonce. Así ni un XSS
-- con la sesión del usuario puede leer la clave. Supabase da ALL a anon/authenticated en tablas
-- nuevas: se quita todo primero y se concede solo lo que se lee.
revoke all on table public.broker_links from anon, authenticated;
grant select (user_id, broker, status, last_sync, last_code, meta, created_at, updated_at)
  on table public.broker_links to authenticated;
grant select, insert, update, delete on table public.broker_links to service_role;

-- Nonce de Kraken: siguiente valor ATÓMICO (dos syncs a la vez, dos móviles, no chocan) y siempre
-- por encima del reloj en microsegundos, para que nunca baje de uno ya usado al conectar.
create or replace function public.broker_next_nonce(p_user uuid, p_broker text)
returns bigint
language sql
security definer
set search_path = public
as $$
  update public.broker_links
     set nonce = greatest(nonce + 1, (extract(epoch from clock_timestamp()) * 1000000)::bigint)
   where user_id = p_user and broker = p_broker
  returning nonce;
$$;

revoke execute on function public.broker_next_nonce(uuid, text) from public, anon, authenticated;
grant execute on function public.broker_next_nonce(uuid, text) to service_role;
