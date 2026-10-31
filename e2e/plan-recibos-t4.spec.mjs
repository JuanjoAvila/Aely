import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos v6, tanda 4 (docs/design/plan-recibos/SPEC.md §7 y §14): añadir por pasos (los
   cinco, «Solo una vez», «En varios pagos», «Visto en tu banco» y el aviso de duplicado) y editar
   con «Solo octubre / Desde ahora», sin reescribir un mes ya pagado. Se mira el DOM y lo que
   queda guardado, no el código. */
const YM = 2026 * 12 + 10;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const cuenta = [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }];
const recibo = (id, name, amount, day) => ({ id, name, amount, freq: "mes", day, account: "sabadell" });
const gasto = (id, merchant, date, amount, category) => ({ id, merchant, date, amount, ent: "sabadell", category: category || "otros", source: "ob" });
const prueba = (f, x) => ({ kind: "expense", key: "sabadell|" + x.date + "|" + x.amount + "|" + x.merchant,
  identity: JSON.stringify(["sabadell", x.date, x.amount, x.merchant]), expenseId: x.id,
  expenseKey: x.date + "|" + x.amount + "|" + x.merchant, expenseLegacyKey: x.date + "|" + x.amount + "|" + x.merchant,
  date: x.date, bank: "sabadell", amount: x.amount, model: JSON.stringify([f.id, "sabadell", f.amount, null]),
  modelVersion: 2, receiptId: f.id, receiptName: f.name });

async function abrePlan(page, overrides) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-18T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-10-18", bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], settings, accounts: cuenta }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
const guardado = async (page) => { await page.waitForTimeout(400); return page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return { fixed: s.fixed || [], oneoffs: s.oneoffs || [] }; }); };
const hoja = (page) => page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
const paso = (page, n) => hoja(page).locator('[data-rp4-paso="' + n + '"]');
const teclea = async (page, n, digits) => { for (const d of digits) await paso(page, n).locator('.v4-keys button[aria-label="' + d + '"]').click(); };
const siguiente = (page) => hoja(page).locator(".rp4-cta");
async function abreAlta(page, recibos) {
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Todos" }).click();
  await page.locator('[data-bills-manage] [data-act="bill-add"]').first().click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
}
const total = (recibos) => recibos.getByTestId("plan-summary").locator(".serif.num");

