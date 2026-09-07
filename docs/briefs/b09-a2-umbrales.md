# B09-A2 — avisos de presupuesto al cambiar bancos

**Estado (2026-09-07):** fix en `11-app-main.js` (deps del `useEffect` de `_bn*`).
Guardián de fuente: `tests/budget-notis-deps.test.mjs`.

## E2E pendiente

No hay e2e del umbral todavía. Motivo real: con `page.clock.install` el splash/toast/
transiciones dejan el botnav o el botón «Editar» inaccesibles; sin clock el caso también
flaqueó en la sesión de B09-A2. Cuando haya e2e estable, se puede borrar el guardián de
fuente.
