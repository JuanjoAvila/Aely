/* TR aviso al conectar (rechazo 4.19.0/tr-reactivo, 2026-09-08).
 *
 * El estado YA pasaba a conectado; faltaba el acuse visible UNA vez al completar la acción
 * manual (2FA o Sync). Las consultas de status no deben tostar.
 */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function abrirBancosConTR(page, bridgeInit) {
  await page.addInitScript(bridgeInit);
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
}

const toastOk = /Conectado a Trade Republic|Connected to Trade Republic|Connectat a Trade Republic/i;

test("al verificar el 2FA sale el toast de conectado (una vez)", async ({ page }) => {
  await abrirBancosConTR(page, () => {
    localStorage.setItem("mc_tr_phone", "+34600000000");
    let connected = false;
    window.MiCarteraTR = {
      status: async () => ({ connected }),
      login: async () => ({ ok: true, processId: "e2e-tr" }),
      verify: async () => { connected = true; return { ok: true }; },
      sync: async () => ({
        ok: true, cash: 10,
        positions: [{ isin: "IE00E2E", name: "Fondo e2e", shares: 1, value: 100, cost: 90 }],
      }),
      logout: async () => { connected = false; return { ok: true }; },
    };
  });

  const tr = page.locator(".bk-card.bk-tr");
  await tr.locator(".bk-brand").click();
  await tr.locator('input[type="password"]').fill("1234");
  await tr.getByRole("button", { name: "Conectar", exact: true }).click();
  await tr.locator('input[maxlength="6"]').fill("123456");
  await tr.getByRole("button", { name: "Verificar", exact: true }).click();

  await expect(page.locator(".toast").filter({ hasText: toastOk })).toBeVisible({ timeout: 10_000 });
  // Una sola vez: no se apila otro toast por el sync que sigue al verify.
  await page.waitForTimeout(800);
  expect(await page.locator(".toast").filter({ hasText: toastOk }).count()).toBeLessThanOrEqual(1);
});

test("un status sin ack no pinta toast", async ({ page }) => {
  await abrirBancosConTR(page, () => {
    localStorage.setItem("mc_tr_phone", "+34600000000");
    window.MiCarteraTR = {
      status: async () => ({ connected: true }),
      sync: async () => ({ ok: true, positions: [] }),
    };
  });

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mc-tr-status", { detail: { connected: true } }));
  });
  await page.waitForTimeout(400);
  await expect(page.locator(".toast").filter({ hasText: toastOk })).toHaveCount(0);
});

test("si el verify falla no hay toast de conectado", async ({ page }) => {
  await abrirBancosConTR(page, () => {
    localStorage.setItem("mc_tr_phone", "+34600000000");
    window.MiCarteraTR = {
      status: async () => ({ connected: false }),
      login: async () => ({ ok: true, processId: "e2e-tr" }),
      verify: async () => ({ ok: false, error: "bad code" }),
      sync: async () => ({ ok: true, positions: [] }),
    };
  });

  const tr = page.locator(".bk-card.bk-tr");
  await tr.locator(".bk-brand").click();
  await tr.locator('input[type="password"]').fill("1234");
  await tr.getByRole("button", { name: "Conectar", exact: true }).click();
  await tr.locator('input[maxlength="6"]').fill("0000");
  await tr.getByRole("button", { name: "Verificar", exact: true }).click();
  await page.waitForTimeout(600);
  await expect(page.locator(".toast").filter({ hasText: toastOk })).toHaveCount(0);
});

test("Sync manual con sesión ya viva también avisa una vez", async ({ page }) => {
  await abrirBancosConTR(page, () => {
    localStorage.setItem("mc_tr_phone", "+34600000000");
    window.MiCarteraTR = {
      status: async () => ({ connected: true }),
      sync: async () => ({
        ok: true, cash: 10,
        positions: [{ isin: "IE00E2E", name: "Fondo e2e", shares: 1, value: 100, cost: 90 }],
      }),
      logout: async () => ({ ok: true }),
    };
  });

  const tr = page.locator(".bk-card.bk-tr");
  await tr.locator(".bk-brand").click();
  await tr.getByRole("button", { name: "Sincronizar ahora", exact: true }).click();
  await expect(page.locator(".toast").filter({ hasText: toastOk })).toBeVisible({ timeout: 10_000 });
});
