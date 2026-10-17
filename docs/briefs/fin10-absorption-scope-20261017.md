# FIN-10 y transporte de cuenta FIN-14 · candidata

## Remates del NO-GO 691503ab · privados, pendientes de nuevo turno de entrega

Sucesora `fin10-pr250-review-remates-codex-20261017`, base `11707215`. El resultado
anterior `6d2dadf3` queda cerrado e inmutable. La revisión independiente detectó una
asimetría no cubierta por el primer contrato: una lápida con cuenta podía ocultar la
superviviente sin cuenta (320 → 0 c); al enriquecer una fila que el escritor no conocía,
la asimetría inversa dejaba 640 c en servidor y widget. La regla corregida, admitida por
691503ab/acaf456d, trata **cuenta ausente en cualquiera de los dos lados** como comodín,
siempre dentro de banco, referencia, ordinal y día. Dos cuentas conocidas diferentes
siguen siendo distintas. Esta decisión sustituye la regla asimétrica de la primera
entrega y su aserción de cuenta ausente; conserva íntegro el oráculo de 320 céntimos.

`obPendingAbsorbedState` consulta el mismo predicado que el lector cliente antes de
escribir la lápida. Si ese marcador pudiera alcanzar a la superviviente, no lo escribe.
El servidor aplica el mismo comodín. Los índices `any`/`missing` del cliente se calculan
una vez por mapa de lápidas y se cachean con WeakMap; un nuevo array de `deleted` obtiene
su mapa e índice nuevos. No se persiste el índice ni se amplía la lista de lápidas.

ROJO causal sobre 11707215: 10 casos, cuatro pasan y seis fallan, EXIT1. El updater y
commit reales con enlace legacy **sin `accounts[]`** cubren las cuatro combinaciones
con/sin cuenta en superviviente y BOOK, para ranuras 1 y 2. El resultado esperado en
cliente, otro móvil, `filasComoLaApp` y widget real es siempre 320 c. Los diez casos
pasan tras el arreglo. El test de coste instrumenta la fuente real con 20.000 filas y
500 lápidas: antes 20.000 enumeraciones/10.000.000 descriptores; después una/500.
Los tiempos instrumentados (6.229 ms antes, 87 ms después) no acreditan rendimiento
móvil ni sustituyen CPU6, que no se ha ejecutado.

La ampliación completa queda en 25 casos FIN-10 y 32 de compras, todos EXIT0. Mueren
cuatro mutantes nuevos: restituir guarda exacta del escritor (0 c), quitar el lado
ausente del cliente, quitarlo del servidor y reconstruir el índice por fila (200
enumeraciones/100.000 descriptores para 200 filas). Se conservan los seis mutantes
propios anteriores adaptando solo el punto de inyección de la cuenta al lector nuevo.
También pasan presupuesto servidor, sintaxis y los tres DOM dirigidos de Gastos con
un worker, cero reintentos y puerto 48510. Se repiten por cambio causal de esos lectores,
escritor y build, sin suite general ni CPU6.

Esta fase prepara commit y evidencia privados: **sin push de PR250 ni result de la
sucesora hasta un nuevo turno serial**. Tamaño, docs-frescura, beta-delivery y versión
son de integración de Claude. No se modifica FIN-11 ni se añaden migraciones.

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

Tras el remate, si falta cuenta en la candidata o en la lápida, v2 casa por banco,
referencia, ordinal y día; con ambas cuentas conocidas se exige igualdad.
`expenseSourceForCloud` y `expenseFromRow` transportan la cuenta como `#acc` codificado
antes del ordinal final. Conservan referencias, estado pendiente, recibos, duplicados,
histórico y las fuentes legacy. No hay SQL ni columna nueva. FIN-11 conserva la cola
de borrados y el resto de su alcance: aquí no se modifica su escritor de retención.

El pull enriquece `obAcc` en filas existentes sin borrar la cuenta ante un source legacy.
La guarda por UUID de retiradas permite añadir `#acc` a una fila legacy sin aceptar dos
cuentas conocidas diferentes; conserva las guardas de referencia y source anteriores.

Primera entrega, anterior al NO-GO: trece casos propios y 32 anteriores de compras, con seis mutantes
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
