-- ============================================================
-- Aely — Reparar grants de la BD viva (14/9/2026, OPS-06).
--
-- Leído en la BD real con SELECT y `set local role authenticated` (no en el repo):
--  1. La 0012 (`device_id` de MyInvestor) consta como aplicada pero su grant NO estaba: es la de
--     «las dos 0012». `select status, device_id` daba 42501, `myinvestorStatus` se lo tragaba y
--     devolvía null → la sync automática de MyInvestor no corría nunca y al reconectar no se
--     reutilizaba el móvil (más captchas). Se vuelve a dar, con las mismas columnas que la 0012.
--  2. `anon` y `authenticated` conservaban REFERENCES, TRIGGER y TRUNCATE en todas las tablas de
--     public. No se llega a ellos por PostgREST, pero sobran: quitarlos solo impide CREAR claves
--     ajenas o triggers nuevos con esos roles, no rompe los que ya hay.
--  3. `handle_new_user` (SECURITY DEFINER, trigger del alta) era ejecutable por anon/authenticated.
--     El trigger sigue disparando como su dueño.
-- Idempotente.
-- ============================================================

grant select (user_id, status, last_sync, created_at, updated_at, device_id)
  on table public.myinvestor_links to authenticated;

revoke references, trigger, truncate on all tables in schema public from anon, authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
