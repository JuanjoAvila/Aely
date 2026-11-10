import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos v6, tanda 6 (docs/design/plan-recibos/SPEC.md §2.1, §2.2 y §9): resumen del mes
   cerrado, vista del mes siguiente y primer uso. Son listas y cifras derivadas del estado
   (`planRecibosMesCerrado` sobre la foto del mes, `planChargesMonth` del mes siguiente,
   `rp4VistoEnBanco`): aquí se mira lo que se pinta, no el código (AGENTS §7). Los casos marcados
   con «(revisión)» son los de la revisión NO-GO del 31/10/2026 y fallan con el código de antes. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const recibo = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const book = (id, merchant, date, amount) => ({ id, ent: "sabadell", date, amount, merchant, status: "BOOK" });
const cuenta = [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }];
const eurDe = (page, n) => page.evaluate((x) => eur(x), n);

async function entraEnPlan(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
async function abrePlan(page, hoy, overrides, s) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date(hoy) });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: hoy.slice(0, 10), bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], settings: s || settings }, overrides));
  await page.goto("/");
  return entraEnPlan(page);
}
// Plan guarda la foto del mes al pintarlo; se espera a que esté en el almacén antes de cambiar de día.
async function conFoto(page, ym) {
  await expect.poll(() => page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
    return !!(s.settings && s.settings.pr6Fotos && s.settings.pr6Fotos[k]);
  }, ym)).toBe(true);
}
async function otroDia(page, iso) {
  await page.clock.setSystemTime(new Date(iso));
  await page.reload();
  return entraEnPlan(page);
}

/* La luz (Iberdrola) cambia cada mes (50 previsto): 49,60 en sep y 50,40 en oct → «más que sep».
   Netflix 12,99: en oct cobró 13,49 (dentro de la tolerancia del casado, 0,50 de más) → «subió».
   Gimnasio 40: en sep sí, en oct no llegó. Octubre = 50 + 12,99 = 62,99; septiembre = 102,99. */
const fixed = [recibo("luz", "Iberdrola", 50, 5, { variable: true }), recibo("nfx", "Netflix", 12.99, 10), recibo("gym", "Gimnasio", 40, 2)];
const bankTx = [
  book("s1", "Iberdrola", "2026-09-05", 49.6), book("s2", "Netflix", "2026-09-10", 12.99), book("s3", "Gimnasio", "2026-09-02", 40),
  book("o1", "Iberdrola", "2026-10-05", 50.4), book("o2", "Netflix", "2026-10-10", 13.49),
];
const SEP = 2026 * 12 + 9, OCT = 2026 * 12 + 10;
// Septiembre y octubre vistos su último día, y luego el 3/11.
async function mesesVistos(page, overrides, antesDeOctubre) {
  await abrePlan(page, "2026-09-30T20:00:00+02:00", Object.assign({ accounts: cuenta, fixed, bankTx }, overrides));
  await conFoto(page, SEP);
  if (antesDeOctubre) await page.evaluate(antesDeOctubre);
  await otroDia(page, "2026-10-31T20:00:00+01:00");
  await conFoto(page, OCT);
  return otroDia(page, "2026-11-03T12:00:00+01:00");
}

test("mes cerrado: cifra, comparación y detalle en una línea; la × lo pliega y no vuelve", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  const recibos = await mesesVistos(page, {});
  const card = recibos.getByTestId("plan-cerrado");
  await expect(card).toContainText("Octubre cerrado");
  const linea = card.getByTestId("plan-cerrado-linea"), vs = card.getByTestId("plan-cerrado-vs");
  await expect(linea).toHaveText(await eurDe(page, 62.99) + " en recibos");
  await expect(vs).toHaveText("−" + await eurDe(page, 40) + " vs. sep");
  // (revisión) Cada renglón en una sola línea a 393 px.
  for (const l of [linea, vs]) {
    const alto = await l.evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || "18"));
    expect(alto).toBeLessThan(1.5);
  }
  // (revisión) Dianas de 44 px como mínimo.
  for (const b of [card.getByTestId("plan-cerrado-x"), recibos.getByTestId("plan-mes-nav")]) {
    const box = await b.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const det = card.locator(".pr6-cerr-row:not([inert] *)");
  await expect(det).toHaveCount(0);
  await card.getByRole("button", { name: /Octubre cerrado/ }).click();
  await expect(det).toHaveCount(3);
  const filas = card.locator(".pr6-cerr-row");
  await expect(filas.nth(0)).toHaveAttribute("data-linea", "sube");
  await expect(filas.nth(0)).toContainText("Iberdrola, más que septiembre");
  await expect(filas.nth(0)).toContainText("+" + await eurDe(page, 0.8));
  await expect(filas.nth(1)).toContainText("Netflix subió");
  await expect(filas.nth(1)).toContainText("+" + await eurDe(page, 0.5));
  await expect(filas.nth(2)).toContainText("Recibos que no llegaron");
  await expect(filas.nth(2)).toContainText("1");

  await card.getByTestId("plan-cerrado-x").click();
  await expect(recibos.locator(".pr6-cz")).toHaveClass(/fuera/);
  await expect(recibos.getByTestId("plan-cerrado")).toHaveCount(0, { timeout: 3000 });
  const otra = await otroDia(page, "2026-11-03T13:00:00+01:00");
  await expect(otra.getByTestId("plan-summary")).toBeVisible();
  await expect(otra.getByTestId("plan-cerrado")).toHaveCount(0);
});

