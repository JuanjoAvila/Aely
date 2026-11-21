/* navigator.onLine miente con VPN (Tailscale) en la WebView: con red buena y el flag a false NO debe
 * salir «sin conexión». Con la red cortada de verdad, sí. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function abre(page) {
  await seedLoggedInDashboard(page, {
    expenses: [{ id: "e1", date: "2026-09-14", amount: 12.5, merchant: "Cafe", category: "bares", source: "manual" }],
  });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await expect(page.locator("[data-tour=hero]")).toBeVisible({ timeout: 5_000 });
}

test("★ onLine=false con red buena: no sale el aviso de sin conexión", async ({ page }) => {
  await abre(page);
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get() { return false; } });
    window.dispatchEvent(new Event("offline"));
  });
  await page.waitForTimeout(6_000); // más que el timeout de la prueba (4 s)
  await expect(page.locator(".offline-pill")).toHaveCount(0);
});

test("★ red cortada de verdad: sale el aviso y se quita al volver", async ({ page, context }) => {
  await abre(page);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.locator(".offline-pill")).toBeVisible({ timeout: 10_000 });
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".offline-pill")).toHaveCount(0, { timeout: 5_000 });
});
