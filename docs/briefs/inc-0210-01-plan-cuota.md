# INC-0210-01 · Cuota contabilizada antes del vencimiento

Encargo humano del 2/10/2026. Propietario: agente Plan/cuota coordinado por el chat de entregas del 2/10. Rama `codex/inc-0210-01-plan-cuota`, base exacta `3467bbd4fddcd213f862bedddac971c827099f3d` (candidata82). Versión reservada83, candidata sin publicar. Revisión independiente, CI exacta, integración y aceptación móvil siguen pendientes. APK/Edge/SQL intactos.

## Síntoma y causa

Un cargo sintético vinculado con `debtId` y contabilizado el día anterior al vencimiento ya aparece en Gastos como cuota que cuenta en Plan, pero Plan conserva la cuota en pendiente. El calendario decide ese estado sin leer el cargo vinculado; Inicio y los eventos pendientes del motor repiten la misma previsión.

`debtPaymentState` acredita el vínculo explícito, identidad única de deuda y cargo, igualdad de céntimos EUR de cuota más pago final, fecha válida/no futura, ausencia de lápida y feed sin PDNG/duplicados contradictorios. La cercanía al vencimiento asigna el mes de la cuota, también en la frontera del día1. Sin día fiable no inventa el mes. Dos cargos vinculados compatibles no se eligen por orden. Un préstamo parecido permanece pendiente. Los cambios de categoría que retiran el vínculo no acreditan un pago: las rutas reales de asignación/importación crean `category:deudas` junto al vínculo; Gastos lo retira al cambiar esa categoría.

La lectura alimenta Plan/Inicio/eventos pendientes y conserva el banco real si el pago viene de otro banco. El memo de Plan depende ahora de gastos y lápidas: un cargo recibido con Plan abierto cambia la lista sin reentrada. Un pago del mes anterior conserva en la fila el día de vencimiento del mes mostrado; no fabrica una fecha futura.

## Dinero y límites

`amount` es EUR canónico; `origAmount/origCur` solo conservan el original. No se reconvierte ese rastro. Importes desconocidos o un esquema no normalizado con `cur/currency` distintos de EUR no acreditan. Se conservan `monthNetForAccount`, el principal proyectado, cuentas y anclas: reconocer un cargo que el banco ya incluyó no lo resta otra vez del saldo actual. Solo retira su evento futuro y mueve la cuota del pendiente al pagado; no enlaza por nombre, no recategoriza histórico ni marca manualmente el recibo para ocultarlo.

La semántica anterior por calendario de las deudas con día ya alcanzado no se rediseña en esta tanda. La deuda sin día conserva el caso desconocido de Plan y su ajuste previo de cobertura. Las pruebas no acreditan el cargo familiar real, el feed/RLS real ni una compra o aprobación móvil.

## Pruebas y estado

- Rojo Node contra la fuente3467: cuota sintética60 sigue pendiente frente a0 esperado.
- Contrato Node `tests/debt-payment-state.test.mjs`, registrado en `run-tests`:32/32 PASS, incluidos59 frente60 y decimal0,1+0,2 frente0,3, fecha/mes ISO imposible e importe infinito, además de pago previo, ambigüedad, otra deuda, PDNG/BOOK, identidad, lápida, frontera de mes, ausencia de día y divisa/rastro.
- DOM `e2e/plan-cuota-contabilizada.spec.mjs`, registrado en el mapa:30/30 PASS (37,4 s) en es/en/ca, Gastos/Inicio/Plan, recarga, recepción cloud con Plan abierto, otro banco, ausencia de día, frontera y negativos, importe centesimal y cuota más pago final desglosados sin duplicar el cargo. HTML final SHA-256 `af2a6e3ee837eb389dfae53c8b747cb21796d6d4eccad54e15712a697004ed27`.
- Panel mantiene el catálogo real y exige los17 IDs exactos al probar la ronda mixta; los recibos de las siete tandas anteriores no ocultan las diez nuevas. No se aíslan notas ni se repina ninguna referencia histórica.
- Regresión previa Plan/Gastos/Inicio/panel:168/168 PASS (8,5 min), anterior a las últimas guardas. Ampliación Plan-cover y focal:50/50 PASS. El anterior focal24/24 (31,4 s) usó el bundle `b12409f94d29f9f4c47ffbf8a0f0bfde212781381545a8cc78c31963f81ec9c2`; el final30/30 amplía importe centesimal y pago final sobre el HTML exacto indicado arriba.
- Suite Node ejecutada por tramos para no repetir etapas ajenas: primer tramo desde el inicio hasta logos-bancos, continuación completa desde logos-inversiones hasta updates, y focal32 final. Las primeras ejecuciones concurrentes con scopes en edición se descartan. La prueba decimal descubrió el parámetro numérico `t` ocultando al traductor global en planChargesMonth; se renombró a `today` y se repitió el recorrido real, sin esconder la rama. Guardianes finales de huellas PASS:1.048 funciones/dependencias y320 datos mutados, incluidos proof/identidad/feed/lápidas/ventana83. La fixture de compatibilidad conserva un positivo real de Retirada955 y exige que los ocho cambios financieros actuales no equivalgan al histórico; no asume que Inicio-natural pueda heredar su código anterior. El espejo local de memoria presenta deriva previa, sin permiso para actualizarlo; Deno no está instalado. No se presenta un PASS integral único ni aceptación remota a partir de esos límites.