test("mes cerrado (revisión): un recibo borrado en octubre no le cambia la cifra a septiembre", async ({ page }) => {
  const recibos = await mesesVistos(page, {}, () => {
    const s = JSON.parse(localStorage.getItem("micartera_v3"));
    s.fixed = s.fixed.filter((f) => f.id !== "gym");
    localStorage.setItem("micartera_v3", JSON.stringify(s));
  });
  // Octubre sin el Gimnasio (ya no estaba): 62,99. Septiembre, como fue: 102,99 → −40,00.
  await expect(recibos.getByTestId("plan-cerrado-linea")).toHaveText(await eurDe(page, 62.99) + " en recibos");
  await expect(recibos.getByTestId("plan-cerrado-vs")).toHaveText("−" + await eurDe(page, 40) + " vs. sep");
});

/* Rechazo de la beta 206 (1/11/2026): «salía pero no salía el vs». Septiembre no tiene foto (la
   foto llegó con la 205). Si todo lo de septiembre está pagado con prueba, la comparación sale con
   su cifra; si a uno le falta la prueba, sale el porqué en una línea. Nunca desaparece. */
test("mes cerrado (rechazo 206): sin foto de septiembre pero todo pagado, la comparación sale", async ({ page }) => {
  await abrePlan(page, "2026-10-31T20:00:00+01:00", { accounts: cuenta, fixed, bankTx });
  await conFoto(page, OCT);
  const recibos = await otroDia(page, "2026-11-03T12:00:00+01:00");
  await expect(recibos.getByTestId("plan-cerrado-linea")).toHaveText(await eurDe(page, 62.99) + " en recibos");
  await expect(recibos.getByTestId("plan-cerrado-vs")).toHaveText("−" + await eurDe(page, 40) + " vs. sep");
});

test("mes cerrado (rechazo 206): sin foto y con un recibo de septiembre sin prueba, dice por qué", async ({ page }) => {
  // El cargo de Netflix de septiembre ya no está en el extracto y no quedó prueba guardada.
  await abrePlan(page, "2026-10-31T20:00:00+01:00", { accounts: cuenta, fixed, bankTx: bankTx.filter((x) => x.id !== "s2") });
  await conFoto(page, OCT);
  const recibos = await otroDia(page, "2026-11-03T12:00:00+01:00");
  await expect(recibos.getByTestId("plan-cerrado-linea")).toHaveText(await eurDe(page, 62.99) + " en recibos");
  await expect(recibos.getByTestId("plan-cerrado-vs")).toHaveText("vs. sep: sin datos de septiembre");
});

test("mes cerrado sin cifra (auditoría 222, P2-7): octubre sin foto y con un recibo sin prueba, la tarjeta no sale", async ({ page }) => {
  // Octubre no se abrió (sin foto) y el gimnasio no tiene cargo: no se puede decir cuánto se fue en recibos.
  // Antes salía «— en recibos · vs. sep: sin datos de octubre», una tarjeta sin un solo dato.
  await abrePlan(page, "2026-09-30T20:00:00+02:00", { accounts: cuenta, fixed, bankTx });
  await conFoto(page, SEP);
  const recibos = await otroDia(page, "2026-11-03T12:00:00+01:00");
  await expect(recibos.getByTestId("plan-summary")).toBeVisible();
  await expect(recibos.getByTestId("plan-cerrado")).toHaveCount(0);
});

