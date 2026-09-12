-- ============================================================
-- Aely — Esquema inicial (Fase 1: Supabase)
-- Gastos en tabla relacional + resto del estado de la app en JSONB por usuario.
-- Row Level Security: cada usuario solo ve y escribe lo suyo.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- GASTOS ----------
create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  fecha      timestamptz not null,
  importe    numeric(12,2) not null default 0,
  comercio   text not null default '',
  cat        text not null default 'otros',
  source     text not null default 'manual',   -- 'macrodroid' | 'manual' | 'import'
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_fecha_idx
  on public.expenses (user_id, fecha desc);

-- Dedup suave: la misma notificación (usuario + instante + importe + comercio) no se duplica.
-- La función ingest inserta con ON CONFLICT DO NOTHING contra este índice.
create unique index if not exists expenses_dedup_idx
  on public.expenses (user_id, fecha, importe, comercio);

-- ---------- ESTADO DE LA APP (cuentas, inversiones, deudas, ajustes…) ----------
-- Una fila por usuario con todo el blob de estado. Se normalizará en fases futuras si hace falta.
create table if not exists public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.expenses  enable row level security;
alter table public.app_state enable row level security;

drop policy if exists "expenses_own" on public.expenses;
create policy "expenses_own" on public.expenses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "app_state_own" on public.app_state;
create policy "app_state_own" on public.app_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- GRANTS ----------
-- Necesarios porque el proyecto se creó con "Automatically expose new tables" DESACTIVADO.
-- Sin esto, el rol `authenticated` no puede tocar las tablas (error "permission denied for table")
-- aunque existan las políticas RLS. RLS sigue limitando a cada usuario a sus propias filas.
grant select, insert, update, delete on table public.expenses  to authenticated;
grant select, insert, update, delete on table public.app_state to authenticated;

-- service_role: lo usa la función ingest para escribir gastos. Con "expose new tables"
-- desactivado, este rol tampoco recibe grants automáticos, así que se los damos aquí.
grant select, insert, update, delete on table public.expenses  to service_role;
grant select, insert, update, delete on table public.app_state to service_role;
