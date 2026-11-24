import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* PLAN (orden del dueño, 24/11): la línea de arriba va sin barra segmentada ni frase; las pestañas Recibos / Deudas /
   Metas bajan DEBAJO de la tarjeta resumen de cada segmento; la flecha de «Tu mes en cifras» no lleva punto; Deudas
   tiene la tarjeta de Recibos (cifra en rojo, chips) con cada lista en su tarjeta y «Añadir» pequeño en la cabecera.
   Cifras inventadas; reloj del 26/09/2026. */
const YM = 2026 * 12 + 8;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 2380, role: "diario", spendFrom: true }];
const nomina = (amount) => ({ id: "n1", date: "2026-09-03T10:00:00.000Z", amount: -amount, category: "ingreso", merchant: "Nómina Empresa SL", ent: "sabadell", source: "manual" });
const prestamo = { id: "d1", ent: "familia", name: "Préstamo del piso", value: 12000, original: 12000, monthly: 260, months: 40, day: 28, asOf: YM - 6, account: "sabadell" };
const gimnasio = { id: "d2", ent: "familia", name: "Financiación del gimnasio", value: 400, original: 600, monthly: 50, amort: 50, months: 8, day: 28, asOf: YM - 2, account: "sabadell" };
const base = (sueldo) => ({ __seedOnce: true, bankTx: [], flows: [], oneoffs: [], settings, accounts, budget: 1200,
  expenses: [nomina(sueldo)], fixed: [{ id: "r1", name: "Comunidad", amount: 95, freq: "mes", day: 28, account: "sabadell" }],
  debts: [prestamo, gimnasio], goals: [{ id: "g1", name: "Viaje", emoji: "✈️", target: 3000, saved: 100, deadline: "2027-08" }],
  aportaciones: [{ id: "a1", name: "Fondo indexado", amount: 200, ent: "myinvestor" }], reservaLog: [] });

async function abrePlan(page, estado, tema) {
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  if (tema) await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), tema);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.getByTestId("plan-reparto-barra")).toBeVisible();
}
const captura = async (page, nombre) => {
  await page.waitForTimeout(700);
  if (process.env.CAPTURAS) await page.screenshot({ path: process.env.CAPTURAS + "/" + nombre + ".png" });
};
const top = (loc) => loc.evaluate((e) => e.getBoundingClientRect().top);
const bottom = (loc) => loc.evaluate((e) => e.getBoundingClientRect().bottom);

test("la línea de arriba va sin barra ni frase y la hoja las conserva", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrePlan(page, base(300), process.env.TEMA);
  const barra = page.getByTestId("plan-reparto-barra");
  await expect(barra).toContainText("Te faltan");
  await expect(barra).toContainText(/Entran/);
  await expect(barra.locator(".rpt-pb")).toHaveCount(0);
  await expect(barra.locator(".rpt-lb-p")).toHaveCount(0);
  await expect(barra).not.toContainText("Si gastas todo el presupuesto");
  await expect(page.locator(".pr6-sum-dot")).toHaveCount(0);
  await captura(page, "plan-recibos-" + (process.env.TEMA || "oscuro"));
  await barra.click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  await expect(hoja).toBeVisible();
  await expect(hoja.locator(".rpt-pb")).toHaveCount(1);
  await expect(hoja).toContainText("Si gastas todo el presupuesto");
  await hoja.locator(".rpt-sx").click();
  await expect(hoja).toHaveCount(0);
  // El aviso del punto vive dentro de «Tu mes en cifras».
  await page.getByTestId("plan-cifras").click();
  await expect(page.getByTestId("plan-mes-aviso")).toContainText(/te faltan .*€/);
});

test("las pestañas van debajo de la tarjeta resumen en Recibos, Deudas y Metas y siguen cambiando de vista", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrePlan(page, base(3000), process.env.TEMA);
  const tabs = page.locator(".v4-plan-tabs");
  await expect(tabs).toHaveCount(1);
  expect(await top(tabs)).toBeGreaterThanOrEqual(await bottom(page.getByTestId("plan-summary")) - 1);
  expect(await top(tabs)).toBeGreaterThanOrEqual(await bottom(page.getByTestId("plan-reparto-barra")) - 1);
  await tabs.locator('[data-seg="deudas"]').click();
  await expect(page.locator('.v4-seg-btn[data-seg="deudas"]')).toHaveAttribute("aria-selected", "true");
  await expect(tabs).toHaveCount(1);
  expect(await top(tabs)).toBeGreaterThanOrEqual(await bottom(page.getByTestId("debts-summary")) - 1);
  await tabs.locator('[data-seg="metas"]').click();
  await expect(page.locator('.v4-seg-btn[data-seg="metas"]')).toHaveAttribute("aria-selected", "true");
  await expect(tabs).toHaveCount(1);
  expect(await top(tabs)).toBeGreaterThanOrEqual(await bottom(page.getByTestId("goals-summary")) - 1);
  await tabs.locator('[data-seg="recibos"]').click();
  await expect(page.getByTestId("plan-summary")).toBeVisible();
});

test("Deudas: tarjeta como la de Recibos con la cifra en rojo, listas en tarjeta y Añadir pequeño", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrePlan(page, base(3000), process.env.TEMA);
  await page.locator('.v4-seg-btn[data-seg="deudas"]').click();
  const hero = page.getByTestId("debts-summary");
  await expect(hero).toHaveClass(/pr6-sum/);
  await expect(hero).toContainText("Este mes pagas");
  await expect(page.getByTestId("debts-mes")).toContainText(/310,00/);
  await expect(page.getByTestId("debts-pagados")).toContainText(/pagados · faltan/);
  await expect(page.getByTestId("debts-debes")).toContainText(/Debes/);
  await expect(page.getByTestId("debts-acaba")).toContainText(/Acaba antes/);
  const color = await page.getByTestId("debts-mes").evaluate((e) => getComputedStyle(e).color);
  const coral = await page.evaluate(() => { const d = document.createElement("i"); d.style.color = "var(--coral)"; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  expect(color).toBe(coral);
  // Por pagar en su tarjeta, con el total a la derecha de la cabecera
  const pend = page.locator('[data-seg="deudas"] [data-sec="pend"]');
  await expect(pend.locator(".rpt-list.rpt-card")).toBeVisible();
  await expect(pend.locator(".rpt-card .rpt-row")).toHaveCount(2);
  await expect(page.getByTestId("debts-suma-pend")).toContainText(/310,00/);
  // Añadir: pequeño, en la cabecera, abre la hoja; el botón verde ancho ya no existe
  const add = hero.locator('[data-act="debt-add"]');
  await expect(add).toBeVisible();
  expect((await add.boundingBox()).width).toBeLessThan(140);
  await expect(page.locator('[data-seg="deudas"] .btn-primary.btn-block')).toHaveCount(0);
  await captura(page, "plan-deudas-" + (process.env.TEMA || "oscuro"));
  await add.click();
  await expect(page.locator(".plan-edit-sheet")).toBeVisible();
});
