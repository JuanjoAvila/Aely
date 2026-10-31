import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos v6, tanda 3 (docs/design/plan-recibos/SPEC.md §4 y §14): la hoja «¿Te llega?».
   Recorrido día a día con una entrada a mitad de mes, el aviso de cuánto pasar y antes de qué día,
   banco sin saldo → «—», frescura de la lectura, «¿Y si gasto…?» y editar la nómina. Todo sale del
   estado sembrado con el reloj fijo (10/10/2026): se mira el DOM, no el código. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const cuenta = (value) => [{ id: "bank", ent: "sabadell", role: "fijos", value }];
const recibo = (id, name, amount, day, account) => ({ id, name, amount, freq: "mes", day, account: account || "sabadell" });
const nomina = (day, extra) => Object.assign({ id: "nom", kind: "income", name: "Nómina", amount: 1000, to: "sabadell", day }, extra);
const HOY = "2026-10-10T12:00:00+02:00";
const eurTxt = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

async function abrePlan(page, overrides) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date(HOY) });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-10-10", bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], settings, accounts: cuenta(500) }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
async function abreLlega(page, recibos) {
  await recibos.getByTestId("plan-llega").click();
  const hoja = page.getByTestId("llega-sheet");
  await expect(hoja).toBeVisible();
  return hoja;
}
const teclea = async (zona, teclas) => { for (const k of teclas) await zona.locator(".v4-keys button", { hasText: new RegExp("^" + (k === "⌫" ? "⌫" : k) + "$") }).click(); };
const saldoVisto = (page) => page.evaluate(() => { const s = mcLoadRaw(mcStateKey()), i = insumosSaldoGasto(s); return s.accounts.map((a) => +saldoCuentaMostrada(a, i).toFixed(2)); });
const nominaGuardada = (page) => page.evaluate(() => mcLoadRaw(mcStateKey()).flows.find((f) => f.id === "nom"));

test("recorrido con la nómina a mitad de mes: lo más justo es el día 15, antes de que entre", async ({ page }) => {
  // 500 → 200 (Luz, 15) → 1.200 (Nómina, 20) → 800 (Seguro, 25).
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz", 300, 15), recibo("seg", "Seguro", 400, 25)], flows: [nomina(20)] });
  await expect(recibos.getByTestId("plan-llega")).toHaveText(/Te llega/);
  const hoja = await abreLlega(page, recibos);
  const sab = hoja.locator('[data-testid="llega-banco"][data-bank="sabadell"]');
  await expect(hoja.getByTestId("llega-banco")).toHaveCount(1);
  await expect(sab.getByTestId("llega-cifra")).toHaveText("lo más justo, el 15200,00 €");
  await expect(sab).toContainText("Tienes hoy500,00 €");
  await expect(sab).toContainText("Recibos que faltan− 700,00 €");
  await expect(sab.getByTestId("llega-flow")).toHaveText(/Nómina · día 20\+ 1\.000,00 €/);
  await expect(sab.getByTestId("llega-tip")).toHaveCount(0);
  // Sin lectura del banco (cuenta a mano) no se inventa frescura.
  await expect(sab.getByTestId("llega-fresco")).toHaveCount(0);

  // ¿Y si gasto 250? El mínimo baja a −50 el mismo día 15: el bloque y la línea lo dicen en vivo.
  await hoja.getByTestId("llega-gasto-amt").click();
  const gasto = hoja.getByTestId("llega-gasto");
  await teclea(gasto, ["2", "5", "0"]);
  await expect(gasto.getByTestId("llega-gasto-txt")).toHaveText("No llega · faltan 50,00 €");
  await expect(sab.getByTestId("llega-cifra")).toHaveText("te faltan50,00 €");
  await teclea(gasto, ["⌫"]);
  await expect(gasto.getByTestId("llega-gasto-txt")).toHaveText("Llega · te quedan 175,00 €");
  await expect(sab.getByTestId("llega-cifra")).toHaveText("lo más justo, el 15175,00 €");
  // Con un solo banco con saldo no hay chips que elegir.
  await expect(gasto.locator(".chip")).toHaveCount(0);
});

