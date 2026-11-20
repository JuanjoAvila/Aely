# Rojos de beta 4.26.248 — veredicto

Corte: `e1e95c6f40eb479e3e739b4cddf7fda57dae49a6` (`origin/beta`, 4.26.248).
Rama de este informe: `cursor/rojos-beta-248`. No está en `beta` ni en `main`.
No se ha tocado producto, `VERSION`, catálogos ni notas de versión.

Los ocho rojos son tests atrasados respecto a la 4.26.247 (DIN-05, `subirGastosEnLotes`, F-10 y Mis bancos D1). Ninguno es un fallo de dinero, de sync o de fechas del producto. Las cifras que el test ya exigía (cero subidas en el ciclo vacío, una sola fila viva en el backfill, saldo distinto de 100000 céntimos en el mutante diario) siguen igual y pasan.

## Evidencia de CI (antes de este arreglo)

- Unit, SHA `e1e95c6f40eb479e3e739b4cddf7fda57dae49a6`: run [44823860531](https://github.com/JuanjoAvila/Aely/actions/runs/44823860531), job `unit` 136591477685, Node 20.20.2, exit 1. Fallan fin36, fin11 (test 19), refund-polarity (not ok 147, 186 y 187), debts, recibos-bajas-y-union (test 13), ob-iguales-ordinal y expense-note.
- `e2e-perf` de ese mismo run no ejecutó `rendimiento-sostenido` (el plan era «specs e2e tocados»).
- El último perf que sí lo corrió: run [44529720400](https://github.com/JuanjoAvila/Aely/actions/runs/44529720400), job 135579732109, commit `02a58340` (19/11/2026). Tamaños 3000 y 5200, los dos: `expect(report.warmup.valid).toBe(true)` en `e2e/rendimiento-sostenido.spec.mjs`.

## Evidencia local

Node v22.23.4. El reloj del sistema es `Etc/UTC` (`/etc/localtime`).

Antes del arreglo, con el huso del sistema (UTC), exit 1 en los siete unitarios. Un intento paralelo escrito como comando `TZ=UTC` (sin `env`) salió 127: el shell no encontró ese programa. No cuenta. La pasada que sí fija el huso es la de después, con `env TZ=…`.

Después del arreglo, en `/agent/repos/Aely`, los siete salen 0 con `env TZ=UTC` y con `env TZ=Europe/Madrid`:

| Comando | exitCode |
|---|---|
| `env TZ=UTC node tests/debts.test.mjs` | 0 |
| `env TZ=UTC node tests/fin36-debt-madrid-month.test.mjs` | 0 |
| `env TZ=UTC node --test --test-concurrency=1 tests/fin11-absorption-pending.test.mjs` | 0 |
| `env TZ=UTC node --test tests/refund-polarity.test.mjs` | 0 |
| `env TZ=UTC node tests/recibos-bajas-y-union.test.mjs` | 0 |
| `env TZ=UTC node tests/expense-note.test.mjs` | 0 |
| `env TZ=UTC node tests/ob-iguales-ordinal.test.mjs` | 0 |
| Los mismos siete con `env TZ=Europe/Madrid` | 0 |

`e2e/rendimiento-sostenido.spec.mjs`, pasada corta (el rojo de CI es el calentamiento, no la serie larga):

```
env TZ=UTC PLAYWRIGHT_CHROMIUM_PATH=/tmp/chrome-nosandbox MC_LAG_CYCLES=1 MC_LAG_SIZES=80 MC_E2E_PORT=4471 MC_E2E_OUTPUT_DIR=/tmp/sustained-80b MC_E2E_REPORT=/tmp/sustained-80b/report.json node node_modules/@playwright/test/cli.js test e2e/rendimiento-sostenido.spec.mjs --workers=1
```

exitCode 0 (2,2 min). La pasada anterior, con 400 ms de espera al cerrar la ficha, salió 1: el calentamiento moría en `banks-ficha-back` porque la hoja tarda 420 ms en desmontarse. Con 850 ms, el mismo margen que el resto de atrás del guion, aterrizan ficha, sync, perfil, Apuntar y el control de bloqueo (`slowRate` normal 0,27 / degradado 4,10 / recuperado 0,14). No se ha repetido el tamaño 3000/5200 de CI.

## Tabla

| Rojo | Veredicto | Causa | Cambio |
|---|---|---|---|
| `tests/debts.test.mjs` | Test atrasado | DIN-05 recorta el día 31 al último del mes. En el reloj `2026-09-30T21:30:00Z` (Madrid, 30 de septiembre) un cargo el 31 ya es hoy: `debtLeft` devuelve 3 y el saldo de 79,96 € baja una cuota de 19,99 € (5997 céntimos). El test pedía 4 y 7996. En los otros siete relojes sigue pidiendo 4 y 7996. | Solo el esperado de ese reloj. `debtLeft` no se toca. |
| `tests/fin36-debt-madrid-month.test.mjs` | Test atrasado | El ancla contaba `madridYmdParts(Date.now()).d`. DIN-05 guarda el día en `hoy` y compara `hoy.d`, así que el trozo aparecía una vez (1 !== 2). Sigue habiendo una sola llamada a `madridYmdParts(Date.now())` dentro de `debtCuotasDesdeAncla`. | El mutante sustituye esa llamada por `{y,m,d}` de `new Date()` local. Sigue exigiendo que el saldo de ese mutante no sea 100000 céntimos. |
| `tests/fin11-absorption-pending.test.mjs` test 19 | Test atrasado | F-10 guarda la cadena en `const enCurso` y `runBankSync` hace `return enCurso`. El recorte del arnés acababa antes de ese return, así que `api.run()` era `undefined` (`Cannot read properties of undefined (reading 'then')`). La barrera `Promise.resolve().then(retryObAbsorbedCloud)` sigue en el producto. | El arnés devuelve `enCurso`. |
| `tests/refund-polarity.test.mjs` zero-cycle-r2 (not ok 147, 186, 187) | Test atrasado | `ReferenceError: subirGastosEnLotes is not defined`. Desde la 4.26.247 el repaso del pull sube el lote, no fila a fila. Los tres casos (`three-real-sync-pull-rounds`, `local-other-sources-survive-real-pull`, `mutant/import-guard`) morían al evaluar el bloque, antes de mirar cifras. | El sandbox recibe `subirGastosEnLotes` y anota cada fila igual que anotaba `subirGasto`. Los esperados no se han aflojado: tres rondas `{uploads:0,notices:0,rewrite:false,count:0}` y el caso de otras fuentes locales sigue igual. Pasan. |
| `tests/recibos-bajas-y-union.test.mjs` test 13 | Test atrasado | La regex solo veía `subirGasto` y `borrarGastoNube`. `backfill` sale por `subirGastosEnLotes(backfill, "backfill")`, así que `usadas.size` bajaba de 7. El origen sigue en `GASTO_ORIGENES` y el segundo bucle del test sigue exigiendo que cada puerta usada esté en esa lista. | La regex incluye `subirGastosEnLotes`. |
| `tests/ob-iguales-ordinal.test.mjs` | Test atrasado | El regex del backfill buscaba `subirGasto(e, "backfill")`, que ya no está. El filtro de lápidas (`!expenseIsTombstoned`) sigue delante del lote. | El regex y el doble apuntan a `subirGastosEnLotes`. El esperado no cambia: solo sube `backfill:12`; la lápida de 29,9 no sube. Pasa. |
| `tests/expense-note.test.mjs` | Test atrasado | `renameFalloDeRed` está ahora también en `subirGastosEnLotes`. `String.replace` solo tocaba la primera, así que el mutante «red cuenta como rechazo» no llegaba a la cola de renombrar y `networkQueueWitness` no lanzaba. | El mutante apaga la guarda única de la cola: `if(renameFalloDeRed(err)){ if(p.fail)p.fail(orig,null,false,true); return; }`. |
| `e2e/rendimiento-sostenido.spec.mjs` | Test atrasado | D1 quitó el acordeón. El calentamiento hacía click en `[data-aspsp="Sabadell"] .v4-mov` y exigía `.bk-actions`. La fila es el botón y abre `[data-bk-ficha="Sabadell"]`, que se cierra con atrás (`useBackClose` + hoja de 420 ms). | Click en la fila, se comprueba la ficha, atrás y 850 ms, y después el atrás que ya cerraba Mis bancos. |

## Qué no se ha hecho

- Cero cambios en `src/`, `public/`, `VERSION`, `package.json`, `CHANGELOG.md`, `RELEASE_NOTES`, catálogos y `docs/ROADMAP.md`.
- Cero merge, cero push a `beta` o `main`, cero deploy.
- La pasada de CI de esta rama queda fuera de este corte: este documento registra lo ejecutado en local.
