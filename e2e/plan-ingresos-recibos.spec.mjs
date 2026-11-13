import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos: lo que entra y lo que mueves con el ciclo de un recibo (petición del dueño,
   12/11/2026: «sale en "Lo que aún entrará" y luego se pierde»). Lo que llega pasa a «Ya ha
   entrado» con su movimiento de Gastos; lo que no, sigue a la vista; la ficha deja elegirlo,
   rechazarlo o marcarlo a mano; y el alta es la misma hoja por pasos que un recibo. Datos inventados. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const mov = (id, ent, date, amount, merchant) => ({ id, extId: "b-" + id, ent, date: date + "T12:00:00.000Z", amount, merchant, obName: merchant,
  source: "ob", status: "BOOK", category: amount < 0 ? "ingreso" : "otros" });

async function abre(page, extra) {
  test.info().annotations.push({ type: "own-clock" });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.clock.install({ time: new Date("2026-11-26T12:00:00+01:00") });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-11-26",
    accounts: [{ id: "s", ent: "sabadell", role: "fijos", value: 1500 }, { id: "rv", ent: "revolut", role: "fijos", value: 300 }],
    fixed: [{ id: "luz", name: "Luz", amount: 50, freq: "mes", day: 28, account: "sabadell" }], debts: [], oneoffs: [],
    // El extracto trae el abono del 25: el saldo ya cuenta la nómina (la vista sigue al dinero).
    bankTx: [{ id: "b-nomina", ent: "sabadell", date: "2026-11-25", amount: -1850, merchant: "EMPRESA SINTETICA SL", status: "BOOK" }],
    flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 1850, to: "sabadell", day: 28 },
      { id: "tr", kind: "transfer", name: "A Revolut", amount: 200, from: "sabadell", to: "revolut", day: 15 }],
    // La nómina llegó el 25 (antes de su día); el traspaso del 15 no tiene movimiento exacto.
    expenses: [mov("nomina", "sabadell", "2026-11-25", -1850, "EMPRESA SINTETICA SL"), mov("rev", "revolut", "2026-11-16", -199, "TRASPASO RECIBIDO")],
    settings }, extra || {}));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}

test("lo que llega pasa a «Ya ha entrado» con su movimiento, y «No es este» lo devuelve", async ({ page }) => {
  const recibos = await abre(page);
  await expect(recibos.getByTestId("plan-income")).toHaveCount(0);
  const ent = recibos.getByTestId("plan-entrado");
  await expect(ent.locator(".pr6-paid-l")).toHaveText("Ya ha entrado");
  await expect(ent.getByTestId("plan-entrado-total")).toHaveText("+1.850,00 €");
  await ent.locator(".pr6-paid-h").click();
  const fila = ent.locator('[data-flujo="flow_nom"]');
  await expect(fila).toContainText("25");
  await expect(fila).toContainText("movimiento de Sabadell");
  await fila.click();
  const ficha = page.locator('.v4-sheet[data-sheet="flujo"]');
  await expect(ficha.getByTestId("flujo-mov")).toContainText("EMPRESA SINTETICA SL");
  await ficha.locator('[data-act="no-es"]').click();
  await expect(ficha.locator(".pr6-pick-t")).toHaveText("¿Cuál es el ingreso?");
  await ficha.locator('[data-act="aun-no"]').click();
  await expect(ficha).toHaveCount(0);
  await expect(recibos.getByTestId("plan-income").locator('[data-flujo="flow_nom"]')).toContainText("Sabadell");
  await expect(recibos.getByTestId("plan-entrado").locator('[data-flujo="flow_nom"]')).toHaveCount(0);
  // El rechazo viaja con el estado: el motor no lo vuelve a elegir.
  await expect.poll(() => page.evaluate(() => (loadState().reciboNo || []).some((k) => k.indexOf("flow:nom|") === 0))).toBe(true);
});

