<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (splash-nativo-saga.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: splash-nativo-saga
description: Investigación del splash nativo de Android (icono grande del sistema vs tarjeta pequeña del splash web) — aparcada 2026-08-03 en la rama wip/splash-icono-nativo, con un misterio sin cerrar (robot verde de Android al tocar el icono de verdad).
metadata:
  type: project
  originSessionId: bad73289-cf58-4000-9334-a806937634d5
  modified: 2026-08-03T06:40:35.787Z
---

**ESTADO: APARCADO 2026-08-03, a petición suya** («vamos a dejarlo aquí... necesitamos tu atención en el core»). Todo el código vive en la rama `wip/splash-icono-nativo` (commit `ab5f156`, subida a origin como copia de seguridad, NO es un PR ni toca `beta`). `beta` se dejó limpia, exactamente como estaba antes de esta sesión. Ver [[mi-cartera-roadmap]] para el contexto general — este fichero es solo la saga del splash, que se estaba comiendo la sesión entera y merece su propio hilo.

**EL PROBLEMA DE FONDO**: desde Android 12+, el sistema OBLIGA a enseñar el icono del launcher un instante en cada arranque en frío, de TODAS las apps, sin forma de desactivarlo. Ese icono real (`ic_launcher.png`) YA ES nuestra marca (tarjeta+cartera menta), pero Android lo enseña GRANDE y PELADO (solo la capa "foreground", sin el fondo de tarjeta) mientras que el splash web (`#mc-load .mcl-mark`) es una tarjeta pequeña con brillo. Su queja original: «que SOLO salga el de Mi Cartera, no el icono gordo del principio» — un salto de tamaño+forma entre las dos apariciones que se leía como "pantallas distintas".

**SIETE intentos de personalizar el icono del splash del sistema, TODOS ignorados por Android**: `windowSplashScreenAnimatedIcon` con un `<vector>` suelto, con `<adaptive-icon>`, con `<animated-vector>` envolviendo el mismo dibujo (confirmado con `aapt2` que el APK apuntaba bien cada vez) — Android siempre volvió a enseñar el icono real del launcher. Y `windowSplashScreenIconBackgroundColor` (para darle fondo de tarjeta al icono pelado) TAMPOCO lo respeta. Conclusión: ese icono no se puede redecorar por tema en este dispositivo/versión — hay que trabajar CON el tamaño/forma que Android decide, no contra él.

**LA SOLUCIÓN QUE SÍ FUNCIONÓ (parcialmente) — encoger el icono en directo**: en vez de sustituir el icono, `MainActivity.shrinkSplashIcon()` MIDE de verdad el que ha pintado Android (`SplashScreenViewProvider.getIconView()`, tamaño y sitio reales para ESTE móvil) y lo anima hasta el tamaño/sitio de la tarjeta web (94dp, calculado a mano igual que `.mcl-mark`). Tres rondas de pulido, cada una con un fallo real cazado en vídeo:
1. **Primera versión**: animaba `LayoutParams` (ancho/alto/márgenes) cada frame → obligaba a un `layout` completo en cada fotograma, justo cuando Capacitor monta la WebView en el mismo hilo → 3 fps en un móvil a 120Hz («da igual que se haga más pequeña si no es fluido»). Arreglado pasando a `scaleX/scaleY`+`translationX/Y` (transform puro, sin tocar layout — lo pinta el compositor).
2. **La tarjeta aparecía de golpe**: el clon arrancaba YA con el fondo de tarjeta puesto al 100%, pero el icono real de Android no lleva tarjeta (ver arriba, atributo ignorado) — un cambio de forma a bocajarro justo al empezar («las formas no son la misma forma, choca visualmente»). Arreglado: el clon arranca IDÉNTICO a lo que ya se veía (sin tarjeta, sin relleno) y la tarjeta se desvanece hacia DENTRO (alpha 0→255) a la vez que encoge — nada aparece de golpe.
3. **El radio de las esquinas mal escalado tras pasar a transform**: el `GradientDrawable.setCornerRadius()` se dibuja en el lienzo SIN escalar (tamaño real grande) y LUEGO se escala todo por `scale` — hay que dividir el radio objetivo por la escala actual para que el radio VISIBLE crezca como se espera.

**FOGONAZO NEGRO real, arreglado (no relacionado con el icono)**: `AppTheme.NoActionBar` tenía `android:background`@null — atributo que Android 12+ NO usa para pintar el fondo de ventana (el correcto es `android:windowBackground`) — y ADEMÁS `MainActivity` nunca cambia de tema en ningún punto del código, así que ese tema NUNCA se llega a aplicar: el que aplica SIEMPRE, splash y después, es `AppTheme.NoActionBarLaunch`. El primer parche (en `NoActionBar`) no hizo nada por eso. El de verdad va en `NoActionBarLaunch`. Además `capacitor.config.json` no tenía `backgroundColor`: la WebView pintaba negro puro hasta pintar su primer frame — añadido `"backgroundColor": "#0A1310"` (mismo verde que el tema).

**MISTERIO SIN CERRAR — el robot verde de Android (bugdroid) por defecto sale a veces, tapando nuestro icono.** Cazado en vídeo real (móvil OnePlus CPH2653, Android 16, ColorOS) DESPUÉS de todos los arreglos de arriba. Pistas reunidas antes de aparcar:
- **Solo sale con el TOQUE REAL del icono desde el escritorio.** Lanzar con `adb shell monkey -p com.micartera.app.debug -c android.intent.category.LAUNCHER 1` (o `am start`) NUNCA lo reproduce — confirmado por él en vivo («cuando tú lo ejecutas no sale»). Esto invalida cualquier intento de depurarlo por adb sin su móvil.
- El log capturado con `adb logcat` durante un toque real (guardado como `.gradle-local/tap-log.txt` de esa sesión, NO commiteado — gitignored ahora) apunta a `OplusTransitionAnimationManager` / **"spring slide anim"**: la animación de APERTURA propia de ColorOS al tocar un icono desde el launcher, que corre ANTES de que nuestro `onCreate`/`shrinkSplashIcon` empiece siquiera. `StartingSurfacePreviewController` confirma `enableSurfacePreview=false` para nuestra app (esa vía OEM está desactivada), así que el robot no viene de ahí.
- **Hipótesis sin confirmar**: caché de icono de esa transición de ColorOS desincronizada por reinstalar la APK debug ~10 veces en la misma sesión (`adb install -r` en bucle). No se llegó a probar con una instalación LIMPIA (una sola vez, sin reinstalar encima).
- Diagnóstico en el código: `MainActivity.shrinkSplashIcon()` tiene un `Log.i("MC_SPLASH", ...)` al principio (icono real que ve Android) y otro en `onAnimationEnd`. Un log real capturado mostró `drawable=BitmapDrawable` normal en ese punto — nada roto ahí, así que el robot no lo pinta nuestro código, es anterior/ajeno a él.

**PARA RETOMAR, en este orden:**
1. `git checkout wip/splash-icono-nativo` (o cherry-pick sobre `beta` si ya se ha movido).
2. Compilar APK debug (receta en [[mi-cartera-android-build]]) e instalar **UNA sola vez** — no reinstalar en bucle esta vez, para descartar la hipótesis de caché.
3. Pedirle que la abra tocando el icono real varias veces seguidas (no `adb monkey`).
4. Si el robot NO sale → era la caché de reinstalar sin parar; dar el splash por bueno.
5. Si sale igual → tirar del hilo `OplusTransitionAnimationManager` a fondo (puede ser específico de este teléfono/ColorOS — sería bueno saber si su pareja, con otro Android, lo ve también).
6. Herramientas ya probadas esta sesión: `adb exec-out screencap -p` SÍ funciona para capturas sueltas (a ~2 fps, demasiado lento para cazar un glitch de 1-2 fotogramas en una animación de 420ms); `adb shell screenrecord` está BLOQUEADO en este ROM (permission denied, tanto a `/sdcard` como en streaming `exec-out`) — no perder tiempo reintentándolo, pedirle un vídeo con el grabador nativo del móvil es la única vía fiable para depurar timing fino.
