# INC-0210-04 · Widget con aviso intermitente tras un pago

## Candidata89 · 3/10/2026 · sustituye el diagnóstico sin runtime del 2/10

PR105 conserva fuente base `3467bbd4`; el chat nuevo retoma la rama original sin otro autor activo.
PR104 fusionado: beta `55d8123f` tiene árbol idéntico, permite retargetear PR105 sin arrastre.
Reserva `4.26.89` concedida por el coordinador. El estado «solo documentación/tests» de los
párrafos históricos de abajo describe `c13435cd`, no esta candidata. Ninguna de las pruebas
atribuye todavía la captura original a una causa física ni cierra FIN-05.

### Defecto reproducido y corrección

`pendingUnknown()` y `invalidateScope()` dejaban un salto final en `unknownJournal`. Tras
reiniciar, el XML Android puede añadir indentación después de ese salto, como ya se protegía
en el journal de deltas. `app()` ignoraba solo `line.isEmpty()`: una línea de espacios se
dividía en un único campo, activaba `journalFull` y rechazaba la foto completa, incluso con
ACK exacto. Prueba roja ejecutada sobre la fuente anterior, en Java real, y verde con el arreglo.

Ahora ambos escritores separan entradas sin salto final; el lector omite líneas blancas y
normaliza espacios exteriores solo de la identidad. Conserva el segundo campo y el separador
tabulado, incluidos los gastos sin clave todavía. Daño real, identidad vacía y exceso siguen
bloqueando; abrir sin ACK conserva `unknownPending`. La huella cruda `v1_test` no cubre la
clave `tr:trade_republic:v1_test`: solo se retira por esa identidad canónica o su lápida.
No se modifica `TrExpenseListener`, `MiCarteraWidget`, el bridge ni `claveEvento`.

### Matriz sintética y otros defectos separados

| Secuencia | Evidencia / resultado |
|---|---|
| App abierta o cerrada, snapshot previo, POST sin red | Método `postIngest` real: reserva ticket, devuelve retry, no activa ninguno de los tres bloqueos; no demuestra un importe nuevo. |
| Cola, listener recreado, retry503/429, respuesta200 | Métodos de cola/POST/hash reales, HTTP y prefs en memoria: mismo body/evento, cola retenida hasta éxito y una sola recepción;401 descarta. |
| Reinicio con pendiente y XML indentado, app abierta sin ACK | Árbitro Java real: mantiene identidad/cifra guardada y `unknownPending`, pero ya no inventa corrupción. |
| Recuperación con ACK crudo y después canónico | Crudo no desbloquea; canónico limpia el registro y acepta la cifra confirmada. |
| Mes/ciclo, cambio de banco/alcance, respuesta incompatible, lápida | Guardianes Java existentes y ampliados; no trasladan deltas entre selecciones ni acreditan por fecha. |
| Arranque con puente colgado | Negociación web real con reloj controlado: timeout→waiting→retry→v2; no degrada contrato. El timeout del puente no demuestra pérdida de Internet. |

Dos defectos quedan registrados aparte, **sin reparación ni atribución a la captura**: un POST
fallido no marca que la cifra previa ya puede quedar incompleta; y la cola no tiene callback de
red, solo se vacía tras otra notificación o conexión del listener. El retorno de Internet solo
no garantiza reintento. Resolverlos exige contrato de identidad/fin de incertidumbre y ensayo
nativo propio; no reemplazarlos aquí por un saldo calculado del texto de la notificación.

`widget-offline` está registrado en `steps`; extrae y compila los métodos originales, sustituyendo
solo HTTP, JSON y preferencias. Esa representación en memoria no prueba persistencia Android,
concurrencia del servicio ni reconexión del sistema. `widget-arbitraje` compila el árbitro
completo. Se añaden casos múltiples, reinicio, ACK, cambio de periodo y corrupción sin datos reales.
No hay cambio de DOM ni uso de Chromium. Verificación local final: 12 etapas pertinentes
PASS/exit0 (121,3s), seis etapas de catálogo PASS/exit0 (470,5s), build final PASS y
`git diff --check` PASS. Incluye sintaxis del HTML, es/en/ca, privacidad, frescura, mapa,
seguridad, identidad ingest, Java y negociación. `beta-sources` muta 982 dependencias y305
datos; alias/compatibilidad y alcance nativo siguen protegidos. El último ajuste del test de
transporte, que extrae también constantes reales, tiene ejecución propia PASS/exit0.
Deno y Chromium omitidos localmente; la CI completa del SHA final se registra en PR105.
Una suite local acotada no equivale a `npm test` completo ni a dispositivo físico.

