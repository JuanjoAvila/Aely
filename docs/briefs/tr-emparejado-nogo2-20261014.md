# TR: segunda corrección del NO-GO

Candidata desde `2439ec641f88e5d1f01548a62d6e38ada058bf76`, para el encargo
`tr-emparejado-revision-nogo-2-codex-20261014`. La entrega previa y su revisión
se conservan; esta corrección necesita revisión e integración propias.

## Comportamiento

Al borrar una pareja, la lápida de su fila bancaria lleva el mismo rastro
«sin aviso» que un borrado bancario normal. El siguiente pago igual conserva
su aviso libre. Deshacer mantiene ambas filas originales.

Una fila de la tabla sin `#dup` no demuestra una separación humana: puede
ser una foto anterior a la reparación. El refresco conserva la pareja
automática; las decisiones explícitas se unen por su hora antes de reparar
la marca. El formato antiguo con `possibleDup:false` explícito mantiene
su significado de separación.

Cuando hay parejas o decisiones automáticas locales, `syncCloudExpenses`
lee primero `app_state`, utiliza sólo `gemelos`, después lee los gastos y
reconcilia. No adopta saldos, inversiones ni settings de esa lectura.
Una reunión explícita gana a la marca bancaria atrasada; una separación
posterior gana a una reunión anterior. Fallo de la lectura de decisiones o
cambio de titular impide aplicar esa lectura y reparar sus marcas.

Editar la fecha del aviso dentro de la ventana de un día mantiene el par.
Cambiar importe, banco o sacar la fecha fuera de esa ventana lo separa.
Las parejas a dos o tres días siguen siendo preguntas, nunca automáticas.

## Pruebas

`tests/tr-emparejado-nogo2.test.mjs` ejecuta los bloques reales de borrar,
updater y sync de App. Antes del fix, los defectos 1, 2 y 3 y la edición de
fecha produjeron 2.000 céntimos frente a 1.000 esperados. La carrera con
reunión explícita y tabla todavía separada se reprodujo también en rojo.

La simulación independiente recorre 90 días con 12 semillas, avisos de
medianoche, uno a tres cargos iguales, sincronizaciones y filas de nube.
Compara el total con la verdad entera en céntimos. El importador real de
producción126 (`33d39cb80764aaf22998f69ac8bbaeffeadf4013`) crea otra cartera;
abrirla y sincronizarla dos veces con la candidata conserva cada mes.
UTC y Europe/Madrid dan diferencias de cero céntimos en las 12 semillas.

Las dos mutaciones supervivientes quedan muertas: retirar la reconciliación
del updater y hacer automáticas las parejas a dos o tres días. Se mantienen
las ocho mutaciones previas y el oráculo de 775 extractos de Recibos.

El e2e existente y registrado `tr-emparejado-automatico.spec.mjs` añade los
tres escenarios por el cableado real. La ejecución de navegador y CPU6
se registra aparte; un test Node no acredita el DOM.

## Verificación móvil tras integración

1. Crear un aviso sintético y sincronizar su apunte: debe quedar una fila y
   un solo importe gastado. Separar, cerrar y reabrir: deben quedar dos.
2. Borrar la pareja; recibir otro aviso del mismo importe y sincronizar dos
   cargos de ese día: sólo el nuevo debe contar. Deshacer antes de otro
   movimiento debe restaurar el par original.
3. En otro móvil, volver a unir la pareja separada. Refrescar primero Gastos
   en el móvil anterior: debe quedar una fila y conservarse la reunión.
4. Mover la fecha un día, manteniendo importe y banco: una fila, mismo gastado.

## Límites

No se cambia VERSION, catálogo fuente ni topes de tamaño. Los rojos de
integración se declaran con sus cifras. PR en borrador contra beta y CI
exacta no acreditan integración, beta servida, APK ni aceptación móvil.
