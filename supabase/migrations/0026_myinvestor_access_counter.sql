-- Una reconexión o lectura buena empieza un contador nuevo. Los fallos en vuelo conservan
-- su versión y no pueden caducar ni borrar el contador de la sesión que los sustituyó.
-- Idempotente, sólo MyInvestor; no se aplica desde este encargo.
alter table public.myinvestor_links
  add column if not exists access_counter_version uuid not null default gen_random_uuid(),
  add column if not exists connection_version uuid not null default gen_random_uuid();

-- El cliente sigue leyendo exclusivamente las columnas de estado autorizadas por 0010/0012.
revoke select (access_counter_version, connection_version), insert (access_counter_version, connection_version), update (access_counter_version, connection_version)
  on public.myinvestor_links from anon, authenticated;
grant select (access_counter_version, connection_version), insert (access_counter_version, connection_version), update (access_counter_version, connection_version)
  on public.myinvestor_links to service_role;
