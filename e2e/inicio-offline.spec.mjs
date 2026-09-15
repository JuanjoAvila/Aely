/* 4.24.2: skel corto (~0,5–0,6 s) y panel beta usable sin red.
 * 4.24.0: sin red, Inicio no se queda en 3 esqueletos eternos.
 * El skel espera `mc-boot-ready`; si el pull cuelga hay tope corto tras el splash
 * y se pinta el estado local. También con red lenta (no solo offline). */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/** Impide que `mc-boot-ready` llegue a React → obliga al tope del skel. */
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

test("★ boot-ready no llega: tras splash, skel cae y se ve el hero (tope ~0,6 s)", async ({ page }) => {
  await blockBootReadyEvent(page);
  await seedLoggedInDashboard(page, {
    expenses: [{ id: "e1", date: "2026-09-14", amount: 12.5, merchant: "Cafe", category: "bares", source: "manual" }],
  });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await expect(page.locator("[data-tour=boot-skel]")).toHaveCount(0, { timeout: 2_000 });
  await expect(page.locator("[data-tour=hero]")).toBeVisible({ timeout: 2_000 });
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
  await expect(page.locator("[data-tour=boot-skel]")).toHaveCount(0, { timeout: 2_000 });
  await expect(page.locator("[data-tour=hero]")).toBeVisible({ timeout: 2_000 });
});

test("★ onLine false al montar: skel cae en <1 s (no espera 2 s)", async ({ page }) => {
  await blockBootReadyEvent(page);
  await page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "onLine", { configurable: true, get() { return false; } });
    } catch (e) {}
  });
  await seedLoggedInDashboard(page, {
    expenses: [{ id: "e1", date: "2026-09-14", amount: 12.5, merchant: "Cafe", category: "bares", source: "manual" }],
  });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await expect(page.locator("[data-tour=boot-skel]")).toHaveCount(0, { timeout: 1_500 });
  await expect(page.locator("[data-tour=hero]")).toBeVisible({ timeout: 1_500 });
});

test("★ release-notes falla: panel beta usa la cabeza cacheada (no checklist vacía)", async ({ page }) => {
  await page.route("**/release-notes.json*", (route) => route.abort());
  await page.addInitScript(() => {
    try {
      const head = {
        v: "4.24.2",
        d: "15 sep 2026",
        t: { es: "test", en: "test", ca: "test" },
        items: { es: ["1. punto"], en: ["1. point"], ca: ["1. punt"] },
        tandas: [{
          id: "inicio-offline-2",
          t: { es: "📴 Offline", en: "📴 Offline", ca: "📴 Offline" },
          items: { es: ["1. Activa el modo avión"], en: ["1. Airplane mode"], ca: ["1. Mode avió"] },
        }],
      };
      localStorage.setItem("_rnHead_4.24.2", JSON.stringify(head));
      localStorage.setItem("_canal", "beta");
    } catch (e) {}
  });
  await seedLoggedInDashboard(page, {
    expenses: [{ id: "e1", date: "2026-09-14", amount: 12.5, merchant: "Cafe", category: "bares", source: "manual" }],
  });
  await page.goto("/?canal=beta");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  // Camino estable: evento que usa la app al reabrir el panel
  await page.evaluate(() => { window.dispatchEvent(new Event("mc-open-beta-review")); });
  await expect(page.getByText(/Revisar la beta/i)).toBeVisible({ timeout: 5_000 });
  // Texto propio de la cabeza cacheada (no el de 4.24.0, que puede seguir en memoria).
  await expect(page.getByText(/en menos de un segundo/i).first()).toBeVisible({ timeout: 5_000 });
});
