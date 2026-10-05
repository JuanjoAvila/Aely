> Vigencia: esta memoria conserva hechos históricos. Para trabajo actual prevalecen AGENTS.md y docs/COORDINACION-AGENTES.md de codex/coordinacion. Claude local está cerrado: no reactivar vigías, buzón ni relevos locales. La rutina Cloud solo ejecuta encargos con reserva propia confirmada.

<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (revisar-worktree-de-otro-agente.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: revisar-worktree-de-otro-agente
description: "⚠ AL BORRAR: rmdir de la junction node_modules ANTES de git worktree remove (me volvió a pasar 1/10). Cómo pasar tests al trabajo de otro agente: patch + worktree detached + junction."
metadata: 
  node_type: memory
  type: feedback
  modified: 2026-09-27T13:53:36.041Z
---

Para revisar lo que tiene otro agente **sin commitear** en su worktree (`.worktrees/codex-*`, `.worktrees/cursor-*`), nunca trabajar dentro del suyo: se le pisa el árbol y encima muchos de esos worktrees **no tienen `node_modules`**, así que `node node_modules/@playwright/test/cli.js` falla con `MODULE_NOT_FOUND`.

Receta que funcionó el 17/9 (cuatro revisiones seguidas, Plan + Inversiones):

1. `git diff HEAD > .claude/canal-equipo/_copia-<agente>-<hhmm>.patch` **desde su worktree**. Vale como copia de seguridad de su trabajo y como fuente para revisar (útil de verdad: esa noche su app se quedó con el chat en blanco).
2. `git worktree add --detach .worktrees/claude-rev-<sha>` sobre su base, y `git apply` del patch. Si ya ha commiteado, `git checkout --detach <su-HEAD>` y listo.
3. El `node_modules`: **crear el enlace con PowerShell** (`New-Item -ItemType Junction`). Un `mklink /J` lanzado desde el Bash de Git crea un enlace roto (`node_modules -> /e/[ruta local omitida]`) y los e2e no arrancan.
4. `npm run build` y mirar `git status`: si el árbol queda limpio, el bundle que traen cuadra con `src/`. Así cacé que cuatro arreglos del candado de hojas vivían SOLO en `public/index.html` (48 líneas de diff) y el siguiente build se los llevaba (ver [[mi-cartera-deploy]]).
5. Batería acotada con `--workers=1`, y repetir lo sensible con `TZ=UTC` ([[ci-beta-corre-en-utc]], [[e2e-puerto-compartido]]).

**Why:** revisar de verdad es ejecutar, y su trabajo sin commitear es lo más frágil que hay ([[feedback-todo-lo-mio-revisado-por-cursor]], [[feedback-no-dar-por-hecho]]).
**How to apply:** patch primero (es la red), worktree propio después, junction por PowerShell, y borrar los worktrees de review al cerrar la jornada.

⚠ **27/9: al BORRAR, quitar primero la junction.** `git worktree remove --force` con la junction de `node_modules` dentro la ATRAVIESA (falló con «Filename too long» a medias). **Repetido el 1/10** con el rojo del perfil pese a estar aquí apuntado: sin daño (12.196 ficheros iguales), pero la orden va ANTES, no después. Orden: `[System.IO.Directory]::Delete(<wt>\node_modules)` por PowerShell (borra solo el enlace), luego `git worktree remove`/`prune`, y comprobar `npm ls` en la raíz. Y los guardianes que usan `load-pure-logic` leen `public/index.html`: para verlos en rojo con el código base hay que `node scripts/build-app.mjs` tras cambiar `src/`.

Extra del mismo día: para saber si un test **tiene dientes**, meterle el bug a mano en mi copia y ver qué línea falla. Así confirmé que el test del candado caza las dos regresiones (una por mitad) — y que una sospecha mía de que media prueba era vacua era falsa ([[test-verde-por-razon-equivocada]]).
