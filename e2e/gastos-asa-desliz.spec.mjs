import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra } from "./fixtures.mjs";

/* EL ASA DE ORDENAR NO SE COME EL DESLIZ HACIA PLAN (rechazo de la beta 4.26.173: «sigue fallando,
   solo que ahora ya no es hacia Inicio sino hacia Plan»). El asa (⠿) está en el borde derecho de
   cada fila, justo donde el pulgar empieza a deslizar hacia Plan. Reclamaba el toque entero: el
   carrusel no se movía y la lista entera se repintaba dos veces (al tocar y al soltar), más caro
   cuantas más filas hubiera bajadas. Hacia Inicio el dedo empieza a la izquierda y no la toca.
   Ahora el asa solo se queda el dedo en VERTICAL (ordenar, e2e gastos-orden); en horizontal, el
   carrusel cambia de pestaña y la lista no se repinta. El reloj es el de las fixtures (26/9/2026). */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 393, height: 851 }, hasTouch: true, isMobile: true });

const gastos = Array.from({ length: 240 }, (_, i) => ({
  id: "asa-" + i, date: new Date(Date.parse("2026-09-26T10:00:00Z") - i * 3600000 * 5).toISOString(),
  amount: 3 + (i % 7), merchant: "Comercio " + i, category: ["super", "bares", "compras"][i % 3], source: "manual",
}));

test("deslizar empezando en el asa cambia a Plan sin repintar la lista; un toque no la deja marcada", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: gastos });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector(".gx-head").getBoundingClientRect().left)).toBeLessThan(40);
  // Bajado a media lista, con filas montadas por debajo y por encima.
  await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); h.scrollTop = 2400; });
  await page.waitForTimeout(600);
  const asa = await page.evaluate(() => {
    const b = [...document.querySelectorAll(".page-scroll-host .v4-mov-drag")].map((x) => x.getBoundingClientRect())
      .find((r) => r.top > 300 && r.bottom < innerHeight - 160);
    return b && { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
  });
  expect(asa, "un asa a la vista").toBeTruthy();
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y).closest(".v4-mov-drag"), asa)).toBe(true);
  const cdp = await page.context().newCDPSession(page);

  // Un toque en el asa (sin mover) no deja la fila marcada ni abre nada.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: asa && [asa] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(gastosRoot(page).locator(".v4-mov.dragging")).toHaveCount(0);

  // Cuántas filas re-crea React mientras dura el desliz: el render de la lista entera las toca todas.
  await page.evaluate(() => {
    window.__filas = 0;
    const orig = React.createElement;
    React.createElement = function (tipo) { if (tipo && tipo.type && tipo.type.name === "MovRow" || tipo && tipo.name === "MovRow") window.__filas++; return orig.apply(this, arguments); };
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [asa] });
  for (let i = 1; i <= 16; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: asa.x - ((asa.x - 20) * i) / 16, y: asa.y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator(".botnav-tab.active")).toHaveAttribute("data-tour", "plan");
  expect(await page.evaluate(() => window.__filas), "la lista de Gastos no se repinta por tocar el asa").toBe(0);
  await expect(gastosRoot(page).locator(".v4-mov.dragging")).toHaveCount(0);
  await expect(page.locator(".track .v4-mov.dragging")).toHaveCount(0);
});
