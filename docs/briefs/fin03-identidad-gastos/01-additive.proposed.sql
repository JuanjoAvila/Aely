-- FIN03: PROPUESTA DE DISENO, NO APLICADA; fuera del runner de migraciones.
-- Paso1 conserva expenses_dedup_idx: los gemelos TODAVIA pueden chocar con el indice viejo.
-- No habilita v2, no crea RPC, no cambia RLS/grants ni reconstruye origen de filas antiguas.
-- Revisar contra servidor concreto y ensayar en PostgreSQL efimero antes de autorizar uso.
BEGIN;

ALTER TABLE public.expenses
  ADD COLUMN identity_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN origin_kind text,
  ADD COLUMN origin_provider text,
  ADD COLUMN origin_account text,
  ADD COLUMN origin_ref text;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_identity_v2_shape CHECK ((
    (identity_version = 1
      AND origin_kind IS NULL
      AND origin_provider IS NULL AND origin_account IS NULL AND origin_ref IS NULL)
    OR
    (identity_version = 2 AND origin_kind = 'manual'
      AND origin_provider IS NULL AND origin_account IS NULL AND origin_ref IS NULL)
    OR
    (identity_version = 2 AND origin_kind = 'bank'
      AND origin_provider IS NOT NULL AND length(btrim(origin_provider)) > 0
      AND origin_account IS NOT NULL AND length(btrim(origin_account)) > 0
      AND origin_ref IS NOT NULL AND length(btrim(origin_ref)) > 0)
  ) IS TRUE);

-- UNIQUE normal, sin predicado: los NULL no convierten manuales/legado en un origen comun.
-- Este indice NO sustituye ni neutraliza expenses_dedup_idx.
CREATE UNIQUE INDEX expenses_origin_v2_uidx
  ON public.expenses (user_id, origin_provider, origin_account, origin_ref);

COMMENT ON COLUMN public.expenses.identity_version IS
  '1=legado sin reconstruccion de origen; 2=protocolo futuro con identidad y ACK explicitos';
COMMENT ON COLUMN public.expenses.origin_provider IS
  'Identidad de origen inmutable futura; no es el banco editable mostrado al usuario';
COMMENT ON COLUMN public.expenses.origin_account IS
  'Cuenta opaca estable demostrada por proveedor; no nombre, posicion o inferencia por parecido';

-- No tocar expenses_dedup_idx. El paso2 exige otra aprobacion y un contrato de clientes antiguos.
COMMIT;