test("mes cerrado (revisión t6-vs): todos dados de alta en octubre, la comparación dice que septiembre no tenía recibos", async ({ page }) => {
  const nuevos = fixed.map((f) => Object.assign({}, f, { createdYm: OCT }));
  await abrePlan(page, "2026-10-31T20:00:00+01:00", { accounts: cuenta, fixed: nuevos, bankTx });
  await conFoto(page, OCT);
  const recibos = await otroDia(page, "2026-11-03T12:00:00+01:00");
  await expect(recibos.getByTestId("plan-cerrado-linea")).toHaveText(await eurDe(page, 62.99) + " en recibos");
  await expect(recibos.getByTestId("plan-cerrado-vs")).toHaveText("vs. sep: sin recibos en septiembre");
});

test("mes cerrado (revisión): lo marcado a mano como pagado no es «no llegó»", async ({ page }) => {
  const marcado = fixed.map((f) => f.id === "gym" ? Object.assign({}, f, { paidYm: OCT, paidDay: 2 }) : f);
  const recibos = await mesesVistos(page, { fixed: marcado });
  const card = recibos.getByTestId("plan-cerrado");
  await card.getByRole("button", { name: /Octubre cerrado/ }).click();
  await expect(card.locator(".pr6-cerr-row")).toHaveCount(2);
  await expect(card.locator('[data-linea="no"]')).toHaveCount(0);
});

test("mes cerrado: cuadra con lo que se vio el último día de octubre", async ({ page }) => {
  // «Ya pagados» 50 (la luz, que cobró 50,40: lo dice su fila, la cabecera solo suma) + Netflix en «Para revisar» con su
  // previsión de 12,99 = los 62,99 del resumen; el Gimnasio, «No ha llegado».
  const recibos = await abrePlan(page, "2026-10-31T20:00:00+01:00", { accounts: cuenta, fixed, bankTx });
  await expect(recibos.getByTestId("plan-paid").locator(".pr6-paid-amt")).toHaveText(await eurDe(page, 50));
  const review = recibos.getByTestId("plan-review");
  await expect(review.locator('[data-review="diff"]')).toContainText("Netflix");
  await expect(review.locator('[data-review="diff"]')).toContainText("Esperabas " + await eurDe(page, 12.99));
  await expect(review.locator('[data-review="late"]')).toContainText("Gimnasio");
  await expect(recibos.getByTestId("plan-cerrado")).toHaveCount(0);
});

test("mes cerrado: pasado el día 7 ya no sale", async ({ page }) => {
  await abrePlan(page, "2026-10-31T20:00:00+01:00", { accounts: cuenta, fixed, bankTx });
  await conFoto(page, OCT);
  const recibos = await otroDia(page, "2026-11-08T12:00:00+01:00");
  await expect(recibos.getByTestId("plan-summary")).toBeVisible();
  await expect(recibos.getByTestId("plan-cerrado")).toHaveCount(0);
});

test("«Dic ›»: tarjeta y lista del mes siguiente, sin revisar ni pagados; «‹ Nov» vuelve", async ({ page }) => {
  const recibos = await abrePlan(page, "2026-11-03T12:00:00+01:00", { accounts: cuenta, fixed, bankTx });
  const sum = recibos.getByTestId("plan-summary");
  const nav = sum.getByTestId("plan-mes-nav");
  await expect(nav).toHaveText("Dic ›");
  // Sin nada pagado aún no hay fila de «Ya pagados» (auditoría de Recibos, parte b).
  await expect(recibos.getByTestId("plan-due")).toHaveCount(1);
  await expect(recibos.getByTestId("plan-paid")).toHaveCount(0);
  await nav.click();
  // (revisión) Entra de lado TODA la vista, no solo la tarjeta: el contenedor de tarjeta y lista
  // se anima hacia la izquierda (el mes siguiente llega desde la derecha).
  const entra = await recibos.locator(".pr6-vistas").evaluate((el) => el.getAnimations().map((a) => a.effect.getKeyframes()[0].transform));
  expect(entra).toEqual(["translateX(16px)"]);
  await expect(recibos.locator(".pr6-vistas").getByTestId("plan-due")).toHaveCount(1);
  await expect(sum).toHaveAttribute("data-vista", "sig");
  await expect(sum.locator(".v4-micro")).toHaveText(/Se te van en diciembre/i);
  await expect(sum.locator(".serif.num")).toHaveText(await eurDe(page, 102.99));
  await expect(recibos.getByTestId("plan-count")).toHaveText("3 recibos");
  await expect(recibos.getByTestId("plan-llega")).toHaveCount(0);
  await expect(recibos.getByTestId("plan-review")).toHaveCount(0);
  await expect(recibos.getByTestId("plan-paid")).toHaveCount(0);
  const due = recibos.getByTestId("plan-due");
  await expect(due.locator(".pr6-sec-h")).toContainText("En diciembre");
  const filas = due.locator(".v4-charge");
  await expect(filas).toHaveCount(3);
  await expect(filas.nth(0)).toContainText("Gimnasio");
  await expect(filas.nth(0).locator(".dt .m")).toHaveText("Dic");
  await expect(filas.nth(0)).toContainText("en 29 días");
  await expect(filas.filter({ hasText: "Iberdrola" }).locator(".am")).toHaveText("≈ " + await eurDe(page, 50));
  // Tocar un recibo del mes siguiente abre su edición, no la ficha de este mes.
  await filas.filter({ hasText: "Netflix" }).click();
  await expect(page.locator('.v4-sheet[data-sheet="recibo-pasos"]')).toHaveAttribute("data-modo", "edit");
  // La hoja no atiende Escape en sus primeros fotogramas: con el toque y la tecla juntos la primera se perdía (arnés; a mano no se da).
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await expect(page.locator('.v4-sheet[data-sheet="recibo-pasos"]')).toHaveCount(0, { timeout: 5000 });

  await expect(nav).toHaveText("‹ Nov");
  await nav.click();
  await expect(sum).toHaveAttribute("data-vista", "mes");
  await expect(sum.locator(".v4-micro")).toHaveText(/Queda por pagar en noviembre/i);
  await expect(recibos.getByTestId("plan-due").locator(".v4-charge")).not.toHaveCount(0);
});

