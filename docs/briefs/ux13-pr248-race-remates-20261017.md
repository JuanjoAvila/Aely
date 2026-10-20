# PR248: carrera de foco en las pruebas predictivas

Sucesora de la fuente `307362aaaee380a3933ce709496abd7b9828f20a`, bajo la
revisión `a89fb4a338e62d649a249aaf1db2d8e3b376471d`. La entrega previa y su
result permanecen inmutables. Preparación privada para la misma PR248; publicación
y result requieren otro turno serial.

El alta de Recibos monta un input con `autoFocus`, pero el efecto de apertura de
`BillsAddWizard` enfoca el título en el siguiente requestAnimationFrame. El helper
anterior podía escribir y activar el teclado doble antes de ese callback: el blur
posterior lo reseteaba antes del gesto. Una pasada local de los tres casos originales
dio verde; no se presenta como una reproducción del rojo intermitente del revisor.

La caracterización del DOM real, sin sustituir visualViewport, registra al abrir
la secuencia INPUT → H1. Otra prueba privada retiene el callback real de foco y lo
libera después del fill y de activar el teclado doble: INPUT/gap300/blur0 pasa a
H1/gap0/blur1 y falla la precondición exigida. Es una intercalación controlada, no
un fallo aleatorio ni evidencia de teclado físico. El primer intento del harness
falló al resolver rutas de la copia privada; se conserva y no cuenta como rojo causal.

Hay comportamiento de producto que debe comunicarse: el foco automático inicial
del input es sustituido por el título aun sin doble de viewport. El efecto sobre
un IME Android abierto requiere comprobación física. No se modifica el módulo14,
fuera del alcance de esta sucesora; no se oculta ese hallazgo reenfocando a ciegas.

El helper espera que el foco inicial haya llegado realmente al título antes de
escribir. Después exige en una condición observable foco en el input, gap300 y que
el árbitro real reconozca ese input como teclado. No fuerza el foco tras la carrera
ni introduce pausas fijas. Tras invoke espera el desenfoque real en lugar de500ms:
si se cerrara indebidamente la hoja, las aserciones siguientes la encontrarían
desmontada. Cancelar también exige conservar el foco, además de valor y geometría.
Se mantienen las aserciones de hoja, hub, dinero, historial y salida.

Los nombres locales `keyboard` y `keyboardGesture` pasan a `mode` e `ime` dentro de
los mismos ámbitos para reducir el delta UX13 sin cambiar comportamiento, ampliar
helpers o alterar el catálogo. Los 24 contratos del controlador y la sintaxis del
bundle se verifican por ese cambio de fuente; no se repite la suite financiera.

Las cinco pasadas aisladas solicitadas ejecutan los tres casos afectados, con
1worker/0retries, mismo HTML y puerto propio. El spec entero, las mutaciones causales
de los oráculos modificados y los tamaños con contexto comparable quedan fijados
con sus EXIT reales en el checkpoint privado. No equivalen a CI general, beta
pública, aceptación móvil ni ProductREADY. Módulo09, DebtEditSheet/debtEditResult,
apertura de edición, VERSION, catálogo, caps y oráculos financieros intactos.

Tamaño del nuevo HTML canónico con reserva oficial:1.342.498B minificados y
372.997B gzip. Se recortan84B minificados y9B gzip frente a307362aa; el guardián
original sigue rojo por34B crudos (58B en el build Windows). No se cambia ningún
tope. Delta nuevo contra beta139 en este contexto:+837/+359B. El A/B propio del
predecesor da+921/+368B; Claude informó+921/+362B. Se conserva esa diferencia
de6B gzip sin inventar equivalencia de entorno;118B era el exceso del cap del
predecesor, no su delta. La primera comparación que esperaba igualdad exacta con
Claude abortó; se conserva y se midió después sobre entradas canónicas comparables.
