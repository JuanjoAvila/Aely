import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos v6, tanda 6 (docs/design/plan-recibos/SPEC.md §2.1, §2.2 y §9): resumen del mes
   cerrado, vista del mes siguiente «Nov ›» y primer uso. Son listas y cifras derivadas del estado
   (`planRecibosMesCerrado`, `planChargesMonth` del mes siguiente, `rp4VistoEnBanco`): aquí se mira
   lo que se pinta, no el código (AGENTS §7). */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const recibo = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const book = (id, merchant, date, amount) => ({ id, ent: "sabadell", date, amount, merchant, status: "BOOK" });
const cuenta = [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }];

async function abrePlan(page, hoy, overrides) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date(hoy) });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: hoy.slice(0, 10), bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], settings }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}

/* La luz (Iberdrola) cambia cada mes (50 previsto): 49,60 en sep y 50,40 en oct → «más que septiembre +0,80».
   Netflix 12,99: en oct cobró 13,49 (dentro de la tolerancia del casado, 0,50 de más) → «subió».
   Gimnasio 40: en sep sí, en oct no llegó. Octubre = 50 + 12,99 = 62,99; septiembre = 102,99. */
const fixed = [recibo("luz", "Iberdrola", 50, 5, { variable: true }), recibo("nfx", "Netflix", 12.99, 10), recibo("gym", "Gimnasio", 40, 2)];
const bankTx = [
  book("s1", "Iberdrola", "2026-09-05", 49.6), book("s2", "Netflix", "2026-09-10", 12.99), book("s3", "Gimnasio", "2026-09-02", 40),
  book("o1", "Iberdrola", "2026-10-05", 50.4), book("o2", "Netflix", "2026-10-10", 13.49),
];

test("mes cerrado: cifra, comparación y detalle; la × lo pliega y no vuelve", async ({ page }) => {
  const recibos = await abrePlan(page, "2026-11-03T12:00:00+01:00", { accounts: cuenta, fixed, bankTx });
  const card = recibos.getByTestId("plan-cerrado");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Octubre cerrado");
  const linea = await page.evaluate(() => eur(62.99) + " en recibos · " + eur(40) + " menos que septiembre");
  await expect(card.getByTestId("plan-cerrado-linea")).toHaveText(linea);
  // Plegado de salida: el detalle está pero fuera del foco.
  const det = card.locator(".pr6-cerr-row:not([inert] *)");
  await expect(det).toHaveCount(0);
  await card.getByRole("button", { name: /Octubre cerrado/ }).click();
  await expect(det).toHaveCount(3);
  const filas = card.locator(".pr6-cerr-row");
  await expect(filas.nth(0)).toHaveAttribute("data-linea", "sube");
  await expect(filas.nth(0)).toContainText("Iberdrola, más que septiembre");
  await expect(filas.nth(0)).toContainText("+" + await page.evaluate(() => eur(0.8)));
  await expect(filas.nth(1)).toContainText("Netflix subió");
  await expect(filas.nth(1)).toContainText("+" + await page.evaluate(() => eur(0.5)));
  await expect(filas.nth(2)).toContainText("Recibos que no llegaron");
  await expect(filas.nth(2)).toContainText("1");

  await card.getByTestId("plan-cerrado-x").click();
  await expect(recibos.locator(".pr6-cz")).toHaveClass(/fuera/);
  await expect(recibos.getByTestId("plan-cerrado")).toHaveCount(0, { timeout: 3000 });
  // El descarte es de octubre y queda guardado: al volver a abrir no sale.
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(recibos.getByTestId("plan-summary")).toBeVisible();
  await expect(recibos.getByTestId("plan-cerrado")).toHaveCount(0);
});

/* La otra cara: lo que Plan enseñaba el 31 de octubre con los mismos datos. «Ya pagados» 50,00
   (la luz) + Netflix, que cobró distinto y estaba en «Para revisar» con su previsión de 12,99 =
   los 62,99 del resumen; el Gimnasio, «No ha llegado». */
