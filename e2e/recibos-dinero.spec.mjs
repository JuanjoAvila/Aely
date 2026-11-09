import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos: lo que mueve dinero o cifras (auditoría 9/11/2026). «Lo pagué de otra forma»
   (SPEC §2.6.3) con Desmarcar y Deshacer, devolver un recibo saltado con Deshacer y el aviso de
   dónde cae, «Ya no lo tengo» con Deshacer, el día 31 en un mes de 30 y cuántos recibos hay detrás
   de la cifra de Gestionar. Todo sale del estado sembrado: se mira el DOM y lo guardado. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const cuenta = [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }];
const recibo = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra);

async function abrePlan(page, overrides, when) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date(when || "2026-10-18T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-10-18", bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], settings, accounts: cuenta }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
const guardado = (page, id) => page.evaluate((rid) => mcLoadRaw(mcStateKey()).fixed.find((x) => x.id === rid) || null, id);
const queda = (recibos) => recibos.getByTestId("plan-summary").locator(".serif.num");

test("lo pagué de otra forma: sale de Para revisar, deja de sumar, se deshace y se desmarca", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("agua", "Agua", 28.15, 3), recibo("luz", "Luz", 50, 25)] });
  const eur = (x) => page.evaluate((v) => eur(v), x);
  await expect(recibos.getByTestId("plan-review").locator('[data-recibo="fixed_agua"]')).toHaveCount(1);
  await expect(queda(recibos)).toHaveText(await eur(78.15));
  const marcar = async () => {
    await recibos.getByTestId("plan-review").locator('[data-recibo="fixed_agua"]').click();
    const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
    await ficha.locator('[data-act="pagado"]').click();
    await ficha.locator('[data-act="a-mano"]').click();
    await expect(ficha).toHaveCount(0);
  };
  await marcar();
  // Pasa a Ya pagados diciendo cómo se pagó, y lo que queda por pagar baja justo eso.
  await expect(recibos.getByTestId("plan-review")).toHaveCount(0);
  await expect(queda(recibos)).toHaveText(await eur(50));
  const pagados = recibos.getByTestId("plan-paid");
  await pagados.locator(".pr6-paid-h").click();
  await expect(pagados.locator('[data-recibo="fixed_agua"]')).toContainText("marcado a mano");
  await expect.poll(async () => (await guardado(page, "agua")).pagadoAMano).toEqual({ [2026 * 12 + 10]: 18 });
  // Deshacer lo devuelve a como estaba.
  const toast = recibos.getByTestId("plan-deshacer");
  await expect(toast).toContainText("Agua marcado a mano");
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await expect(recibos.getByTestId("plan-review").locator('[data-recibo="fixed_agua"]')).toHaveCount(1);
  await expect(queda(recibos)).toHaveText(await eur(78.15));
  await expect.poll(async () => (await guardado(page, "agua")).pagadoAMano).toBeUndefined();
  // La ficha de un recibo marcado a mano lo dice y ofrece Desmarcar, no «Ya está pagado».
  await marcar();
  await pagados.locator('[data-recibo="fixed_agua"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await expect(ficha.getByTestId("recibo-a-mano")).toContainText("Marcado a mano");
  await expect(ficha.locator('[data-act="pagado"]')).toHaveCount(0);
  await ficha.locator('[data-act="desmarcar"]').click();
  await expect(toast).toContainText("Agua pasa a Para revisar");
  await expect(recibos.getByTestId("plan-review").locator('[data-recibo="fixed_agua"]')).toHaveCount(1);
  await expect(queda(recibos)).toHaveText(await eur(78.15));
});

