import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* EL CARGO DE UN RECIBO SALE EN GASTOS Y NO CUENTA DOS VECES (decisión del dueño, 12/10/2026).
   Sus palabras: «yo solo quiero que salga todo en gastos… si sale en recibos pero no en gastos
   la gente se rallará». Antes el sync tiraba el adeudo que casaba con un recibo del Plan.

   Se prueba con el banco «para todo», que es donde contarlo dos veces se nota: ahí el recibo ya
   resta del saldo por calendario y un gasto del mismo banco suma al gastado. El unitario
   (`tests/recibo-domiciliado-sin-acreditar`) cubre las cifras en los tres roles; esto comprueba
   lo que él ve: la fila en Gastos, a qué recibo pertenece, el recibo pagado en Plan y el
   gastado sin moverse. Reloj del fixture: 26/9/2026. */

const recibo = { id: "com", name: "Comunidad", amount: 50, freq: "mes", day: 12, account: "sabadell" };
// Un recibo de nombre corto y una compra que solo se le parece: hasta ahora se tiraba; se ve con pregunta.
const agua = { id: "ag", name: "Agua", amount: 30, freq: "mes", day: 8, account: "sabadell" };
const links = [{
  aspsp: "Banco de Sabadell", ok: true, syncFrom: "2026-08-24", gapBeyondCap: false, gapPending: false, balanceAt: "2026-09-26T11:59:30.000Z",
  accounts: [{ uid: "sb", ok: true, balances: [{ type: "ITAV", amount: 1900, currency: "EUR" }], transactions: [
    { ext_id: "sb-com", date: "2026-09-12", amount: 50, merchant: "COMUNIDAD DE PROPIETARIOS", status: "BOOK", card: false },
    { ext_id: "sb-pan", date: "2026-09-13", amount: 3.4, merchant: "Panadería Sol", status: "BOOK", card: true },
    { ext_id: "sb-agu", date: "2026-09-08", amount: 30.2, merchant: "AGUACATES DEL SUR", status: "BOOK", card: true },
  ] }],
}];

const lista = (page) => page.locator(".v4-gastos-list-body button.v4-mov");
const fila = (page, nombre) => lista(page).filter({ hasText: nombre });
// `textContent` y no `innerText`: la cabecera puede estar plegada y entonces no «se ve» texto.
const gastado = async (page) => (await page.locator(".v4-gastos-summary-amount").first().textContent()).trim();

/** El resumen del sync tapa la barra inferior hasta que se cierra tocando fuera. */
async function cierraInforme(page) {
  await expect(page.locator(".sync-report")).toBeVisible({ timeout: 15_000 });
  await page.locator(".sync-report-back").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".sync-report")).toHaveCount(0);
}

