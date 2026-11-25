import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosEstado } from "./fixtures.mjs";

/* PLAN Y GASTOS, MISMAS CIFRAS (beta 4.26.255, capturas del dueño del 24/11/2026). Con el DOM real:
   1) «Queda por pagar» de la hoja = la tarjeta de Recibos (247,81 €: 67,58 + 5,75 + 174,48), y «Te quedaría» sale de ahí.
   2) El Plan gasta el NETO de Gastos: 881,08 − 140,35 de otros ingresos = 740,73 (no el bruto).
   3) «Restar del presupuesto»: tras encenderlo en la ficha de la deuda, Gastos baja el límite igual que el Plan
      (1.000 − 174,48 = 825,52 → 84,79 por debajo, no 259). Reloj del 26/09/2026; sus cifras, nombres inventados. */
const YM = 2026 * 12 + 8;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 6656.94, role: "diario", spendFrom: true }];
const mov = (id, d, amount, extra) => Object.assign({ id, date: "2026-09-" + String(d).padStart(2, "0") + "T10:00:00.000Z", amount, category: amount < 0 ? "ingreso" : "super", merchant: "Comercio " + id, ent: "sabadell", source: "manual" }, extra || {});
const rec = (id, name, amount, day) => ({ id, name, amount, day, freq: "mes", account: "sabadell" });
const estado = (restar) => ({ __seedOnce: true, bankTx: [], flows: [], oneoffs: [], settings, accounts, budget: 1000, goals: [], reservaLog: [],
  expenses: [mov("n1", 3, -3333, { merchant: "Nómina Empresa SL" }), mov("i1", 18, -90.35, { merchant: "Comida love" }), mov("i2", 19, -50, { merchant: "Comida ivan" }),
    mov("g1", 5, 400), mov("g2", 9, 300, { category: "ocio" }), mov("g3", 14, 181.08),
    mov("p1", 2, 272.7, { merchant: "Alquiler trastero", source: "ob", category: "otros", reciboId: "r1" })],
  fixed: [rec("r1", "Alquiler trastero", 272.7, 2), rec("r2", "GC RE OCTOPUS ENERGY", 67.58, 27), rec("r3", "Gas (Pepe Energy)", 5.75, 27)],
  debts: [{ id: "otra", ent: "familia", name: "Otras cuotas", value: 20000, original: 20000, monthly: 910.85, months: 30, day: 2, asOf: YM - 4, account: "sabadell" },
    Object.assign({ id: "gym", ent: "familia", name: "Financiación gym en casa", value: 174.48, original: 1040, monthly: 174.48, months: 1, day: 28, asOf: YM, account: "sabadell" }, restar ? { restarPres: true } : {})],
  aportaciones: [{ id: "a1", name: "Fondo", amount: 1050 }] });
const cts = (s) => Math.round(parseFloat(s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) * 100);

async function abre(page, est) {
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, est);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.getByTestId("plan-reparto-chip")).toBeVisible();
}

test("1 · lo que queda por pagar es la cifra de la tarjeta de Recibos, y vive en «¿Te llega?», no en la hoja del reparto", async ({ page }) => {
  await abre(page, estado(false));
  const tarjeta = cts(await page.getByTestId("plan-summary").locator(".pr6-big").innerText());
  expect(tarjeta).toBe(24781);
  await page.getByTestId("plan-reparto-chip").click();
  await expect(page.getByTestId("plan-reparto-pend")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByTestId("plan-llega").click();
  const llega = page.locator(".v4-sheet-back .v4-sheet").last();
  await expect(llega).toContainText("Recibos que faltan");
  await expect(llega).toContainText(/247,81/);
});

test("2 · el Plan gasta el neto de Gastos: 881,08 − 140,35 = 740,73", async ({ page }) => {
  await abre(page, estado(false));
  await page.getByTestId("plan-reparto-chip").click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  // Entran la nómina (3.333) y los ingresos reales del mes (140,35): con el límite por encima del gasto no se restan dos veces.
  await expect(page.getByTestId("plan-reparto-entra")).toContainText(/3\.473,35/);
  // Sin restar: el presupuesto (1.000) manda sobre el gastado neto (740,73).
  await expect(hoja.locator('.cas-row[data-k="gas"]')).toContainText(/740,73/);
  await expect(hoja.locator('.cas-row[data-k="gas"]')).not.toContainText(/881,08/);
  await expect(hoja.locator('.cas-row[data-k="gas"] .cas-sub')).not.toContainText("sobre presupuesto");
});

test("3 · «Restar del presupuesto» encendido en la ficha: Gastos baja el límite igual que el Plan", async ({ page }) => {
  await abre(page, estado(false));
  // Antes: 1.000 − 740,73 = 259 por debajo (la cifra de su captura).
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosEstado(page)).toContainText(/259 € por debajo/);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator('.v4-seg-btn[data-seg="deudas"]').click();
  await page.locator('[data-seg="deudas"] [data-debt-id="gym"]').click();
  const ficha = page.getByTestId("plan-deuda-ficha");
  const sw = ficha.locator('[data-act="restar-presupuesto"]');
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await ficha.locator(".rpt-sx").click();
  await expect(ficha).toHaveCount(0);
  // Plan: el límite baja 174,48 (825,52) y el gastado neto (740,73) cabe: 84,79 de margen.
  await page.locator('.v4-seg-btn[data-seg="recibos"]').click();
  await page.getByTestId("plan-reparto-chip").click();
  await page.getByTestId("plan-reparto-hoja").locator('.cas-row[data-k="gas"]').click();
  const det = page.getByTestId("plan-reparto-detalle");
  await expect(det).toContainText(/740,73/);
  await expect(det).toContainText(/825,52/);
  await expect(det).toContainText(/84,79/);
  await det.locator(".rpt-sx").click();
  // Gastos (ya montada): el MISMO margen, sin recargar.
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosEstado(page)).toContainText(/85 € por debajo/);
  await expect(gastosEstado(page)).not.toContainText(/259/);
});

test("3b · con el interruptor ya puesto al abrir, Gastos dice 85 € por debajo", async ({ page }) => {
  await abre(page, estado(true));
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosEstado(page)).toContainText(/85 € por debajo/);
});
