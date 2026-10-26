import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra, gastosEstado, gastosSeccion,
  gastosPulsaLarga } from "./fixtures.mjs";

/* GASTOS v5 · TANDA 3 (SPEC §2.1, §3, §4.1 y §5). Categorías → filtro, y el límite por sus dos
   puertas. Render puro derivado del estado (AGENTS §7): cada prueba abre Gastos de verdad.
   · tocar una categoría lleva a Movimientos con esa categoría y su mes: píldora de su color, la
     cifra es la de su fila en Categorías y los totales del día la suman;
   · la fila de meses está siempre en Categorías y con filtro, y cambia el mes sin soltar la
     categoría; la píldora quita el filtro y cambiar de sección también;
   · el límite (decisión del dueño): mantener pulsada la categoría o el chip junto a la píldora
     abren la MISMA hoja; un toque de vibración; poner y quitar no mueve el presupuesto general.
   El reloj es el de las fixtures: 26/9/2026 a mediodía. */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

const e = (id, ymd, amount, category, extra = {}) => ({ id, date: ymd + "T12:00:00Z", amount, category, merchant: id, source: "ob", ent: "trade_republic", ...extra });
const base = {
  budget: 1000,
  categoryBudgets: { super: 50 },
  settings: { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["trade_republic"] },
  accounts: [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 3000, role: "diario", spendFrom: true }],
  fixed: [{ id: "luz", name: "Luz", amount: 62, freq: "mes", account: "trade_republic", day: 20 }],
};
/* Septiembre: super 20 (hoy) + 35 (día 10) = 55, compras 30, bares 15 → 100 que cuentan.
   Agosto: super 25 (día 5) + 10 (día 20) = 35. Julio: super 40. El de junio hace que el histórico
   cubra julio y agosto enteros (sin eso no se compara: «menos que julio» con medio mes sería falso).
   El recibo de la luz está en «super» a propósito: es un cargo de recibo (fila gris) y no puede
   salir ni sumar con el filtro puesto. */
const expenses = [
  e("Hoy super", "2026-09-26", 20, "super"), e("Bar ayer", "2026-09-25", 15, "bares"),
  e("Compra del 20", "2026-09-20", 30, "compras"), e("ENDESA", "2026-09-20", 62, "super", { reciboId: "luz" }),
  e("Super del 10", "2026-09-10", 35, "super"),
  e("Super agosto 20", "2026-08-20", 10, "super"), e("Super agosto 5", "2026-08-05", 25, "super"),
  e("Compras agosto", "2026-08-12", 44, "compras"),
  e("Super julio", "2026-07-15", 40, "super"), e("Junio", "2026-06-20", 9, "compras"),
];

async function abre(page, overrides = {}) {
  // El motor de vibración es un doble que apunta cada llamada (como gastos-v5-secciones).
  await page.addInitScript(() => {
    window.__vib = [];
    window.Capacitor = { Plugins: { AelyHaptics: {
      edge(p) { window.__vib.push(p); return Promise.resolve({ tunable: true, shaped: true, amplitudeControl: true }); },
      fill(p) { window.__vib.push(p); return Promise.resolve({}); } } } };
  });
  await seedLoggedInDashboard(page, { ...base, expenses, __seedOnce: true, ...overrides });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
}
const panel = (page, id) => gastosRoot(page).locator(`[data-gx-secc="${id}"]`);
const fila = (page, cat) => panel(page, "cats").locator(`.v4-gastos-cat[data-cat="${cat}"]`);
const pildora = (page) => gastosRoot(page).getByTestId("gastos-filtro-cat");
const chipLimite = (page) => gastosRoot(page).getByTestId("gastos-filtro-limite");
const tarjetas = (page) => panel(page, "movs").locator(".v4-gastos-list-body button.v4-mov");
const meses = (page) => gastosRoot(page).getByTestId("gastos-meses");
const totalDia = (page, ymd) => panel(page, "movs").locator(`.gx-dia[data-gx-day="${ymd.replaceAll("-", "")}"] [data-testid="gastos-dia-total"]`);
// Solo los toques de segmento (`mcTickHaptic`): el anillo de Inicio vibra por su cuenta al arrancar.
const vibraciones = (page) => page.evaluate(() => window.__vib.filter((v) => v.amplitude === mcHapticTune().segAmp && v.cycle == null).length);
const hoja = (page) => page.getByRole("dialog");
const guardado = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3") || "{}").categoryBudgets || {});