test("pasado su día sin movimiento está en «Ya ha entrado»; se le enlaza el suyo, Deshacer no veta y «Lo moví de otra forma»", async ({ page }) => {
  const recibos = await abre(page);
  // La vista sigue al dinero: el traspaso del 15 ya lo cuenta el saldo, así que no está en «aún».
  await expect(recibos.getByTestId("plan-transfers")).toHaveCount(0);
  const ent = recibos.getByTestId("plan-entrado");
  await ent.locator(".pr6-paid-h").click();
  const tr = ent.locator('[data-flujo="flow_tr"]');
  await expect(tr).toContainText("sin movimiento del banco");
  await tr.click();
  const ficha = page.locator('.v4-sheet[data-sheet="flujo"]');
  await expect(ficha.getByTestId("flujo-sin-mov")).toBeVisible();
  await ficha.locator('[data-act="elegir"]').click();
  await expect(ficha.locator(".pr6-pick-t")).toHaveText("¿Cuál es el movimiento?");
  await ficha.locator('[data-cargo="rev"]').click();
  await expect(ficha).toHaveCount(0);
  await expect(tr).toContainText("movimiento de Revolut");
  // El traspaso no suma a lo que ha entrado: no es dinero nuevo.
  await expect(ent.getByTestId("plan-entrado-total")).toHaveText("+1.850,00 €");
  await expect.poll(() => page.evaluate(() => loadState().flows.find((f) => f.id === "tr").llegadas[2026 * 12 + 11].expenseId)).toBe("rev");

  // Deshacer repone lo de antes y NO aparta el movimiento (eso es «No es este»).
  await page.getByTestId("plan-deshacer").getByRole("button").click();
  await expect(tr).toContainText("sin movimiento del banco");
  await expect.poll(() => page.evaluate(() => (loadState().reciboNo || []).filter((k) => k.indexOf("flow:tr|") === 0).length)).toBe(0);
  await tr.click();
  await ficha.locator('[data-act="elegir"]').click();
  await ficha.locator('[data-act="a-mano"]').click();
  await expect(tr).toContainText("marcado a mano");
});

test("el alta y la edición de lo que entra son la hoja por pasos de un recibo", async ({ page }) => {
  const recibos = await abre(page);
  await recibos.getByTestId("plan-todos").click();
  await page.locator('[data-act="bill-add-flow"]').first().click();
  const hoja = page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
  await expect(hoja).toHaveAttribute("data-modo", "add");
  await expect(hoja.locator('[data-rp4-tipo="income"]')).toHaveAttribute("aria-checked", "true");
  await hoja.locator('[data-rp4-sug="fl_s_pension"]').click();
  await expect(hoja).toHaveAttribute("data-paso", "1");
  for (const k of ["9", "0", "0"]) await hoja.locator('[data-rp4-paso="1"]').getByRole("button", { name: k, exact: true }).click();
  await hoja.locator(".rp4-cta").click();
  await hoja.locator('[data-rp4-paso="2"] [data-rp4-regla="last"]').click();
  // Cada 3 meses sin ningún mes no se puede guardar: se proyectaría todos los meses.
  await hoja.locator('[data-rp4-paso="2"] [data-rp4-freq="trimestral"]').click();
  const meses = hoja.locator('[data-rp4-paso="2"] .month-picker .mchip.on');
  while (await meses.count()) await meses.first().click();
  await expect(hoja.locator(".rp4-cta")).toHaveAttribute("aria-disabled", "true");
  await hoja.locator('[data-rp4-paso="2"] [data-rp4-freq="mes"]').click();
  await expect(hoja.locator(".rp4-cta")).toHaveAttribute("aria-disabled", "false");
  await hoja.locator(".rp4-cta").click();
  await hoja.locator('[data-rp4-paso="3"] [data-rp4-banco="revolut"]').click();
  await expect(hoja).toHaveAttribute("data-paso", "4");
  await expect(hoja.locator('[data-rp4-paso="4"]')).toContainText("Entra en");
  await hoja.locator(".rp4-cta").click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.stringify(loadState().flows.filter((f) => f.name === "Pensión").map((f) => [f.kind, f.amount, f.to, f.when, f.day || null]))))
    .toBe(JSON.stringify([["income", 900, "revolut", "last", null]]));

  // Editar un traspaso abre la misma hoja en el resumen, con de dónde sale y adónde va.
  await page.locator(".v4-bills-row").filter({ hasText: "A Revolut" }).click();
  await expect(hoja).toHaveAttribute("data-modo", "edit");
  await expect(hoja.locator('[data-rp4-paso="4"]')).toContainText("Va a");
  await expect(hoja.locator('[data-rp4-paso="4"]')).toContainText("Revolut");
});

/* Su prueba de la 230 (12/11/2026), con datos inventados: el traspaso del día 1 hecho el 30 del mes
   anterior sale con ESE movimiento y su fecha («30 oct»), su selector no enseña el agua ni una compra
   con tarjeta (solo tras «Más movimientos»), y en «Ya ha entrado» el total es la suma de lo que se ve
   en las filas: una entrada pagada a medias enseña lo que trajo el banco. */
