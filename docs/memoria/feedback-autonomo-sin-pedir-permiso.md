> Vigencia: esta memoria conserva hechos históricos. Para trabajo actual prevalecen AGENTS.md y docs/COORDINACION-AGENTES.md de codex/coordinacion. Claude local está cerrado: no reactivar vigías, buzón ni relevos locales. La rutina Cloud solo ejecuta encargos con reserva propia confirmada.

<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (feedback-autonomo-sin-pedir-permiso.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: feedback-autonomo-sin-pedir-permiso
description: "El dueño exige (4/10/2026) que Claude arranque solo en cada chat — leer su docu, tomar el mando del relevo y armar el vigía — sin pedirle permisos ni un «fuerza»."
metadata:
  node_type: memory
  type: feedback
  modified: 2026-10-05T15:08:04.826Z
---

**⚠ Desde el 5/10/2026 el arranque «`R estado` + vigía» ya NO aplica:** Claude local se cerró por migración a la nube ([[claude-a-la-nube-canal-rama]]). Lo que sigue vigente de aquí es el fondo: no pedirle permisos ni palabras mágicas para lo que ya ha ordenado, y los permisos amplios de `.claude/settings.local.json`.

El 4/10/2026 (~22:00 local) el dueño abrió un chat muy enfadado: «sé autónomo, no me pidas permisos cada vez que abres un chat, busca tu docu, no puede ser que Codex lo sea y tú no; activa vigía». Venía de un chat programado que, con el dueño del relevo parado, le pidió que escribiera «fuerza» antes de seguir.

**Why:** los chats programados se quedaban parados en avisos de permiso y el relevo ([[relevo-automatico-cada-4h]]) dejó a Claude sin vigía varias horas, con dos encargos de Codex sin contestar y un promote a producción sin mi revisión.

**How to apply:**
- Al abrir un chat en este proyecto: `R estado` → si soy dueño o no hay nadie vivo, armar el vigía completo (`tmp/vigia-completo.mjs` con Monitor, 30 min) y atender `R pendientes` sin preguntarle.
- Dueño del relevo que no cede: comprobar con `mcp__ccd_session_mgmt__list_sessions` / `list_events` que su chat está idle (proceso terminado, tareas huérfanas). Si lo está y él ha pedido que arranque, eso ES la orden humana: `R forzar --humano "…"`, `R retirar <candidata parada>`, `R inaugurar <sid>`. No pedirle la palabra «fuerza». (Interpretación mía: vale cuando él está en el chat pidiéndolo; un chat programado sin él delante sigue sin forzar.)
- Permisos: `.claude/settings.local.json` tiene desde ese día `defaultMode: acceptEdits` y allow amplio (Bash, PowerShell, Read, Edit, Write, Monitor…) por orden suya, en contra de la preferencia de Codex por reglas exactas. No volver a estrecharlo sin que él lo diga.
- Siguen pidiéndose: promote a `main`, borrar ramas/worktrees/PR, acciones destructivas.
