import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* «Lo descuento» con una deuda que NO cuadra y «Baja la deuda al mes» en Editar deuda (feedback
   1/11/2026). El préstamo familiar se dio de alta con plazo y guardó como bajada saldo/plazo, no la
   cuota: al poner «Lo descuento» la cuota se pintaba «pagas 250 € + parte» sin decir nada. Ahora se
   pregunta, y en Editar deuda se puede ver y corregir lo que baja. Cifras de prueba. */
const YM = 2026 * 12 + 10;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const cuenta = [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }];
const fibra = { id: "fibra", name: "Fibra", amount: 85, freq: "mes", day: 20, account: "sabadell" };
// 6.000 € pendientes, cuota 250 y una bajada guardada de 196,68 (lo que dejó el alta con plazo).
const prestamo = { id: "fam", name: "Préstamo familiar", monthly: 250, amort: 196.68, months: 31, value: 6000, account: "sabadell", day: 20, asOf: YM - 1 };

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
const persona = (page) => page.locator('.v4-sheet[data-sheet="persona"]');
const ask = (page) => page.locator(".askback .tabsheet");

async function familiaLoDescuenta(page) {
  const recibos = await abrePlan(page, { fixed: [fibra], debts: [prestamo] });
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Gestionar" }).click();
  await page.locator('[data-bills-manage] [data-group="people"]').click();
  await page.locator('[data-act="persona-add"]').click();
  await persona(page).locator('[data-pe="name"]').fill("Familia");
  await persona(page).locator('[data-pe="via"] button', { hasText: "Lo descuento" }).click();
  await persona(page).locator('[data-pe="deuda"] button', { hasText: "Préstamo familiar" }).click();
  await persona(page).locator('[data-pe="recibos"] button', { hasText: "Fibra" }).click();
  await persona(page).locator('[data-act="persona-guardar"]').click();
  // A partes iguales le tocan 42,50: del banco saldrían 207,50 y se propone que baje la cuota de antes.
  await expect(ask(page).locator("#ask-dialog-title")).toHaveText("¿Le pasas 207,50 € y la deuda baja esto?");
  await expect(ask(page).locator(".ts-hint")).toHaveText("Préstamo familiar");
  await expect(ask(page).locator(".ask-in")).toHaveValue("250");
  return recibos;
}

test("no cuadra + acepta: sale 207,50 del banco, baja 250 y el plazo sale de ahí", async ({ page }) => {
  await familiaLoDescuenta(page);
  await ask(page).getByRole("button", { name: "Ajustar la deuda" }).click();
  await expect(ask(page)).toHaveCount(0);
  await expect(persona(page)).toHaveCount(0);
  const s = await guardado(page);
  expect(s.fixed.find((f) => f.id === "fibra")).toMatchObject({ amount: 42.5, bankAmount: 85 });
  // El saldo de hoy no se mueve (6.000) y 6.000 / 250 = 24 cuotas.
  expect(s.debts[0]).toMatchObject({ monthly: 207.5, amort: 250, months: 24, value: 6000 });
  // Recargar también demuestra que lo guardado es lo que se pinta.
  await page.reload();
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator(".v4-seg-btn").filter({ hasText: "Deudas" }).click();
  await expect(page.locator('[data-debt-id="fam"]').getByTestId("debt-descuento")).toHaveText("pagas 207,50 € + 42,50 € de Fibra");
});

test("no cuadra + no tocarla: el recibo se guarda y la deuda se queda como estaba", async ({ page }) => {
  await familiaLoDescuenta(page);
  await ask(page).getByRole("button", { name: "Dejarla como está" }).click();
  await expect(persona(page)).toHaveCount(0);
  const s = await guardado(page);
  expect(s.fixed.find((f) => f.id === "fibra").reparto.map((x) => [x.n, x.via, x.amt])).toEqual([["Familia", "debt", 42.5]]);
  expect(s.debts[0]).toEqual(prestamo);
});

test("en el recibo compartido: la parte se ve tecleable y al guardar se pregunta por la deuda", async ({ page }) => {
  const movil = { id: "movil", name: "Móvil", amount: 50, bankAmount: 60, freq: "mes", day: 20, account: "sabadell",
    reparto: [{ id: "pe_fam", n: "Familia", via: "debt", debtId: "fam", amt: 10 }] };
  const recibos = await abrePlan(page, { fixed: [fibra, movil], debts: [prestamo] });
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Gestionar" }).click();
  await page.locator('[data-bills-manage] [data-group="serv"]').click();
  await page.locator('[data-bill-id="fibra"]').click();
  const hoja = page.locator('.v4-sheet[data-sheet="recibo-pasos"]'), p4 = hoja.locator('[data-rp4-paso="4"]');
  await expect(hoja).toHaveAttribute("data-modo", "edit");
  await p4.locator('[data-act="mas-opciones"]').click();
  await p4.locator('[data-testid="rp5-grid"] [data-persona="pe_fam"]').click();
  const parte = p4.locator('.rp5-row [data-rp5-importe="pe_fam"]');
  await expect(parte).toHaveText("42,50 €");
  // El lápiz: la parte puesta sola a partes iguales también se puede teclear.
  expect(await parte.evaluate((el) => getComputedStyle(el, "::after").content)).toContain("✎");
  await hoja.locator(".rp4-cta").click();
  // Ya se descontaban 10 del Móvil: del banco saldrían 250 + 10 − 52,50 = 207,50.
  await expect(ask(page).locator("#ask-dialog-title")).toHaveText("¿Le pasas 207,50 € y la deuda baja esto?");
  await expect(ask(page).locator(".ask-in")).toHaveValue("260");
  await ask(page).getByRole("button", { name: "Ajustar la deuda" }).click();
  await expect(hoja).toHaveCount(0);
  const s = await guardado(page);
  expect(s.fixed.find((f) => f.id === "fibra")).toMatchObject({ amount: 42.5, bankAmount: 85 });
  expect(s.debts[0]).toMatchObject({ monthly: 207.5, amort: 260, months: 24, value: 6000 });
});

