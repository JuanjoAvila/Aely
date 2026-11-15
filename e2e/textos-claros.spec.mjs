/* Textos que decían otra cosa de lo que enseñaba la pantalla (auditoría de funciones y textos,
   14/11/2026). Cada test mira lo que se PINTA, no el código:
   - Plan en modo sencillo: la cifra grande es el total y la frase nombra el banco del que habla.
   - Inicio «Este mes»: la cifra es lo que queda, y lo dice («libres de»).
   - Modo sencillo: Inicio no ofrece metas que Plan no enseña.
   - `<html lang>` sigue al idioma de la app.
   - El tipo de cambio de Inversiones con 4 decimales y la coma del idioma.
   - La salida de emergencia del candado usa el diálogo de la app, no el nativo. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const RELOJ = new Date("2026-09-10T12:00:00Z");

async function abre(page, overrides) {
  await page.clock.install({ time: RELOJ });
  await seedLoggedInDashboard(page, overrides);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

test("Plan sencillo: la cifra es el total y la frase dice de qué banco salen sus recibos", async ({ page }) => {
  await abre(page, {
    accounts: [
      { id: "sb", ent: "sabadell", name: "Cuenta A", value: 800, role: "fijos" },
      { id: "bb", ent: "bbva", name: "Cuenta B", value: 500, role: "fijos" },
    ],
    fixed: [
      { id: "luz", name: "Luz ficticia", amount: 40, freq: "mes", day: 28, account: "sabadell" },
      { id: "agua", name: "Agua ficticia", amount: 60, freq: "mes", day: 20, account: "bbva" },
    ],
    debts: [], oneoffs: [], flows: [], budget: 500,
    settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: true },
  });
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const cover = page.locator(".page-live .v4-plan-cover-simple");
  await expect(cover.locator(".v4-plan-simple-amt")).toHaveText(/^100\s*€$/);
  const frase = cover.locator(".ph").first();
  // La frase habla de UN banco: su importe va con el nombre del banco, no como «te quedan».
  await expect(frase).toHaveText(/^(40|60)\s*€ de recibos salen de (Sabadell|BBVA): /);
  await expect(frase).not.toContainText(/Te quedan|v4_plan_state/);
});

// Sin cuenta de ese banco su saldo no se sabe: ni banco ni «te quedarías» (revisión de dinero 233).
for (const [caso, recibo, cuenta] of [
  ["banco sin cuenta", { account: "bbva" }, { id: "sb", ent: "sabadell", name: "Cuenta A", value: 800, role: "fijos" }],
  ["recibo sin banco", {}, { id: "bb", ent: "bbva", name: "Cuenta B", value: 800, role: "fijos" }],
]) {
  test(`Plan sencillo, ${caso}: no inventa banco ni saldo`, async ({ page }) => {
    await abre(page, {
      accounts: [cuenta],
      fixed: [Object.assign({ id: "gas", name: "Gas ficticio", amount: 50, freq: "mes", day: 20 }, recibo)],
      debts: [], oneoffs: [], flows: [], budget: 500,
      settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: true },
    });
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    const cover = page.locator(".page-live .v4-plan-cover-simple");
    await expect(cover.locator(".v4-plan-simple-amt")).toHaveText(/^50\s*€$/);
    await expect(cover.locator(".ph").first()).toHaveText(/^Te quedan 50\s*€ de recibos\.$/);
    await expect(cover).not.toContainText(/salen de|quedarías|bajarías|-50/);
    // Tampoco un titular de «bien» o «corto»: sale de un saldo que no se sabe.
    await expect(cover).not.toContainText(/Vas bien|Ojo este mes|se queda corto/);
    await expect(cover).toHaveAttribute("data-plan-state", "unknown");
  });
}

for (const [lang, libres] of [["es", "libres de"], ["en", "left of"], ["ca", "lliures de"]]) {
  test(`${lang}: Inicio dice que la cifra del ciclo es lo que queda, y <html lang> sigue al idioma`, async ({ page }) => {
    await abre(page, { budget: 1000, settings: { autoPrices: false, theme: "green", lang } });
    await expect(page.locator(".v4-budget .v42-cycle-of").first()).toContainText(libres);
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(lang);
  });
}

for (const simple of [false, true]) {
  test(`Inicio ${simple ? "sencillo: sin metas, porque Plan no las tiene" : "normal: con metas"}`, async ({ page }) => {
    await abre(page, { goals: [], settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: simple } });
    const inicio = page.locator('.page-live').filter({ has: page.locator('[data-testid="inicio-recent"]') });
    await expect(inicio.locator('[data-testid="inicio-recent"]')).toBeVisible();
    await expect(inicio.getByRole("button", { name: "Ponte una meta de ahorro" })).toHaveCount(simple ? 0 : 1);
    await expect(inicio.locator(".v4-section-h", { hasText: "Tus metas" })).toHaveCount(simple ? 0 : 1);
  });
}

test("Inversiones: el dólar→euro con 4 decimales y coma", async ({ page }) => {
  await abre(page, {
    investments: [{ id: "i1", ent: "revolut", name: "Acción ficticia", ticker: "FAKE", shares: 5, value: 900, cost: 700, cur: "USD" }],
    fxRates: { USD: 0.904813608397 },
  });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  // La pista va en el bloque de Inversiones de la propia Cartera (no en la pantalla de «Ver todas»).
  const bloque = page.locator('.page-live [data-cartera-sec="inversiones"]');
  await expect(bloque).toContainText("Dólar→euro: 0,9048.");
  await expect(bloque).not.toContainText("0.904813608397");
});

test("Candado: «No puedo desbloquear» pregunta con el diálogo de la app, no el nativo", async ({ page }) => {
  const nativos = [];
  page.on("dialog", (d) => { nativos.push(d.message()); d.dismiss().catch(() => {}); });
  await page.addInitScript(() => { try { localStorage.setItem("bio_cred", JSON.stringify({ id: "e2e" })); } catch (e) {} });
  await page.clock.install({ time: RELOJ });
  await seedLoggedInDashboard(page, {});
  await page.goto("/");
  await page.getByRole("button", { name: "No puedo desbloquear" }).click();
  const dialogo = page.locator(".askback");
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole("button", { name: "Quitar el candado" }).click();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  expect(nativos).toEqual([]);
});
