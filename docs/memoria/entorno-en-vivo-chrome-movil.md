<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (entorno-en-vivo-chrome-movil.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: entorno-en-vivo-chrome-movil
description: "Probar cambios en su móvil en SEGUNDOS en vez de 11 min de CI: servir public/ por adb reverse y abrirlo en Chrome del móvil, con CDP de vuelta. Es lo que cerró la saga del destello."
metadata: 
  node_type: memory
  type: reference
  originSessionId: ef87afa7-da33-4635-8590-8feff7bfdeb5
  modified: 2026-08-18T21:29:12.027Z
---

Montado el 2026-08-18, y es lo que permitió cerrar [[season-destello-saga]] tras nueve intentos.
Antes, cada hipótesis costaba **commit → CI 11 min → él actualiza → graba vídeo → analizar**. Con
esto: se cambia el CSS y lo ve al instante. Él lo pidió así: *«testéamelo sin tener que ir subiendo
rondas y así lo testeamos en directo»*.

```bash
npx serve public -l 4173                                     # o preview_start "micartera"
adb reverse tcp:4173 tcp:4173                                # el móvil ve el portátil
adb forward tcp:9222 localabstract:chrome_devtools_remote    # el portátil ve el Chrome del móvil
# en el móvil: Chrome → localhost:4173   ·   CDP en http://127.0.0.1:9222/json/list
```

Con CDP se puede: inyectar CSS de prueba sin tocar el repo, leer estilos computados
(`CSS.getMatchedStylesForNode` dice **qué regla gana**), disparar gestos
(`Input.dispatchTouchEvent`) y listar listeners (`DOMDebugger.getEventListeners`).

⚠ **Trampas, todas pisadas ya:**
- **El Service Worker sirve la copia vieja.** Una recarga normal NO trae el cambio y parece que el
  arreglo no funciona. Desregistrar el SW + `caches.delete()` antes de dar nada por bueno. Casi me
  hace revertir un arreglo que sí funcionaba.
- **La app de release no tiene CDP** (`MICARTERA_WEBDEBUG` apagado a propósito). Por eso se prueba
  en **Chrome**; el veredicto final es **siempre en la APK** — comparten motor, no son idénticos.
- **En Chrome entra sin sus datos** → arranca el onboarding. Eso es una ventaja: reproduce al
  **usuario nuevo**, que él no puede reproducir sin borrar lo suyo. Así salió el bug de los gestos
  muertos al estrenar la app.
- **CDP `Page.screencast` NO capta artefactos de compositor** (midió −2,8 contra −16 reales):
  fotografía lo que la página dibuja, no lo que el compositor pinta. Para MEDIR, grabador nativo a
  120 fps + `ffmpeg`; para ITERAR hipótesis, basta su ojo.

**Método de medida que sí funciona** (ver [[season-destello-saga]]): `ffmpeg -vf "crop=…,scale=1:1"`
reduce cada fotograma a un píxel promedio por región → una señal por frame; luego se buscan picos
que se salgan de la **mediana local**. Detecta efectos de 8 ms que ninguna captura estática ve.
