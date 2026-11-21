import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Recibos y todo lo de dentro hablan la misma escala de letra que las filas de «Próximos cargos» de
   Inicio (dueño, 21/11/2026: «Plan y Recibos se ven más grandes que el resto de la app»). Aquí no hay
   números escritos a mano: se lee lo COMPUTADO en Inicio y se exige lo mismo en Recibos, así que si
   alguien retoca la escala de Inicio, Recibos la sigue, y si Recibos vuelve a tener la suya, rompe.
   Datos inventados. */
const r = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const fixed = [
  r("coche", "Seguro coche", 41, 12, { category: "coche" }), r("movil", "Móvil", 15, 13, { account: "revolut" }),
  r("agua", "Agua", 28.15, 14, { category: "agua" }), r("alq", "Alquiler", 998, 1, { category: "hogar" }),
];
const cargo = (id, date, amount, merchant) => ({ id, extId: "b-" + id, ent: "sabadell", date: date + "T12:00:00.000Z", amount, merchant, obName: merchant, source: "ob", status: "BOOK", category: "otros" });

async function abre(page, vp, textSize, extra) {
  test.info().annotations.push({ type: "own-clock" });
  await page.setViewportSize(vp);
  await page.clock.install({ time: new Date("2026-11-09T12:00:00+01:00") });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
  if (textSize) settings.textSize = textSize;
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-11-09",
    accounts: [{ id: "s", ent: "sabadell", role: "fijos", value: 1830.45 }, { id: "rv", ent: "revolut", role: "fijos", value: 217 }],
    fixed, debts: [], oneoffs: [],
    flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 1850, to: "sabadell", day: 28 }],
    bankTx: [{ id: "b-alq", ent: "sabadell", date: "2026-11-01", amount: 998, merchant: "ALQUILER SINTETICO", concept: "RECIBO ALQUILER", status: "BOOK" }],
    expenses: [cargo("alq", "2026-11-01", 998, "ALQUILER SINTETICO")], settings }, extra || {}));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}

