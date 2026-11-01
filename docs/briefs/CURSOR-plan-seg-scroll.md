# Encargo para Cursor · segmentos de Plan al hacer scroll (1/11/2026)

Lee antes `AGENTS.md` entero y `EMPIEZA-AQUI.md`. Rama de trabajo: `cursor/plan-seg-scroll` (sale de la beta 4.26.206).
Coordina Claude local; tú implementas este encargo de principio a fin.

## El fallo (palabras del dueño, 31/10)
En Plan, al hacer scroll desde Recibos, los botones de arriba (Recibos / Deudas / Metas) «hacen cosas raras al
scrollear hacia otro sitio». Se ve en su móvil (OnePlus 13, Android 16, WebView ~150, 120 Hz). **En escritorio no se
ha reproducido.**

## Lo ya descartado (Claude, Pixel 5 emulado, CPU ×4, toques por CDP, traza por rAF)
- Bajar rápido en Recibos, subir y tirón arriba → Deudas → Metas: barra 1:1 con el scroll, sin saltos.
- Bajar en Recibos y deslizar a Cartera y volver: barra en su sitio, scrollTop conservado.
- Tocar los segmentos casi arriba: cambio en 1 frame.
- Tirón hasta el tope y seguir tirando: pasa a Deudas limpio (diseñado así).
- Tocar una cuota en Recibos con la vista bajada (irADeuda): si la deuda es la PRIMERA, la barra queda cortada 7 px
  por arriba. Cosmético; no se sabe si es su queja.
- Limitación: los toques CDP de escritorio no generan inercia (fling) ni el estirón nativo (overscroll stretch)
  de Android. Lo que solo pasa en su móvil queda sin medir.

## Hipótesis, por orden
1. **Tirón arriba + estirón nativo de Android** (`useTironSeccion`, `src/modules/02-ui-shared.js` ~739-850;
   `GEST_LEAD` en `00-core.js` ~129). En Android el slop es ~8 dp: el primer `touchmove` puede llegar con 8-11 px
   < `GEST_LEAD`=12 → `gestureAxis` devuelve null → no hay `preventDefault` → Chrome arranca el overscroll y los
   siguientes `touchmove` llegan `cancelable=false`. El estirón estira la página entera (barra incluida) mientras la
   capa baja 46 px por su lado.
2. Flick con inercia al llegar al tope: el siguiente flick cambia de sección sin querer (`startAtTop`, scrollTop<=2).
3. irADeuda con la barra cortada 7 px.

## Qué hacer
1. Reproducir en un Android real o emulador Android (no Chromium de escritorio): contar `touchmove` con
   `cancelable=false` durante un tirón arriba. Si tienes acceso al móvil por adb + `chrome://inspect`, mejor.
2. Si se confirma la 1: reclamar el tirón antes del slop cuando `startAtTop` (lead menor solo para «y-abajo»), o
   similar. **Ojo:** el 5/8 un `touch-action` restrictivo arriba bloqueó bajar: no repetirlo.
3. Arreglar también la 3 si es barato (dejar la barra entera a la vista al aterrizar, contando cabecera).
4. Animaciones suaves siempre; respetar `prefers-reduced-motion`; nada caro por frame (§7 bis).
5. e2e que caiga sin el arreglo (si el banco no lo reproduce, el problema es el banco: §7 bis), registrado en
   `E2E_MAP` de `scripts/relevant-tests.mjs`.
6. `npm run build`, `npm run test:syntax`, e2e plan-swipe-segmento, plan-scroll-lento, deudas-ir-suave,
   swipe-pestanas, rebote-barra-inferior, botnav-esconder, botnav-indicador y el tuyo (`--workers=1 --retries=0`).
7. NO hagas bump de versión, ni RELEASE_NOTES, ni push a `beta` o `main`: empuja SOLO tu rama `cursor/plan-seg-scroll`.
   Al final de este fichero añade «## Entrega»: qué causa encontraste (con medidas), qué cambiaste (file:line),
   tabla de comandos con EXIT real, nota para la familia en es/en/ca y línea de CHANGELOG. Claude integra en beta.

Si no lo reproduces ni en Android, escribe lo medido y lo descartado CON CIFRAS en «## Entrega» y para.

## Entrega

Rama `cursor/plan-seg-scroll`. Sin bump de versión. Sin push a `beta` ni a `main`.

### Causa medida

No hay `adb` ni emulador Android en este entorno. Medido en Chromium con viewport Pixel 5 (el mismo banco que ya había descartado el tirón a ojo). Toques por CDP, un gesto por distancia, listener en captura y en burbuja:

