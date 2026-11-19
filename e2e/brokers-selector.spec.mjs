import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Brókers: los eliges tú, y su conexión va en su ficha (feedback 2026-07-25; filas desde D1, 19/11).
 *
 * Dos quejas distintas del usuario, las dos aquí:
 *   1. «Que te salgan directamente para loguear sin tenerlo es muy raro — ni mi pareja ni mi
 *      padre tienen MyInvestor y les sale». Las tres tarjetas se pintaban SIEMPRE.
 *   2. «El colapsable de los brókers tampoco está»: los brókers salían con todo desplegado. Desde
 *      D1 son filas como las de los bancos y el formulario vive en su ficha.
 *
 * Va con e2e por la lección de la 4.7.1 (AGENTS §7): esto es render derivado del estado, que es
 * exactamente lo que `npm test` no ve. Y lo crítico que hay que blindar es que el filtrado NO
 * deje a alguien sin poder conectar un bróker que sí usa.
 */

async function abrirBancos(page, overrides) {
  await seedLoggedInDashboard(page, overrides);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(page.locator(".v4-banks-push")).toHaveClass(/open/, { timeout: 10_000 });
}

const fila = (page, k) => page.locator(`.v4-banks-push .bk-row[data-broker="${k}"]`);

test("sin brókers en cartera no sale NINGUNA fila de bróker ni formulario (el caso del padre)", async ({ page }) => {
  await abrirBancos(page, { investments: [] });
  // La puerta para conectar uno sí está: desde D1 (19/11) es «+» → Conectar, no los chips.
  await expect(page.locator('[data-act="bk-conectar"]')).toBeVisible();
  await expect(page.locator(".v4-banks-push [data-broker]")).toHaveCount(0);
  await expect(page.locator(".bk-flow")).toHaveCount(0);
});

test("un bróker que YA usas aparece solo, sin tener que marcarlo", async ({ page }) => {
  // Quien venía usando Trade Republic no puede perderlo de vista por un cambio de UI.
  await abrirBancos(page, {
    investments: [{ id: "i1", ent: "trade_republic", name: "VWCE", ticker: "VWCE", shares: 10, cost: 1000 }],
  });
  await expect(fila(page, "trade_republic")).toHaveCount(1);
  await expect(fila(page, "myinvestor")).toHaveCount(0);   // MyInvestor no, que no lo usa
});

