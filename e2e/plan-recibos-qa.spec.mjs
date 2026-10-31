import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos: lo que el dueño encontró probando la beta 4.26.200 en su móvil («va guay pero hay
   montón de bugs»). Cada prueba abre la pantalla de verdad un 31 de octubre (último día del mes)
   con varios bancos, recibos de cada tipo y cuotas de deuda enlazadas desde Gastos, y mira el DOM:
   - la hoja por pasos: Atrás vuelve un paso sin que la hoja salga volando, no cambia de alto,
     vuelve por donde se llegó («Visto en tu banco» de 2.050 €), los días no se esconden tras elegir
     meses y «Solo una vez» no arranca en un mes que ya no se puede elegir;
   - una cuota de deuda enlazada en Gastos se abre en su ficha con el cargo, sin saltar a Deudas;
   - los simuladores responden al primer toque y se ven enteros. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell", "caixabank", "trade_republic"] };
const accounts = [
  { id: "sb", ent: "sabadell", name: "Cuenta", value: 3200, role: "fijos" },
  { id: "cx", ent: "caixabank", name: "Cuenta", value: 900, role: "ambos" },
  { id: "tr", ent: "trade_republic", name: "Cash", value: 5000, role: "ambos" },
];
const g = (id, merchant, date, amount, ent, extra) => Object.assign({ id, merchant, obName: merchant, date, amount, ent, category: "otros", source: "ob", status: "BOOK" }, extra || {});
const expenses = [
  g("alq8", "ALQUILER PISO SL", "2026-08-01", 2050, "sabadell"),
  g("alq9", "ALQUILER PISO SL", "2026-09-01", 2050, "sabadell"),
  g("alq10", "ALQUILER PISO SL", "2026-10-01", 2050, "sabadell"),
  // Hipoteca marcada en Gastos con un cargo que no es la cuota exacta; préstamo sin día de cobro.
  g("hip10", "PRESTAMO HIPOTECARIO", "2026-10-01", 641.27, "sabadell", { category: "deudas", debtId: "hipo" }),
  g("coche10", "FINANC COCHE", "2026-10-15", 200, "caixabank", { category: "deudas", debtId: "coche" }),
];
const fixed = [
  { id: "net", name: "Internet", amount: 40, freq: "mes", day: 31, account: "caixabank", category: "recibos" },
  { id: "ibi", name: "IBI", amount: 400, freq: "año", schedule: [{ m: 4, day: 20, amt: 200 }, { m: 11, day: 20, amt: 200 }], day: 20, account: "sabadell" },
];
const debts = [
  { id: "hipo", name: "Hipoteca", value: 140000, original: 160000, monthly: 640, account: "sabadell", day: 1, asOf: 2026 * 12 + 9 },
  { id: "coche", name: "Préstamo coche", value: 6000, original: 9000, monthly: 200, account: "caixabank", asOf: 2026 * 12 + 9 },
];
const obBalAt = { "Banco Sabadell": "2026-10-31T08:00:00Z", "CaixaBank": "2026-10-31T08:00:00Z" };

async function abre(page, overrides) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-31T12:00:00+01:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-10-31", bankTx: [], obBalAt, debts, flows: [], oneoffs: [], expenses, settings, accounts, fixed }, overrides || {}));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
const hoja = (page) => page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
const paso = (page, n) => hoja(page).locator('[data-rp4-paso="' + n + '"]');
const cta = (page) => hoja(page).locator(".rp4-cta");
const teclea = async (page, n, digits) => { for (const d of digits) await paso(page, n).locator('.v4-keys button[aria-label="' + d + '"]').click(); };
// Desplazamiento horizontal de la capa que se arrastra (el fondo de la hoja por pasos).
const capaX = (page) => page.locator(".v4-sheet-back").filter({ has: hoja(page) }).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
async function abreAlta(page, recibos) {
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Todos" }).click();
  await page.locator('[data-bills-manage] [data-act="bill-add"]').first().click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
}

