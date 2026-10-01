# INC-2709-12 · Cyberpunk: la línea que atraviesa el botón +

**30/9/2026 · Claude, encargo del coordinador. Rama `tanda/inc-2709-12-cyber-fab` desde `main` 12884f48; 4.26.79 provisional; sin publicar.**

## Síntoma

Registrado el 27/9 en el backlog (UX-07): con el tema Cyberpunk, una línea cruza el botón + de la barra inferior.

## Causa

- **La línea:** Cyberpunk añade una «corriente» de neón en el filo superior de la barra: `html[data-theme="cyber"] .botnav::after`, de 1 px, en `top:-1px`, con `position:absolute`. Es el último elemento posicionado del contexto de `.botnav` (`z-index:40`).
- **El botón:** el + sobresale 26 px por encima de la barra (`.botnav-fab{margin-top:-26px}`). En Cyberpunk es `position:relative` sin `z-index`.
- **El choque:** los dos quedan con `z-index:auto`, así que se pintan en el orden del árbol, y el `::after` va después. La línea se dibujaba encima del botón.
- El `border-top` normal de la barra no le afecta, porque se pinta con el fondo, por debajo de los hijos.
- Las reglas de barra y tema son idénticas en `main` y `beta`, así que la tanda sale desde `main`.

## Corrección

`z-index:1` en `html[data-theme="cyber"] .botnav-fab`: la corriente pasa por detrás del botón y sigue recorriendo el resto del filo.

No cambia:
- colores, ni el verde y rojo del dinero;
- gestos, la barra, la animación ni «Reducir animaciones»;
- las temáticas que ya colorean el +.

## Pruebas

- **`e2e/cyber-fab.spec.mjs`** (Chromium, CROSSCUTTING):
  - Congela la línea visible (sin animación, entera y opaca) y compara la franja del + en la fila de la línea con la misma captura con la línea oculta. Tienen que ser idénticas.
  - Cubre las 4 pestañas a 320/393/430 px, letra enorme, zona segura inferior de 34 px y que el centro del + reciba el toque.
  - El ocultar/reaparecer de la barra es **sintético** (clase añadida y quitada a mano): comprueba la pila en los dos estados, no el scroll real ni la inercia. El cambio no toca la animación; los gestos siguen cubiertos por sus guardias de siempre.
  - **Rojo** (lease 5, 30/9 22:20:57 UTC), `shell.html` de main 12884f48: 4/4 caen por la comparación
    de píxeles (inicio ×3 y «tras esconderse y volver»).
  - **Verde** (22:21:08–22:21:50 UTC) sobre la candidata: 4/4, y 8/8 con `--repeat-each=2`.
  - Una primera pasada verde dio 2/4 por culpa del test: a 320 px el + asoma solo 6 px y el recorte
    fijo de 30 px cogía píxeles de fuera del círculo. El recorte sale ahora de la cuerda del círculo en
    la fila de la línea, y se espera a que la franja esté quieta antes de comparar.

## Límites

- Sin capturas reales del móvil del dueño: la reproducción es sintética.
- `apariencia-temas.spec.mjs` sigue cubriendo colores, persistencia y «Reducir animaciones»; no se ha tocado.
