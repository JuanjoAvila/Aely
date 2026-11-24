import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";
const YM = 2026 * 12 + 8;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 2380, role: "diario", spendFrom: true }];
const nomina = (amount) => ({ id: "n1", date: "2026-09-03T10:00:00.000Z", amount: -amount, category: "ingreso", merchant: "Nómina Empresa SL", ent: "sabadell", source: "manual" });
const prestamo = { id: "d1", ent: "familia", name: "Préstamo del piso", value: 12000, original: 12000, monthly: 260, months: 40, day: 28, asOf: YM - 6, account: "sabadell" };
const base = (sueldo, extra={}) => ({ __seedOnce: true, bankTx: [], flows: [], oneoffs: [], settings, accounts, budget: 1200,
  expenses: [nomina(sueldo)], fixed: [{ id: "r1", name: "Comunidad", amount: 95, freq: "mes", day: 28, account: "sabadell" }],
  debts: [prestamo], goals: [{ id: "g1", name: "Viaje", emoji: "✈️", target: 3000, saved: 100, deadline: "2027-08" }],
  aportaciones: [{ id: "a1", name: "Fondo indexado", amount: 200, ent: "myinvestor" }], reservaLog: [], ...extra });
for (const [nombre, extra] of [["base", {}], ["pagado", { fixed: [{ id: "r1", name: "Comunidad", amount: 95, freq: "mes", day: 28, account: "sabadell" }, { id: "r2", name: "Gimnasio", amount: 30, freq: "mes", day: 3, account: "sabadell" }] }]]) {
test("probe " + nombre, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installFixtureClock(page);
  await seedLoggedInDashboard(page, base(3000, extra));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.waitForTimeout(900);
  const out = {};
  for (const seg of ["recibos", "deudas", "metas"]) {
    await page.locator('.v4-seg-btn[data-seg="' + seg + '"]').click();
    await page.waitForTimeout(900);
    out[seg] = await page.evaluate((seg) => { const q = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.height)]; };
      const R = seg === "recibos"; const root = R ? '[data-testid="plan-summary"] ' : seg === "deudas" ? '[data-testid="debts-summary"] ' : '[data-testid="goals-summary"] ';
      return { card: q(root.trim()), head: q(root + (R ? ".pr6-sum-h" : ".rpt-hh")), big: q(root + (R ? ".pr6-big" : ".rpt-big")), sub: q(root + (R ? ".pr6-count" : ".rpt-hs")), facts: q(root + (R ? ".pr6-pills" : ".rpt-facts")), tabs: q(".v4-plan-tabs") }; }, seg);
    await page.screenshot({ path: "E:/coord-notas/plan-hojas-anadir-24-11/h-" + nombre + "-" + seg + ".png" });
  }
  console.log(nombre, JSON.stringify(out));
});
}
