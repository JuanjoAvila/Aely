import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* LA LISTA DE GASTOS SE SUELTA AL VOLVER ARRIBA (13/9).
 * Medido en su OnePlus 13: la paginación solo crecía (374 → 794 filas ciclando arriba/abajo) y
 * cada tanda nueva costaba más frames perdidos cuanto más había pintado. Al volver arriba del
 * todo la lista vuelve a la primera tanda. Se usa rueda del ratón: aquí basta con mover el
 * `scrollTop` de verdad del host (el gesto táctil real se midió en el móvil). */

function historico(n) {
  const out = [];
  const ahora = Date.now();
  for (let i = 0; i < n; i++) {
    out.push({ id: "s" + i, date: new Date(ahora - i * 3600_000 * 3).toISOString(), amount: 4 + (i % 9),
      merchant: "Comercio " + (i % 40), category: "super", source: "manual" });
  }
  return out;
}

test("bajar pagina, y al volver arriba la lista vuelve a la primera tanda", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(900) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 20_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator("button.v4-mov").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Más…" }).click();
  await page.getByRole("button", { name: "Todo", exact: true }).click();

  const filas = () => page.locator(".page-scroll-host button.v4-mov").count();
  const inicial = await filas();
  expect(inicial, "arranca en la primera tanda").toBeLessThanOrEqual(12);

  await page.mouse.move(195, 450);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(120); }
  await expect.poll(filas, { timeout: 5_000 }).toBeGreaterThan(100);

  // Arriba del todo y quieto: suelta.
  for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, -4000); await page.waitForTimeout(60); }
  await expect.poll(() => page.evaluate(() => document.querySelector(".page-scroll-host").scrollTop), { timeout: 3_000 }).toBeLessThan(10);
  await expect.poll(filas, { timeout: 3_000, message: "al volver arriba la lista no se ha soltado" }).toBeLessThanOrEqual(12);

  // Y bajar otra vez vuelve a paginar con normalidad.
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(120); }
  await expect.poll(filas, { timeout: 5_000 }).toBeGreaterThan(12);
});

test("a media lista NO se suelta nada (solo arriba del todo)", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(900) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 20_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator("button.v4-mov").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Más…" }).click();
  await page.getByRole("button", { name: "Todo", exact: true }).click();
  const filas = () => page.locator(".page-scroll-host button.v4-mov").count();
  await page.mouse.move(195, 450);
  for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(120); }
  await expect.poll(filas, { timeout: 5_000 }).toBeGreaterThan(100);
  const antes = await filas();
  await page.mouse.wheel(0, -3000);
  await page.waitForTimeout(800);
  expect(await filas(), "subir un poco no puede quitar filas").toBeGreaterThanOrEqual(antes);
});
