/* Recibos: gestos de la hoja por pasos, botones de un recibo y el teclado de «¿Me lo puedo
 * permitir?» (vídeo del dueño, 8/11). Lo que se mira es lo que él veía: la hoja saliendo de lado con
 * el fondo y dos pasos a la vez, una hoja que no se dejaba tirar hacia abajo, un «Ya está pagado»
 * que se comía la ficha y un teclado que subía a tirones. Todo contra el DOM pintado. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const settings = { autoPrices: false, theme: "cyber", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const recibo = (id, name, amount, day) => ({ id, name, amount, freq: "mes", day, account: "sabadell" });
const hub = "[data-bills-manage]";
const hoja = (page) => page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
const fondo = (page) => page.locator(".v4-sheet-back").filter({ has: hoja(page) });
const mat = (loc) => loc.evaluate((el) => { const m = new DOMMatrix(getComputedStyle(el).transform); return { x: m.m41, y: m.m42 }; });
const atras = (page, phase, progress) => page.evaluate(([phase, progress]) => {
  const e = new Event("mcNativeEdgeBack"); e.phase = phase; e.progress = progress; window.dispatchEvent(e);
}, [phase, progress]);

async function abrePlan(page) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-18T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  const fixed = [recibo("a", "Agua", 30.5, 19), recibo("b", "Gimnasio", 40, 20)];
  for (let i = 0; i < 14; i++) fixed.push(recibo("r" + i, "Recibo sintético " + (i + 1), 10 + i, 21 + (i % 7)));
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-10-18", debts: [], flows: [], oneoffs: [], settings,
    accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }], fixed, expenses: [], bankTx: [] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
}
async function abreAlta(page) {
  await abrePlan(page);
  await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button", { name: /^(Gestionar|Todos)\b/ }).click();
  await page.locator(hub + ' [data-act="bill-add"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  // La entrada (`sheetup`) tiene que haber terminado: si no, el transform que se lee es el suyo.
  await page.waitForTimeout(600);
}

test("atrás del sistema vuelve un paso sin sacar la hoja de lado, y en el primero la baja", async ({ page }) => {
  await abreAlta(page);
  await hoja(page).locator('[data-rp4="name"]').fill("Gimnasio");
  await hoja(page).locator(".rp4-cta").click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");

  await atras(page, "start", 0);
  await atras(page, "progress", 0.5);
  // Con el dedo a medio camino ni el fondo ni la hoja se mueven de lado (antes: medio ancho).
  expect((await mat(fondo(page))).x).toBe(0);
  expect((await mat(hoja(page))).x).toBe(0);
  await atras(page, "invoke", 1);
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  await expect(hoja(page)).toBeVisible();
  await expect(hoja(page).locator('[data-rp4="name"]')).toHaveValue("Gimnasio");
  await page.waitForTimeout(500);

  // En el primer paso, la hoja se va hacia abajo y nunca de lado.
  await atras(page, "progress", 0.6);
  expect((await mat(fondo(page))).x).toBe(0);
  await atras(page, "invoke", 1);
  await page.waitForTimeout(120);
  const saliendo = await mat(hoja(page));
  expect(saliendo.x).toBe(0);
  expect(saliendo.y).toBeGreaterThan(10);
  expect((await mat(fondo(page))).x).toBe(0);
  await expect(hoja(page)).toHaveCount(0, { timeout: 1600 });
  await expect(page.locator(hub + ' [data-screen="bills-home"]')).toBeVisible();
});

test("la hoja se tira hacia abajo desde el cuerpo: vuelve si no pasa del umbral y se cierra si pasa", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "El gesto táctil real usa CDP");
  await abreAlta(page);
  await hoja(page).locator('[data-rp4="name"]').fill("Gimnasio");
  await hoja(page).locator(".rp4-cta").click();
  await hoja(page).locator('[data-rp4-paso="1"] .v4-keys button').filter({ hasText: /^2$/ }).click();
  await hoja(page).locator(".rp4-cta").click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "2");
  await page.waitForTimeout(500);
  const caja = await hoja(page).locator('[data-rp4-paso="2"] .rp4-freqs').boundingBox();
  const x = caja.x + caja.width / 2, y = caja.y + caja.height + 12;
  const cdp = await page.context().newCDPSession(page);
  const toque = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  // Un tirón corto sigue al dedo y, al soltar, la hoja vuelve a su sitio.
  await toque("touchStart", [{ x, y }]);
  for (let i = 1; i <= 6; i++) { await toque("touchMove", [{ x, y: y + i * 10 }]); await frame(); }
  expect((await mat(hoja(page))).y).toBeGreaterThan(40);
  await toque("touchEnd", []);
  await expect.poll(async () => (await mat(hoja(page))).y).toBeLessThan(1);
  await expect(hoja(page)).toBeVisible();

  // El scroll interno sigue siendo suyo: con el contenido bajado, arrastrar hacia abajo lo sube.
  const cuerpo = hoja(page).locator(".rp4-body");
  const max = await cuerpo.evaluate((el) => { el.scrollTop = 120; return el.scrollTop; });
  if (max > 0) {
    await toque("touchStart", [{ x, y }]);
    for (let i = 1; i <= 6; i++) { await toque("touchMove", [{ x, y: y + i * 10 }]); await frame(); }
    expect((await mat(hoja(page))).y).toBe(0);
    await toque("touchEnd", []);
    await cuerpo.evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(400);
  }

  // Un tirón largo la cierra.
  await toque("touchStart", [{ x, y }]);
  for (let i = 1; i <= 10; i++) { await toque("touchMove", [{ x, y: y + i * 20 }]); await frame(); }
  await toque("touchEnd", []);
  await expect(hoja(page)).toHaveCount(0, { timeout: 1600 });
  await cdp.detach();
});

test("«Ya está pagado» va en la fila de acciones con su tamaño, no ocupa la ficha", async ({ page }) => {
  await abrePlan(page);
  await page.locator('.page-live .v4-screen > [data-seg="recibos"] .v4-charge').filter({ hasText: "Agua" }).first().click();
  const pagado = page.locator('[data-act="pagado"]');
  await expect(pagado).toBeVisible();
  const [p, e, ficha] = await Promise.all([pagado.boundingBox(), page.locator('[data-act="editar"]').boundingBox(),
    pagado.evaluate((el) => el.closest(".v4-sheet").getBoundingClientRect().toJSON())]);
  expect(p.height).toBeLessThanOrEqual(46);
  expect(p.width).toBeLessThan(ficha.width * 0.6);
  // En la misma fila que «Editar».
  expect(Math.abs(p.y - e.y)).toBeLessThan(2);
});

