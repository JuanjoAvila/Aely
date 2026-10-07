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
  expect(base.a).toBeGreaterThan(0);
  for (let i = 0; i < 6; i++) {
    await page.evaluate((i) => window.__authCb("SIGNED_IN", { user: { id: "user-" + i, email: "u" + i + "@test.local" } }), i);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(500);
  expect(await count()).toEqual(base);
});

// El alta de bankNotif puede quedar pendiente mientras cambia uid. No resolverla al registrar
// evita que el guardián confunda un cleanup inmediato correcto con la carrera del puente.
test("el aviso nativo recoge handles tardíos y deja inertes las sesiones retiradas", async ({ page }) => {
  await page.addInitScript(() => {
    const records = [], live = new Set();
    window.__bankNative = { records, live };
    const reg = (ev, fn) => {
      if (ev !== "bankNotif") return Promise.resolve({ remove() {} });
      const r = { fn, removed: 0, resolve: null };
      records.push(r); live.add(r);
      return new Promise(resolve => { r.resolve = () => resolve({ remove() { r.removed++; live.delete(r); } }); });
    };
    window.Capacitor = { Plugins: { App: { addListener: reg, exitApp() {} }, MiCartera: { addListener: reg } } };
  });
  await seedLoggedInDashboard(page, { hasBankLink: true, settings: { bankSyncOnNotif: true } });
  await page.addInitScript(() => {
    const d = Object.getOwnPropertyDescriptor(window, "supabase");
    Object.defineProperty(window, "supabase", { configurable: true, enumerable: true, set: d.set,
      get() { const lib = d.get(); if (!lib) return lib;
        return { createClient: () => { const c = lib.createClient(), o = c.auth.onAuthStateChange;
          c.auth.onAuthStateChange = cb => { window.__authCb = cb; return o(cb); }; return c; } }; } });
    // Contar la decisión de programar sin ejecutar ni simular operaciones bancarias.
    const writes = [], original = Storage.prototype.setItem;
    window.__bankQuotaWrites = writes;
    Storage.prototype.setItem = function(k, v) { if (k === "_bankNotifSyncAt") writes.push(v); return original.call(this, k, v); };
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load") && window.__authCb && window.__bankNative.records.length > 0);
  const initial = await page.evaluate(() => window.__bankNative.records.length);
  expect(initial).toBeGreaterThan(0);
  for (let i = 0; i < 6; i++) {
    await page.evaluate(i => window.__authCb("SIGNED_IN", { user: { id: "late-" + i, email: "late-" + i + "@test.local" } }), i);
    await page.waitForFunction(n => window.__bankNative.records.length === n, initial + i + 1);
  }
  await page.evaluate(() => window.__bankNative.records.forEach(r => r.resolve()));
  await page.waitForFunction(() => window.__bankNative.live.size === 1);
  expect(await page.evaluate(() => window.__bankNative.records.slice(0, -1).every(r => r.removed === 1))).toBe(true);
  // Poner gates positivos distingue callback inerte de uno activo que se oculta tras opt-in OFF.
  await page.evaluate(() => {
    const state = window.__bankNative;
    window.__bankScheduled = 0;
    window.mcScheduleIdle = function() { window.__bankScheduled++; };
    localStorage.removeItem("_bankNotifSyncAt"); localStorage.removeItem("_bankNotifSyncDay"); localStorage.removeItem("_bankNotifSyncUsed");
    state.records.slice(0, -1).forEach(r => r.fn());
  });
  expect(await page.evaluate(() => ({ writes: window.__bankQuotaWrites.length, scheduled: window.__bankScheduled }))).toEqual({ writes: 0, scheduled: 0 });
  await page.evaluate(() => window.__bankNative.records.at(-1).fn());
  expect(await page.evaluate(() => ({ writes: window.__bankQuotaWrites.length, scheduled: window.__bankScheduled }))).toEqual({ writes: 1, scheduled: 1 });
});
