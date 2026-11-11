import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos: abrir «¿Te llega?», Tus recibos y «Editar» sin fotogramas largos (10/11/2026).
   Lo que se hizo para la fluidez no se ve, así que aquí se vigila que no rompa nada sin avisar:
   - Las hojas de Recibos ya no apagan la app de detrás (`sheet-shell-off` recalculaba el estilo de la
     pantalla entera): su velo tiene que seguir quedándose los toques, y las demás hojas, como antes.
   - En «Editar» solo nace el paso a la vista; los otros llegan solos o en el toque que cambia de paso.
   - El ensayo en seco (`mcEnsayar`) monta y desmonta las tres cosas sin dejar rastro: ni nodos, ni
     clases en <html>, ni entradas en el historial. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const recibo = (id, name, amount, day) => ({ id, name, amount, freq: "mes", day, account: "sabadell" });
const R = '.page-live [data-seg="recibos"] ';
const clases = (page) => page.evaluate(() => document.documentElement.className);

async function abrePlan(page) {
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  // El ensayo dura una sola tarea y solo un MutationObserver llega a verlo. Con `subtree`: la hoja de
  // editar no cuelga de <body> sino del nodo del propio ensayo.
  await page.addInitScript(() => {
    window.__ensayos = [];
    const mira = () => new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      const que = n.matches("[data-bills-manage]") ? "todos" : n.querySelector('[data-testid="llega-sheet"]') ? "llega" : n.querySelector('[data-sheet="recibo-pasos"]') ? "editar" : null;
      if (que) window.__ensayos.push({ que, pasos: n.querySelectorAll(".rp4-step > :not(h2)").length, suelto: !n.isConnected });
    }))).observe(document.body, { childList: true, subtree: true });
    if (document.body) mira(); else document.addEventListener("DOMContentLoaded", mira);
  });
  await seedLoggedInDashboard(page, { __seedOnce: true, bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], settings,
    accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }],
    fixed: [recibo("luz", "Luz", 55, 3), recibo("nfx", "Netflix", 12.99, 25), recibo("agua", "Agua", 20, 26)] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator(R + '[data-testid="plan-llega"]')).toBeVisible();
}

test("el ensayo en seco pasa por las tres y no deja rastro", async ({ page }) => {
  await abrePlan(page);
  const antes = await page.evaluate(() => history.length);
  await expect.poll(() => page.evaluate(() => window.__ensayos.map((e) => e.que).join(",")), { timeout: 20_000 }).toBe("llega,todos,editar");
  const e = await page.evaluate(() => window.__ensayos);
  // Cuando alguien puede mirar, ya no están: nacen y mueren en la misma tarea.
  expect(e.every((x) => x.suelto), "un ensayo seguía en el documento al acabar su tarea").toBe(true);
  // La hoja de editar se ensaya con sus cinco pasos: los otros cuatro también son primera vez.
  expect(e[2].pasos).toBeGreaterThan(4);
  expect(await page.evaluate(() => ({
    hojas: document.querySelectorAll(".v4-sheet-back,[data-bills-manage]").length,
    html: document.documentElement.className.split(/\s+/).filter((c) => /^(sheet-|bills-open)/.test(c)).join(" "),
    overflow: document.body.style.overflow,
    barraEnSuSitio: !!document.querySelector(".app-shell .botnav"),
  }))).toEqual({ hojas: 0, html: "", overflow: "", barraEnSuSitio: true });
  expect(await page.evaluate(() => history.length), "el ensayo apuntó entradas de Atrás").toBe(antes);
  // Y lo de verdad sigue abriendo y cerrando.
  await page.locator(R + '[data-testid="plan-llega"]').click();
  await expect(page.getByTestId("llega-sheet")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("llega-sheet")).toHaveCount(0);
});

test("una hoja de Recibos no apaga la app de detrás, pero su velo se queda los toques", async ({ page }) => {
  await abrePlan(page);
  await page.locator(R + '[data-testid="plan-llega"]').click();
  await expect(page.getByTestId("llega-sheet")).toBeVisible();
  expect(await clases(page)).toMatch(/\bsheet-open\b/);
  expect(await clases(page)).not.toMatch(/sheet-shell-off/);
  // Arriba del todo, donde la hoja no llega: lo que hay bajo el dedo es el velo, no Recibos.
  expect(await page.evaluate(() => { const el = document.elementFromPoint(innerWidth / 2, 40); return !!(el && el.closest(".v4-sheet-back")); })).toBe(true);
  // Tocar ahí cierra la hoja y no abre nada de lo de detrás.
  await page.mouse.click(200, 40);
  await expect(page.getByTestId("llega-sheet")).toHaveCount(0);
  await expect(page.locator(".v4-sheet-back,[data-bills-manage]")).toHaveCount(0);
  await expect.poll(() => clases(page)).not.toMatch(/sheet-open/);
  // Las demás hojas siguen apagando la app: Apuntar.
  await page.locator(".botnav-fab").click();
  await expect(page.locator(".v4-sheet").first()).toBeVisible();
  expect(await clases(page)).toMatch(/sheet-shell-off/);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".app-shell")).pointerEvents)).toBe("none");
});

test("editar: nace el paso a la vista y los demás llegan solos o al cambiar de paso", async ({ page }) => {
  await abrePlan(page);
  await page.locator(R + '[data-testid="plan-todos"]').click();
  await expect(page.locator('[data-bills-manage] [data-bill-id="nfx"]')).toBeVisible();
  const otros = () => page.evaluate(() => document.querySelectorAll('[data-sheet="recibo-pasos"] .rp4-step:not(.on) > :not(h2)').length);
  // El toque y la cuenta en la misma tarea: React pinta el clic en una microtarea, antes de soltar el hilo.
  const alAbrir = await page.evaluate(async () => { document.querySelector('[data-bills-manage] [data-bill-id="nfx"]').click();
    await Promise.resolve(); await Promise.resolve();
    return { resumen: document.querySelectorAll('[data-sheet="recibo-pasos"] .rp4-step.on .rp4-row').length, otros: document.querySelectorAll('[data-sheet="recibo-pasos"] .rp4-step:not(.on) > :not(h2)').length }; });
  expect(alAbrir.resumen).toBeGreaterThan(2);
  expect(alAbrir.otros).toBe(0);
  await expect.poll(otros, { timeout: 8000 }).toBeGreaterThan(3);
  await page.goBack();
  await expect(page.locator('[data-sheet="recibo-pasos"]')).toHaveCount(0);
  // Sin esperar: del resumen al importe en cuanto abre, y el teclado ya está.
  await page.evaluate(async () => { document.querySelector('[data-bills-manage] [data-bill-id="nfx"]').click();
    await Promise.resolve(); await Promise.resolve();
    document.querySelector('[data-sheet="recibo-pasos"] [data-rp4-fila="1"]').click(); });
  await expect(page.locator('[data-sheet="recibo-pasos"] [data-rp4-paso="1"] .v4-keys button').first()).toBeVisible();
  await expect(page.locator('[data-sheet="recibo-pasos"]')).toHaveAttribute("data-paso", "1");
});
