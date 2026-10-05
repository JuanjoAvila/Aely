> Vigencia: esta memoria conserva hechos históricos. Para trabajo actual prevalecen AGENTS.md y docs/COORDINACION-AGENTES.md de codex/coordinacion. Claude local está cerrado: no reactivar vigías, buzón ni relevos locales. La rutina Cloud solo ejecuta encargos con reserva propia confirmada.

<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (claude-a-la-nube-canal-rama.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: claude-a-la-nube-canal-rama
description: Desde el 5/10/2026 Claude de Aely trabaja en la NUBE por rutina cada 2 h y el canal es la rama codex/coordinacion; un chat local NO arma vigía ni atiende el buzón del PC
metadata:
  node_type: memory
  type: project
  modified: 2026-10-05T15:08:02.128Z
---

**Estado desde el 5/10/2026 15:08Z: Claude local está CERRADO por migración.** Lo pidió el dueño (quiere continuar el circuito en la nube) y lo confirmó Codex (`20261005T150452Z-codex-cierre-claude-local`).

- **Dónde trabaja Claude:** rutina «Aely · turno de Claude (nube)» en la cuenta personal, cron `52 */2 * * *`, entorno `aely-cloud`. La creó Codex desde la web. Cada disparo es una sesión nueva sin memoria.
- **Canal:** rama `codex/coordinacion` de `JuanjoAvila/Aely`. Encargos en `coordination/tasks/<id>/task.json`, reclamación y resultado con `scripts/coordination-channel.mjs` (push fast-forward, sin force). Protocolo: `docs/COORDINACION-AGENTES.md` de ESA rama. El issue 130 queda solo para Grok/Cursor.
- **Buzón local `.claude/canal-equipo`:** ya no lo lee nadie de Claude y Codex no escribe encargos ahí.

**Why:** el relevo local dependía del PC encendido, de la cuenta de la app y de diálogos de permiso (uno dejó el relevo parado 6,5 h la madrugada del 5/10).

**How to apply:**
- Un chat local de Claude en este proyecto **no** ejecuta `R estado`, **no** arma vigía y **no** crea tareas `aely-relevo-*` (siguen `enabled:false`, sin borrar). Esto sustituye a [[feedback-autonomo-sin-pedir-permiso]] y [[relevo-automatico-cada-4h]] en ese punto.
- Un chat local sirve para lo que solo se puede en el PC, cuando el dueño lo abre para ese encargo: adb/móvil real, APK, Chromium con lease local.
- Para ver qué hace Claude en la nube desde un chat local: `RemoteTrigger list_runs` de la rutina, y `git fetch origin codex/coordinacion` + `git log`. No reclamar tareas del canal desde el PC.
- Límites conocidos de la nube: VM en UTC; el e2e necesita `PLAYWRIGHT_CHROMIUM_PATH` apuntando al Chromium de la VM; sin secretos (nada de Edge, SQL, deploy); cada disparo gasta del límite del plan aunque no haya trabajo.
- Al cerrar, la migración general era PARCIAL según Codex: el disparo programado de Codex ya fue acreditado; siguen pendientes la lectura automática de app_events y la creación de chats Cloud independientes y no se había probado con el PC apagado. Comprobar el estado en la rama antes de darlo por completo.
- Sigue sin tocarse `main`, ni borrar ramas, worktrees o PR sin OK del dueño. Relacionado: [[canal-equipo-tres-agentes]].