test("la nómina llega tarde: falta, se dice cuánto pasar y antes de qué día", async ({ page }) => {
  // 500 → 200 (15) → −200 (25) y la nómina del 28 ya no lo salva.
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz", 300, 15), recibo("seg", "Seguro", 400, 25)], flows: [nomina(28)] });
  await expect(recibos.getByTestId("plan-llega")).toHaveText("Falta 200 €");
  const hoja = await abreLlega(page, recibos);
  const sab = hoja.locator('[data-testid="llega-banco"][data-bank="sabadell"]');
  await expect(sab.getByTestId("llega-cifra")).toHaveText("te faltan200,00 €");
  await expect(sab.getByTestId("llega-tip")).toHaveText("Pasa 200 € a Sabadell antes del 25");
  // La nómina cae después del último recibo: no mueve el mínimo y no sale.
  await expect(sab.getByTestId("llega-flow")).toHaveCount(0);
});

test("el mismo día primero sale y luego entra", async ({ page }) => {
  // 100 €; el 20 entra la nómina (500) y sale un traspaso (300). Guardados en ese orden, antes el
  // recorrido sumaba la nómina primero y decía que llegaba; saliendo primero baja a −200.
  const recibos = await abrePlan(page, {
    accounts: cuenta(100), fixed: [recibo("luz", "Luz", 50, 25)],
    flows: [nomina(20, { amount: 500 }), { id: "tr", kind: "transfer", name: "Paso a Revolut", amount: 300, from: "sabadell", to: "revolut", day: 20 }],
  });
  await expect(recibos.getByTestId("plan-llega")).toHaveText("Falta 200 €");
  const hoja = await abreLlega(page, recibos);
  const sab = hoja.locator('[data-testid="llega-banco"][data-bank="sabadell"]');
  await expect(sab.getByTestId("llega-tip")).toHaveText("Pasa 200 € a Sabadell antes del 20");
  await expect(sab).toContainText("Paso a Revolut · día 20− 300,00 €");
});

test("banco sin saldo enseña «—» y no entra en la píldora; el que se lee dice de cuándo es", async ({ page }) => {
  const hace2h = new Date(new Date(HOY).getTime() - 2 * 3600e3).toISOString();
  const recibos = await abrePlan(page, {
    fixed: [recibo("luz", "Luz", 300, 15), recibo("nfx", "Netflix", 900, 20, "revolut")],
    obBalAt: { "Banco Sabadell": hace2h },
  });
  // Revolut no tiene cuenta: sus 900 € no pueden decir «Falta».
  await expect(recibos.getByTestId("plan-llega")).toHaveText(/Te llega/);
  const hoja = await abreLlega(page, recibos);
  const rev = hoja.locator('[data-testid="llega-banco"][data-bank="revolut"]');
  await expect(rev.getByTestId("llega-cifra")).toHaveText("—");
  await expect(rev).toContainText("Tienes hoy—");
  await expect(rev.getByTestId("llega-tip")).toHaveCount(0);
  await expect(rev.getByTestId("llega-fresco")).toHaveCount(0);
  const sab = hoja.locator('[data-testid="llega-banco"][data-bank="sabadell"]');
  await expect(sab.getByTestId("llega-fresco")).toHaveText("saldo de hace 2 h");
  // «¿Y si gasto…?» solo ofrece bancos con saldo.
  await expect(hoja.getByTestId("llega-gasto").locator(".chip")).toHaveCount(0);
});

