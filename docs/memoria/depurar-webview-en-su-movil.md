<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (depurar-webview-en-su-movil.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: depurar-webview-en-su-movil
description: Cómo inspeccionar la WebView de SU móvil por adb+CDP (y las dos medidas que mienten) — lo que cerró el lag al deslizar el 2026-07-27
metadata: 
  node_type: memory
  type: project
  originSessionId: 2311f94a-c4c3-4cc0-8fab-82f1e1b21383
  modified: 2026-07-27T18:13:50.165Z
---

**Se puede depurar su móvil de verdad, con sus datos y su dedo.** Es lo que cerró la saga del lag
(ver `docs/LAG-DESLIZAR.md` §0 y [[lag-gesto-cuatro-causas]]).

Receta, con las dos trampas que cuestan una hora si no las sabes:

1. `MICARTERA_WEBDEBUG=1` en `android/local.properties` (no va al repo) → `assembleRelease` →
   `adb install -r`. Misma firma que la suya, **no pierde datos ni el bundle OTA**.
   ⚠ **Antes de CUALQUIER release pública** (2026-08-06): vuelve a `MICARTERA_WEBDEBUG=0`
   (o borra la clave) y confirma `BuildConfig.WEB_DEBUG = false`. Si dejas el 1, la APK firmada
   que subes a GitHub Releases abre el socket de depuración en el móvil real. Incidente: APK 36
   de la 4.16.0. Canónica limpia: **39 / 4.16.1** (+ `postSplashScreenTheme` en el splash).
2. `WebView.setWebContentsDebuggingEnabled(true)` va **DESPUÉS de `super.onCreate()`**: Capacitor lo
   apaga al montar el puente (`Bridge.java:599`) y si va antes, el socket no aparece nunca.
3. `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>` → `http://localhost:9222/json/list`
   → WebSocket con el `webSocketDebuggerUrl` (Node 24 trae `WebSocket` nativo, sin dependencias).
4. Gestos REALES con `adb shell input swipe`; los de CDP (`Input.dispatchTouchEvent`) valen para
   forzar casos raros a mano, como un `touchCancel`.

⚠ **`dumpsys gfxinfo` MIENTE en una app WebView**: daba 112 fps y un solo frame malo en 33 s con la
pantalla congelada. Una WebView pinta siempre su ÚLTIMO fotograma disponible y Android lo cuenta
como frame bueno. Lo único que vale para el ojo del usuario son los **deltas de `rAF` dentro de la
página** (+ `PerformanceObserver` de `longtask` y de `event` para el retraso de la entrada).

⚠ **Grabar una traza de Chromium PROVOCA el tirón que buscas**: con `Tracing` puesto salían frames
de 90 ms donde con el medidor ligero no salía ninguno, y 9 s de traza son 100 MB (y `JSON.stringify`
revienta pasados ~512 MB: hay que escribir por trozos). Medir primero con `rAF`; la traza, solo para
mirar una ventana concreta y sabiendo que suma ruido.

Y la lección de fondo, que vale para cualquier gesto: **antes de optimizar, comprueba que lo que
mides distingue su caso bueno del malo**. Aquí el fallo ni siquiera era de rendimiento.

## ⚠ La APK `.debug` sirve para MEDIR causas, NO para VERIFICAR arreglos (10/9/2026)

Su bundle web va por su cuenta y se queda atrás: el 10/9 el nativo era el mismo que el suyo
(42 / 4.18.3) pero la web era **4.19.19** cuando su beta iba por **4.19.31**. Ocho versiones.

El precio de no saberlo: se midió el tironcillo ahí, salió que seguía, y estuvo a punto de darse
por hecho que el arreglo no servía — cuando lo que pasaba es que **ese build no lo llevaba**.
Y al revés: sus medidas de causa (los 44 px de `layout-shift`, el frame sí y frame no del
arrastre lento) sí valían, porque el fallo estaba en las dos.

Regla: **causa se mide en la `.debug`; arreglo se verifica en la beta real y con su dedo.**
Y antes de cualquier medida, preguntar por CDP qué versión web corre:
`typeof CONFIG!=="undefined" ? CONFIG.APP_VERSION : "sin CONFIG"`.

Otro detalle que costó un rato: la app carga desde `https://localhost/`, así que **no acepta un
bundle local servido por `http`** (`adb reverse` + `Page.navigate` a `localhost:4173` no carga).
Por eso no se puede hacer el A/B en caliente del arreglo; el A/B de CSS sí, inyectando un
`<style>` con `Runtime.evaluate`.
