<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (codex-una-tarea-por-chat.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: codex-una-tarea-por-chat
description: "Desde el 24/9 noche Codex trabaja 1 tarea = 1 chat: cierra al llegar a prod y deja el prompt de la siguiente; el dueño abre chat nuevo. Motivo: fundía la cuota semanal."
metadata:
  node_type: memory
  type: project
  originSessionId: 375c70c9-7754-44bb-ac68-2c2ae53acda2
  modified: 2026-09-24T19:19:19.530Z
---

El 2026-09-24 por la noche el dueño cambió cómo trabaja Codex. Llevaba más de 30 h en la misma conversación y se había fundido el 100 % de su cuota **semanal** (a mí la mía se me renueva cada 5 h). Él se la renovó y cambió el sistema:

**1 tarea = 1 objetivo = 1 chat.** La tarea se cierra cuando funciona, está subida a beta, él la ha probado y está en prod. Codex le pasa entonces el prompt de la siguiente y él abre un chat nuevo. Así controla el avance y el gasto.

**Why:** en una conversación larga Codex era muy autónomo, pero gastaba tokens a lo bestia.
**How to apply:** las peticiones de revisión siguen llegando por el buzón ([[canal-equipo-tres-agentes]]), pero cada chat de Codex arranca en frío. No des por hecho que recuerda lo que hablamos: en cada PASS/BLOCK pon el SHA, `fichero:línea` y lo pendiente, para que se entienda solo. Si Codex intenta lanzarme con el CLI `claude` (sin sesión, `loggedIn:false`), recuérdale que use el buzón.
