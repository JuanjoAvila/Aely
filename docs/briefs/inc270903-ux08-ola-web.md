# INC-2709-03 / UX-08 · Gestionar y categoría · candidata web, 19/10/2026

Base exacta: `78b54d61d690ff25965a4bffafc13c92287157cc`, beta4.26.148. Encargo
`a39c6d25`, grants `f63fb0c3` y `522babf7`; sucede al cierre R2 de PR284, que queda
intacto. Esta candidata no acredita una integración ni una entrega al móvil.

El síntoma comunicado es la ausencia de la ola nativa Android al llegar al borde del scroll
de Plan → Recibos → Gestionar y sus categorías. Chromium de escritorio no permite acreditar
esa animación de WebView. La reproducción sí descubre un fallo WEB verificable: al abrir
Servicios desde un hub desplazado21 px, la hija fixed queda a **y=-21 px**, con su cabecera
recortada. Al llegar al fondo de la hija y propagarse el scroll al padre, la hija se mueve con él.

## Causa demostrada y cambio

La regla `.v4-bills-push` declaraba `will-change:auto`, pero la posterior `.settings-push`,
de igual especificidad, volvía a poner `will-change:transform`. Una apertura con click sin
eventos táctiles ya conserva esa promoción. El scroller se convierte en containing block
para sus hijas fixed, aunque su `transform` calculado sea `none`.

Un toque real de categoría añade otra vía: `useEdgePageClose.fin` llamaba a `reset` aunque
no hubiera reclamado un eje horizontal, dejando una matriz identidad inline `!important`.
Cancelar un arrastre también conservaba esa matriz al terminar. La identidad sigue creando
el containing block; no equivale a `transform:none`.

La corrección se limita a las pantallas de Gestionar mediante `plainScroll:true` en sus dos
hooks de cierre. Un toque sin arrastre no aplica reset. El retorno tras cancelar limpia sus
estilos a los250 ms, tras la transición de240; una nueva toma horizontal o un cierre invalidan
esa limpieza para no borrar un gesto vivo. La regla específica de estas pantallas gana solo
en `will-change` y `transition`: al retirar la identidad no arranca una segunda transición
genérica hacia `none`. Padding, dimensiones, gesto vertical, umbrales y destino de cierre
conservan su comportamiento. No se suprime el overscroll ni se escribe estado financiero.

## Reproducción visual

Chromium149, Windows, viewport393×740, tacto real CDP, datos sintéticos, SW bloqueado y red
externa abortada. Cada apertura usa el botón real; desplazamiento mediante touchstart/move/end,
bordes superior/inferior y reversión. Se vuelve mediante historial web un nivel cada vez.
La sonda recoge DOM, geometría, estilo/transform/overflow/touch-action y los frames PNG
entregados por `Page.startScreencast`, además de capturas de frontera.

Los frames del compositor y los snapshots DOM/rAF son flujos asíncronos: no se presentan
como pares pixel-DOM perfectamente sincronizados, ni como una medida de fps/latencia.
No hay CPU6, Profiler, Tracing ni acciones de dispositivo/Android/APK en esta tarea.

| observación | base148 | candidata |
|---|---|---|
| reposo de Gestionar | will-change:transform | will-change:auto |
| padre después de tocar categoría | matriz identidad inline | transform:none |
| posición de la categoría al abrir con padre desplazado | y=-21 px | y=0 |
| posición de la categoría al llegar al fondo | se desplaza con el padre | sigue en y=0 |
| cancelación y nuevo arrastre antes de la limpieza | matriz retenida | limpieza invalidada durante gesto y none al descansar |
| cartera principal y gastos, comparación cruda | exactos en pasada completa | exactos en pasada completa |

El control con click también se conserva y separa la cascada CSS del reset táctil. Los JSON
privados guardan secuencia, fases, coordenadas, host alcanzado, source/hash servido y archivos
PNG originales; no se usa una superficie que imite la app ni se altera el contenido del DOM.

## Regresiones y fallos conservados

`e2e/plan-ola-web.spec.mjs` está registrado para `14-v4-screens` en E2E_MAP; `02-ui-shared`
y shell siguen siendo CORE, sin debilitar ese alcance. Cuatro casos: reposo sin capa,
categoría normal/reducida anclada al viewport, cancelar/reanudar sin borrar el arrastre nuevo.
Cada caso exige igualdad byte a byte de `micartera_v3` y `micartera_v3_exp` después de la copia
automática de arranque. Cuatro RED causales de base y cuatro GREEN de fuente final, un worker,
cero retry. Se conservan aparte los intentos que no llegaron a categoría.

Nueve guardianes existentes de `plan-gestionar` pasan: apertura, cifra/barra animada,
historial de un nivel, cierre desde el centro, cancelación y cierre emulado del hub/hija,
simulador, ficha y salida animada antes del desmontaje. Los eventos de atrás llamados
«nativos» en esos tests son **emulados en web**, no evidencia de Android real.

Se conservan todos los fallos previos de la sonda: el tirón de control de Plan cambiaba
Recibos a Deudas y ocultaba Gestionar; hubo toques consumidos para parar la inercia y cierres
pedidos antes de terminarla. La sonda vuelve por la pestaña real de Recibos y usa un toque
neutro para detener el fling antes de la siguiente navegación. No fuerza botones ni cambia
oráculos financieros. La primera comparación cruda también recogía el `_savedAt/lastBackup`
automático del arranque; las pasadas completas esperan ese commit natural y conservan el
resultado inicial, sin filtrar esos campos para obtener un verde.

Una primera candidata pasó3/4 y mostró una segunda transición CSS al limpiar la identidad:
se conserva ese fallo y se corrige la transición de reposo, sin ampliar la tolerancia.
La prioridad CSS final se acota a dos propiedades para conservar la geometría del diseño.

## Límites de entrega

Esto corrige un defecto web de composición/geometría y restaura las precondiciones declaradas
del scroller. **La ola visual nativa de Android permanece sin verificar**: ni su ausencia en
desktop ni los eventos emulados establecen una causa nativa. No hay evidencia independiente
para proponer un cambio nativo o un coste de APK en este corte.

Fuente/PR, EXIT reales de tamaño/sintaxis/mapa/documentación y bloqueos se detallan en el
cierre privado. No se ejecuta la suite general: CORE exige esa CI al integrar. Sin VERSION,
catálogo, topes, backend, APK, merge o deploy; notas e integración quedan para Claude.

Gates locales: sintaxis y registro/mapeo EXIT0. Presupuesto de tamaño EXIT1 por el crudo
minificado (redondeado1392 KiB frente a1392 KiB); gzip386/387 KiB y bloqueantes3/3 pasan.
No se cambian topes. El chequeo documental del commit final se conserva en el cierre, separado
de esta evidencia focal y de la reconciliación de versión al integrar.

Texto de familia propuesto para integrar: ES «Las categorías de Gestionar plan se abren con
la cabecera completa»; EN «Manage plan categories open with their full header visible»;
CA «Les categories de Gestionar el pla s'obren amb la capçalera completa».
