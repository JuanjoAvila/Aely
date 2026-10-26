import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra, gastosEstado, gastosSeccion } from "./fixtures.mjs";

/* GASTOS v5 · TANDA 4 (SPEC §6). Suscripciones como bandeja: una tarjeta por cada una que pide
   decisión, su ficha al tocarla (últimos cobros, día, banco, lo del año) y las tres acciones
   (Pasar a Recibos con el importe editable, Ya la he dado de baja, No es una suscripción). La
   «i» de la línea de estado explica la sección. Render puro derivado del estado (AGENTS §7): cada
   prueba abre la pantalla de verdad y mira el DOM y lo guardado. Reloj de las fixtures: 26/9/2026. */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

const base = {
  budget: 1000,
  settings: { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["trade_republic", "sabadell"] },
  accounts: [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 3000, role: "diario", spendFrom: true }],
};
const cargo = (id, ymd, amount, merchant, extra = {}) =>
  ({ id, date: ymd + "T12:00:00Z", amount, category: "ocio", merchant, source: "ob", ent: "trade_republic", ...extra });
// Netflix: cuatro meses seguidos en Trade Republic, siempre el 14.
const netflix = ["2026-06-14", "2026-07-14", "2026-08-14", "2026-09-14"].map((d, i) => cargo("nf" + i, d, 12.99, "Netflix"));
// Revista: tres cobros en cinco meses (mayo, julio, septiembre) en Sabadell: no es «cada mes».
const revista = ["2026-05-03", "2026-07-03", "2026-09-03"].map((d, i) => cargo("rv" + i, d, 30, "Revista", { ent: "sabadell" }));
// Apuntada a mano: no se sabe el banco.
const club = ["2026-07-20", "2026-08-20", "2026-09-20"].map((d, i) => cargo("cl" + i, d, 8, "Club", { source: "manual", ent: undefined }));
const todas = netflix.concat(revista, club);

async function abre(page, overrides = {}) {
  await seedLoggedInDashboard(page, { ...base, expenses: todas, ...overrides });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
}
const panel = (page) => gastosRoot(page).locator('[data-gx-secc="subs"]');
const tarjetas = (page) => panel(page).locator(".gx-sub");
const tarjeta = (page, nombre) => tarjetas(page).filter({ hasText: nombre });
const ficha = (page) => page.locator('[data-sheet="sub-ficha"]');
const globo = (page) => gastosRoot(page).getByTestId("gastos-subs-globo");
const guardado = (page) => page.evaluate(() => mcLoadRaw(mcStateKey()));

test("bandeja: una tarjeta por suscripción con frecuencia, banco e importe al mes; globito y cifra cuadran", async ({ page }) => {
  await abre(page);
  await expect(globo(page)).toHaveText("3");
  await gastosSeccion(page, "subs");
  await expect(tarjetas(page)).toHaveCount(3);
  // Orden de la detección: de mayor a menor importe.
  await expect(tarjetas(page).locator(".gx-sub-nm")).toHaveText(["Revista", "Netflix", "Club"]);
  await expect(tarjeta(page, "Netflix").locator(".gx-sub-meta")).toHaveText("4 meses seguidos · Trade Republic");
  await expect(tarjeta(page, "Revista").locator(".gx-sub-meta")).toHaveText("3 de 5 meses · Sabadell");
  // Sin banco no se inventa uno.
  await expect(tarjeta(page, "Club").locator(".gx-sub-meta")).toHaveText("3 meses seguidos");
  await expect(tarjeta(page, "Netflix").locator(".gx-sub-am")).toHaveText("12,99 €al mes");
  // La cifra es lo que suman al mes las pendientes: 30 + 12,99 + 8.
  await expect(gastosCifra(page)).toHaveText("50,99 €");
  await expect(gastosEstado(page)).toHaveText("al mes · 3 por revisar");
  await expect(tarjetas(page).locator(".gx-sub-vuelve")).toHaveCount(0);
});