test("230: el adelanto del 30 se enlaza solo, el selector de un traspaso no mezcla bancos y el total cuadra con las filas", async ({ page }) => {
  test.info().annotations.push({ type: "own-clock" });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.clock.install({ time: new Date("2026-11-12T12:00:00+01:00") });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-11-12",
    accounts: [{ id: "s", ent: "sabadell", role: "fijos", value: 1500 }, { id: "t", ent: "trade_republic", role: "fijos", value: 300 }],
    fixed: [{ id: "yt", name: "Vídeo", amount: 10, bankAmount: 15, freq: "mes", day: 2, account: "sabadell", reparto: [{ id: "pe_nora", n: "Nora", via: "transfer", amt: 5 }] }],
    debts: [], oneoffs: [], bankTx: [],
    flows: [{ id: "atr", kind: "transfer", name: "A Trade Republic", amount: 1200, from: "sabadell", to: "trade_republic", day: 1 },
      { id: "ynora", kind: "income", name: "Vídeo Nora", amount: 5, to: "sabadell", day: 3 },
      { id: "extra", kind: "income", name: "Clases", amount: 20, to: "sabadell", day: 5 }],
    expenses: [Object.assign(mov("llega", "trade_republic", "2026-10-30", -1200, "Traspaso recibido"), { category: "traspaso" }),
      Object.assign(mov("sale", "sabadell", "2026-10-30", 1200, "Leo Sastre Ruano"), { concept: "TRANSFERENCIA A LEO SASTRE RUANO" }),
      mov("agua", "sabadell", "2026-11-10", 81.29, "AGUA EJEMPLO"),
      mov("nora", "sabadell", "2026-11-03", -3.8, "TRANSFERENCIA NORA EJEMPLO")],
    settings: Object.assign({}, settings, { profile: { fullName: "Leo Sastre Ruano" } }) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  const ent = recibos.getByTestId("plan-entrado");
  await ent.locator(".pr6-paid-h").click();
  const tr = ent.locator('[data-flujo="flow_atr"]');
  await expect(tr).toContainText(/30 oct/i);
  await expect(tr).toContainText("movimiento de Trade Republic");
  const nora = ent.locator('[data-flujo="flow_ynora"]');
  await expect(nora.getByTestId("plan-entrado-importe")).toHaveText("+3,80 €");
  await expect(nora).toContainText("llegó 3,80 € de 5,00 €");
  // El total es la suma de las cifras de las filas de ingresos (3,80 + 20 sin movimiento).
  await expect(ent.getByTestId("plan-entrado-total")).toHaveText("+23,80 €");

  // El selector del traspaso: las dos patas de 1.200, y nada más a la vista.
  await tr.click();
  const ficha = page.locator('.v4-sheet[data-sheet="flujo"]');
  await expect(ficha.getByTestId("flujo-mov")).toContainText(/30 oct/i);
  await ficha.locator('[data-act="no-es"]').click();
  const movs = ficha.getByTestId("flujo-movs");
  await expect(movs.locator('[data-cargo="sale"]')).toBeVisible();
  await expect(movs.locator('[data-cargo="agua"]')).toHaveCount(0);
  await expect(ficha.locator(".pr6-lbl")).toHaveCount(0);
  await ficha.locator('[data-act="mas-movs"]').click();
  await expect(movs.locator('[data-cargo="agua"]')).toBeVisible();
});

/* Su prueba de la 4.26.231 (13/11/2026), con datos inventados: la entrada está en Trade Republic y el
   dinero llegó por Sabadell. El ingreso del importe exacto de otro banco tuyo sale arriba para elegirlo
   (sin anclar nada), aunque no case solo. */
test("231: el importe exacto que llegó por otro banco se puede elegir", async ({ page }) => {
  const recibos = await abre(page, {
    flows: [{ id: "cla", kind: "income", name: "Clases", amount: 20, to: "revolut", day: 10 }],
    expenses: [mov("aca", "sabadell", "2026-11-09", -20, "ACADEMIA EJEMPLO"), mov("otro", "revolut", "2026-11-12", -3, "INTERES")] });
  const ent = recibos.getByTestId("plan-entrado");
  await ent.locator(".pr6-paid-h").click();
  await ent.locator('[data-flujo="flow_cla"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="flujo"]');
  await ficha.locator('[data-act="elegir"]').click();
  const primero = ficha.getByTestId("flujo-movs").locator(".pr6-cand").first();
  await expect(primero).toHaveAttribute("data-cargo", "aca");
  await expect(primero).toContainText("Sabadell");
  await primero.click();
  await expect(ficha).toHaveCount(0);
  await expect(ent.locator('[data-flujo="flow_cla"]')).toContainText("movimiento de Sabadell");
  await expect.poll(() => page.evaluate(() => loadState().flows.find((f) => f.id === "cla").paidYm)).toBe(undefined);
  // La ficha dice que llegó a otro banco y ofrece cambiar la cuenta de la entrada (sin cambiarla sola).
  await ent.locator('[data-flujo="flow_cla"]').click();
  await expect(ficha.getByTestId("flujo-otro-banco")).toContainText("Llegó a Sabadell");
  await expect.poll(() => page.evaluate(() => loadState().flows.find((f) => f.id === "cla").to)).toBe("revolut");
  await ficha.locator('[data-act="cambiar-cuenta"]').click();
  await expect(page.locator('.v4-sheet[data-sheet="recibo-pasos"]')).toHaveAttribute("data-modo", "edit");
});