test("tocar una categoría filtra Movimientos por ella y su mes; la cifra es la de su fila y la píldora lo quita", async ({ page }) => {
  await abre(page);
  await expect(gastosCifra(page)).toHaveText("100,00 €");
  await gastosSeccion(page, "cats");
  await expect(fila(page, "super")).toContainText("55");
  // Pista acortada el 26/10/2026 (textos mínimos): dice lo mismo en una línea.
  await expect(panel(page, "cats").locator(".hint")).toHaveText("Toca para filtrar · mantén pulsado para el límite");
  const antes = await vibraciones(page);
  await fila(page, "super").click();

  // Movimientos, con la píldora del color de la categoría y solo sus movimientos de septiembre.
  await expect(gastosRoot(page)).toHaveAttribute("data-secc", "movs");
  await expect(pildora(page).locator(".gx-fil-pil")).toHaveText(/Supermercado · septiembre/);
  await expect(pildora(page).locator(".gx-fil-pil")).toHaveCSS("color", "rgb(95, 208, 138)");
  await expect(tarjetas(page)).toHaveCount(2);
  await expect(tarjetas(page).nth(0)).toContainText("Hoy super");
  await expect(tarjetas(page).nth(1)).toContainText("Super del 10");
  // El cargo del recibo (aunque sea de «super») ni sale ni suma, y no hay filas grises.
  await expect(panel(page, "movs").locator(".gx-gris")).toHaveCount(0);
  await expect(panel(page, "movs").getByText("ENDESA")).toHaveCount(0);
  // La cifra = su fila en Categorías (55); la línea compara con super de agosto hasta el día 26 (35).
  await expect(gastosCifra(page)).toHaveText("55,00 €");
  await expect(gastosEstado(page)).toHaveText("2 movimientos · 20 € más que en agosto a estas alturas");
  // Los totales del día son de la categoría y suman la cifra.
  await expect(totalDia(page, "2026-09-26")).toHaveText("20,00 €");
  await expect(totalDia(page, "2026-09-10")).toHaveText("35,00 €");
  // Un toque no vibra (vibra la pulsación larga) ni abre la hoja del límite.
  expect(await vibraciones(page)).toBe(antes);
  await expect(hoja(page)).toHaveCount(0);
  // Super pasa de su límite de 50: el chip lo dice en coral.
  await expect(chipLimite(page)).toHaveText("Límite 50 € · 5 € de más");
  await expect(chipLimite(page)).toHaveClass(/sobre/);

  /* Con dos días la lista cabe entera en la pantalla: no hay nada que bajar (tanda 6: antes el
     pie dejaba bajar a una pantalla vacía solo para que el día 10 subiera hasta la cabecera) y la
     cifra se queda en la de la categoría. Lo de bajar hasta un día lo cubre `gastos-v5`. */
  expect(await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); return h.scrollHeight - h.clientHeight; })).toBeLessThanOrEqual(1);
  await expect(gastosCifra(page)).toHaveText("55,00 €");

  // La píldora quita el filtro: vuelve todo, con la cifra del presupuesto y el recibo atenuado.
  await pildora(page).locator(".gx-fil-pil").click();
  await expect(pildora(page)).toHaveCount(0);
  await expect(gastosCifra(page)).toHaveText("100,00 €");
  await expect(gastosEstado(page)).toHaveText("gastado en septiembre · 900 € por debajo");
  await expect(tarjetas(page).filter({ hasText: "ENDESA" })).toHaveClass(/v4-mov-skip/);   // el recibo, suelto y atenuado (26/10)
  await expect(tarjetas(page).filter({ hasText: "Bar ayer" })).toHaveCount(1);
});

