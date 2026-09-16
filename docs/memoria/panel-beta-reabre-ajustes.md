<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (panel-beta-reabre-ajustes.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: panel-beta-reabre-ajustes
description: "15/9 — su rechazo de 4.24.2 «se abre todo el rato Ajustes»: la vuelta al panel de beta (10/9) renovaba su marca al reabrir; un paso de tanda que le hace SALIR con el panel abierto lo dispara"
metadata: 
  node_type: memory
  type: project
  originSessionId: b170d595-12fd-4c30-b6cc-31b84409b0ef
  modified: 2026-09-15T20:37:14.851Z
---

`BetaReviewPanel` (10-app-components ~L1224) guarda `_betaPanelAbierto` al montar; `11-app-main` (~L1158) reabre Ajustes + panel si la marca tiene < 2 h. Como reabrir vuelve a montar y reescribe la hora, salir de la app sin «‹ Ajustes» = Ajustes para siempre. Lo destapó el paso 2 de 4.24.2 («sin red, abre Ajustes → Revisar esta beta») + salir a quitar el modo avión. Atajo: entrar y pulsar «‹ Ajustes». Arreglo votado como 4.24.4 (Cursor): reabrir no renueva, cerrar Ajustes/panel o enviar el último veredicto olvida, máx. una reapertura.

**Why:** sus palabras, «me la liasteis»: el bug era viejo, pero lo disparó un paso que escribimos nosotros.
**How to apply:** al escribir pasos del panel, ninguno debe acabar con él fuera de la app y el panel abierto; y todo «recordar dónde estaba» necesita caducidad que NO se renueve sola. Relacionado: [[panel-beta-solo-lo-probable]], [[feedback-leer-sus-veredictos-primero]].
