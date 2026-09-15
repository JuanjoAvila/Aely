<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (e2e-puerto-compartido.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: e2e-puerto-compartido
description: "Una sola suite con navegador a la vez EN LA MÁQUINA: el puerto e2e sale del cwd (4173+hash%300) pero dos a la vez dan rojos de infra (ERR_CONNECTION_REFUSED 14/9, ERR_NO_BUFFER_SPACE 15/9)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: ead8a2c8-7e3d-401c-b100-4145235a3f05
  modified: 2026-09-15T18:10:43.653Z
---

Desde el 10/9 `playwright.config.mjs` da **un puerto por checkout**: `4173 + sha1(cwd) % 300` (`MC_E2E_PORT` lo fuerza). El 4237 del 14/9 era el de UN worktree, no de todos. Aun así, dos suites a la vez rompen: el 14/9 salieron 13, 49 y 164 e2e rojos (`ERR_CONNECTION_REFUSED` a 4237, mismo checkout o choque de hash) y el 15/9 `import-hoja` dio `ERR_NO_BUFFER_SPACE` mientras Codex y yo corríamos cosas a la vez. Un e2e dirigido en puerto propio (`node <raíz>/node_modules/@playwright/test/cli.js test e2e/X.spec.mjs --config=playwright.config.mjs`) molesta poco; dos `npm test` enteros, sí.

**Why:** un rojo de infra parece del código y hace perder una hora; y con `reuseExistingServer` un verde puede venir del servidor de OTRO checkout.
**How to apply:** una sola `npm test` a la vez en la máquina; avisar por el buzón «corro suite en X» y esperar «libre». Dirigidos en puerto propio: avisar igual. Si los rojos son `ERR_CONNECTION_REFUSED`/`ERR_NO_BUFFER_SPACE`, repetir con la máquina libre antes de diagnosticar. Relacionado: [[ci-rojo-dos-veces-no-es-flaky]], [[arbol-compartido-y-barras-comidas]].
