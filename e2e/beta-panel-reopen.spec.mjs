import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* REAPERTURA DEL PANEL BETA SIN BUCLE (15/9, rechazo 4.24.2).
 *
 * «Se abre todo el rato Ajustes»: al montar, si `_betaPanelAbierto` tenía < 2 h, se abría
 * Ajustes + Revisar beta — y el panel AL MONTAR reescribía Date.now(), renovando las 2 h.
 * Aquí: marca reciente → 1ª carga abre; 2ª sin tocar → Inicio. Cerrar cajón → recarga → Inicio.
 * Último veredicto → recarga → Inicio. Los tres fallan con el código de antes del 4.24.4.
 *
 * ⚠ No usar addInitScript para la marca: se re-ejecuta en cada reload y borraría
 * `_betaPanelReabierto` / repondría la marca (falso rojo).
 */

async function bootBeta(page) {
  await seedLoggedInDashboard(page);
  await page.addInitScript(() => { localStorage.setItem("_mcChannel", "beta"); });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
}

function ajustesAbierto(page) {
  return page.evaluate(() => document.documentElement.classList.contains("settings-open"));
}

async function ponerMarca(page) {
  await page.evaluate(() => {
    localStorage.setItem("_betaPanelAbierto", String(Date.now() - 60_000));
    localStorage.removeItem("_betaPanelReabierto");
  });
}

test("★ marca reciente: la 1ª carga abre Ajustes; la 2ª sin tocar aterriza en Inicio", async ({ page }) => {
  await bootBeta(page);
  await ponerMarca(page);
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await expect.poll(() => ajustesAbierto(page), { timeout: 8_000 }).toBe(true);

  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForTimeout(800);
  expect(await ajustesAbierto(page), "2ª carga no debe reabrir Ajustes").toBe(false);
});

test("cerrar el cajón de Ajustes olvida la marca: recargar aterriza en Inicio", async ({ page }) => {
  await bootBeta(page);
  await ponerMarca(page);
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await expect.poll(() => ajustesAbierto(page), { timeout: 8_000 }).toBe(true);

  await page.locator(".settings-push-h .back").click();
  await expect.poll(() => ajustesAbierto(page), { timeout: 5_000 }).toBe(false);

  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForTimeout(800);
  expect(await ajustesAbierto(page)).toBe(false);
  const abierto = await page.evaluate(() => localStorage.getItem("_betaPanelAbierto"));
  expect(abierto, "cerrar Ajustes borra _betaPanelAbierto").toBe(null);
});

test("enviar el último veredicto olvida la marca: recargar aterriza en Inicio", async ({ page }) => {
  await bootBeta(page);
  await page.waitForFunction(() => Array.isArray(window.RELEASE_NOTES) && window.RELEASE_NOTES.length > 0, null, { timeout: 10_000 });

  await page.evaluate(() => {
    CONFIG.APP_VERSION = "4.24.4.1";
    const notes = {
      v: "4.24.4", d: "e2e",
      t: { es: "e2e", en: "e2e", ca: "e2e" },
      items: { es: ["punto e2e"], en: ["e2e point"], ca: ["punt e2e"] },
      tandas: [{
        id: "solo",
        t: { es: "sola", en: "only", ca: "sola" },
        items: { es: ["punto e2e"], en: ["e2e point"], ca: ["punt e2e"] },
      }],
    };
    RELEASE_NOTES.unshift(notes);
    window._mcProdVersion = function () { return Promise.resolve(null); };
    localStorage.setItem("_betaPanelAbierto", String(Date.now() - 30_000));
    localStorage.removeItem("_betaPanelReabierto");
    const sk = "_betaReview_" + CONFIG.APP_VERSION;
    localStorage.setItem(sk, JSON.stringify({ 0: "ok" }));
  });

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mc-open-settings"));
    setTimeout(() => window.dispatchEvent(new CustomEvent("mc-open-beta-review")), 0);
  });
  await expect(page.locator(".beta-review")).toBeVisible({ timeout: 8_000 });

  await page.evaluate(() => {
    cloud.betaReport = function () { return Promise.resolve({ ok: true }); };
  });

  const aprobar = page.locator(".beta-review button").filter({ hasText: /Aprobar|Approve|Aprovar/i }).first();
  await expect(aprobar).toBeVisible({ timeout: 8_000 });
  await aprobar.click();
  await page.waitForTimeout(600);

  const abierto = await page.evaluate(() => localStorage.getItem("_betaPanelAbierto"));
  expect(abierto, "último veredicto borra la marca").toBe(null);

  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForTimeout(800);
  expect(await ajustesAbierto(page)).toBe(false);
});

