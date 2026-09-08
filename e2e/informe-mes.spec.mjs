import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* INFORME DEL MES CERRADO — tarjeta en Inicio los primeros días.
 * Cifras del mes ANTERIOR (no del nuevo). Descartar la quita. */

test("Inicio: tarjeta del mes cerrado con cifra acotada; descartar la quita", async ({ page }) => {
  // 2 de septiembre 2026 (Madrid): dentro de la ventana de 5 días.
  await page.clock.install({ time: new Date("2026-09-02T12:00:00+02:00") });
  await seedLoggedInDashboard(page, {
    budget: 500,
    expenses: [
      { id: "a1", date: "2026-08-10T12:00:00.000Z", amount: 40, merchant: "Super Ago", category: "super", source: "manual" },
      { id: "s1", date: "2026-09-01T12:00:00.000Z", amount: 99, merchant: "Super Sep", category: "super", source: "manual" },
    ],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  const card = page.locator("[data-tour='closed-month']");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card).toContainText("40");
  await expect(card).not.toContainText("139");
  await expect(card).not.toContainText("99");

  await card.getByRole("button", { name: /Descartar/i }).click();
  await expect(card).toHaveCount(0);
});
