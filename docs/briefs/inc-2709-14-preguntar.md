# INC-2709-14 · Pregúntame: el botón Preguntar, lejos del borde

**1/10/2026 · Claude, encargo del coordinador. Rama `tanda/inc-2709-14-preguntar` desde `main` 12884f48; 4.26.80 provisional; sin publicar.**

## Síntoma

Registrado el 27/9 en el backlog (PRO-09/UX-06): en Pregúntame el botón Preguntar queda demasiado separado del borde inferior.

## Causa

- **La regla que gana:** la hoja de ayuda es `.v4-sheet.aely-help-sheet` y su cuerpo, `.aely-help-body.v4-sheet-body`. Por eso le aplica `.v4-sheet:has(>.v4-sheet-body){padding-bottom:calc(52px + var(--safe-bottom))}` (especificidad 0,2,0), pensada para las hojas con botón fijo abajo.
- **La anulación que pierde:** la hoja de ayuda intentaba anularla con `.aely-help-sheet{padding-bottom:0}`, que es 0,1,0 y pierde.
- **Sin teclado:** el compositor ya reserva abajo `10px + zona segura`, así que quedaban 52 px más y la zona segura contada dos veces.
- **Con teclado:** el componente pone `marginBottom:kbPad` para apoyar la hoja encima del teclado, así que esos 52 px + zona segura quedaban de hueco encima del teclado.

## Corrección

Solo toca la hoja de ayuda:

- `.v4-sheet.aely-help-sheet{padding-bottom:0}`, que ahora gana por especificidad.
- El compositor usa `var(--safe-bottom)`, como el resto de la app, en vez de `env()` suelto.
- Con `data-help-kb="1"` (lo pone el componente cuando detecta el teclado), el compositor deja 10 px sin zona segura: el teclado ya la tapa.

## Prueba

`e2e/help-preguntar-borde.spec.mjs`:

- **Sin teclado:** la hoja no tiene padding inferior y el hueco entre Preguntar y el borde de la hoja es exactamente el padding del compositor (10 px + zona segura). Cubre es/en/ca × letra normal y enorme × zona segura 0 y 34 px.
- **Con teclado:** se simula con un `visualViewport` 300 px más bajo, que es la vía que lee el componente, así que `kbPad`, `marginBottom` y `data-help-kb` los pone el propio componente. La hoja se apoya en el teclado, el hueco es de 10 px y la hoja no se sale por arriba. Cubre es/en/ca.
- No envía preguntas ni toca el asistente remoto.
- **Rojo** (lease 7, 30/9 22:32:03–22:32:37 UTC), `shell.html` de main 12884f48: 15/15 caen. La hoja
  trae 52 px de padding inferior (86 con zona segura de 34; 65,6/108,5 con letra enorme).
- **Verde** (22:32:46–22:33:14 UTC) sobre 7122afe2: 15/15.

## Límites

El teclado real de Android (su animación y el `adjustResize` del WebView) no se reproduce aquí; se comprueba en el móvil con el guion de la tanda.