test("editar la nómina desde la hoja: el primer número sustituye, el día se mueve y el saldo no", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz", 300, 15), recibo("seg", "Seguro", 400, 25)], flows: [nomina(20)] });
  const antes = await saldoVisto(page);
  const hoja = await abreLlega(page, recibos);
  await hoja.getByTestId("llega-flow").click();
  const nd = page.getByTestId("nomina-sheet");
  await expect(nd).toBeVisible();
  await expect(nd.getByTestId("nomina-importe")).toHaveText("1.000,00 €");
  await expect(nd.getByTestId("nomina-dia")).toHaveText("día 20");
  await teclea(nd, ["1", "5", "0", "0"]);
  await expect(nd.getByTestId("nomina-importe")).toHaveText("1.500,00 €");
  await nd.locator('[data-act="dia-mas"]').click();
  await expect(nd.getByTestId("nomina-dia")).toHaveText("día 21");
  await nd.locator('[data-act="guardar"]').click();
  await expect(nd).toHaveCount(0);
  const f = await nominaGuardada(page);
  expect([f.amount, f.day, f.when]).toEqual([1500, 21, undefined]);
  const sab = hoja.locator('[data-testid="llega-banco"][data-bank="sabadell"]');
  await expect(sab.getByTestId("llega-flow")).toHaveText(/Nómina · día 21\+ 1\.500,00 €/);
  expect(await saldoVisto(page)).toEqual(antes);
});

test("un recibo vencido sin cobro acreditado es cargo de hoy: filas, cifra, píldora e Inicio cuadran", async ({ page }) => {
  // Decisión del dueño (revisión t3, B1). 800 €; Teléfono 30 del día 8 sin cargo del banco, Luz 300
  // (15), Coche 200 (18) y Seguro 400 (25): 800 − 30 hoy − 300 − 200 − 400 = −130 el 25. Antes el
  // recorrido daba el Teléfono por cobrado por fecha y decía «Pasa 100 €» con 930 € por pagar.
  const recibos = await abrePlan(page, { accounts: cuenta(800),
    fixed: [recibo("tel", "Teléfono", 30, 8), recibo("luz", "Luz", 300, 15), recibo("coche", "Coche", 200, 18), recibo("seg", "Seguro", 400, 25)] });
  await expect(recibos.getByTestId("plan-summary").locator(".pr6-big")).toHaveText("930,00 €");
  await expect(recibos.getByTestId("plan-llega")).toHaveText("Falta 130 €");
  const hoja = await abreLlega(page, recibos);
  const sab = hoja.locator('[data-testid="llega-banco"][data-bank="sabadell"]');
  await expect(sab).toContainText("Tienes hoy800,00 €");
  await expect(sab).toContainText("Recibos que faltan− 930,00 €");
  await expect(sab.getByTestId("llega-cifra")).toHaveText("te faltan130,00 €");
  await expect(sab.getByTestId("llega-tip")).toHaveText("Pasa 130 € a Sabadell antes del 25");
  // Inicio: el mismo saldo y el Teléfono como vencido sin pago acreditado, por su importe.
  await page.locator(".v4-sheet-back").first().click({ position: { x: 20, y: 20 } });
  await expect(hoja).toHaveCount(0);
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  const inicio = page.locator(".page-live").filter({ hasText: "Cargos vencidos" });
  await expect(inicio).toContainText("800,00 €");
  await expect(inicio).toContainText(/Teléfono\s*Sabadell · Sin pago acreditado\s*30,00 €/);
  expect(await saldoVisto(page)).toEqual([800]);
  // El mínimo que usa Inicio (`totals.minByBank`, el del widget y el mínimo diario) sale de la
  // misma lista de eventos que la hoja: −130 desde el mismo saldo.
  const min = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return minWalk(800, pendingWalkEvents(s, 2026, 10, 10).filter((e) => e.bank === "sabadell")).min; });
  expect(Math.round(min * 100)).toBe(-13000);
});

/* Revisión t3, segunda y tercera vuelta (28/10). 500 €, Luz 300 del día 5 que Plan pinta pagada,
   Seguro 150 del 20. Si el saldo es el del banco (lectura en `obBalAt`), cualquier cobro ya está
   en él: 500 − 150 = 350. En una cuenta a mano, solo lo que movió el saldo mostrado (el gasto
   marca confirmada); un aviso de Wallet, un BOOK o un gasto del banco sin enlazar no, y la Luz sigue restando HOY:
   500 − 300 − 150 = 50. En todos, el simulador («¿Me lo puedo permitir?») recorre la misma lista
   que la hoja y da el mismo mínimo. */
