/* BAJAR DESPACIO DESDE EL TOPE DE PLAN NO HACE SALTAR EL CONTENIDO (queja del dueño, 12/10;
 * INC-0710-01: «en Plan, al bajar despacio con el dedo, la pantalla se mueve sola»).
 *
 * Causa (14-v4-screens.js, gesto de segmento): si el gesto nacía arriba del todo, el touchstart
 * ponía `touch-action:none` y, al resultar un scroll, se empujaba `scrollTop` a mano con todo lo
 * recorrido desde el touchstart. Pero el navegador decide el touch-action ANTES de ejecutar el
 * touchstart (medido el 13/10: ponerlo ahí dentro es idéntico a no ponerlo), así que ya estaba
 * scrolleando en nativo y el empujón se sumaba encima: 12-16 px de golpe en un frame con el dedo
 * a 2 px por paso, y el contenido quedaba por delante del dedo.
 *
 * Cómo se mide (AGENTS §7 bis: el síntoma, no la causa): frame a frame (rAF) la posición en
 * pantalla del segmento visible mientras un toque por CDP baja a 2 px cada 8 ms. Dos invariantes
 * de un scroll que solo obedece al dedo:
 *   1) el contenido nunca corre más que el dedo (0,25 px/ms): un frame con el doble es un salto;
 *   2) al soltar, el contenido no ha recorrido MÁS que el dedo (el nativo se traga el slop
 *      inicial, así que recorre menos; «más» solo puede venir de un empujón ajeno al dedo).
 * Con el arreglo revertido falla la 2) en los tres segmentos y la 1) en el frame del empujón. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const debts = Array.from({ length: 16 }, (_, i) => ({
  id: "d" + i, name: "Préstamo " + i, value: 6000 + i * 900, monthly: 180 + i * 12,
  apr: 5.5, account: "e2e", start: "2024-01-15", anchor: 8000 + i * 900,
}));
const goals = Array.from({ length: 3 }, (_, i) => ({
  id: "g" + i, name: "Meta " + i, target: 3000 + i * 500, saved: 400 + i * 220, emoji: "🎯", account: "e2e",
}));
const fixed = Array.from({ length: 24 }, (_, i) => ({
  id: "f" + i, name: "Recibo " + i, amount: 20 + i * 7, freq: "mes", day: 1 + (i % 28), account: "sabadell",
}));

async function appLista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}
const pestanaActiva = (page) => page.evaluate(() => {
  const b = document.querySelector(".botnav-tab.active");
  return b ? b.getAttribute("data-tour") : null;
});
const segmentoActivo = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-seg][aria-hidden="false"]');
  return el ? el.getAttribute("data-seg") : null;
});
// Click crudo desde la página: el `locator.click()` sondea el DOM y ensucia la medida (§7 bis).
async function irAPlan(page) {
  await page.evaluate(() => document.querySelector('.botnav-tab[data-tour="plan"]').click());
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("plan");
  await page.waitForTimeout(900);   // el carrusel termina de deslizarse (~420 ms) antes de tocar
}

/** Traza por rAF: tiempo, scrollTop y `top` en pantalla del segmento visible. */
async function arrancarTraza(page) {
  await page.evaluate(() => {
    const pg = document.querySelectorAll(".page")[2];
    window.__tr = []; window.__trOn = true;
    const loop = (t) => {
      if (!window.__trOn) return;
      const s = document.querySelector('[data-seg][aria-hidden="false"]');
      window.__tr.push({ t, st: pg.scrollTop, top: s ? s.getBoundingClientRect().top : null });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
const pararTraza = (page) => page.evaluate(() => { window.__trOn = false; return window.__tr; });

const PASO = 2, CADA_MS = 8;   // 0,25 px/ms: un dedo bajando despacio de verdad
async function arrastreLento(cdp, { x = 196, y0, dy }) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  const n = Math.round(Math.abs(dy) / PASO), s = Math.sign(dy);
  for (let i = 1; i <= n; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + s * PASO * i }] });
    await new Promise((r) => setTimeout(r, CADA_MS));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

for (const segNombre of ["recibos", "deudas", "metas"]) {
  test(`bajar despacio desde el tope de ${segNombre} no salta ni adelanta al dedo`, async ({ page }) => {
    await seedLoggedInDashboard(page, { debts, goals, fixed });
    await page.goto("/");
    await appLista(page);
    await irAPlan(page);
    if (segNombre !== "recibos") {
      await page.locator(".v4-seg-btn", { hasText: segNombre === "deudas" ? /deuda/i : /meta/i }).click();
      await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe(segNombre);
    } else {
      // Recibos arranca recogido (tres y «Ver más»): se despliega para tener lista que bajar.
      await page.locator('[data-seg="recibos"]').getByText(/Ver más|See more|Veure més/).first().click();
      await page.evaluate(() => { document.querySelectorAll(".page")[2].scrollTop = 0; });
    }
    await page.waitForTimeout(600);
    // El gesto solo tiene sentido si hay lista que bajar y estamos arriba del todo.
    const antes = await page.evaluate(() => {
      const pg = document.querySelectorAll(".page")[2];
      return { st: pg.scrollTop, recorrible: pg.scrollHeight - pg.clientHeight };
    });
    expect(antes.st).toBe(0);
    expect(antes.recorrible).toBeGreaterThan(300);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    const DEDO = 260;
    await arrancarTraza(page);
    await arrastreLento(cdp, { y0: 520, dy: -DEDO });
    await page.waitForTimeout(400);
    const tr = await pararTraza(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    const despues = await page.evaluate(() => document.querySelectorAll(".page")[2].scrollTop);
    // El gesto aterrizó: si no bajó, la medida no vale (§7 bis).
    expect(despues, "el arrastre no movió la lista: la muestra no vale").toBeGreaterThan(100);
    expect(await pestanaActiva(page)).toBe("plan");
    expect(await segmentoActivo(page)).toBe(segNombre);

    // 1) Ningún frame en que el contenido corra más del doble que el dedo (0,25 px/ms).
    let peor = { vel: 0 };
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      if (a.top == null || b.top == null) continue;
      const dt = b.t - a.t; if (dt <= 0) continue;
      const vel = Math.abs(b.top - a.top) / dt;
      if (vel > peor.vel) peor = { vel, px: Math.round((a.top - b.top) * 10) / 10, dt: Math.round(dt), st: b.st };
    }
    expect(peor.vel, `el contenido saltó ${peor.px} px en un frame de ${peor.dt} ms (scrollTop ${peor.st})`).toBeLessThanOrEqual(0.5);

    // 2) El contenido no ha recorrido más que el dedo (el nativo se traga el slop del arranque,
    //    unos 15 px aquí; «más que el dedo» solo sale de un empujón que no era suyo).
    expect(despues, `el contenido recorrió ${despues} px con el dedo a ${DEDO}: va por delante del dedo`).toBeLessThanOrEqual(DEDO - 4);
  });
}
