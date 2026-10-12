# INC-0610 · FAB y barra se retiran juntos · candidata98

Estado actualizado el7/10: fuente integrada en beta mediante PR153/SQUASH `b7abebb6db7a74ccc9f7df87b41f5d63981b0c43`, árbol exacto `2d795049e639174539257138230f636a076d70af`. Revisión independiente GO y CI exacta37564577536 SUCCESS. Publicador37569120748 y artefactos servidos pendientes al escribir este corte; aprobación móvil98 pendiente. Los apartados siguientes conservan el historial de preparación y sus límites, superados únicamente por la evidencia actual. Feedback directo del dueño6/10, 20:59 Madrid: beta97.1 conserva el contorno pero el botón central se queda atrás y desaparece tarde. Encargo/rootclaim `inc-0610-fab-sync-hide-20261006`, confirmado en `b0ecee878ecb17d1147718b06885f98803cf9b49`. Base beta `505fbb6c4db8cf7908c2541c51240ebbb48f20ca`, nueva rama aislada `aely-fab98-prep`. No se toca la candidata de producción96 ni se publica código.

## Causa e intervención

La97 oculta el botón mediante visibility discreta con retardo550ms, después de colapsar max-height y paddings. El contrato solo vigilaba inicio/final: podía pasar sin comprobar el recorrido que describe el feedback. La caja colapsada todavía deja el círculo parcialmente por encima; un apagado por reloj elimina ese casquete sin corregir su movimiento.

La candidata mantiene el clip con margen30 que protege el primer contorno, pero mueve únicamente el FAB mediante top relativo0→30px, con la misma duración y curva cubic-bezier(.4,0,.2,1) de max-height/padding. La barra sigue sin transform, bottom0, opacity1 y fondo sólido. Top no cambia la altura de la fila; clip sigue sin crear un contenedor desplazable. CSS invierte desde el valor interpolado si se retira la clase antes de acabar; no hay temporizador ni visibility retardada. El desplazamiento30 es una hipótesis geométrica conservadora para sacar también el contorno/halo del borde, no una medición nueva del móvil: requiere rectángulos y píxeles reales para aceptar el diseño. Reduced-motion del sistema incluye explícitamente el FAB; el ajuste de app ya reduce globalmente las transiciones.

## Guardián y contraste exigido

Se conservan contorno inicial por píxeles, franja final con/sin FAB, reveal y cancelación de la suite existente. Se elimina finish. Una segunda ocultación por gesto empieza una colección natural rAF al entrar botnav-hidden, sin pausar ni forzar el reloj. Recoge altura/rectángulo de barra, top/rectángulo de FAB, visibility y restricciones del host durante750ms. Exige al menos tres muestras intermedias normales, avance parejo dentro de0.06, retirada relativa del FAB durante ese intervalo, botón fuera del viewport al terminar y visibility siempre visible: su desaparición debe venir del movimiento. La97 tiene offset0 y visibility tardía: se espera rojo; esa expectativa no sustituye ejecutarlo.

Matriz doce: Green/Cyber × safe-bottom0/34 × normal/reducido app/reducido sistema. Cancelación CSS100ms comprueba posición antes/después de invertir y primer rAF; normal exige0<elapsed<550ms. Los guardianes táctiles de cancelación y de ola permanecen separados. Capturas pausadas acreditan solo contorno, no fluidez; leer rectángulos rAF añade trabajo y no acredita rendimiento. Ninguna prueba sintética equivale al WebView Android real.

Scope de `inc-2709-13-fab-contorno` y mapas permanecen intactos; el bloque existente cubre esta CSS y cambia su revisión. Nota98 con título/puntos/guion en es/en/ca; las notas de todas las versiones anteriores se conservan; la tarjeta activa de97 se traslada a98, sin alterar su rechazo. No se repina ni fabrica aprobación.

## Verificación y límites

