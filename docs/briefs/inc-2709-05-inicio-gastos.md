# INC-2709-05 · lectura del mes y nómina adelantada

**Estado:** publicada solo en beta 4.26.61.1, SHA `92af41ff4b971dbce304e16eec3fd263ab6e810d`; prueba móvil y anclaje de saldo pendientes.

## Evidencia reproducible

- Base `origin/beta` `c8d13938ff5981fe887d60dfdecebf00c5ac013c`: en modo Balance, con datos sintéticos de 300 € de compras y 1.000 € de ingresos, Inicio mostraba «Has gastado 700 €», 0 % y «Aquí empieza el mes»; Gastos llamaba 700 € balance. El E2E nuevo falló en es/en/ca antes del cambio.
- Un flujo de nómina previsto para el día 25 seguía en `incomePending` y `bankPendingEvents` aunque `bankTx` tenía un abono contabilizado de 2.000 € el día 20 en el mismo banco. El test puro falló antes y pasa después. `lastPaydayOf` ya podía anclar Mi ciclo al movimiento real de `expenses`, pero no identifica por sí solo qué flujo lo originó.

## Cambio acotado

- Inicio presenta balance con signo y gastos brutos por separado cuando `gTotalMode` es `net`; el anillo aclara que su porcentaje es uso neto. La actividad real evita el mensaje de mes vacío. Gastos y widget conservan su agregación.
- `flowPaidIn` conserva el día editable y adelanta solo un ingreso con un único abono `BOOK` del mismo banco y mes, ocurrido hasta siete días antes del previsto, con nombre e importe próximos o importe exacto. Si hay otro flujo compatible, estado pendiente/desconocido, banco o importe distinto, el ingreso permanece previsto. El feed se lee localmente tras sincronización a demanda. No se escriben filas, se reclasifican movimientos ni se consulta un banco por abrir la pantalla.
- Plan, próximos cargos y simuladores emplean la misma decisión. El `useMemo` financiero depende ahora de `bankTx` para repintar cuando llega la lectura bancaria. La séptima tanda de Novedades queda separada de las seis anteriores y exige su propio veredicto.

## Pruebas y límites

- `tests/plan-charges.test.mjs`: abono único contabilizado, banco/importe distinto con `BOOK`, mes anterior, fecha futura, dos abonos compatibles, `PDNG`, estado o día previsto ausente y dos flujos compatibles. Claude dio NO-GO al SHA `1e2b9692` porque las variantes iniciales de banco e importe carecían de `BOOK` y pasaban por el filtro equivocado. El guardián reforzado mata cinco mutaciones independientes, cada una con `build-app` y test rojos: quitar banco, mes, comparación de importe, unicidad o filtro `BOOK`. Claude repitió las cinco y añadió fecha futura: seis mutaciones rojas y GO al SHA `92af41ff`. Fuente y bundle se restauraron byte a byte. `e2e/presupuesto-fluido.spec.mjs`: Inicio/Gastos en es/en/ca. `e2e/plan-cover.spec.mjs`: Plan y Mi ciclo con abono anterior. `e2e/revisar-beta.spec.mjs`: siete tandas sin ocultar las pendientes. Los tres specs completos pasaron 58/58 en Chromium sobre el primer SHA; Claude ejecutó 72/72 en su checkout y sintaxis, i18n, frescura y presupuesto del bundle pasaron. La suite completa de [Actions 36401018224](https://github.com/JuanjoAvila/Aely/actions/runs/36401018224) sobre `92af41ff` terminó SUCCESS; `npm test` local solo falla por el espejo de memoria ajena desfasado y Deno no está instalado.
- El saldo de una cuenta **no** queda corregido por este cambio. `monthNetForAccount` aún suma la nómina al llegar su día programado: con abono real el día 8, la función devuelve 0 € el día 10 y +2.000 € el día 15. Cambiar esa fórmula sin reanclar el `value` guardado movería el saldo al instalar la versión. `bankTx` tampoco viaja al otro dispositivo por la nube: allí el ingreso temprano seguirá previsto hasta que ese dispositivo sincronice su propio banco. Diseñar la transición y comprobar saldo antes/después, sincronización fallida y segundo móvil es trabajo pendiente dentro de INC-2709-05. No se presenta el pronóstico como cierre de ese saldo.
- La observación del recibo con vencimiento hoy queda separada: `isPaidIn` puede marcarlo por calendario sin cargo bancario confirmado. Tampoco se concluye que falte la fila de ingreso de las capturas del otro usuario. Botones y clasificación de suscripciones son otra comprobación pendiente.
- Web/OTA únicamente; sin APK nueva, Edge, SQL, migración, reparación histórica ni datos familiares. La aceptación final requiere prueba móvil de esta tanda y revisión del saldo abierto.

## Publicación comprobada

- [Action beta 36402405604](https://github.com/JuanjoAvila/Aely/actions/runs/36402405604) SUCCESS desde `92af41ff`. HTTP `version.json`: `4.26.61.1`, huella `ab6d33b0b33efa6a`, canal beta; producción HTTP 200 sigue en `4.26.57`.
- `bundle.zip` HTTP 200 (875.055 bytes): `index.html` lleva `APP_VERSION: "4.26.61.1"`, `flowBankPaid` y el filtro `BOOK`; `sw.js` lleva `4.26.61.1-2026-09-28-92af41f`. `release-notes.json` dentro del ZIP incluye la nueva tanda `inicio-gastos-ciclo-28sep` y conserva las cinco financieras de 4.26.60 y Cuotas de 4.26.59. La beta anuncia la APK 4.26.55/code 51, URL HTTP 200; ninguna APK nueva.
- El intento de `npm run listo` tras la publicación agotó tiempo al conectar con Supabase: **no hay un veredicto nuevo verificado**. El móvil debe probar y aprobar esta tanda por separado; tampoco se reutiliza aprobación de las seis anteriores.
