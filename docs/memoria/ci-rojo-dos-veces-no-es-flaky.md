<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (ci-rojo-dos-veces-no-es-flaky.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: ci-rojo-dos-veces-no-es-flaky
description: "⚠ El CI ya reintenta (retries:1). Un test que cae en el intento Y en el reintento NO es flaky, y Playwright lo dice: «1 flaky» vs «1 failed». Llamar flaky a lo que falla 3 de 3 en CI y 0 de 3 en local deja al dueño horas sin actualizar."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fec4e702-ea38-472e-9860-b3b97ca1c310
  modified: 2026-09-12T16:05:41.149Z
---

**2026-09-12.** Tres CI seguidos en rojo dejaron su móvil parado en la 4.19.85 más de tres horas
mientras se publicaban 85→90. Dos veces se diagnosticó «flaky» y se parcheó el test.

**El dato que zanja la discusión está en el propio log**, y hay que mirarlo antes de decir flaky:

    Running 243 tests using 2 workers      ← en local es 1 worker: no es el mismo escenario
    1) revisar-beta …  Retry #1 …  «1 flaky»   ← pasó al reintento: ESO sí es flaky
    2) rebote-barra-inferior …  FAILED          ← cayó las dos: NO lo es

`playwright.config.mjs` tiene `retries: process.env.CI ? 1 : 0`. Así que **si algo sale como
`failed` y no como `flaky`, ya ha fallado dos veces**. Y «pasa en local» no lo desmiente: local va
a 1 worker, con otra máquina y otros tiempos.

**Why:** el reflejo de parchear el test para que pase tapa el bug de verdad. En este caso el
comentario que se añadió al test lo decía todo sin querer: *«con host a pantalla el clientHeight
crece y onPageScroll ignora el siguiente gesto (`ultimoScrollH`)»* — o sea, **la app se come un
gesto real**, que es exactamente el «stopper» que él lleva reportando («si has bajado rápido la
barra no se escondió… luego si bajas lento ahí»). Absorberlo en el e2e esconde su bug.

**How to apply:** antes de escribir «flaky», (1) leer si Playwright lo contó como flaky o failed,
(2) contar cuántos runs seguidos ha caído, (3) si el arreglo consiste en que el TEST haga un gesto
extra para «absorber» algo, preguntarse si eso que absorbe no es el bug. Y si desatascar al dueño
va para largo, proponer publicar SIN la tanda que bloquea en vez de dejarle días sin nada.

Relacionado: [[feedback-no-dar-por-hecho]], [[e2e-getbytext-pestanas-premontadas]].
