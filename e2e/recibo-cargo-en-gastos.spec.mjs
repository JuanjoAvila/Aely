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
const links = [{
  aspsp: "Banco de Sabadell", ok: true, syncFrom: "2026-08-24", gapBeyondCap: false, gapPending: false, balanceAt: "2026-09-26T11:59:30.000Z",
  accounts: [{ uid: "sb", ok: true, balances: [{ type: "ITAV", amount: 1900, currency: "EUR" }], transactions: [
    { ext_id: "sb-com", date: "2026-09-12", amount: 50, merchant: "COMUNIDAD DE PROPIETARIOS", status: "BOOK", card: false },
    { ext_id: "sb-pan", date: "2026-09-13", amount: 3.4, merchant: "Panadería Sol", status: "BOOK", card: true },
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

async function abre(page, lang) {
  await seedLoggedInDashboard(page, {
    __seedOnce: true, hasBankLink: true, budget: 1000,
    accounts: [{ id: "sb", ent: "sabadell", name: "Sabadell", role: "ambos", value: 2000 }],
    settings: { autoPrices: false, theme: "green", lang, expenseBanks: ["sabadell"] },
    fixed: [recibo], debts: [], oneoffs: [], flows: [], bankTx: [],
    expenses: [{ id: "ctl", date: "2026-09-10T12:00:00.000Z", amount: 20, merchant: "Compra de control", category: "otros", source: "ob", ent: "sabadell", extId: "sb-ctl" }],
    __cloudRows: { bank_links: [{ aspsp_name: "Banco de Sabadell", status: "active", last_sync: "2026-09-20T00:00:00Z" }] },
    __cloudFns: { "bank-sync": { data: { ok: true, links }, error: null } },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

for (const lang of ["es", "en", "ca"]) {
  test(lang + ": al actualizar, el adeudo sale en Gastos con su recibo, el recibo queda pagado y el gastado no lo cuenta", async ({ page }) => {
    await abre(page, lang);
    const textos = await page.evaluate(() => ({ sync: t("v4_sync_banks"), de: tf("g_recibo_de", { name: "Comunidad" }), no: t("f_recibo_no") }));

    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await expect(fila(page, "Compra de control")).toHaveCount(1);
    await expect(fila(page, "COMUNIDAD DE PROPIETARIOS")).toHaveCount(0);
    expect(await gastado(page)).toContain("20,00");

    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    await page.getByRole("button", { name: textos.sync }).click();
    await expect.poll(() => page.evaluate(() => (mcLoadRaw(mcStateKey()).bankTx || []).length)).toBe(2);
    await cierraInforme(page);

    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    const cargo = fila(page, "COMUNIDAD DE PROPIETARIOS");
    await expect(cargo).toHaveCount(1);
    await expect(cargo).toHaveClass(/v4-mov-skip/);
    await expect(cargo).toContainText(textos.de);
    // La compra normal del mismo sync sí suma: la cifra se mueve 3,40 y ni un céntimo más.
    await expect(fila(page, "Panadería Sol")).not.toHaveClass(/v4-mov-skip/);
    const cifras = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return { spent: monthBudgetStats(s).spent, neto: monthNetForAccount(s, "sabadell", 2026, 9, 26) }; });
    expect(cifras.spent).toBeCloseTo(23.4, 2);
    expect(cifras.neto).toBe(-50);
    expect(await gastado(page)).toContain("23,40");

    // La ficha dice a qué recibo corresponde y deja corregirlo.
    await cargo.click();
    await page.locator('[data-testid="exp-receipt"]').click();
    await expect(page.locator('[data-testid="exp-receipt-value"]')).toHaveText("Comunidad");
    await expect(page.locator('[data-testid="exp-recibo-marca"]')).toContainText("Comunidad");
    await expect(page.locator('[data-testid="exp-recibo-no"]')).toHaveText(textos.no);
    await page.locator('[data-testid="exp-recibo-no"]').click();
    await expect.poll(() => page.evaluate(() => monthBudgetStats(mcLoadRaw(mcStateKey())).spent)).toBeCloseTo(73.4, 2);
  });
}

test("Plan: el recibo cobrado sale en «Ya pagado» tras actualizar", async ({ page }) => {
  await abre(page, "es");
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: /Sincronizar bancos/i }).click();
  await expect.poll(() => page.evaluate(() => (mcLoadRaw(mcStateKey()).bankTx || []).length)).toBe(2);
  await cierraInforme(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({ hasText: "Comunidad" })).toHaveCount(1);
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
});
