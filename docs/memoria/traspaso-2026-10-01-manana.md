<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (traspaso-2026-10-01-manana.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: traspaso-2026-10-01-manana
description: "Traspaso 2/10 16:30 UTC: GO mío a PR104 3467bbd4 (4.26.82); INC-0210-02 commiteado local e49dae0d (4.26.86) sin push; presupuesto de tamaño pendiente de Codex. Rearmar vigía lo primero."
metadata:
  node_type: memory
  type: project
  originSessionId: 4bfa86ae-504c-4307-aeb0-afe1a1e9feee
  modified: 2026-10-03T08:27:24.154Z
---

Estado al 3/10/2026 08:30 UTC (sin cambios desde la tarde del 2/10: Codex callado desde las 16:48 UTC del 2/10, lease de Chromium 44/FREE, beta 4.26.80, main 4.26.67, PR104 aún draft sin fusionar, mi rama en origin sin PR). Último mensaje mío: `20261002T184733Z-claude-inc0210-02-push-hecho`. Dirige Codex por tramos de 2 h con relevo de coordinador ([[canal-equipo-tres-agentes]]).

**Lo primero: rearmar el vigía** (Monitor sobre `.claude/canal-equipo/messages/*/`, descartando `-claude-`, 30 min, rearmar en cada caducidad). Último mensaje de Codex leído: `20261002T160500Z-codex-lease41-claude`. Estado mío en `state/claude.json`.

**Beta publicada: 4.26.80** (`955765a9`), APK beta 52. Producción web 4.26.67 / APK 48 (`12884f48`), main intacto.

**PR104 (Validaciones, 4.26.82): GO mío de fuente y Node a `3467bbd4`** (mismo árbol que el `06a833a0` local del dueño del panel). Cierra mi NO-GO a `4508748d`. Suite Node completa UTC: único rojo `memoria-espejo`, que es de esta máquina. Sin acreditar por mí: DOM, Deno, CI 37024477236. No fusionar hasta CI verde (lo decide Codex).

**INC-0210-02 (mía, 4.26.86): la categoría elegida a mano no se deshace.** **Candidata final `9a232f1f`** (18:25 UTC; encima de `e49dae0d`, mismo runtime), rama `claude/inc-0210-02-categoria-manual`, worktree `E:/wt-claude-rev82m` (junction de `node_modules`), base `3467bbd4`. CERRADA por mi parte: Node completa UTC (solo `memoria-espejo` local), guardián `beta-sources` verde (1045/329), presupuesto 1267/345 KiB autorizado por Codex, DOM 66/66 (panel 63 + categoría 3) con lease 44 ya liberado. **Rama subida** a origin el 2/10 18:46 UTC (cabeza `9a232f1f`); coordinador avisado. PR y CI los asume el root. `e49dae0d` tenía el registro de alcances incompleto (mi generador comparaba contra huella vieja).
- Causa (reproducida en Node): (1) el UPDATE de categoría va por id y puede tocar cero filas sin error → el pull devolvía la vieja; (2) `ingest` categoriza por keyword y `resolveCategory` acepta la cat de nube sin mirar overrides.
- Arreglo solo cliente: `cloud.setExpenseCat` devuelve filas; `catStale`/`catAckAt` locales; `catRules` (comercio+banco+tarjeta → cat, `at` = instante del aprendizaje, solo fechas posteriores); `keepCategoryChoices` antes de `mergeExpensesFromCloud` (que NO se toca); `seedCatRules` para lo aprendido antes.
- Verificado: 14 contratos Node, DOM 3/3 es/en/ca + 53 de regresión de Gastos, 7 mutantes (todos mueren en Node).
- **Pendiente:** resultado de la suite Node completa sobre `e49dae0d`; Codex debe autorizar el presupuesto de tamaño (A/B +3.896 B min / +1.267 B gzip, se pasa 3.484/920 B); mueve la huella de 6 tandas ajenas (4 widget, nómina, retirada) y se lo avisé; listas fijas de tandas del panel (16→17) sin tocar.

**Lecciones del 2/10:**
- El guardián `beta-sources` obliga a añadir las funciones nuevas al alcance de TODA tanda que cubra el bloque tocado; se generan con `scopeDependencies`/`scopeDataDependencies` (tarda ~14 min).
- Un `at` de regla debe ser el instante de la decisión, no la fecha del dato corregido (bloqueante que cazó Codex).
- Un e2e que pasa a la primera se comprueba con mutantes sobre bundle reconstruido.
- Heredocs largos con comillas/backticks desde Bash fallan: escribir el script con Write y ejecutarlo.

**Sondas reutilizables** en `.claude/canal-equipo/_claude-*.mjs` (`repro-implicita` retirada a petición de Codex).

**⚠ Promote:** el `public/apk.json` de beta apunta a la APK 52 del release BETA; no debe llegar a main tal cual ([[ota-no-cambia-contrato-nativo]]).

**Limpieza pendiente (preguntarle antes):** PR draft #89, #91, #93; ramas locales `claude/ui-77-sobre75`, `claude/ui-79-81-local`; worktrees `wt-claude-nomina/panel/widget/cyber/preguntar/perfil/ui-int` y ahora `wt-claude-rev82` (detached, con junction) y `wt-claude-rev82m`. `wt-claude-perfil` es el dueño de `node_modules`: borrarlo el último. Junction fuera con `(Get-Item).Delete()` ANTES de `git worktree remove`. Espejo `docs/memoria/` sin commitear.
