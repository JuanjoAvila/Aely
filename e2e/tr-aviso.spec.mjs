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

// 31/10/2026: el 400 del login viejo de TR pintaba el estado de las cookies en la tarjeta.
test("un login rechazado pinta una sola línea, sin el diagnóstico del puente", async ({ page }) => {
  await abrirBancosConTR(page, () => {
    localStorage.setItem("mc_tr_phone", "+34600000000");
    window.MiCarteraTR = {
      status: async () => ({ connected: false }),
      login: async () => ({ ok: false, status: 400, error: "login HTTP 400 · jar[tr_preferred_color_mode,tr_device] snap[tr_device,tr_refresh] edad=0min restore=sí(7)" }),
    };
  });

  const tr = page.locator(".bk-card.bk-tr");
  await tr.locator(".bk-brand").click();
  await tr.locator('input[type="password"]').fill("1234");
  await tr.getByRole("button", { name: "Conectar", exact: true }).click();
  const box = tr.locator(".alarmbox");
  await expect(box).toHaveText("Trade Republic ha cambiado su inicio de sesión. Actualiza la app para volver a conectar.");
  await expect(tr).not.toContainText(/jar\[|snap\[|edad=|restore=|HTTP/);
});

test("login v2 por aviso: espera la aprobación sin pedir código y conecta", async ({ page }) => {
  await abrirBancosConTR(page, () => {
    localStorage.setItem("mc_tr_phone", "+34600000000");
    let connected = false, polls = 0;
    window.__trVerify = [];
    window.MiCarteraTR = {
      status: async () => ({ connected }),
      login: async () => ({ ok: true, api: "v2", flow: "push", processId: "e2e-v2" }),
      // Primera espera sin aprobar → botón para volver a esperar; la segunda, aprobada.
      verify: async (o) => { window.__trVerify.push(o); polls++; if (polls < 2) return { ok: false, pending: true, diag: { api: "v2", trCode: "PENDING" } }; connected = true; return { ok: true }; },
      sync: async () => ({ ok: true, cash: 10, positions: [{ isin: "IE00E2E", name: "Fondo e2e", shares: 1, value: 100, cost: 90 }] }),
      logout: async () => ({ ok: true }),
    };
  });

  const tr = page.locator(".bk-card.bk-tr");
  await tr.locator(".bk-brand").click();
  await tr.locator('input[type="password"]').fill("1234");
  await tr.getByRole("button", { name: "Conectar", exact: true }).click();
  await expect(tr).toContainText("Abre la app de Trade Republic y aprueba el inicio de sesión.");
  await expect(tr.locator('input[maxlength="6"]')).toHaveCount(0);
  await expect(tr.locator(".alarmbox")).toContainText("Aún no llega la aprobación");
  await tr.getByRole("button", { name: "Ya lo he aprobado", exact: true }).click();
  await expect(page.locator(".toast").filter({ hasText: toastOk })).toBeVisible({ timeout: 10_000 });
  const calls = await page.evaluate(() => window.__trVerify);
  expect(calls.length).toBe(2);
  expect(calls[0]).toMatchObject({ processId: "e2e-v2", code: "", flow: "push", api: "v2" });
});