/* ⚠ LA PUERTA DE ATRÁS DEL MISMO BUCLE (review 16/9).
 * El panel se reabre A LA MISMA ALTURA: hace `scrollTop=y`, y eso dispara `scroll` igual que un
 * dedo. Si el scroll a secas renueva la marca, cada reapertura automática la renueva y borra
 * `_betaPanelReabierto` → vuelve el «se abre todo el rato Ajustes» que arregla 4.24.4.
 * Aquí se monta el panel SIN tocar nada, con la marca ya usada y una altura guardada: ni la marca
 * ni el «ya reabierto» pueden moverse. Falla con el código de 4.24.4 tal cual llegó. */
test("★ restaurar la altura NO cuenta como interacción: la marca no se renueva sola", async ({ page }) => {
  await bootBeta(page);
  await page.waitForFunction(() => Array.isArray(window.RELEASE_NOTES) && window.RELEASE_NOTES.length > 0, null, { timeout: 10_000 });

  const marca = await page.evaluate(() => {
    CONFIG.APP_VERSION = "4.24.4.1";
    // Lo bastante largo para que el panel tenga scroll de verdad y la altura se pueda restaurar.
    const items = [];
    for (let i = 0; i < 25; i++) items.push("punto de prueba " + i + " con texto de sobra para que el panel tenga scroll y la altura guardada se pueda restaurar");
    RELEASE_NOTES.unshift({
      v: "4.24.4", d: "e2e",
      t: { es: "e2e", en: "e2e", ca: "e2e" },
      items: { es: items, en: items, ca: items },
      tandas: [{ id: "solo", t: { es: "sola", en: "only", ca: "sola" }, items: { es: items, en: items, ca: items } }],
    });
    window._mcProdVersion = function () { return Promise.resolve(null); };
    const t = String(Date.now() - 60_000);
    localStorage.setItem("_betaPanelAbierto", t);
    localStorage.setItem("_betaPanelReabierto", t);   // esta marca YA gastó su reapertura
    localStorage.setItem("_betaPanelScroll", "300");
    return t;
  });

  // Reapertura automática: el panel se monta sin que él toque la pantalla.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mc-open-settings"));
    setTimeout(() => window.dispatchEvent(new CustomEvent("mc-open-beta-review")), 0);
  });
  await expect(page.locator(".beta-review")).toBeVisible({ timeout: 8_000 });
  await expect.poll(() => page.evaluate(() => document.querySelector(".beta-review").scrollTop), { timeout: 5_000 }).toBe(300);
  await page.waitForTimeout(600);

  const d = await page.evaluate(() => ({
    abierto: localStorage.getItem("_betaPanelAbierto"),
    reabierto: localStorage.getItem("_betaPanelReabierto"),
  }));
  expect(d.abierto, "restaurar la altura no puede renovar la marca").toBe(marca);
  expect(d.reabierto, "restaurar la altura no puede devolverle la reapertura").toBe(marca);

  // Y el dedo SÍ: mientras lee, la marca no caduca debajo de él.
  await page.locator(".beta-review").dispatchEvent("pointerdown");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("_betaPanelAbierto")), { timeout: 3_000 }).not.toBe(marca);
  expect(await page.evaluate(() => localStorage.getItem("_betaPanelReabierto"))).toBe(null);
});
