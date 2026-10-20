# FIN04 fase 1 · PR286 revisión R3 (19/10/2026)

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
  Cambio de sesión o ACK inconsistente son error. Si la fila aún no se subió, la cola usa
  el alta existente con `ignoreDuplicates` y vuelve a exigir la misma identidad; una colisión
  no confirma el cambio. La UI conserva `merchant` hasta el ACK y guarda `renamePending`
  en la partición durable de gastos. Muestra pendiente y Reintentar, restaura el borrador al
  recargar y reintenta al volver la conexión o montar Gastos. Un ACK perdido se recupera
  leyendo la fila ya renombrada. Un ACK antiguo no consume una intención posterior.
  Una nota escrita mientras viajaba la petición conserva su intención.
- Tras **tres fallos consecutivos por intención**, el renombrado se aparta de la cola activa
  y deja continuar las ediciones siguientes. Contador y estado apartado viven dentro de
  `renamePending`, sobreviven a recargar y no se reactivan por online o por cerrar/abrir Gastos.
  Solo el tercer fallo muestra un aviso; la ficha conserva el nombre confirmado y el borrador.
  **Reintentar** crea una intención nueva y rearma el contador. Cambiar el texto también;
  cerrar la ficha con el mismo borrador no. Fallos y ACK anteriores no consumen la intención
  nueva. El aviso persistente explica que hace falta pulsar Reintentar.
- `setExpenseNote` devuelve una representación única con dueño/identidad, nota exacta y
  `nota_edit=true`. Ausencia de sesión, errores y respuestas vacías/inconsistentes no son éxito.
  La nota local conserva `notePending` hasta el ACK de su propia intención `noteEditAt`.
  Un ACK anterior no confirma una edición posterior. El aviso y Reintentar sobreviven a la
  recarga; la nota permanece en la partición local de gastos, sin duplicarla en app_state.
- Al cargar y mezclar, UUID idénticos se reconocen aunque haya cambiado el comercio, solo
  si coinciden importe, banco y referencia. Importes o referencias conflictivos se conservan
  separados. Se prefiere una copia sin lápida; a igual elegibilidad gana el mayor
  `expenseEditAt` y, en empate sin relojes, la última copia. Una lectura de la copia borrada
  no vuelve a ocultar la viva. Si todas tienen lápida, ninguna vuelve a contar.
- Se recuperan categoría marcada como editada, vínculo de deuda, noCard y nota humana de
  cualquiera de las copias. Los valores explícitos false/null/nota vacía de la última copia
  conservan los borrados. La nota usa su reloj si existe. `uuidPreserved` protege los valores
  recuperados de categoría/deuda/tarjeta frente a lecturas antiguas, en la misma partición
  local; libera cada campo cuando la nube devuelve ese valor. No añade columnas ni se sube
  como metadato servidor. La ausencia de un campo legacy no permite inferir un borrado.
- La identidad se busca por UUID y compara importe, banco y referencia al encontrar otro
  igual, sin construir firmas ni usar `JSON.stringify` por fila. Un objeto idéntico se devuelve
  directamente al refrescar; el índice se reutiliza dentro de la misma fusión, sin cachear entre
  operaciones. El memo del pull y su atajo sin cambios permanecen intactos. Un mapa de lápidas
  vacío solo evita construir claves cuando tampoco existe registro oculto de confirmados.
- `renameExpense` pertenece a `CLOUD_WRITES`. El modo pruebas bloquea nota y renombrado
  antes de consultar/escribir; sus cambios locales viven en la partición de pruebas. El
  contrato de la suite sandbox enumera los 33 escritores, incluido renameExpense, y sigue
  exigiendo cero escrituras reales.

## Pruebas y límites

Cuatro RED causales privados sobre la base: nota sustituida, dos UUID locales en A,
resolución sin ACK de cero filas y falta de aviso. La regresión permanente está en
`tests/fin04-rename-note-ack.test.mjs` y `e2e/fin04-rename-note-ack.spec.mjs`, registrados
en runner y mapa. El e2e usa dos contextos reales, SDK real con auth sintética y transporte
compartido simulado; toda red externa se intercepta. Comprueba céntimos, signo y categoría,
notas/UUID antes y después de recargar, respuestas tardías, reintento y modo pruebas.
R2 añade copias legacy sin relojes con lápidas/metadatos en ambos órdenes, importes
conflictivos firmados, red caída simulada, fila todavía no subida y dos renombrados con ACK
tardío. `merge-expenses-cloud` y `expense-note` ejecutan mutantes sobre código cargado real:
eliminar cada guarda debe romper el oráculo de dinero, metadatos, ACK o cola correspondiente.
R3 añade errores permanentes, edición independiente posterior, contador tras recarga,
aviso único, reintento explícito y fallo tardío. Los mutantes vuelven a introducir serialización,
cola bloqueada, avisos repetidos, contador reiniciado o una respuesta vieja sobre intención nueva.
La cualificación de rendimiento compara la beta `408d8d348` sin PR286 y la candidata en navegador
real, 20.000 filas sintéticas idénticas, CPU6 y orden ABAB. Retiene calentamientos y todas las
muestras; la mediana de B debe ser como máximo 1,10 veces la de A en ambos modos: filas nuevas
iguales y mismos objetos. El objetivo inicial de 100 ms procedía de Node sin limitación y fue
corregido por no ser comparable; la prueba inicial fallida se conserva. No acredita rendimiento móvil.

No es una prueba de RLS ni de transacciones PostgreSQL. No resuelve escritores antiguos,
edición concurrente de importe/fecha, convergencia general de notas ni LWW de recibos/deudas
(fase 2 aplazada). La cola se ejecuta mientras Gastos está montado; el borrador sobrevive a
cerrarlo, pero no hay sincronización en segundo plano con la app cerrada. Dos importes con
el mismo UUID quedan pendientes de resolución, sin descartar dinero. Un cliente antiguo
todavía puede ejecutar DELETE + alta. Integración, catálogo, tamaño, CI general,
artefacto servido y dos móviles son gates separados de estas pruebas dirigidas.
