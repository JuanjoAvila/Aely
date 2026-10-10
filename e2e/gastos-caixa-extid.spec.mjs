import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* INC-2709-06. Dos cargos del mismo banco, día, importe y comercio tienen que verse los dos
   en Gastos, con el filtro de bancos de gasto diario y el mes en curso, en los tres idiomas.
   El comercio no se traduce; la categoría sí. Reloj de fixture: 26/9/2026. */

const day = "2026-09-26";
const noon = new Date(day + "T12:00:00").toISOString();
const salt = new Date(day + "T18:30:00").toISOString();
const accounts = [{ id: "cx", ent: "caixabank", name: "Caixa", value: 400, role: "diario", spendFrom: true }];
const expenses = [
  { id: "e-caixa-a", date: noon, amount: 12.5, merchant: "MERCADONA", category: "super", source: "ob", ent: "caixabank", extId: "cargo-A" },
  { id: "e-caixa-b", date: salt, amount: 12.5, merchant: "MERCADONA", category: "super", source: "ob", ent: "caixabank", extId: "cargo-B" },
];

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

for (const caso of [
  { lang: "es", cat: "Supermercado" },
  { lang: "en", cat: "Groceries" },
  { lang: "ca", cat: "Supermercat" },
]) {
  test("Gastos enseña los dos cargos Caixa del mismo día (" + caso.lang + ")", async ({ page }) => {
    await seedLoggedInDashboard(page, {
      accounts,
      expenses,
      settings: { autoPrices: false, lang: caso.lang, budgetCycle: false, expenseBanks: ["caixabank"] },
    });
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    const filas = page.locator(".v4-gastos-list-body button.v4-mov");
    await expect(filas).toHaveCount(2);
    await expect(filas.nth(0)).toContainText("MERCADONA");
    await expect(filas.nth(1)).toContainText("MERCADONA");
    await expect(filas.nth(0)).toContainText(caso.cat);
    await expect(filas.nth(1)).toContainText(caso.cat);
    await expect(page.locator('.v4-gastos-list-body button.v4-mov[data-expense-id="e-caixa-a"]')).toHaveCount(1);
    await expect(page.locator('.v4-gastos-list-body button.v4-mov[data-expense-id="e-caixa-b"]')).toHaveCount(1);
  });
}
