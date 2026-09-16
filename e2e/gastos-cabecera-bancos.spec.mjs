import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* B09-A: la cabecera de Gastos debe recalcularse al cambiar bancos de gasto diario SIN esperar
   a que un sync mute `expenses`. En 4.18.6 el useMemo de monthSummary omitía accounts/settings
   aunque monthBudgetStats los lee — la cifra se quedaba alta hasta sincronizar. */

// Reloj y movimientos del mismo mes: restar días a hoy falla al empezar un mes.
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
  // Extra de gasto diario (además de TR principal): cuenta en cabecera.
  expenseBanks: ["trade_republic", "revolut"],
};

const expenses = [
  { id: "e-tr", date: d(1), amount: 30, merchant: "Mercadona", category: "super", source: "macrodroid", ent: "trade_republic" },
  { id: "e-rv", date: d(2), amount: 70, merchant: "Cafe", category: "ocio", source: "macrodroid", ent: "revolut" },
];

async function abreGastos(page) {
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-gastos-summary")).toBeVisible();
}

test("cabecera Gastos baja al quitar un banco de gasto diario sin sync", async ({ page }) => {
  await page.clock.install({ time: now });
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await abreGastos(page);

  const bar = page.locator('.v4-gastos-progress[role="progressbar"]');
  await expect(bar).toHaveAttribute("aria-valuenow", "100");
  const expensesBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]"));

  // Bloquear el resync automático de rol: en e2e no hay banco real y un bankSync podría
  // tocar `expenses`, enmascarando el bug de memo que queremos cazar.
  await page.evaluate(() => {
    window.addEventListener("mc-bank-role-changed", (e) => e.stopImmediatePropagation(), true);
  });

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  /* Desde 4.19.77 «Editar» solo sale con obAccounts pendientes. El rol se cambia en la ficha. */
  await page.locator(".v4-card-list button.v4-mov").filter({ hasText: /Revolut/ }).first().click();
  await expect(page.locator(".v4-sheet")).toBeVisible();
  await page.locator(".v4-sheet .v4-ficha-op").filter({ hasText: /Para los recibos|For the bills|Per als rebuts/i }).click();
  await page.locator(".v4-sheet-back").click({ position: { x: 10, y: 10 } });

  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-gastos-summary")).toBeVisible();

  // Misma lista de gastos en disco; solo cambió qué bancos cuentan.
  const expensesAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]"));
  expect(expensesAfter, "expenses no deben mutar para esta prueba").toEqual(expensesBefore);

  await expect(bar, "sin el fix la cabecera se quedaría en 100 hasta un sync").toHaveAttribute("aria-valuenow", "30");
});
