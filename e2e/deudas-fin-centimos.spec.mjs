import { test, expect } from "@playwright/test";
import { datosDeuda } from "./plan-ficha-helpers.mjs";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* LA FECHA DE FIN DE UNA DEUDA SIN PLAZO SE CUENTA EN CÉNTIMOS (revisión 237). 72,45 € pendientes con
   cuota de 10,35 son 7 cuotas: en euros, 72,45 / 10,35 = 7,000…01 y el `ceil` daba 8, con la fecha de
   fin un mes tarde. Reloj fijo en noviembre de 2026 y ancla ese mes: aún no ha vencido ninguna cuota,
   así que el saldo es el valor y 7 cuotas acaban en junio de 2027 (8 decía julio). Datos inventados. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 3000, role: "fijos" }];
const ancla = 2026 * 12 + 10;
const prestamo = { id: "pf", name: "Préstamo familiar", value: 72.45, original: 103.5, monthly: 10.35, day: 1, account: "sabadell", asOf: ancla, startMonth: ancla };

test("Deudas: 72,45 con cuota de 10,35 acaba en junio, 7 de 10 cuotas", async ({ page }) => {
  test.info().annotations.push({ type: "own-clock" });
  const cuando = "2026-11-16T12:00:00+01:00";
  await page.clock.install({ time: new Date(cuando) });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: cuando.slice(0, 10), bankTx: [], debts: [prestamo], flows: [], oneoffs: [], expenses: [], fixed: [], settings, accounts });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator(".v4-seg-btn").filter({ hasText: /Deudas|Debts|Deutes/i }).click();
  const tarjeta = page.locator("[data-debt-id]").filter({ hasText: "Préstamo familiar" });
  expect(await datosDeuda(page,tarjeta)).toMatch(/7\D+10/);
  await expect(tarjeta.locator(".rpt-sub")).toContainText(/acaba\s+jun(io)?\s+2027/i);
});