test("«Dic ›» (revisión): el atrás vuelve primero a noviembre y salir de Plan también", async ({ page }) => {
  const recibos = await abrePlan(page, "2026-11-03T12:00:00+01:00", { accounts: cuenta, fixed, bankTx });
  const sum = recibos.getByTestId("plan-summary");
  await sum.getByTestId("plan-mes-nav").click();
  await expect(sum).toHaveAttribute("data-vista", "sig");
  // Lo que hace el botón atrás de la APK (`backButton` en 11-app-main).
  expect(await page.evaluate(() => _mcBackCloseNative())).toBeTruthy();
  await expect(sum).toHaveAttribute("data-vista", "mes");
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
  // Con diciembre puesto, ir a Gastos y volver deja Plan en noviembre.
  await sum.getByTestId("plan-mes-nav").click();
  await expect(sum).toHaveAttribute("data-vista", "sig");
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('.page-live .v4-screen > [data-seg="recibos"]').getByTestId("plan-summary")).toHaveAttribute("data-vista", "mes");
});

test("«Dic ›» (revisión): en catalán, «A l'abril»", async ({ page }) => {
  const recibos = await abrePlan(page, "2026-03-15T12:00:00+01:00", { accounts: cuenta, fixed, bankTx }, Object.assign({}, settings, { lang: "ca" }));
  await recibos.getByTestId("plan-mes-nav").click();
  await expect(recibos.getByTestId("plan-due").locator(".pr6-sec-h")).toContainText("A l'abril");
});

test("primer uso sin cargos en el banco: «Empezar» abre el alta por pasos", async ({ page }) => {
  const recibos = await abrePlan(page, "2026-11-03T12:00:00+01:00", { accounts: cuenta, fixed: [] });
  const onb = recibos.getByTestId("plan-onb");
  await expect(onb).toContainText("Aún no tienes recibos");
  await expect(recibos.getByTestId("plan-summary")).toHaveCount(0);
  await expect(recibos.getByTestId("plan-due")).toHaveCount(0);
  await onb.getByTestId("plan-empezar").click();
  const hoja = page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
  await expect(hoja).toBeVisible();
  await expect(hoja).toHaveAttribute("data-modo", "add");
});

const ob = (id, merchant, date, amount) => ({ id, merchant, date, amount, ent: "sabadell", category: "otros", source: "ob", status: "BOOK" });
const repetidos = [
  ob("sp8", "Spotify", "2026-08-12", 10.99), ob("sp9", "Spotify", "2026-09-12", 10.99), ob("sp10", "Spotify", "2026-10-12", 10.99),
  ob("se8", "Mapfre Seguros", "2026-08-03", 31.5), ob("se9", "Mapfre Seguros", "2026-09-03", 31.5), ob("se10", "Mapfre Seguros", "2026-10-03", 31.5),
  // Netflix subió en octubre: se propone lo último que cobró (revisión).
  ob("nf8", "Netflix", "2026-08-20", 12.99), ob("nf9", "Netflix", "2026-09-20", 12.99), ob("nf10", "Netflix", "2026-10-20", 13.99),
  // Con un mes en blanco (julio, septiembre y octubre) puede no ser mensual: no se propone.
  ob("ag7", "Aguas Municipales", "2026-07-20", 22), ob("ag9", "Aguas Municipales", "2026-09-20", 22), ob("ag10", "Aguas Municipales", "2026-10-20", 22),
];