async function editarDeuda(page, debt) {
  await abrePlan(page, { fixed: [], debts: [debt] });
  await page.locator(".v4-seg-btn").filter({ hasText: "Deudas" }).click();
  await page.locator('[data-debt-id="' + debt.id + '"] .plan-item-open').click();
  return page.getByRole("dialog", { name: "Editar deuda", exact: true });
}

test("Editar deuda: «Baja la deuda al mes» se ve, se corrige y el plazo se confirma", async ({ page }) => {
  const hoja = await editarDeuda(page, prestamo);
  const baja = hoja.locator('[data-debt-field="amort"]');
  await expect(baja).toHaveValue("196.68");
  await expect(hoja).toContainText("Puede no ser lo que sale del banco.");
  await baja.fill("250");
  await hoja.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  // Cambia el plazo (31 → 24): se pide confirmarlo como cualquier recálculo.
  await expect(ask(page)).toContainText("24");
  await ask(page).locator(".btn-primary").click();
  await expect(hoja).toHaveCount(0);
  const s = await guardado(page);
  // 250 = la cuota: no se guarda aparte; saldo intacto.
  expect(s.debts[0]).toMatchObject({ monthly: 250, months: 24, value: 6000 });
  expect(s.debts[0].amort).toBeUndefined();
});

test("Editar deuda: cambiar el plazo mueve lo que baja en vez de rechazarlo", async ({ page }) => {
  const hoja = await editarDeuda(page, prestamo);
  await hoja.locator('[data-debt-field="months"]').fill("24");
  await expect(hoja.locator('[data-debt-field="amort"]')).toHaveValue("250");
  await hoja.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(hoja).toHaveCount(0);
  const s = await guardado(page);
  expect(s.debts[0]).toMatchObject({ monthly: 250, months: 24, value: 6000 });
});

test("Editar deuda con interés: no ofrece «Baja la deuda al mes»", async ({ page }) => {
  const hoja = await editarDeuda(page, Object.assign({}, prestamo, { id: "hipo", name: "Hipoteca", apr: 2.5 }));
  await expect(hoja.locator('[data-debt-field="monthly"]')).toBeVisible();
  await expect(hoja.locator('[data-debt-field="amort"]')).toHaveCount(0);
});

test("descuadre ya guardado: la tarjeta lo señala y se ajusta preguntando, sin quitar a nadie", async ({ page }) => {
  // El estado del dueño: «Lo descuento» de 53 puesto antes de que se preguntara, cuota 250 y bajada 196,68.
  const fibraComp = Object.assign({}, fibra, { amount: 32, bankAmount: 85, reparto: [{ id: "pe_fam", n: "Familia", via: "debt", debtId: "fam", amt: 53 }] });
  await abrePlan(page, { fixed: [fibraComp], debts: [prestamo] });
  await page.locator(".v4-seg-btn").filter({ hasText: "Deudas" }).click();
  const tarjeta = page.locator('[data-debt-id="fam"]');
  await expect(tarjeta.getByTestId("debt-descuento")).toHaveText("pagas 250,00 € + 53,00 € de Fibra");
  await tarjeta.locator('[data-act="debt-descuadre"]').click();
  await expect(ask(page).locator("#ask-dialog-title")).toHaveText("¿Cuánto le pasas al mes?");
  await expect(ask(page).locator(".ask-in")).toHaveValue("197");
  await ask(page).locator(".btn-primary").click();
  await expect(ask(page).locator("#ask-dialog-title")).toHaveText("¿Le pasas 197,00 € y la deuda baja esto?");
  await expect(ask(page).locator(".ask-in")).toHaveValue("250");
  await ask(page).getByRole("button", { name: "Ajustar la deuda" }).click();
  await expect(ask(page)).toHaveCount(0);
  const s = await guardado(page);
  expect(s.debts[0]).toMatchObject({ monthly: 197, amort: 250, months: 24, value: 6000 });
  await expect(tarjeta.getByTestId("debt-descuento")).toHaveText("pagas 197,00 € + 53,00 € de Fibra");
  await expect(tarjeta.locator('[data-act="debt-descuadre"]')).toHaveCount(0);
});

