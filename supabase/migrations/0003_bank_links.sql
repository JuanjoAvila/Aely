-- ============================================================
-- Aely — Open Banking (Enable Banking): enlaces de cuenta por usuario.
--
-- Una fila por (usuario, banco). La ESCRIBEN las Edge Functions con service role
-- (bank-connect / bank-callback / bank-sync). El cliente solo LEE su estado de
-- conexión (para pintar "Sabadell conectado ✓" y avisar si caduca el permiso).
--
-- Aditiva y aislada: NO toca expenses ni app_state. Aplicar es seguro.
-- ============================================================

create table if not exists public.bank_links (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  aspsp_name    text not null,                     -- p.ej. "Banco de Sabadell"
  aspsp_country text not null default 'ES',
  state         text,                              -- OAuth state, para casar el callback con el usuario
  session_id    text,                              -- id de sesión de Enable Banking
  account_uid   text,                              -- cuenta autorizada (para /accounts/{uid}/...)
  iban          text,
  status        text not null default 'pending',   -- pending | active | expired | error
  valid_until   timestamptz,                       -- caducidad del consentimiento (re-login PSD2)
  last_sync     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Un enlace por usuario+banco (re-conectar actualiza la misma fila).
create unique index if not exists bank_links_user_aspsp_idx on public.bank_links (user_id, aspsp_name);
-- El callback llega sin sesión: localizamos al usuario por el state.
create index if not exists bank_links_state_idx on public.bank_links (state);

alter table public.bank_links enable row level security;

-- El usuario solo PUEDE LEER lo suyo. La escritura va por service role (Edge Functions),
-- que salta RLS; por eso no hay policy de insert/update para 'authenticated'.
drop policy if exists "bank_links_own_read" on public.bank_links;
create policy "bank_links_own_read" on public.bank_links
  for select using (auth.uid() = user_id);

grant select on table public.bank_links to authenticated;
grant select, insert, update, delete on table public.bank_links to service_role;
