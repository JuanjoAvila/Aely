import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard } from "./fixtures.mjs";

// INC-2709-09: Capacitor.addListener devuelve una PROMESA con el handle; si el cleanup de un
// efecto lee `.remove` de la promesa, el listener nunca se libera y cada cambio de sesión
// (login/logout/cambio de usuario) deja otro vivo. Doble sintético de transporte: cuenta los
// listeners activos por evento y no toca red ni dinero reales.
test("cambiar de sesión no acumula listeners nativos de primer plano", async ({ page }) => {
  await page.addInitScript(() => {
    const live = { appStateChange: new Set(), backButton: new Set(), bankNotif: new Set() };
    window.__live = live;
    const reg = (ev, fn) => { live[ev] && live[ev].add(fn);
      return Promise.resolve({ remove: () => { live[ev] && live[ev].delete(fn); } }); };
    window.Capacitor = { Plugins: { App: { addListener: reg, exitApp() {} }, MiCartera: { addListener: reg } } };
  });
  await seedLoggedInDashboard(page);
  // Captura el callback de onAuthStateChange del cliente doble para cambiar de usuario varias veces.
  await page.addInitScript(() => {
    const d = Object.getOwnPropertyDescriptor(window, "supabase");
    Object.defineProperty(window, "supabase", { configurable: true, enumerable: true, set: d.set,
      get() { const lib = d.get(); if (!lib) return lib;
        return { createClient: () => { const c = lib.createClient(); const o = c.auth.onAuthStateChange;
          c.auth.onAuthStateChange = (cb) => { window.__authCb = cb; return o(cb); }; return c; } }; } });
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load") && window.__authCb);
  const count = () => page.evaluate(() => ({ a: window.__live.appStateChange.size, n: window.__live.bankNotif.size, b: window.__live.backButton.size }));
  await page.waitForTimeout(500);
  const base = await count();
  for (let i = 0; i < 6; i++) {
    await page.evaluate((i) => window.__authCb("SIGNED_IN", { user: { id: "user-" + i, email: "u" + i + "@test.local" } }), i);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(500);
  expect(await count()).toEqual(base);
});