test("la «i» abre la explicación y Entendido la cierra; solo está en Suscripciones", async ({ page }) => {
  await abre(page);
  await expect(gastosRoot(page).getByTestId("subs-info")).toHaveCount(0);
  await gastosSeccion(page, "subs");
  const i = gastosRoot(page).getByTestId("subs-info");
  await expect(i).toHaveAttribute("aria-label", "Suscripciones detectadas");
  await i.click();
  const hoja = page.locator('[data-sheet="sub-info"]');
  await expect(hoja).toBeVisible();
  await expect(hoja.locator("h1")).toHaveText("Suscripciones detectadas");
  await expect(hoja.locator("h1")).toBeFocused();
  await expect(hoja.locator(".gx-subi-t")).toHaveText(["Qué aparece aquí", "Cómo se detectan", "Qué puedes hacer"]);
  /* Textos mínimos (4.26.182) acortó «Qué puedes hacer» y quitó «Lo ideal es que esta lista esté vacía.»:
     se comprueba un fragmento del texto que sí pinta la hoja (rojo de la suite entera de la promoción 182). */
  await expect(hoja).toContainText("márcala como dada de baja");
  await hoja.getByRole("button", { name: "Entendido" }).click();
  await expect(hoja).toHaveCount(0);
  await gastosSeccion(page, "movs");
  await expect(gastosRoot(page).getByTestId("subs-info")).toHaveCount(0);
});

test("ficha: día y banco del último cobro, los tres últimos cobros y lo del año de la detección", async ({ page }) => {
  await abre(page);
  await gastosSeccion(page, "subs");
  await tarjeta(page, "Netflix").click();
  const f = ficha(page);
  await expect(f).toBeVisible();
  await expect(f.locator("h1")).toHaveText("Netflix");
  await expect(f.locator("h1")).toBeFocused();
  await expect(f.locator(".gx-subf-cab .gx-sub-meta")).toHaveText(["Se cobra el día 14 · Trade Republic", "4 meses seguidos"]);
  await expect(f.locator(".gx-subf-amt")).toHaveText("12,99 €");
  await expect(f.locator(".gx-subf-fila")).toHaveCount(3);
  await expect(f.locator(".gx-subf-fila").first()).toContainText("14 sept 2026");
  await expect(f.locator(".gx-subf-fila-am")).toHaveText(["12,99 €", "12,99 €", "12,99 €"]);
  // 12,99 × 12 = 155,88 → la detección lo redondea a 156.
  await expect(f.locator(".gx-subf-anio")).toContainText("Unos 156 € al año.");
  await expect(f.getByTestId("sub-importe")).toHaveValue("12,99");
  await expect(f.locator("[data-sub-accion]")).toHaveText(["Pasar a Recibos", "Ya la he dado de baja", "No es una suscripción"]);
  // Tocar fuera cierra sin cambiar nada.
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } });
  await expect(f).toHaveCount(0);
  await expect(tarjetas(page)).toHaveCount(3);

  // Sin todos los meses no se afirma «cada mes», y sin banco se dice por qué falta.
  await tarjeta(page, "Revista").click();
  await expect(f.locator(".gx-subf-anio")).toContainText("Unos 360 € al año si se cobra todos los meses.");
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } });
  await expect(f).toHaveCount(0);
  await tarjeta(page, "Club").click();
  await expect(f.locator(".gx-subf-cab .gx-sub-meta").first()).toHaveText("Se cobra el día 20 · banco: — (apuntada a mano)");
});

test("Pasar a Recibos guarda el recibo con el importe corregido y el día, y la quita de la bandeja", async ({ page }) => {
  await abre(page);
  await gastosSeccion(page, "subs");
  await tarjeta(page, "Netflix").click();
  await ficha(page).getByTestId("sub-importe").fill("13,49");
  await ficha(page).locator('[data-sub-accion="recibos"]').click();
  await expect(ficha(page)).toHaveCount(0);
  await expect(page.locator(".toast")).toContainText("«Netflix» pasa a Recibos");
  await expect(tarjeta(page, "Netflix")).toHaveCount(0);
  await expect(globo(page)).toHaveText("2");
  await expect(gastosEstado(page)).toHaveText("al mes · 2 por revisar");
  await expect.poll(async () => ((await guardado(page)).fixed || []).length).toBe(1);
  const s = await guardado(page);
  expect(s.fixed[0]).toMatchObject({ name: "Netflix", amount: 13.49, freq: "mes", day: 14 });
  expect(s.expenses).toHaveLength(todas.length);
});

