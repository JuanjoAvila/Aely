# FIN-04 · revisión del NO-GO de PR218

Candidata aislada sobre beta119 `788432f4682c199edd785f6973d9353330c0064a` (rebase solicitado por Claude en el mensaje canónico `4a9e38ddab36cea4c2655aef956ce27c5cf7a61d`; base original del encargo: beta118 `7e706174255f1868d15099e11a503dd23d9aa774`), sin integrar ni publicar. El resultado de la primera candidata queda como historia, no como aceptación de esta revisión. Fuente, pruebas Node, DOM, CI y móvil requieren evidencia propia. El coordinador integra VERSION, notas y catálogo sólo después de revisión independiente; esta rama no los modifica.

## Qué se comprueba

La base de comparación se guarda al hacer el gesto sin red. La cola se drena en orden al aceptar sesión, online, foreground y tras pull; una pasada por disparador, sin bucle de reintentos. El plazo de Deshacer se guarda en disco. Ausencia acreditada cierra DELETE o una fila retirada con lápida; Descartar consulta el remoto y retira la cadena de intenciones de esa fila. Importe normalizado a céntimos antes de encolar, ningún propietario nulo, purga de claves privadas al cerrar sesión o borrar cuenta.

La realineación exige UNA fila con propietario, instante, céntimos, comercio y origen exactos. Remapea UUID, orden manual, `possibleDupOf` y referencias de pruebas de recibos sin atribuir un pago nuevo. La muestra sintética de siete filas tiene dos resolubles (id corto/UUID divergente) y cinco rechazadas por dueño, instante, céntimos, comercio u origen distinto; otra prueba veta dos candidatas exactas. No es una estimación de la cartera real.

Los 28 mutantes incluyen los siete supervivientes de la revisión y dos guardas contra la repersistencia de secretos tras logout en otra pestaña. La cifra anterior «2 pasan / 16 fallan en la base» se retira expresamente: el contrato llamaba una función inexistente en esa base. No se usa esa cifra para acreditar mejora.

## Compatibilidad de source preparada para integración

La orden canónica ea747c75 exige conservar el tramo final #n<k> y la marca alternativa ~recibo.<id>. El lector/escritor FIN-04 admite ordinales canónicos de 2 a 999999 en OB e histórico; conserva el texto exacto, rechaza ceros iniciales, orden inválido, marcas dobles y ordinales en fuentes manuales. Cambiar la deuda reemplaza la marca de recibo por decisión expresa; cambiar banco, categoría o duplicidad conserva los demás tramos. Un cambio remoto de recibo provoca conflicto de categoría/deuda. Un ACK con otro ordinal no confirma la escritura. No se convierte a notificación una fila con ordinal o marca financiera: perdería su identidad.

Los siete casos añadidos incluyen 36 combinaciones de ida y vuelta, 19 negativos, escrituras por UUID sin tocar el otro ordinal y realineación por source completo. Cinco mutantes nuevos vigilan conservación, límites y validación del escritor. Es preparación del transporte: esta rama no adopta los importadores ni los conversores locales de las ramas de Claude. La integración debe probar también su viaje completo. Una cola anterior con base sin recibo puede pedir resolver conflicto explícitamente; nunca se inventa esa base.

## Convivencia y límites

Un cliente antiguo puede conservar dos filas al recibir ediciones cruzadas de una identidad: su mezcla no conoce este contrato. El drenado no arregla su algoritmo ni deduplica por parecido. Hay también una ventana entre la lápida de la clave antigua en `app_state` y el UPDATE de `expenses`; otro móvil puede ocultar el gasto durante esa ventana. El drenado automático la reduce al siguiente disparador con red, sin garantizar atomicidad entre recursos. No hay recibo remoto de operación, revisión global ni protección ABA. Una colisión de índice único sigue requiriendo decidir y tiene salida mediante Descartar.

## Prueba del dueño, cuando se publique en beta

Usar un movimiento de prueba identificable y anotar sus valores iniciales; no hace falta borrar datos de la cartera.

1. Activar modo avión, cambiar nota, categoría y tarjeta. Debe cambiar la ficha inmediatamente y aparecer el aviso de pendientes. Cerrar y abrir la app: conserva los cambios y el aviso.
2. Recuperar conexión sin pulsar Reintentar. La cola se vacía; al abrir en el segundo móvil aparecen los tres cambios. Repetir dejando la app en segundo plano durante el corte y volviendo después.
3. Con el primer móvil sin red, editar una nota. En el segundo, cambiar esa misma nota a otro valor. Reconectar el primero: muestra conflicto y no pisa el segundo. Descartar recupera lo del segundo; repetir y elegir Mantener mi cambio sólo tras revisar el aviso.
4. Apuntar un importe de prueba con tres decimales: debe quedar a dos y no retener un pendiente por comparar distinta precisión. Provocar una edición que coincida con otro apunte: el conflicto se puede descartar y queda una sola identidad por movimiento, sin borrar el otro.
5. Borrar un movimiento de prueba y cerrar antes de cinco segundos. Reabrir con red: respeta el plazo restante y luego el borrado deja de estar pendiente. En otro intento, usar Deshacer antes del envío: vuelve sin alta adicional.
6. Comprobar en es/en/ca el singular de un cambio pendiente y la salida Descartar. Verificar una notificación TR marcada repetida: Son distintos conserva su origen de aviso del móvil.
7. Con una operación pendiente, cerrar sesión y volver a entrar: no reaparece su nota privada en la cola. Borrar cuenta sólo se verifica con una cuenta sintética destinada a ello, nunca como paso sobre la cuenta familiar.

Los dobles Node y navegador no acreditan una escucha del móvil, RLS desplegada ni publicación. Los EXIT y SHA finales se consignan en el resultado canónico del encargo.
