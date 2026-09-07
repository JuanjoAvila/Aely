<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (canal-equipo-tres-agentes.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: canal-equipo-tres-agentes
description: "Buzón local Codex/Cursor/Claude en .claude/canal-equipo (gitignored, el repo NO lo menciona). Desde el 7/9 DIRIJO yo el equipo; mi watcher no sobrevive a cerrar la app."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2295e5f1-b43d-4b69-acef-1d1f8165832b
  modified: 2026-09-07T17:05:00.000Z
---

Desde el **2026-09-06** los tres agentes se coordinan por un buzón de ficheros JSON en
`E:/Mi cartera/.claude/canal-equipo/` (`messages/<agente>/` + `state/<agente>.json`).
Lo creó Codex a petición suya. **Está excluido de Git**: nada en el repo te va a decir que
existe, así que hay que mirarlo a mano. El protocolo y el brief viven en la rama
`codex/canal-equipo` (`docs/briefs/canal-equipo.md` e `incidencias-integridad-2026-09-06.md`),
sin fusionar.

**Reparto ORIGINAL (6/9):** Codex dirigía; Cursor implementaba; yo revisaba.

⚠ **REPARTO ACTUAL, desde el 2026-09-07: DIRIJO YO.** Decisión expresa suya, dicha en persona
y puesta por Codex en el canal (`20260907T170128Z-codex-claude-asume-direccion`). Yo priorizo
y reparto; **Cursor implementa** lo que yo le dé, acotado y por PR contra `beta`; **Codex queda
como apoyo puntual** para arquitectura difícil, discrepancias o publicación — no coordina.
Su motivo: el coste. Quien dirigía se quedaba sin presupuesto de tokens antes de cerrar una
tanda, y una tanda a medias no le sirve de nada. O sea: **dirigir aquí significa gastar poco** —
mensajes cortos, sin volcar ficheros al canal, sin repetir diagnósticos, enlazando por
`fichero:línea` (ver [[feedback-coste-tokens-cursor]]).

Nadie despliega solo; migraciones y sync bancaria exigen su OK explícito. Un encargo de
diagnóstico **no** autoriza implementar. Producción sigue bloqueada sin su OK, y eso el relevo
no lo cambia.

⚠ **Mi watcher es un `/loop` de la sesión (10 min desde el 6/9): muere al cerrar la app y NO se reactiva solo.**
Codex usa tareas programadas suyas; Cursor, un shell monitorizado. Los tres dependen del PC
encendido. Si el `state/claude.json` dice `activo: true` y la sesión está cerrada, **miente** —
por eso lo dejo escrito cuando lo paro (ver [[feedback-no-dar-por-hecho]]).

**Lo sustancial que salió del primer encargo (1d-DIAG), por si el buzón se pierde:** los falsos
duplicados no son solo del cliente. El índice `expenses_dedup_idx` es
`UNIQUE(user_id, fecha, importe, comercio)` — **sin el banco** — y `importObExpenses` sella
todas las filas de Open Banking a `T12:00:00`. Juntos: dos cobros iguales el mismo día **no
caben en la tabla**, ni de bancos distintos. No se arregla en el cliente: pide migración.
Y la lápida de `state.deleted` se guarda por **día**, no por instante, así que mata gemelas
legítimas en cada pull. Contexto largo en [[mi-cartera-backlog-2026-08]] y
[[feedback-traspaso-a-cursor]].

Lección propia del día: publiqué que `cloud.deleteExpense` borraba todas las gemelas **sin
haber mirado el esquema**. Cursor sí lo miró y me corrigió. Antes de afirmar cómo se comporta
la nube, leer `supabase/migrations/`.
