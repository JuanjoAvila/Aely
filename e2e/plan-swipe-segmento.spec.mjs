/* DESLIZAR VERTICAL EN PLAN CAMBIA DE SECCIÓN (petición 2026-08-03).
 *
 * «que cuando estés en Plan, cuando deslices de arriba a abajo se pase a deudas, y en deudas a
 * metas, y de metas otra vez a recibos, para no tener que pulsar arriba porque si es un móvil
 * largo y lo tienes cogido con una mano, ya tienes que depender de la otra».
 *
 * El gesto vive en `14-v4-screens.js` (PlanTab) y SOLO se activa en los extremos del scroll del
 * `.page` de Plan —arriba del todo tirando hacia abajo, o abajo del todo tirando hacia arriba—,
 * igual que el pull-down del perfil en Inicio. A mitad de una lista larga tiene que seguir siendo
 * scroll normal. Y no puede robarle nada al swipe horizontal entre pestañas (Inicio/Gastos/Plan/
 * Cartera), que vive en `11-app-main.js` y escucha los mismos toques desde más arriba en el DOM. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function appLista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

const pestanaActiva = (page) =>
  page.evaluate(() => {
    const b = document.querySelector(".botnav-tab.active");
    return b ? b.getAttribute("data-tour") : null;
  });

// El wrapper del segmento visible lleva `data-seg` y `aria-hidden="false"` (los otros dos,
// montados pero escondidos con `content-visibility:hidden`, llevan `aria-hidden="true"`).
const segmentoActivo = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-seg][aria-hidden="false"]');
    return el ? el.getAttribute("data-seg") : null;
  });

/** Marcar la pestaña como activa NO significa haber llegado: el carrusel sigue deslizándose ~420 ms
 *  después. Lanzar el gesto ahí dentro hacía que fallara UNA prueba distinta en cada pasada (1 de 6,
 *  siempre la que pillaba el peor momento) — un dedo de verdad no arrastra a mitad de la transición.
 *  Se espera a que el track esté QUIETO, no a un número de milisegundos. */
async function irAPlan(page) {
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("plan");
  await page.waitForFunction(
    () => {
      const tr = document.querySelector(".track");
      if (!tr) return false;
      const ahora = getComputedStyle(tr).transform;
      const quieto = window.__trQuieto;
      window.__trQuieto = { v: ahora, n: quieto && quieto.v === ahora ? quieto.n + 1 : 0 };
      return window.__trQuieto.n >= 3;
    },
    null,
    { timeout: 10_000, polling: "raf" },
  );
}

/** Arrastre vertical real por CDP (mismo patrón que `swipe-pestanas.spec.mjs`/`profile-anim.spec.mjs`):
 *  un gesto sintético de Playwright siempre acaba en `touchend` limpio, así que esto basta para
 *  probar el camino normal; no hace falta simular `touchcancel` aquí porque eso ya lo cubre
 *  `swipe-pestanas.spec.mjs` para el mecanismo compartido del `.viewport`. */
async function deslizarV(page, cdp, { x = 196, y0, dy, pasos = 10 } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + (dy * i) / pasos }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Como `deslizarV` pero con una DERIVA lateral (dx) además de la vertical (dy): un pulgar de
 *  verdad casi nunca baja en línea perfectamente recta. Existe para el rechazo real del usuario
 *  (3/8): «al ir hacia abajo se vuelve loco y cambia también de tabs» — el gesto vertical de
 *  `deslizarV` (dx=0 fijo) nunca podría haber cazado ese caso. */
async function deslizarDiag(page, cdp, { x0, y0, dx, dy, pasos = 10 } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (dx * i) / pasos, y: y0 + (dy * i) / pasos }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

const debts = Array.from({ length: 16 }, (_, i) => ({
  id: "d" + i, name: "Préstamo " + i, value: 6000 + i * 900, monthly: 180 + i * 12,
  apr: 5.5, account: "e2e", start: "2024-01-15", anchor: 8000 + i * 900,
}));
const goals = Array.from({ length: 3 }, (_, i) => ({
  id: "g" + i, name: "Meta " + i, target: 3000 + i * 500, saved: 400 + i * 220, emoji: "🎯", account: "e2e",
}));

