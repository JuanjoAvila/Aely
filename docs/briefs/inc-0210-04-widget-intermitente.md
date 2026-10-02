# INC-0210-04 · Widget con aviso intermitente tras un pago

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