// Tipografía computada de lo primero visible que case con `sel`.
const tipo = (page, sel) => page.evaluate((s) => {
  const e = Array.from(document.querySelectorAll(s)).find((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
  if (!e) return null;
  const cs = getComputedStyle(e);
  return [cs.fontSize, cs.fontWeight, cs.fontFamily.split(",")[0].replace(/['"]/g, "").trim()].join(" ");
}, sel);
// Caja de una fila: relleno vertical y separación entre sus partes, que también se copian de Inicio.
const caja = (page, sel) => page.evaluate((s) => {
  const e = Array.from(document.querySelectorAll(s)).find((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
  if (!e) return null;
  const cs = getComputedStyle(e);
  return { pt: cs.paddingTop, pb: cs.paddingBottom, gap: cs.columnGap, alto: Math.round(e.getBoundingClientRect().height) };
}, sel);

const INICIO = {
  seccion: "[data-testid=inicio-upcoming] .v4-section-h > span", enlace: "[data-testid=inicio-upcoming] .v4-section-h button.link",
  nombre: "[data-testid=inicio-upcoming] .v4-charge .nm", importe: "[data-testid=inicio-upcoming] .v4-charge .am",
  dia: "[data-testid=inicio-upcoming] .v4-charge .dt .d", mes: "[data-testid=inicio-upcoming] .v4-charge .dt .m",
  sub: "[data-testid=inicio-upcoming] .v4-charge .sub", fila: "[data-testid=inicio-upcoming] .v4-charge",
};
const RECIBOS = (raiz) => ({
  seccion: raiz + " .pr6-sec-h", enlace: raiz + " .pr6-sec-h button.pr6-todos",
  // Con Enorme `.nm` pasa a `display:contents` (sin caja): el nombre es entonces `.pr6-nm`.
  nombre: raiz + " .pr6-row .pr6-nm, " + raiz + " .pr6-row .nm", importe: raiz + " .pr6-row .am", dia: raiz + " .pr6-row .dt .d", mes: raiz + " .pr6-row .dt .m",
  sub: raiz + " .pr6-row .sub", fila: raiz + " .pr6-row",
});

for (const vp of [{ width: 412, height: 915 }, { width: 360, height: 780 }])
  for (const letra of [null, "huge"]) {
    test(`Recibos usa la escala de Inicio a ${vp.width} px${letra ? " con letra Enorme" : ""}`, async ({ page }) => {
      await abre(page, vp, letra);
      const ini = {};
      for (const [k, s] of Object.entries(INICIO)) if (k !== "fila") ini[k] = await tipo(page, s);
      const filaIni = await caja(page, INICIO.fila);
      for (const k of Object.keys(ini)) expect(ini[k], "Inicio tiene «" + k + "»").not.toBeNull();

      await page.locator('.botnav-tab[data-tour="plan"]').dispatchEvent("click");
      const rec = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
      await expect(rec.getByTestId("plan-due")).toBeVisible();
      const raiz = '[data-seg="recibos"] [data-testid="plan-due"]';
      const R = RECIBOS(raiz);
      for (const k of Object.keys(ini)) expect(await tipo(page, R[k]), "portada de Recibos: " + k).toBe(ini[k]);
      // Mismo relleno vertical y misma separación; el alto solo se aparta por el borde de la tarjeta.
      const filaRec = await caja(page, R.fila);
      expect(filaRec.pt).toBe(filaIni.pt);
      expect(filaRec.pb).toBe(filaIni.pb);
      expect(filaRec.gap).toBe(filaIni.gap);
      // Con Enorme Recibos parte en rejilla (el importe baja bajo el nombre) y la fila crece por diseño.
      if (!letra) expect(filaRec.alto).toBeLessThanOrEqual(filaIni.alto + 4);

      // «Ya pagados»: su cabecera, sus filas y los botones de texto siguen la misma escala.
      const pagados = rec.getByTestId("plan-paid");
      await pagados.locator(".pr6-paid-h").click();
      const P = '[data-seg="recibos"] [data-testid="plan-paid"]';
      expect(await tipo(page, P + " .pr6-paid-t")).toBe(ini.seccion);
      expect(await tipo(page, P + " .pr6-paid-amt")).toBe(ini.importe);
      expect(await tipo(page, P + " .pr6-prow .pr6-nm, " + P + " .pr6-prow .nm")).toBe(ini.nombre);
      expect(await tipo(page, P + " .pr6-prow .am")).toBe(ini.importe);
      expect(await tipo(page, P + " .pr6-prow .sub")).toBe(ini.sub);

      // «Tus recibos» (todos): las filas son las mismas.
      await rec.getByTestId("plan-todos").or(rec.getByTestId("plan-due").getByRole("button", { name: "Gestionar" })).click();
      const hub = '[data-bills-manage] [data-screen="bills-home"]';
      await expect(page.locator(hub + " .pr6-row").first()).toBeVisible();
      const H = RECIBOS(hub);
      for (const k of ["nombre", "importe", "dia", "mes", "sub"]) expect(await tipo(page, H[k]), "Tus recibos: " + k).toBe(ini[k]);
      expect(await tipo(page, hub + " .pr6-sec-h")).toBe(ini.seccion);
      expect(await tipo(page, hub + " .pr6-mg-add")).toBe(ini.enlace);

      // Añadir: el título de la hoja y las filas de cuenta no se salen de la escala (título de hoja =
      // el de las demás hojas, 22/550 Fraunces; el importe de la fila, el de Inicio).
      await page.locator(hub + ' [data-act="bill-add"]').first().click();
      await expect(page.locator('.v4-sheet[data-sheet="recibo-pasos"] .rp4-h').first()).toBeVisible();
      expect(await tipo(page, '.v4-sheet[data-sheet="recibo-pasos"] .rp4-h')).toBe("22px 550 Fraunces");
    });
  }

/* Lo que se rompió al encoger la escala (filtro de diseño del 21/11/2026): con Enorme a 360 el nombre
   largo pisaba el importe y «Siguiente» tapaba el teclado. Aquí se miden CAJAS: dos textos que
   comparten fila no pueden solaparse, y la última tecla acaba por encima del botón. */
const solapan = (page, a, b) => page.evaluate(([a, b]) => {
  const v = (s) => Array.from(document.querySelectorAll(s)).find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const ea = v(a), eb = v(b);
  if (!ea || !eb) return "falta " + (!ea ? a : b);
  const p = ea.getBoundingClientRect(), q = eb.getBoundingClientRect();
  return Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1;
}, [a, b]);

test("Enorme a 360: nombre largo e importe no se pisan (ficha, pagados, traspasos) y la cifra grande no parte el €", async ({ page }) => {
  await abre(page, { width: 360, height: 780 }, "huge", {
    fixed: fixed.concat([{ id: "net", name: "Fibra y televisión de la compañía con nombre larguísimo", amount: 1052.71, freq: "mes", day: 29, account: "sabadell" }]),
    flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 1850, to: "sabadell", day: 28 }, { id: "tr", kind: "transfer", name: "A Revolut", amount: 200, from: "sabadell", to: "revolut", day: 28 }],
  });
  await page.locator('.botnav-tab[data-tour="plan"]').dispatchEvent("click");
  const rec = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  await expect(rec.getByTestId("plan-due")).toBeVisible();
  // «351,40 €» en un renglón: el alto de la cifra es el de una línea de su texto.
  const big = await page.locator('[data-seg="recibos"] .pr6-sum .pr6-big').first().evaluate((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight || getComputedStyle(e).fontSize));
  expect(big).toBeLessThan(1.6);
  await rec.getByTestId("plan-paid").locator(".pr6-paid-h").click();
  expect(await solapan(page, '[data-testid="plan-paid"] .pr6-paid-t', '[data-testid="plan-paid"] .pr6-paid-amt')).toBe(false);
  const tr = rec.getByTestId("plan-transfers");
  if (await tr.count()) expect(await solapan(page, '[data-testid="plan-transfers"] .nm > .sub', '[data-testid="plan-transfers"] .pr6-am')).toBe(false);
  await rec.locator('[data-recibo="fixed_net"]').first().dispatchEvent("click");
  await expect(page.locator('.v4-sheet[data-sheet="recibo"] .pr6-ficha-n').first()).toBeVisible();
  expect(await solapan(page, ".pr6-ficha-h .pr6-ficha-n", ".pr6-ficha-h .pr6-ficha-a")).toBe(false);
});

for (const vp of [{ width: 360, height: 780 }, { width: 360, height: 640 }]) {
  test(`Alta, paso del importe a ${vp.width}x${vp.height} con Enorme: teclas de 56 y «Siguiente» nunca encima de una tecla`, async ({ page }) => {
    await abre(page, vp, "huge");
    await page.locator('.botnav-tab[data-tour="plan"]').dispatchEvent("click");
    const rec = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
    await rec.getByTestId("plan-due").getByTestId("plan-todos").click();
    await page.locator('[data-bills-manage] [data-act="bill-add"]').first().click();
    const hoja = page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
    await expect(hoja).toHaveAttribute("data-paso", "0");
    await hoja.locator('[data-rp4-paso="0"] [data-rp4="name"]').fill("Agua casa");
    await hoja.locator(".rp4-cta").click();
    await expect(hoja).toHaveAttribute("data-paso", "1");
    // El carril acaba su deslizamiento antes de medir hasta dónde se puede bajar.
    await page.waitForTimeout(900);
    await page.evaluate(async () => { const c = document.querySelector('.v4-sheet[data-sheet="recibo-pasos"] .rp4-body'); c.scrollTop = c.scrollHeight; await new Promise((r) => setTimeout(r, 200)); });
    const m = await page.evaluate(() => {
      const h = document.querySelector('.v4-sheet[data-sheet="recibo-pasos"]');
      const cuerpo = h.querySelector(".rp4-body"), pie = h.querySelector(".rp4-foot");
      const teclas = Array.from(h.querySelectorAll('[data-rp4-paso="1"] .v4-keys button'));
      const ult = teclas[teclas.length - 1].getBoundingClientRect(), pi = pie.getBoundingClientRect(), hr = h.getBoundingClientRect();
      return { altoTecla: getComputedStyle(teclas[0]).height, ultBottom: Math.round(ult.bottom), pieTop: Math.round(pi.top), hojaBottom: Math.round(hr.bottom), vh: innerHeight };
    });
    expect(Math.round(parseFloat(m.altoTecla))).toBe(56);
    expect(m.ultBottom).toBeLessThanOrEqual(m.pieTop);
    expect(m.hojaBottom).toBeLessThanOrEqual(m.vh + 1);
  });
}

test("Alta, paso cuenta a 360 con Enorme: el nombre del banco entero en un renglón, sin partir a mitad de palabra", async ({ page }) => {
  await abre(page, { width: 360, height: 780 }, "huge");
  await page.locator('.botnav-tab[data-tour="plan"]').dispatchEvent("click");
  const rec = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  await rec.getByTestId("plan-due").getByTestId("plan-todos").click();
  await page.locator('[data-bills-manage] [data-act="bill-add"]').first().click();
  const hoja = page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
  await hoja.locator('[data-rp4-paso="0"] [data-rp4="name"]').fill("Agua casa");
  await hoja.locator(".rp4-cta").click();
  await hoja.locator('[data-rp4-paso="1"] .v4-keys button[aria-label="5"]').click();
  await hoja.locator(".rp4-cta").click();
  await hoja.locator('[data-rp4-paso="2"] [data-rp4-dia="25"]').click();
  await hoja.locator(".rp4-cta").click();
  await expect(hoja).toHaveAttribute("data-paso", "3");
  await page.waitForTimeout(700);
  const nombres = await hoja.locator('[data-rp4-paso="3"] .pr6-cand-n').evaluateAll((els) => els.map((e) => ({ t: e.textContent, lineas: e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).fontSize) * 1.3) })));
  expect(nombres.length).toBeGreaterThan(1);
  for (const n of nombres) expect(n.lineas, n.t).toBeLessThan(1.5);
});