test("elegir un bróker en Conectar trae su fila y abre su ficha; el ✓ solo si está conectado", async ({ page }) => {
  await abrirBancos(page, { investments: [] });
  await page.locator('[data-act="bk-conectar"]').click();
  await page.locator('.bk-pick [data-bk-tile="myinvestor"]').click();
  await expect(page.locator('.bk-ficha[data-bk-ficha="myinvestor"] [data-broker-flow="myinvestor"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator(".bk-ficha")).toHaveCount(0);
  await expect(fila(page, "myinvestor")).toHaveCount(1);
  // Tenerlo en la lista no es estar conectado: sin sesión en la nube, Conectar no le pone ✓.
  await page.locator('[data-act="bk-conectar"]').click();
  await expect(page.locator('.bk-pick [data-bk-tile="myinvestor"]')).toBeVisible();
  await expect(page.locator('.bk-pick [data-bk-tile="myinvestor"] .bk-tile-ok')).toHaveCount(0);
});

test("los brókers son filas como las de los bancos y su conexión va dentro de la ficha", async ({ page }) => {
  await abrirBancos(page, {
    investments: [
      { id: "i1", ent: "trade_republic", name: "VWCE", ticker: "VWCE", shares: 10, cost: 1000 },
      { id: "i2", ent: "myinvestor", name: "Fondo", ticker: "F1", shares: 5, cost: 500 },
    ],
  });
  await expect(fila(page, "trade_republic")).toHaveCount(1);
  await expect(fila(page, "myinvestor")).toHaveCount(1);
  // En la lista no hay formularios: solo la fila.
  await expect(page.locator(".v4-banks-push .bk-flow")).toHaveCount(0);
  await fila(page, "trade_republic").locator(".bk-nm").click();
  await expect(page.locator('.bk-ficha [data-broker-flow="trade_republic"] .hint').first()).toBeVisible();
  await page.goBack();
  await fila(page, "myinvestor").locator(".bk-nm").click();
  await expect(page.locator('.bk-ficha [data-broker-flow="myinvestor"]')).toBeVisible();
  await expect(page.locator('.bk-ficha [data-broker-flow="trade_republic"]')).toHaveCount(0);
});

test("reconectar TR actualiza al momento el resumen de Ajustes, sin reiniciar", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mc_tr_phone", "+34600000000");
    localStorage.setItem("_trAuthExpired", "1");
    let connected = false;
    window.MiCarteraTR = {
      status: async function() { return { connected: connected, authExpired: !connected }; },
      login: async function() { return { ok: true, processId: "e2e-tr" }; },
      verify: async function() { connected = true; return { ok: true }; },
      sync: async function() {
        return { ok: true, cash: 123.45, positions: [
          { isin: "IE00E2E", name: "Fondo e2e", shares: 1, value: 100, cost: 90 },
        ] };
      },
      logout: async function() { connected = false; return { ok: true }; },
    };
  });
  await seedLoggedInDashboard(page, {
    settings: { brokersOn: ["trade_republic"] },
    investments: [{ id: "i1", ent: "trade_republic", name: "Fondo e2e", isin: "IE00E2E", shares: 1, value: 90, cost: 90, cur: "EUR" }],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  // Se entra por Ajustes → Bancos → Gestionar mis bancos, como siempre (19/11), para que el resumen
  // quede montado DEBAJO y se pueda ver cambiar sin cerrar ni reabrir nada.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  const bankSummary = page.locator(".set-sub").filter({ hasText: /Gestionar mis bancos/i });
  // El puente empieza con una caducidad confirmada: Ajustes lo cuenta como caído. Un simple
  // `connected:false` ya no basta, porque era el falso positivo constante de los arranques fríos.
  await expect(bankSummary).toContainText(/1 caducado.*Trade Republic desconectado/i, { timeout: 10_000 });
  await bankSummary.locator(".set-row").first().click();
  await page.locator("[data-bank-manage]").click();
  await expect(page.locator(".bk-sec").first()).toBeVisible({ timeout: 10_000 });

  // Completar PIN + código. Antes solo cambiaba el estado local de TRSync; el resumen que queda
  // detrás conservaba el caído hasta matar la app.
  await page.locator('.v4-banks-push .bk-row[data-broker="trade_republic"]').click();
  const tr = page.locator('.bk-ficha [data-broker-flow="trade_republic"]');
  await tr.locator('input[type="password"]').fill("1234");
  await tr.getByRole("button", { name: "Conectar", exact: true }).click();
  await tr.locator('input[maxlength="6"]').fill("123456");
  await tr.getByRole("button", { name: "Verificar", exact: true }).click();
  await expect(tr.locator("select")).toBeVisible();

  await expect(bankSummary).toContainText("1 conectado");
  await expect(bankSummary).not.toContainText("caducado");
  await expect(bankSummary).not.toContainText(/Trade Republic desconectado/i);

  // Y al salir (primero baja la ficha), vuelta con acción: Ajustes con la fila marcada y el aviso.
  await page.goBack();
  await expect(page.locator(".bk-ficha")).toHaveCount(0);
  await page.locator(".v4-banks-push .settings-push-h .back").click();
  await expect(page.locator(".v4-banks-push")).toHaveCount(0);
  await expect(page.locator("[data-bank-grp] > .set-row")).toHaveClass(/cx-vuelta/);
  await expect(page.locator(".toast")).toContainText(/Trade Republic conectado/);
});
