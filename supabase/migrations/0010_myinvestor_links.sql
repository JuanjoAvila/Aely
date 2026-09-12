-- ============================================================
-- Aely — MyInvestor (API no oficial): un enlace de sesión por usuario.
--
-- MyInvestor NO está en Open Banking para POSICIONES (PSD2 solo trae el cash); su
-- API propia (api.myinvestor.es, la misma que usa su web/app) SÍ devuelve los fondos
-- indexados. Guardamos SOLO los tokens de sesión (access/refresh) + el device_id, NUNCA
-- la contraseña (se usa de paso en el login y se descarta). Las Edge Functions escriben
-- con service role; el cliente solo LEE su estado de conexión.
--
-- Aditiva y aislada: NO toca expenses/app_state/bank_links. Aplicar es seguro.
-- ============================================================

create table if not exists public.myinvestor_links (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  device_id          text,                              -- x-device-id (UUID estable de la sesión)
  access_token       text,                              -- Bearer (sensible: NO se expone al cliente)
  refresh_token      text,                              -- para renovar sin re-login (sensible)
  refresh_expires_at timestamptz,                       -- caducidad del refresh
  status             text not null default 'pending',   -- pending | active | expired | error
  last_sync          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.myinvestor_links enable row level security;

-- El usuario solo lee lo suyo; la escritura va por service role (Edge Functions).
drop policy if exists "mi_links_own_read" on public.myinvestor_links;
create policy "mi_links_own_read" on public.myinvestor_links
  for select using (auth.uid() = user_id);

-- GRANT A NIVEL DE COLUMNA: el cliente puede ver su ESTADO, nunca los tokens. Así un XSS
-- tampoco podría leer el access_token desde la sesión del usuario (defensa en profundidad).
grant select (user_id, status, last_sync, created_at, updated_at) on table public.myinvestor_links to authenticated;
grant select, insert, update, delete on table public.myinvestor_links to service_role;
