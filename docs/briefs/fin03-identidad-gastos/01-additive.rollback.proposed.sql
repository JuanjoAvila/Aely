-- FIN03: PROPUESTA DE REVERSION DEL PASO1, NO APLICADA.
-- Precondicion externa: capacidad y productores/lectores v2 desactivados y drenados.
-- Solo revierte si las columnas nuevas no contienen identidad; nunca borra gastos ni CASCADE.
BEGIN;
LOCK TABLE public.expenses IN ACCESS EXCLUSIVE MODE;

DO $fin03$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.expenses
    WHERE identity_version <> 1 OR origin_kind IS NOT NULL
      OR origin_provider IS NOT NULL OR origin_account IS NOT NULL OR origin_ref IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FIN03 rollback blocked: identity metadata already in use'
      USING ERRCODE = '55000';
  END IF;
END
$fin03$;

DROP INDEX public.expenses_origin_v2_uidx;
ALTER TABLE public.expenses DROP CONSTRAINT expenses_identity_v2_shape;
ALTER TABLE public.expenses
  DROP COLUMN origin_ref,
  DROP COLUMN origin_account,
  DROP COLUMN origin_provider,
  DROP COLUMN origin_kind,
  DROP COLUMN identity_version;

-- PK, expenses_dedup_idx, filas, permisos y politicas previas quedan fuera de esta reversion.
COMMIT;
