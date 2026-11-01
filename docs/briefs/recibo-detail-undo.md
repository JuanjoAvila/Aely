# Deshacer al quitar desde la ficha del recibo

Candidato sobre `41c34fc9830f6c87304d364edd271bb2014dfb9d`. Pendiente de revisión final,
integración y publicación. No acredita aceptación en un móvil real.

La ficha de un recibo que ha subido o ha dejado de llegar permite «Ya no lo tengo».
Antes llamaba a una retirada distinta de Todos, cerraba con un aviso de éxito antes de
resolver las preguntas y no ofrecía Deshacer. Ahora delega en el mismo `useBillUndo`.
El controlador vive en Plan, que sigue montado si se quita el último recibo; la ficha
se cierra después del commit y Deshacer dura cinco segundos desde ese commit.

Un cierre explícito de la ficha cancela su intención pendiente; la desaparición de
la ficha tras quitar no cancela la posibilidad de deshacer. Salir del segmento o
abrir Todos invalida la acción anterior. El toast de Deshacer se comparte con Todos.
`quitarReciboPreguntando` queda como adaptador al controlador: su nombre identifica
un bloque del catálogo beta y no contiene una segunda implementación financiera.

Las transformaciones `billUndoReview`, `billUndoRemove`, `billUndoRestore` y
`billUndoSend` conservan su código. Si cualquiera de las deudas vinculadas ha cambiado,
Deshacer no repone ni recibo ni deudas ni marcas y presenta un único aviso. El cálculo
se realiza dentro del updater sobre el estado fresco y solo se confirma tras su commit.

## Validación dirigida

Datos sintéticos, Chromium móvil, un trabajador, cero reintentos y parada al primer
fallo. El HTML se ensambla desde las fuentes del checkout y su hash coincide con el
servido por el puerto propio. No se usa el HTML generado heredado de la base.

- Rojo causal de la base: la ruta real de la ficha quita el recibo y ajusta la deuda,
  pero falla al exigir el botón Deshacer. El mismo caso en el candidato restaura
  exactamente recibo y deuda y conserva el resultado después de recargar.
- Ficha: dos deudas con cambio posterior, ajuste cancelado, aparición de deuda huérfana,
  último recibo, doble toque, caducidad, cierre con pregunta pendiente o transición
  encolada, rechazo de respuesta obsoleta y salida de segmento.
- Regresión de Todos: retirada y restauración tras preguntas, rechazo todo-o-nada y
  paso por Plan vacío. Se conservan los registros de las pruebas existentes.
- Node: cancelación explícita sin desmontar el host y contratos afectados del controlador,
  caducidad y saldo. Las pruebas no sustituyen la revisión de dinero ni el móvil real.

No cambia versiones, catálogo fuente, backend ni reglas de dinero. El build local
genera artefactos de prueba; esos ficheros generados no forman parte del cambio.
