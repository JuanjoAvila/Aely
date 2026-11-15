import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra } from "./fixtures.mjs";

/* ORDENAR CON PULSACIÓN LARGA NO SE COME NINGÚN OTRO GESTO DE LA FILA (15/11/2026).
   El asa ⠿ se fue (DIS-14) y la fila entera se mantiene pulsada para ordenar (`gxReorden`). Eso
   pone a competir el mismo dedo con tres cosas que ya existían, y las tres tienen que seguir igual:
   · Deslizar hacia Plan empezando en el borde derecho de la fila (rechazo de la beta 4.26.173: el
     asa vivía justo ahí y se quedaba el dedo). Además la lista no se repinta: el asa lo hacía al
     tocar y al soltar, y con cientos de filas bajadas costaba 100-150 ms por frame a CPU ×6.
   · Un toque corto abre la ficha.
   · Deslizar en vertical antes de que se levante es scroll, no ordenar.
   El reloj es el de las fixtures (26/9/2026). */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 393, height: 851 }, hasTouch: true, isMobile: true });

const gastos = Array.from({ length: 240 }, (_, i) => ({
  id: "pl-" + i, date: new Date(Date.parse("2026-09-26T10:00:00Z") - i * 3600000 * 5).toISOString(),
  amount: 3 + (i % 7), merchant: "Comercio " + i, category: ["super", "bares", "compras"][i % 3], source: "manual",
}));

async function abreGastos(page) {
  await seedLoggedInDashboard(page, { expenses: gastos });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector(".gx-head").getBoundingClientRect().left)).toBeLessThan(40);
  // Bajado a media lista, con filas montadas por debajo y por encima.
  await page.evaluate(() => { document.querySelector(".page-scroll-host").scrollTop = 2400; });
  await page.waitForTimeout(600);
  // Una fila ordenable a media pantalla: lejos de la cabecera fija y de la barra de abajo.
  const fila = await page.evaluate(() => {
    const b = [...document.querySelectorAll(".page-scroll-host button.v4-mov[data-reorden]")]
      .map((x) => ({ id: x.getAttribute("data-expense-id"), r: x.getBoundingClientRect() }))
      .find((o) => o.r.top > 300 && o.r.bottom < innerHeight - 160);
    return b && { id: b.id, derecha: Math.round(b.r.right - 14), x: Math.round(b.r.left + b.r.width / 2), y: Math.round(b.r.top + b.r.height / 2) };
  });
  expect(fila, "una fila ordenable a la vista").toBeTruthy();
  // Cualquier fila que se levante, aunque sea un instante, queda apuntada.
  await page.evaluate(() => {
    window.__alzadas = 0;
    new MutationObserver((ms) => { for (const m of ms) if (m.target.classList && m.target.classList.contains("gx-alza")) window.__alzadas++; })
      .observe(document.querySelector(".page-scroll-host .gx-list"), { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  return { fila, cdp: await page.context().newCDPSession(page) };
}
const ordenGuardado = (page) => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
  return (s.settings && s.settings.expenseOrder) || null;
});

test("deslizar desde el borde derecho de una fila cambia a Plan sin levantarla ni repintar la lista", async ({ page }) => {
  const { fila, cdp } = await abreGastos(page);
  // Cuántas filas re-crea React mientras dura el desliz: el render de la lista entera las toca todas.
  await page.evaluate(() => {
    window.__filas = 0;
    const orig = React.createElement;
    React.createElement = function (tipo) { if (tipo && tipo.type && tipo.type.name === "MovRow" || tipo && tipo.name === "MovRow") window.__filas++; return orig.apply(this, arguments); };
  });
  const p = { x: fila.derecha, y: fila.y };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] });
  for (let i = 1; i <= 16; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p.x - ((p.x - 20) * i) / 16, y: p.y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  /* Se cuenta lo que pasó MIENTRAS el dedo estaba puesto. Después del cambio de pestaña la lista ya
     se repinta sola en una tarea ociosa (también con un toque en la barra, sin gesto ninguno), y
     contarla aquí hacía el test una carrera contra ese reloj (1 de 70 pasadas). */
  expect(await page.evaluate(() => window.__filas), "la lista de Gastos no se repinta por deslizar sobre una fila").toBe(0);
  await expect(page.locator(".botnav-tab.active")).toHaveAttribute("data-tour", "plan");
  // Más que la espera de la pulsación: si algo hubiera quedado armado, ya se habría levantado.
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__alzadas)).toBe(0);
  await expect(page.locator(".track .gx-alza")).toHaveCount(0);
  expect(await ordenGuardado(page)).toBeNull();
});

test("un toque corto abre la ficha; mantener y soltar sin mover no la abre ni cambia el orden", async ({ page }) => {
  const { fila, cdp } = await abreGastos(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fila.x, y: fila.y }] });
  await page.waitForTimeout(800);
  await expect(gastosRoot(page).locator(`button.v4-mov.gx-alza[data-expense-id="${fila.id}"]`)).toHaveCount(1);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(gastosRoot(page).locator(".gx-alza")).toHaveCount(0);
  await expect(gastosRoot(page).locator(".gx-hueco")).toHaveCount(0);
  await page.waitForTimeout(400);
  await expect(page.locator(".v4-exp-sheet")).toHaveCount(0);
  expect(await ordenGuardado(page)).toBeNull();

  await page.waitForTimeout(500);
  await page.touchscreen.tap(fila.x, fila.y);
  await expect(page.locator(".v4-exp-sheet")).toBeVisible();
});

test("deslizar en vertical antes de que se levante es scroll y no ordena", async ({ page }) => {
  const { fila, cdp } = await abreGastos(page);
  const st0 = await page.evaluate(() => document.querySelector(".page-scroll-host").scrollTop);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fila.x, y: fila.y }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: fila.x, y: fila.y - i * 12 }] });
    await page.waitForTimeout(16);
  }
  // El dedo se queda quieto ya movido: pasada la espera, sigue sin levantarse nada.
  await page.waitForTimeout(700);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.querySelector(".page-scroll-host").scrollTop)).toBeGreaterThan(st0 + 60);
  expect(await page.evaluate(() => window.__alzadas)).toBe(0);
  expect(await ordenGuardado(page)).toBeNull();
  await expect(page.locator(".botnav-tab.active")).toHaveAttribute("data-tour", "gastos");
  await expect(page.locator(".v4-exp-sheet")).toHaveCount(0);
});
