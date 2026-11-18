-- ============================================================
-- Aely — Purga diaria de `rate_limits` (18/11/2026, triage T-08).
--
-- La 0019 dejó `prune_rate_limits()` a mano a propósito: «unas pocas filas de unos pocos bytes».
-- Eso valía para los cubos por usuario, que se reutilizan. No para los que nacen y no vuelven:
--   · `ingest-ip:<hash>` y `bank-callback-ip:<hash>`: uno por IP, y la IP de un móvil cambia
--     varias veces al día (datos, wifi, CGNAT). Cada cambio deja una fila que nadie vuelve a tocar.
--   · `mi-401-tras-refresco:<usuario>:<versión>`: uno por versión del contador de MyInvestor.
-- Y el hash de una IP sigue siendo un dato seudónimo: guardarlo sin fecha de borrado va contra
-- la minimización del RGPD aunque no se pueda leer hacia atrás.
--
-- Por qué basta con borrar lo de hace más de 2 días: la ventana más larga de cualquier freno es
-- de 1 día (`*-total-day`, `*-new-day`); 6 h la de MyInvestor. Una fila con `window_start` de
-- hace más de 2 días ya caducó: el siguiente golpe la habría reiniciado a 1 igual. Borrarla no
-- cambia ninguna decisión de ningún freno.
--
-- Un job de `pg_cron` (ya instalado por la 0011) a las 04:17 UTC, fuera de las horas de uso.
-- Idempotente: desprograma el job si existía y lo vuelve a programar con el mismo nombre.
-- Medir antes y después (solo lectura) en docs/SETUP-SUPABASE.md, «Purga de rate_limits».
-- ============================================================

create extension if not exists pg_cron;

do $do$
begin
  perform cron.unschedule('aely-rate-limits-purga');
exception when others then
  null;
end
$do$;

select cron.schedule(
  'aely-rate-limits-purga',
  '17 4 * * *',
  $job$ select public.prune_rate_limits(); $job$
);
