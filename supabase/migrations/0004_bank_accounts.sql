-- ============================================================
-- Aely — Open Banking MULTI-CUENTA: guardar TODAS las cuentas de cada banco.
--
-- Hasta ahora `bank_links` guardaba UNA sola cuenta por banco (`account_uid`/`iban`),
-- así que una cuenta con varias (p.ej. Revolut: principal + compartida) solo traía la
-- primera. Añadimos `accounts` (JSONB) con la lista completa de cuentas autorizadas:
--   [{ uid, iban, name, currency }]
-- La escriben las Edge Functions con service role. `account_uid`/`iban` se mantienen
-- (= primera cuenta) para retrocompatibilidad; nada que ya funcione se rompe.
--
-- Aditiva y aislada: NO toca expenses ni app_state. Aplicar es seguro.
-- ============================================================

alter table public.bank_links
  add column if not exists accounts jsonb not null default '[]'::jsonb;
