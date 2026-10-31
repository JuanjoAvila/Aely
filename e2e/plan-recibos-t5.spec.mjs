import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos v6, tanda 5 (docs/design/plan-recibos/SPEC.md §5, §6 y §14): personas y recibos
   compartidos, «Te deben» y «Lo descuento» de una deuda. El caso es el del dueño (con cifras de
   prueba): un pack de móvil domiciliado a su nombre que paga a medias con la pareja y la familia,
   y la parte de la familia se descuenta de lo que le paga a su madre. Se mira el DOM y lo guardado. */
const YM = 2026 * 12 + 10;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const cuenta = [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }];
const recibo = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const mama = { id: "mama", name: "Mamá", monthly: 197, amort: 250, value: 5000, account: "sabadell", day: 20, asOf: YM - 1 };
const pepe = recibo("pepe", "Pepephone", 22, 20, { bankAmount: 85, reparto: [
  { id: "pe_pareja", n: "Pareja", via: "bizum", amt: 10 }, { id: "pe_fam", n: "Familia", via: "debt", debtId: "mama", amt: 53 }] });
const yt = recibo("yt", "YouTube Premium", 5, 22, { bankAmount: 30, reparto: [["pe_pareja", "Pareja", "bizum"], ["pe_dani", "Dani", "transfer"], ["pe_marta", "Marta", "transfer"],
  ["pe_alex", "Álex", "transfer"], ["pe_lucia", "Lucía", "transfer"]].map((x) => ({ id: x[0], n: x[1], via: x[2], amt: 5, auto: true })) });
const luz = recibo("luz", "Luz", 50, 19);

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
const guardado = async (page) => { await page.waitForTimeout(400); return page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return { fixed: s.fixed || [], debts: s.debts || [] }; }); };
const total = (recibos) => recibos.getByTestId("plan-summary").locator(".serif.num");
const fila = (recibos, id) => recibos.locator('[data-recibo="' + id + '"]');
const hoja = (page) => page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
const paso = (page, n) => hoja(page).locator('[data-rp4-paso="' + n + '"]');
const persona = (page) => page.locator('.v4-sheet[data-sheet="persona"]');
const teclea = async (zona, digits) => { for (const d of digits) await zona.locator('.v4-keys button[aria-label="' + d + '"]').click(); };
async function abreTodos(page, recibos) {
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Todos" }).click();
  await expect(page.locator("[data-bills-manage]")).toBeVisible();
}

test("tu parte en Plan, la cuota con lo que se descuenta y lo que sale del banco en «¿Te llega?»", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [pepe, yt, luz], debts: [mama] });
  // Tu parte: Pepephone 22 + YouTube 5 + Luz 50 + Mamá 250 (197 del banco + 53 de Pepephone).
  await expect(total(recibos)).toHaveText("327,00 €");
  await expect(fila(recibos, "fixed_pepe")).toContainText("22,00 €");
  await expect(fila(recibos, "fixed_yt")).toContainText("te han pagado 0 de 5");
  await expect(fila(recibos, "debt_mama")).toContainText("pagas 197,00 € + 53,00 € de Pepephone");
  await expect(fila(recibos, "debt_mama")).toContainText("250,00 €");
  // «¿Te llega?» cuenta lo que cobra el banco: 85 + 30 + 50 + 197 = 362 → quedan 2.638.
  await recibos.getByTestId("plan-llega").click();
  const sab = page.getByTestId("llega-sheet").locator('[data-testid="llega-banco"][data-bank="sabadell"]');
  await expect(sab).toContainText("Recibos que faltan− 362,00 €");
  await expect(sab.getByTestId("llega-cifra")).toHaveText("lo más justo, el 222.638,00 €");
  await page.keyboard.press("Escape");
  await page.goBack();
  await expect(page.getByTestId("llega-sheet")).toHaveCount(0);
  // Ficha de un compartido: arriba lo que cobra el banco, tu parte en su chip.
  await fila(recibos, "fixed_pepe").click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await expect(ficha.getByTestId("recibo-importe")).toHaveText("85,00 €");
  await expect(ficha.getByTestId("recibo-tu-parte")).toHaveText("Tu parte 22,00 €");
  await page.goBack();
  await fila(recibos, "fixed_luz").click();
  await expect(ficha.getByTestId("recibo-importe")).toHaveText("50,00 €");
  await expect(ficha.getByTestId("recibo-tu-parte")).toHaveCount(0);
  await page.goBack();
  // Deudas: la cuota con lo que paga Pepephone.
  await page.locator(".v4-seg-btn").filter({ hasText: "Deudas" }).click();
  await expect(page.locator('[data-debt-id="mama"]').getByTestId("debt-descuento")).toHaveText("pagas 197,00 € + 53,00 € de Pepephone");
});