// Cuenta re-anclada por la sincronización (uid del banco) y su lectura de hoy.
const LECTURA = { obBalAt: { "Banco Sabadell": "2026-10-10T08:00:00Z" }, accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 500, bankUid: "sab-1" }] };
const BOOK = { bankTx: [{ id: "t1", ent: "sabadell", date: "2026-10-05", amount: 300, merchant: "Luz casa", status: "BOOK" }] };
const WALLET = { expenses: [{ id: "n1", date: "2026-10-05", merchant: "Luz casa", amount: 300, ent: "sabadell", category: "recibos", source: "wallet" }] };
const OBEXP = { expenses: [{ id: "o1", date: "2026-10-05", merchant: "Luz casa", amount: 300, ent: "sabadell", category: "recibos", source: "ob" }] };
for (const [como, extra, cifra, luz] of [
  ["BOOK con saldo del banco", Object.assign({}, BOOK, LECTURA), "lo más justo, el 20350,00 €"],
  ["Wallet con saldo del banco", Object.assign({}, WALLET, LECTURA), "lo más justo, el 20350,00 €"],
  ["marca confirmada en cuenta a mano", {}, "lo más justo, el 20350,00 €", { paidYm: 2026 * 12 + 10, paidDay: 5 }],
  ["gasto del banco sin enlazar en cuenta a mano", OBEXP, "lo más justo, el 2050,00 €"],
  ["Wallet en cuenta a mano", WALLET, "lo más justo, el 2050,00 €"],
  ["BOOK sin fila en cuenta a mano", BOOK, "lo más justo, el 2050,00 €"],
]) test("recibo cobrado por " + como + ": hoja y simulador dicen lo mismo", async ({ page }) => {
  const recibos = await abrePlan(page, Object.assign({
    fixed: [Object.assign(recibo("luz", "Luz casa", 300, 5), { category: "recibos" }, luz), recibo("seg", "Seguro hogar", 150, 20)] }, extra));
  await expect(recibos.getByTestId("plan-summary").locator(".pr6-big")).toHaveText("150,00 €");
  const hoja = await abreLlega(page, recibos);
  const sab = hoja.locator('[data-testid="llega-banco"][data-bank="sabadell"]');
  await expect(sab).toContainText("Tienes hoy500,00 €");
  await expect(sab.getByTestId("llega-cifra")).toHaveText(cifra);
  // Si aún resta, la hoja lo dice en su propia fila: Tienes hoy − filas = cifra (R4-1).
  const resta = cifra.endsWith("50,00 €") && !cifra.endsWith("350,00 €");
  await expect(sab.getByText("Pagado, aún sin restar del saldo")).toHaveCount(resta ? 1 : 0);
  if (resta) await expect(sab).toContainText("Pagado, aún sin restar del saldo− 300,00 €");
  const sim = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()), i = insumosSaldoGasto(s); return minWalk(saldoCuentaMostrada(s.accounts[0], i), bankPendingEvents(s, "sabadell", 2026, 10, 10)).min; });
  expect(eurTxt(sim)).toBe(cifra.replace(/^lo más justo, el 20/, ""));
});

/* Revisión t3, R4: Trade Republic. Su saldo lo trae el puente nativo (`applyTrCash`), que sella la
   lectura en la cuenta (`saldoLeidoAt`); para estados de antes del sello vale `lastTrSync` si el
   puente manda. Spotify 300 € del día 5 ya cobrado en TR (Plan: «cargo de Trade Republic»), Seguro
   150 € del 20: 500 − 150 = 350. Leído ANTES del pago (día 3), el cobro aún no está en el saldo y
   sigue restando, con su fila: 50. Hoja y simulador, iguales. */
