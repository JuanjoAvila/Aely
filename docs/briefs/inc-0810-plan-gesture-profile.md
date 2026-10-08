# Diagnóstico de scroll desde el tope de Plan

Fuente inicial: beta 102, `6b81279676d66337d7b34b7badc6d1ff2c66bc24`.
Preparación de pruebas, sin cambio de producto, publicación ni causa acreditada.

La prueba existente de segmentos recibe ocho casos de diagnóstico. El dedo llega por CDP
al DOM real con CPU seis veces limitada. Recibos, Deudas y Metas se comparan desde el tope
y fuera del tope, en primera pasada y repetición, con movimiento normal y reducido. Se
registran eventos, cancelación, clase de ownership, scroll por frame y tareas largas. Los
controles de Inicio/Gastos, inversión y cancelación conservan la ruta y limpian ownership.
El spec conserva los guardianes anteriores de segmento y swipe horizontal y ya figura en
el mapa de selección; no se crea una prueba que el runner deje dormida.

Los eventos de captura y sus microtasks no son una lectura final garantizada de los handlers
ni del scroll nativo. Los frames muestran la evolución posterior, con la sobrecarga de la
instrumentación. No hay lecturas de estilo ni dimensiones por frame. Un máximo de frame
aislado no demuestra causa humana ni mejora de rendimiento. Primera pasada y repetición
no sustituyen uso prolongado; INC-2709-09 continúa abierto.

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
