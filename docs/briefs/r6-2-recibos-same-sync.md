# Recibos R6-2: BOOK incluido en la misma lectura cliente

Candidato local desde `9ef9f19b49938d207271289176f2314b858152a1`, con guardián causal
y dos guardianes afectados verdes; revisión del commit final y publicación pendientes.
No está integrado ni servido en beta. Sin cambios de servidor, datos reales o versiones.

El cargo BOOK de hoy seguía en «Pagado, aún sin restar del saldo» aunque hubiese
llegado junto con el saldo bancario que ya lo incluía. Comparar `lastBankSync`
del móvil con `obBalAt` del servidor no demuestra el orden de las lecturas.

`runBankSync` genera fuera del updater una identidad aleatoria con `mcRandomToken`
y una hora cliente. Pasa ambas a `flattenBankTx` y `applyBankBalances`. Cada fila
realmente recibida conserva `obSync`; las filas del feed anterior retenidas por
una respuesta parcial conservan su sello anterior. El sello del cargo incorpora
su identidad, referencia, cuenta y estado BOOK. El del saldo se guarda solo en
las cuentas realmente aplicadas, incluso si el importe no cambia, y queda ligado
al valor anclado y saldo crudo. Aplicar un saldo sin sello invalida el anterior.

Los gastos OB nuevos conservan el sello. Un gasto ya existente lo adopta solo
mediante referencia e identidad exactas, importe y cuenta, sin ambigüedad en el
extracto. No se sellan históricos a partir de su antigüedad o de un reloj global.
Los campos nuevos nacen en el cliente y se guardan con la fila; no se amplía el
mapeo de gastos de la nube. Un cliente anterior o un gasto descargado sin estos
campos conserva el comportamiento prudente d+1.
No se cambia el contrato ni la tabla de gastos de la nube.

`pendingWalkEvents` sigue usando una sola decisión financiera. La excepción de
`reciboEnElSaldo` exige un pago vigente en el mismo banco y un BOOK inequívoco
con sello íntegro. Todas las cuentas de ese banco deben conservar la misma
identidad/hora de lectura y snapshot de `obBalAt`, sin saldo rancio ni cambios
de cuenta o valor respecto al anclaje. La igualdad del snapshot de servidor
solo identifica qué lectura se aplicó; jamás se compara con la hora cliente.
El puente nativo, un saldo fallido, una cuenta antigua, otro sync o la falta de
evidencia mantienen d+1. Tampoco se modifica `paidYm` para retirar un pendiente.

El guardián `recibos-same-sync` carga fuente real y ejecuta importación, sellado,
anclaje y recorrido con datos sintéticos exactos al céntimo. Incluye relojes
cliente/servidor distintos, identidad distinta en el mismo milisegundo, legado,
gasto local sin extracto, ediciones, multicuenta, saldo repetido, feed parcial y
mutantes que retiran la excepción o ignoran la identidad de lectura.

Validación local del 31/10/2026, fuente real y datos sintéticos, CPU1 en padre e hijo,
un proceso en serie y cero reintentos: `recibos-same-sync` pasa 18 comprobaciones
incluidos sus dos mutantes; `fixed-ispaidin`, 26 comprobaciones; `fixed-payment-state`,
41 pruebas, sin fallos, cancelaciones ni omisiones. El primer intento del runner
se detuvo en el import ESM de Windows antes de ejecutar casos; su recuperación
se conserva separada y no se cuenta como prueba financiera. No se repitieron las
corridas verdes. Las cuatro fuentes probadas se conservan idénticas.

El trabajo no acredita sincronización bancaria real, aceptación móvil ni entrega
servida. No altera UX17, VERSION, notas, catálogo, caps, backend, SQL ni despliegues.
En integración debe comprobarse que la huella beta de Recibos incluya los nuevos
helpers, sin reutilizar una aprobación anterior. Ese sellado pertenece al coordinador;
no se modifica el catálogo en este candidato.
