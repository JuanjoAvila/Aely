<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (movil-viejo-repite-movimientos.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: movil-viejo-repite-movimientos
description: "15/9 — el «+18,09»: una web con estado de 3 días sincronizó el banco ANTES del pull y resubió Movimientos ya renombrados; arreglo = el banco espera a la nube (4.24.3). Re-marcar repetidos desde el móvil ya se descartó (B09-D)"
metadata: 
  node_type: memory
  type: project
  originSessionId: b170d595-12fd-4c30-b6cc-31b84409b0ef
  modified: 2026-09-15T18:11:01.604Z
---

13/9 08:55Z: `ping` de juanjo **4.18.25 web** (última apertura 10/9) → lote de 7 filas OB (4 TR + 3 Revolut). Tres eran «Movimiento» que él ya había renombrado desde el móvil (`ob_name` sigue «Movimiento», `comercio` cambiado): 18,09 traspaso, 6,40 bizum, 10,34 inversión → 24,49 € de más. Se vio con `created_at` de `expenses` + `app_events` del mismo segundo. El 15/9, con su OK, marqué esas 3 ids `ob:trade_republic#dup` en la nube (el 291,25 del mismo lote NO: sin gemelo).

Arreglo (rama `tanda/banco-espera-nube`, votado por Cursor y Codex): `runBankSync` espera `pullOkRef`; sin pull no llama al banco. e2e `banco-espera-nube` rojo con el código viejo.

**Why:** propuse primero una pasada que re-marcaba `possibleDup` en lo guardado; el comentario de `syncCloudExpenses` (B09-D, 8/9) ya explica que eso deshace decisiones de otro móvil y hace UPDATE a 0 filas. Codex lo vio. Guardado en `wip/gemelo-red-a`, no integrar.
**How to apply:** ante duplicados, mirar `created_at` + `ping` del mismo segundo ANTES de teorizar sobre el banco; y leer los comentarios de «AQUÍ NO VA…» del bloque antes de proponer. Límite que queda: otro móvil que aún no subió su cambio (FIN-03). Relacionado: [[tr-duplicados-saga]], [[feedback-no-dar-por-hecho]], [[feedback-de-uno-en-uno]].
