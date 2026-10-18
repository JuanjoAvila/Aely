# H2: saldo y movimientos por cuenta — candidata, sin despliegue

Base `ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13`. GO causal `e3a0078bbb9a3ce23efcc74afa7ec8e990c0329d`, tarea `h2-balance-transactions-candidate-codex-20261018`. PR275 y PR278 quedan fuera de esta rama.

Un fallo de saldo impedía consultar movimientos. Además, si una hermana respondía, el cliente reconstruía las cuentas extra solo con ella y perdía el saldo previo de la fallida: 125 € anteriores más 100 € válidos acababan en 100 €. La candidata conserva **22500 céntimos**, y la fecha de los 12500 anteriores. Un saldo válido de 10000 se aplica aunque falle la primera página de movimientos. Ausencia, estructura incorrecta y cadena vacía no equivalen a cero; cero numérico sí es válido.

## Contrato y compatibilidad

La petición nueva declara `accountPhases:1` junto a `recoverGaps` y `acks`. La respuesta capaz declara esa misma capacidad. Cada cuenta informa `balanceOk`, `balanceError` cerrado y `balanceAt` propio cuando es válido. `ok`, `transactionError`, `truncated`, `readReason` y `failureCode` describen la lectura de movimientos. No hay mensajes privados del proveedor en los errores por fase. `balanceAt` del banco solo se emite cuando todos sus saldos son válidos.

El cliente conserva valor/fecha de cada identidad fallida u omitida y marca su saldo como desactualizado. La identidad es IBAN cuando ambos lados lo conocen, o UID cuando falta IBAN; una promoción guarda UID y fecha, y reconoce el `accountOrderKey` explícito `ob:UID` de promociones anteriores. Una principal sin identidad se conserva sin asignarle automáticamente la primera hermana. No se añade un flujo nuevo para elegir esa identidad: esta limitación de cuentas antiguas requiere revisión de integración. Los duplicados de identidad se retienen sin elegir por orden. Las fórmulas de reanclaje financiero y los importadores se mantienen.

Con servidor viejo, el cliente nuevo interpreta el contrato anterior y retiene individualmente saldos fallidos. Se prueba ejecutando el handler real de la base Git. Con cliente viejo, el servidor nuevo proyecta `accounts[].ok` como saldo válido: si falta cualquier saldo retiene el banco entero (`link.ok=false`) y no entrega ACK ni avanza ese cursor. Así el cliente anterior no elimina la cuenta fallida al aplicar únicamente la sana. Con todos los saldos válidos los aplica incluso si falló el extracto. La fixture legacy conserva las funciones reales de la base. Es una transición conservadora: solo el cliente capaz puede progresar con movimientos completos y saldo fallido.

## Cursor, permisos y presupuesto

La ruta capaz habilita tramo/acuse por completitud de movimientos de todas las cuentas; el saldo no decide ese avance. Se preservan días sellados, lectura repetida tras pérdida de respuesta y persistencia local previa al ACK (incluida cuota de gastos). El ACK conserva predicados de identidad/autorización y monotonía; `.select("id")` permite exigir al menos una fila actualizada antes de usarlo como cursor del plan. El ancla inicial duradera requiere alguna lectura de movimientos, nunca solo un saldo. Un 401 de movimientos mantiene el diagnóstico de sesión previo aunque el saldo sea válido. No se cambian tokens, permisos, esquema ni `CLOUD_WRITES`.

**Se conserva la excepción anterior de desbordamiento de 12 páginas/2000 filas**, que puede acusar «ahora» con ventana truncada. También persiste el límite de 90 días. Esta candidata no demuestra recuperación universal ni cierra el incidente real.

Las llamadas PSD2 siguen en serie: 60 s globales, 15 s por cuenta, hasta 5 s para balances y el resto para transactions. Una prueba con reloj controlado aborta balances a los 5 s y acredita 10 s restantes para transactions. El reparto es una decisión conservadora, no un óptimo medido. No se aumentan topes ni concurrencia.

## Validación y límites

`tests/h2-account-phases.test.mjs` ejecuta handler, cliente y persistencia reales con banco/BD/reloj sintéticos. Cubre ambos sentidos de compatibilidad, 22500/10000 céntimos, cero, ausencia, identidad/promoción, páginas parciales, reloj, pérdida/replay, ACK rechazado/autorización cambiada y fallo de disco. Mutaciones privadas comprueban saldo descartado, acoplamiento de fases, legado inseguro, falso ACK, identidad incorrecta y fecha inventada. `e2e/h2-account-phases.spec.mjs` comprueba sincronización real de UI con backend sintético, saldo y aviso en es/en/ca, un worker, cero reintentos y puerto propio. Ambos están registrados.

Los tests financieros anteriores que esperaban reanclar una cuenta sin identidad reciben ahora un UID/IBAN explícito **en la fixture**; importes, predicados y oráculos se conservan. Esto incluye el generador de 775 extractos de Recibos, sin modificar lógica de Recibos ni el trabajo de PR278. Las aserciones legacy de paging/acuse se ajustan únicamente a saldo disponible y nueva capacidad; no se relaja el cursor.

Los RED previos se reutilizan con procedencia, sin repetirlos como nuevos. Errores iniciales de fixtures/harness y ejecuciones fallidas se conservan en el manifiesto privado. Los gates generales de tamaño, documentación y catálogo siguen siendo obligatorios; un verde focal no los sustituye. Sin suite completa, CPU6, Gradle/APK, banco real, SQL, despliegue ni aceptación física. Revisión independiente, integración, CI y servido pendientes.

Se consultaron skill Supabase y fuentes oficiales el 18/10/2026: [update/select](https://supabase.com/docs/reference/javascript/update), [límites Edge](https://supabase.com/docs/guides/functions/limits) y [changelog TLS CBC](https://supabase.com/changelog/cbc-tls-ciphers-deprecated). No requieren dependencias ni migración para este cambio.

**Edge solo se despliega con OK del dueño tras su beta.** Esta entrega es candidata borrador para revisión; no es ProductREADY ni autoriza publicación.