const TR = (extraCuenta) => [Object.assign({ id: "tr", ent: "trade_republic", role: "fijos", value: 500 }, extraCuenta)];
const spotify = { expenses: [{ id: "x1", date: "2026-10-05", merchant: "Spotify casa", amount: 300, ent: "trade_republic", category: "recibos", source: "tr" }] };
for (const [como, extra, cifra] of [
  ["lectura del puente sellada hoy", { accounts: TR({ saldoLeidoAt: "2026-10-10T08:00:00Z" }) }, "lo más justo, el 20350,00 €"],
  ["estado de antes del sello (lastTrSync)", { accounts: TR(), lastTrSync: "2026-10-10T08:00:00Z", settings: Object.assign({}, settings, { brokersOn: ["trade_republic"] }) }, "lo más justo, el 20350,00 €"],
  ["lectura anterior al cobro", { accounts: TR({ saldoLeidoAt: "2026-10-03T08:00:00Z" }) }, "lo más justo, el 2050,00 €"],
  // R5-1: sellada a primera hora del mismo día del cobro (las 7:30 del 5): la prueba solo trae el
  // día, así que el cargo de la tarde puede no estar dentro. Sigue restando hasta el día siguiente.
  ["lectura de la mañana del mismo día del cobro", { accounts: TR({ saldoLeidoAt: "2026-10-05T05:30:00Z" }) }, "lo más justo, el 2050,00 €"],
  ["lectura del día siguiente al cobro", { accounts: TR({ saldoLeidoAt: "2026-10-06T05:30:00Z" }) }, "lo más justo, el 20350,00 €"],
]) test("Trade Republic, " + como + ": hoja y simulador dicen lo mismo", async ({ page }) => {
  const recibos = await abrePlan(page, Object.assign({
    fixed: [Object.assign(recibo("spo", "Spotify casa", 300, 5, "trade_republic"), { category: "recibos" }), recibo("seg", "Seguro hogar", 150, 20, "trade_republic")] }, spotify, extra));
  await expect(recibos.getByTestId("plan-summary").locator(".pr6-big")).toHaveText("150,00 €");
  const hoja = await abreLlega(page, recibos);
  const tr = hoja.locator('[data-testid="llega-banco"][data-bank="trade_republic"]');
  await expect(tr).toContainText("Tienes hoy500,00 €");
  await expect(tr.getByTestId("llega-cifra")).toHaveText(cifra);
  await expect(tr.getByText("Pagado, aún sin restar del saldo")).toHaveCount(cifra.endsWith("350,00 €") ? 0 : 1);
  const sim = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()), i = insumosSaldoGasto(s); return minWalk(saldoCuentaMostrada(s.accounts[0], i), bankPendingEvents(s, "trade_republic", 2026, 10, 10)).min; });
  expect(eurTxt(sim)).toBe(cifra.replace(/^lo más justo, el 20/, ""));
});

test("vencido sin cobro: el simulador dice lo mismo que la hoja", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz casa", 300, 5), recibo("seg", "Seguro hogar", 150, 20)] });
  const hoja = await abreLlega(page, recibos);
  const sab = hoja.locator('[data-testid="llega-banco"][data-bank="sabadell"]');
  await expect(sab).toContainText("Recibos que faltan− 450,00 €");
  await expect(sab.getByTestId("llega-cifra")).toHaveText("lo más justo, el 2050,00 €");
  const sim = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()), i = insumosSaldoGasto(s); return minWalk(saldoCuentaMostrada(s.accounts[0], i), bankPendingEvents(s, "sabadell", 2026, 10, 10)).min; });
  expect(eurTxt(sim)).toBe("50,00 €");
});

test("editar solo el importe de una nómina «último laborable» conserva la regla", async ({ page }) => {
  // Octubre de 2026: el último laborable es el viernes 30; el Seguro del 31 la deja dentro de la hoja.
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz", 300, 15), recibo("seg", "Seguro", 400, 31)], flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 1000, to: "sabadell", when: "last" }] });
  const hoja = await abreLlega(page, recibos);
  await expect(hoja.getByTestId("llega-flow")).toHaveText(/Nómina · día 30/);
  await hoja.getByTestId("llega-flow").click();
  const nd = page.getByTestId("nomina-sheet");
  await teclea(nd, ["9", "0", "0"]);
  await nd.locator('[data-act="guardar"]').click();
  await expect(nd).toHaveCount(0);
  const f = await nominaGuardada(page);
  expect([f.amount, f.when, f.day]).toEqual([900, "last", undefined]);
});
