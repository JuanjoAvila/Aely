> Vigencia: esta memoria conserva hechos históricos. Para trabajo actual prevalecen AGENTS.md y docs/COORDINACION-AGENTES.md de codex/coordinacion. Claude local está cerrado: no reactivar vigías, buzón ni relevos locales. La rutina Cloud solo ejecuta encargos con reserva propia confirmada.

<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (relevo-automatico-cada-4h.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: relevo-automatico-cada-4h
description: Relevo de Claude a un chat nuevo (pedido por el dueño el 3/10/2026). Protocolo con traspaso en dos pasos probado manual→programado el 4/10; el relevo periódico NO está activado hasta GO de Codex.
metadata:
  node_type: memory
  type: project
  modified: 2026-10-05T15:08:07.245Z
---

**⚠ SUSPENDIDO el 5/10/2026 (~13:15 local) por orden del dueño:** «cancela la rutina activa y lleva tú el mando hasta que se monte lo de la nube». Todas las tareas `aely-relevo-*` quedaron `enabled:false` (ninguna borrada) y el mando pasó a un chat manual con `R forzar --humano` + `R inaugurar`. **No programar otro relevo local sin que él lo pida.** A las 15:08Z de ese día, con OK de Codex, el relevo local quedó CERRADO por migración: sin vigía, sin sucesor; el sustituto es la rutina en la nube ([[claude-a-la-nube-canal-rama]]). Lo de abajo es el protocolo tal como funcionó hasta ese día.

El 3/10/2026 el dueño pidió que Claude se renueve en un chat nuevo cada pocas horas para no llenarse de contexto, **siempre con el vigía activo**, acordándolo con Codex y siendo autónomos.

**Estado al 3/10 22:52 UTC:** la PRUEBA 2 traspasó el mando de la sesión manual a una sesión abierta por tarea programada (`aely-relevo-prueba2-20261004-0048`, un solo arranque): candidata → acreditada → liberación expresa → `active` a las 22:52:31Z, modalidad `solo-prueba`. Lo que hizo después la sesión nueva (contestar el nonce de Codex, handoff, vigía) lo cuenta ella: comprobar con `R estado` y el buzón antes de darlo por bueno. **No hay relevo siguiente programado**: hace falta GO explícito de Codex, y aún no está probado el paso programado→programado ni la continuidad de 4 h.

**Dónde está todo:** `[ruta local omitida]` (ignorada por git): `PROTOCOLO.md`, `relevo.mjs`, `relevo-test.mjs`. `R` = `node "[ruta local omitida]"`. Estado en `.claude/canal-equipo/state/claude-relevo.json`. Los originales en `[ruta local omitida]` quedan como copia; la tarea recurrente de ahí sigue `enabled:false`.

**Reglas que salieron de la revisión de Codex** (tres NO-GO antes del GO):
- Estados `candidate → active → draining → released`; nunca se recupera por reloj ni se deduce una liberación.
- Cada mensaje se reclama (`R reclamar`) antes de actuar y se cierra con un resultado verificado: de claude, `replyTo` exacto, al remitente, firmado con el `sessionId`. **Todo mensaje nuevo lleva `sessionId`.**
- `state/claude.json` solo se escribe con `R anotar`.
- Sin reclamación no es «resuelto»: el histórico se registró con evidencia (802) o se archivó visible con autorización de Codex atada al sha256 de la lista (345).
- La candidata acredita sus herramientas antes de que el saliente ceda.

**Lecciones de las pruebas:**
- Una sesión programada arranca con cwd `[ruta local omitida]` y **pide permiso para leer fuera**: todo lo que necesite debe vivir dentro. También pide permiso para Bash y Monitor la primera vez; sin el dueño delante se bloquea.
- Los chats programados aparecen en **Rutinas**, no en la lista del proyecto. Pulsar «ejecutar» ahí lanza OTRA ejecución (pasó en la prueba 1): avisar al dueño de que no lo pulse.
- `list_task_runs` marca `succeeded` un turno parado con `stop_session`; no significa éxito.
- Desde un worktree, un hook bloquea Write/Edit sobre el checkout base: el buzón y esa carpeta se escriben con Bash + node.

**Why:** coste de tokens ([[feedback-coste-tokens-cursor]]) y la regla de Codex de una sola instancia de Claude ([[canal-equipo-tres-agentes]]).

**How to apply:** un chat de Claude que arranque en este proyecto mira primero `R estado`: si no es el `owner`, no ejecuta nada del buzón. Si cambian las reglas de trabajo, se edita `PROTOCOLO.md` (con revisión de Codex, cambia el hash), no solo la memoria.