async function abre(page, lang, otro) {
  await seedLoggedInDashboard(page, Object.assign({
    __seedOnce: true, hasBankLink: true, budget: 1000,
    accounts: [{ id: "sb", ent: "sabadell", name: "Sabadell", role: "ambos", value: 2000 }],
    settings: { autoPrices: false, theme: "green", lang, expenseBanks: ["sabadell"] },
    fixed: [recibo, agua], debts: [], oneoffs: [], flows: [], bankTx: [],
    expenses: [{ id: "ctl", date: "2026-09-10T12:00:00.000Z", amount: 20, merchant: "Compra de control", category: "otros", source: "ob", ent: "sabadell", extId: "sb-ctl" }],
    __cloudRows: { bank_links: [{ aspsp_name: "Banco de Sabadell", status: "active", last_sync: "2026-09-20T00:00:00Z" }] },
    __cloudFns: { "bank-sync": { data: { ok: true, links }, error: null } },
  }, otro));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

for (const lang of ["es", "en", "ca"]) {
  test(lang + ": al actualizar, el adeudo sale en Gastos con su recibo, el recibo queda pagado y el gastado no lo cuenta", async ({ page }) => {
    await abre(page, lang);
    const textos = await page.evaluate(() => ({ sync: t("v4_sync_banks"), de: tf("g_recibo_de", { name: "Comunidad" }), quiza: tf("g_recibo_quiza", { name: "Agua" }), no: t("f_recibo_no") }));

    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await expect(fila(page, "Compra de control")).toHaveCount(1);
    await expect(fila(page, "COMUNIDAD DE PROPIETARIOS")).toHaveCount(0);
    expect(await gastado(page)).toContain("20,00");

    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    await page.getByRole("button", { name: textos.sync }).click();
    await expect.poll(() => page.evaluate(() => (mcLoadRaw(mcStateKey()).bankTx || []).length)).toBe(3);
    await cierraInforme(page);

    // Inicio lo enseña igual que Gastos: atenuado y diciendo de qué recibo es.
    await page.locator('.botnav-tab[data-tour="inicio"]').click();
    const enInicio = page.locator("div.v4-mov").filter({ hasText: "COMUNIDAD DE PROPIETARIOS" });
    await expect(enInicio).toHaveCount(1);
    await expect(enInicio).toHaveClass(/v4-mov-skip/);
    await expect(enInicio).toContainText(textos.de);
    await expect(page.locator("div.v4-mov").filter({ hasText: "Panadería Sol" })).not.toHaveClass(/v4-mov-skip/);

    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    const cargo = fila(page, "COMUNIDAD DE PROPIETARIOS");
    await expect(cargo).toHaveCount(1);
    await expect(cargo).toHaveClass(/v4-mov-skip/);
    await expect(cargo).toContainText(textos.de);
    // La compra normal del mismo sync sí suma: la cifra se mueve 3,40 y ni un céntimo más.
    await expect(fila(page, "Panadería Sol")).not.toHaveClass(/v4-mov-skip/);
    const cifras = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); const i = insumosSaldoGasto(s);
      return { spent: monthBudgetStats(s).spent, neto: monthNetForAccount(s, "sabadell", 2026, 9, 26),
        saldo: saldoCuentaMostrada(s.accounts[0], { injTR: i.injTR, spentByBank: i.spentByBank, paidNetByBank: i.paidNetByBank, roundup: i.roundup, monthlyInvest: i.monthlyInvest }) }; });
    expect(cifras.spent).toBeCloseTo(23.4, 2);
    expect(cifras.neto).toBe(-80);
    // El saldo que queda tras sincronizar es el que dice el banco, no el banco más el recibo.
    expect(cifras.saldo).toBeCloseTo(1900, 2);
    expect(await gastado(page)).toContain("23,40");

    // La ficha dice a qué recibo corresponde y deja corregirlo.
    // Lo que solo se parece a un recibo sigue sin contar, como cuando se tiraba, pero pregunta…
    const dudoso = fila(page, "AGUACATES DEL SUR");
    await expect(dudoso).toHaveClass(/v4-mov-skip/);
    await expect(dudoso).toContainText(textos.quiza);
    // …y se corrige de un toque al abrirlo, sin desplegar nada. El saldo no se mueve; el gastado sí.
    await dudoso.click();
    await expect(page.locator('[data-testid="exp-recibo-marca"]')).toContainText("Agua");
    await page.locator('[data-testid="exp-recibo-no"]').click();
    await expect.poll(() => page.evaluate(() => monthBudgetStats(mcLoadRaw(mcStateKey())).spent)).toBeCloseTo(53.6, 2);
    expect(await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()), i = insumosSaldoGasto(s);
      return saldoCuentaMostrada(s.accounts[0], { injTR: i.injTR, spentByBank: i.spentByBank, paidNetByBank: i.paidNetByBank, roundup: i.roundup, monthlyInvest: i.monthlyInvest }); })).toBeCloseTo(1900, 2);
    await page.locator(".v4-sheet-back").last().click({ position: { x: 5, y: 5 } });
    await expect(fila(page, "AGUACATES DEL SUR")).not.toHaveClass(/v4-mov-skip/);

    await cargo.click();
    await page.locator('[data-testid="exp-receipt"]').click();
    await expect(page.locator('[data-testid="exp-receipt-value"]')).toHaveText("Comunidad");
    await expect(page.locator('[data-testid="exp-recibo-marca"]')).toContainText("Comunidad");
    await expect(page.locator('[data-testid="exp-recibo-no"]')).toHaveText(textos.no);
    await page.locator('[data-testid="exp-recibo-no"]').click();
    // El cargo pasa a contar como un gasto más y deja de pagar el recibo: no cuenta en los dos sitios.
    await expect.poll(() => page.evaluate(() => monthBudgetStats(mcLoadRaw(mcStateKey())).spent)).toBeCloseTo(103.6, 2);
    const tras = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return { marcadas: s.expenses.filter((e) => e.reciboId).length, veto: (s.reciboNo || []).length, pagado: fixedPaymentState(s, s.fixed[0], 2026, 9, 26).paid }; });
    expect(tras).toEqual({ marcadas: 0, veto: 4, pagado: false });
    await expect(page.locator('[data-testid="exp-recibo-marca"]')).toHaveCount(0);
    await page.locator(".v4-sheet-back").last().click({ position: { x: 5, y: 5 } });
    await expect(fila(page, "COMUNIDAD DE PROPIETARIOS")).not.toHaveClass(/v4-mov-skip/);
    await expect(page.locator(".v4-sheet-back")).toHaveCount(0);
    // Tras dos fichas la lista ha quedado desplazada y la barra inferior puede estar recogida:
    // el cambio de pestaña no es lo que se prueba aquí, así que se pulsa sin esperar a verla.
    await page.evaluate(() => document.querySelector('.botnav-tab[data-tour="plan"]').click());
    await expect(page.locator('div[data-seg="recibos"]')).toContainText("Comunidad");
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({ hasText: "Comunidad" })).toHaveCount(0);
  });
}