test("Ya la he dado de baja pregunta; cancelar no toca nada y confirmar la esconde hasta que vuelva a cobrar", async ({ page }) => {
  await abre(page);
  await gastosSeccion(page, "subs");
  await tarjeta(page, "Netflix").click();
  await ficha(page).locator('[data-sub-accion="baja"]').click();
  const dlg = page.locator(".askback");
  await expect(dlg).toContainText("¿Ya has dado de baja «Netflix»?");
  await dlg.locator(".btn-ghost").click();
  await expect(dlg).toHaveCount(0);
  await expect(ficha(page)).toBeVisible();
  await expect(tarjetas(page)).toHaveCount(3);
  await ficha(page).locator('[data-sub-accion="baja"]').click();
  await dlg.locator(".btn-primary").click();
  await expect(ficha(page)).toHaveCount(0);
  await expect(page.locator(".toast")).toContainText("«Netflix» sale de la lista");
  await expect(tarjeta(page, "Netflix")).toHaveCount(0);
  await expect(globo(page)).toHaveText("2");
  // Se guarda la fecha de su último cobro (14/9): uno posterior la devuelve.
  await expect.poll(async () => ((await guardado(page)).subsBaja || {}).netflix).toBe(Date.parse("2026-09-14T12:00:00Z"));
  const s = await guardado(page);
  expect(s.fixed || []).toHaveLength(0);
  expect(s.subsDismissed || []).toHaveLength(0);
});

test("dada de baja y vuelve a cobrar: sale otra vez, con aviso en la tarjeta y en la ficha", async ({ page }) => {
  await abre(page, { subsBaja: { netflix: Date.parse("2026-08-14T12:00:00Z") } });
  await expect(globo(page)).toHaveText("3");
  await gastosSeccion(page, "subs");
  await expect(tarjeta(page, "Netflix").locator(".gx-sub-vuelve")).toHaveText("Ha vuelto a cobrar después de darla de baja");
  await expect(tarjeta(page, "Revista").locator(".gx-sub-vuelve")).toHaveCount(0);
  await tarjeta(page, "Netflix").click();
  await expect(ficha(page).locator(".gx-subf-vuelve")).toBeVisible();
});

test("dada de baja sin cobros nuevos: no sale ni cuenta en el globito", async ({ page }) => {
  await abre(page, { subsBaja: { netflix: Date.parse("2026-09-14T12:00:00Z") } });
  await expect(globo(page)).toHaveText("2");
  await gastosSeccion(page, "subs");
  await expect(tarjeta(page, "Netflix")).toHaveCount(0);
  await expect(tarjetas(page)).toHaveCount(2);
});

test("No es una suscripción pregunta, y al confirmar la descarta para siempre; la última deja «Todo en orden»", async ({ page }) => {
  await abre(page, { expenses: netflix });
  await expect(globo(page)).toHaveText("1");
  await gastosSeccion(page, "subs");
  await tarjeta(page, "Netflix").click();
  await ficha(page).locator('[data-sub-accion="no"]').click();
  const dlg = page.locator(".askback");
  await expect(dlg).toContainText("¿«Netflix» no es una suscripción?");
  await expect(dlg).toContainText("No se puede deshacer.");
  await dlg.locator(".btn-primary").click();
  await expect(ficha(page)).toHaveCount(0);
  await expect(tarjetas(page)).toHaveCount(0);
  await expect(globo(page)).toHaveCount(0);
  await expect(panel(page).locator(".gx-vacio-t")).toHaveText("Todo en orden");
  await expect(gastosEstado(page)).toHaveText("nada por revisar");
  await expect.poll(async () => (await guardado(page)).subsDismissed).toEqual(["netflix"]);
  // Los cargos siguen en Gastos como gastos normales.
  expect((await guardado(page)).expenses).toHaveLength(netflix.length);
});

test("atrás cierra la ficha y se queda en Suscripciones", async ({ page }) => {
  await abre(page);
  await gastosSeccion(page, "subs");
  await tarjeta(page, "Netflix").click();
  await expect(ficha(page)).toBeVisible();
  await page.goBack();
  await expect(ficha(page)).toHaveCount(0);
  await expect(gastosRoot(page)).toHaveAttribute("data-secc", "subs");
});
