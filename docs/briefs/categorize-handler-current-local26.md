# Contrato durable del handler actual de categorize · 9/10/2026

Evidencia inicial del **9/10/2026 a las 03:49 UTC**: preparación estática, sin tests ejecutados,
commit ni push en ese corte. Base revisada: `798226ce2ddcc506c3f0768a5daf9619eff97e15`.
Rama propia `codex/categorize-handler-current-local26`. Este corte histórico no acredita
el estado de una ejecución, revisión o entrega posterior.

El harness histórico de PR48 ejecutaba un paquete cerrado de una fuente anterior. Su cobertura
de rutas, auth, Bizum, IA simulada y rate limit es útil, pero recuperar aquel paquete también
retiraría las categorías actuales de movilidad y el saneado SQLSTATE del limitador. Este cambio
conserva solo la técnica de simulación: ejecuta las cuatro fuentes actuales desde disco,
sin copiar implementaciones de runtime ni preparar un paquete desplegable.

Fuentes reales cargadas, sin modificación:

| Fuente | Git blob en la base |
|---|---|
| `supabase/functions/categorize/index.ts` | `659aab0e746dcba81cb10bdc65ce608941f2ff82` |
| `supabase/functions/_shared/ingest_logic.ts` | `0d86b5a47a4cb1566de76cdf95ee61d44e1c1f76` |
| `supabase/functions/_shared/cors.ts` | `441eb0705d58e11b4d041591dbd79e2b04f54d53` |
| `supabase/functions/_shared/ratelimit.ts` | `1a271736469001ee8b611e453180601e8fedf397` |

Archivos del cambio: `tests/categorize-handler.test.mjs`, `scripts/run-tests.mjs`,
`scripts/relevant-tests.mjs`, `tests/relevant-tests.test.mjs`, `README.md`, `docs/TESTING.md`,
`CHANGELOG.md` y esta acta. La selección servidor incluye el nuevo handler y el limitador estático; su guardián
exige ambos al cambiar cualquiera de las cuatro fuentes. Cero dependencias nuevas. Runtime Supabase, import/SDK,
migraciones, workflows, public, catálogo, notas, versiones y Android quedan fuera del alcance.
No cerrar PR48 ni presentar estos tests como prueba de despliegue.

## Comandos y alcance

Comando focal: `node tests/categorize-handler.test.mjs`.
El tramo acotado del runner usa `node scripts/run-tests.mjs --plan test-results/categorize-current-plan.json`,
con `build:false`, `deno:false`, `playwright:false`, `e2e:"none"` y las etapas
`categorize-handler`, `categorize-limitador`, `relevant-tests`, `guard-privacy` y `docs-frescura`.
Reutiliza esbuild existente, sin instalar dependencias ni cambiar el lockfile.

Ese plan no ensambla ni toca `public`. La modificación del runner activa suite completa en CI
según el mapa existente: una pasada focal no sustituye esa CI. El corte inicial de arriba
documenta únicamente lo inspeccionado al preparar el cambio; los resultados de cada ejecución
pertenecen a su propio SHA y registro de etapas/exitCode.

## Límites

Los fixtures y los transportes son inventados. La auth probada pertenece al handler:
no prueba `verify_jwt` del gateway. RPC en memoria no acredita RLS ni SQL real; fetch sintético
no acredita el modelo remoto. No resuelve el pin del SDK ni certifica su versión compilada.
La evidencia de servidor vivo permanece separada y privada; no se copian cuerpos del servicio,
URLs privadas, secretos ni movimientos al repositorio.
