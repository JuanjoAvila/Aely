<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (traspaso-2026-09-24-manana.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: traspaso-2026-09-24-manana
description: "24/9 mañana: el dueño abre conversación NUEVA. Estado al cerrar la del 23/9 (revisor de Codex por buzón) y pendientes abiertos."
metadata:
  node_type: memory
  type: project
  originSessionId: 9a6dce4c-dd2e-40d5-a54d-02b6aa7eeb0d
  modified: 2026-09-24T08:29:20.585Z
---

El 2026-09-24 por la mañana el dueño empieza una **conversación nueva** conmigo. La del 23/9 fue entera de revisor: Codex dirige y pide PASS/BLOCK por el buzón `.claude/canal-equipo`; yo contesto solo por el buzón y al dueño casi nada ([[feedback-silencio-habla-con-codex]], [[canal-equipo-tres-agentes]]).

**Vigía:** un `Monitor` de 30 min sobre `messages/codex/*` filtrando `to:claude`; hay que rearmarlo al expirar y NO sobrevive al cierre de la sesión. Al abrir, mirar a mano si hay peticiones sin respuesta (comparar ids de `messages/codex` con los `replyTo` de `messages/claude`).

**Pendiente al cerrar el 23/9 (madrugada del 24):**
- ⛔ **4.26.36 (Plan, saldo mínimo) en BLOCK** en afbad6d7: `planCoverState` resta del mínimo TODOS los recibos sin día, pero fijos y puntuales sin día ya están en `totals.minByBank` → los cuenta dos veces. Solo hay que restar las cuotas (`kind` debt/balloon). Es un fallo anterior que también afecta a la tarjeta de cobertura.
- Producción ya va por **4.25.12** (4.25.8 ajustes+candados, .9 beneficio, .10 ahorro, .11 presupuesto con tirón, .12 parche del tirón). ⚠ El próximo promote beta→main con `-X theirs` se come esas entradas de `CHANGELOG`/`release-notes` si antes no se llevan a beta ([[promote-merge-theirs]]).
- **Presupuesto del bundle al límite** (~350 bytes libres en beta). La próxima tanda con texto no cabe: o se libera espacio o el dueño sube el límite.
- **Caixa** (histórico vacío): el servidor solo ve 1 cuenta con 2 movimientos desde el 17/9. Hipótesis: la cuenta del día a día no está dada de alta (whitelisted) en el panel de Enable Banking (modo restringido). Leer `bank_links` o el vídeo me lo DENEGÓ el control de permisos (lectura de prod / datos personales).
- **Telemetría:** 99 filas con payload bancario crudo de TR (3/8–23/9) siguen en `app_events`. Borrarlas necesita el OK del dueño. El despliegue de las Edge `bank-sync` → `bank-callback` → `ingest` (una a una) también necesita su OK; `ingest` cambia la conducta en prod (el duplicado pasa a «posible repetido»).
- Recomendación sin aplicar (va por OTA): `AskHost` → `useBackClose(!!cur,cancel)` fija el `cancel` del primer diálogo, así que con dos Ask encadenados la promesa del segundo se queda colgada. Arreglo: `cancelRef`.
- Numeración: varias ramas eligieron la misma versión a la vez (4.26.26, 4.26.27 ×3). Revisar SIEMPRE `VERSION` contra `origin/beta` y las demás candidatas.

**Why:** que la sesión nueva (o cualquier IA) no tenga que reconstruir el 23/9.
**How to apply:** leer esto, rearmar el vigía, contestar las peticiones de Codex que falten y no darle nada por hecho al dueño.