// (a) Deslizar hacia abajo arriba del todo recorre el círculo Recibos → Deudas → Metas → Recibos.
test("deslizar hacia abajo arriba del todo recorre Recibos → Deudas → Metas → Recibos", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  const cdp = await page.context().newCDPSession(page);

  expect(await segmentoActivo(page)).toBe("recibos");

  await deslizarV(page, cdp, { y0: 260, dy: 190 });
  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("deudas");

  await deslizarV(page, cdp, { y0: 260, dy: 190 });
  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("metas");

  // Y de Metas otra vez a Recibos: el círculo se cierra, tal cual lo pidió.
  await deslizarV(page, cdp, { y0: 260, dy: 190 });
  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("recibos");
});

// Abajo del todo: tirar hacia arriba es la OLA, no cambia de sección (feedback 4/8 noche).
test("abajo del todo, tirar hacia arriba no cambia de sección", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  const cdp = await page.context().newCDPSession(page);

  expect(await segmentoActivo(page)).toBe("recibos");
  await page.evaluate(() => {
    const pg = document.querySelectorAll(".page")[2];
    pg.scrollTop = pg.scrollHeight;
  });
  await deslizarV(page, cdp, { y0: 500, dy: -190 });
  await page.waitForTimeout(150);
  expect(await segmentoActivo(page), "abajo del todo no debería cambiar de sección").toBe("recibos");
  expect(await pestanaActiva(page)).toBe("plan");
});

// (b) A mitad de una lista larga de Deudas, tirar hacia abajo sigue siendo scroll normal: NO
// cambia de sección. Es la comprobación que de verdad importa (el umbral está para esto).
test("a mitad de una lista larga de Deudas, tirar no cambia de sección", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);

  // Entra en Deudas tocando el segmentado (gesto ya probado en el otro test).
  await page.locator(".v4-seg-btn", { hasText: /deuda/i }).click();
  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("deudas");

  // 16 deudas exceden de sobra el alto de un Pixel 5: confirma que la lista scrollea de verdad
  // antes de fiarse de la prueba (si no scrollea, el test no comprobaría nada).
  await expect.poll(() => page.evaluate(() => {
    const pg = document.querySelectorAll(".page")[2];
    return pg.scrollHeight > pg.clientHeight + 200;
  }), { timeout: 10_000 }).toBe(true);

  // A mitad de scroll, ni arriba ni abajo del todo.
  await page.evaluate(() => { document.querySelectorAll(".page")[2].scrollTop = 300; });
  const antes = await page.evaluate(() => document.querySelectorAll(".page")[2].scrollTop);
  expect(antes).toBeGreaterThan(0);

  const cdp = await page.context().newCDPSession(page);
  // Mismo gesto que el de arriba (tirón hacia abajo, de sobra para pasar el umbral SI estuviera
  // arriba del todo) pero a mitad de lista: tiene que quedarse como scroll normal.
  await deslizarV(page, cdp, { y0: 260, dy: 190 });
  await page.waitForTimeout(150);

  expect(await segmentoActivo(page), "tirar a mitad de lista cambió de sección: no debería").toBe("deudas");
  const despues = await page.evaluate(() => document.querySelectorAll(".page")[2].scrollTop);
  expect(despues, "el scroll normal de la lista se quedó bloqueado").not.toBe(antes);
  expect(await pestanaActiva(page), "a mitad de lista también cambió de pestaña").toBe("plan");
});

/* Mitad de lista + arco de pulgar: el caso real del rechazo 4/8 noche («si deslizas hacia abajo
 * no debería cambiar»). Antes el viewport bloqueaba el eje en horizontal a los ~12 px y mataba
 * el scroll / cambiaba de tab; ahora exige ventaja clara a mitad de lista. */
test("a mitad de Deudas, un arco de pulgar no cambia de sección ni de pestaña", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  await page.locator(".v4-seg-btn", { hasText: /deuda/i }).click();
  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("deudas");
  await page.evaluate(() => { document.querySelectorAll(".page")[2].scrollTop = 300; });
  const cdp = await page.context().newCDPSession(page);
  await arcoPulgar(page, cdp, { x0: 196, y0: 260, dx: 40, dy: 190 });
  await page.waitForTimeout(150);
  expect(await segmentoActivo(page)).toBe("deudas");
  expect(await pestanaActiva(page)).toBe("plan");
});