test("con filtro, la fila de meses está siempre y cambia de mes sin soltar la categoría", async ({ page }) => {
  await abre(page);
  await gastosSeccion(page, "cats");
  // En Categorías la fila está desde arriba (sin bajar), con el mes en curso marcado.
  await expect(meses(page)).toHaveAttribute("aria-hidden", "false");
  await expect(meses(page).locator(".gx-mes.on")).toHaveText("septiembre");
  await fila(page, "super").click();
  await expect(meses(page)).toHaveAttribute("aria-hidden", "false");
  await expect(meses(page).locator(".gx-mes")).toHaveText(["junio", "julio", "agosto", "septiembre"]);

  await meses(page).locator('.gx-mes[data-ym="2026-08"]').click();
  await expect(pildora(page).locator(".gx-fil-pil")).toHaveText(/Supermercado · agosto/);
  await expect(tarjetas(page)).toHaveCount(2);
  await expect(tarjetas(page).nth(0)).toContainText("Super agosto 20");
  await expect(gastosCifra(page)).toHaveText("35,00 €");
  // Mes cerrado: contra julio entero, y el límite de hoy no se aplica al pasado (no hay «de más»).
  await expect(gastosEstado(page)).toHaveText("2 movimientos · 5 € menos que en julio");
  await expect(chipLimite(page)).toHaveText("Límite 50 €");
  await expect(meses(page).locator(".gx-mes.on")).toHaveText("agosto");

  // Cambiar de sección quita el filtro, y Categorías sigue en el mes elegido (agosto: 35 de super).
  await gastosSeccion(page, "cats");
  await expect(fila(page, "super")).toContainText("35");
  await expect(fila(page, "super").locator('[role="progressbar"]')).toHaveCount(0);
  await expect(panel(page, "cats").locator(".gx-cats-barra")).toHaveCount(0);
  await expect(gastosEstado(page)).toHaveText("agosto por categoría");
  await gastosSeccion(page, "movs");
  await expect(pildora(page)).toHaveCount(0);
  await expect(gastosCifra(page)).toHaveText("100,00 €");
});

test("el límite: pulsación larga en Categorías y chip del filtro abren la misma hoja; poner y quitar no toca el presupuesto", async ({ page }) => {
  await abre(page, { categoryBudgets: {} });
  await gastosSeccion(page, "cats");
  await expect(fila(page, "super").locator('[role="progressbar"]')).toHaveCount(0);

  // Puerta 1: mantener pulsada la categoría. Un toque de vibración, la hoja, y NO filtra.
  const antes = await vibraciones(page);
  await gastosPulsaLarga(page, fila(page, "super"));
  await expect(hoja(page)).toBeVisible();
  await expect(hoja(page)).toContainText("Límite en Supermercado");
  expect(await vibraciones(page)).toBe(antes + 1);
  await hoja(page).locator(".chip", { hasText: "200 €" }).click();
  await hoja(page).locator(".btn-primary", { hasText: "Guardar" }).click();
  await expect(hoja(page)).toHaveCount(0);
  await expect(gastosRoot(page)).toHaveAttribute("data-secc", "cats");
  await expect(fila(page, "super").locator('[role="progressbar"]')).toHaveAttribute("aria-valuemax", "200");
  await expect(fila(page, "super").locator('[role="progressbar"]')).toHaveAttribute("aria-valuenow", "55");
  await expect.poll(() => guardado(page)).toEqual({ super: 200 });
  // El presupuesto general no se mueve.
  await expect(gastosCifra(page)).toHaveText("100,00 €");
  await expect(gastosEstado(page)).toHaveText("septiembre por categoría · 900 € por debajo");

  // Puerta 2: el chip junto a la píldora dice lo que queda (200 − 55) y abre la misma hoja.
  await fila(page, "super").click();
  await expect(chipLimite(page)).toHaveText("Límite 200 € · quedan 145 €");
  await chipLimite(page).click();
  await expect(hoja(page)).toContainText("Límite en Supermercado");
  await hoja(page).locator(".chip", { hasText: "Quitar límite" }).click();
  await hoja(page).locator(".btn-primary", { hasText: "Guardar" }).click();
  await expect(hoja(page)).toHaveCount(0);
  await expect(chipLimite(page)).toHaveText("Poner límite");
  await expect.poll(() => guardado(page)).toEqual({});
  // Sigue filtrado: quitar el límite no quita el filtro.
  await expect(gastosCifra(page)).toHaveText("55,00 €");
  await pildora(page).locator(".gx-fil-pil").click();
  await expect(gastosCifra(page)).toHaveText("100,00 €");
  await expect(gastosEstado(page)).toHaveText("gastado en septiembre · 900 € por debajo");
});