test("un recibo saltado vuelve al mes con un toque, dice dónde cae y se deshace", async ({ page }) => {
  const YM = 2026 * 12 + 10;
  const recibos = await abrePlan(page, { fixed: [recibo("com", "Comunidad", 75, 3, { pausedFrom: YM, pausedUntil: YM + 1 }), recibo("luz", "Luz", 50, 25)] });
  const eur = (x) => page.evaluate((v) => eur(v), x);
  await expect(queda(recibos)).toHaveText(await eur(50));
  const pagados = recibos.getByTestId("plan-paid");
  await pagados.locator(".pr6-paid-h").click();
  await pagados.locator('[data-pausado="1"][data-recibo="fixed_com"]').click();
  // Tocaba el 3 y estamos a 18: no vuelve a Pendiente, cae en Para revisar, y el aviso lo dice.
  const toast = recibos.getByTestId("plan-deshacer");
  await expect(toast).toContainText("Comunidad pasa a Para revisar");
  await expect(recibos.getByTestId("plan-review").locator('[data-recibo="fixed_com"]')).toHaveCount(1);
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await expect(recibos.getByTestId("plan-review")).toHaveCount(0);
  await expect(queda(recibos)).toHaveText(await eur(50));
  await expect.poll(async () => { const com = await guardado(page, "com"); return [com.pausedFrom, com.pausedUntil]; }).toEqual([YM, YM + 1]);
});

test("«Ya no lo tengo» desde Editar se puede deshacer", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("gym", "Gimnasio", 40, 25), recibo("luz", "Luz", 50, 26)] });
  await recibos.getByTestId("plan-due").locator('[data-recibo="fixed_gym"]').click();
  await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
  const pasos = page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
  await pasos.locator('[data-act="bill-remove"]').click();
  await pasos.locator('[data-act="bill-remove"]').click();
  await expect.poll(() => guardado(page, "gym")).toBeNull();
  const undo = page.locator(".v4-undo-toast").filter({ hasText: "Deshacer" });
  await expect(undo).toBeVisible();
  await undo.getByRole("button", { name: "Deshacer" }).click();
  await expect.poll(async () => (await guardado(page, "gym") || {}).name).toBe("Gimnasio");
});

test("un recibo del día 31 en noviembre se cobra el 30, y vence ese día", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("alq", "Alquiler", 850, 31)] }, "2026-11-09T12:00:00+01:00");
  const fila = recibos.getByTestId("plan-due").locator('[data-recibo="fixed_alq"]');
  await expect(fila.locator(".dt .d")).toHaveText("30");
  await expect(fila).toContainText("en 21 días");
  await fila.click();
  await expect(page.locator('.v4-sheet[data-sheet="recibo"] .pr6-ficha-h .pr6-ficha-s')).toContainText("Se cobra el 30");
  // El motor dice lo mismo: el 30 ya cuenta como cobrado por calendario.
  expect(await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()), e = s.fixed[0]; return [dayIn(e, 11, 2026), isPaidIn(e, 11, 30, 2026, s)]; })).toEqual([30, true]);
});

test("Gestionar cuenta solo lo que suma en su cifra: recibos y cuotas, no la nómina ni los traspasos", async ({ page }) => {
  const recibos = await abrePlan(page, {
    fixed: [recibo("luz", "Luz", 50, 25), recibo("agua", "Agua", 30, 26)],
    debts: [{ id: "hip", name: "Hipoteca", value: 90000, original: 120000, monthly: 600, amort: 300, asOf: 2026 * 12 + 10, day: 5, account: "sabadell" }],
    flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 2000, day: 28, to: "sabadell" },
      { id: "tr", kind: "transfer", name: "A Revolut", amount: 200, day: 15, from: "sabadell", to: "revolut" }]
  });
  await recibos.getByTestId("plan-due").locator(".pr6-sec-h .link").click();
  await expect(page.locator(".v4-bills-hero-sub")).toContainText("De 3 recibos");
});

const saldoVisto = (page) => page.evaluate(() => { const s = mcLoadRaw(mcStateKey()), i = insumosSaldoGasto(s); return s.accounts.map((a) => +saldoCuentaMostrada(a, i).toFixed(2)); });

