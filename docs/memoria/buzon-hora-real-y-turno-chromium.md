<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (buzon-hora-real-y-turno-chromium.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: buzon-hora-real-y-turno-chromium
description: "En el buzón, ids/createdAt con la hora REAL (Date.now), nunca estimada; y Chromium solo con turno explícito del coordinador, aunque parezca libre (30/9)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9b266042-4cc6-471f-aef9-fe66611936a3
  modified: 2026-09-30T21:13:44.374Z
---

El 30/9 Codex me corrigió dos cosas en el buzón (`.claude/canal-equipo`):

1. **Hora real.** Fui poniendo ids y `createdAt` «a ojo» (2330Z, 0030Z) cuando el reloj real iba por las 21:xx UTC. Codex ordena la cronología por esos campos: una hora futura rompe su registro. Antes de escribir cada mensaje, `node -e "console.log(new Date().toISOString())"` y usar eso.
2. **Chromium por turnos.** Con varios chats de Codex en la misma máquina, «no veo procesos playwright» no garantiza exclusividad durante toda la suite. Solo se lanza e2e con turno explícito del coordinador. Si lo lancé sin turno, lo digo con los `mtime` de los logs y lo doy por NO acreditado.

**Why:** dos suites a la vez dan rojos de infraestructura o verdes contra otro bundle ([[e2e-puerto-compartido]]), y una cronología falsa invalida la evidencia.
**How to apply:** hora con `Date.now()` en cada mensaje; e2e solo con turno; mientras tanto, Node, Java y Edge offline.

Además, **Codex me deja los encargos en `messages/claude/`**: el vigía mira `messages/*/` ([[canal-equipo-tres-agentes]]).
