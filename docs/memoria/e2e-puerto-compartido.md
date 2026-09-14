<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (e2e-puerto-compartido.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: e2e-puerto-compartido
description: "14/9 — dos npm test (o un e2e suelto) a la vez en la MISMA máquina chocan en 127.0.0.1:4237 aunque sean worktrees distintos: salen decenas de ERR_CONNECTION_REFUSED que no son del código"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ead8a2c8-7e3d-401c-b100-4145235a3f05
  modified: 2026-09-14T20:09:25.955Z
---

Los e2e de Playwright levantan el servidor de la app en **127.0.0.1:4237**. Dos suites a la vez en la misma máquina —aunque cada una esté en su worktree, o sea Cursor y yo— comparten ese puerto: una tumba o reutiliza el servidor de la otra. El 14/9 salieron 13, 49 y 164 e2e rojos, todos `net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4237/`, y la pasada limpia dio 265/265.

**Why:** un rojo así parece del código y hace perder una hora; peor, un verde puede venir de un servidor que sirve OTRO worktree (con `reuseExistingServer`), o sea código que no es el que se revisa.
**How to apply:** una sola suite con e2e a la vez en la máquina. Antes de lanzar, avisar por el buzón «corro suite en X» y esperar el «libre». Si todos los rojos son `ERR_CONNECTION_REFUSED`/`ECONNREFUSED` a 4237, repetir con la máquina libre antes de diagnosticar nada. Relacionado: [[ci-rojo-dos-veces-no-es-flaky]], [[arbol-compartido-y-barras-comidas]].