Ejecutados con exit0: build, sintaxis del spec, check-syntax (7 bloques), docs-frescura, docs-frescura-history (29 repositorios), guard-privacy, relevant-tests, i18n-keys, novedades-idiomas, release-notes-max, beta-tandas-vacias, beta-veredictos y security. Comprobación independiente de mapas y registro byte a byte sin cambios,217 notas anteriores completas, único runtime modificado shell, nueva revisión FAB y selección del guardián: exit0. Dos builds sucesivos idénticos en index, release-notes y beta-delivery; artefactos exclusivamente generados. Revisión web candidata `96c3bb4eb266d7ba7dbfb21f357436c859c0323f80a9bd6eb1593c5bbbdb0b76`, agregado `7961f81d2c95f72c65982e611c4b3bb2370758f8180ef8a3e12d6ff9b0148871`.

`beta-sources.test.mjs` sigue activo al cerrar el commit; PERSIST91 y sus guardianes iniciales pasaron, sin acreditar todavía exit final. Suite completa/Deno pendientes de CI exacta.

Playwright descubre las doce configuraciones con exit0. El intento real `chromium.launch()` termina exit1 antes de página: no existe el ejecutable esperado `chromium_headless_shell-1228`. La búsqueda local incluye cachés ocultas y no localizó otro binario; no se instala ni se elude ningún bloqueo. Cero frames, píxeles o contraste rojo97/verde98 ejecutados en esta candidata: la expectativa causal del test no se presenta como una medición. Por tanto no se declara reparación funcional terminada. Revisión independiente, CI exacta y publicación son pasos pendientes del coordinador; aprobación móvil pendiente.

APK52, Android, Edge, SQL, datos y sincronizaciones bancarias intactos. No dinero real ni sincronización bancaria automática. INC-2709-09 acumulativo sigue abierto y separado de esta retirada visual.

## Ajuste posterior a revisión independiente

La revisión detectó que reduced-motion del sistema detenía sólo el FAB. La candidata ahora desactiva también la transición de la barra y exige que ambos estén retirados en el primer rAF. En normal, el guardián reproduce la CSS97 mediante una intervención temporal local sobre el mismo fixture: exige registrar un FAB todavía visible con barra de menos de3px y offset0. Luego recoge esa intervención y comprueba la candidata mediante gesto natural, sin forzar tiempos. Es un control CSS causal, no una ejecución separada del ZIP97. Contraste aún pendiente de CI; no hay GO funcional.

## Catálogo tras CI exacta fallida

La CI37562554183 del head4ea2d816 terminó roja antes de Playwright: notas-sin-duplicados detectó la misma tarjeta FAB activa en97 y98. Se retira únicamente la tarjeta activa de97; su fecha, título y puntos de Novedades permanecen iguales. Su descriptor original sigue durable en beta505fbb6c y su rechazo directo del dueño (6 de octubre, desaparición tardía del círculo) permanece abierto, sin modificar ni simular veredictos. La tarjeta98 es la revisión pendiente de prueba y aceptación; no hereda ningún OK. La96 aprobada se conserva pendiente de comprobar producción. El registro de scopes y sus auditorías permanecen intactos. La CI fallida no acredita frames; se exige una nueva CI del nuevo head completo. Las huellas anteriores corresponden a la preparación inicial, no al último árbol publicado.

## Verificación exacta posterior · 7 de octubre

CI37564577536 del head `c2309cc268e7677bc062e7bb3553af5b8ccb3959` ejecutó el merge4fa5e2cc y terminó SUCCESS: 844 E2E y9 de rendimiento, privacidad verde. Los logs del job112609271690 acreditan los12 casos FAB (Green/Cyber × safe0/34 × normal/reducido app/reducido sistema). Los cuatro casos normales ejecutan el control negativo CSS97 en el mismo fixture antes del gesto natural98: botón visible con barra menor de3px y offset0; luego progreso conjunto, retirada final, reaparición y cancelación dentro de550ms. Es contraste causal CSS, no una ejecución del ZIP97 ni una medición del WebView real.

Revisión independiente del árbol exacto: GO para beta únicamente. Las216 notas anteriores permanecen intactas;97 conserva sus puntos y su rechazo, con tarjeta activa vacía tras el traslado a98. Solo FAB cambia de revisión;96 y las demás identidades se conservan. Readback del merge confirmó árbol idéntico a la candidata. El rechazo97 permanece abierto y98 no hereda aceptación. INC-2709-09 acumulativo continúa abierto.
