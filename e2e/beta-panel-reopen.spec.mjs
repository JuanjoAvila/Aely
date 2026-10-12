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
  // Estas cuatro regresiones de UI no dependen de una entrega real ni pueden consultarla.
  await page.route("https://juanjoavila.github.io/Aely/**", route => route.abort());
  await seedLoggedInDashboard(page);
  await page.addInitScript(() => { localStorage.setItem("_mcChannel", "beta"); });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
}

async function seedActiveReopenChecklist(page, count) {
  await page.waitForFunction(() => Array.isArray(window.RELEASE_NOTES) && window.RELEASE_NOTES.length > 0, null, { timeout: 10_000 });
  const fixture = await page.evaluate(async count => {
    // La consulta anterior debe terminar antes del stub: su cierre podría pisar el fixture.
    if (_mcProdVerCache) await _mcProdVerCache;
    CONFIG.APP_VERSION = "9.9.9.1";
    const items = Array.from({ length: count }, (_, i) => "punto sintético " + i + " con texto de sobra para que el panel tenga scroll y la altura guardada se pueda restaurar");
    RELEASE_NOTES = [{
      v: "9.9.9", d: "e2e",
      t: { es: "Reapertura sintética", en: "Synthetic reopening", ca: "Reobertura sintètica" },
      items: { es: items, en: items, ca: items },
      tandas: [{
        id: "reopen-fixture",
        t: { es: "Reapertura sintética", en: "Synthetic reopening", ca: "Reobertura sintètica" },
        items: { es: items, en: items, ca: items },
        codigo: "a".repeat(64), web: "b".repeat(64),
      }],
    }];
    // Como el fixture de revisar-beta: se aísla la UI del transporte, sin inventar recibos.
    _mcProdVerLast = null;
    window._mcProdEntregas = null;
    window._mcProdApk = null;
    window._mcProdApkRevisiones = null;
    window._mcProdVersion = function () { return Promise.resolve(null); };
    delete window._mcProdDeliveryChecked;
    const pack = betaChecklist(CONFIG.APP_VERSION, null, null);
    window.__reopenFixture = { id: pack.tandas[0].id, huella: pack.tandas[0].huella };
    return {
      pending: _mcProdVerPending,
      ids: pack.tandas.map(g => g.id),
      historical: pack.tandas.map(g => !!g.referenciaHistorica),
      items: pack.items.length,
      verdict: betaSavedVerdicts(pack),
      receipt: window._mcProdEntregas,
      identity: window.__reopenFixture,
    };
  }, count);
  expect(fixture.pending).toBe(false);
  expect(fixture.ids).toEqual(["reopen-fixture"]);
  expect(fixture.historical).toEqual([false]);
  expect(fixture.items).toBe(count);
  expect(fixture.verdict).toEqual({});
  expect(fixture.receipt).toBe(null);
  return fixture.identity;
}

