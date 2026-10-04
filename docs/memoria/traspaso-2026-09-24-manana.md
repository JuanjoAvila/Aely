<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (traspaso-2026-09-24-manana.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: traspaso-2026-09-24-manana
description: "Estado al 26/9 tarde: PROD 4.26.52 (FIN-06+FIN-07, main 8cd41f09); beta 4.26.52.1 (selector banco + FIN-05 + FIN-07) espera prueba móvil; ingest sin desplegar y NUNCA desde main."
metadata:
  node_type: memory
  type: project
  originSessionId: 8b0bce2d-d58a-412b-9a7e-9d222b818c94
  modified: 2026-09-26T14:30:59.365Z
---

26/9: sesión entera de revisor de Codex por el buzón, vigía (Monitor 20 s, 30 min, rearmado a mano) activo mientras la sesión viva. Al abrir: rearmar y comparar ids de `messages/codex` con los `replyTo` de `messages/claude`.

**Estado al 26/9 ~15h:**
- **Beta 4.26.52.1** (Action 36255600639, código 94bca134): selector «Banco del widget» (PASS f3960dd0) + FIN-06 + FIN-07 histórico cloud entero por cursor UUID (PASS 94bca134). Falta prueba móvil (guion en docs/briefs/fin07-historico-cloud-2026-09-26.md).
- **Prod 4.26.52** (main 8cd41f09 = FIN-06 + FIN-07, dos promotes exclusivos; antes 2ea992b2 solo FIN-06 aprobado por él; árbol = e8ff77e2, sin duplicados, Pages verificado). APK prod 4.26.32/48. ⚠ La próxima ronda beta→main debe dejar ganar beta en 00-core/06/07/08/10/11/14. `npm run salud` da falso «beta ya en producción» (compara VERSION).
- **FIN-05** (widget con app cerrada): sigue pendiente de prueba móvil.
- **`ingest` NO desplegado**: desde BETA, nunca desde main (revertiría FIN-05 del servidor). Necesita OK expreso del dueño.
- Codex dijo «no continuar otra tarea automáticamente»: espera orden del dueño.

**Lecciones del día (revisión):**
- Selector de banco: filtrar cuentas no bancarias (efectivo/familia) SOLO en la elección, nunca en el automático — Efectivo puede ser la cuenta diaria (07-tab-patri-fijos solo le ofrece «diario").
- FIN-06: `toEurAmt` ahora devuelve null sin tipo y redondea a céntimo; conversiones encadenadas deben usar `fxRateOf(from)/fxRateOf(to)`.
- Siguen abiertos: flows/oneoffs con el bug de mover el día de un cargo cobrado; Edge `bank-aspsps`, `bank-connect`, `bank-disconnect` sin redesplegar.

**Why:** que la sesión siguiente arranque sin reconstruir el día.
**How to apply:** rearmar el vigía, preguntar por el veredicto móvil de 4.26.51.1 y por el OK de `ingest`.
