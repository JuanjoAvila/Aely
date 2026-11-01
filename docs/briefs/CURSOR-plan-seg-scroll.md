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
