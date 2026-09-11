<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (e2e-getbytext-pestanas-premontadas.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: e2e-getbytext-pestanas-premontadas
description: "e2e flaky por getByText sin acotar: a los 3,2 s la app premonta las pestañas OCULTAS y .first() pasa a ser la copia escondida"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 15e1bf30-4dfd-4b0e-88de-d4d1a7b980d5
  modified: 2026-09-11T13:06:47.417Z
---

**2026-08-17.** `e2e/bancos-acordeon.spec.mjs` caía 2 de cada 3 pasadas de la suite entera a
`--workers=8` (en aislado, 9/9). El error decía `toBeVisible() ... Received: hidden` en
`getByText("Sabadell").first()`, con las filas ya contadas — cuadro perfecto de «va lento, dale más
timeout». **No era lentitud: era el elemento equivocado, y con timeout infinito habría caído igual.**

Causa: la app **premonta las pestañas en un hueco libre a los 3,2 s** (`mcScheduleIdle(...,3200)` →
`setMountNeighbors`/`setMountedTabs`, una pestaña por hueco cada 900 ms). Esas pestañas quedan
OCULTAS pero en el DOM, y **antes** que los paneles `position:fixed` (que se pintan al final del
árbol). Con la cuenta que siembra el fixture (`ent:"sabadell"`) el texto «Sabadell» aparece 4 veces:
Plan («te quedarán 1000 € en Sabadell») y Cartera (fila de la cuenta) — ocultas y primeras — más la
fila real del panel y su chip. Con la máquina cargada el premontaje llega ANTES que la aserción,
y `.first()` deja de ser la fila visible.

**Why:** `getByText(...).first()` sin acotar no pregunta «¿se ve el banco?», pregunta «¿se ve el
primer nodo del documento con ese texto?» — y eso cambia según lo que la app haya montado por
detrás. La carga no rompe nada: solo mueve la aserción a después del premontaje.

**How to apply:** en los e2e, el texto se busca **dentro de su contenedor**:
`page.locator('[data-aspsp="Sabadell"]').getByText("Sabadell").first()`. Si un `toBeVisible` falla
bajo carga pero pasa en aislado, antes de tocar timeouts hay que **listar todos los nodos que casan
con su visibilidad** (basta esperar >12 s a propósito en aislado y volcarlos: reproduce el fallo de
forma determinista, sin depender de la carga). Y `toHaveCount` verde no dice nada de visibilidad:
existir en el DOM y ocupar pantalla son dos estados distintos.

Verificado con 4 pasadas completas a `--workers=8` (135/135 cada una) + prueba mutante
(esconder `.nm` con `addStyleTag` y comprobar que el test SÍ cae). Misma disciplina que
[[feedback-de-uno-en-uno]]: no se da por arreglado sin reproducirlo antes.

---

## SEGUNDA VEZ, 2026-09-11 — y esta dejó la beta sin publicar

`e2e/pulido-vacios.spec.mjs` («★ P6: el anillo arranca vacío y se llena») tenía
`page.locator("svg circle").last()`. Al integrar los **logos de banco** —SVG inline con sus
propios `<circle>`: Sabadell uno, CaixaBank dos— el último círculo del documento dejó de ser el
anillo del presupuesto y pasó a ser **el punto azul del logo de Sabadell**. Volcado real:

```
i=2  r=48     dash=301.59  off=241.27   ← el anillo
i=3  r=3.55   dash=null    off=null     ← Sabadell, dentro de .mono-logo
```

`Number(null) < Number(null)-0.01` es `false` para siempre → el `expect.poll` agotaba sus 10 s.
`Publicar BETA` salió en rojo (217 pasan, 1 falla) y **la 4.19.49 no llegó a su móvil**.
Arreglado acotando a `.v4-budget svg circle`.

**La regla, ya con dos víctimas:** `.first()` / `.last()` sobre un selector de toda la página es
una bomba de relojería — la desarma cualquier dibujo nuevo. **Siempre dentro de su contenedor.**

## ⚠ Y AHORA PUEDO EJECUTARLOS YO

No existe el shim en `node_modules/.bin`, por eso `npm run test:e2e` decía «playwright no se
reconoce». Pero esto funciona:

```
node node_modules/@playwright/test/cli.js install chromium
node node_modules/@playwright/test/cli.js test --config=playwright.config.mjs
```

218 pasan en ~2,3 min. Con eso `npm test` da **EXIT 0 de verdad**, e2e incluidos. Ya no hay excusa
para pedirle a Cursor que ejecute lo que puedo ejecutar yo — su review sigue siendo obligatoria
([[feedback-todo-lo-mio-revisado-por-cursor]]), pero para el **criterio**, no para ser mis manos.