test("al salir de Gastos y volver se aterriza en Movimientos sin filtro", async ({ page }) => {
  await abre(page);
  await gastosSeccion(page, "cats");
  await fila(page, "bares").click();
  await expect(pildora(page)).toBeVisible();
  await expect(gastosCifra(page)).toHaveText("15,00 €");
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await expect(page.locator('.botnav-tab.active[data-tour="inicio"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !document.querySelector('[data-testid="gastos-filtro-cat"]')), { timeout: 8_000 }).toBe(true);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toHaveText("100,00 €");
  await expect(pildora(page)).toHaveCount(0);
});

test("en Mi ciclo el filtro es la categoría en el ciclo, con la fila de ciclos y no la de meses", async ({ page }) => {
  await abre(page, { settings: { ...base.settings, budgetCycle: true },
    expenses: expenses.concat([e("Nómina", "2026-09-24", -2000, "ingreso", { merchant: "Nómina" })]) });
  await expect(gastosRoot(page)).toHaveAttribute("data-periodo", "cycle");
  await gastosSeccion(page, "cats");
  // Tanda 6: en Mi ciclo la fila es la de ciclos (aquí uno solo, el del cobro del 24).
  await expect(meses(page)).toHaveAttribute("aria-label", "Ciclos");
  await expect(meses(page).locator(".gx-mes")).toHaveCount(1);
  await expect(fila(page, "super")).toContainText("20");
  await fila(page, "super").click();
  await expect(pildora(page).locator(".gx-fil-pil")).toContainText("Supermercado");
  await expect(tarjetas(page)).toHaveCount(1);
  await expect(gastosCifra(page)).toHaveText("20,00 €");
  await expect(gastosEstado(page)).toHaveText("1 movimiento");
  await expect(meses(page)).toHaveAttribute("aria-label", "Ciclos");
  // El ciclo es el periodo en que manda el límite: el chip dice lo que queda (50 − 20).
  await expect(chipLimite(page)).toHaveText("Límite 50 € · quedan 30 €");
});

/* Con un DEDO (toques de CDP, que generan los mismos punteros que en el móvil): mantener pulsada
   abre el límite y no filtra al soltar; si el dedo se mueve, es scroll y no abre nada. */
async function dedo(page, x, y, ms, dy = 0) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  if (dy) for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (dy * i) / 6 }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await new Promise((r) => setTimeout(r, ms));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}
test("con el dedo: mantener pulsada abre el límite sin filtrar; arrastrar no lo abre", async ({ page }) => {
  await abre(page);
  await gastosSeccion(page, "cats");
  const box = await fila(page, "compras").boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await dedo(page, x, y, 0, -60);
  await page.waitForTimeout(700);
  await expect(hoja(page)).toHaveCount(0);
  await expect(gastosRoot(page)).toHaveAttribute("data-secc", "cats");
  await dedo(page, x, y, 700);
  await expect(hoja(page)).toContainText("Límite en Compras");
  await page.waitForTimeout(300);
  await expect(gastosRoot(page)).toHaveAttribute("data-secc", "cats");
  await expect(pildora(page)).toHaveCount(0);
});
