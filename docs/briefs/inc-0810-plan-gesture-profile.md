# Diagnóstico de scroll desde el tope de Plan

Fuente inicial: beta 102, `6b81279676d66337d7b34b7badc6d1ff2c66bc24`.
Preparación de pruebas, sin cambio de producto, publicación ni causa acreditada.

La prueba existente de segmentos recibe ocho casos de diagnóstico. El dedo llega por CDP
al DOM real con CPU seis veces limitada. Recibos, Deudas y Metas se comparan desde el tope
y fuera del tope, en primera pasada y tras doce ciclos reales de pestañas y scroll, con movimiento normal y reducido. El dedo de diagnóstico avanza 190 px en 38 pasos separados 32 ms para cubrir el arranque lento. Se
registran eventos, cancelación, clase de ownership, scroll por frame y tareas largas. Los
controles de Inicio/Gastos, inversión y cancelación conservan la ruta y limpian ownership.
El spec conserva los guardianes anteriores de segmento y swipe horizontal y ya figura en
el mapa de selección; no se crea una prueba que el runner deje dormida.

Los eventos de captura y sus microtasks no son una lectura final garantizada de los handlers
ni del scroll nativo. Los frames muestran la evolución posterior, con la sobrecarga de la
instrumentación. No hay lecturas de estilo ni dimensiones por frame. Un máximo de frame
aislado no demuestra causa humana ni mejora de rendimiento. Doce ciclos de uso no sustituyen una sesión humana larga; INC-2709-09 continúa abierto. Una segunda pasada separada usa CDP Tracing sin lector de frames y agrega únicamente eventos completos del hilo CrRendererMain (Layout, UpdateLayoutTree, Paint, EventDispatch y RunTask). Sus duraciones anidadas se solapan y no deben sumarse como tiempo exclusivo. El stream y sus argumentos nunca se imprimen en logs. Un timeout, límite o stream incompleto falla explícitamente; no se presenta una traza parcial como evidencia.

El banco usa exclusivamente filas inventadas y dobles de nube; las peticiones fuera de
localhost se bloquean. No se pulsa sincronización bancaria, ni se editan importes o cuentas.
Los casos exigen entrega del toque, scroll efectivo fuera del tope, limpieza tras finalizar
y conservación del segmento y del histórico de gastos. La preparación pasó sintaxis del
spec y mapa de pruebas. Chromium no está instalado en el entorno local: ejecución DOM,
informes íntegros y revisión final dependen de la CI exacta. No afirmar verde por el código.

Los siguientes pasos son leer los informes completos del SHA ejecutado y distinguir
entrega/ownership, cancelación nativa, trabajo de layout y evolución del scroll antes de
proponer una corrección conjunta de App y Plan. Este diagnóstico no acepta una solución
aislada anterior ni modifica gates de presupuesto, aprobación móvil o publicación.

## Corrección del banco tras CI del 8 de octubre

CI37708273878, fuente `fe95f18ff155e9be1ee327183d3b17894971c621`, falló en ambos
controles Inicio/Gastos al intentar clicar Gastos después de bajar Inicio: contenido de
Inicio interceptaba el click. La fuente puede ocultar expresamente botnav al bajar y la
revela al subir o cambiar pestaña. El banco presuponía una barra alcanzable sin comprobarla;
los logs no acreditan la clase exacta de la barra en ese instante, un carrusel atascado
ni un fallo humano. La ocultación legítima es compatible con el fallo observado, no una
causa DOM medida. El diagnóstico ahora cambia por swipe horizontal CDP real a y200,
sin forceclick, exige la pestaña de destino, host único activo/aparcado, punto de toque
perteneciente al host y ownership liberado salvo Inicio, donde el tope lo reclama a propósito.
Un transform repetido durante tres frames ya no basta para dar el carrusel por asentado.

Recibos falló en ambos modos por recorrido de sólo71px frente al requisito>200. La portada
de Plan resume tres pendientes aunque se siembren muchos. El fixture fija26/9, usa banco
sabadell para24recibos y abre «Ver más» por su botón real; exige40filas (24recibos y16cuotas)
antes de medir. La lógica pura confirmó40pendientes y0pagados/traspasos, no acredita el DOM.
Al volver de cada ciclo la lista debe seguir expandida. Se mantienen altura>200, CPU×6,
38pasos×32ms,190px, primera/tras12ciclos, tope/fuera, normal/reducido, toque/scroll efectivos,
segmento, ownership, histórico y trazas separadas. Ningún cambio en producto o presupuesto.

Sintaxis, mapa, privacidad y diffcheck locales pasan; discovery lista15casos (7anteriores y
8diagnósticos). El adaptador temporal a Playwright instalado se retiró; no se instaló navegador.
Chromium local ausente: nueva CI y DOM exactos pendientes, sin declarar corregido el incidente.
El fallo hist-visor de aquella CI queda separado y sin tocar. Los fallos de scroll, ownership,
segmento o llegada del swipe que subsistan seguirán fallando; no se reinterpretan como verde.

## CI exacta y guard del visor · 8 de octubre

