<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (initial-session-carrera-freshlogin.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: initial-session-carrera-freshlogin
description: "MEDIDO 28/9: en cada arranque en frío INITIAL_SESSION llega antes que getSession → onAuth ve prev=null y lanza syncFromCloud con freshLogin=true (la nube pisa lo local más nuevo)."
metadata:
  node_type: memory
  type: project
  originSessionId: 568e2360-a658-48ef-8b7b-0813ad1f1a86
  modified: 2026-09-28T10:52:11.493Z
---

28/9/2026, revisando INC-2709-05 de Codex (commit 2f202ce3, que vaciaba `bankTx` con `freshLogin`).

`11-app-main.js` (~884-897): el efecto llama a `cloud.session()` (getSession) y, en el mismo tick, a `cloud.onAuth`. `sessionRef.current` lo fija el `.then` de getSession. Medido con el `public/vendor/supabase.min.js` en Chromium (Playwright, sesión válida en localStorage, sin red): **INITIAL_SESSION llega SIEMPRE antes** que getSession, 50 de 50, también con el cliente creado 1,5 s antes. Por tanto `changed=(!prev&&s)` es true y **cada arranque en frío con sesión es un «login»**: `syncFromCloud(s,{freshLogin:true})` → `localNewer=false` → la nube pisa el estado local aunque este sea más nuevo. Esto es PREEXISTENTE, no lo introdujo INC-2709-05.

Y filtrar `INITIAL_SESSION` NO basta (medido el mismo día con /auth/v1/token mockeado): con el token CADUCADO en localStorage —lo normal al abrir la app matada tras más de 1 h— llega `TOKEN_REFRESHED>INITIAL_SESSION>getSession`, y `TOKEN_REFRESHED` también ve `prev=null`.

**Why:** cualquier cosa atada a `freshLogin` (borrar `bankTx`, onboarding, precedencia nube/local) se dispara en cada reinicio. Es candidata a explicar cambios locales perdidos y [[movil-viejo-repite-movimientos]].
**How to apply:** no fiarse de `freshLogin` ni de `changed` para «solo al iniciar sesión»; comprobar `prev && prev.user.id!==s.user.id` o filtrar `ev==='INITIAL_SESSION'`. Arreglar la precedencia es tanda propia con su OK. Receta de la medida: cargar el vendor con `addScriptTag` en una página enrutada, `createClient`, y registrar el orden de eventos.