test("Plan: el recibo cobrado sale en «Ya pagado» tras actualizar", async ({ page }) => {
  await abre(page, "es");
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: /Sincronizar bancos/i }).click();
  await expect.poll(() => page.evaluate(() => (mcLoadRaw(mcStateKey()).bankTx || []).length)).toBe(3);
  await cierraInforme(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({ hasText: "Comunidad" })).toHaveCount(1);
});

for (const lang of ["es", "en", "ca"]) {
  test(lang + ": el cargo de un recibo no se puede dar por retirada, y confirmar su pago deshace un «No es este recibo»", async ({ page }) => {
    await abre(page, lang);
    const textos = await page.evaluate(() => ({ sync: t("v4_sync_banks"), marca: tf("f_recibo_marca", { name: "Comunidad" }), bloqueo: t("f_withdraw_receipt_blocked") }));
    const foto = () => page.evaluate(() => { const s = mcLoadRaw(mcStateKey()), i = insumosSaldoGasto(s);
      return { spent: +monthBudgetStats(s).spent.toFixed(2), marcadas: s.expenses.filter((e) => e.reciboId).map((e) => e.reciboId).sort().join(), vetos: (s.reciboNo || []).length,
        pagado: fixedPaymentState(s, s.fixed[0], 2026, 9, 26).paid,
        saldo: +saldoCuentaMostrada(s.accounts[0], { injTR: i.injTR, spentByBank: i.spentByBank, paidNetByBank: i.paidNetByBank, roundup: i.roundup, monthlyInvest: i.monthlyInvest }).toFixed(2) }; });
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    await page.getByRole("button", { name: textos.sync }).click();
    await expect.poll(() => page.evaluate(() => (mcLoadRaw(mcStateKey()).bankTx || []).length)).toBe(3);
    await cierraInforme(page);
    expect(await foto()).toEqual({ spent: 23.4, marcadas: "ag,com", vetos: 0, pagado: true, saldo: 1900 });

    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await fila(page, "COMUNIDAD DE PROPIETARIOS").click();
    // Marcado: como retirada sumaría al efectivo lo que el recibo ya restó. Se dice por qué.
    await expect(page.locator('[data-testid="exp-withdrawal"]')).toBeDisabled();
    await expect(page.locator('[data-testid="exp-withdrawal-receipt-blocked"]')).toHaveText(textos.bloqueo);
    // «Paga un recibo» ofrece deshacerlo, no confirmar otro encima.
    await page.locator('[data-testid="exp-receipt"]').click();
    await expect(page.locator('[data-testid="exp-receipt-com"]')).toHaveCount(0);
    await page.locator('[data-testid="exp-receipt-unlink"]').click();
    await expect.poll(foto).toEqual({ spent: 73.4, marcadas: "ag", vetos: 2, pagado: false, saldo: 1900 });
    await expect(page.locator('[data-testid="exp-withdrawal"]')).toBeEnabled();

    // Se arrepiente: confirma el pago con ese mismo cargo. El diálogo dice lo que va a pasar
    // (deja de sumar en Gastos), no el «el presupuesto se conserva» de un vínculo cualquiera.
    await page.locator('[data-testid="exp-receipt-com"]').click();
    await expect(page.locator(".askback")).toContainText(textos.marca);
    await page.locator(".askback .btn-primary").click();
    await expect.poll(foto).toEqual({ spent: 23.4, marcadas: "ag,com", vetos: 0, pagado: true, saldo: 1900 });
    await expect(page.locator('[data-testid="exp-recibo-marca"]')).toContainText("Comunidad");
  });
}

