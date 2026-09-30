# INC-3009-NOMINA-ANTICIPADA — un abono pendiente no es un cobro

**30/9/2026 · Claude, encargo de Codex (diagnóstico + candidata beta).**

## Síntoma (dueño, 30/9)

Una nómina apareció en Sabadell como movimiento normal antes de estar cobrada, y Mi ciclo arrancó con ella.

## Ruta y causa

1. `bank-sync` → `fetchBankTransactions` (`_shared/enablebanking.ts`) pide `/transactions` **sin filtrar el estado**: Enable Banking devuelve BOOK y PDNG juntos.
2. `mapTransaction` conserva `status`, y `flattenBankTx` (`08-motor-bank.js`) lo pasa al cliente.
3. `importObExpenses` **ignoraba `status`**: un abono PDNG entraba como ingreso `source:"ob"` sin marca alguna, con `date = booking_date || value_date`.
4. `budgetPaydayOf` → `lastPaydayOf` (`04-tab-gastos.js`) ancla el ciclo en el último ingreso de 200 € o más, con fecha de hoy o anterior, y nombre de nómina o flujo compatible. Nada distingue si ya está cobrado.
5. La fila sube a la nube y los demás dispositivos heredan el ancla.

`flowEarlyBankMatches` (nómina adelantada) y `fixedPaymentState` (recibos) **ya exigían BOOK**; el importador era la única lectura que no.

Otras vías descartadas: el lector de notificaciones (`ingest`) solo convierte en ingreso los Bizum recibidos. Un duplicado sin `possibleDup` ya se excluye del ancla.

## Corrección (4.26.72)

`importObExpenses` no importa ingresos con estado `PDNG|HOLD|SCHD|CNCL|RJCT|INFO`. Entran cuando llegan como BOOK. Sin estado se mantiene el comportamiento anterior.

Pruebas: `tests/ob-ingresos.test.mjs`, tres casos:

- PDNG y el resto de estados no entran y no anclan el ciclo.
- BOOK entra y ancla.
- Sin estado sigue entrando.

El primero **falla sin el arreglo** (comprobado revirtiendo el cambio de `src`).

## Límites y riesgos

- No toca cargos pendientes (compras con tarjeta PDNG). Siguen entrando como hasta hoy; queda fuera de esta tanda.
- No limpia filas ya importadas. Si la nómina PDNG ya entró y el BOOK llega con otro `entry_reference` y otra fecha, puede verse dos veces. Solo aplica al caso que ya vio el dueño y se borra a mano.
- No se verificó con el extracto real qué `status` mandó Sabadell ese día: no se leyeron datos reales. Si Sabadell no informara `status`, este arreglo no cambiaría nada. Dato mínimo a pedir al dueño: una captura de la app de Sabadell en la que la nómina figure como pendiente o retenida antes del abono.
- Sin Edge, SQL, APK ni workflows.