| dy desde el `touchstart` | `touchmove` que llegan al documento |
|---|---|
| 8, 10, 12, 14 y 15 px | 0 |
| 16 px | 1, `cancelable=true`, y en burbuja `defaultPrevented=true` |

El slop de este Chromium está entre 15 y 16 px. El primer evento que la página ve ya supera `GEST_LEAD` (12) y `useTironSeccion` llama a `preventDefault` en ese mismo evento. En un tirón continuo (10, 11, 20, 40, 80, 140 px) la barra se quedó en `top=70` px, el `scrollTop` de la página en 0 y el de `html`/`body` en 0; la capa del segmento sí bajaba (`translateY` 10 px a los 20 px de dedo, 42 px a los 140). No apareció ningún `touchmove` con `cancelable=false`.

Por eso no se toca el lead del tirón. En el móvil el primer `touchmove` llega a ~8 px (comentario de la ronda 9 en `mcBindEdgeHaptics`) y ahí `gestureAxis(0, 8)` sigue devolviendo null; ese hueco no se puede abrir aquí. Bajar el lead sin ver el estirón repetiría el `touch-action` del 5/8, que bloqueó bajar.

Hipótesis 2 (el flick siguiente cambia de sección): los toques CDP no generan inercia. No medido, no cambiado. Tirar abajo del todo hacia arriba sigue sin cambiar de sección (e2e ya existente, en verde).

Hipótesis 3, la que sí sale en este banco. Misma ruta que `deudas-ir-suave` (Recibos → cuota → Ver en Deudas), deuda **primera** (`d0`), Pixel 5, `safe-top` 0:

| | scrollTop | título `top` | botones `top` | tarjeta |
|---|---|---|---|---|
| antes | 41 | −15 px | +29 px | 262–462 |
| después | 0 | entero (≥ 20 px) | debajo del título | entera, por encima de la barra inferior |

Los botones no quedaban cortados 7 px: quedaban 29 px dentro. Lo que se salía era el título, 15 px. Centrar la tarjeta pedía esos 41 px aunque ya cabía con la cabecera quieta. En un móvil con barra de estado, esos 41 px se comen el padding de arriba y el recorte cae sobre la cabecera.

### Qué cambió

- `src/modules/14-v4-screens.js:217-222` — si el destino de centrar es > 0 pero la tarjeta entra entera entre el borde de arriba y la barra inferior con `scrollTop` 0, el destino pasa a 0. Una deuda que no cabe (la última del e2e, `d6`) sigue centrada y deslizando.
- `e2e/plan-seg-barra.spec.mjs` — cae sin el arreglo (`scroll 41 título -15 barra 29`). Registrado en `E2E_MAP` (`scripts/relevant-tests.mjs`, entrada de `14-v4-screens.js`).
- Bundle regenerado con `npm run build` (`public/index.html` y los hashes de `public/release-notes.json` y `public/beta-delivery.json`).

`prefers-reduced-motion` no cambia: el destino es el mismo y el `behavior` sigue en `auto` cuando el movimiento está reducido. Nada por frame.

### Comandos (EXIT real)

| Comando | EXIT |
|---|---|
| `npx playwright test e2e/plan-seg-barra.spec.mjs --workers=1 --retries=0` contra el bundle anterior | 1 (scroll 41, título −15, barra 29) |
| `npm run build` | 0 |
| `npm run test:syntax` | 0 |
| `node tests/relevant-tests.test.mjs` | 0 |
| `npx playwright test e2e/plan-swipe-segmento.spec.mjs e2e/plan-scroll-lento.spec.mjs e2e/deudas-ir-suave.spec.mjs e2e/swipe-pestanas.spec.mjs e2e/rebote-barra-inferior.spec.mjs e2e/botnav-esconder.spec.mjs e2e/botnav-indicador.spec.mjs e2e/plan-seg-barra.spec.mjs --workers=1 --retries=0` | 0 (52 passed) |

### Nota para la familia

- es: Al abrir la primera deuda desde Recibos, el título y los botones de Recibos, Deudas y Metas se quedan enteros.
- en: Opening the first debt from Bills keeps the title and the Bills, Debts and Goals buttons fully on screen.
- ca: En obrir el primer deute des de Rebuts, el títol i els botons de Rebuts, Deutes i Metes es queden sencers.

### Línea de CHANGELOG

Plan › ir a la primera deuda ya no sube el scroll si la tarjeta cabe con la cabecera a la vista. Antes el centrado dejaba el título 15 px fuera (Pixel 5, safe-top 0, scrollTop 41; los botones seguían a +29). El tirón de segmento no se modifica: en este Chromium el primer touchmove llega a 16 px, por encima de GEST_LEAD, cancelable y con preventDefault; el hueco de 8 px del móvil no se reproduce aquí.