test("descuadre ya guardado: cancelar no toca nada", async ({ page }) => {
  const fibraComp = Object.assign({}, fibra, { amount: 32, bankAmount: 85, reparto: [{ id: "pe_fam", n: "Familia", via: "debt", debtId: "fam", amt: 53 }] });
  await abrePlan(page, { fixed: [fibraComp], debts: [prestamo] });
  await page.locator(".v4-seg-btn").filter({ hasText: "Deudas" }).click();
  await page.locator('[data-debt-id="fam"] [data-act="debt-descuadre"]').click();
  await ask(page).locator(".btn-primary").click();
  await ask(page).getByRole("button", { name: "Dejarla como está" }).click();
  expect((await guardado(page)).debts[0]).toEqual(prestamo);
});

test("Editar deuda ligada: cuota 197 y «Baja la deuda al mes» 250 se guardan las dos", async ({ page }) => {
  const ligada = { id: "lig", name: "Préstamo ligado", monthly: 250, value: 6000, account: "sabadell", day: 20, asOf: YM - 1 };
  const hoja = await editarDeuda(page, ligada);
  await hoja.locator('[data-debt-field="monthly"]').fill("197");
  // Sin tocarla, la bajada sigue a la cuota en pantalla: lo que se ve es lo que se guarda.
  await expect(hoja.locator('[data-debt-field="amort"]')).toHaveValue("197");
  await hoja.locator('[data-debt-field="amort"]').fill("250");
  await hoja.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(hoja).toHaveCount(0);
  expect((await guardado(page)).debts[0]).toMatchObject({ monthly: 197, amort: 250, value: 6000 });
});

const compartidoDescuadrado = () => Object.assign({}, fibra, { amount: 32, bankAmount: 85,
  reparto: [{ id: "pe_fam", n: "Familia", via: "debt", debtId: "fam", amt: 53 }] });
const fotoSalida = (page) => page.evaluate(() => {
  const s = mcLoadRaw(mcStateKey());
  return { fixed: s.fixed || [], debts: s.debts || [], accounts: s.accounts || [] };
});
async function preguntaSalida(page, antes) {
  await expect(ask(page).locator("#ask-dialog-title")).toHaveText("¿Le pasas 303,00 € y la deuda baja esto?");
  await expect(ask(page).locator(".ts-hint")).toHaveText("Préstamo familiar");
  await expect(ask(page).locator(".ask-in")).toHaveValue("303");
  expect(await fotoSalida(page)).toEqual(antes);
  await ask(page).getByRole("button", { name: "Dejarla como está" }).click();
  await expect(ask(page)).toHaveCount(0);
}
async function deudaIntactaTrasRecarga(page, antes) {
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  const s = await fotoSalida(page);
  expect(s.debts).toEqual(antes.debts);expect(s.accounts).toEqual(antes.accounts);
  return s;
}

test("R164 quitar recibo compartido: pregunta y cancelar conserva deuda", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [compartidoDescuadrado()], debts: [prestamo] });
  await expect.poll(async () => (await fotoSalida(page)).debts).toEqual([prestamo]);
  const antes = await fotoSalida(page);
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Gestionar" }).click();
  await page.locator('[data-bills-manage] [data-group="serv"]').click();
  await page.locator('[data-bill-id="fibra"]').click();
  const quitar = page.locator('.v4-sheet[data-sheet="recibo-pasos"] [data-act="bill-remove"]');
  await quitar.click();expect(await fotoSalida(page)).toEqual(antes);
  await quitar.click();await preguntaSalida(page, antes);
  await expect.poll(async () => (await fotoSalida(page)).fixed).toEqual([]);
  expect((await fotoSalida(page)).debts).toEqual(antes.debts);
  expect((await deudaIntactaTrasRecarga(page, antes)).fixed).toEqual([]);
});

test("R164 borrar persona: pregunta y cancelar conserva deuda", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [compartidoDescuadrado()], debts: [prestamo] });
  await expect.poll(async () => (await fotoSalida(page)).debts).toEqual([prestamo]);
  const antes = await fotoSalida(page);
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Gestionar" }).click();
  await page.locator('[data-bills-manage] [data-group="people"]').click();
  await page.getByTestId("pe-lista").locator('[data-persona="pe_fam"]').click();
  const borrar = persona(page).locator('[data-act="persona-borrar"]');
  await borrar.click();await expect(borrar).toHaveText("¿Seguro? Sale de todos sus recibos");
  await persona(page).locator("h2").click();await expect(borrar).toHaveText("Borrar");
  expect(await fotoSalida(page)).toEqual(antes);
  await borrar.click();await borrar.click();await preguntaSalida(page, antes);
  await expect(persona(page)).toHaveCount(0);
  await expect.poll(async () => (await fotoSalida(page)).fixed[0].amount).toBe(85);
  const despues = await deudaIntactaTrasRecarga(page, antes);
  expect(despues.fixed).toHaveLength(1);expect(despues.fixed[0].id).toBe("fibra");
  expect(despues.fixed[0].amount).toBe(85);expect(despues.fixed[0].reparto).toBeUndefined();
  expect(despues.fixed[0].bankAmount).toBeUndefined();
});
