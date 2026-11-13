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
const yt = recibo("yt", "YouTube Premium", 5, 22, { bankAmount: 30, reparto: [["pe_pareja", "Pareja", "bizum"], ["pe_nico", "Nico", "transfer"], ["pe_greta", "Greta", "transfer"],
  ["pe_oscar", "Óscar", "transfer"], ["pe_iria", "Iria", "transfer"]].map((x) => ({ id: x[0], n: x[1], via: x[2], amt: 5, auto: true })) });
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
  await recibos.getByTestId("plan-due").getByRole("button", { name: /^(Gestionar|Todos)\b/ }).click();
  await expect(page.locator("[data-bills-manage]")).toBeVisible();
}

test("tu parte en Plan, la cuota con lo que se descuenta y lo que sale del banco en «¿Te llega?»", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [pepe, yt, luz], debts: [mama] });
  // Tu parte: Pepephone 22 + YouTube 5 + Luz 50 + Mamá 250 (197 del banco + 53 de Pepephone).
  await expect(total(recibos)).toHaveText("327,00 €");
  await expect(fila(recibos, "fixed_pepe")).toContainText("22,00 €");
  await expect(fila(recibos, "fixed_yt")).toContainText("te han pagado 0 de 5");
  await expect(fila(recibos, "debt_mama")).toContainText("pagas 197 € + 53 € de Pepephone");
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
  // Como el prototipo: el total arriba y, por persona, «pendiente» y un botón de contorno.
  await expect(sheet.getByTestId("deben-total")).toHaveText("35,00 €");
  await expect(pareja.getByTestId("deben-estado")).toHaveText("pendiente");
  const fondo = await pareja.locator('[data-act="deben-pagado"]').evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(fondo, "el botón no va relleno").toBe("rgba(0, 0, 0, 0)");
  await pareja.locator('[data-act="deben-pagado"]').click();
  await expect(pareja.locator('[data-act="deben-pagado"]')).toHaveAttribute("aria-pressed", "true");
  await expect(pareja.locator('[data-act="deben-pagado"]')).toHaveText("✓ Bizum · Deshacer");
  await expect(sheet.getByTestId("deben-total")).toHaveText("20,00 €");
  // Marcar no la mueve bajo el dedo: sigue la primera hasta volver a abrir.
  await expect(sheet.getByTestId("deben-persona").first()).toHaveAttribute("data-persona", "pe_pareja");
  await expect(pill).toHaveText("Te deben 20,00 €");
  let s = await guardado(page);
  expect(s.fixed.find((f) => f.id === "pepe").repartoCobrado).toEqual({ [YM]: ["pe_pareja"] });
  expect(s.fixed.find((f) => f.id === "yt").repartoCobrado).toEqual({ [YM]: ["pe_pareja"] });
  for (const id of ["pe_nico", "pe_greta", "pe_oscar", "pe_iria"]) await sheet.locator('[data-persona="' + id + '"] [data-act="deben-pagado"]').click();
  await expect(sheet.getByTestId("deben-todos")).toBeVisible();
  await expect(pill).toHaveCount(0);
  // Deshacer una marca la devuelve a lo que debe.
  await sheet.locator('[data-persona="pe_nico"] [data-act="deben-pagado"]').click();
  await expect(pill).toHaveText("Te deben 5,00 €");
  await page.goBack();
  await expect(fila(recibos, "fixed_yt")).toContainText("te han pagado 4 de 5");
  // Ninguna cifra de Plan se mueve por cobrar a los demás: lo tuyo sigue siendo lo tuyo.
  await expect(total(recibos)).toHaveText("327,00 €");
  // Al volver a abrir, quien ya pagó baja al final y solo Nico queda con su botón.
  await pill.click();
  await expect(sheet.getByTestId("deben-persona").first()).toHaveAttribute("data-persona", "pe_nico");
  await expect(sheet.locator('[data-act="deben-pagado"][aria-pressed="false"]')).toHaveCount(1);
  await expect(sheet.getByTestId("deben-total")).toHaveText("5,00 €");
});