### Entrega nativa pendiente

VERSION/paquetes/notas/docs identifican candidata89. Gradle y `apk.json` conservan APK80/code52
real: no se inventa una descarga89. El bump `versionName89`/nuevo code se realizará al preparar
la APK específicamente autorizada. No se construye, instala ni publica una APK, ni se despliega
web, Edge o SQL. Las notas explican «próxima actualización de Android»; `tandas:[]` evita ofrecer
una nueva comprobación nativa que esta tarea todavía no puede entregar. La aceptación física
existente Widget/FIN-05 sigue pendiente y su huella debe recalcularse al integrar el Java cambiado.

## Diagnóstico histórico de c13435cd · 2/10/2026

## Observación y frontera

El 2/10 el dueño capturó el widget con el título «Mi ciclo · Gasto neto», un guion en lugar de la cifra y «Abre la app para actualizar» después de pagar. No pudo repetirlo. La captura es privada; no se incorpora al repositorio. No constan en esta tarea las preferencias nativas de ese instante, la respuesta de `ingest` ni un nuevo ensayo en el dispositivo. La observación **no identifica cuál de los tres bloqueos se activó**.

En `MiCarteraWidget.build()`, ese subtítulo con el título v2 indica que la ventana guardada no estaba caducada en el momento de pintar: una ventana caducada enseña «Sin datos» en vez de «Abre la app». El guion puede venir de `unknownPending` (pago sin cobertura demostrada), `journalFull` (registro que no se puede arbitrar con seguridad) o `negotiating` (el puente web/nativo aún no confirmó el contrato). En los tres casos las cifras anteriores permanecen en preferencias, pero no se muestran como actuales. El reloj visible en la captura no demuestra cuál ocurrió.

## Contrato auditado

`saveMonth()` compara periodo, contrato y alcance antes de aceptar una respuesta del servidor. Un widget v2 de ciclo no admite una respuesta mensual anterior ni una respuesta sin el mismo alcance; si trae una identidad nueva, `pendingUnknown()` la conserva y marca `unknownPending`. La foto de la app solo retira ese bloqueo si el pull acredita el evento exacto o su lápida. Reabrir por sí solo no equivale a ACK. La fuente `supabase/functions/ingest/index.ts` en la base `3467bbd4` construye una respuesta mensual sin `contract`, `periodKind` ni `scope`; **la fuente del repositorio no prueba qué función estaba activa** durante el pago.

El test registrado `tests/widget-arbitraje.test.mjs` ejecuta Java real con un pago y cifras ficticios: una respuesta mensual incompatible dentro de un ciclo vigente conserva la última foto y la identidad pendiente; un reintento no duplica esa identidad; abrir sin ACK mantiene el aviso; el ACK exacto recupera las cifras. Una respuesta v2 compatible no activa el bloqueo. El guardián existente también cubre cambio de mes, alcance, evento no cubierto, registro dañado y negociación con timeout. No hay prueba roja de un defecto nuevo ni modificación de comportamiento en esta tanda: reemplazar el guion por el último importe ocultaría la incertidumbre de una compra real.

Pruebas locales sobre la fuente 4.26.82: `widget-arbitraje` (javac/Java real) PASS, `widget-coherente` PASS, sintaxis de los scripts HTML PASS, `guard-privacy` PASS, `docs-frescura` PASS y `git diff --check` PASS. Los dos guardianes ya estaban registrados en `scripts/run-tests.mjs`; no se añadió un test huérfano. No se ejecutó Chromium ni CI completa: el cambio solo caracteriza y protege el contrato existente, sin modificar app, Java o backend.

## Estado y próxima evidencia

**Abierto como incidente intermitente, sin causa atribuida ni fix de runtime.** No se ha instalado APK, usado el móvil, tocado notificaciones, desplegado backend, cambiado preferencias ni publicado una beta por este análisis. La versión fuente sigue en 4.26.82; la integración y publicación de PR104 pertenecen al coordinador.

Si reaparece, conservar la notificación y la pantalla antes de abrir Aely. Con autorización específica para diagnóstico del móvil, leer **solo** contrato/periodo/alcance y los tres indicadores `unknownPending`, `journalFull`, `negotiating`, más las identidades pendientes y la versión activa de `ingest` sin copiar movimientos o importes al repo. Contrastar después el evento exacto con el pull/ACK y comprobar si al abrir se resuelve. Solo esa evidencia permite decidir si faltaba cobertura legítimamente o si hubo invalidación indebida; cualquier corrección nativa requerirá APK nueva y prueba de pago real antes de cerrar FIN-05.
