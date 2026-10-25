import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra, gastosAbreFiltros } from "./fixtures.mjs";

/* GASTOS v5 · TANDA 5 (SPEC §7). La hoja de Filtros definitiva, abierta de verdad:
   · cuatro apartados en su orden (Periodo · Qué contar · Bancos · Categorías), «Restablecer»
     arriba y un solo botón abajo, «Ver N movimientos», cuyo N es el de la lista que queda;
   · Bancos arranca en TODOS los de gasto diario (contrato del 16/9) y «Todos los bancos» amplía;
   · Qué contar son los tres cajones, sin chip «Todo» (ninguno marcado = todo);
   · Categorías: las cinco más usadas a mano y «Las N» con la cuadrícula; una marcada desde la
     cuadrícula se queda a la vista al plegarla;
   · «Restablecer» vuelve a lo de entrada. El reloj es el de las fixtures: 26/9/2026 a mediodía. */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 412, height: 915 } });

const e = (id, ymd, amount, category, ent = "trade_republic") => ({ id, date: ymd + "T12:00:00Z", amount, category, merchant: id, source: "ob", ent });
const base = {
  budget: 1000,
  settings: { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["trade_republic", "revolut"] },
  accounts: [
    { id: "tr", ent: "trade_republic", name: "Efectivo", value: 3000, role: "diario", spendFrom: true },
    { id: "rv", ent: "revolut", name: "Revolut", value: 500, role: "diario" },
    { id: "sb", ent: "sabadell", name: "Cuenta", value: 2000, role: "fijos" },
  ],
};
/* 14 de los dos bancos diarios: super ×4, bares ×3 (Revolut), gasolina ×2 y uno de hogar, salud,
   pelu, un ingreso y una inversión. El del agua es de Sabadell, que no es de gasto diario: no sale
   hasta pedir «Todos los bancos». */
const expenses = [
  e("Super 1", "2026-09-25", 20, "super"), e("Super 2", "2026-09-22", 31, "super"), e("Super 3", "2026-09-15", 12, "super"), e("Super 4", "2026-09-03", 18, "super"),
  e("Bar 1", "2026-09-24", 9, "bares", "revolut"), e("Bar 2", "2026-09-18", 14, "bares", "revolut"), e("Bar 3", "2026-09-05", 6, "bares", "revolut"),
  e("Gasolina 1", "2026-09-20", 50, "gasolina"), e("Gasolina 2", "2026-09-02", 45, "gasolina"),
  e("Ferreteria", "2026-09-12", 23, "hogar"), e("Farmacia", "2026-09-11", 8, "salud"), e("Peluqueria", "2026-09-09", 15, "pelu"),
  e("Nomina", "2026-09-01", -1500, "ingreso"), e("Aporte", "2026-09-04", 100, "inversion"),
  e("RECIBO AGUA", "2026-09-08", 40, "agua", "sabadell"),
];

async function abre(page) {
  await seedLoggedInDashboard(page, { ...base, expenses });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
}
const hoja = (page) => page.locator(".v4-gastos-filter-sheet");
const chip = (page, k) => hoja(page).locator(`[data-fil="${k}"]`);
const ver = (page) => hoja(page).locator(".gx-fil-ver");
const tarjetas = (page) => gastosRoot(page).locator('[data-gx-secc="movs"] .v4-gastos-list-body button.v4-mov');
/* La lista pinta de 12 en 12 y carga más al acercarse al final: para contar TODAS se baja hasta
   el «Hasta aquí», que solo sale cuando ya está entera. Cuenta también los cargos de las filas
   grises (la aportación va a la de Inversiones desde el 25/10/2026): «Ver N» cuenta movimientos,
   estén sueltos o agrupados. */
async function cuentaTodas(page) {
  await expect.poll(async () => {
    await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); h.scrollTop = h.scrollHeight; });
    return gastosRoot(page).locator(".gx-fin").count();
  }).toBe(1);
  return (await tarjetas(page).count()) + (await gastosRoot(page).locator('[data-gx-secc="movs"] .gx-gris-it').count());
}
const botonFiltros = (page) => gastosRoot(page).locator("button.v4-chip").filter({ hasText: "🎛️" }).first();