test("primer uso con cargos repetidos: importa los que se cobran todos los meses, con el último importe", async ({ page }) => {
  const recibos = await abrePlan(page, "2026-11-01T12:00:00+01:00", { accounts: cuenta, fixed: [], expenses: repetidos });
  const onb = recibos.getByTestId("plan-onb");
  await expect(onb).toContainText("3 cargos que se repiten");
  await expect(onb).toContainText("en Sabadell");
  await onb.getByTestId("plan-empezar").click();
  const imp = page.getByTestId("plan-import");
  await expect(imp.locator("h2")).toHaveText("3 de 3 son recibos");
  const filas = imp.getByTestId("plan-import-row");
  await expect(filas).toHaveCount(3);
  await expect(filas.nth(0)).toContainText("Mapfre Seguros");
  await expect(filas.nth(0)).toContainText("día 3");
  await expect(filas.filter({ hasText: "Netflix" })).toContainText(await eurDe(page, 13.99));
  await imp.getByTestId("plan-import-todos").click();
  await expect(imp.getByTestId("plan-import-ok")).toBeDisabled();
  await expect(imp.getByTestId("plan-import-todos")).toHaveText("Marcar todos");
  await imp.getByTestId("plan-import-todos").click();
  await filas.nth(0).click();
  await expect(filas.nth(0)).toHaveAttribute("aria-checked", "false");
  await expect(imp.locator("h2")).toHaveText("2 de 3 son recibos");
  await imp.getByTestId("plan-import-ok").click();
  await expect(page.locator(".toast")).toHaveText("2 recibos añadidos");
  await expect(imp).toHaveCount(0, { timeout: 5000 });
  await expect(recibos.getByTestId("plan-onb")).toHaveCount(0);
  const due = recibos.getByTestId("plan-due");
  await expect(due.locator(".v4-charge")).toHaveCount(2);
  await expect(due.locator(".v4-charge").first()).toContainText("Spotify");
  // (revisión) Lo dado de alta hoy no existía en octubre: no hay «Octubre cerrado» que diga que no llegó.
  await expect(recibos.getByTestId("plan-cerrado")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("micartera_v3")).fixed || []).length)).toBe(2);
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).fixed);
  expect(guardado.find((f) => f.name === "Spotify")).toMatchObject({ amount: 10.99, freq: "mes", day: 12, account: "sabadell", createdYm: 2026 * 12 + 11 });
  expect(guardado.find((f) => f.name === "Netflix")).toMatchObject({ amount: 13.99 });
});

test("primer uso (revisión): doble toque en «Añadir» no abre Apuntar y la hoja baja con animación", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  const recibos = await abrePlan(page, "2026-11-01T12:00:00+01:00", { accounts: cuenta, fixed: [], expenses: repetidos });
  await recibos.getByTestId("plan-empezar").click();
  const imp = page.getByTestId("plan-import");
  const ok = imp.getByTestId("plan-import-ok");
  await expect(ok).toBeVisible();
  await page.waitForTimeout(500);
  const box = await ok.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  // Tras el primer toque la hoja sigue ahí, bajando: no desaparece de golpe.
  await expect(imp).toHaveCount(1);
  await page.waitForTimeout(120);
  await page.mouse.click(x, y);
  await expect(imp).toHaveCount(0, { timeout: 5000 });
  await page.waitForTimeout(400);
  await expect(page.locator(".v4-exp-sheet")).toHaveCount(0);
  await expect(recibos.getByTestId("plan-due").locator(".v4-charge")).toHaveCount(3);
});

test("foto (revisión R2-2): volver a primer plano sin cambios no reescribe el estado", async ({ page }) => {
  const recibos = await abrePlan(page, "2026-10-31T20:00:00+01:00", { accounts: cuenta, fixed, bankTx });
  await conFoto(page, OCT);
  await expect(recibos.getByTestId("plan-summary")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.__w = 0;
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) { if (k === "micartera_v3") window.__w++; return orig(k, v); };
  });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(700);
  }
  expect(await page.evaluate(() => window.__w)).toBe(0);
});
