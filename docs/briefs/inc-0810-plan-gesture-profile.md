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
