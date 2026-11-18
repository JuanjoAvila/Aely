/* Aprobar el login de Trade Republic y que Aely termine sola (ronda R1 de bancos, 18/11/2026).
 *
 * Antes: el sondeo nativo cortaba a los 75 s, la tarjeta se quedaba en «Aún no llega» y había que
 * volver y pulsar «Ya lo he aprobado». Ahora la espera llega a la cuenta atrás de TR, se comprueba
 * en cuanto Aely vuelve a primer plano y, si se aprobó con Aely detrás, sale un aviso propio.
 * El puente de TR es simulado (Capacitor.Plugins.TradeRepublic, como en la APK).
 */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const toastOk = /Conectado a Trade Republic|Connected to Trade Republic|Connectat a Trade Republic/i;

// Puente de la APK simulado. `verify` espera a `__release` (la aprobación la marca `__approved`)
// y apunta las llamadas; `__skew` adelanta el reloj para pasar la cuenta atrás de TR sin esperarla.
function puente(opts) {
  const nativeNow = Date.now;
  Date.now = () => nativeNow() + (window.__skew || 0);
  window.__vis = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => window.__vis });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => window.__vis === "hidden" });
  localStorage.setItem("mc_tr_phone", "+34600000000");
  window.__trVerify = [];
  window.__notifs = [];
  window.__appState = [];
  window.__release = !opts.hold;
  window.__approved = false;
  let connected = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nat = new Proxy({
    showNotification: async (o) => { window.__notifs.push(o); return {}; },
    addListener: async () => ({ remove() {} }),
  }, { get: (t, k) => t[k] || (() => Promise.resolve({})) });
  window.Capacitor = {
    isNativePlatform: () => false,
    Plugins: {
      MiCartera: nat,
      App: { addListener: async (ev, cb) => { if (ev === "appStateChange") window.__appState.push(cb); return { remove() {} }; } },
      TradeRepublic: {
        status: async () => ({ connected }),
        login: async () => ({ ok: true, api: "v2", flow: "push", processId: "e2e-v2", countdown: 120 }),
        verify: async (o) => {
          window.__trVerify.push(o);
          while (!window.__release) await sleep(40);
          await sleep(120);
          const n = window.__trVerify.length;
          if (window.__approved || (opts.okAt && n >= opts.okAt)) { connected = true; return { ok: true }; }
          return { ok: false, pending: true, error: "sin aprobación todavía", diag: { api: "v2", trCode: "PENDING" } };
        },
        sync: async () => ({ ok: true, cash: 10, positions: [{ isin: "IE00E2E", name: "Fondo e2e", shares: 1, value: 100, cost: 90 }] }),
        logout: async () => ({ ok: true }),
      },
    },
  };
}

async function conectarTR(page, opts) {
  await page.addInitScript(puente, opts);
  await seedLoggedInDashboard(page, {
    settings: { brokersOn: ["trade_republic"] },
    investments: [{ id: "i1", ent: "trade_republic", name: "Fondo e2e", isin: "IE00E2E", shares: 1, value: 90, cost: 90, cur: "EUR" }],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(page.locator(".bk-sec")).toBeVisible({ timeout: 10_000 });
  const tr = page.locator(".bk-card.bk-tr");
  await tr.locator(".bk-brand").click();
  await tr.locator('input[type="password"]').fill("1234");
  await tr.getByRole("button", { name: "Conectar", exact: true }).click();
  await expect(tr).toContainText("Abre la app de Trade Republic y aprueba el inicio de sesión.");
  return tr;
}

const setVis = (page, v) => page.evaluate((v) => {
  window.__vis = v;
  document.dispatchEvent(new Event("visibilitychange"));
}, v);

test("aprobación tardía: la espera se encadena sola y conecta sin tocar nada", async ({ page }) => {
  const tr = await conectarTR(page, { okAt: 3 });
  // El atajo a la app de TR va por Play Store (`market://launch`), que abre la app instalada.
  await expect(tr.locator("a.tr-open-app")).toHaveAttribute("href", "market://launch?id=de.traderepublic.app");
  await expect(tr.locator("a.tr-open-app")).toHaveText("Abrir Trade Republic");
  await expect(page.locator(".toast").filter({ hasText: toastOk })).toBeVisible({ timeout: 10_000 });
  expect(await page.evaluate(() => window.__trVerify.length)).toBe(3);
  await expect(tr.locator(".alarmbox")).toHaveCount(0);
  // Con Aely delante no hace falta aviso: ya se ve el acuse.
  expect(await page.evaluate(() => window.__notifs.length)).toBe(0);
});

test("volver a primer plano termina sin pulsar «Ya lo he aprobado»", async ({ page }) => {
  const tr = await conectarTR(page, { hold: true });
  // Se va a TR, la cuenta atrás se agota con la primera espera en vuelo y la tarjeta se para.
  await setVis(page, "hidden");
  await page.evaluate(() => { window.__skew = 200_000; window.__release = true; });
  await expect(tr.locator(".alarmbox")).toContainText("Aún no llega la aprobación");
  expect(await page.evaluate(() => window.__trVerify.length)).toBe(1);
  // Aprueba en TR y vuelve con el gesto atrás: basta con recuperar el primer plano.
  await page.evaluate(() => { window.__approved = true; });
  await setVis(page, "visible");
  await expect(page.locator(".toast").filter({ hasText: toastOk })).toBeVisible({ timeout: 10_000 });
  expect(await page.evaluate(() => window.__trVerify.length)).toBe(2);
  expect(await page.evaluate(() => window.__notifs.length)).toBe(0);
});

test("aprobada con Aely detrás: aviso propio que abre Aely", async ({ page }) => {
  await conectarTR(page, { hold: true });
  await expect.poll(() => page.evaluate(() => window.__appState.length)).toBeGreaterThan(0);
  // La APK avisa de que Aely pasa a segundo plano por Capacitor (appStateChange).
  await page.evaluate(() => { window.__appState.forEach((cb) => cb({ isActive: false })); });
  await page.evaluate(() => { window.__approved = true; window.__release = true; });
  await expect.poll(() => page.evaluate(() => window.__notifs.length)).toBe(1);
  const n = await page.evaluate(() => window.__notifs[0]);
  expect(n.body).toBe("Trade Republic conectado. Toca para volver.");
  expect(n.tag).toBe("tr-approved");
  // Sin destino: el toque abre Aely tal cual, donde se quedó la tarjeta.
  expect(n.gotoTarget).toBeUndefined();
  expect(await page.evaluate(() => window.__trVerify.length)).toBe(1);
});
