> Corte histórico de la primera candidata `f7bba04d`, entregada en PR255 con
> result77423905. La ausencia observada era en PATH; no acreditaba ausencia de
> una instalación en el perfil. Los remates privados verifican Deno2.9 y131 casos
> reales: [fuente, tiempos y límites](deno-pr255-runtime-real-tests-20261017.md).
> El texto y los resultados anteriores se conservan debajo como evidencia de esa fase.

# Higiene Deno: inventario y candidata privada

Tarea `ops-deno-omitted-tests-codex-20261017`; base exacta main
`a9916c3cdb21c93f9d3a47653c0608e630ce50ab`. Candidata local, sin push de producto,
sin PR ni publicación en el canal durante el hold. El grant original autoriza este
tooling focal; no queda pendiente de un GO financiero adicional.

## Causa reproducida

El bloque Deno real de `scripts/run-tests.mjs` reconoce runtime ausente por
`ENOENT` **o por texto** `not found|no se reconoce|not recognized`. En ambos casos
sale del bucle sin poner `failed=true`. Dos resultados controlados contra ese
bloque sin editar —ENOENT y `Module not found` con EXIT1— dejan `failed=false`.
El control con un fallo de aserción ordinario sí lo pone en true. El repro sale
EXIT1 por los dos contratos incumplidos. Solo se sustituyó `spawnSync`; no se
ejecutó build, Node general, Deno real ni navegador.

## Qué queda fuera en la fuente de CI

Hay diez archivos y diez registros, sin huérfanos ni entradas obsoletas:

| Archivo bajo `supabase/functions/` | Permisos del runner existente |
|---|---|
| `_shared/crypto.test.ts` | `--allow-env` |
| `_shared/enablebanking.test.ts` | ninguno |
| `_shared/myinvestor-counter.test.ts` | `--allow-read=supabase/functions` |
| `_shared/myinvestor.test.ts` | ninguno |
| `bank-disconnect/lifecycle.test.ts` | ninguno |
| `bank-sync/demand-window.test.ts` | ninguno |
| `delete-account/delete-account.test.ts` | ninguno |
| `ingest/ingest.test.ts` | ninguno |
| `ingest/widget.test.ts` | ninguno |
| `prices/prices.test.ts` | ninguno |

- `test.yml/test` (main y PR) y `deploy.yml/test`: setup-deno explícito y lista
  completa si se alcanza la fase. No hay un Deno permanentemente excluido de esa
  lista en esta base.
- `beta.yml/tests`: omite los diez cuando el plan tiene `deno:false` (docs,
  Android, tooling o UI/E2E acotados sin Supabase). Es selección declarada; tocar
  núcleo/workflows o Supabase activa Deno. El publicador va separado del job.
- `promote-beta.yml/promote`: llama al runner sin setup-deno explícito. Los diez
  carecen de provisión garantizada en ese workflow; no se afirma ausencia real
  de Deno en una imagen alojada que no se ha consultado.
- Los jobs opcionales `focal-e2e` y `tr-pair-review` de test.yml y el workflow
  manual `supabase.yml` no incluyen fase Deno. No sustituyen al job general.

Esto es inventario de fuentes del SHA indicado, no lectura de ejecuciones CI.

## Preparación del runner independiente

`run-deno-tests.mjs` acepta inventario, selección focal o `--all` explícito.
Descubre disco, valida selección antes de ejecutar, comprueba Deno una vez, corre
serialmente y detiene el primer fallo sin reintentos. Emite JSON con ejecutados,
pases, fallos, pendientes y salida real del proceso. No decide disponibilidad por
el texto de los errores ni transforma un fallo en omisión verde. Ausencia de
runtime/errores de ejecución salen2; fallo de test sale1; pase completo sale0.

Se han ejecutado ocho contratos Node del runner nuevo: EXIT0, sin skips. Los seis
mutantes salen1: runtime ausente verde, módulo no encontrado omitido, pérdida de
descubrimiento anidado, shell activada, permisos generales y continuar tras fallo.
La invocación focal real sin Deno devuelve EXIT2, cero tests ejecutados y el
archivo solicitado pendiente. `--list` devuelve inventario de diez y executed0.
Estas comprobaciones no son pases de los diez tests Deno financieros.

## Alcance terminado y seguimiento separado

La candidata entrega el runner focal independiente, sus ocho contratos Node
registrados en `steps` y este inventario. No sustituye el bloque Deno del runner
general ni cambia el alcance de los planes de beta. Esas mejoras quedan como
seguimiento concreto, sin bloquear el alcance focal autorizado:

1. Sustituir la ejecución Deno del runner general por la misma lógica estricta,
   conservando `plan.deno:false` como omisión declarada y el guard de registro.
   La ausencia de runtime cuando se pidió Deno debe ser fallo explícito.
2. Preparar Deno explícitamente en promote antes de llamar al runner. Ese workflow
   está fuera del alcance de archivos actual: requiere concesión específica.
3. Revisar el impacto con los titulares que también tocan `run-tests.mjs`; no
   integrar una copia vieja de la lista. Completar la referencia en el árbol del
   README, fuera del alcance de documentación actual, cuando se amplíe ese scope.
4. Tras recibir turno de publicación, publicar la candidata y su entrega con
   evidencia exacta. No se han publicado consultas, resultados, PR ni fuentes.

El bloque Deno del runner general y todos los workflows siguen sin cambiar.
No se ha instalado Deno, consultado red/BD/bancos, corrido suite completa/CPU6,
compilado Android ni desplegado. No se tocaron 09/Deudas/Metas, VERSION,
catálogo, caps ni oráculos. Claim propio abierto y presupuesto preservado.
