-- PRO-09 / GO A468ffa26: BORRADOR NUEVO INERTE, NO APLICAR NI USAR.
-- No está registrado en supabase/migrations y no ha sido generado por la CLI:
-- supabase/psql/docker no están disponibles en PATH; no se instaló nada.
-- Claude debe aprobar esquema, plazo, acuse y operación atómica antes de usarlo.
-- Tras su decisión: generar la migración NUEVA con supabase migration new,
-- revisar docs actuales y copiar únicamente el DDL finalmente aprobado.
-- La guarda aborta ANTES del DDL incluso si alguien ejecuta este borrador.

begin;
do $$
begin
  raise exception 'PRO09_DRAFT_NOT_APPROVED_DO_NOT_APPLY';
end;
$$;

-- Un recibo tipado no es una fila de expenses ni un blob de app_state.
-- No se almacenan texto crudo, paquete/key nativos, token, datos del perfil o precio.
create table public.roundup_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_hash text not null check (event_hash ~ '^v1_[a-f0-9]{64}$'),
  bank text not null check (bank = 'trade_republic'),
  account_key text check (account_key is null or char_length(account_key) between 1 and 160),
  event_at timestamptz not null,
  received_at timestamptz not null default now(),
  expires_at timestamptz not null,
  amount_cents bigint not null check (amount_cents between 1 and 999999999999),
  direction text not null check (direction = 'out'),
  currency text not null check (currency = 'EUR'),
  semantic text not null check (semantic = 'roundup_invested'),
  name_key text not null check (char_length(name_key) between 1 and 160),
  state text not null default 'pending'
    check (state in ('pending', 'matched', 'expired', 'blocked')),
  matched_expense_id uuid,
  matched_at timestamptz,
  revision bigint not null default 0 check (revision >= 0),
  unique (user_id, event_hash),
  check (expires_at >= event_at),
  check (
    (state = 'matched' and matched_expense_id is not null and matched_at is not null)
    or
    (state <> 'matched' and matched_expense_id is null and matched_at is null)
  )
);

-- Un BOOK no puede consumir dos señales. No sustituye a probar la unicidad en
-- ambas direcciones ni a verificar dueño/identidad/decisiones en una transacción.
create unique index roundup_signals_one_per_book_idx
  on public.roundup_signals (matched_expense_id)
  where state = 'matched';
create index roundup_signals_pending_lookup_idx
  on public.roundup_signals (user_id, bank, amount_cents, event_at)
  where state = 'pending';

alter table public.roundup_signals enable row level security;
revoke all on table public.roundup_signals from public, anon, authenticated;
grant select on table public.roundup_signals to authenticated;
create policy roundup_signals_own_read on public.roundup_signals
  for select to authenticated
  using ((select auth.uid()) = user_id);
grant select, insert, update on table public.roundup_signals to service_role;

-- PENDIENTE DE DECISIÓN, NO IMPLEMENTADO:
-- - No hay FK a expenses: no se añade un índice de identidad ni se cambia el
--   borrado de FIN03/FIN11 por arrastre. La operación de vinculación aprobada
--   tendrá que bloquear y comprobar expenses.user_id/id antes de escribir,
--   y conservar el recibo cuando el dueño retire un BOOK. Revisar ese contrato.
-- - No hay trigger, RPC ni UPDATE de expenses. Este DDL por sí solo NO garantiza
--   atomicidad señal/BOOK ni conservación de decisiones/categoría del usuario.
-- - Falta decidir el marcador de categoría elegida, incluso «Otros». La base no
--   lo persiste; NO añadir una columna ni tocar escritores sin otra aprobación.
-- - Caducidad propuesta: siete días calendario de Madrid desde event_at, hasta
--   el fin de ese día; expires_at lo calcula el servidor de la fase aprobada.
--   No se prolonga por reintento; no cron/purga. expired/blocked siguen guardados
--   para no revivir una huella. Retención/purga de recibos requiere otra decisión.
-- - Cliente autenticado solo lector; ninguna política de escritura para él.
--   El mecanismo para pedir reconciliación posterior al BOOK aún requiere GO.
-- - Volver atrás antes de uso: retirar el DDL. Después de usarlo, primero parar
--   el escritor/lector y conservar recibos; no ejecutar DROP perdiendo idempotencia.

rollback;
