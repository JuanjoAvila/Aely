<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (ci-beta-corre-en-utc.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: ci-beta-corre-en-utc
description: 14/9 — la CI de beta corre en UTC y tumbó un test que en Madrid pasaba; correr TZ=UTC npm test antes de subir
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f69d765e-fe32-4f3d-8203-899d3f519aa6
  modified: 2026-09-13T21:27:32.010Z
---

La 4.22.0 pasó `npm test` en local (Madrid) y en la review de Cursor, y la CI de beta (UTC) la tumbó: `cuotaDesdeMs` leía el mes de `startOfMonth()` —día 1 en hora de Madrid, que en UTC es el 31 a las 22:00— con `getMonth()` local, y la ventana crecía un mes.

**Why:** dos suites verdes en la misma zona horaria no prueban nada de fechas; la beta se quedó sin publicar hasta la 4.22.1.

**How to apply:** en toda tanda que toque fechas, `TZ=UTC npm test` (y `TZ=America/Los_Angeles` para lo de mes/día) además del local. Para leer el mes de `startOfMonth()`, sumar 12 h antes de `getMonth()`. Relacionado: [[ci-rojo-dos-veces-no-es-flaky]], [[cuotas-deudas-no-casan-por-nombre]].
