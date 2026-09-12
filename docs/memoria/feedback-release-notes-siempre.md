<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (feedback-release-notes-siempre.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: feedback-release-notes-siempre
description: Toda versión publicada de Mi Cartera (incluidas las .1) debe llevar su entrada en RELEASE_NOTES del popup de Novedades
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7cd912e9-330c-4d11-985f-b15f3f7cc841
  modified: 2026-07-25T23:52:36.027Z
---

Al publicar CUALQUIER versión de Mi Cartera (incluidos los parches `.1`, `.2`…), añadir su entrada AL PRINCIPIO del array `RELEASE_NOTES` (en `public/index.html`, cerca del componente `WhatsNew`), en castellano y sin jerga.

**Why:** el 2026-07-12 se publicó la 3.95.1 (fix del «−» en «Lo que te queda») SIN entrada en el popup; el usuario lo notó y pidió expresamente que no vuelva a pasar («apunta de siempre agregar lo que se actualiza»). El histórico de Novedades es su forma (y la de su pareja/familia) de saber qué cambió en cada actualización.

## ⚠ TONO (feedback 2026-07-26): genéricas, en cristiano, NO dirigidas a él
Las notas las lee **toda la familia**, no el que las escribió. Prohibido: hablarle a él de tú («lo que rechazaste», «tu móvil», «como pediste»), referencias a la ronda de pruebas o al canal beta, números de versión internos, y jerga (identificadores, manifiestos, listeners, umbrales, px). Escribir **qué nota el usuario y qué puede hacer ahora**, en tercera persona o impersonal, como lo contaría la nota de una app cualquiera.
- ✗ «Cerrar el perfil: corregido lo que rechazaste… el umbral pasó de 52 a 94 px.»
- ✓ «Cerrar el perfil vuelve a ir a la primera, también si habías bajado dentro.»
- ✗ «El aviso llevaba un identificador sacado del reloj, así que se apilaba.»
- ✓ «Se acabaron los avisos de actualización repetidos.»
⚠ Las entradas de la **4.11.0 publicadas el 2026-07-26 son el ejemplo de lo que NO hay que hacer** (están vivas en producción): reescribirlas es la primera tarea pendiente. El detalle técnico va al `CHANGELOG.md`, que es donde toca.

**How to apply:** en la misma tanda en que se toca `VERSION` + `CHANGELOG.md`, tocar también `RELEASE_NOTES`. El popup auto-muestra solo la última versión estrenada; el histórico (Ajustes → «✨ Novedades y sugerencias») muestra TODAS, así que hasta un fix pequeño merece su línea. Ver [[mi-cartera-roadmap]] y [[mi-cartera-deploy]].