test("lo pagado de otra forma no lo resta ningún sitio del banco y marcarlo no mueve el saldo", async ({ page }) => {
  // Luz (día 25) se pagó por otro lado el 18; Agua (día 3) ya vencida: el calendario la daba por cobrada.
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "Luz", 50, 25), recibo("agua", "Agua", 28.15, 3)] });
  const antes = await saldoVisto(page);
  for (const id of ["luz", "agua"]) {
    await recibos.locator(`[data-recibo="fixed_${id}"]`).first().click();
    const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
    await ficha.locator('[data-act="pagado"]').click();
    await ficha.locator('[data-act="a-mano"]').click();
    await expect(ficha).toHaveCount(0);
  }
  await expect.poll(() => saldoVisto(page)).toEqual(antes);
  const r = await page.evaluate(() => {
    const s = mcLoadRaw(mcStateKey()), luz = s.fixed.find((e) => e.id === "luz");
    return { walk: pendingWalkEvents(s, 2026, 10, 18).filter((e) => e.bank === "sabadell").length,
      fuera: fixedPagadoFuera(s, luz, 2026, 10, 18), netAntes: monthNetForAccount(s, "sabadell", 2026, 10, 18), netDia26: monthNetForAccount(s, "sabadell", 2026, 10, 26) };
  });
  // Ni «¿Te llega?» ni el saldo de la cuenta lo restan: el día 26 la cuenta no pierde los 50 €.
  expect(r).toEqual({ walk: 0, fuera: true, netAntes: r.netAntes, netDia26: r.netAntes });
  // Y nada queda por pagar en Recibos. `totals` (pendiente y previsto) lee la misma `fixedPagadoFuera`.
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(0)));
});

test("Deshacer tras devolver un saltado con su saldo compensado deja la cuenta como estaba", async ({ page }) => {
  const YM = 2026 * 12 + 10;
  const recibos = await abrePlan(page, { fixed: [recibo("com", "Comunidad", 75, 3, { pausedFrom: YM, pausedUntil: YM + 1,
    manualPauseBalance: { schema: 1, origin: "manual-v1", ym: YM, accountId: "bank", ent: "sabadell" } }), recibo("luz", "Luz", 50, 25)] });
  const antes = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return { fila: s.fixed[0], value: s.accounts[0].value }; });
  const visto = await saldoVisto(page);
  const pagados = recibos.getByTestId("plan-paid");
  await pagados.locator(".pr6-paid-h").click();
  await pagados.locator('[data-pausado="1"][data-recibo="fixed_com"]').click();
  await recibos.getByTestId("plan-deshacer").getByRole("button", { name: "Deshacer" }).click();
  await expect.poll(() => page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return { fila: s.fixed[0], value: s.accounts[0].value }; })).toEqual(antes);
  expect(await saldoVisto(page)).toEqual(visto);
});

test("la marca a mano se mezcla mes a mes entre dos móviles", async ({ page }) => {
  await abrePlan(page, { fixed: [] });
  const r = await page.evaluate(() => {
    const base = [{ id: "luz", name: "Luz", amount: 50, day: 25, account: "sabadell" }];
    const local = [Object.assign({}, base[0], { pagadoAMano: { 24322: 18 } })];
    const viejo = [Object.assign({}, base[0], { name: "Luz Iberdrola" })];
    const otroMes = [Object.assign({}, base[0], { pagadoAMano: { 24321: 5 } })];
    const m = (b, l, rr, ln) => { const x = mergePlanThreeWay(b, l, rr, "fixed", null, ln); return { mark: x.rows[0].pagadoAMano || null, conflicts: x.conflicts.length }; };
    return { viejo: m(base, local, viejo), dosMeses: m(base, local, otroMes), sinBase: m(null, local, viejo, false) };
  });
  expect(r).toEqual({ viejo: { mark: { 24322: 18 }, conflicts: 0 }, dosMeses: { mark: { 24321: 5, 24322: 18 }, conflicts: 0 },
    sinBase: { mark: { 24322: 18 }, conflicts: 0 } });
});
