import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra } from "./fixtures.mjs";

/* LA FILA DE GASTOS, SIN LO QUE SOBRA (auditoría de diseño 233, DIS-13 y DIS-14, aprobada 15/11).
   · Bajo la cabecera del día la fila ya no repite la fecha; el banco solo si hay más de uno en lo
     que se ve, y sin nada que decir la línea ni se pinta.
   · El asa de ordenar (⠿) solo en los días con más de un movimiento: en un día suelto le robaba el
     ancho al comercio para nada. Sin asa, tocar abre la ficha y deslizar cambia de pestaña.
   · El importe (17 px) ya no es más grande que el nombre (16 px).
   El reloj es el de las fixtures (26/9/2026). */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

const g = (id, ymd, hh, amount, ent, extra = {}) => ({ id, date: ymd + "T" + hh + ":00:00Z", amount, category: "super", merchant: "Movimiento sintético " + id, source: "manual", ent, ...extra });
const sab = { id: "sab", ent: "sabadell", name: "Cuenta", value: 2000, role: "diario", spendFrom: true };
const cx = { id: "cx", ent: "caixabank", name: "Cuenta", value: 1000, role: "diario", spendFrom: true };

async function aGastos(page, overrides) {
  await seedLoggedInDashboard(page, overrides);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector(".gx-head").getBoundingClientRect().left)).toBeLessThan(40);
}
const fila = (page, id) => gastosRoot(page).locator(`button.v4-mov[data-expense-id="${id}"]`);

test("un solo banco: sin fecha ni banco en la fila; asa solo en el día con dos", async ({ page }) => {
  await aGastos(page, { accounts: [sab], expenses: [
    g("a", "2026-09-26", "09", 12, "sabadell"), g("b", "2026-09-26", "10", 7, "sabadell"),
    g("c", "2026-09-24", "10", 5, "sabadell"),
  ] });
  await expect(fila(page, "c")).toBeVisible();
  for (const id of ["a", "b", "c"]) await expect(fila(page, id).locator(".meta")).toHaveCount(0);
  await expect(fila(page, "a").locator(".v4-mov-drag")).toHaveCount(1);
  await expect(fila(page, "b").locator(".v4-mov-drag")).toHaveCount(1);
  await expect(fila(page, "c").locator(".v4-mov-drag")).toHaveCount(0);
  const tam = await fila(page, "c").evaluate((b) => ({
    am: parseFloat(getComputedStyle(b.querySelector(".am")).fontSize),
    nm: parseFloat(getComputedStyle(b.querySelector(".nm-title")).fontSize),
    entero: b.querySelector(".nm-title").scrollWidth <= b.querySelector(".nm-title").clientWidth + 1,
  }));
  expect(tam.am).toBe(17);
  expect(tam.am).toBeGreaterThanOrEqual(tam.nm);
  expect(tam.entero, "«Movimiento sintético c» cabe entero sin asa").toBe(true);
});

test("dos bancos: la fila dice el banco, sin la fecha", async ({ page }) => {
  await aGastos(page, { accounts: [sab, cx], settings: { autoPrices: false, theme: "green", expenseBanks: ["sabadell", "caixabank"] }, expenses: [
    g("a", "2026-09-26", "09", 12, "sabadell"), g("b", "2026-09-25", "10", 7, "caixabank"),
  ] });
  await expect(fila(page, "a").locator(".meta")).toHaveText("Sabadell");
  await expect(fila(page, "b").locator(".meta")).toHaveText("CaixaBank");
  for (const id of ["a", "b"]) await expect(fila(page, id).locator(".meta")).not.toContainText("/");
});

test("sin asa: tocar abre la ficha y deslizar en horizontal sobre la fila cambia de pestaña", async ({ page }) => {
  await aGastos(page, { accounts: [sab], expenses: [g("c", "2026-09-26", "10", 5, "sabadell"), g("d", "2026-09-24", "10", 9, "sabadell")] });
  await page.evaluate(() => document.querySelector('.page-scroll-host button.v4-mov[data-expense-id="c"]').scrollIntoView({ block: "center" }));
  const r = await fila(page, "c").boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x0 = Math.round(r.x + r.width - 30), y = Math.round(r.y + r.height / 2);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 16; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 - ((x0 - 20) * i) / 16, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator(".botnav-tab.active")).toHaveAttribute("data-tour", "plan");

  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect.poll(() => page.evaluate(() => document.querySelector(".gx-head").getBoundingClientRect().left)).toBeLessThan(40);
  await fila(page, "c").click();
  await expect(page.locator(".v4-exp-sheet")).toBeVisible();
});
