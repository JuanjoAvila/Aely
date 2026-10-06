# INC-2709-09 · lifecycle y conectividad · candidata v3

6/10/2026. Encargo `inc-2709-09-sustained-cause-next-20261006`, desde
PR137/head `5cf28328d7c061aa1d99fb6f466512aaef8531ae`.
INC-2709-09 sigue abierto: no hay reproducción espontánea ni causa o fix acreditados.
Validación separable sobre main `e9336aeeac692badc093d463907de1ee8b1d0553`:
solo se traslada el delta de tooling de PR137 y v3; se conserva el contenido de
main en mapas/documentación y no se arrastra producto de beta. La PR138
permanece en draft contra beta. La nueva candidata se revisa contra main.

Solo cambia tooling/documentación; runtime, versiones, catálogo beta y bancos reales intactos.

## Cambio verificable del guion

La variante `lifecycle-network-v3` sustituye los eventos siempre visibles por getters del
fixture `document.visibilityState`/`hidden`, con estados hidden/visible y readback. Dispara
los handlers reales que consultan esos estados. **No suspende Chromium ni una WebView**:
RAF/timers y presión de memoria siguen siendo los de escritorio.

`context.setOffline(true/false)` cambia realmente `navigator.onLine` y la red del contexto.
El cliente Supabase doble no usa sockets: la frontera de `cloud.pullExpenses`, `bankLinks`
y `bankSync` rechaza cuando ese estado está offline y registra started/succeeded/failed,
inFlight/maxInFlight y tiempo agregado. No usa OAuth ni transporte bancario, realtime,
renovación de auth, TLS o reconexión real. No simula corte de una consulta ya en vuelo.

Cada ciclo vuelve a visible offline, exige un fallo del pull; reconecta, pasa hidden/visible,
y exige un pull recuperado. También exige cero sincronizaciones bancarias automáticas y
cero escrituras nuevas del histórico idéntico en ese lifecycle. El sync del banco doble
sigue siendo un botón explícito una vez por ciclo.

Las ventanas guardan RAF lentos, máximo y tareas largas **por acción** además del total.
La atribución RAF usa la acción activa cuando llega el callback (un delta puede cruzar
el límite entre acciones); no es una traza causal. Una marca evaluate por acción y tres
lecturas estructurales de lifecycle añaden coste instrumental: no comparar sus tiempos
contra v1/v2 como A/B de un arreglo. Los snapshots before/offline/recovered guardan heap
natural, nodos/listeners/documentos CDP, DOM, intervalos, stack y escrituras. GC solamente
tras calentamiento y al terminar la sesión normal, nunca entre ciclos; heap retenido se
separa del final natural. El control de bloqueo y recuperación conserva el mismo recorrido.

El informe schema3 identifica guion y HTML por SHA256 y modelos por texto acotado. Guarda
calentamiento y fallo enumerado de forma incremental; no incluye mensajes de error, hosts,
URLs ni datos reales. Las series antiguas están en
[acta histórica](inc-2709-09-repro-20261006.md) y sus copias exactas v1/v2.

## Verificación de esta candidata

- `npm ci --ignore-scripts --no-audit --no-fund`: exit0, dependencias del lockfile.
- `npm run build`, `node --check e2e/rendimiento-sostenido.spec.mjs`,
  `node scripts/check-syntax.mjs`, `node tests/relevant-tests.test.mjs`,
  `node scripts/guard-privacy.mjs`, `git diff --check`: exit0.
- Playwright solicitado con 3.000 gastos y dos ciclos: **exit1 antes del cuerpo del test**.
  El servidor `serve` falla en `uv_interface_addresses`. Un servidor estático Python
  en el mismo proceso de ejecución resuelve la preparación HTTP, pero Chromium149 falla
  al arrancar: `socket() Operation not permitted`, SIGABRT. No se pidió una escalada ni se
  eludió la restricción del runtime. No hay serie v3 ejecutada ni mediciones v3 publicables.
- Fuente/draft durable; revisión independiente y CI del SHA exacto pendientes. No integrar
  ni declarar GO instrumental hasta ejecutar el recorrido en un entorno permitido.

Comando reproducible en entorno con Chromium y servidor de este checkout:

```sh
npm run build
PLAYWRIGHT_CHROMIUM_PATH=<chromium> MC_LAG_CYCLES=2 MC_LAG_SIZES=3000 MC_LAG_SOURCE_SHA=e9336aeeac692badc093d463907de1ee8b1d0553 node node_modules/playwright/cli.js test e2e/rendimiento-sostenido.spec.mjs --workers=1
```

El SHA de source identifica la base runtime; el informe registra también los bytes del guion
ejecutado y el HTML, por lo que no se confunde con un test corrido desde otro commit.
Tras un preflight completo, una nueva sesión larga podrá investigar pendiente por acción y
retención sin repetir automáticamente las series anteriores. Si aparece degradación, atribuir
causa discriminante y A/B reversible antes de proponer corrección. Inputs privados bloqueados.

## Serie larga v3 · 12 ciclos / 5.200 gastos (6/10/2026, sin tendencia)

Base `e96e2aa5`, mismo guion v3 sin cambios (Chromium de escritorio, CPU ×6, viewport Pixel 5,
nube y banco dobles). Tras un preflight de 800 gastos/1 ciclo, la serie pasó (exit0, 6,4 min).
Todos los ciclos aterrizaron (botones, retroceso, scroll táctil, hidden/visible, offline/online,
fallo y recuperación del pull doble); 13 fallos de pull offline y 13 recuperados, 13 bankSync
explícitos (uno por ciclo, incluido el calentamiento) y cero automáticos; cero reescrituras del histórico.

| Medida | Resultado |
|---|---|
| RAF lentos (>32 ms) por ciclo | 32, 27, 25, 28, 31, 27, 25, 29, 21, 24, 23, 23: sin pendiente al alza |
| Tareas largas por ciclo | 11→8; 1011→643 ms |
| Máx. frame por ciclo | 267 ms como pico (ciclo 9), 150 ms en los tres últimos |
| Primeros 4 vs últimos 4 ciclos, por acción | sin acción que empeore de forma sostenida; `foreground-retry` (pull+render tras volver a visible) concentra los frames más largos en ambos tramos (233/267 ms) |
| Heap tras GC (inicio → final) | 15,6 → 16,4 MB; natural 17,8 MB; el checkpoint del ciclo 5 (19,8 MB) bajó a 17,8 MB en el 10 |
| Nodos / listeners / DOM / backStack / timers | 1613 / 470 / 968 / 0 / 1 idénticos al inicio y al final tras GC (los picos 1795/533 son transitorios) |
| Control degradado / recuperado | 4,73 vs 1,18 (normal) vs 1,08 (recuperado) RAF lentos/s: el instrumento distingue el bloqueo |

Lectura: **no se reproduce degradación acumulativa** en esta serie; INC-2709-09 sigue abierto y
sin causa. Una serie de 12 ciclos (~4,5 min de uso) no descarta algo que en el móvil aparece tras
mucho más tiempo o con suspensión real de la WebView, RAF/timers estrangulados por el SO,
presión de memoria, reconexión real de sockets/auth o varias sesiones de nube; ninguna de esas
condiciones existe aquí. Escenario que falta: duración de horas con suspensión real en dispositivo.
Coste instrumental igual que en v3 (marca evaluate por acción, lecturas de lifecycle); los pulls
del arranque quedan fuera del contador de ciclos (el contador de `start` ya incluye los de boot).
