# Recibo cobrado al cambiar su nombre

## Revisión: competencia por el mismo BOOK

La revisión de `7796389b` encontró una asimetría: renombrar «Tributo municipal» a «IBI» y crear otro «Tributo municipal» del mismo banco e importe dejaba el original pendiente y daba su cobro al nuevo. La reconciliación guardaba después una segunda prueba para ese mismo cargo.

El remate autorizado en `1729f839907b7cdb0136a4b1332e85c87748e416` cuenta también el nombre guardado de una prueba BOOK v2 rival del mismo mes e identidad. Se aplica tanto al elegir dueño automático como al descartar un BOOK ya reclamado. Ambos recibos quedan pendientes y la reconciliación no transfiere la prueba. La reserva exige id único, contrato vigente, mes en que ocurre el recibo y ausencia de veto; no se extiende a otra identidad, banco o mes. La rama por gasto queda intacta.

Validación nueva: reproducción causal con cuatro grupos rojos, once pruebas dirigidas verdes y seis mutantes nuevos rechazados. Un control adicional detectó que había que excluir un recibo que ya no ocurre ese mes; quedó corregido y su fallo se conserva en la evidencia. No se repiten las 144 pruebas Node, cinco DOM ni ocho mutantes anteriores, ni los 157 E2E de la revisión independiente: corresponden a `7796389b`. No se ejecuta build en este remate; `public` conserva el artefacto anterior y la integración deberá regenerarlo y validarlo. La compatibilidad de clientes antiguos, renovación de pruebas inválidas y etiqueta tentativa de Gastos siguen como notas de integración, fuera de este ajuste.

Cambiar `Ibi` por `IBI` invalidaba la prueba de pago: su contrato incluía el nombre literal del recibo. El cargo, su importe y el identificador del recibo seguían presentes, pero Plan volvía a mostrarlo pendiente. Reproducido con código real y con el editor en Chromium, usando un cargo sintético de 123,45 €.

Las pruebas nuevas guardan versión 2, id del recibo y contrato de banco/importe/importe bancario. El nombre visible puede cambiar. En una prueba BOOK se conserva el nombre que identificó originalmente el cargo para mantener las comprobaciones de ambigüedad; no se usa el nuevo nombre para buscarle otro cargo. Las guardas de identidad única, mes, estado, conflicto, veto y lápidas siguen vigentes.

La consulta previa fue autorizada expresamente en `05c0fb49520415872ae21192ff27b68bb141f9ed`. El lector antiguo sigue siendo estricto. Solo al guardar un nombre distinto se convierte una prueba antigua válida justo antes del cambio, del mismo id único y sin cambiar su contrato financiero. La conversión ocurre en esa escritura. No hay barrido, conversión al leer/sincronizar ni recuperación de pruebas inválidas. No se cambian cargos, referencias bancarias, cuentas, fechas, céntimos, absorciones ni `paidYm`.

## Un vínculo que ya estaba roto

La pantalla de Gastos conserva ese vínculo para permitir deshacerlo. El recorrido comprobado es: **Gastos → abrir el cargo → Paga un recibo → Deshacer vínculo → elegir el recibo → confirmar**. Después de recargar vuelve a constar pagado por 123,45 €, conservando el cargo y la cuenta. No acredita una reparación del caso real ni una entrega móvil.

## Validación y límites

Pruebas dirigidas en `tests/recibos-renombrar.test.mjs` y `e2e/recibos-renombrar.spec.mjs`, registradas en sus ejecutores. Cubren nombre en mayúsculas y cambio sustantivo, formatos nuevo/antiguo, guardado/recarga, serialización sin extracto, negativos financieros y recuperación manual explícita. Los mutantes ejercitan la dependencia del nombre, id, importe, lector antiguo, conversión, BOOK y lápidas. La prueba existente de identidad duplicada conserva su aserción; solo actualiza la construcción del formato nuevo y el anclaje del mutante.

Base `ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13`. Revisión independiente, integración, gates generales, CI, publicación y aceptación móvil quedan pendientes. Sin cambios en VERSION, catálogo, límites de tamaño, backend ni escritores cloud. Los JSON y HTML de `public` son la salida coherente del ensamblador; la integración gestiona sus metadatos de publicación.