async function openReopenChecklist(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  // El listener beta vive en Ajustes: esperar su pantalla conserva la puerta real.
  await expect(page.getByRole("heading", { name: /Ajustes|Settings|Ajustos/i })).toBeVisible({ timeout: 8_000 });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-beta-review")));
  const panel = page.locator(".beta-review");
  await expect(panel).toBeVisible({ timeout: 8_000 });
  await expect(panel.locator(".beta-tanda")).toHaveCount(1);
  await expect(panel.locator(".beta-tanda")).toContainText("Reapertura sintética");
  return panel;
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
  const fixture = await seedActiveReopenChecklist(page, 1);
  await page.evaluate(() => {
    localStorage.setItem("_betaPanelAbierto", String(Date.now() - 30_000));
    localStorage.removeItem("_betaPanelReabierto");
    window.__reopenReports = [];
    cloud.betaReport = function (payload) { window.__reopenReports.push(payload); return Promise.resolve({ ok: true }); };
  });

  const panel = await openReopenChecklist(page);
  const row = panel.locator(".beta-tanda");
  await expect(row.locator(".beta-item")).toHaveCount(1);
  await expect(row.locator(".beta-tanda-n")).toHaveText("0/1");
  const aprobar = row.getByRole("button", { name: /Aprobar esta tanda/ });
  await expect(aprobar).toBeDisabled();
  await row.getByRole("button", { name: /Va bien/ }).click();
  await expect(row.locator(".beta-tanda-n")).toHaveText("1/1");
  await expect(aprobar).toBeEnabled();
  await aprobar.click();
  await page.waitForTimeout(600);

  const sent = await page.evaluate(() => ({
    reports: window.__reopenReports,
    verdict: store.get("_betaReview_" + CONFIG.APP_VERSION + "_v"),
    abierto: localStorage.getItem("_betaPanelAbierto"),
    reabierto: localStorage.getItem("_betaPanelReabierto"),
    receipt: window._mcProdEntregas,
  }));
  expect(sent.reports).toHaveLength(1);
  expect(sent.reports[0]).toMatchObject({
    verdict: "approved", version: "9.9.9.1", notas: "9.9.9",
    tanda: fixture.id, huella: fixture.huella, probados: 1, fallos: 0, sinProbar: 0, noProbable: 0,
  });
  expect(sent.verdict["h:" + fixture.huella].verdict).toBe("approved");
  expect(sent.abierto, "último veredicto borra la marca").toBe(null);
  expect(sent.reabierto).toBe(null);
  expect(sent.receipt, "aprobar una prueba no acredita entrega").toBe(null);

  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForTimeout(800);
  expect(await ajustesAbierto(page)).toBe(false);
  await expect(page.locator(".beta-review")).toHaveCount(0);
});

/* ⚠ LA PUERTA DE ATRÁS DEL MISMO BUCLE (review 16/9).
 * El panel se reabre A LA MISMA ALTURA: hace `scrollTop=y`, y eso dispara `scroll` igual que un
 * dedo. Si el scroll a secas renueva la marca, cada reapertura automática la renueva y borra
 * `_betaPanelReabierto` → vuelve el «se abre todo el rato Ajustes» que arregla 4.24.4.
 * Aquí se monta el panel SIN tocar nada, con la marca ya usada y una altura guardada: ni la marca
 * ni el «ya reabierto» pueden moverse. Falla con el código de 4.24.4 tal cual llegó. */
test("★ restaurar la altura NO cuenta como interacción: la marca no se renueva sola", async ({ page }) => {
  await bootBeta(page);
  await seedActiveReopenChecklist(page, 25);
  const marca = await page.evaluate(() => {
    const t = String(Date.now() - 60_000);
    localStorage.setItem("_betaPanelAbierto", t);
    localStorage.setItem("_betaPanelReabierto", t);   // esta marca YA gastó su reapertura
    localStorage.setItem("_betaPanelScroll", "300");
    return t;
  });

  // Reapertura automática: los eventos esperan Ajustes sin introducir ningún gesto.
  const panel = await openReopenChecklist(page);
  await expect(panel.locator(".beta-item")).toHaveCount(25);
  await expect(panel.locator(".beta-tanda-n")).toHaveText("0/25");
  expect(await panel.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThanOrEqual(300);
  await expect.poll(() => panel.evaluate(el => el.scrollTop), { timeout: 5_000 }).toBe(300);
  await page.waitForTimeout(600);

  const d = await page.evaluate(() => ({
    abierto: localStorage.getItem("_betaPanelAbierto"),
    reabierto: localStorage.getItem("_betaPanelReabierto"),
    scroll: localStorage.getItem("_betaPanelScroll"),
  }));
  expect(d.abierto, "restaurar la altura no puede renovar la marca").toBe(marca);
  expect(d.reabierto, "restaurar la altura no puede devolverle la reapertura").toBe(marca);
  expect(d.scroll).toBe("300");

  // Y el dedo SÍ: mientras lee, la marca no caduca debajo de él.
  await panel.dispatchEvent("pointerdown");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("_betaPanelAbierto")), { timeout: 3_000 }).not.toBe(marca);
  expect(await page.evaluate(() => localStorage.getItem("_betaPanelReabierto"))).toBe(null);
});
