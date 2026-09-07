<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (su-movil-es-un-oneplus-13.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: su-movil-es-un-oneplus-13
description: "⚠ Su móvil NUNCA fue un Oppo: es un OnePlus 13 (CPH2653), Android 16, WebView Chromium 150. El repo lo dice mal en ~35 sitios y se razonaron hipótesis contra el sistema equivocado."
metadata: 
  node_type: memory
  type: project
  originSessionId: ef87afa7-da33-4635-8590-8feff7bfdeb5
  modified: 2026-08-18T20:24:27.103Z
---

**Su móvil es un OnePlus 13 · `CPH2653` · Android 16 · OxygenOS V16.1.0 · WebView Chromium 150.**
Comprobado el 2026-08-18 con `adb shell getprop`. **Siempre fue ese**, no se cambió de móvil.

El repo lo llama «Oppo» / «ColorOS» en ~35 sitios, incluidos comentarios de `src/shell.html`,
`11-app-main.js`, `02-ui-shared.js`, tests y e2e. Todo falso. Se dio por hecho —probablemente
porque `OplusTransitionAnimationManager` es común a OPPO/OnePlus/realme— y **nadie lo comprobó
nunca en meses de trabajo**, cuando comprobarlo era un comando.

**Por qué importa:** en la saga del destello ([[season-destello-saga]]) se descartaron hipótesis
«con evidencia» razonando sobre compositing de ColorOS. Y él lo sabía y no dijo nada porque le
hacía gracia — o sea que **no lo va a corregir él**: hay que verificarlo uno.

**Why:** es el caso de manual de [[feedback-no-dar-por-hecho]], y el más caro: no fue un dato que
se dedujo mal una vez, fue un dato que se propagó a 35 sitios y a las conclusiones técnicas.

**How to apply:** antes de razonar sobre comportamiento nativo (compositor, WebView, overscroll,
splash, widget), **leer el dispositivo**, no el repo:
`adb shell getprop ro.product.brand; adb shell getprop ro.build.version.release`.
Y al tocar un fichero que diga «Oppo», corregirlo de paso.

Otros datos duros del aparato, medidos el 18/8:
- `adb shell screenrecord` está **bloqueado** en su Android 16 (Permission denied en `/sdcard` y
  `/data/local/tmp`; a stdout se cuelga) → usar el **grabador nativo** y sacar el fichero de
  `/sdcard/Movies`.
- Pantalla a **120 Hz** → los efectos de 1 frame duran 8 ms y `screencap` (≈2 fps) no los ve nunca.
- ⚠ **`adb pull /sdcard/` se trae DCIM, Documents y Recordings enteros.** Acotar SIEMPRE a la
  carpeta propia. Pasó el 18/8 y hubo que borrar 127 MB de sus fotos del portátil.
- Depuración inalámbrica: se descubre con `adb mdns services` (el puerto cambia cada vez).
  Recordarle **apagarla fuera de casa**: la anuncia a toda la red en la que esté.
