# Fix: «Para revisar» de Inicio mostraba movimientos pospuestos

Causa: Inicio (03-tab-dash.js / 14-v4-screens.js) construía la lista «Para revisar» sin descartar los movimientos pospuestos hoy en Recibos, así que reaparecían al posponer, al abrir y tras «Deshacer».
Fix: el filtro de Inicio respeta lo pospuesto (mismo criterio que Recibos); «Deshacer» lo devuelve.

Test: e2e/inicio-revisar-pospuesto.spec.mjs (3 casos), añadido a E2E_MAP para 03-tab-dash y 14-v4-screens.

- ANTES (src sin fix, --retries=0): 2 failed, 1 passed.
  - posponer en Recibos lo quita también de «Para revisar» de Inicio, y «Deshacer» lo devuelve
  - lo pospuesto hoy no sale en «Para revisar» de Inicio al abrir
- DESPUÉS (con fix): 3 passed, 0 failed.
- npm run test:syntax: EXIT 0. tests/relevant-tests.test.mjs: EXIT 0.
- Entorno: Chromium local de Playwright, PC Windows.
- public/index.html y jsons generados no se versionan en este commit.