test("hoja por pasos: Atrás vuelve un paso sin que la hoja salga volando, también arrastrando", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "El gesto táctil real usa CDP");
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  await paso(page, 0).locator('[data-rp4="name"]').fill("Agua");
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  await hoja(page).locator('[data-act="back"]').click();
  // El paso cambia ya y la hoja no se mueve de sitio (antes: 420 ms volando a la derecha y vuelta de golpe).
  await expect(hoja(page)).toHaveAttribute("data-paso", "0", { timeout: 200 });
  expect(Math.abs(await capaX(page))).toBeLessThan(2);
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  await page.waitForTimeout(450);
  // Arrastrar hacia la derecha y soltar: la hoja acompaña al dedo y vuelve a su sitio un paso atrás.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 120, y: 300 }] });
  for (const x of [160, 220, 280, 330]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 302 }] });
  expect(await capaX(page)).toBeGreaterThan(150);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(hoja(page)).toHaveAttribute("data-paso", "0", { timeout: 300 });
  await page.waitForTimeout(150);
  expect(await capaX(page)).toBeLessThan(120);
  await expect.poll(() => capaX(page), { timeout: 600 }).toBeLessThan(2);
  await expect(hoja(page)).toBeVisible();
  // En el primer paso, Atrás sí cierra.
  await hoja(page).locator('[data-act="back"]').click();
  await expect(hoja(page)).toHaveCount(0);
});

test("hoja por pasos: el alto no salta de un paso a otro", async ({ page }) => {
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  const arriba = () => hoja(page).evaluate((el) => Math.round(el.getBoundingClientRect().top));
  await page.waitForTimeout(600);
  const t0 = await arriba();
  await paso(page, 0).locator('[data-rp4="name"]').fill("Agua");
  await cta(page).click();
  await teclea(page, 1, "30");
  await page.waitForTimeout(450);
  expect(await arriba()).toBe(t0);
  await cta(page).click();
  await paso(page, 2).locator('[data-rp4-dia="5"]').click();
  await page.waitForTimeout(450);
  expect(await arriba()).toBe(t0);
  await cta(page).click();
  await page.waitForTimeout(450);
  expect(await arriba()).toBe(t0);
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await page.waitForTimeout(450);
  expect(await arriba()).toBe(t0);
});

