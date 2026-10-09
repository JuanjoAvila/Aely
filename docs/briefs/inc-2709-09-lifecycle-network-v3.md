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

## Serie larga v3 de 30 min efectivos (6/10/2026, entorno Cloud Linux)

Encargo `inc-2709-09-duration30-claude-20261006`, sobre main `6f035b09bc873ed102029aad9ddfe89efa78bb40`.
INC-2709-09 **sigue abierto**: una serie sintética sin pendiente no descarta el síntoma humano.
Chromium 141 de escritorio con viewport Pixel 5, CPU×6, fixture sintético de 5.200 gastos,
`MC_LAG_CYCLES=80`. Único cambio de tooling: el timeout del test pasa a `cycles*30000+300000`
(con la fórmula anterior, 80 ciclos de ~23 s no cabían). Sin pausas añadidas: los ciclos
son los de v3 y duran 22,6-23,2 s. Hashes: guion `9538afa0…9d69e`, HTML `cdd42115…7429c`.

- Calentamiento 23 s, 80 ciclos normales = **30,5 min efectivos**, todos aterrizados (`valid`).
  Control de bloqueo ×2 y recuperación válidos; diagnóstico de acción ausente trazado. Test OK (32,5 min).
- Ventanas de 10 ciclos (frames >32 ms por minuto / tarea larga ms por minuto / maxFrame ms):
  160/3811/417 · 161/3527/317 · 150/3537/417 · 155/3772/367 · 194/4048/383 · 174/4107/550 ·
  161/3920/367 · 165/3897/483. Sin tendencia monótona; la ventana 41-60 sube ~15 % y vuelve en 61-80.
  Pendiente lineal por ciclo: +0,16 frames lentos/min por ciclo (≈8 % en 80 ciclos), dentro del ruido
  entre ventanas: **no se acredita pendiente**. Tasa global normal 2,75/s, control 5,63/s, recuperado 3,18/s.
- Retención (heap natural, sin GC entre ciclos): inicio 14,8 MB; checkpoints 16,7-19,2 MB en dientes de sierra;
  final 19,8 MB natural → 16,5 MB tras GC final. Nodos 1613→1795 (vuelve a 1613 en el ciclo 50 y tras GC),
  listeners 470→533 (igual), documentos 1, DOM 968, intervalos 1, backstack 0: acotado, sin fuga detectada.
- Contadores: 81 sync de banco explícitos (uno por ciclo + 1 del calentamiento), cero automáticos;
  81 pulls offline fallidos y 81 recuperados; `expensesWrites` constante en 1 (cero reescrituras del histórico);
  maxInFlight 1; 4 peticiones externas bloqueadas.
- Por acción, 1.ª mitad vs 2.ª mitad: las diferencias (p. ej. `scroll-up-inicio`, `scroll-up-gastos`)
  son del orden del ruido y sin patrón de una sola acción; no hay primer tramo/acción que localizar,
  por lo que **no se propone A/B ni corrección**.

Límites: no es una WebView ni suspensión del SO, ni sockets/auth/realtime reales; RAF de escritorio;
una sola semilla y una sola pasada (sin repetición ni IC). Un recorrido de 30 min a ritmo de guion
no equivale a días de uso ni a la memoria de un móvil real. Sigue pendiente el input humano.


## Lectura en vuelo · contrato separable 8/10

Preparación de tooling desde main `56c7e328ce801f0e2e2fe5ec1ebd36169f0ac89b`, sin
runtime de la candidata Plan. La serie v3 original y sus cifras permanecen intactas.
`e2e/lifecycle-inflight.spec.mjs` cubre el hueco que v3 declara: no retiene una lectura
cuando cambia la conectividad. Reutiliza cuenta, gasto y nube inventados del fixture;
las respuestas A/C son idénticas y no se contacta ningún banco o servicio externo.

A se retiene después de obtener las filas del doble y antes de entregarlas a App.
Hidden/offline/visible inicia B, cuyo rechazo offline se confirma; online/reentrada
inicia C, que termina y deja lastSync persistido nuevo. Sólo entonces se libera A
como éxito antiguo o rechazo tardío. Dos contratos exigen tres starts, settlements y
drenaje; comparan bytes íntegros y contadores de escritura desde C. Hidden vuelve a
volcar el commit de React para no ocultar una escritura por debounce. También vigilan
rechazos no manejados y cero bankSync automático. Los finally liberan y recogen todas
las promesas retenidas y restauran los wrappers. Un pendiente durante este orden
es una precondición de la carrera, no una norma maxInFlight1.

Offline es real en el contexto Chromium; el error de la promesa se inyecta en el doble.
No acredita cancelar sockets, suspender la WebView, reproducir acumulación ni explicar
el lag. Fuente, versiones, public, workflows y presupuestos quedan intactos. Navegador
local no disponible en el runtime de preparación original: sólo checks de fuente, registro, sintaxis y
privacidad. La fuente183 tiene CI37810907496 SUCCESS; el port sobre main106 requiere revisión y CI exactas propias antes de integrar. No se repite la serie de 30 minutos.

### Port sobre main106 · comprobación local 8/10

Base `b1ad23f34f2a94933e57246dfdf12c451f5360a1`, sin delta runtime. Pasan sintaxis del
spec/mapa, build, sintaxis del HTML, relevant-tests, privacy y docs-frescura. El HTML
servido coincide byte a byte con el local, SHA256
`c7477df17c406c71655c8c9d1b3aac361ff3dcd118939fe4a0dfa980cc76341e`.
Chromium149, viewport Pixel5, worker1/retry0: **2/2 contratos pasan**; tres starts y
cero pendientes, rechazos no manejados y bankSync automáticos en ambos finales.

Control causal: al retirar sólo `ps!==wS.current` del HTML temporal, el mismo caso
de éxito antiguo falla en la comparación de persistencia: las escrituras del estado
pasan de una a dos y cambian lastSync/_savedAt. Se restauran los bytes y el hash
oficiales, también verificados por HTTP. La fuente permanece intacta. Este control
acredita que el contrato detecta esa escritura tardía; mantiene todos los límites
sintéticos anteriores. CI exacta del port y revisión independiente pendientes.
