# INC-2909-01 · Widget: periodo y magnitud

**30/9/2026 · Claude, encargo del coordinador (implementación). E1 y E2 implementadas; nada publicado ni desplegado.**

## Síntoma

El dueño dijo el 30/9: «el widget solo enseña Balance, Inicio Mi ciclo».

## Auditoría (sintética, sin datos reales)

| Escritor | Qué mandaba | Ventana |
|---|---|---|
| Web, app abierta (`11-app-main`, `budW`) | `monthBudgetStats(state, now).shown` → en Balance, \|ingresos − gasto\| | mes natural (con `nowMs` explícito se ignora el ciclo) |
| `ingest`, app cerrada (`statsDelMes().shown`) | la misma regla | mes natural (`inicioDeMesMs`) |
| APK 51 (`MiCarteraWidget`) | pinta «AELY · ESTE MES», «gastado este mes», «de X este mes · te quedan Y» | descarta `periodStart` ≠ día 1 (`saveApp`) |

Web e `ingest` eran coherentes entre sí, así que no había mezcla entre rutas. El fallo era de contrato: el widget dice «gastado» y recibía el balance. Con nómina, un superávit de 1.480 € se pintaba como gastado y «te quedan» salía del neto.

## E1 (esta entrega)

- **Contrato:** el widget recibe exactamente lo que dicen sus textos, el gasto bruto del mes natural y lo que queda tras reservas. Coincide con «Has gastado» de Inicio fuera de Mi ciclo (INC-2909-02).
- **Web:** `widgetBudgetStats`.
- **Servidor:** `statsDelMes(…, modoForzado)`; `ingest` pide `"split"`, y `spent`, `budgetLeft`, deltas y avisos quedan en bruto.
- **Orden de despliegue:** Edge `ingest` (una función, OK expreso) antes que la web, o a la vez. Al revés, con la app cerrada vuelve el balance hasta reabrir. `ingest` **no está desplegada**. El OTA no arregla la ruta con la app cerrada.
- **Mi ciclo:** con el ciclo activo, el widget sigue en mes natural y lo dice («ESTE MES»). No enseña una ventana distinta de la que anuncia.

## Evidencia

- `widget-coherente`:
  - En Balance con nómina, la app y el servidor mandan 500 (no 1.300) y el mismo «te quedan».
  - Sin modo forzado, el servidor conserva la regla de Gastos.
  - Con Mi ciclo activo, la ventana del widget sigue siendo el día 1.
- `ingest-handler`, con el handler real: spent 320 (no 1.480), budgetLeft 680, shownDelta 20. Cae sin `"split"`.
- e2e `widget-banco` en es/en/ca: el payload coincide con «Has gastado 600» de Inicio. Con Mi ciclo, `periodStart` = día 1 y gasto 850. Las cuatro caen con el cálculo anterior (`monthBudgetStats`).
- Runner Node y docs-frescura en local y UTC: ver el PR.

## E2 (implementada, sin publicar)

- **Contrato v2.** La web manda `contract:2`, `periodKind` ('ciclo' o 'mes'), `periodStart`, `magnitude` ('neto' o 'gasto') y `lang`, con las cifras de `dashboardBudgetStats` (Inicio). Solo lo hace si el nativo responde `widgetContract() → {v:2}`; la APK 51 no tiene el método y se queda en E1.
- **Nativo** (`WidgetPeriod.java`):
  - acepta el ciclo si empezó hace 45 días o menos, y un ciclo que cruza el día 1 no caduca;
  - título y textos en es/en/ca;
  - rechaza respuestas de un `ingest` que no sea v2 de la misma ventana. Si el pago falta en la foto de la app, pinta «Abre la app para actualizar».
- **`ingest`:**
  - sigue `app_state.widgetPeriod` (`start` y `anchor`, que es la nómina que abre el ciclo) sin reconocer nóminas;
  - en el ciclo usa `statsDelCiclo`, espejo del de Inicio;
  - sin ventana válida, mes natural en bruto.
- **APK:** candidata 52 / 4.26.76 compilada y firmada en local (`CN=Mi Cartera`, bundle sellado 4.26.76, SHA-256 `311a7c29…9734`). El repo sigue en 51, porque `apk.json` no puede anunciar una APK sin publicar. El bump real lo hace `npm run release:apk` cuando lo decida el coordinador.

## Qué queda y en qué orden

1. **`ingest`** (una función, OK expreso), antes o a la vez que la web.
2. **Web 4.26.76** a beta.
3. **APK 52** beta, con `versionCode` coordinado.

Hasta que `ingest` esté desplegada, con la app cerrada:
- con APK 52, el widget dice «Abre la app» tras un pago, sin cifra falsa;
- con APK 51 y web nueva, vuelve al balance hasta reabrir (el riesgo de E1).

Los avisos de umbral de `ingest` (`TrExpenseListener`) siguen diciendo «este mes» en castellano: no forman parte de esta entrega.