test("un «No es este recibo» sobre un puntual tiene vuelta atrás desde la misma ficha", async ({ page }) => {
  // Sin ningún recibo fijo: la fila «Paga un recibo» sale por la marca y, después, por el veto.
  await abre(page, "es", { fixed: [], oneoffs: [{ id: "itv", name: "ITV coche", amount: 45, account: "sabadell", month: 9, year: 2026, day: 14 }],
    expenses: [{ id: "c-itv", date: "2026-09-14T12:00:00.000Z", amount: 45, merchant: "ITV COCHE MADRID", obName: "ITV COCHE MADRID", category: "otros", source: "ob", ent: "sabadell", extId: "sb-itv", reciboId: "itv" }] });
  const foto = () => page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return { spent: monthBudgetStats(s).spent, marca: s.expenses[0].reciboId || null, vetos: (s.reciboNo || []).length }; });
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(fila(page, "ITV COCHE MADRID")).toContainText("Recibo: ITV coche");
  await fila(page, "ITV COCHE MADRID").click();
  await page.locator('[data-testid="exp-recibo-no"]').click();
  await expect.poll(foto).toEqual({ spent: 45, marca: null, vetos: 2 });
  await page.locator('[data-testid="exp-receipt"]').click();
  await page.locator('[data-testid="exp-receipt-itv"]').click();
  await expect(page.locator(".askback")).toContainText("ITV coche");
  await page.locator(".askback .btn-primary").click();
  await expect.poll(foto).toEqual({ spent: 0, marca: "itv", vetos: 0 });
  await expect(page.locator('[data-testid="exp-recibo-marca"]')).toContainText("ITV coche");
});

test("con dos cargos iguales de un recibo fijo, el «No es este recibo» de uno también tiene vuelta atrás", async ({ page }) => {
  // El motor no elige entre dos iguales: el recibo no se ofrecía en la ficha y confirmar no hacía nada (13/10/2026).
  const cargo = (id, ord) => Object.assign({ id, date: "2026-09-05T10:00:00.00" + (ord - 1) + "Z", amount: 10.99, merchant: "Spotify", obName: "Spotify", category: "ocio", source: "ob", ent: "sabadell", reciboId: "spo" }, ord > 1 ? { obOrd: ord } : {});
  await abre(page, "es", { fixed: [{ id: "spo", name: "Spotify", amount: 10.99, freq: "mes", day: 5, account: "sabadell" }], expenses: [cargo("c-1", 1), cargo("c-2", 2)] });
  const foto = () => page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return { spent: monthBudgetStats(s).spent, marcas: s.expenses.map((e) => e.reciboId || null), vetos: (s.reciboNo || []).length }; });
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(fila(page, "Spotify")).toHaveCount(2);
  await fila(page, "Spotify").first().click();
  await page.locator('[data-testid="exp-recibo-no"]').click();
  await expect.poll(async () => { const f = await foto(); return [f.spent, f.marcas.filter(Boolean).length, f.vetos]; }).toEqual([10.99, 1, 2]);
  await page.locator('[data-testid="exp-receipt"]').click();
  await page.locator('[data-testid="exp-receipt-spo"]').click();
  // El diálogo promete que aquí no suma otra vez: al aceptar tiene que ser verdad.
  await expect(page.locator(".askback")).toContainText(await page.evaluate(() => tf("f_recibo_marca", { name: "Spotify" })));
  await page.locator(".askback .btn-primary").click();
  await expect.poll(foto).toEqual({ spent: 0, marcas: ["spo", "spo"], vetos: 0 });
  await expect(page.locator('[data-testid="exp-recibo-marca"]')).toContainText("Spotify");
});

