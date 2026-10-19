# FIN04 fase 1 · candidata desde 408d8d348 (19/10/2026)

Implementación cliente pendiente de revisión e integración. No es una entrega servida ni
aceptación móvil. VERSION, catálogo, esquema y servidor no cambian; las notas de la versión
que la incorpore corresponden a esa integración.

El caso causal usa dos contextos aislados y el SDK incluido: A guarda una nota; B, con su
copia anterior, renombra el gasto. Antes DELETE + alta restauraba la nota vieja y el pull
añadía en A otra entrada con el mismo UUID. Una actualización de nota con cero filas también
resolvía sin error, y la ficha no avisaba.

## Contrato

- Un cambio exclusivo de comercio usa `cloud.renameExpense`: consulta por UUID o terna
  legacy exacta, exige una fila y conserva su identidad. UPDATE solo de `comercio` y, para
  un cargo bancario que aún no lo tenga, `ob_name`. Condiciona por dueño, UUID, fecha,
  importe, comercio y source leídos. No envía nota, categoría, importe, signo ni source.
  Cero filas, cambio de sesión o ACK inconsistente son error. La UI aplica el cambio después
  del ACK; una nota escrita mientras viajaba la petición conserva su intención.
- `setExpenseNote` devuelve una representación única con dueño/identidad, nota exacta y
  `nota_edit=true`. Ausencia de sesión, errores y respuestas vacías/inconsistentes no son éxito.
  La nota local conserva `notePending` hasta el ACK de su propia intención `noteEditAt`.
  Un ACK anterior no confirma una edición posterior. El aviso y Reintentar sobreviven a la
  recarga; la nota permanece en la partición local de gastos, sin duplicarla en app_state.
- Al cargar y mezclar, UUID idénticos se reconocen aunque haya cambiado el comercio. En
  duplicados locales se retiene la edición con mayor `expenseEditAt` y por separado la nota
  con mayor `noteEditAt`; sin reloj, se conserva la primera nota humana. No se deducen
  identidades por cantidades/comercios parecidos. Lápidas y absorciones mantienen sus guardas.
- `renameExpense` pertenece a `CLOUD_WRITES`. El modo pruebas bloquea nota y renombrado
  antes de consultar/escribir; sus cambios locales viven en la partición de pruebas.

## Pruebas y límites

Cuatro RED causales privados sobre la base: nota sustituida, dos UUID locales en A,
resolución sin ACK de cero filas y falta de aviso. La regresión permanente está en
`tests/fin04-rename-note-ack.test.mjs` y `e2e/fin04-rename-note-ack.spec.mjs`, registrados
en runner y mapa. El e2e usa dos contextos reales, SDK real con auth sintética y transporte
compartido simulado; toda red externa se intercepta. Comprueba céntimos, signo y categoría,
notas/UUID antes y después de recargar, respuestas tardías, reintento y modo pruebas.

No es una prueba de RLS ni de transacciones PostgreSQL. No resuelve escritores antiguos,
edición concurrente de importe/fecha, cola durable de renombrados, convergencia general de
notas ni LWW de recibos/deudas (fase 2 aplazada). Si el renombrado falla, la ficha conserva
el texto introducido y avisa; no promete guardarlo después de cerrar la app. Un cliente
antiguo todavía puede ejecutar DELETE + alta. Integración, catálogo, tamaño, CI general,
artefacto servido y dos móviles son gates separados de estas pruebas dirigidas.
