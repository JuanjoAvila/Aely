import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, gastosCifra, gastosEstado, gastosSeccion } from "./fixtures.mjs";

/* Presupuesto por categoría: desglose en la sección Categorías (Gastos v5, tanda 2), límite
   informativo, misma regla que expenseCountsBudget (banco fuera de gasto diario no llena la barra). */

const now = new Date("2026-09-15T12:00:00Z");
const d = (n) => new Date(now.getTime() - n * 86400000).toISOString();

const accounts = [
  { id: "tr", ent: "trade_republic", name: "Efectivo", value: 6300, role: "diario", spendFrom: true },
  { id: "rv", ent: "revolut", name: "Revolut", value: 200, role: "fijos" },
];

const settings = {
  autoPrices: false,
  theme: "green",
  gTotalMode: "split",
  expenseBanks: ["trade_republic"],
};

const expenses = [
  { id: "e-super", date: d(1), amount: 40, merchant: "Mercadona", category: "super", source: "macrodroid", ent: "trade_republic" },
  { id: "e-bares", date: d(2), amount: 20, merchant: "Bar", category: "bares", source: "macrodroid", ent: "trade_republic" },
  { id: "e-inv", date: d(3), amount: 100, merchant: "Broker", category: "inversion", source: "manual", ent: "trade_republic" },
  { id: "e-rv", date: d(4), amount: 70, merchant: "Zara", category: "ropa", source: "macrodroid", ent: "revolut" },
];

async function abreGastos(page) {
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
  // Gastos v5 (tanda 2): el desglose vive en su sección, ya no encima de la lista.
  await gastosSeccion(page, "cats");
}

test("Gastos: desglose por categoría cuadra con la cabecera y excluye neutras/otrobanco", async ({ page }) => {
  await page.clock.install({ time: now });
  await seedLoggedInDashboard(page, {
    accounts, settings, expenses, budget: 1000,
    categoryBudgets: { super: 200 },
  });
  await abreGastos(page);

  // Gastos v5: la cifra de la cabecera es lo que cuenta contra el límite.
  await expect(gastosCifra(page)).toHaveText("60,00 €");

  const cats = page.locator('[data-testid="gastos-cats"] .v4-gastos-cat');
  await expect(cats).toHaveCount(2);
  await expect(page.locator('.v4-gastos-cat[data-cat="super"]')).toContainText("40");
  await expect(page.locator('.v4-gastos-cat[data-cat="bares"]')).toContainText("20");
  await expect(page.locator('.v4-gastos-cat[data-cat="inversion"]')).toHaveCount(0);
  await expect(page.locator('.v4-gastos-cat[data-cat="ropa"]')).toHaveCount(0);

  const superBar = page.locator('.v4-gastos-cat[data-cat="super"] [role="progressbar"]');
  await expect(superBar).toHaveAttribute("aria-valuemax", "200");
  await expect(superBar).toHaveAttribute("aria-valuenow", "40");
  await expect(page.locator('.v4-gastos-cat[data-cat="bares"] [role="progressbar"]')).toHaveCount(0);
});

test("Gastos: poner y quitar límite de categoría no mueve el presupuesto general", async ({ page }) => {
  await page.clock.install({ time: now });
  await seedLoggedInDashboard(page, {
    accounts, settings,
    expenses: [
      { id: "e1", date: d(1), amount: 40, merchant: "Mercadona", category: "super", source: "manual", ent: "trade_republic" },
    ],
    budget: 1000,
  });
  await abreGastos(page);

  // Gastos v5: cifra y margen contra el presupuesto general en la cabecera (1000 − 40).
  await expect(gastosCifra(page)).toHaveText("40,00 €");
  await expect(gastosEstado(page)).toContainText("960 € por debajo");

  await page.locator('.v4-gastos-cat[data-cat="super"]').click();
  await expect(page.locator(".ask-sheet, .tabsheet").first()).toBeVisible();
  await page.locator(".chip", { hasText: "200 €" }).click();
  await page.locator(".btn-primary", { hasText: /Guardar|Save|Desa/ }).click();

  await expect(page.locator('.v4-gastos-cat[data-cat="super"] [role="progressbar"]')).toHaveAttribute("aria-valuemax", "200");
  await expect(gastosCifra(page)).toHaveText("40,00 €");
  await expect(gastosEstado(page)).toContainText("960 € por debajo");

  // set() vuelca a localStorage con debounce 400 ms — esperar a que quede escrito.
  await expect.poll(async () => {
    return page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
      return (s.categoryBudgets || {}).super;
    });
  }).toBe(200);
});

/* ─────────────────────────────────────────────────────────────────────────────
   YA NO SE PLIEGA (Gastos v5, tanda 2, 24/10/2026)
   Se podía ocultar a petición de su pareja (10/9): «es too much» porque eran ocho o diez filas
   fijas ENCIMA de la lista de gastos. Ahora vive en su propia sección y no tapa nada, así que
   plegarlo dejaría una sección vacía (SPEC §8: «ya no hace falta»). Lo que se defiende es que
   quien lo tenía plegado no se encuentre la sección en blanco.
   ───────────────────────────────────────────────────────────────────────────── */

const OUT_TIROS = process.env.MC_TIROS || "";

async function gastosSembrado(page, extra = {}) {
  await page.clock.install({ time: now });
  await seedLoggedInDashboard(page, { accounts, settings: { ...settings, ...extra }, expenses, budget: 1000, __seedOnce: true });
  await abreGastos(page);
}

test("★ quien lo tenía plegado lo ve entero en Categorías, y sin interruptor", async ({ page }) => {
  await gastosSembrado(page, { gastosCatsOff: true });
  await expect(page.locator('[data-testid="gastos-cats"] .v4-gastos-cat')).toHaveCount(2);
  await expect(page.locator('[data-testid="gastos-cats"] .v4-gastos-cat').first()).toBeVisible();
  await expect(page.locator(".v4-gastos-cats-h")).toHaveCount(0);
});

test("★ y en Movimientos ya no hay desglose encima de la lista", async ({ page }) => {
  await gastosSembrado(page);
  await gastosSeccion(page, "movs");
  await expect(page.locator('[data-gx-secc="movs"] .v4-gastos-cat')).toHaveCount(0);
  await expect(page.locator('[data-testid="gastos-cats"]')).toBeHidden();
});

test("tiros: cómo se ve la sección Categorías", async ({ page }) => {
  test.skip(!OUT_TIROS, "solo cuando se piden capturas con MC_TIROS");
  await gastosSembrado(page);
  await page.screenshot({ path: OUT_TIROS + "/cats-seccion.png" });
});
