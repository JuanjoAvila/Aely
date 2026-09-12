-- ============================================================
-- Aely — Copias de seguridad automáticas del estado (app_state)
-- El plan Free de Supabase NO hace backups automáticos. Como esto es dinero real,
-- la app guarda un snapshot diario de su estado aquí (idempotente por día) y
-- mantiene una ventana rodante (~30 días). Permite recuperar ante un set corrupto
-- o un bug de merge sin depender solo del export JSON manual.
-- ============================================================

create table if not exists public.state_backups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null default current_date,   -- 1 snapshot por día y usuario
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Un snapshot por usuario y día: la app hace UPSERT con onConflict = (user_id, day).
create unique index if not exists state_backups_user_day_idx
  on public.state_backups (user_id, day);

create index if not exists state_backups_user_day_desc_idx
  on public.state_backups (user_id, day desc);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.state_backups enable row level security;

drop policy if exists "state_backups_own" on public.state_backups;
create policy "state_backups_own" on public.state_backups
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- GRANTS ---------- (igual que el resto: "expose new tables" está desactivado)
grant select, insert, update, delete on table public.state_backups to authenticated;
grant select, insert, update, delete on table public.state_backups to service_role;
