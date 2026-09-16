/* BANCOS CAÍDOS Y TR: la noti deja el banner a la vista, no abre sola la autorización.
 *
 * Decisiones 2026-07-26 (tras CaixaBank invalid_request y el rechazo .18):
 *  · la noti / handleGoto("banks|…") aterriza SOLO en Cartera con el banner visible;
 *  · Mis bancos pinta rojo con state.bankIssues aunque bank_links diga «active»;
 *  · TR desconectado tiene banner propio, sin mezclarse con Open Banking.
 */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function appLista(page, overrides = {}) {
  await seedLoggedInDashboard(page, overrides);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

test("con banco caído, Cartera muestra el banner y Mis bancos NO se abre solo", async ({ page }) => {
  await appLista(page, {
    hasBankLink: true,
    bankIssues: [{ aspsp: "CaixaBank", ent: "caixabank", kind: "expired" }],
    accounts: [{ id: "e2e", ent: "caixabank", name: "Caixa", value: 100 }],
  });

  await page.evaluate(() => {
    window.__openedBanks = 0;
    window.addEventListener("mc-open-banks", () => { window.__openedBanks++; });
  });

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator(".v4-bank-issue")).toBeVisible();
  await expect(page.locator(".v4-banks")).toHaveCount(0);
  // Solo estar en Cartera con issues NO debe disparar mc-open-banks (eso era el bug).
  expect(await page.evaluate(() => window.__openedBanks)).toBe(0);
});

test("la noti de banco caído aterriza en Cartera: ni Mis bancos ni OAuth", async ({ page }) => {
  // Simula el toque de la notificación nativa: consumeGoto → handleGoto("banks|…").
  await page.addInitScript(() => {
    let once = true;
    window.Capacitor = {
      Plugins: {
        MiCartera: {
          consumeGoto: async function() {
            if (!once) return {};
            once = false;
            return { goto: "banks|CaixaBank" };
          },
        },
      },
    };
  });
  await appLista(page, {
    hasBankLink: true,
    bankIssues: [{ aspsp: "CaixaBank", ent: "caixabank", kind: "expired" }],
    accounts: [{ id: "e2e", ent: "caixabank", name: "Caixa", value: 100 }],
  });
  await page.evaluate(() => {
    window.__openedBanks = 0;
    window.__e2eConnects = 0;
    window.addEventListener("mc-open-banks", () => { window.__openedBanks++; });
    cloud.bankConnect = async function() { window.__e2eConnects++; return { ok: true, url: "#x" }; };
  });

  await expect.poll(() => page.evaluate(() => {
    const b = document.querySelector(".botnav-tab.active");
    return b && b.getAttribute("data-tour");
  })).toBe("cartera");
  await expect(page.locator(".v4-bank-issue")).toBeVisible();
  await expect(page.locator(".v4-banks")).toHaveCount(0);
  expect(await page.evaluate(() => window.__openedBanks)).toBe(0);
  expect(await page.evaluate(() => window.__e2eConnects)).toBe(0);
});

test("el banner de Cartera lanza UNA autorización al tocarlo", async ({ page }) => {
  await appLista(page, {
    hasBankLink: true,
    bankIssues: [{ aspsp: "CaixaBank", ent: "caixabank", kind: "expired" }],
  });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator(".v4-bank-issue")).toBeVisible();

  await page.evaluate(() => {
    window.__e2eConnects = 0;
    // Stub a bajo nivel: bankConnectOnce llama a cloud.bankConnect.
    // URL en hash del mismo origen: si no, location.href=url recarga y pierde el contador
    // (definir el setter de location.href en Chromium no cuela).
    cloud.bankConnect = async function() {
      window.__e2eConnects++;
      return { ok: true, url: location.pathname + location.search + "#e2e-bank-auth" };
    };
  });

  await page.locator(".v4-bank-issue .v4-cta").click();
  await expect.poll(() => page.evaluate(() => window.__e2eConnects)).toBe(1);

  // Segundo toque mientras el primero «sigue» (candado busy): no suma otra llamada.
  await page.evaluate(() => {
    let liberar;
    const lenta = new Promise((r) => { liberar = r; });
    window.__e2eLiberar = liberar;
    window.__e2eConnects = 0;
    cloud.bankConnect = function() {
      window.__e2eConnects++;
      return lenta.then(() => ({ ok: true, url: location.pathname + location.search + "#e2e-bank-auth" }));
    };
  });
  await page.locator(".v4-bank-issue .v4-cta").click();
  await page.locator(".v4-bank-issue .v4-cta").click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__e2eConnects)).toBe(1);
  await page.evaluate(() => window.__e2eLiberar());
});

test("Mis bancos pinta caducado aunque bank_links diga active, si bankIssues lo marca", async ({ page }) => {
  await appLista(page, {
    hasBankLink: true,
    bankIssues: [{ aspsp: "Banco de Sabadell", ent: "sabadell", kind: "expired" }],
    __cloudRows: {
      bank_links: [{
        aspsp_name: "Banco de Sabadell",
        aspsp_country: "ES",
        status: "active",
        last_sync: new Date().toISOString(),
        valid_until: new Date(Date.now() + 60 * 86400000).toISOString(),
        accounts: [{ iban: "ES00" }],
      }],
    },
  });

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: "Banco de Sabadell" } }));
  });
  const panel = page.locator(".v4-banks");
  await expect(panel).toBeVisible({ timeout: 10_000 });
  const fila = panel.locator('[data-aspsp="Banco de Sabadell"]');
  await expect(fila).toBeVisible();
  await expect(fila).toContainText(/caducado|expired|caducat/i);
});

test("TR desconectado: banner en Cartera; el CTA abre Mis bancos con TR, no OAuth", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mc_tr_phone", "600000000");
    localStorage.setItem("_trAuthExpired", "1");
    window.MiCarteraTR = {
      status: async () => ({ connected: false }),
      sync: async () => ({ ok: false, authExpired: true }),
    };
  });
  await appLista(page, {
    settings: { brokersOn: ["trade_republic"] },
    investments: [{ id: "i1", ent: "trade_republic", name: "VWCE", shares: 1, price: 100, cost: 90 }],
  });

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const banner = page.locator(".v4-tr-issue");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await expect(banner).toContainText(/Trade Republic/i);

  await page.evaluate(() => { window.__e2eConnects = 0; cloud.bankConnect = async () => { window.__e2eConnects++; return { ok:true, url:"x" }; }; });
  await banner.locator(".v4-cta").click();
  await expect(page.locator(".v4-banks")).toBeVisible({ timeout: 10_000 });
  // TR no es Open Banking: el CTA NO debe llamar a bankConnect.
  expect(await page.evaluate(() => window.__e2eConnects)).toBe(0);
});

test("TR en frío: un status desconectado sin authExpired NO inventa otra reconexión", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mc_tr_phone", "600000000");
    localStorage.removeItem("_trAuthExpired");
    window.MiCarteraTR = {
      status: async () => ({ connected: false }),
      sync: async () => ({ ok: true, positions: [], cash: 0 }),
    };
  });
  await appLista(page, {
    settings: { brokersOn: ["trade_republic"] },
    investments: [{ id: "i1", ent: "trade_republic", name: "VWCE", shares: 1, price: 100, cost: 90 }],
  });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.waitForTimeout(500);
  await expect(page.locator(".v4-tr-issue")).toHaveCount(0);
});
