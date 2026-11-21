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

async function abre(page, vp, textSize) {
  test.info().annotations.push({ type: "own-clock" });
  await page.setViewportSize(vp);
  await page.clock.install({ time: new Date("2026-11-09T12:00:00+01:00") });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
  if (textSize) settings.textSize = textSize;
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-11-09",
    accounts: [{ id: "s", ent: "sabadell", role: "fijos", value: 1830.45 }, { id: "rv", ent: "revolut", role: "fijos", value: 217 }],
    fixed, debts: [], oneoffs: [],
    flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 1850, to: "sabadell", day: 28 }],
    bankTx: [{ id: "b-alq", ent: "sabadell", date: "2026-11-01", amount: 998, merchant: "ALQUILER SINTETICO", concept: "RECIBO ALQUILER", status: "BOOK" }],
    expenses: [cargo("alq", "2026-11-01", 998, "ALQUILER SINTETICO")], settings });
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
      expect(await tipo(page, P + " .pr6-prow .nm")).toBe(ini.nombre);
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
