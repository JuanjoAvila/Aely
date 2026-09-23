<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (revisar-worktree-de-otro-agente.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: revisar-worktree-de-otro-agente
description: "Cómo pasar tests al trabajo de Codex/Cursor sin tocar su worktree: patch + worktree detached propio + junction de node_modules (y por qué mklink desde Bash no vale)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c6e7d0dd-367a-43e0-97ec-95448130655b
  modified: 2026-09-17T21:23:45.046Z
---

Para revisar lo que tiene otro agente **sin commitear** en su worktree (`.worktrees/codex-*`, `.worktrees/cursor-*`), nunca trabajar dentro del suyo: se le pisa el árbol y encima muchos de esos worktrees **no tienen `node_modules`**, así que `node node_modules/@playwright/test/cli.js` falla con `MODULE_NOT_FOUND`.

Receta que funcionó el 17/9 (cuatro revisiones seguidas, Plan + Inversiones):

1. `git diff HEAD > .claude/canal-equipo/_copia-<agente>-<hhmm>.patch` **desde su worktree**. Vale como copia de seguridad de su trabajo y como fuente para revisar (útil de verdad: esa noche su app se quedó con el chat en blanco).
2. `git worktree add --detach .worktrees/claude-rev-<sha>` sobre su base, y `git apply` del patch. Si ya ha commiteado, `git checkout --detach <su-HEAD>` y listo.
3. El `node_modules`: **crear el enlace con PowerShell** (`New-Item -ItemType Junction`). Un `mklink /J` lanzado desde el Bash de Git crea un enlace roto (`node_modules -> /e/E:/Mi cartera/node_modules`) y los e2e no arrancan.
4. `npm run build` y mirar `git status`: si el árbol queda limpio, el bundle que traen cuadra con `src/`. Así cacé que cuatro arreglos del candado de hojas vivían SOLO en `public/index.html` (48 líneas de diff) y el siguiente build se los llevaba (ver [[mi-cartera-deploy]]).
5. Batería acotada con `--workers=1`, y repetir lo sensible con `TZ=UTC` ([[ci-beta-corre-en-utc]], [[e2e-puerto-compartido]]).

**Why:** revisar de verdad es ejecutar, y su trabajo sin commitear es lo más frágil que hay ([[feedback-todo-lo-mio-revisado-por-cursor]], [[feedback-no-dar-por-hecho]]).
**How to apply:** patch primero (es la red), worktree propio después, junction por PowerShell, y borrar los worktrees de review al cerrar la jornada.

Extra del mismo día: para saber si un test **tiene dientes**, meterle el bug a mano en mi copia y ver qué línea falla. Así confirmé que el test del candado caza las dos regresiones (una por mitad) — y que una sospecha mía de que media prueba era vacua era falsa ([[test-verde-por-razon-equivocada]]).