CI37713846795 terminó FAIL por un único fallo de `hist-visor`: el primer guard obtuvo
opacidad 0 y 0.6429 en su retry tras contar las clases. Los 15 casos de Plan pasaron; también
891 funcionales/1 skip y 9 de rendimiento. Hubo 1 fallo del visor. No se declara CI global verde;
la comprobación final de privacidad de esa CI quedó sin ejecutar.

Se incorpora byteexact el guard de `f77aa70bce5296615dcd2b2cf07bd8b3721a280e`: espera
conjuntamente 60 clases y opacidad de fila 30 superior a 0.9 dentro de los mismos 8000 ms.
Conserva snapshot/aserciones finales y segundo guard. No modifica los 15 casos Plan, sus
umbrales, CPU×6, trazas ni los contratos de llegada/ownership/scroll; tampoco runtime,
registros, versiones o presupuesto. Es una corrección del banco de pruebas, sin atribuir
la causa del lag humano. Nueva revisión y CI exacta pendientes. Sintaxis/mapa/relevant,
privacidad y diff locales comprobados; DOM local ejecutado 0, Chromium ausente.

## Preparación causal de ownership · relevo 23 · 8 de octubre

Sobre `bcb318e627d6a5c62b3e8805dfcaab6e805cf3b9`, extensión de pruebas solamente.
No hay cambio de producto ni resultado de rendimiento ejecutado localmente.

La traza separada marca inicio, primer cierre nativo (`touchend` o `touchcancel`), fin del
input CDP y final de la espera. El clasificador recorta cada evento completo del renderer a
las ventanas durante el toque, después del cierre nativo y después del fin de input. Esta
última ventana es un subconjunto de la anterior: tampoco se suman entre sí. Un evento que
atraviesa el cierre aporta sólo su intersección a cada lado. Marcas ausentes o desordenadas
fallan; un `touchcancel` temprano no se etiqueta como `touchend`. Los listeners pasivos de
marcado se retiran incluso si falla el inicio o el gesto. No hay lector de frames en la traza.

Tras los doce ciclos y sólo en movimiento normal, cada segmento recibe cuatro pasadas ABBA
con el mismo dedo y desde scroll cero: baseline, neutralización CSS, neutralización CSS y
baseline. La intervención temporal neutraliza únicamente `touch-action:none` de la clase
`mc-touch-own` del host; deja intactos la clase y los handlers, incluido su scroll manual y
`preventDefault`. Por tanto el contraste prueba esa regla CSS, no toda la lógica de ownership.
Cada pasada exige host asentado, scroll efectivo, segmento/pestaña conservados y clase liberada.
El estilo y los hooks se eliminan en `finally` y se comprueba la restauración automáticamente.
Se conserva el histórico al terminar. El orden ABBA reduce confusión por orden; dos muestras
por condición no permiten atribuir un síntoma humano prolongado ni asegurar una mejora.

La CI recibe sólo agregados sintéticos, nunca argumentos ni stream bruto de la traza. El
clasificador tiene un caso en el spec ya registrado que comprueba fronteras, cancelación,
exclusión de otros hilos y rechazo de marcas incompletas. Diez aserciones adicionales Node
sobre datos de traza inventados pasaron localmente; sintaxis, mapa, privacidad y diff pasan.
Chromium local sigue ausente: cero gestos DOM de esta extensión ejecutados, informes de pares
y CI exacta pendientes. INC-2709-09 sigue abierto; no hay causa ni corrección acreditadas.

### Corrección tras revisión independiente del diagnóstico

La primera extensión agrupaba todos los hilos llamados `CrRendererMain`, que pueden existir
en procesos diferentes. Se rechaza ese clasificador: ahora todas las marcas del gesto deben
pertenecer a un único `pid/tid` renderer y sólo ese hilo aporta costes. Marcas en hilos mezclados,
o inicio/fin duplicados, fallan. El control negativo añade otro renderer `77/88` con Layout
solapado y exige agregados idénticos; mezclar sus marcas exige fallo. Nueve aserciones Node
verificaron separación, fronteras y rechazos; el spec conserva también controles negativos.

Cada par mide una vez, al propagarse `touchstart` después del handler de Plan, la adquisición
real de `mc-touch-own`, el `touchAction` computado y la pertenencia del destino al host/pantalla.
Exige `own:true` y `none` en baseline frente a `auto` con neutralización. También comprueba el
punto real `(196,430)` antes del dedo. Si no hay adquisición o tratamiento, el par falla: un
contraste nulo no se interpreta sin acreditar la intervención. Esa única lectura de estilo
puede provocar actualización de estilo/layout y su coste forma parte de ambas condiciones;
no hay lecturas de estilo por frame ni observador persistente. Los listeners y resultados
temporales se retiran incluso si falla la traza, y la comprobación final exige su ausencia.
Cambiar CSS después de comenzar un toque no cambia retroactivamente los permisos nativos
decididos al inicio: el contraste sigue limitado a la regla CSS, con handlers intactos.
DOM y pares remotos continúan pendientes; no hay mejora ni causa humana acreditadas.
