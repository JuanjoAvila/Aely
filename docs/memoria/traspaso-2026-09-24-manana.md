> Vigencia: esta memoria conserva hechos históricos. Para trabajo actual prevalecen AGENTS.md y docs/COORDINACION-AGENTES.md de codex/coordinacion. Claude local está cerrado: no reactivar vigías, buzón ni relevos locales. La rutina Cloud solo ejecuta encargos con reserva propia confirmada.

<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (traspaso-2026-09-24-manana.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: traspaso-2026-09-24-manana
description: "Cierre 28/9 noche: PROD 4.26.65 (web: Inicio/Gastos, nómina adelantada, ciclo de cobro, todos los ingresos); widget/TR en beta con APK 51; Codex subía una última tarea a beta sin revisar."
metadata:
  node_type: memory
  type: project
  modified: 2026-09-29T20:26:53.310Z
---

26/9: sesión entera de revisor de Codex por el buzón. Cerrada la madrugada del 27/9 a petición suya: vigía APAGADO (state/claude.json dice parado). Al abrir: rearmar Monitor y comparar ids de `messages/codex` con los `replyTo` de `messages/claude`.

**Estado al 26/9 ~15h:**
- **Beta 4.26.52.1** (Action 36255600639, código 94bca134): selector «Banco del widget» (PASS f3960dd0) + FIN-06 + FIN-07 histórico cloud entero por cursor UUID (PASS 94bca134). Falta prueba móvil (guion en docs/briefs/fin07-historico-cloud-2026-09-26.md).
- **Prod 4.26.52** (main 8cd41f09 = FIN-06 + FIN-07, dos promotes exclusivos; antes 2ea992b2 solo FIN-06 aprobado por él; árbol = e8ff77e2, sin duplicados, Pages verificado). APK prod 4.26.32/48. ⚠ La próxima ronda beta→main debe dejar ganar beta en 00-core/06/07/08/10/11/14. `npm run salud` da falso «beta ya en producción» (compara VERSION).
- **FIN-05** (widget con app cerrada): sigue pendiente de prueba móvil.
- **Servidor (OPS-01, inventario 26/9 noche por API de gestión, solo lectura):** ingest v48 = be59e27c (beta 25/9) → FIN-05 ACTIVO, falta solo FIN-06 (wallet.ts). bank-sync v31 = 7839acb7. categorize v16 atrasada (13/9, aún tiene «bizum»; cliente lo filtra). Resto al día o sin efecto. Desplegar ingest SIEMPRE desde beta, nunca main.
- **FIN-08** diagnóstico (docs, PASS e482c200): espera su decisión sobre inventario privado solo lectura.
- **TR-CATEGORIA**: `bank-sync` DESPLEGADO con su OK (Action 36271682736, solo esa función, sin migraciones); PR JuanjoAvila/Aely#46 fusionado en beta → **beta 4.26.53.1** (f2f3839e, código = 17fb7522). Falta prueba móvil (guion en docs/briefs/tr-descripcion-clasificacion-2026-09-26.md).
- ✅ 27/9: OPS-01 C en main (PR #47, f5e6b514, mi PASS a 90a5667d y f248703c, CI verde): `supabase.yml` solo manual y de UNA función; ningún push/promote despliega ya. Quedan A (ingest+wallet) y B (categorize sin bizum), cada uno con su OK.
- **OPS-01** (auditoría repo↔Supabase vivo): PASS 8f6830e6, solo docs + 3 parches inertes. Esperan su OK uno a uno: C (quitar push→deploy de supabase.yml, validar FN), A (ingest con wallet FIN-06, rollback be59e27c), B (categorize sin bizum, rollback 6f61bfc6).
- Codex no continúa sin orden del dueño.


**27/9 (sesión de revisor, vigía activo):** OPS-01 C en main (PR #47). A: ingest49 desplegado (Action 36319915174, desde tag ops01-wallet-1397fe28). B: categorize listo (PR #48 borrador, dacbead9) pero BLOQUEADO por 403: al token local le falta edge_functions_write. FIN-05: causa real = la app contaba filas con lápida (fix 4.26.54) + el XML de SharedPreferences añade 4 espacios tras el salto de línea final del journal → journalFull pegajoso (fix nativo APK 51, beta 4.26.55.1 publicada e instalada; falta pago real con app cerrada). OPS-02: ensayo de restaurar (bc2fa093, GO mío): restaurar pisa app_state y el backfill resucita borrados; propuesta de vista aislada espera su OK.
Pendiente del dueño: (1) vista aislada OPS-02, (2) force-push de beta para borrar «[comparación omitida]» publicado en 6fcc3e0e/05a8fb4f (se me coló en un PASS de privacidad), (3) subir docs/memoria a main (memoria-espejo tumba el runner de Codex), (4) token para B.


**Cierre 27/9 ~22h:** PROD 4.26.57 en vivo (main ece3a2d9 + docs 190f4b6c; OPS-02 visor de copias solo lectura + SEC-03 logs sin datos personales). Beta 4.26.58.1 (2a0e2d3a) = runtime de f2354a47 + 5 tandas de pago movidas a 4.26.58. APK beta 51, estable 48. ingest de SEC-03 NO desplegado (parte de main; portar sobre 1397fe28 antes). 14 incidencias INC-2709-01..14 registradas en docs/BACKLOG.md (P0: crash «Cuotas de deuda», coherencia Inicio/Gastos, cargos CaixaBank).

**Lecciones del día (revisión):**
- Selector de banco: filtrar cuentas no bancarias (efectivo/familia) SOLO en la elección, nunca en el automático — Efectivo puede ser la cuenta diaria (07-tab-patri-fijos solo le ofrece «diario").
- FIN-06: `toEurAmt` ahora devuelve null sin tipo y redondea a céntimo; conversiones encadenadas deben usar `fxRateOf(from)/fxRateOf(to)`.
- Siguen abiertos: flows/oneoffs con el bug de mover el día de un cargo cobrado; Edge `bank-aspsps`, `bank-connect`, `bank-disconnect` sin redesplegar.

**Why:** que la sesión siguiente arranque sin reconstruir el día.
**How to apply:** rearmar el vigía, preguntar por el pago real con 4.26.55.1 y por las 4 decisiones pendientes de arriba.


**Cierre 28/9 (~20:45):** día entero de revisor de Codex por el buzón. PROD 4.26.65 (PR #58, merge 98628bd6 + docs 9734cfca; Pages sirve 4.26.65; main build limpio, sintaxis y docs-frescura OK). GO dados: INC-2709-04 cuotas (4.26.59), INC-2709-05 Inicio + anclaje de nómina (448f9617), ciclo de cobro (891ca8e3 → c47b2820 → 6f300e00), todos los ingresos del ciclo (6f8b2d4b, decisión expresa del dueño: incluye alquiler), promoción 66cc087e. Las 5 tandas de widget/TR siguen en beta con APK 51. Al cerrar, Codex subía otra tarea a beta: NO revisada por mí.
Hallazgos: [[initial-session-carrera-freshlogin]] (cada arranque en frío es login; FIN-09 en BACKLOG) y [[revisar-docs-frescura-tras-commit]]. Límites anotados: tamaño gzip al 100 % (45 B de margen); una nómina duplicada sin possibleDup infla el margen del ciclo; mezcla de versiones en el mismo usuario [variación monetaria omitida] con nómina adelantada.
Vigía PARADO por orden suya (state/claude.json lo dice).


**Cierre 29/9 noche:** PROD 4.26.66 (PR #61, selectivo desde main: solo INC-2809-01, Inicio/Mi ciclo con neto `bud.against`). Mi GO a 38dd59dc con pruebas propias (build limpio, suite salvo memoria-espejo, e2e 30/30 en UTC, CI 36601623318). main luego c2b02ed8 (docs de incidencias de ciclo, widget y efectivo). Gzip al 100 % (333/334 KB): la próxima tanda web debe ceder bytes. Pulido anotado: «Gasto neto: [importe omitido]» cuando los ingresos superan al gasto. Las tandas de widget/TR siguen en beta con APK 51. Vigía PARADO por orden suya.