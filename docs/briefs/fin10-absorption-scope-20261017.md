# FIN-10 y transporte de cuenta FIN-14 · candidata

Base exacta `a9916c3cdb21c93f9d3a47653c0608e630ce50ab`. GO causal de Claude
`206f47c311e6d9e046b9f05991df49b1b1ba6352`. Esta fuente no acredita integración,
publicación, despliegue de ingest ni aceptación móvil.

El escritor real `obReconcilePending` → `obPendingAbsorbedState` producía una lápida
`ob-absorbed|banco|referencia|ordinal` tras absorber el BOOK que había entrado durante
una lectura truncada. Los lectores ocultaban también un cargo independiente de otra
cuenta o de otro día con esos tres valores: fixture sintética de 320 céntimos daba 0
en ambos lectores. ROJO previo al producto: nueve casos, cinco controles pasan y
cuatro aserciones fallan, EXIT1. No se han inspeccionado datos bancarios reales.

Las nuevas escrituras usan únicamente
`ob-absorbed2|banco|referencia|ordinal|cuenta|dia`. Banco, referencia y cuenta se
codifican con `encodeURIComponent`; el día son los primeros diez caracteres de la
fecha guardada, sin convertir zonas. Los lectores cliente y servidor reconocen ambas
versiones. La vieja mantiene exactamente su conducta amplia: no se puede reconstruir
la cuenta o el día perdidos, ni se afirma una reparación histórica.

Si la candidata no tiene cuenta, una lápida v2 casa por banco, referencia, ordinal y
día. Si sí tiene cuenta, se exige la cuenta exacta; una lápida sin cuenta no la oculta.
`expenseSourceForCloud` y `expenseFromRow` transportan la cuenta como `#acc` codificado
antes del ordinal final. Conservan referencias, estado pendiente, recibos, duplicados,
histórico y las fuentes legacy. No hay SQL ni columna nueva. FIN-11 conserva la cola
de borrados y el resto de su alcance: aquí no se modifica su escritor de retención.

El pull enriquece `obAcc` en filas existentes sin borrar la cuenta ante un source legacy.
La guarda por UUID de retiradas permite añadir `#acc` a una fila legacy sin aceptar dos
cuentas conocidas diferentes; conserva las guardas de referencia y source anteriores.

Pruebas focales: trece casos propios y 32 anteriores de compras, con seis mutantes
propios muertos (cuenta, día, escritor amplio, transporte y los dos lectores servidor).
Se conserva el oráculo de las pruebas anteriores; se actualizan únicamente los puntos
de inyección que cambian con el nuevo formato. Presupuesto servidor, ordinal y sintaxis
se verifican por separado. La prueba FIN-15 usa el importador y commit reales en ambos
órdenes de PDNG/BOOK con referencia estable y días distintos: queda un cargo de 320 c.
No sustituye los tests de integración de la PR243, ausentes en esta base exacta.

DOM dirigido: tres casos separados en Gastos, después de retirar la fila absorbida:
otra cuenta visible, otro día visible y absorción propia oculta. Tres pasan, un worker,
cero reintentos, puerto 48510. La primera fixture falló porque sembraba las tres filas
de la misma referencia a la vez: la identidad general las funde antes del filtro de
lápidas. Ese comportamiento anterior queda fuera del arreglo FIN-10; no se afirma
identidad completa entre cuentas. La primera configuración del servidor de pruebas
también falló antes de ejecutar casos por ruta relativa incorrecta; evidencia retenida.

No se han ejecutado Deno (no disponible), suite general, CPU6, Gradle, proveedores reales
ni aceptación móvil. No se cambian VERSION, catálogo ni topes. El coordinador debe
integrar en serie con FIN-15 y los demás cambios de `00-core`, ejecutar los gates
generales y desplegar primero ingest con el lector nuevo y después el cliente.

Documentación Supabase consultada el 17/10: [pruebas de funciones](https://supabase.com/docs/guides/functions/unit-test)
y [changelog](https://supabase.com/changelog). El cambio TLS anunciado para noviembre
no modifica este contrato de lógica pura ni exige cambios de SDK en esta candidata.