test("añadir: los cinco pasos, el primer número sustituye y el recibo sale en Pendiente", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz", 50, 28)] });
  await expect(total(recibos)).toHaveText("50,00 €");
  await abreAlta(page, recibos);
  await expect(siguiente(page)).toBeDisabled();
  await paso(page, 0).locator('[data-rp4="name"]').fill("Agua casa");
  await siguiente(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  await teclea(page, 1, "3275");
  await expect(paso(page, 1).locator('[data-rp4="amount"]')).toHaveText("3.275,00 €");
  // Atrás del sistema vuelve un paso y no cierra la hoja.
  await siguiente(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "2");
  await page.goBack();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  // Al volver al importe, el primer número tecleado sustituye al que había.
  await hoja(page).locator('[data-act="back"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  await siguiente(page).click();
  await teclea(page, 1, "32");
  await expect(paso(page, 1).locator('[data-rp4="amount"]')).toHaveText("32,00 €");
  await siguiente(page).click();
  await expect(siguiente(page)).toBeDisabled();
  await paso(page, 2).locator('[data-rp4-dia="25"]').click();
  await siguiente(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "3");
  await paso(page, 3).locator('[data-rp4-banco="sabadell"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await expect(paso(page, 4).locator('[data-rp4="sum-amt"]')).toHaveText("32,00 €");
  await expect(paso(page, 4).locator(".rp4-row-v")).toHaveText(["Agua casa", "32,00 €", "25 · cada mes", "Sabadell"]);
  await siguiente(page).click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await guardado(page);
  const nuevo = s.fixed.find((f) => f.name === "Agua casa");
  expect(nuevo).toMatchObject({ amount: 32, freq: "mes", day: 25, account: "sabadell" });
  expect(nuevo.soloMes).toBeUndefined();
  await page.keyboard.press("Escape");
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_' + nuevo.id + '"]')).toContainText("32,00 €");
  await expect(total(recibos)).toHaveText("82,00 €");
});

test("añadir: «Solo una vez» es un cargo puntual de ese mes y no suma en octubre", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz", 50, 28)] });
  await abreAlta(page, recibos);
  await paso(page, 0).locator('[data-rp4="name"]').fill("ITV coche");
  await siguiente(page).click();
  await teclea(page, 1, "45,5");
  await siguiente(page).click();
  await paso(page, 2).locator('[data-rp4-modo="once"]').click();
  await expect(paso(page, 2).locator('[data-rp4-modo="once"]')).toHaveAttribute("aria-checked", "true");
  await paso(page, 2).locator(".rp4-mes", { hasText: /^nov$/i }).click();
  // Arranca en el día de hoy (18): dos «−» lo dejan en el 16.
  await paso(page, 2).getByRole("button", { name: "Un día antes" }).click();
  await paso(page, 2).getByRole("button", { name: "Un día antes" }).click();
  await expect(paso(page, 2).locator('[data-rp4="dia"]')).toHaveText("día 16");
  await siguiente(page).click();
  await paso(page, 3).locator('[data-rp4-banco="sabadell"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await expect(paso(page, 4).locator(".rp4-row-v").nth(2)).toHaveText(/^16 nov$/i);
  await siguiente(page).click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await guardado(page);
  expect(s.oneoffs).toHaveLength(1);
  expect(s.oneoffs[0]).toMatchObject({ name: "ITV coche", amount: 45.5, month: 11, year: 2026, day: 16, account: "sabadell" });
  expect(s.fixed).toHaveLength(1);
  await page.keyboard.press("Escape");
  await expect(total(recibos)).toHaveText("50,00 €");
});

test("añadir: «En varios pagos» con Hacienda propone 60 % el 30 jun y el resto el 5 nov", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz", 50, 28)] });
  await abreAlta(page, recibos);
  await paso(page, 0).locator('[data-rp4-sug="hacienda"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  await teclea(page, 1, "1000");
  await siguiente(page).click();
  await expect(paso(page, 2).locator('[data-rp4-modo="split"]')).toHaveAttribute("aria-checked", "true");
  const pagos = paso(page, 2).locator(".rp4-pago");
  await expect(pagos).toHaveCount(2);
  await expect(pagos.nth(0).locator(".rp4-pago-f")).toHaveText(/^30 jun$/i);
  await expect(pagos.nth(0).locator('[data-rp4-importe="0"]')).toHaveText("600,00 €");
  await expect(pagos.nth(1).locator(".rp4-pago-f")).toHaveText(/^5 nov$/i);
  await expect(pagos.nth(1).locator('[data-rp4="resto"]')).toHaveText("400,00 €");
  // Junio ya está cogido por el primer pago: no se puede repetir mes.
  await expect(pagos.nth(1).locator(".rp4-mes", { hasText: /^jun$/i })).toBeDisabled();
  await siguiente(page).click();
  await paso(page, 3).locator('[data-rp4-banco="sabadell"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await expect(paso(page, 4).locator(".rp4-row-v").nth(1)).toHaveText("1.000,00 € en 2 pagos");
  await siguiente(page).click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await guardado(page);
  const h = s.fixed.find((f) => f.name === "Hacienda");
  expect(h).toMatchObject({ freq: "año", amount: 1000, category: "tasas", schedule: [{ m: 6, day: 30, amt: 600 }, { m: 11, day: 5, amt: 400 }] });
  await page.keyboard.press("Escape");
  // En octubre no toca ningún pago.
  await expect(total(recibos)).toHaveText("50,00 €");
});

test("añadir: «Visto en tu banco» rellena todo y el duplicado lleva a editar el que ya existe", async ({ page }) => {
  const pod = ["2026-08-07", "2026-09-07", "2026-10-07"].map((d, i) => gasto("p" + i, "PODCAST PLUS", d, 7.99, "ocio"));
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz", 50, 28)], expenses: pod });
  await abreAlta(page, recibos);
  const visto = paso(page, 0).getByTestId("rp4-visto");
  await expect(visto.locator("[data-rp4-visto]")).toHaveCount(1);
  await expect(visto.locator("[data-rp4-visto]")).toContainText("PODCAST PLUS");
  await expect(visto.locator("[data-rp4-visto]")).toContainText("7,99 €");
  await visto.locator("[data-rp4-visto]").click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await expect(paso(page, 4).locator(".rp4-row-v")).toHaveText(["PODCAST PLUS", "7,99 €", "7 · cada mes", "Sabadell"]);
  await siguiente(page).click();
  await expect(hoja(page)).toHaveCount(0);
  let s = await guardado(page);
  expect(s.fixed.find((f) => f.name === "PODCAST PLUS")).toMatchObject({ amount: 7.99, day: 7, freq: "mes", account: "sabadell" });
  // Ya es recibo: deja de proponerse. Y escribir un nombre que ya existe avisa.
  await page.locator('[data-bills-manage] [data-act="bill-add"]').first().click();
  await expect(paso(page, 0).getByTestId("rp4-visto")).toHaveCount(0);
  await paso(page, 0).locator('[data-rp4="name"]').fill("Lu");
  await expect(paso(page, 0).locator('[data-rp4="dup"]')).toHaveCount(0);
  await paso(page, 0).locator('[data-rp4="name"]').fill("Luz");
  await expect(paso(page, 0).locator('[data-rp4="dup"]')).toContainText("Ya tienes Luz");
  await paso(page, 0).locator('[data-rp4="dup"]').click();
  await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await expect(paso(page, 4).locator(".rp4-row-v").first()).toHaveText("Luz");
  s = await guardado(page);
  expect(s.fixed.filter((f) => f.name === "Luz")).toHaveLength(1);
});

test("editar: «Solo octubre» cambia este mes y nada más; «Desde ahora» cambia el recibo", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz", 50, 28), recibo("gas", "Gas", 30, 26)] });
  await expect(total(recibos)).toHaveText("80,00 €");
  await recibos.getByTestId("plan-due").locator('[data-recibo="fixed_luz"]').click();
  await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
  await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
  await expect(paso(page, 4).getByTestId("rp4-scope")).toHaveCount(0);
  await paso(page, 4).locator('[data-rp4-fila="1"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  await teclea(page, 1, "80");
  await expect(paso(page, 1).locator('[data-rp4="amount"]')).toHaveText("80,00 €");
  await siguiente(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  const scope = paso(page, 4).getByTestId("rp4-scope");
  await expect(scope.locator("button")).toHaveText(["Solo octubre", "Desde ahora"]);
  await scope.getByRole("radio", { name: "Solo octubre" }).click();
  await siguiente(page).click();
  await expect(hoja(page)).toHaveCount(0);
  let s = await guardado(page);
  let luz = s.fixed.find((f) => f.id === "luz");
  expect(luz.amount).toBe(50);
  expect(luz.soloMes).toEqual({ [YM]: { amt: 80 } });
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_luz"]')).toContainText("80,00 €");
  await expect(total(recibos)).toHaveText("110,00 €");
  // «Desde ahora» en el gas: cambia el recibo y no deja nada aparte.
  await recibos.getByTestId("plan-due").locator('[data-recibo="fixed_gas"]').click();
  await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
  await paso(page, 4).locator('[data-rp4-fila="2"]').click();
  await paso(page, 2).locator('[data-rp4-dia="27"]').click();
  await siguiente(page).click();
  await expect(paso(page, 4).getByTestId("rp4-scope").getByRole("radio", { name: "Desde ahora" })).toHaveAttribute("aria-checked", "true");
  await siguiente(page).click();
  await expect(hoja(page)).toHaveCount(0);
  s = await guardado(page);
  const gas = s.fixed.find((f) => f.id === "gas");
  expect(gas).toMatchObject({ amount: 30, day: 27 });
  expect(gas.soloMes).toBeUndefined();
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_gas"] .dt .d')).toHaveText("27");
  await expect(total(recibos)).toHaveText("110,00 €");
});

test("editar un recibo ya pagado este mes: no pregunta y el mes pagado no se reescribe", async ({ page }) => {
  const x = gasto("g10", "PAGO TPV 88", "2026-10-03", 30, "otros");
  const gym = Object.assign(recibo("gym", "Gimnasio", 30, 3), { paymentProofs: {} });
  gym.paymentProofs[YM] = prueba(gym, x);
  const recibos = await abrePlan(page, { fixed: [gym, recibo("luz", "Luz", 50, 28)], expenses: [x] });
  await expect(total(recibos)).toHaveText("50,00 €");
  const pagados = recibos.getByTestId("plan-paid");
  await pagados.locator(".pr6-paid-h").click();
  await pagados.locator('[data-recibo="fixed_gym"]').click();
  await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
  await paso(page, 4).locator('[data-rp4-fila="1"]').click();
  await teclea(page, 1, "35");
  await siguiente(page).click();
  await expect(paso(page, 4).getByTestId("rp4-scope")).toHaveCount(0);
  await siguiente(page).click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await guardado(page);
  const g = s.fixed.find((f) => f.id === "gym");
  expect(g.amount).toBe(35);
  expect(g.soloMes).toEqual({ [YM]: { amt: 30 } });
  expect(g.paymentProofs[YM].amount).toBe(30);
  await expect(total(recibos)).toHaveText("50,00 €");
  await expect(pagados.locator('[data-recibo="fixed_gym"]')).toContainText("30,00 €");
  await expect(recibos.getByTestId("plan-review")).toHaveCount(0);
});

test("editar: «Ya no lo tengo» pide un segundo toque y tocar fuera lo cancela", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz", 50, 28), recibo("gas", "Gas", 30, 26)] });
  await recibos.getByTestId("plan-due").locator('[data-recibo="fixed_gas"]').click();
  await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
  const quitar = paso(page, 4).locator('[data-act="bill-remove"]');
  await quitar.click();
  await expect(quitar).toHaveText("¿Seguro? Borrar");
  await paso(page, 4).locator(".pr6-ficha-n").click();
  await expect(quitar).toHaveText("Ya no lo tengo");
  await quitar.click();
  await quitar.click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await guardado(page);
  expect(s.fixed.map((f) => f.id)).toEqual(["luz"]);
});
