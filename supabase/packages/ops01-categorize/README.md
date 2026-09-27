# Paquete OPS-01 B: solo categorize

`baseline/` es un cierre congelado, no otra fuente de ingest. Sus cuatro fuentes se recuperaron
del paquete activo categorize16 y coinciden byte a byte con el commit
`6f61bfc690f53e849b22b659dd0fe607b1a90043`; hashes en `manifest.json`.
La fuente habitual sigue en `supabase/functions`. Este paquete evita enviar con categorize
los cambios posteriores del módulo compartido que pertenece también a ingest.

`node scripts/prepare-categorize-package.mjs candidate` prepara un proyecto temporal con una sola
función y exactamente tres retiradas: Bizum de ALLOWED, HINTS y CATEGORIAS/KW.
`rollback` prepara las fuentes anteriores sin esas retiradas. Ambos conservan JWT y fijan el
SDK existente a la versión resuelta en el paquete activo; no añaden dependencias nuevas.
La herramienta solo escribe archivos locales, nunca llama a Supabase ni ejecuta SQL.

Pruebas: `node tests/categorize-handler.test.mjs`, registradas en runner y mapa Supabase.
Despliegue y autorización: [brief B](../../../docs/briefs/ops01-categorize-2026-09-27.md).
No usar el workflow raíz para este paquete: tomaría un cierre diferente.
