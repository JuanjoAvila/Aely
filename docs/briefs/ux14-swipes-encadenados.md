# UX14 · continuidad al encadenar pestañas · candidata local, 19/10/2026

Base exacta: `48d5ef8106ecb8ac119a3af0e7b79ca10878359b` (4.26.146). La noticia de
la integración 147 no cambia la base de este experimento. Pendiente de integración,
CI general y aceptación móvil; esta evidencia local no acredita una entrega.

Al invertir el dedo antes de acabar los 420 ms de asentamiento, el track retrocedía
entre 44 y 133 px hacia el destino anterior. Los doce cambios de pestaña sí acababan
bien y no aparecían tareas largas: comprobar solo el destino o los tiempos ocultaba
el fallo. La cadena pausada no daba esos retrocesos. No se ha reproducido un bloqueo
de CPU creciente con el historial en este escenario.

El asiento seguía escribiendo `transform` y el arrastre nuevo partía de `-tab*ancho`,
aunque aún no hubiese llegado allí. La candidata cancela e invalida ese asiento al
reclamar el eje horizontal y toma la posición visible como origen del arrastre.
El inicio táctil vertical conserva su recorrido; la guarda de eje y la decisión del
destino al soltar conservan sus umbrales. No cambia cálculo ni almacenamiento financiero.

## Medida y control causal

Chromium 149.0.7827.55, 393×851, CPU6 por CDP, SW bloqueado, red externa abortada,
reloj de fixture que avanza y datos sintéticos. Sonda `PerformanceObserver` antes de
navegar; splash ausente; rAF sin lecturas de layout por frame. Los inicios se comprueban
fuera de `data-noswipe`, scrollers horizontales y EDGE52; aterrizaje por cambio real de
tab. Sin Profiler ni Tracing durante las mediciones ni sondeo de locators en sus ventanas.

Concurrencia expresamente autorizada por `4ff63f8940fc2277a647aa807bc985c325dc8ba6`:
los censos privados registran procesos ajenos de `beta-sources` y un navegador Edge.
No se presenta como máquina exclusiva ni se modifica un proceso ajeno. Orden real por
histórico: **A1, B1, A2, B2**. A es la base; B la candidata, con build y hash servido distintos.

Cada pasada contiene dos recorridos Inicio→Gastos→Plan→Cartera→Plan→Gastos→Inicio,
230 px por gesto y 20 ms de pausa. La duración solicitada es 90 ms; la observada por CDP
en estas ocho pasadas es **159–260 ms**, siempre menor que el asiento de 420 ms.
No se informa como si los eventos hubiesen durado exactamente 90 ms.

| histórico | pasada | gestos válidos | deltas rAF | >32 ms | máximo ms | retrocesos >8 px | mayor retroceso px |
|---|---|---:|---:|---:|---:|---:|---:|
| 90 | A1 | 12/12 | 187 | 1 | 33,3 | 3 | 130,2 |
| 90 | B1 | 12/12 | 192 | 1 | 33,3 | 0 | 0 |
| 90 | A2 | 12/12 | 184 | 0 | 16,8 | 3 | 133,0 |
| 90 | B2 | 12/12 | 195 | 2 | 33,4 | 0 | 0 |
| 2.000 | A1 | 12/12 | 190 | 1 | 33,4 | 3 | 127,5 |
| 2.000 | B1 | 12/12 | 188 | 0 | 16,8 | 0 | 0 |
| 2.000 | A2 | 12/12 | 189 | 1 | 33,4 | 3 | 133,0 |
| 2.000 | B2 | 12/12 | 193 | 1 | 33,3 | 0 | 0 |

Ninguna tarea larga en estas ocho ventanas. La corrección demuestra continuidad de
posición, **no una mejora general de tiempo por frame**: con 90 filas, B2 tiene más
frames >32 ms que A2. Retroceso significa desplazamiento >8 px contra el sentido del
dedo entre dos rAF consecutivos, ambos con el track en arrastre y dentro del mismo gesto.
El criterio se fijó tras descubrirlo en el baseline y antes de la comparación A/B.

Se conservan ocho calibraciones previas completas: cuatro con la sonda original de
nueve eventos y esperas acumulativas, cuatro con cuatro eventos rápidos y planificación
por tiempo transcurrido. El primer envío «rápido» duraba 294–393 ms por la ida/vuelta CDP;
esa limitación motivó la segunda sonda. Cuatro controles pausados: cero retrocesos;
cuatro cadenas rápidas de base: tres retrocesos cada una. No se descartan como outliers.
Regla de repetición predeclarada: máximo de frame >2× la mediana de máximos del mismo
escenario; no se activó. No hay pasadas originales eliminadas ni reintentos ocultos.

## Regresiones y límites

`e2e/rendimiento-tabs.spec.mjs` ya está en CROSSCUTTING y en la fase aislada de rendimiento.
Añade tres casos UX14: cadena rápida con 90 y 2.000 movimientos y control pausado con 90.
Adjunta rAF crudo, gestos, aterrizajes, >32 ms y retrocesos. Las dos cadenas rápidas dan
RED en el HTML de la base, tres retrocesos cada una (EXIT 1); los tres casos pasan en la
candidata (EXIT 0, un worker, sin retry). Se conserva también el fallo inicial del arnés:
Playwright exige configurar `trace` fuera del describe; se corrigió antes del RED causal.

Los ocho casos existentes de `swipe-pestanas.spec.mjs` pasan: recorrido y contenido,
borde de Gastos, Ajustes al volver a Inicio, desenfoque, cancelación con scroll posterior
y arranque sin salto del track y del cajón. Sintaxis y presupuesto de tamaño: EXIT 0,
sin ampliar topes. Los informes JSON y las salidas originales se entregan privadamente.

No se ejecuta la suite completa ni se modifica VERSION, catálogo, topes, backend o
Android/APK. Notas de versión y catálogo quedan para la integración autorizada; propuesta
de texto de familia: ES «Cambiar rápido entre pestañas y volver sigue el movimiento del
dedo sin saltos»; EN «Quickly switching between tabs and back follows your finger smoothly»;
CA «Canviar de pressa entre pestanyes i tornar segueix el moviment del dit sense salts».

La inercia nativa, WebView/Android, 120 Hz y aceptación en el móvil no quedan acreditados
por Chromium de escritorio. El control de cancelación comprueba que el scroll vuelve a
funcionar, sin afirmar una cualificación del overscroll nativo.
