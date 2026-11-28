import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* CUOTA DE 158,53 Y EL BANCO COBRA 158,60 (feedback 2026-11-28). Financiación al 0 % (total/plazos) que
   el banco redondea hacia arriba: octubre y noviembre ya cobrados a 158,60 y enlazados por el motor, sin
   marcar a mano. Antes la ficha de Recibos solo decía «Se cobró… y la cuota es…» y «Ver en Deudas», y la
   cuota seguía pendiente. Ahora la propia ficha ofrece las dos respuestas, y cualquiera deja pagados LOS
   DOS meses de una vez: ella no va a ir mes a mes por Gastos. Se prueba con el cargo del banco y con el
   que llega por notificación (sin movimiento del banco, que antes no se acreditaba ni confirmándolo).
   Reloj el 28 de noviembre; octubre se comprueba con el mismo motor que pinta la ficha. Datos inventados. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 3200, role: "fijos" }];
const ancla = 2026 * 12 + 5;
const deuda = { id: "fin", name: "Financiación sofá", value: 1902.36, original: 1902.36, monthly: 158.53, months: 12, day: 5, account: "sabadell", asOf: ancla, startMonth: ancla };
const cobro = (id, date, source) => Object.assign({ id, merchant: "FINANCIA TIENDA SOFAS", obName: "FINANCIA TIENDA SOFAS", date, amount: 158.6, ent: "sabadell", category: "deudas", debtId: "fin", source },
  source === "ob" ? { status: "BOOK" } : {});

async function abre(page, source) {
  test.info().annotations.push({ type: "own-clock" });
  const cuando = "2026-11-28T12:00:00+01:00";
  await page.clock.install({ time: new Date(cuando) });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: cuando.slice(0, 10), bankTx: [], debts: [deuda], flows: [], oneoffs: [], fixed: [], settings, accounts,
    expenses: [cobro("c10", "2026-10-05", source), cobro("c11", "2026-11-05", source)] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  await recibos.locator('[data-recibo="debt_fin"]').first().click();
  const ficha = page.locator('.v4-sheet[data-sheet="deuda"]');
  await expect(ficha.getByTestId("deuda-cargo")).toHaveAttribute("data-acredita", "0");
  await expect(ficha.getByTestId("deuda-nota")).toHaveText("El banco cobró 0,07 € más que la cuota.");
  // Octubre también duda: la ficha de ese mes habría salido igual, con sus botones.
  expect(await meses(page)).toEqual({ 10: { acredita: false, motivo: "importe" }, 11: { acredita: false, motivo: "importe" } });
  return ficha;
}
// Lo que pinta la ficha de cada mes (`deudaCargoEnlazado`, que lee `debtPaymentState`) el último día de ese mes.
const meses = (page) => page.evaluate(() => {
  const s = loadState(), d = s.debts.find((x) => x.id === "fin"), o = {};
  for (const [m, dia] of [[10, 31], [11, 28]]) { const c = deudaCargoEnlazado(s, d, 2026, m, dia); o[m] = c && { acredita: c.acredita, motivo: c.motivo }; }
  return o;
});
const pagados = { 10: { acredita: true, motivo: null }, 11: { acredita: true, motivo: null } };

for (const source of ["ob", "macrodroid"]) {
  test(`${source}: «Sí, es la cuota» deja pagados octubre y noviembre`, async ({ page }) => {
    const ficha = await abre(page, source);
    await ficha.locator('[data-act="es-cuota"]').click();
    await expect(ficha.getByTestId("deuda-cargo")).toHaveAttribute("data-acredita", "1");
    // Pagada con otro importe se dice lo previsto, como en los recibos; los botones se van.
    await expect(ficha.getByTestId("deuda-nota")).toHaveText("Esperabas 158,53 €");
    await expect(ficha.locator('[data-act="es-cuota"]')).toHaveCount(0);
    await expect.poll(() => meses(page)).toEqual(pagados);
    const s = await page.evaluate(() => loadState());
    expect(s.debts[0].monthly).toBe(158.53);
    expect(s.expenses.filter((e) => e.debtId === "fin" && e.debtManual).map((e) => e.id).sort()).toEqual(["c10", "c11"]);
  });

  test(`${source}: «Cambiar la cuota a 158,60 €» pide confirmación y cuadra los dos meses`, async ({ page }) => {
    const ficha = await abre(page, source);
    await ficha.locator('[data-act="cambiar-cuota"]').click();
    const dlg = page.getByText("¿Cambiar la cuota a 158,60 €?");
    await expect(dlg).toBeVisible();
    await page.getByRole("button", { name: "Cambiar", exact: true }).click();
    await expect(ficha.getByTestId("deuda-cargo")).toHaveAttribute("data-acredita", "1");
    await expect(ficha.getByTestId("deuda-nota")).toHaveCount(0);
    await expect.poll(() => meses(page)).toEqual(pagados);
    const d = await page.evaluate(() => loadState().debts.find((x) => x.id === "fin"));
    expect(d.monthly).toBe(158.6);
    // Sin `amort` aparte, la cuota es lo que amortiza: no queda una bajada vieja de 158,53.
    expect(d.amort === undefined || d.amort === 158.6).toBe(true);
  });
}
