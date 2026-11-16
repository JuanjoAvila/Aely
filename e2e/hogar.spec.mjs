import { test, expect } from "@playwright/test";
import {
  bootDashboard,
  householdBundleSeed,
  openHogarPanel,
  VIEWPORT_COMPACT,
  VIEWPORT_PIXEL,
} from "./fixtures.mjs";

const snapA = {
  user_id: "member-a",
  household_id: "hh-e2e-1",
  published_at: "2026-07-01T10:00:00.000Z",
  payload: {
    displayName: "Ana",
    netWorth: 5000,
    activos: 6000,
    debtTotal: 1000,
    invested: 2000,
    liquid: 3000,
    thisMonthSpent: 220,
    fixedMonthly: 350,
    fixedThisMonth: 350,
    budget: 500,
    accounts: [{ name: "Cuenta Ana", ent: "sabadell", label: "Sabadell", value: 3000 }],
    expensesByCat: [
      { id: "super", spent: 120 },
      { id: "casa", spent: 80 },
    ],
    fixedTop: [{ name: "Alquiler", amount: 300 }],
    publishedAt: "2026-07-01T10:00:00.000Z",
  },
};

const snapB = {
  user_id: "member-b",
  household_id: "hh-e2e-1",
  published_at: "2026-07-02T10:00:00.000Z",
  payload: {
    displayName: "Luis",
    netWorth: 3000,
    activos: 3500,
    debtTotal: 500,
    invested: 1000,
    liquid: 2000,
    thisMonthSpent: 90,
    fixedMonthly: 150,
    fixedThisMonth: 150,
    budget: 400,
    accounts: [{ name: "Cuenta Luis", ent: "caixa", label: "CaixaBank", value: 2000 }],
    expensesByCat: [{ id: "ocio", spent: 60 }],
    fixedTop: [{ name: "Gym", amount: 40 }],
    publishedAt: "2026-07-02T10:00:00.000Z",
  },
};

test.describe("Hogar › estado vacío y alta", () => {
  test("sin hogar: muestra crear y unirme @393x851", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_PIXEL);
    await bootDashboard(page);
    await openHogarPanel(page);
    await expect(page.getByRole("button", { name: /Crear hogar|Create household/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Unirme con código|Join with code/i })).toBeVisible();
  });

  test("crear hogar desde UI (mock Supabase)", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_COMPACT);
    await bootDashboard(page);
    await openHogarPanel(page);
    await page.getByRole("button", { name: /Crear hogar|Create household/i }).click();
    await page.getByPlaceholder(/Casa|House|Llar/i).fill("Piso e2e");
    await page.getByRole("button", { name: /Crear y obtener código|Create & get code|Crear i obtenir/i }).click();
    await expect(page.getByText(/Patrimonio del hogar|Household net worth/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Piso e2e|piso e2e/i)).toBeVisible();
  });
});

test.describe("Hogar › totales fusionados", () => {
  test("suma patrimonio, gasto y fijos de dos snapshots", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_PIXEL);
    const hh = householdBundleSeed({ name: "Casa fusion", snapshots: [snapA, snapB] });
    await bootDashboard(page, {}, hh);
    await openHogarPanel(page);

    await expect(page.getByText("Casa fusion")).toBeVisible();
    const netBar = page.locator(".total-bar .tn.num").first();
    await expect(netBar).toContainText("8000");
    const metrics = page.locator(".metric .num");
    await expect(metrics.nth(0)).toContainText("310");
    await expect(metrics.nth(1)).toContainText("500");
    await expect(page.getByText("Ana")).toBeVisible();
    await expect(page.getByText("Luis")).toBeVisible();
  });

  test("categorías y barras @360x740", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_COMPACT);
    const hh = householdBundleSeed({ snapshots: [snapA, snapB] });
    await bootDashboard(page, {}, hh);
    await openHogarPanel(page);
    await expect(page.getByText(/Gastos del hogar por categoría|Household spending by category|Despeses de la llar/i)).toBeVisible();
    await expect(page.locator(".bar i").first()).toBeVisible();
  });

  test("publicar mi vista actualiza totales locales (un miembro)", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_PIXEL);
    const hh = householdBundleSeed({ snapshots: [] });
    await bootDashboard(
      page,
      {
        fixed: [{ id: "f1", name: "Renta", amount: 500, freq: "mes", account: "sabadell" }],
        expenses: [{ id: "e1", amount: 35, category: "super", date: new Date().toISOString(), source: "manual" }],
      },
      hh
    );
    await openHogarPanel(page);
    await page.getByRole("button", { name: /Actualizar mi vista|Publish my view/i }).click();
    await expect(page.getByText(/1\s+miembro|1\s+member/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".total-bar .tn.num").first()).not.toHaveText(/^0/);
  });
});