test("Importar histórico: el cargo de un recibo sale marcado y con su nombre, no tachado como repetido", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    hasBankLink: true, fixed: [recibo],
    accounts: [{ id: "sb", ent: "sabadell", name: "Sabadell", role: "fijos", value: 2000 }],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["sabadell"] },
    __cloudRows: { bank_links: [{ aspsp_name: "Sabadell", aspsp_country: "ES", status: "active", valid_until: "2026-12-01T00:00:00Z", last_sync: "2026-09-01T09:00:00Z", accounts: [{ uid: "a1" }] }] },
    __cloudFns: { "bank-sync": { data: { ok: true, links: [{ aspsp: "Sabadell", accounts: [{ transactions: [
      { date: "2026-09-12", amount: 50, merchant: "COMUNIDAD DE PROPIETARIOS", card: false, ext_id: "sb-com" },
      { date: "2026-09-03", amount: 13, merchant: "Netflix", card: false, ext_id: "nf1" },
    ] }] }] }, error: null } },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".set-card").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Importaciones/i }).click();
  await page.locator("button.set-row").filter({ hasText: /Importar histórico/i }).click();
  const overlay = page.locator(".hist-import");
  await overlay.getByRole("button", { name: /Buscar movimientos/i }).click();
  await expect(overlay.getByText("Netflix")).toBeVisible({ timeout: 10_000 });

  // Las dos cuentan para importar: la del recibo ya no nace desmarcada.
  await expect(overlay.getByRole("button", { name: /Importar 2/ })).toBeVisible();
  const filaRecibo = overlay.locator(".hist-fila").filter({ hasText: "COMUNIDAD DE PROPIETARIOS" });
  await expect(filaRecibo).toContainText("es tu recibo «Comunidad»");
  await expect(overlay).not.toContainText("ya modelado");
  // Entra como gasto; ofrecer «Recibo» crearía otro recibo igual que restaría cada mes.
  await expect(overlay.locator('[data-cand="sb-com"][data-dest="gasto"]')).toHaveCount(1);
  await expect(overlay.locator('[data-cand="sb-com"][data-dest="recibo"]')).toHaveCount(0);
  await expect(overlay.locator('[data-cand="nf1"][data-dest="recibo"]')).toHaveCount(1);

  // Y se importa de verdad. La nube de pruebas no confirma lotes, así que aquí confirma todos:
  // lo que se comprueba es la fila que la pantalla manda y la que se queda en el móvil.
  await page.evaluate(() => { cloud.addExpensesBatch = async (lista) => { window.__lote = lista.map((e) => expenseSourceForCloud(e)); return { cloudIds: lista.map((e) => e.id), offline: false }; }; });
  await overlay.getByRole("button", { name: /Importar 2/ }).click();
  await expect(page.locator(".hist-import")).toHaveCount(0, { timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => mcLoadRaw(mcStateKey()).expenses
    .filter((e) => e.source === "ob-hist").map((e) => e.merchant + "|" + (e.reciboId || "-")).sort()), { timeout: 15_000 })
    .toEqual(["COMUNIDAD DE PROPIETARIOS|com", "Netflix|-"]);
  expect((await page.evaluate(() => window.__lote)).sort()).toEqual(["ob-hist:sabadell", "ob-hist:sabadell~recibo.com"]);
  // Solo recibos: el gastado es el de Netflix si ese banco cuenta, y nunca los 50 € del recibo.
  expect(await page.evaluate(() => monthBudgetStats(mcLoadRaw(mcStateKey())).spent)).toBeCloseTo(13, 2);
});
