import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/**
 * A/B idiomas (4.19.103): en/ca ya no van en el bundle. Si el arranque no espera el JSON,
 * el primer paint sale en español aunque settings.lang sea en. Siembra el idioma en frío y
 * comprueba etiquetas de LANG.en/ca (no las de es).
 */
test("arranque en inglés: el diccionario llega antes del primer paint", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    settings: { autoPrices: false, theme: "green", lang: "en" },
  });
  await page.goto("/");
  await page.locator("#mc-load").waitFor({ state: "detached", timeout: 15_000 });
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  // Por rol: con el cajón de Ajustes abierto el data-tab a veces no es el mejor ancla.
  await expect(page.getByRole("button", { name: /^Spending$/i })).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole("button", { name: /^Home$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Gastos$/ })).toHaveCount(0);
});

test("arranque en catalán: misma garantía con ca.json", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    settings: { autoPrices: false, theme: "green", lang: "ca" },
  });
  await page.goto("/");
  await page.locator("#mc-load").waitFor({ state: "detached", timeout: 15_000 });
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  // LANG.ca.tab_gastos = «Despeses»; tab_dash = «Inici»
  await expect(page.getByRole("button", { name: /^Despeses$/i })).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole("button", { name: /^Inici$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Gastos$/ })).toHaveCount(0);
});
