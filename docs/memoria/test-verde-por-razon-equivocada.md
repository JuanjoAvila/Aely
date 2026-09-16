<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (test-verde-por-razon-equivocada.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: test-verde-por-razon-equivocada
description: "16/9 — un e2e llevaba días verde sin ejecutar lo que decía probar: el SW tiene release-notes.json precacheado, así que page.route no cortaba nada, y la clave sembrada no casaba con la versión «dev» de e2e"
metadata: 
  node_type: memory
  type: project
  originSessionId: 217fc8e8-08a5-4adf-9e68-eaf2d45e7a87
  modified: 2026-09-16T07:22:53.081Z
---

`inicio-offline` → «release-notes falla: panel beta usa la cabeza cacheada». Abortaba
`**/release-notes.json*` con `page.route` y sembraba `_rnHead_4.24.2`. Las dos mitades fallaban:
(a) el **service worker lo tiene precacheado**, así que `page.route` no intercepta y el JSON
cargaba igual; (b) en e2e `CONFIG.APP_VERSION` es **«dev»**, así que la clave sembrada no casaba
con `_rnHead_dev`. Lo que lo ponía verde era el texto de la tanda REAL en el JSON del repo.
Se destapó al colapsar la ronda 4.24 en una nota única para el promote: desapareció el texto y
saltó el rojo.

Arreglo (`e82e43c2`): `test.use({serviceWorkers:"block"})` solo en ese caso, la clave se deriva
en caliente de `mcVerBase(CONFIG.APP_VERSION)` tras una primera carga, el texto sembrado no
existe en el repo, y se comprueba que `RELEASE_NOTES` quedó en UNA entrada (prueba de que el JSON
no cargó).

**Why:** un verde que no ha ejecutado nada es peor que un rojo, y aquí lo tapó durante días.
**How to apply:** si un test simula «la red falla» y hay SW por delante, `page.route` MIENTE:
bloquear el SW o el test no prueba nada. Y nunca clavar en un test una versión ni una clave que
lleve versión: derivarla de lo que dice la app en caliente. Relacionado:
[[feedback-no-dar-por-hecho]], [[ci-rojo-dos-veces-no-es-flaky]], [[panel-beta-reabre-ajustes]].