test("mes cerrado: cuadra con lo que se vio el último día de octubre", async ({ page }) => {
  const recibos = await abrePlan(page, "2026-10-31T20:00:00+01:00", { accounts: cuenta, fixed, bankTx });
  // «Previsto 50,00 €»: la luz cobró 50,40 y la fila enseña la previsión, como el resumen.
  await expect(recibos.getByTestId("plan-paid").locator(".pr6-paid-amt")).toHaveText("Previsto " + await page.evaluate(() => eur(50)));
  const review = recibos.getByTestId("plan-review");
  await expect(review.locator('[data-review="diff"]')).toContainText("Netflix");
  await expect(review.locator('[data-review="diff"]')).toContainText("Esperabas " + await page.evaluate(() => eur(12.99)));
  await expect(review.locator('[data-review="late"]')).toContainText("Gimnasio");
  await expect(recibos.getByTestId("plan-cerrado")).toHaveCount(0);
});

test("mes cerrado: pasado el día 7 ya no sale", async ({ page }) => {
  const recibos = await abrePlan(page, "2026-11-08T12:00:00+01:00", { accounts: cuenta, fixed, bankTx });
  await expect(recibos.getByTestId("plan-summary")).toBeVisible();
  await expect(recibos.getByTestId("plan-cerrado")).toHaveCount(0);
});

