<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (panel-beta-reabre-ajustes.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: panel-beta-reabre-ajustes
description: "15-16/9 — «se abre todo el rato Ajustes»: la vuelta al panel de beta renovaba su marca al reabrir, y RESTAURAR LA ALTURA contaba como interacción; un paso de tanda que le hace SALIR con el panel abierto lo dispara"
metadata: 
  node_type: memory
  type: project
  originSessionId: b170d595-12fd-4c30-b6cc-31b84409b0ef
  modified: 2026-09-16T06:33:27.449Z
---

`BetaReviewPanel` (10-app-components ~L1224) guardaba `_betaPanelAbierto` al montar; `11-app-main` (~L1158) reabre Ajustes + panel si la marca tiene < 2 h. Como reabrir vuelve a montar y reescribía la hora, salir de la app sin «‹ Ajustes» = Ajustes para siempre. Lo destapó el paso 2 de 4.24.2 («sin red, abre Ajustes → Revisar esta beta») + salir a quitar el modo avión. Atajo: entrar y pulsar «‹ Ajustes».

**4.24.4 (beta 16/9, `641c1244`):** reabrir no renueva, cerrar Ajustes/panel o enviar el último veredicto olvida, máx. una reapertura por marca (`_betaPanelReabierto`).

⚠ **Y el primer arreglo NO bastaba, por la otra puerta (review 16/9).** La reapertura devuelve el panel a la misma altura con `scrollTop=y`, y eso dispara `scroll` igual que un dedo → el `onScroll` llamaba a `betaMarcarAbierto()` → marca nueva y `_betaPanelReabierto` borrado: cada reapertura automática se regalaba otra. Ahora la marca la pone `pointerdown` y el scroll solo la mantiene viva si ya hubo gesto. Se vio con un e2e que monta el panel sin tocar nada y mira si la marca se mueve sola; el test de `revisar-beta` que simulaba «estaba leyendo» con un `Event('scroll')` pelado hubo que darle dedo.

**PENDIENTE (hallazgo 2, no bloquea):** en e2e la reapertura automática abre AJUSTES pero el panel NO llega a montarse — el `setTimeout(0)` que dispara `mc-open-beta-review` corre antes de que `SettingsPanel` registre el listener. Si en su móvil pasa igual, la mitad «vuelve al panel y a la misma altura» (10/9) nunca ha funcionado, y lo que él ve es justo «se abre Ajustes por defecto». El e2e viejo solo comprueba `betaDebeReabrirse()`, no que el panel salga.

**Why:** sus palabras, «me la liasteis»: el bug era viejo, pero lo disparó un paso que escribimos nosotros.
**How to apply:** al escribir pasos del panel, ninguno debe acabar con él fuera de la app y el panel abierto SIN decirle cómo salir; todo «recordar dónde estaba» necesita caducidad que NO se renueve sola; y ojo con lo que el propio arreglo dispara (restaurar scroll, foco, resize: parecen gestos y no lo son). Relacionado: [[panel-beta-solo-lo-probable]], [[feedback-leer-sus-veredictos-primero]], [[feedback-no-dar-por-hecho]].
