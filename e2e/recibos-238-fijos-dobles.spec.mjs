import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Dos cuentas de recibos del MISMO banco (ronda 238, revisión de dinero 237 R2). Datos inventados;
   reloj del 16/11/2026. Sabadell tiene la corriente (1.000) y la de ahorro (500), las dos «fijos»;
   el Teléfono de 30 € del día 8 no tiene cobro en el extracto y el calendario lo da por restado.
   Antes cada cuenta se restaba el neto del banco entero y además ese neto llegaba doble: 970 − 30
   y 500 − 60, «Tienes hoy» 1.380 € donde lo justo es 1.470 €. CaixaBank, de control, una sola cuenta.
   Dos partidas: un estado ya en la regla nueva, y uno guardado por la versión vieja (sin
   `_netoUnaCuenta`, la Corriente y la Ahorro tecleadas 970 y 500 → 1.030 y 560): al abrir, la
   migración de una vez tiene que pintar lo mismo que pintaba ayer (revisión 238, P1). */
const r = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const estado = {
  __seedOnce: true, lastBackup: "2026-11-16", _dynBalAnchored: true, _netoUnaCuenta: true,
  accounts: [
    { id: "sb1", ent: "sabadell", name: "Corriente", role: "fijos", value: 1000 },
    { id: "sb2", ent: "sabadell", name: "Ahorro", role: "fijos", value: 500 },
    { id: "cx", ent: "caixabank", name: "Nómina", role: "fijos", value: 800 },
  ],
  fixed: [r("tel", "Teléfono", 30, 8), r("seg", "Seguro", 150, 20), r("luz", "Luz", 40, 25, { account: "caixabank" })],
  debts: [], oneoffs: [], flows: [], investments: [], assets: [], bankTx: [], expenses: [],
  settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell", "caixabank"] },
};

const viejo = JSON.parse(JSON.stringify(estado));
delete viejo._netoUnaCuenta; viejo.accounts[0].value = 1030; viejo.accounts[1].value = 560;

for (const [nombre, semilla] of [["estado nuevo", estado], ["guardado por la versión vieja", viejo]])
test("dos cuentas de recibos del mismo banco (" + nombre + "): el Teléfono se resta una vez en Cartera y en «¿Te llega?»", async ({ page }) => {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-11-16T12:00:00+01:00") });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  await seedLoggedInDashboard(page, JSON.parse(JSON.stringify(semilla)));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);

  // Cartera: la corriente carga el neto del banco (970) y la de ahorro enseña lo suyo (500).
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator('.page-live button.v4-mov[data-account-id="sb1"]')).toContainText("970,00 €");
  await expect(page.locator('.page-live button.v4-mov[data-account-id="sb2"]')).toContainText("500,00 €");
  await expect(page.locator('.page-live button.v4-mov[data-account-id="cx"]')).toContainText("800,00 €");

  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  const pill = recibos.getByTestId("plan-llega");
  await expect(pill).toBeVisible();
  await expect(pill).toHaveClass(/\bok\b/);
  await pill.click();
  const hoja = page.getByTestId("llega-sheet");
  await expect(hoja).toBeVisible();
  // Sabadell: 1.000 + 500 − 30 = 1.470 hoy; queda el Seguro de 150 → 1.320 el 20 (antes 1.380 y 1.230).
  const sab = hoja.locator('[data-testid="llega-banco"][data-bank="sabadell"]');
  await expect(sab).toContainText("Tienes hoy1.470,00 €");
  await expect(sab.getByTestId("llega-cifra")).toHaveText("lo más justo, el 201.320,00 €");
  const cxa = hoja.locator('[data-testid="llega-banco"][data-bank="caixabank"]');
  await expect(cxa).toContainText("Tienes hoy800,00 €");
  await expect(cxa.getByTestId("llega-cifra")).toHaveText("lo más justo, el 25760,00 €");

  // La píldora y el widget leen `minByBank`, que sale del mismo recorrido sobre la suma de Cartera.
  const mins = await page.evaluate(() => {
    const s = mcLoadRaw(mcStateKey()), i = insumosSaldoGasto(s);
    const banco = (ent) => s.accounts.filter((a) => a.ent === ent).reduce((n, a) => n + saldoCuentaMostrada(a, i), 0);
    return ["sabadell", "caixabank"].map((ent) => Math.round(minWalk(banco(ent), bankPendingEvents(s, ent, 2026, 11, 16)).min * 100));
  });
  expect(mins).toEqual([132000, 76000]);
  // La marca queda guardada: otra carga no vuelve a migrar.
  expect(await page.evaluate(() => mcLoadRaw(mcStateKey())._netoUnaCuenta)).toBe(true);
});
