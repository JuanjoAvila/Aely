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
respeta. No cambia `07-tab-patri-fijos`, `isPaidIn`, cuentas, anclas ni previsiones por calendario.

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
