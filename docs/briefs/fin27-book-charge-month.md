# FIN-27 · El BOOK acredita el mes de su cargo

Candidata de código y pruebas; integración, revisión financiera de Grok, CI y aceptación móvil pendientes.

El motor filtraba el BOOK y su prueba guardada por el mes de contabilización. El bloqueo de un
segundo recibo ya reconocía su referencia cruzando el mes: la combinación dejaba septiembre
pendiente y pagaba octubre con el cargo de septiembre. La reproducción sobre la base intacta
espera 1.299 céntimos pagados y cero pendientes en septiembre; obtiene cero y 1.299.

`08-motor-bank` atribuye el pago al cargo bancario único con la misma referencia exacta, banco,
cuenta conocida y céntimos, dentro de la ventana existente de siete días hacia delante. Conserva
el asiento, su fecha, identidad, importe y referencia. Sin referencia inequívoca mantiene el
comportamiento previo; no busca por importe o nombre para mover un pago entre meses.

La prueba conserva `date` bancaria y añade `chargeDate` cuando cruza de mes. La reconciliación
mueve exclusivamente una prueba válida al mes acreditado. El merge existente puede reunir la
copia antigua y la nueva: ambas lecturas comparten la atribución de esa identidad incluso sin
histórico local o con un feed parcial. No se modifica el merge de `00-core`.

Una prueba de otro recibo inválida no puede aportar esa fecha: se comprueban su vinculación,
contrato, banco, céntimos, ocurrencia, identidad, veto y limpieza del feed sin volver a llamar a
`fixedPaymentProof`. Este caso produjo otro rojo durante la revisión previa al push y se conserva
como negativa de regresión, junto con los casos positivos de dos clientes.

`fixedPaymentDerivedDay` usa el día del cargo. Solo se retira una marca derivada del BOOK que
quedó bajo el mes equivocado y conserva exactamente su día; una marca manual de otro día se
respeta. No cambia `07-tab-patri-fijos`, `isPaidIn` ni las previsiones por calendario. La corrección
R2 de abajo compensa la base de la cuenta cuando esa marca deja de intervenir en el saldo.

Dos oráculos independientes, con estados sintéticos y céntimos enteros:

| Caso | Recibo acreditado por Plan | Caja de `reconcileBank(...).feed` |
|---|---|---|
| Cargo 30/9, BOOK 2/10, 12,99 € | septiembre 1.299; octubre 0 | septiembre 0; octubre −1.299 |
| Cargos 28/8 y 28/9; BOOK 1/9 y 30/9 | agosto 1.299; septiembre 1.299 | septiembre −2.598 |
| Cargo 31/12, BOOK 2/1 | diciembre 1.299; enero 0 | diciembre 0; enero −1.299 |

El segundo oráculo comprueba además el resultado real de `monthNetForAccount`: −1.299 por
cuota mensual prevista y cero en otro banco, sin inferirlo de Plan ni comparar solo antes/después.

Cobertura dirigida: 15 casos en Madrid/UTC/Los Ángeles con el mismo instante, merge real en
ambos órdenes con base ausente/vieja/vacía y replay offline, ocho mutantes semánticos rechazados,
regresiones de pruebas/vínculos/renombrado/vetos/retirada y dos casos DOM del Plan real tras
recarga. Specs y unitario registrados. CPU1, serie, un worker, cero reintentos. Las suites completas
y los gates de integración pertenecen al integrador; esta evidencia no acredita una beta servida.

## R2 · Reanclar el saldo al migrar la prueba

Sobre la fuente publicada de PR308, retirar el `paidYm` de octubre antes del día previsto
sumaba 1.299 céntimos al saldo visible: 987,01 → 1.000,00. Ocurría al derivar el Plan tras un
pull y al reubicar la prueba durante un sync cuyo banco fallaba o cuyo saldo TR seguía en el
puente nativo. Una sincronización bancaria correcta podía ocultarlo al reanclar después.

Ambos recorridos usan ahora `conSaldoMostrado` entre el estado **entrante** y el que sólo acaba
de cambiar sus pruebas o marcas. En cloud no se compara con `prev`: la nube puede traer un
saldo legítimo diferente, otra cuenta u otro orden. El saldo nuevo del siguiente sync correcto
sigue prevaleciendo. No cambian los asientos, las fechas, la identidad ni los céntimos del pago.

`fin27-balance-reanchor` añade regresiones Node y DOM registradas. Las aserciones separan saldo
visible, caja BOOK y recibos pagados/pendientes; incluyen cero y negativo, ambos roles de
recibos, cambio de año, fuente ausente, feed parcial con cargo exacto, repetición y sync posterior.
El DOM recorre el pull y el sincronizador reales y relee la cuenta tras recargar. Su servidor
simulado conserva el UPDATE CAS aceptado: restaurar la respuesta inicial en cada recarga
inventaba otro fallo, conservado como diagnóstico privado junto con los tres rojos originales.

La candidata R2 requiere revisión independiente y autorización del SHA exacto antes de actualizar
la misma PR308. Sin integración, publicación en beta ni aceptación móvil acreditadas por esta tanda.