test("Te deben: por persona, «Ya me lo ha pagado» y la familia (lo descuento) no sale", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [pepe, yt, luz], debts: [mama] });
  const pill = recibos.getByTestId("plan-deben");
  await expect(pill).toHaveText("Te deben 35,00 €");
  await pill.click();
  const sheet = page.getByTestId("deben-sheet");
  await expect(sheet.getByTestId("deben-persona")).toHaveCount(5);
  await expect(sheet).not.toContainText("Familia");
  const pareja = sheet.locator('[data-persona="pe_pareja"]');
  await expect(pareja).toContainText("Pepephone 10,00 € + YouTube Premium 5,00 €");
  await expect(pareja.getByTestId("deben-cifra")).toHaveText("15,00 €");
  await pareja.locator('[data-act="deben-pagado"]').click();
  await expect(pareja.locator('[data-act="deben-pagado"]')).toHaveAttribute("aria-pressed", "true");
  await expect(pill).toHaveText("Te deben 20,00 €");
  let s = await guardado(page);
  expect(s.fixed.find((f) => f.id === "pepe").repartoCobrado).toEqual({ [YM]: ["pe_pareja"] });
  expect(s.fixed.find((f) => f.id === "yt").repartoCobrado).toEqual({ [YM]: ["pe_pareja"] });
  for (const id of ["pe_dani", "pe_marta", "pe_alex", "pe_lucia"]) await sheet.locator('[data-persona="' + id + '"] [data-act="deben-pagado"]').click();
  await expect(sheet.getByTestId("deben-todos")).toBeVisible();
  await expect(pill).toHaveCount(0);
  // Deshacer una marca la devuelve a lo que debe.
  await sheet.locator('[data-persona="pe_dani"] [data-act="deben-pagado"]').click();
  await expect(pill).toHaveText("Te deben 5,00 €");
  await page.goBack();
  await expect(fila(recibos, "fixed_yt")).toContainText("te han pagado 4 de 5");
  // Ninguna cifra de Plan se mueve por cobrar a los demás: lo tuyo sigue siendo lo tuyo.
  await expect(total(recibos)).toHaveText("327,00 €");
});

test("añadir un recibo compartido: + Otra, a partes iguales, parte tecleada y tu parte", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [luz] });
  await abreTodos(page, recibos);
  await page.locator('[data-bills-manage] [data-act="bill-add"]').first().click();
  await paso(page, 0).locator('[data-rp4="name"]').fill("Fibra");
  await hoja(page).locator(".rp4-cta").click();
  await teclea(paso(page, 1), "85");
  await hoja(page).locator(".rp4-cta").click();
  await paso(page, 2).locator('[data-rp4-dia="20"]').click();
  await hoja(page).locator(".rp4-cta").click();
  await paso(page, 3).locator('[data-rp4-banco="sabadell"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await paso(page, 4).locator('[data-act="mas-opciones"]').click();
  await paso(page, 4).locator('[data-act="persona-otra"]').click();
  await persona(page).locator('[data-pe="name"]').fill("Pareja");
  await persona(page).locator('[data-act="persona-guardar"]').click();
  await expect(persona(page)).toHaveCount(0);
  const fp = paso(page, 4).locator(".rp5-row");
  await expect(fp).toHaveCount(1);
  await expect(fp.locator("[data-rp5-importe]")).toHaveText("42,50 €");
  await expect(paso(page, 4).getByTestId("rp5-tu-parte")).toHaveText("Tu parte42,50 €");
  await fp.locator("[data-rp5-importe]").click();
  await teclea(fp, "10");
  await expect(paso(page, 4).getByTestId("rp5-tu-parte")).toHaveText("Tu parte75,00 €");
  await hoja(page).locator(".rp4-cta").click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await guardado(page);
  const f = s.fixed.find((x) => x.name === "Fibra");
  expect(f).toMatchObject({ amount: 75, bankAmount: 85, freq: "mes", day: 20 });
  expect(f.reparto).toEqual([{ id: expect.stringMatching(/^pe_/), n: "Pareja", via: "bizum", amt: 10 }]);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(fila(recibos, "fixed_" + f.id)).toContainText("75,00 €");
  await expect(total(recibos)).toHaveText("125,00 €");
  await expect(recibos.getByTestId("plan-deben")).toHaveText("Te deben 10,00 €");
});

