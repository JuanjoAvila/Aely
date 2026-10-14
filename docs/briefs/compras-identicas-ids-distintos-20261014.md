# Compras iguales con referencias bancarias distintas · candidata

Encargo sucesor `compras-identicas-ids-distintos-2-codex-20261014`. Base histórica inmutable
`24d0d463e0c0055ba000149f07d7fa2fe12d4c9b`; ejecución autorizada sobre
`7865111be8e2e1f8994bccba4b515bf4c6193074` (132), rebasada por instrucción del canal
`85f33537` sobre `52e1957db385bc03cceba138fe68ff16b1b84f9f` (133). No es una versión publicada.

El handler real de bank-sync entrega las dos referencias. El importador las descartaba por
día, importe y nombre; mergeExpenses y mergeExpensesFromCloud repetían esa fusión. El rojo
causal sobre 132 acredita tres fallos y un control verde antes de modificar producto.

La candidata conserva una ranura por referencia distinta y deduplica la referencia repetida.
Reutiliza `obOrd` y `fechaConOrdinal`: la segunda fila pasa el índice único existente de la
nube sin cambiar su día civil. El alias sin referencia ocupa una ranura ya acreditada; el total
es el mayor de ambos recuentos, no su suma. El aviso sin referencia sigue disponible para UNO
de los cargos, con las decisiones de TR y Recibos vigentes.

`source` conserva la referencia con `#ref` seguido de encodeURIComponent, después de `#dup` y
antes de `#n`. No se añade columna ni migración. El lector del cliente la recupera como extId;
el lector vigente del servidor ignora ese tramo y mantiene el ordinal y el banco. Las filas
antiguas sin referencia conservan su dedup por contenido: no se inventa la identidad perdida.

Borrar un cargo identificado conserva su lápida habitual y añade referencia y banco al vínculo
«sin aviso» que ya acompaña al borrado. No consume una segunda lápida ni reduce el límite de
500 cargos. Una lectura parcial nueva puede usar otra ranura sin resucitar el cargo borrado.
Deshacer levanta la lápida y desactiva ese vínculo. Se conservan las lápidas anteriores y los
vínculos de avisos, así como separación de nube sin #dup y el sync antes de pull.

Pruebas propias: estado sembrado; handler real bank-sync y updater de App; handler real ingest;
dos órdenes de entrada; ID repetido; id más alias sin id; relectura parcial; índice único de
nube; otro móvil; borrado y Deshacer reales; tres estados sin colisión contra 132, con totales
2456, -179721 y 2345 céntimos idénticos. Siete mutaciones deben morir. El spec propio está
registrado en Gastos y el Node en el runner. La fixture de ingest se comparte con su suite
existente, sin cambiar sus mocks ni el handler.

La primera CI sobre `6eb0a036` dejó seis etapas rojas: prod117-edge-compat,
retirada-bancaria, beta-sources, docs-frescura, presupuesto-rendimiento y recibo-invariante;
el focal propio pasó 3/3. Se corrigen las dos regresiones propias antes de repetir: el
consumidor del fixture compartido lee su ubicación nueva sin cambiar los hashes desplegados;
la retirada reconoce la misma UUID si un lado aún carece de #ref, mantiene la fuente remota
en el CAS y rechaza referencias conocidas distintas. Banco, ordinal, #dup, fecha, importe y
comercio siguen siendo guardas obligatorias. Sus 50 casos incluyen compatibilidad en ambos
sentidos. El resultado de esa primera CI se conserva y no acredita el nuevo SHA.

Se conserva SIN MODIFICAR el oráculo de `recibo-invariante.test.mjs`: sobre 132 pasa; con esta
regla falla el extracto amplio 109 (semilla 8417), que contiene x1 BOOK y x2 PDNG, ambos de 750,
en la misma entidad, día y concepto. La regla anterior los fundía; la orden vigente dice que
referencias distintas son cargos distintos. El saldo base pasa de 1712,76 a 2462,76 en ese
estado por el segundo cargo acreditado al reanclar. El test posterior de cobertura queda en
583 frente a 775 al abortar esa familia. No se alteran importes, conteos, umbrales ni oráculos
del guardián antiguo. Requiere revisión explícita de integración de ese contrato.

El límite de tamaño queda intacto y su rojo se declara con los bytes medidos. VERSION, notas
de versión y catálogo no se cambian en este encargo; los gates de integración no se aflojan.
No hay cambios de fuente Edge, SQL o backend, ni despliegue necesario para el código preparado.
La publicación web requiere revisión y aceptación propia; no acredita APK ni aceptación móvil.

El navegador local y CPU6 no se ejecutan: runner reservado por el coordinador. La CI remota
debe ejecutar test.yml sobre el SHA final exacto, con el focal propio, un worker y cero
reintentos. Sus resultados terminales y omisiones se informan separados de estos contratos.

Guion móvil, con datos sintéticos: sincronizar dos cargos iguales de 9,99 con referencias a/b
y comprobar dos filas y 19,98; repetir la sync y comprobar el mismo total; repetir sólo a y
su alias sin id y comprobar una fila; añadir un aviso y los dos cargos sin comercio y comprobar
que sólo uno queda emparejado y el total sigue en 19,98. Borrar uno, recibir una nueva referencia
en lectura parcial y comprobar que el borrado no reaparece; Deshacer y volver a sincronizar.
Repetir tras recargar y en un segundo estado sintético que haya bajado las filas de la nube.