/* Lo que te pasan casa solo cuando el banco trae su nombre (11/11/2026): Bruno paga exacto y sale
   pagado con el día; Nora se equivoca y paga 3,70 de 5, y se ve lo que falta. El total de arriba
   baja a lo que falta, y nada de esto toca lo que pagas tú. Nombres y cifras inventados. */
test("Te deben: un ingreso con su nombre la paga sola, y un pago a medias enseña lo que falta", async ({ page }) => {
  const ing = (id, merchant, amount, date) => ({ id, merchant, amount: -amount, date, category: "ingreso", ent: "sabadell", source: "ob", noCard: true });
  const video = recibo("video", "Vídeo", 5, 22, { bankAmount: 25, reparto: [["pe_nora", "Nora"], ["pe_bruno", "Bruno"], ["pe_iris", "Iris"], ["pe_otto", "Otto"]]
    .map((x) => ({ id: x[0], n: x[1], via: "transfer", amt: 5, auto: true })) });
  const recibos = await abrePlan(page, { fixed: [video, luz], expenses: [
    ing("in_bruno", "TRANSFERENCIA BRUNO EJEMPLO", 5, "2026-10-11T09:00:00"),
    ing("in_nora", "TRANSFERENCIA NORA EJEMPLO", 3.7, "2026-10-03T09:00:00"),
    // De otra persona, aunque el importe cuadre, y una devolución con su nombre: no casan.
    ing("in_otro", "TRANSFERENCIA IRENE EJEMPLO", 5, "2026-10-05T09:00:00"),
    ing("in_dev", "DEVOLUCION BIZUM OTTO", 5, "2026-10-06T09:00:00")] });
  const pill = recibos.getByTestId("plan-deben");
  // 20 − 5 de Bruno − 3,70 de Nora.
  await expect(pill).toHaveText("Te deben 11,30 €");
  await expect(fila(recibos, "fixed_video")).toContainText("te han pagado 1 de 4");
  await pill.click();
  const sheet = page.getByTestId("deben-sheet");
  await expect(sheet.getByTestId("deben-total")).toHaveText("11,30 €");
  const bruno = sheet.locator('[data-persona="pe_bruno"]'), nora = sheet.locator('[data-persona="pe_nora"]');
  await expect(bruno.locator('[data-act="deben-pagado"]')).toHaveText("✓ Transferencia el 11 · Deshacer");
  await expect(sheet.getByTestId("deben-persona").last()).toHaveAttribute("data-persona", "pe_bruno");
  await expect(nora.getByTestId("deben-cifra")).toHaveText("5,00 €");
  await expect(nora.getByTestId("deben-estado")).toHaveText("pagó 3,70 € · falta 1,30 €");
  for (const id of ["pe_iris", "pe_otto"]) await expect(sheet.locator('[data-persona="' + id + '"]').getByTestId("deben-estado")).toHaveText("pendiente");
  // Darlo por pagado salda lo que falta; deshacerlo vuelve al pago a medias y no veta nada.
  await nora.locator('[data-act="deben-pagado"]').click();
  await expect(sheet.getByTestId("deben-total")).toHaveText("10,00 €");
  await nora.locator('[data-act="deben-pagado"]').click();
  await expect(nora.getByTestId("deben-estado")).toHaveText("pagó 3,70 € · falta 1,30 €");
  await expect(nora.locator('[data-act="deben-pagado"]')).toHaveText("Dar por pagado");
  // Deshacer lo que casó solo: ESE ingreso no era suyo y deja de contar para Bruno.
  await bruno.locator('[data-act="deben-pagado"]').click();
  await expect(bruno.getByTestId("deben-estado")).toHaveText("pendiente");
  await expect(sheet.getByTestId("deben-total")).toHaveText("16,30 €");
  const s = await guardado(page);
  expect(s.fixed.find((f) => f.id === "video").repartoCobrado).toEqual({ [YM]: ["!pe_bruno:in_bruno"] });
  await page.goBack();
  await expect(pill).toHaveText("Te deben 16,30 €");
  // Tu parte no se mueve por cobrar a los demás: Vídeo 5 + Luz 50.
  await expect(total(recibos)).toHaveText("55,00 €");
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
  await expect(lista).toContainText("se descuenta de Mamá");
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

/* Remates de la revisión de la tanda 5 (rev-recibos-t5, NO-GO). Cada uno falla sin su arreglo. */
const editarRecibo = async (page, recibos, id) => {
  await abreTodos(page, recibos);
  await page.locator('[data-bill-id="' + id + '"]').click();
  await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
};

test("B1: añadir a alguien a un recibo ya pagado este mes no borra su «Te deben» ni el descuento", async ({ page }) => {
  const pagado = Object.assign({}, pepe, { paidYm: YM, paidDay: 5 });
  const recibos = await abrePlan(page, { fixed: [pagado, luz], debts: [mama] });
  await expect(total(recibos)).toHaveText("300,00 €");
  await expect(recibos.getByTestId("plan-deben")).toHaveText("Te deben 10,00 €");
  await editarRecibo(page, recibos, "pepe");
  await paso(page, 4).locator('[data-act="persona-otra"]').click();
  await persona(page).locator('[data-pe="name"]').fill("Nuevo");
  await persona(page).locator('[data-act="persona-guardar"]').click();
  await hoja(page).locator(".rp4-cta").click();
  await expect(hoja(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-bills-manage][data-screen="bills-home"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(total(recibos)).toHaveText("300,00 €");
  await expect(recibos.getByTestId("plan-deben")).toHaveText("Te deben 10,00 €");
  await expect(fila(recibos, "debt_mama")).toContainText("pagas 197 € + 53 € de Pepephone");
  await expect(fila(recibos, "debt_mama")).toContainText("250,00 €");
  const s = await guardado(page);
  expect(s.fixed.find((f) => f.id === "pepe").soloMes[YM].reparto.map((x) => x.id)).toEqual(["pe_pareja", "pe_fam"]);
});

test("R1: «Lo descuento» no ofrece una deuda con interés", async ({ page }) => {
  const hipo = { id: "hipo", name: "Hipoteca", monthly: 600, value: 90000, apr: 2.5, account: "sabadell", day: 1, asOf: YM - 1 };
  const recibos = await abrePlan(page, { fixed: [recibo("pepe", "Pepephone", 85, 20)], debts: [hipo, Object.assign({}, mama, { monthly: 250, amort: undefined })] });
  await abreTodos(page, recibos);
  await page.locator('[data-act="persona-add"]').click();
  await persona(page).locator('[data-pe="via"] button', { hasText: "Lo descuento" }).click();
  await expect(persona(page).locator('[data-pe="deuda"] button')).toHaveText(["Mamá"]);
});

test("R2: el previsto a fin de mes de la cuenta usa lo que cobra el banco, como «¿Te llega?»", async ({ page }) => {
  await abrePlan(page, { fixed: [pepe, yt, luz], debts: [mama] });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.locator(".v4-card-list button.v4-mov").filter({ hasText: "Sabadell" }).first().click();
  await expect(page.locator(".v4-sheet .v4-account-balance")).toContainText("a fin de mes: 2.638,00 €");
});

test("R3: dos móviles que marcan «Ya me lo ha pagado» a personas distintas suman las dos", async ({ page }) => {
  await abrePlan(page, { fixed: [luz] });
  const r = await page.evaluate((ym) => {
    const base = [{ id: "f", amount: 5, bankAmount: 15, freq: "mes", day: 1 }];
    const l = JSON.parse(JSON.stringify(base)), rr = JSON.parse(JSON.stringify(base));
    l[0].repartoCobrado = { [ym]: ["a"] }; rr[0].repartoCobrado = { [ym]: ["b"] };
    const m = mergePlanThreeWay(base, l, rr, "fixed");
    const q = JSON.parse(JSON.stringify(m.rows[0].repartoCobrado));
    // Quitar una marca en un móvil la quita si el otro no la tocó.
    const b2 = [Object.assign({}, base[0], { repartoCobrado: { [ym]: ["a", "b"] } })], l2 = JSON.parse(JSON.stringify(b2)), r2 = JSON.parse(JSON.stringify(b2));
    l2[0].repartoCobrado = { [ym]: ["b"] }; r2[0].day = 2;
    const m2 = mergePlanThreeWay(b2, l2, r2, "fixed");
    return { conflictos: m.conflicts.length, marcas: q[ym].slice().sort(), quitada: m2.rows[0].repartoCobrado[ym], c2: m2.conflicts.length };
  }, YM);
  expect(r).toEqual({ conflictos: 0, marcas: ["a", "b"], quitada: ["b"], c2: 0 });
});

test("uso: una parte mayor que el importe dice por qué no se guarda y Atrás cierra solo el teclado", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [luz] });
  await editarRecibo(page, recibos, "luz");
  await paso(page, 4).locator('[data-act="mas-opciones"]').click();
  await paso(page, 4).locator('[data-act="persona-otra"]').click();
  await persona(page).locator('[data-pe="name"]').fill("Bea");
  await persona(page).locator('[data-act="persona-guardar"]').click();
  await expect(persona(page)).toHaveCount(0);
  const fp = paso(page, 4).locator(".rp5-row");
  await fp.locator("[data-rp5-importe]").click();
  await teclea(fp, "60");
  await expect(paso(page, 4).getByTestId("rp5-supera")).toHaveText("Las partes pasan del importe: no te queda parte");
  await expect(hoja(page).locator(".rp4-cta")).toBeDisabled();
  await page.goBack();
  await expect(hoja(page)).toHaveCount(1);
  await expect(fp.locator(".pr6-fold.open")).toHaveCount(0);
  await expect(fp.locator("[data-rp5-importe]")).toHaveText("60,00 €");
});

test("uso: Personas › Añadir ofrece los compartidos de antes sin cambiar tu parte; «Lo descuento» dice por qué no en un no mensual", async ({ page }) => {
  const viejo = recibo("pepe", "Pepephone", 22, 20, { bankAmount: 85 });
  const agua = recibo("agua", "Agua", 40, 10, { freq: "bimestral" });
  const recibos = await abrePlan(page, { fixed: [viejo, agua, luz], debts: [Object.assign({}, mama, { monthly: 250, amort: undefined })] });
  await abreTodos(page, recibos);
  await page.locator('[data-act="persona-add"]').click();
  await persona(page).locator('[data-pe="via"] button', { hasText: "Lo descuento" }).click();
  await expect(persona(page).locator('[data-pe="recibos"] button', { hasText: "Agua" })).toBeDisabled();
  await expect(persona(page).getByTestId("pe-solo-mensual")).toHaveText("«Lo descuento» solo en recibos de cada mes");
  await persona(page).locator('[data-pe="via"] button', { hasText: "Bizum" }).click();
  await persona(page).locator('[data-pe="name"]').fill("Pareja");
  await persona(page).locator('[data-pe="recibos"] button', { hasText: "Pepephone" }).click();
  await expect(persona(page).getByTestId("pe-viejo")).toHaveText("En Pepephone ajustarás las partes antes de guardar");
  await persona(page).locator('[data-act="persona-guardar"]').click();
  await expect(persona(page)).toHaveCount(0);
  // El compartido de antes se abre en Editar con la persona y todo el resto a la vista.
  await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
  await expect(paso(page, 4).locator(".rp5-row [data-rp5-importe]")).toHaveText(["63,00 €"]);
  await expect(paso(page, 4).getByTestId("rp5-tu-parte")).toHaveText("Tu parte22,00 €");
  await hoja(page).locator(".rp4-cta").click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await guardado(page);
  const f = s.fixed.find((x) => x.id === "pepe");
  expect([f.amount, f.bankAmount, f.reparto.map((x) => [x.n, x.amt])]).toEqual([22, 85, [["Pareja", 63]]]);
});

test("R2-1: «Lo descuento» en un compartido de antes deja ajustar la parte: Mamá 197 + 53 = 250, no 260", async ({ page }) => {
  const viejo = recibo("pepe", "Pepephone", 22, 20, { bankAmount: 85 });
  const recibos = await abrePlan(page, { fixed: [viejo, luz], debts: [mama] });
  await abreTodos(page, recibos);
  await page.locator('[data-act="persona-add"]').click();
  await persona(page).locator('[data-pe="name"]').fill("Familia");
  await persona(page).locator('[data-pe="via"] button', { hasText: "Lo descuento" }).click();
  await persona(page).locator('[data-pe="deuda"] button', { hasText: "Mamá" }).click();
  await persona(page).locator('[data-pe="recibos"] button', { hasText: "Pepephone" }).click();
  await persona(page).locator('[data-act="persona-guardar"]').click();
  await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
  const fam = paso(page, 4).locator(".rp5-row").first();
  await expect(fam.locator("[data-rp5-importe]")).toHaveText("63,00 €");
  await fam.locator("[data-rp5-importe]").click();
  await teclea(fam, "53");
  await paso(page, 4).locator('[data-act="persona-otra"]').click();
  await persona(page).locator('[data-pe="name"]').fill("Pareja");
  await persona(page).locator('[data-act="persona-guardar"]').click();
  const par = paso(page, 4).locator(".rp5-row").nth(1);
  await par.locator("[data-rp5-importe]").click();
  await teclea(par, "10");
  await expect(paso(page, 4).getByTestId("rp5-tu-parte")).toHaveText("Tu parte22,00 €");
  await hoja(page).locator(".rp4-cta").click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await guardado(page);
  const f = s.fixed.find((x) => x.id === "pepe");
  expect([f.amount, f.bankAmount, f.reparto.map((x) => [x.n, x.via, x.amt])]).toEqual([22, 85, [["Familia", "debt", 53], ["Pareja", "bizum", 10]]]);
  expect(s.debts[0]).toMatchObject({ monthly: 197, amort: 250 });
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-bills-manage][data-screen="bills-home"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(fila(recibos, "debt_mama")).toContainText("pagas 197 € + 53 € de Pepephone");
  await expect(fila(recibos, "debt_mama")).toContainText("250,00 €");
  await expect(recibos.getByTestId("plan-deben")).toHaveText("Te deben 10,00 €");
});

test("R5: un reparto que dejó de cuadrar se puede rehacer desde Editar", async ({ page }) => {
  const roto = Object.assign({}, pepe, { amount: 30 });
  const recibos = await abrePlan(page, { fixed: [roto, luz], debts: [mama] });
  await expect(recibos.getByTestId("plan-deben")).toHaveCount(0);
  await editarRecibo(page, recibos, "pepe");
  await expect(paso(page, 4).getByTestId("rp5-rehacer")).toBeVisible();
  await expect(paso(page, 4).locator(".rp5-row")).toHaveCount(2);
  await expect(paso(page, 4).getByTestId("rp5-tu-parte")).toHaveText("Tu parte22,00 €");
  await hoja(page).locator(".rp4-cta").click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await guardado(page);
  expect(s.fixed.find((x) => x.id === "pepe")).toMatchObject({ amount: 22, bankAmount: 85 });
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-bills-manage][data-screen="bills-home"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(recibos.getByTestId("plan-deben")).toHaveText("Te deben 10,00 €");
});