test("Personas: renombrar, «Lo descuento» con una deuda que cuadra y borrar con confirmación", async ({ page }) => {
  const plana = { id: "mama", name: "Mamá", monthly: 250, value: 5000, account: "sabadell", day: 20, asOf: YM - 1 };
  const recibos = await abrePlan(page, { fixed: [recibo("pepe", "Pepephone", 85, 20), luz], debts: [plana] });
  await abreTodos(page, recibos);
  await page.locator('[data-bills-manage] [data-group="people"]').click();
  await page.locator('[data-act="persona-add"]').click();
  await persona(page).locator('[data-pe="name"]').fill("Familia");
  await persona(page).locator('[data-pe="via"] button', { hasText: "Lo descuento" }).click();
  await persona(page).locator('[data-pe="deuda"] button', { hasText: "Mamá" }).click();
  await persona(page).locator('[data-pe="recibos"] button', { hasText: "Pepephone" }).click();
  await persona(page).locator('[data-act="persona-guardar"]').click();
  await expect(persona(page)).toHaveCount(0);
  let s = await guardado(page);
  // A partes iguales: 42,50 cada uno; la cuota que sale del banco baja a 207,50 y amortiza 250.
  expect(s.fixed.find((f) => f.id === "pepe")).toMatchObject({ amount: 42.5, bankAmount: 85 });
  expect(s.debts[0]).toMatchObject({ monthly: 207.5, amort: 250 });
  const lista = page.getByTestId("pe-lista");
  await expect(lista.locator('[data-persona]')).toHaveCount(1);
  await expect(lista).toContainText("Lo descuento · Mamá");
  // Renombrar.
  await lista.locator("[data-persona]").click();
  await persona(page).locator('[data-pe="name"]').fill("Familia Ávila");
  await persona(page).locator('[data-act="persona-guardar"]').click();
  await expect(lista).toContainText("Familia Ávila");
  // Borrar: el primer toque pide confirmación, tocar fuera la cancela.
  await lista.locator("[data-persona]").click();
  const borrar = persona(page).locator('[data-act="persona-borrar"]');
  await borrar.click();
  await expect(borrar).toHaveText("¿Seguro? Sale de todos sus recibos");
  await persona(page).locator("h2").click();
  await expect(borrar).toHaveText("Borrar");
  await borrar.click();
  await borrar.click();
  await expect(persona(page)).toHaveCount(0);
  s = await guardado(page);
  const f = s.fixed.find((x) => x.id === "pepe");
  expect([f.amount, f.bankAmount, f.reparto]).toEqual([85, undefined, undefined]);
  expect(s.debts[0].monthly).toBe(250);
  expect(s.debts[0].amort).toBeUndefined();
  await expect(lista.locator("[data-persona]")).toHaveCount(0);
});

test("un compartido de antes (sin decir con quién) no se convierte solo y su importe sigue bloqueado", async ({ page }) => {
  const viejo = recibo("pepe", "Pepephone", 22, 20, { bankAmount: 85 });
  const recibos = await abrePlan(page, { fixed: [viejo, luz] });
  await expect(total(recibos)).toHaveText("72,00 €");
  await expect(recibos.getByTestId("plan-deben")).toHaveCount(0);
  await abreTodos(page, recibos);
  await page.locator('[data-bills-manage] [data-group="serv"]').click();
  await page.locator('[data-bill-id="pepe"]').click();
  await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
  await expect(paso(page, 4).locator('[data-rp4-fila="1"]')).toBeDisabled();
  await expect(paso(page, 4).getByTestId("rp5-tu-parte")).toHaveText("Tu parte22,00 €");
  await paso(page, 4).locator('[data-rp4-fila="0"]').click();
  await paso(page, 0).locator('[data-rp4="name"]').fill("Pepephone pack");
  await hoja(page).locator(".rp4-cta").click();
  await hoja(page).locator(".rp4-cta").click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await guardado(page);
  expect(s.fixed.find((x) => x.id === "pepe")).toEqual(Object.assign({}, viejo, { name: "Pepephone pack" }));
});
