import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Presupuesto por categoría: desglose bajo la cabecera, límite informativo, misma regla
   que expenseCountsBudget (banco fuera de gasto diario no llena la barra). */

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
  await expect(page.locator(".v4-gastos-summary")).toBeVisible();
}

test("Gastos: desglose por categoría cuadra con la cabecera y excluye neutras/otrobanco", async ({ page }) => {
  await page.clock.install({ time: now });
  await seedLoggedInDashboard(page, {
    accounts, settings, expenses, budget: 1000,
    categoryBudgets: { super: 200 },
  });
  await abreGastos(page);

  const bar = page.locator('.v4-gastos-progress[role="progressbar"]');
  await expect(bar).toHaveAttribute("aria-valuenow", "60");

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

  const head = page.locator('.v4-gastos-progress[role="progressbar"]');
  await expect(head).toHaveAttribute("aria-valuenow", "40");
  await expect(head).toHaveAttribute("aria-valuemax", "1000");

  await page.locator('.v4-gastos-cat[data-cat="super"]').click();
  await expect(page.locator(".ask-sheet, .tabsheet").first()).toBeVisible();
  await page.locator(".chip", { hasText: "200 €" }).click();
  await page.locator(".btn-primary", { hasText: /Guardar|Save|Desa/ }).click();

  await expect(page.locator('.v4-gastos-cat[data-cat="super"] [role="progressbar"]')).toHaveAttribute("aria-valuemax", "200");
  await expect(head).toHaveAttribute("aria-valuemax", "1000");
  await expect(head).toHaveAttribute("aria-valuenow", "40");

  // set() vuelca a localStorage con debounce 400 ms — esperar a que quede escrito.
  await expect.poll(async () => {
    return page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
      return (s.categoryBudgets || {}).super;
    });
  }).toBe(200);
});
