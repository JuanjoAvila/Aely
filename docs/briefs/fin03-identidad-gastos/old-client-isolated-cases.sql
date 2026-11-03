-- FIN03: ENSAYO PROPUESTO, NO EJECUTADO (motor local no descubierto).
-- Solo PostgreSQL efimero local, nunca SQL vivo. Todo el fixture es TEMP y termina ROLLBACK.
-- No aplica ni valida la migracion propuesta, RLS, API, concurrencia o ACK completo.
BEGIN;
CREATE TEMP TABLE fin03_expenses (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  fecha timestamptz NOT NULL,
  importe numeric(12,2) NOT NULL,
  comercio text NOT NULL,
  source text NOT NULL,
  origin_provider text,
  origin_account text,
  origin_ref text
) ON COMMIT DROP;
CREATE UNIQUE INDEX fin03_legacy_uidx
  ON fin03_expenses (user_id, fecha, importe, comercio);
CREATE UNIQUE INDEX fin03_origin_uidx
  ON fin03_expenses (user_id, origin_provider, origin_account, origin_ref);

DO $fin03$
DECLARE
  owner_id constant uuid := '00000000-0000-4000-8000-000000000001';
  a constant uuid := '10000000-0000-4000-8000-000000000001';
  b constant uuid := '10000000-0000-4000-8000-000000000002';
  at_time constant timestamptz := '2026-10-16T12:00:00.000Z';
  n integer;
BEGIN
  -- Forma exacta onConflict antigua: bancos distintos no evitan su descarte.
  WITH inserted AS (
    INSERT INTO fin03_expenses (id,user_id,fecha,importe,comercio,source)
      VALUES (a,owner_id,at_time,2.50,'Cafe sintetico','ob:caixabank#refsynthetic-a')
      ON CONFLICT (user_id,fecha,importe,comercio) DO NOTHING RETURNING id
  ) SELECT count(*) INTO n FROM inserted;
  IF n <> 1 THEN RAISE EXCEPTION 'first legacy write must return one inserted id'; END IF;
  WITH inserted AS (
    INSERT INTO fin03_expenses (id,user_id,fecha,importe,comercio,source)
      VALUES (b,owner_id,at_time,2.50,'Cafe sintetico','ob:sabadell#refsynthetic-b')
      ON CONFLICT (user_id,fecha,importe,comercio) DO NOTHING RETURNING id
  ) SELECT count(*) INTO n FROM inserted;
  IF n <> 0 OR (SELECT count(*) FROM fin03_expenses) <> 1 THEN
    RAISE EXCEPTION 'legacy expected one row and second INSERT row_count0';
  END IF;

  -- Reintento mismo cliente/tupla: una fila, sin otro RETURNING/ACK de insercion.
  WITH inserted AS (
    INSERT INTO fin03_expenses (id,user_id,fecha,importe,comercio,source)
      VALUES (a,owner_id,at_time,2.50,'Cafe sintetico','ob:caixabank#refsynthetic-a')
      ON CONFLICT (user_id,fecha,importe,comercio) DO NOTHING RETURNING id
  ) SELECT count(*) INTO n FROM inserted;
  IF n <> 0 OR (SELECT count(*) FROM fin03_expenses) <> 1 THEN
    RAISE EXCEPTION 'legacy retry unexpectedly duplicated';
  END IF;

  -- Cambiar solo el objetivo a origen NO maneja el conflicto de atributos del viejo.
  BEGIN
    INSERT INTO fin03_expenses
      (id,user_id,fecha,importe,comercio,source,origin_provider,origin_account,origin_ref)
      VALUES (b,owner_id,at_time,2.50,'Cafe sintetico','ob:sabadell#refsynthetic-b',
        'sabadell','opaque-account-b','synthetic-b')
      ON CONFLICT (user_id,origin_provider,origin_account,origin_ref) DO NOTHING;
    RAISE EXCEPTION 'expected old-index conflict even with new origin index';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- SQLSTATE23505 esperado; es contencion, no alta ni cierre FIN09.
  END;
END
$fin03$;

DROP INDEX fin03_legacy_uidx;

DO $fin03$
BEGIN
  BEGIN
    INSERT INTO fin03_expenses (id,user_id,fecha,importe,comercio,source)
      VALUES ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
        '2026-10-16T12:00:00Z',2.50,'Cafe sintetico','ob:caixabank#refsynthetic-a')
      ON CONFLICT (user_id,fecha,importe,comercio) DO NOTHING;
    RAISE EXCEPTION 'unsafe cut failed to reject old onConflict';
  EXCEPTION WHEN SQLSTATE '42P10' THEN
    NULL; -- Incompatible incluso al reintentar UUID ya existente: no autoriza este corte.
  END;
END
$fin03$;

-- Solo fixture: demuestra dos origenes con nueva unicidad y ausencia del indice viejo.
TRUNCATE fin03_expenses;
INSERT INTO fin03_expenses
  (id,user_id,fecha,importe,comercio,source,origin_provider,origin_account,origin_ref)
VALUES
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
    '2026-10-16T12:00:00Z',2.50,'Cafe sintetico','ob:caixabank#refsynthetic-a',
    'caixabank','opaque-account-a','synthetic-a'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',
    '2026-10-16T12:00:00Z',2.50,'Cafe sintetico','ob:sabadell#refsynthetic-b',
    'sabadell','opaque-account-b','synthetic-b');
DO $fin03$
BEGIN
  IF (SELECT count(*) FROM fin03_expenses) <> 2
    OR (SELECT sum(importe) FROM fin03_expenses) <> 5.00 THEN
    RAISE EXCEPTION 'v2 distinct origins must preserve two rows and500c';
  END IF;
END
$fin03$;

-- Reintento de mismo origen con OTRO UUID: no duplica, canónico se lee por origen exacto.
INSERT INTO fin03_expenses
  (id,user_id,fecha,importe,comercio,source,origin_provider,origin_account,origin_ref)
VALUES
  ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001',
    '2026-10-16T12:00:00Z',2.50,'Cafe sintetico','ob:caixabank#refsynthetic-a',
    'caixabank','opaque-account-a','synthetic-a')
ON CONFLICT (user_id,origin_provider,origin_account,origin_ref) DO NOTHING;
DO $fin03$
BEGIN
  IF (SELECT count(*) FROM fin03_expenses) <> 2 OR (
    SELECT id FROM fin03_expenses
    WHERE user_id='00000000-0000-4000-8000-000000000001'
      AND origin_provider='caixabank' AND origin_account='opaque-account-a'
      AND origin_ref='synthetic-a'
  ) IS DISTINCT FROM '10000000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'origin retry did not preserve canonical row';
  END IF;
END
$fin03$;
ROLLBACK;
