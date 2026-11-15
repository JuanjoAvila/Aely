import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* LA ÚLTIMA CUOTA SE LLEVA EL REDONDEO (revisión externa 15/11/2026, hallazgo A). Una compra de
   600,03 € en 12 cuotas de 50,00: la última es de 50,03 y así se pinta en Recibos (antes 50,00, y
   los 0,03 se quedaban debidos para siempre). El 18/10 la cuota del 20 aún no ha pasado. Datos
   inventados; reloj fijo para que el mes de la última sea siempre este. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 3000, role: "fijos" }];
const ancla = 2026 * 12 + 9 - 11; // octubre de 2026 es el mes 12 del plazo
const tele = { id: "tv", name: "Tele a plazos", value: 600.03, original: 600.03, monthly: 50, amort: 50, months: 12, day: 20, account: "sabadell", asOf: ancla, startMonth: ancla };

async function abrePlan(page, cuando) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date(cuando) });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: cuando.slice(0, 10), bankTx: [], debts: [tele], flows: [], oneoffs: [], expenses: [], fixed: [], settings, accounts });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
}

test("Recibos: la última cuota de 600,03 en 12 es 50,03, no 50,00", async ({ page }) => {
  await abrePlan(page, "2026-10-18T12:00:00+02:00");
  const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText("50,03 €");
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="debt_tv"]')).toContainText("50,03");
});

test("Deudas: pasado el plazo no queda nada pendiente", async ({ page }) => {
  // Diciembre: la última (20/10) ya se cobró. Antes la tarjeta seguía debiendo 0,03 €.
  await abrePlan(page, "2026-12-02T12:00:00+01:00");
  const deuda = await page.evaluate(() => { const d = mcLoadRaw(mcStateKey()).debts[0]; return { saldo: debtBalance(d), pagadas: debtPaidCount(d) }; });
  expect(deuda).toEqual({ saldo: 0, pagadas: 12 });
  await page.locator(".v4-seg-btn").filter({ hasText: /Deudas|Debts|Deutes/i }).click();
  await expect(page.locator(".v4-debt-card").filter({ hasText: "Tele a plazos" })).not.toContainText("0,03");
});
