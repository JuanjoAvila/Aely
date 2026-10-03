/* 4.24.2: skel corto SOLO offline; panel beta usable sin red con catálogo verificado.
 * Con red el tope sigue ~2 s (review Claude: no pintar local y saltar cifras).
 * 4.24.0: sin red, Inicio no se queda en 3 esqueletos eternos. */
import fs from "node:fs";
import crypto from "node:crypto";
import { betaRevision } from "../scripts/beta-revisions.mjs";
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

async function watchPostSplashSkeleton(page) {
  await page.addInitScript(() => {
    window.__sawOfflineSkeleton = false;
    addEventListener("DOMContentLoaded", () => {
      const check = () => {
        if (!document.getElementById("mc-load") && document.querySelector("[data-tour=boot-skel]")) {
          window.__sawOfflineSkeleton = true;
        }
      };
      new MutationObserver(check).observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      check();
    });
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

test("★ red débil: tras el splash no reaparecen barras grises mientras la sesión tarda", async ({ page }) => {
  await watchPostSplashSkeleton(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await seedLoggedInDashboard(page, {
    __sessionDelayMs: 6_000,
    __authEventDelayMs: 6_000,
    __cloudRows: { app_state: [{
      data: {
        _dataVer: 6, onboarded: true, tourSeen: true, budget: 500, monthStartNet: 1200,
        accounts: [{ id: "e2e", ent: "sabadell", name: "Cuenta", value: 1200 }],
        investments: [], assets: [], debts: [], fixed: [], flows: [], oneoffs: [], goals: [],
        history: [], settings: { autoPrices: false, theme: "green" }, expenses: [],
        _savedAt: Date.now() + 600_000,
      },
      updated_at: new Date().toISOString(),
    }] },
    expenses: [{ id: "e1", date: "2026-09-14", amount: 12.5, merchant: "Cafe", category: "bares", source: "manual" }],
  });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await expect(page.locator("[data-tour=hero]")).toBeVisible({ timeout: 5_000 });
  expect(await page.evaluate(() => window.__sawOfflineSkeleton),
    "el estado local ya existe; no debe esperar otra vez tras el splash").toBe(false);
  await expect(page.locator("[data-tour=hero-amt]")).toContainText("1000,00", { timeout: 4_000 });
  await expect(page.locator("[data-tour=hero-amt]")).toContainText("1200,00", { timeout: 10_000 });
});

test("★ onLine false al montar: tras el splash Inicio ya nace relleno", async ({ page }) => {
  await blockBootReadyEvent(page);
  await watchPostSplashSkeleton(page);
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
  await expect(page.locator("[data-tour=boot-skel]")).toHaveCount(0);
  await expect(page.locator("[data-tour=hero]")).toBeVisible();
  expect(await page.evaluate(() => window.__sawOfflineSkeleton), "offline no debe pintar ni un frame vacío tras el splash").toBe(false);
});

test("★ offline: Ajustes conserva la zona Dev del admin conocido", async ({ page }) => {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "onLine", { configurable: true, get() { return false; } });
      localStorage.setItem("_mcAdminProfile", JSON.stringify({ uid: "e2e-user", isAdmin: true }));
    } catch (e) {}
  });
  await seedLoggedInDashboard(page, { __cloudErrors: { profiles: "offline" } });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mc-open-settings"));
  });
  await expect(page.getByText("Dev", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("🧪 Pruebas", { exact: true })).toBeVisible();
});

// Una petición abortada solo puede rescatar notas verificadas de la compilación exacta.
// La cabeza antigua inventada y otra compilación de la misma base deben seguir sin confirmar.
test.describe("ronda cacheada del panel de beta",()=>{
  test.use({serviceWorkers:"block"});
  test("★ release-notes falla: usa ronda verificada y descarta cabeza antigua",async({page})=>{
    const version="9.9.1.1",base="9.9.1",title="Solo viene de la ronda verificada";
    const revision=betaRevision("inc-2709-01-arranque-red");
    const notes=[{v:base,d:"e2e",t:{es:"Offline",en:"Offline",ca:"Offline"},items:{es:[],en:[],ca:[]},tandas:[{id:"inc-2709-01-arranque-red",t:title,items:{es:[title],en:[title],ca:[title]},...revision}]}];
    const json=JSON.stringify(notes),sha=crypto.createHash("sha256").update(json).digest("hex"),html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
    let offline=false,compilation=version,aborts=0;
    // El escenario offline conserva su ronda; una entrega real ajena no puede retirarla.
    await page.route("https://juanjoavila.github.io/Aely/**",route=>route.abort());
    await seedLoggedInDashboard(page,{__seedOnce:true,__seenVersion:base,expenses:[{id:"e1",date:"2026-09-14",amount:12.5,merchant:"Cafe",category:"bares",source:"manual"}]});
    await page.addInitScript(()=>{localStorage.setItem("_mcChannel","beta");localStorage.setItem("_seenVersion","9.9.1");});
    await page.route("**/",route=>route.fulfill({contentType:"text/html",body:html.replace('APP_VERSION: "dev"','APP_VERSION: "'+compilation+'"').replace(/var _rnSha="[0-9a-f]{64}";/,'var _rnSha="'+sha+'";')}));
    await page.route("**/release-notes.json*",route=>{if(offline){aborts++;return route.abort();}return route.fulfill({contentType:"application/json",body:json});});
    await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await page.waitForFunction(()=>RELEASE_NOTES.length===1);
    expect(await page.evaluate(v=>JSON.parse(localStorage.getItem("_rnBetaRound_"+v)),version)).toEqual({sha:sha,notes:notes});
    await page.evaluate(b=>localStorage.setItem("_rnHead_"+b,JSON.stringify({v:b,t:"Cabeza antigua sin verificar",items:["Cabeza antigua sin verificar"]})),base);
    offline=true;await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
    await page.evaluate(()=>window.dispatchEvent(new Event("mc-open-beta-review")));
    const panel=page.locator(".beta-review");await expect(panel).toBeVisible();
    await expect(panel).toContainText(title);await expect(panel).not.toContainText("Cabeza antigua sin verificar");
    expect(await page.evaluate(()=>RELEASE_NOTES)).toEqual(notes);expect(aborts).toBeGreaterThan(0);
    compilation="9.9.1.2";await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
    await page.evaluate(()=>window.dispatchEvent(new Event("mc-open-beta-review")));
    await expect(panel).toContainText("Comprobaciones sin confirmar");await expect(panel.locator(".beta-tanda")).toHaveCount(0);
    await expect(panel).not.toContainText("Cabeza antigua sin verificar");await expect(panel).not.toContainText("has aprobado todas");
    expect(await page.evaluate(()=>ensureReleaseNotes().then(arr=>arr.length))).toBe(0);
  });
});