test("«Visto en tu banco» de 2.050 €: Atrás vuelve a la lista y cada línea del resumen vuelve al resumen", async ({ page }) => {
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  const visto = paso(page, 0).getByTestId("rp4-visto").locator(".pr6-cand", { hasText: "ALQUILER PISO SL" });
  await expect(visto).toContainText("2.050,00 €");
  await visto.click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await expect(paso(page, 4).locator('[data-rp4="sum-amt"]')).toHaveText("2.050,00 €");
  // Tocar «Importe» y volver con el botón: al resumen, no al paso siguiente.
  await paso(page, 4).locator('[data-rp4-fila="1"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  await expect(cta(page)).toHaveText("Listo");
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  // Atrás desde el resumen: a la lista de donde se eligió, sin pasar por Cuenta, Cuándo ni Importe.
  await hoja(page).locator('[data-act="back"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  await page.goBack();
  await expect(hoja(page)).toHaveCount(0);
});

test("Cuándo: al elegir los meses, los días quedan a la vista", async ({ page }) => {
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  await paso(page, 0).locator('[data-rp4="name"]').fill("Seguro hogar");
  await cta(page).click();
  await teclea(page, 1, "240");
  await cta(page).click();
  await paso(page, 2).locator('[data-rp4-freq="año"]').click();
  await paso(page, 2).locator(".month-picker button", { hasText: /^Mar$/ }).click();
  const dia = paso(page, 2).locator('[data-rp4-dia="31"]');
  // Encima del botón fijo de abajo, no tapado por él (antes quedaba la primera fila asomando).
  await expect.poll(async () => {
    const d = await dia.boundingBox(), f = await hoja(page).locator(".rp4-foot").boundingBox();
    return d && f ? Math.round(f.y - (d.y + d.height)) : -1;
  }, { timeout: 2000 }).toBeGreaterThanOrEqual(0);
  await dia.click();
  await expect(cta(page)).toBeEnabled();
});

test("«Solo una vez» el último día del mes empieza el mes que viene", async ({ page }) => {
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  await paso(page, 0).locator('[data-rp4="name"]').fill("ITV");
  await cta(page).click();
  await teclea(page, 1, "45");
  await cta(page).click();
  await paso(page, 2).locator('[data-rp4-modo="once"]').click();
  await expect(paso(page, 2).locator(".rp4-mes.on")).toHaveText(/^nov$/i);
  await paso(page, 2).getByRole("button", { name: "Un día después" }).click();
  await expect(paso(page, 2).locator('[data-rp4="dia"]')).toHaveText("día 1");
  await expect(cta(page)).toBeEnabled();
  await cta(page).click();
  await paso(page, 3).locator('[data-rp4-banco="sabadell"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await cta(page).click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await page.evaluate(() => mcLoadRaw(mcStateKey()).oneoffs);
  expect(s).toEqual([expect.objectContaining({ name: "ITV", amount: 45, month: 11, year: 2026, day: 1 })]);
});

test("cuota de deuda enlazada en Gastos: se abre su ficha con el cargo, sin saltar a Deudas", async ({ page }) => {
  const recibos = await abre(page);
  const cifra = recibos.getByTestId("plan-summary").locator(".serif.num");
  // Lo que queda por pagar no cambia: la ficha solo enseña (Internet 40 + préstamo 200).
  await expect(cifra).toHaveText("240,00 €");
  const hipo = recibos.locator('[data-recibo="debt_hipo"]');
  await expect(hipo).toContainText("Enlazado · 641,27 €");
  await hipo.click();
  const ficha = page.locator('.v4-sheet[data-sheet="deuda"]');
  await expect(ficha).toBeVisible();
  await expect(ficha.getByTestId("deuda-cargo")).toContainText("641,27 €");
  await expect(ficha.getByTestId("deuda-nota")).toHaveText("Se cobró 641,27 € y la cuota es 640,00 €.");
  await expect(page.locator('.v4-seg-btn[data-seg="recibos"]')).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(ficha).toHaveCount(0);
  const coche = recibos.getByTestId("plan-due").locator('[data-recibo="debt_coche"]');
  await expect(coche).toContainText("Enlazado · 200,00 €");
  await coche.click();
  await expect(ficha.getByTestId("deuda-nota")).toHaveText("La cuota no tiene día de cobro.");
  await ficha.locator('[data-act="ver-deuda"]').click();
  await expect(ficha).toHaveCount(0);
  await expect(page.locator('.v4-seg-btn[data-seg="deudas"]')).toHaveAttribute("aria-selected", "true");
  await expect(cifra).toHaveText("240,00 €");
});

test("cuota cobrada justa: su ficha la da por pagada con el cargo y sin nota", async ({ page }) => {
  const recibos = await abre(page, { expenses: [g("hip10", "PRESTAMO HIPOTECARIO", "2026-10-01", 640, "sabadell", { category: "deudas", debtId: "hipo" })] });
  await recibos.getByTestId("plan-paid").locator(".pr6-paid-h").click();
  await recibos.locator('[data-recibo="debt_hipo"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="deuda"]');
  await expect(ficha.getByTestId("deuda-cargo")).toHaveAttribute("data-acredita", "1");
  await expect(ficha.getByTestId("deuda-nota")).toHaveCount(0);
});

test("«¿Y si gasto…?»: tocar la zona abre el teclado y queda a la vista con tres bancos", async ({ page }) => {
  const recibos = await abre(page, { fixed: fixed.concat([{ id: "gym", name: "Gimnasio", amount: 30, freq: "mes", day: 31, account: "trade_republic" }]) });
  await recibos.getByTestId("plan-llega").click();
  const zona = page.getByTestId("llega-gasto");
  await zona.locator(".pr6-ll-n").click();
  await expect(page.getByTestId("llega-gasto-amt")).toHaveAttribute("aria-expanded", "true");
  const tecla = zona.locator('.v4-keys button[aria-label="5"]');
  await expect.poll(async () => { const b = await tecla.boundingBox(); return b ? Math.round(b.y + b.height) : 9999; }, { timeout: 2000 })
    .toBeLessThanOrEqual(page.viewportSize().height);
  await tecla.click();
  await expect(page.getByTestId("llega-gasto-txt")).toBeVisible();
});

test("«¿Me lo puedo permitir?» se abre ya desplegado", async ({ page }) => {
  const recibos = await abre(page);
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Todos" }).click();
  await page.locator(".v4-bills-afford").click();
  const sim = page.getByTestId("afford-sim");
  await expect(sim).toBeVisible();
  const importe = sim.getByPlaceholder("Importe €");
  await expect(importe).toBeInViewport();
  await importe.fill("5000");
  await expect(sim.locator(".af-verdict")).toBeVisible();
});
