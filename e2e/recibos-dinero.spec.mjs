import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos: lo que mueve dinero o cifras (auditoría 9/11/2026). «Lo pagué de otra forma»
   (SPEC §2.6.3) con Desmarcar y Deshacer, devolver un recibo saltado con Deshacer y el aviso de
   dónde cae, «Ya no lo tengo» con Deshacer y el día 31 en un mes de 30. Todo sale del estado sembrado: se mira el DOM y lo guardado. */
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

test("Deshacer tras devolver un saltado avisa si la fila cambió entretanto", async ({ page }) => {
  const YM = 2026 * 12 + 10;
  const recibos = await abrePlan(page, { fixed: [recibo("com", "Comunidad", 75, 3, { pausedFrom: YM, pausedUntil: YM + 1,
    manualPauseBalance: { schema: 1, origin: "manual-v1", ym: YM, accountId: "bank", ent: "sabadell" } }), recibo("luz", "Luz", 50, 25)] });
  const pagados = recibos.getByTestId("plan-paid");
  await pagados.locator(".pr6-paid-h").click();
  await pagados.locator('[data-pausado="1"][data-recibo="fixed_com"]').click();
  await expect(recibos.getByTestId("plan-review").locator('[data-recibo="fixed_com"]')).toHaveCount(1);
  // Entretanto la fila cambia por otro camino (aquí, pausándola otra vez desde su ficha; en la vida
  // real suele ser una sync): el Deshacer ya no puede reponer la foto y lo tiene que decir.
  await recibos.getByTestId("plan-review").locator('[data-recibo="fixed_com"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await ficha.locator('[data-act="pausar"]').click();
  await ficha.locator('[data-pausa="h2"]').click();
  await expect(ficha).toHaveCount(0);
  const tras = await page.evaluate(() => mcLoadRaw(mcStateKey()).fixed[0].pausedUntil);
  await recibos.getByTestId("plan-deshacer").getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByText("No se pudo deshacer: ha cambiado mientras tanto")).toBeVisible();
  expect(await page.evaluate(() => mcLoadRaw(mcStateKey()).fixed[0].pausedUntil)).toBe(tras);
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

test("¿Te llega?: un traspaso entre bancos propios resta en el que sale y suma en el que llega", async ({ page }) => {
  // Hecho a mano. Sabadell 3.000 → −200 (día 15) → −50 (Luz, día 25) = 2.750.
  // Revolut 20 → +200 (día 15) → −31,99 (Netflix, día 20) = 188,01. Suma: 2.938,01, con traspaso o sin él.
  const recibos = await abrePlan(page, {
    accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }, { id: "rev", ent: "revolut", role: "fijos", value: 20 }],
    fixed: [recibo("luz", "Luz", 50, 25), recibo("nfx", "Netflix", 31.99, 20, { account: "revolut" })],
    flows: [{ id: "tr", kind: "transfer", name: "A Revolut", amount: 200, day: 15, from: "sabadell", to: "revolut" }],
    trasAbonoDesde: 20261101
  }, "2026-11-09T12:00:00+01:00");
  const banco = (ent) => page.getByTestId("llega-sheet").locator('[data-testid="llega-banco"][data-bank="' + ent + '"]');
  // Saldo pintado y fin del recorrido de cada banco, leídos del estado guardado con el motor de la app.
  const cifras = (dia) => page.evaluate((d) => {
    const s = mcLoadRaw(mcStateKey()), r = {};
    ["sabadell", "revolut"].forEach((b) => {
      const hoy = s.accounts.find((a) => a.ent === b).value + monthNetForAccount(s, b, 2026, 11, d);
      r[b] = [Math.round(hoy * 100), Math.round(minWalk(hoy, bankPendingEvents(s, b, 2026, 11, d)).end * 100)];
    });
    return r;
  }, dia);
  await recibos.getByTestId("plan-llega").click();
  await expect(banco("revolut")).toContainText("+ 200,00 €");
  await expect(banco("revolut")).toContainText("Tienes hoy");
  await expect(banco("revolut").getByTestId("llega-cifra")).toContainText("20,00 €");
  await expect(banco("sabadell")).toContainText("− 200,00 €");
  await expect(banco("sabadell").getByTestId("llega-cifra")).toContainText("2.750,00 €");
  expect(await cifras(9)).toEqual({ sabadell: [300000, 275000], revolut: [2000, 18801] });
  // Pasado el día 15 el dinero ya está en Revolut y a fin de mes queda lo mismo: nada salta.
  await page.clock.setSystemTime(new Date("2026-11-16T12:00:00+01:00"));
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator('.page-live .v4-screen > [data-seg="recibos"]').getByTestId("plan-llega").click();
  await expect(banco("revolut")).toContainText("220,00 €");
  await expect(banco("revolut").getByTestId("llega-cifra")).toContainText("188,01 €");
  await expect(banco("revolut")).not.toContainText("+ 200,00 €");
  await expect(banco("sabadell")).toContainText("2.800,00 €");
  await expect(banco("sabadell").getByTestId("llega-cifra")).toContainText("2.750,00 €");
  expect(await cifras(16)).toEqual({ sabadell: [280000, 275000], revolut: [22000, 18801] });
});
