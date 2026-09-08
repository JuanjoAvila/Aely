import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* AJUSTES → IMPORTACIONES (2026-08-04, petición suya). Las dos importaciones estaban repartidas y
 * escondidas: la hoja de Excel dentro de «Copia de seguridad» —donde nadie la buscaría— y el
 * histórico del banco al final de «Mis bancos». Son la misma tarea, así que viven juntas.
 * Desde tanda 4 el histórico SOLO está aquí (se quitó de Mis bancos).
 * Y el exportar/importar JSON a mano se retiró: la copia automática diaria ya lo cubre, y ese botón
 * sobrescribía el estado ENTERO de golpe. */

async function abrirAjustes(page) {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".set-card").first()).toBeVisible({ timeout: 10_000 });
}

test("Ajustes tiene una sección «Importaciones» con la hoja de Excel y el histórico del banco", async ({ page }) => {
  await abrirAjustes(page);
  const importaciones = page.getByRole("button", { name: /Importaciones/i });
  await expect(importaciones).toBeVisible();
  await importaciones.click();
  await expect(page.getByRole("button", { name: /Importar una hoja|hoja de gastos/i }).first()).toBeVisible();
  await expect(page.locator("button.set-row").filter({ hasText: /Importar histórico/i })).toBeVisible();
});

test("el importar/exportar copia a mano ya no existe (lo cubre la copia automática)", async ({ page }) => {
  await abrirAjustes(page);
  // Ni los botones ni el <input type=file> oculto que disparaba el importar.
  await expect(page.locator('input[type="file"][accept*="json"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Exportar/i })).toHaveCount(0);
});

test("desde Importaciones se abre de verdad el panel del histórico del banco", async ({ page }) => {
  await abrirAjustes(page);
  await page.getByRole("button", { name: /Importaciones/i }).click();
  await page.locator("button.set-row").filter({ hasText: /Importar histórico/i }).click();
  await expect(page.locator(".hist-import")).toBeVisible({ timeout: 10_000 });
});