test("«Dic ›»: tarjeta y lista del mes siguiente, sin revisar ni pagados; «‹ Nov» vuelve", async ({ page }) => {
  const recibos = await abrePlan(page, "2026-11-03T12:00:00+01:00", { accounts: cuenta, fixed, bankTx });
  const sum = recibos.getByTestId("plan-summary");
  const nav = sum.getByTestId("plan-mes-nav");
  await expect(nav).toHaveText("Dic ›");
  await expect(recibos.getByTestId("plan-paid")).toHaveCount(1);
  await nav.click();
  await expect(sum).toHaveAttribute("data-vista", "sig");
  await expect(sum.locator(".v4-micro")).toHaveText(/Se te van en diciembre/i);
  // Diciembre entero, nada cobrado aún: 50 + 12,99 + 40.
  await expect(sum.locator(".serif.num")).toHaveText(await page.evaluate(() => eur(102.99)));
  await expect(recibos.getByTestId("plan-count")).toHaveText("3 recibos");
  await expect(recibos.getByTestId("plan-llega")).toHaveCount(0);
  await expect(recibos.getByTestId("plan-review")).toHaveCount(0);
  await expect(recibos.getByTestId("plan-paid")).toHaveCount(0);
  // El resumen de octubre se pliega en la vista del mes siguiente.
  await expect(recibos.locator(".pr6-cz")).toHaveClass(/fuera/);
  const due = recibos.getByTestId("plan-due");
  await expect(due.locator(".pr6-sec-h")).toContainText("En diciembre");
  const filas = due.locator(".v4-charge");
  await expect(filas).toHaveCount(3);
  await expect(filas.nth(0)).toContainText("Gimnasio");
  await expect(filas.nth(0).locator(".dt .m")).toHaveText("Dic");
  await expect(filas.nth(0)).toContainText("en 29 días");
  // La luz cambia cada mes: su cifra es una estimación.
  await expect(filas.filter({ hasText: "Iberdrola" }).locator(".am")).toHaveText("≈ " + await page.evaluate(() => eur(50)));
  // Tocar un recibo del mes siguiente abre su edición, no la ficha de este mes.
  await filas.filter({ hasText: "Netflix" }).click();
  await expect(page.locator('.v4-sheet[data-sheet="recibo-pasos"]')).toBeVisible();
  await expect(page.locator('.v4-sheet[data-sheet="recibo-pasos"]')).toHaveAttribute("data-modo", "edit");
  await page.keyboard.press("Escape");
  await expect(page.locator('.v4-sheet[data-sheet="recibo-pasos"]')).toHaveCount(0, { timeout: 5000 });

  await expect(nav).toHaveText("‹ Nov");
  await nav.click();
  await expect(sum).toHaveAttribute("data-vista", "mes");
  await expect(sum.locator(".v4-micro")).toHaveText(/Queda por pagar en noviembre/i);
  await expect(recibos.getByTestId("plan-paid")).toHaveCount(1);
  await expect(recibos.locator(".pr6-cz")).not.toHaveClass(/fuera/);
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

test("primer uso con cargos repetidos: importa los que se cobran todos los meses", async ({ page }) => {
  const ob = (id, merchant, date, amount) => ({ id, merchant, date, amount, ent: "sabadell", category: "otros", source: "ob", status: "BOOK" });
  const expenses = [
    ob("sp8", "Spotify", "2026-08-12", 10.99), ob("sp9", "Spotify", "2026-09-12", 10.99), ob("sp10", "Spotify", "2026-10-12", 10.99),
    ob("se8", "Mapfre Seguros", "2026-08-03", 31.5), ob("se9", "Mapfre Seguros", "2026-09-03", 31.5), ob("se10", "Mapfre Seguros", "2026-10-03", 31.5),
    // Con un mes en blanco (julio, septiembre y octubre) puede no ser mensual: no se propone.
    ob("ag7", "Aguas Municipales", "2026-07-20", 22), ob("ag9", "Aguas Municipales", "2026-09-20", 22), ob("ag10", "Aguas Municipales", "2026-10-20", 22),
  ];
  const recibos = await abrePlan(page, "2026-11-03T12:00:00+01:00", { accounts: cuenta, fixed: [], expenses });
  const onb = recibos.getByTestId("plan-onb");
  await expect(onb).toContainText("2 cargos que se repiten");
  await expect(onb).toContainText("en Sabadell");
  await onb.getByTestId("plan-empezar").click();
  const imp = page.getByTestId("plan-import");
  await expect(imp).toBeVisible();
  await expect(imp.locator("h2")).toHaveText("2 de 2 son recibos");
  const filas = imp.getByTestId("plan-import-row");
  await expect(filas).toHaveCount(2);
  // Ordenados por día: el seguro (día 3) antes que Spotify (día 12).
  await expect(filas.nth(0)).toContainText("Mapfre Seguros");
  await expect(filas.nth(0)).toContainText("día 3");
  await expect(filas.nth(1)).toContainText(await page.evaluate(() => eur(10.99)));
  await expect(imp.getByTestId("plan-import-todos")).toHaveText("Quitar todos");
  await imp.getByTestId("plan-import-todos").click();
  await expect(imp.getByTestId("plan-import-ok")).toBeDisabled();
  await expect(imp.getByTestId("plan-import-todos")).toHaveText("Marcar todos");
  await imp.getByTestId("plan-import-todos").click();
  await filas.nth(0).click();
  await expect(filas.nth(0)).toHaveAttribute("aria-checked", "false");
  await expect(imp.locator("h2")).toHaveText("1 de 2 son recibos");
  await imp.getByTestId("plan-import-ok").click();
  await expect(page.locator(".toast")).toHaveText("1 recibo añadido");
  await expect(imp).toHaveCount(0, { timeout: 5000 });
  // Ya hay un recibo: fuera el primer uso y Spotify en lo pendiente de noviembre, día 12.
  await expect(recibos.getByTestId("plan-onb")).toHaveCount(0);
  const due = recibos.getByTestId("plan-due");
  await expect(due.locator(".v4-charge")).toHaveCount(1);
  await expect(due.locator(".v4-charge")).toContainText("Spotify");
  await expect(due.locator(".v4-charge .dt .d")).toHaveText("12");
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(10.99)));
  // El guardado va con un poco de retraso: se espera a que llegue.
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("micartera_v3")).fixed || []).length)).toBe(1);
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).fixed);
  expect(guardado[0]).toMatchObject({ name: "Spotify", amount: 10.99, freq: "mes", day: 12, account: "sabadell" });
});
