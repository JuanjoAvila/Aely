# INC-2709-05 · lectura del mes y nómina adelantada

## Evidencia reproducible

- Base `origin/beta` `c8d13938ff5981fe887d60dfdecebf00c5ac013c`: en modo Balance, con datos sintéticos de 300 € de compras y 1.000 € de ingresos, Inicio mostraba «Has gastado 700 €», 0 % y «Aquí empieza el mes»; Gastos llamaba 700 € balance. El E2E nuevo falló en es/en/ca antes del cambio.
- Un flujo de nómina previsto para el día 25 seguía en `incomePending` y `bankPendingEvents` aunque `bankTx` tenía un abono contabilizado de 2.000 € el día 20 en el mismo banco. El test puro falló antes y pasa después. `lastPaydayOf` ya podía anclar Mi ciclo al movimiento real de `expenses`, pero no identifica por sí solo qué flujo lo originó.

## Cambio acotado

- Inicio presenta balance con signo y gastos brutos por separado cuando `gTotalMode` es `net`; el anillo aclara que su porcentaje es uso neto. La actividad real evita el mensaje de mes vacío. Gastos y widget conservan su agregación.
- `flowPaidIn` conserva el día editable y adelanta solo un ingreso con un único abono `BOOK` del mismo banco y mes, ocurrido hasta siete días antes del previsto, con nombre e importe próximos o importe exacto. Si hay otro flujo compatible, estado pendiente/desconocido, banco o importe distinto, el ingreso permanece previsto. El feed se lee localmente tras sincronización a demanda. No se escriben filas, se reclasifican movimientos ni se consulta un banco por abrir la pantalla.
- Plan, próximos cargos y simuladores emplean la misma decisión. El `useMemo` financiero depende ahora de `bankTx` para repintar cuando llega la lectura bancaria. La séptima tanda de Novedades queda separada de las seis anteriores y exige su propio veredicto.

## Pruebas y límites

- `tests/plan-charges.test.mjs`: abono único contabilizado, banco/importe distinto, `PDNG`, estado o día previsto ausente y dos flujos compatibles. `e2e/presupuesto-fluido.spec.mjs`: Inicio/Gastos en es/en/ca. `e2e/plan-cover.spec.mjs`: Plan y Mi ciclo con abono anterior. `e2e/revisar-beta.spec.mjs`: siete tandas sin ocultar las pendientes. Los tres specs completos pasaron 58/58 en Chromium; sintaxis, i18n, frescura y presupuesto del bundle también pasaron. `npm test` local solo falla por el espejo de memoria ajena desfasado; Deno no está instalado. CI debe comprobar la suite en el SHA publicado.
- El saldo de una cuenta **no** queda corregido por este cambio. `monthNetForAccount` aún suma la nómina al llegar su día programado: con abono real el día 8, la función devuelve 0 € el día 10 y +2.000 € el día 15. Cambiar esa fórmula sin reanclar el `value` guardado movería el saldo al instalar la versión; `bankTx` tampoco viaja al otro dispositivo por la nube. Diseñar la transición y comprobar saldo antes/después, sincronización fallida y segundo móvil es trabajo pendiente dentro de INC-2709-05. No se presenta el pronóstico como cierre de ese saldo.
- La observación del recibo con vencimiento hoy queda separada: `isPaidIn` puede marcarlo por calendario sin cargo bancario confirmado. Tampoco se concluye que falte la fila de ingreso de las capturas del otro usuario. Botones y clasificación de suscripciones son otra comprobación pendiente.
- Web/OTA únicamente; sin APK nueva, Edge, SQL, migración, reparación histórica ni datos familiares. La aceptación final requiere prueba móvil de esta tanda y revisión del saldo abierto.
