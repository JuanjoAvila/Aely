/* 4.24.2: skel corto SOLO offline; panel beta usable sin red (SW ignoreSearch + _rnHead).
 * Con red el tope sigue ~2 s (review Claude: no pintar local y saltar cifras).
 * 4.24.0: sin red, Inicio no se queda en 3 esqueletos eternos. */
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

test("★ boot-ready no llega: tras splash, skel cae y se ve el hero (tope ~2 s con red)", async ({ page }) => {
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

/* ⚠ ESTE TEST ESTABA VERDE POR LA RAZÓN EQUIVOCADA (16/9, promote de la ronda 4.24).
   Tal como nació: abortaba la ruta de `release-notes.json` y sembraba la cabeza en
   `_rnHead_4.24.2`. Pero (a) el SW la tiene precacheada, así que `page.route` no la corta y las
   notas SÍ cargaban; y (b) en e2e `CONFIG.APP_VERSION` es «dev», así que la clave sembrada no
   casaba con ninguna. Lo que hacía verde al test era el texto de la tanda REAL de 4.24.2 en el
   JSON del repo: nunca se ejecutó la cabeza cacheada. Al colapsar la ronda en una nota única
   para producción, ese texto desapareció y el test se puso rojo — el rojo fue el que destapó
   el falso verde.
   Ahora: SW bloqueado (la ruta sí corta), la clave se deriva EN CALIENTE de la versión que
   reporta la app, y se comprueba además que `RELEASE_NOTES` se quedó en UNA entrada, que es la
   prueba de que se usó la cabeza cacheada y no el JSON. Si algo de eso deja de cumplirse, el
   test se cae; no se puede volver a poner verde de rebote. */
test.describe("cabeza cacheada del panel de beta", () => {
  test.use({ serviceWorkers: "block" });

  test("★ release-notes falla: panel beta usa la cabeza cacheada (no checklist vacía)", async ({ page }) => {
    await seedLoggedInDashboard(page, {
      expenses: [{ id: "e1", date: "2026-09-14", amount: 12.5, merchant: "Cafe", category: "bares", source: "manual" }],
    });
    await page.addInitScript(() => { try { localStorage.setItem("_canal", "beta"); } catch (e) {} });

    // 1ª carga CON notas: que la app escriba ella misma `_rnHead_<base>` y así sepamos la clave.
    await page.goto("/?canal=beta");
    await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
    const base = await page.evaluate(() => mcVerBase(CONFIG.APP_VERSION));
    expect(base, "la app tiene que decir con qué versión guarda la cabeza").toBeTruthy();

    // Se cambia la cabeza guardada por una con un texto que NO existe en el JSON del repo.
    await page.evaluate((b) => {
      const head = {
        v: b,
        d: "15 sep 2026",
        t: { es: "test", en: "test", ca: "test" },
        items: { es: ["1. punto"], en: ["1. point"], ca: ["1. punt"] },
        tandas: [{
          id: "inicio-offline-2",
          t: { es: "📴 Offline", en: "📴 Offline", ca: "📴 Offline" },
          items: {
            es: ["1. Cabeza cacheada: esto solo puede venir de localStorage"],
            en: ["1. Cached head: this can only come from localStorage"],
            ca: ["1. Capçalera desada: això només pot venir de localStorage"],
          },
        }],
      };
      localStorage.setItem("_rnHead_" + b, JSON.stringify(head));
    }, base);

    // 2ª carga SIN notas: sin SW por delante, el abort sí llega.
    await page.route("**/release-notes.json*", (route) => route.abort());
    await page.goto("/?canal=beta");
    await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
    await dismissNews(page);
    await page.evaluate(() => { window.dispatchEvent(new Event("mc-open-beta-review")); });
    await expect(page.getByText(/Revisar la beta/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/solo puede venir de localStorage/i).first()).toBeVisible({ timeout: 5_000 });
    // Y la prueba de que el JSON no cargó: el histórico entero no está, solo la cabeza.
    expect(await page.evaluate(() => (window.RELEASE_NOTES || []).length),
      "si cargó el JSON, esto no prueba nada").toBe(1);
  });
});
