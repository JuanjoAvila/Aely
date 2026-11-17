import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* «¿Te llega?» con la cifra correcta en los dos fallos de dinero de la ronda 237. Datos inventados;
   reloj del 16/11/2026. Dos bancos de recibos: Sabadell y CaixaBank, los dos a mano y sin lectura.
   1) La luz de 54,26 € se cobra como «IBERDROLA CLIENTES SAU», sin «recibo»: antes salía «No ha
      llegado» y el recorrido la restaba otra vez (el mínimo, 54,26 € más bajo).
   2) El alquiler de 650 € ya pagado y ya restado del «Tienes hoy» de CaixaBank volvía a restarse en
      «Pagado, aún sin restar del saldo»: «Falta 34 €» donde lo justo es 616,10 €. */
const r = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const fila = (id, date, amount, ent, merchant, category) => ({ id: "g-" + id, extId: id, ent, date: date + "T10:00:00.000Z", amount, merchant, obName: merchant, source: "ob", status: "BOOK", category });
const estado = {
  __seedOnce: true, lastBackup: "2026-11-16", _dynBalAnchored: true,
  accounts: [
    { id: "sab", ent: "sabadell", name: "Cuenta Sintética", role: "fijos", value: 900 },
    { id: "cxa", ent: "caixabank", name: "Cuenta Nómina", role: "fijos", value: 1520 },
  ],
  fixed: [
    r("luz", "Luz", 54.26, 8, { category: "luz" }),
    r("agua", "Agua", 30, 25),
    r("alq", "Alquiler", 650, 1, { account: "caixabank" }),
    r("seg", "Seguro hogar", 64.9, 28, { account: "caixabank" }),
  ],
  debts: [{ id: "d1", name: "Préstamo coche", monthly: 189, day: 5, account: "caixabank", value: 5000, asOf: 2026 * 12 + 10 }],
  oneoffs: [], flows: [], investments: [], assets: [],
  bankTx: [{ id: "t-luz", ent: "sabadell", date: "2026-11-08", amount: 54.26, merchant: "IBERDROLA CLIENTES SAU", concept: "IBERDROLA CLIENTES SAU", status: "BOOK" }],
  expenses: [fila("t-luz", "2026-11-08", 54.26, "sabadell", "IBERDROLA CLIENTES SAU", "luz"), fila("t-alq", "2026-11-01", 650, "caixabank", "ALQUILER PISO", "vivienda")],
  settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell", "caixabank"] },
};

async function abreRecibos(page) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-11-16T12:00:00+01:00") });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  await seedLoggedInDashboard(page, JSON.parse(JSON.stringify(estado)));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  await expect(recibos.getByTestId("plan-llega")).toBeVisible();
  return recibos;
}

test("«¿Te llega?»: la luz sin «recibo» está pagada y el alquiler ya restado no se resta otra vez", async ({ page }) => {
  const recibos = await abreRecibos(page);
  // Pendiente solo el agua y el seguro; la luz, en «Ya pagados» y no en «No ha llegado».
  await expect(recibos.getByTestId("plan-summary").locator(".pr6-big")).toHaveText("94,90 €");
  await expect(recibos.getByText("No ha llegado")).toHaveCount(0);
  const pill = recibos.getByTestId("plan-llega");
  await expect(pill).toHaveClass(/\bok\b/);
  await expect(pill).not.toContainText("Falta");

  await pill.click();
  const hoja = page.getByTestId("llega-sheet");
  await expect(hoja).toBeVisible();
  // CaixaBank: 1.520 − 650 − 189 = 681; queda el seguro de 64,90 → 616,10 el 28.
  const cxa = hoja.locator('[data-testid="llega-banco"][data-bank="caixabank"]');
  await expect(cxa).toContainText("Tienes hoy681,00 €");
  await expect(cxa).toContainText("Recibos que faltan− 64,90 €");
  await expect(cxa.getByText("Pagado, aún sin restar del saldo")).toHaveCount(0);
  await expect(cxa.getByTestId("llega-cifra")).toHaveText("lo más justo, el 28616,10 €");
  // Sabadell: 900 − 54,26 = 845,74; queda el agua de 30 → 815,74 el 25 (antes, 761,48).
  const sab = hoja.locator('[data-testid="llega-banco"][data-bank="sabadell"]');
  await expect(sab).toContainText("Tienes hoy845,74 €");
  await expect(sab).toContainText("Recibos que faltan− 30,00 €");
  await expect(sab.getByText("Pagado, aún sin restar del saldo")).toHaveCount(0);
  await expect(sab.getByTestId("llega-cifra")).toHaveText("lo más justo, el 25815,74 €");

  // El mínimo de Inicio y del widget sale de la misma lista: las mismas dos cifras.
  const mins = await page.evaluate(() => {
    const s = mcLoadRaw(mcStateKey()), i = insumosSaldoGasto(s);
    const de = (ent) => Math.round(minWalk(saldoCuentaMostrada(s.accounts.find((a) => a.ent === ent), i), bankPendingEvents(s, ent, 2026, 11, 16)).min * 100);
    return [de("caixabank"), de("sabadell")];
  });
  expect(mins).toEqual([61610, 81574]);
});