// Rechazo real del usuario (3/8, 14:03): «al ir hacia abajo se vuelve loco y cambia también de
// tabs». Causa: el gesto vertical de Plan y el swipe horizontal de `.viewport` escuchan el MISMO
// touchmove por separado y cada uno decidía el eje a su aire — un tirón con algo de deriva
// lateral (normal con el pulgar) podía convencer a los dos a la vez. Fix: en cuanto el de Plan
// se declara vertical, `stopPropagation()` dentro del propio `onMove` para que el listener
// horizontal ni se entere de ese touchmove (mismo idioma que `stopSwipe` para los chips de Gastos).
test("un tirón hacia abajo con algo de deriva lateral cambia de sección, no de pestaña", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  const cdp = await page.context().newCDPSession(page);

  expect(await segmentoActivo(page)).toBe("recibos");
  expect(await pestanaActiva(page)).toBe("plan");

  // Mayormente vertical (dy=190) pero con una deriva lateral real (dx=40) — sigue siendo "y" con
  // el margen 1.25× que usan ambos gestos, así que un pulgar normal cae aquí a menudo.
  await deslizarDiag(page, cdp, { x0: 196, y0: 260, dx: 40, dy: 190 });

  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("deudas");
  // Lo que falló de verdad: la pestaña activa NUNCA debería moverse de "plan" con este gesto.
  expect(await pestanaActiva(page), "el tirón vertical también cambió de pestaña").toBe("plan");
});

/** ARCO DE PULGAR: el dedo sale hacia el LADO y baja después, en vez de llevar una deriva
 *  constante como `deslizarDiag`. Es como se mueve una mano que agarra el móvil (el pulgar pivota
 *  sobre su base) y es el caso que se escapó dos veces: con deriva constante, |ddy| ya le saca
 *  ventaja a |ddx| desde el primer píxel y el gesto se clasifica bien de casualidad. */
async function arcoPulgar(page, cdp, { x0, y0, dx, dy, pasos = 14 } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    const u = i / pasos;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x0 + dx * Math.sqrt(u), y: y0 + dy * u * u }],
    });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/* RECHAZO DEL 4/8 («al ir hacia abajo se vuelve loco y cambia también de tabs — SIGUE PASANDO
 * IGUAL»). El `stopPropagation` del arreglo anterior no tocó la causa: los dos gestos decidían el
 * eje POR PROPORCIÓN (|ddx| > |ddy|·1,25) en cuanto el dedo pasaba de 10 px, y en un arco de pulgar
 * a los 10 px se lleva recorrido 11 px de lado y 1 hacia abajo — o sea, HORIZONTAL para siempre,
 * por muy vertical que acabe siendo el tirón. Medido el 4/8: una bajada de 190 px con 40 px de
 * deriva no cambiaba de sección (se la quedaba el swipe de pestañas). Ahora el eje lo decide
 * `gestureAxis` (00-core.js), el MISMO para los dos gestos, y por ventaja en píxeles. */
test("un arco de pulgar hacia abajo cambia de sección, no de pestaña", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  const cdp = await page.context().newCDPSession(page);

  expect(await segmentoActivo(page)).toBe("recibos");
  await arcoPulgar(page, cdp, { x0: 196, y0: 260, dx: 40, dy: 190 });

  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("deudas");
  expect(await pestanaActiva(page), "el arco de pulgar también cambió de pestaña").toBe("plan");
});

// (c) El gesto nuevo no rompe el swipe horizontal entre las 4 pestañas principales.
test("el swipe horizontal entre pestañas sigue funcionando dentro de Plan", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  const cdp = await page.context().newCDPSession(page);

  const W = page.viewportSize().width;
  // Siguiente pestaña (Cartera): arrastre horizontal de derecha a izquierda.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: W - 40, y: 200 }] });
  for (let i = 1; i <= 16; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: W - 40 - ((W - 80) * i) / 16, y: 200 }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("cartera");

  // Y de vuelta a Plan, aterriza en Recibos (el gesto vertical no dejó nada a medias).
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 80, y: 200 }] });
  for (let i = 1; i <= 16; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 80 + ((W - 80) * i) / 16, y: 200 }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("plan");
  expect(await segmentoActivo(page)).toBe("recibos");
});
