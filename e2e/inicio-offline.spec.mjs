/* 4.24.0: sin red, Inicio no se queda en 3 esqueletos eternos.
 * El skel espera `mc-boot-ready`; si el pull de la nube cuelga, hay tope ~2 s tras el splash
 * y se pinta el estado local. También con red lenta (no solo offline). */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/** Impide que `mc-boot-ready` llegue a React → obliga al tope de 2 s del skel. */
async function blockBootReadyEvent(page) {
  await page.addInitScript(() => {
    const _add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (type === "mc-boot-ready") return;
      return _add.call(this, type, fn, opts);
    };
    try {
      Object.defineProperty(window, "__mcBootReady", {
        configurable: true,
        get() { return false; },
        set() { /* el tope del Dashboard debe bastar */ },
      });
    } catch (e) {}
  });
}

test("★ boot-ready no llega: tras splash, skel cae y se ve el hero (tope 2 s)", async ({ page }) => {
  await blockBootReadyEvent(page);
  await seedLoggedInDashboard(page, {
    expenses: [{ id: "e1", date: "2026-09-14", amount: 12.5, merchant: "Cafe", category: "bares", source: "manual" }],
  });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await expect(page.locator("[data-tour=boot-skel]")).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator("[data-tour=hero]")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator("[data-tour=hero-amt]")).toBeVisible();
});

test("★ offline: pastilla de sin conexión y Inicio usable (no skel eterno)", async ({ page, context }) => {
  await seedLoggedInDashboard(page, {
    expenses: [{ id: "e1", date: "2026-09-14", amount: 12.5, merchant: "Cafe", category: "bares", source: "manual" }],
  });
  // Cargar online (si setOffline antes del goto, Chromium ni abre el localhost).
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await expect(page.locator("[data-tour=hero]")).toBeVisible({ timeout: 5_000 });
  await context.setOffline(true);
  await page.evaluate(() => { try { window.dispatchEvent(new Event("offline")); } catch (e) {} });
  await expect(page.locator(".offline-pill")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator("[data-tour=boot-skel]")).toHaveCount(0);
  await expect(page.locator("[data-tour=hero]")).toBeVisible();
});

test("★ red lenta: skel no se queda; hero aparece aunque supabase aborte tarde", async ({ page }) => {
  await blockBootReadyEvent(page);
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (/supabase\.co|auth\/v1|rest\/v1/i.test(url)) {
      await new Promise((r) => setTimeout(r, 6_000));
      return route.abort();
    }
    return route.continue();
  });
  await seedLoggedInDashboard(page, {
    expenses: [{ id: "e1", date: "2026-09-14", amount: 12.5, merchant: "Cafe", category: "bares", source: "manual" }],
  });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await expect(page.locator("[data-tour=boot-skel]")).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator("[data-tour=hero]")).toBeVisible({ timeout: 5_000 });
});
