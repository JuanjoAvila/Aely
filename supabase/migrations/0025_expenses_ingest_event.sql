-- La misma notificación puede reintentarse tras un timeout o reaparecer al reconectar el listener.
-- Importe/comercio/hora NO son identidad: dos compras reales pueden coincidir. La huella opaca la
-- genera el APK con la identidad nativa del evento y permite un ACK idempotente exacto.
alter table public.expenses
  add column if not exists ingest_event_id text;

create unique index if not exists expenses_ingest_event_idx
  on public.expenses (user_id, ingest_event_id);