test("cuatro apartados en orden, Restablecer arriba, «Ver N» abajo y lo de entrada marcado", async ({ page }) => {
  await abre(page);
  expect(await cuentaTodas(page)).toBe(14);
  await gastosAbreFiltros(page);
  const rotulos = await page.evaluate(() => [t("gv5_periodo"), t("g_bk_title"), t("g_filters_banks"), t("g_filters_cats")]);
  await expect(hoja(page).locator(".gx-fil-lab")).toHaveText(rotulos);
  // «Restablecer» va en la fila del título; el botón de abajo dice cuántos van a salir.
  await expect(hoja(page).locator(".gx-fil-top .gx-fil-reset")).toHaveText("Restablecer");
  await expect(ver(page)).toHaveText("Ver 14 movimientos");
  await expect(hoja(page).locator(".btn")).toHaveCount(1);
  // Periodo: Meses, el de entrada.
  await expect(hoja(page).locator('[data-periodo="months"]')).toHaveAttribute("aria-checked", "true");
  // Qué contar: los tres cajones, ninguno marcado, y sin chip «Todo».
  for (const b of ["cuenta", "ingreso", "neutra"]) await expect(chip(page, b)).toHaveAttribute("aria-pressed", "false");
  await expect(chip(page, "cuenta")).toHaveText("Día a día");
  await expect(hoja(page).getByRole("button", { name: "Todo", exact: true })).toHaveCount(0);
  // Bancos: los dos de gasto diario marcados con ✓; Sabadell y «Todos» no.
  for (const b of ["trade_republic", "revolut"]) {
    await expect(chip(page, b)).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, b)).toContainText("✓");
  }
  await expect(chip(page, "sabadell")).toHaveAttribute("aria-pressed", "false");
  await expect(chip(page, "_todos")).toHaveAttribute("aria-pressed", "false");
  await expect(chip(page, "revolut")).toHaveAccessibleName("Revolut");
  // Categorías: las más usadas primero, cinco, y luego «Las N ›».
  const cats = hoja(page).locator('[data-fil^="c:"]');
  await expect(cats).toHaveCount(5);
  await expect(cats.nth(0)).toHaveAttribute("data-fil", "c:super");
  await expect(cats.nth(1)).toHaveAttribute("data-fil", "c:bares");
  await expect(cats.nth(2)).toHaveAttribute("data-fil", "c:gasolina");
  const n = await page.evaluate(() => CATEGORIES.length + 3);
  await expect(hoja(page).locator(".v4-filter-cats-toggle")).toHaveText(`Las ${n} ›`);
  await expect(hoja(page).locator(".v4-filter-cats-toggle")).toHaveAttribute("aria-expanded", "false");
});

test("cada toque filtra en vivo y «Ver N» cuadra con la lista; Restablecer vuelve a lo de entrada", async ({ page }) => {
  await abre(page);
  await gastosAbreFiltros(page);
  await chip(page, "c:bares").click();
  await expect(chip(page, "c:bares")).toHaveAttribute("aria-pressed", "true");
  await expect(ver(page)).toHaveText("Ver 3 movimientos");
  await ver(page).click();
  await expect(hoja(page)).toHaveCount(0);
  await expect(tarjetas(page)).toHaveCount(3);
  await expect(botonFiltros(page)).toHaveText("🎛️ 1");

  // Dos cajones que no casan con Bares: la hoja lo dice antes de cerrar.
  await gastosAbreFiltros(page);
  await chip(page, "ingreso").click();
  await expect(ver(page)).toHaveText("Ver 0 movimientos");
  await chip(page, "ingreso").click();
  await chip(page, "c:bares").click();
  await chip(page, "cuenta").click();
  // Día a día: los 12 gastos que cuentan (fuera la nómina y la aportación).
  await expect(ver(page)).toHaveText("Ver 12 movimientos");
  await chip(page, "revolut").click();
  await expect(chip(page, "revolut")).toHaveAttribute("aria-pressed", "false");
  await expect(ver(page)).toHaveText("Ver 9 movimientos");
  await hoja(page).locator('[data-periodo="all"]').click();

  await hoja(page).locator(".gx-fil-reset").click();
  await expect(ver(page)).toHaveText("Ver 14 movimientos");
  await expect(chip(page, "cuenta")).toHaveAttribute("aria-pressed", "false");
  await expect(chip(page, "revolut")).toHaveAttribute("aria-pressed", "true");
  await expect(hoja(page).locator('[data-periodo="months"]')).toHaveAttribute("aria-checked", "true");
  await ver(page).click();
  expect(await cuentaTodas(page)).toBe(14);
  await expect(botonFiltros(page)).toHaveText("🎛️");
});

test("«Las N» abre todas; la marcada desde ahí se queda a la vista; «Todos los bancos» amplía", async ({ page }) => {
  await abre(page);
  await gastosAbreFiltros(page);
  const toggle = hoja(page).locator(".v4-filter-cats-toggle");
  await expect(page.locator("#gastos-filter-cats-body")).toHaveCSS("visibility", "hidden");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#gastos-filter-cats-body")).toHaveCSS("visibility", "visible");
  // Cine no tiene ningún gasto: no es de las más usadas y solo se llega por aquí.
  await expect(chip(page, "c:cine")).toHaveCount(0);
  await page.getByTestId("gastos-filter-cat-cine").click();
  await expect(ver(page)).toHaveText("Ver 0 movimientos");
  await toggle.click();
  await expect(page.locator("#gastos-filter-cats-body")).toHaveCSS("visibility", "hidden");
  await expect(chip(page, "c:cine")).toHaveAttribute("aria-pressed", "true");
  await expect(hoja(page).locator('[data-fil^="c:"]')).toHaveCount(6);
  await chip(page, "c:cine").click();
  await expect(ver(page)).toHaveText("Ver 14 movimientos");

  await chip(page, "_todos").click();
  await expect(chip(page, "_todos")).toHaveAttribute("aria-pressed", "true");
  await expect(ver(page)).toHaveText("Ver 15 movimientos");
  await ver(page).click();
  await expect(tarjetas(page).filter({ hasText: "RECIBO AGUA" })).toHaveCount(1);
});