## Identidad, tamaño y limpieza

El descriptor83 cubre dependencias financieras, identidad, feed, lápidas y datos/cachés compartidos mediante el extractor existente. Los mutantes de función y dato deben mover su huella. El cierre transitivo requiere nuevas dependencias en ocho tandas anteriores: `fin05-pago-cerrada`, `fin05-widget-reentrada`, `inc-2909-01-widget-periodo`, `inc-2909-02-inicio-natural`, `inc-3009-01-cargos`, `inc-3009-nomina-anticipada`, `widget-app-cerrada`, `widget-banco`. Son cambios de contrato reales; las referencias históricas y guiones ajenos se conservan, sin equivalencias ficticias.

A/B de copias sintéticas con el mismo minificador y sello: base82.99,1.292.900 B min/351.909 B gzip9, SHA-256 `4f5884605fa5111eda98fd39a1050a3d63f7268f7eb7af177b102f3c57d9aa08`; final83.99,1.294.831/352.341 B, SHA-256 `44b641df7cb5373968fc2917a98744112394a3122cf0f59f7408a072ed2fc358`. Delta1.931/432 B. Mínimos1265/345 KiB autorizados por el coordinador tras A/B; margen529/939 B. Guardián exacto PASS, tres recursos bloqueantes.

Leases37 y40 cerrados expresamente: Chromium/servidor propios terminados, CLI0, puerto4452 ECONNREFUSED e inventario scoped sin procesos. Las copias A/B se eliminaron tras comprobar sus rutas; métricas/JSON quedan como evidencia local ignorada. No hay sondas en el árbol versionado.

No hay producción, beta publicada, APK nueva/instalación, cambios de backend ni datos privados en esta entrega. No se borran ramas/worktrees.

## Corrección de integración · 3/10/2026

La revisión independiente retiró el GO de8587 y dac44322 para el contrato de saldo: un vínculo manual o de notificación sin BOOK podía retirar la previsión antes del vencimiento sin débito en el saldo. La unión85 corrige debtPaymentState para exigir origen bancario ob o BOOK único de identidad exacta, manteniendo el rechazo PDNG/duplicados del feed. La ampliación Node cubre manual, manual:sabadell, macrodroid y source ausente, con negativos sin feed y positivos BOOK:40/40 PASS. La ampliación DOM39 debe acreditar los mismos estados en los tres idiomas sobre la candidata final. Los resultados anteriores documentan su SHA; no acreditan esta corrección ni la publicación.

Unión85 corregida: DOM113 PASS incluye39 casosPlan ampliados; CLI0/fail0/skip0/retry0/flaky0, HTML0cb976b3, informe y duración en el acta de integración. Node40 y guardián1188/384PASS. SHA final/revisión exacta/CI nueva siguen gates; resultados locales no acreditan el dispositivo familiar.
