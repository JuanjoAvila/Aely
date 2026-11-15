import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, gastosRoot, gastosAbreFiltros } from "./fixtures.mjs";

/* Apuntar y la ficha de un gasto abren ligeras (14/11/2026): ya no apagan la app de detrás
   (`sheet-shell-off` recalculaba el estilo de la pantalla entera) y su primera apertura se ensaya
   en seco (`mcEnsayar`). Nada de eso se ve, así que aquí se vigila lo que podría romper sin avisar:
   - el velo tiene que quedarse los toques: uno fuera de la hoja la cierra y no abre nada de detrás;
   - el ensayo nace y muere en la misma tarea, sin nodos, clases en <html> ni entradas de Atrás, y
     sin gastar la marca de efectivo que deja la ayuda para la apertura de verdad;
   - las demás hojas (Filtros, «Todas las categorías») siguen apagando la app. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const gasto = (id, merchant, amount, day) => ({ id, date: "2026-09-" + day + "T12:00:00Z", amount, merchant, category: "super", ent: "sabadell", source: "manual" });
const clases = (page) => page.evaluate(() => document.documentElement.className);
const bajoElDedo = (page) => page.evaluate(() => { const el = document.elementFromPoint(innerWidth / 2, 30); return !!(el && el.closest(".v4-sheet-back")); });

async function abre(page) {
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  // El ensayo dura una sola tarea: solo un MutationObserver llega a verlo. La hoja cuelga de <body>.
  await page.addInitScript(() => {
    window.__ensayos = [];
    const mira = () => new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1 || !n.matches(".v4-sheet-back") || !n.querySelector(".v4-exp-sheet")) return;
      // Una apertura de verdad pone `sheet-open` antes de pintarse; el ensayo, nunca.
      if (document.documentElement.classList.contains("sheet-open")) return;
      window.__ensayos.push({ que: n.querySelector('[data-testid="exp-bank"]') ? "ficha" : "apuntar", teclas: n.querySelectorAll(".v4-keys button").length });
      queueMicrotask(() => { window.__ensayos[window.__ensayos.length - 1].sigue = n.isConnected; });
    }))).observe(document.body, { childList: true });
    if (document.body) mira(); else document.addEventListener("DOMContentLoaded", mira);
  });
  await seedLoggedInDashboard(page, { __seedOnce: true, bankTx: [], debts: [], flows: [], oneoffs: [], fixed: [], settings,
    accounts: [{ id: "bank", ent: "sabadell", role: "diario", spendFrom: true, value: 3000 }, { id: "cash", ent: "efectivo", name: "Efectivo", value: 80, role: "fijos" }],
    expenses: [gasto("g1", "Panadería sintética", 3.4, "20"), gasto("g2", "Frutería sintética", 12.5, "24")] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}
const sinRastro = (page) => page.evaluate(() => ({
  hojas: document.querySelectorAll(".v4-sheet-back").length,
  html: document.documentElement.className.split(/\s+/).filter((c) => /^sheet-/.test(c)).join(" "),
  overflow: document.body.style.overflow,
}));

test("Apuntar: se ensaya en seco sin dejar rastro, y su velo se queda los toques", async ({ page }) => {
  await abre(page);
  const antes = await page.evaluate(() => history.length);
  // La ayuda deja esta marca para la siguiente apertura: el ensayo no puede gastarla.
  await page.evaluate(() => { window.__mcApuntarCash = true; });
  await expect.poll(() => page.evaluate(() => window.__ensayos.map((e) => e.que).join(",")), { timeout: 20_000 }).toBe("apuntar");
  const e = await page.evaluate(() => window.__ensayos[0]);
  expect(e.sigue, "el ensayo seguía en el documento al acabar su tarea").toBe(false);
  expect(e.teclas, "el ensayo no llegó a pintar el teclado").toBeGreaterThan(9);
  expect(await sinRastro(page)).toEqual({ hojas: 0, html: "", overflow: "" });
  expect(await page.evaluate(() => history.length), "el ensayo apuntó una entrada de Atrás").toBe(antes);
  expect(await page.evaluate(() => window.__mcApuntarCash), "el ensayo gastó la marca de efectivo").toBe(true);

  // Inicio algo bajado: si el velo dejara pasar el dedo, la página de detrás se movería.
  const fondo = () => page.evaluate(() => document.querySelector(".track .page-live").scrollTop);
  await page.evaluate(() => { document.querySelector(".track .page-live").scrollTop = 160; });
  const bajado = await fondo();
  expect(bajado, "Inicio no tiene recorrido con estos datos: el arrastre no probaría nada").toBeGreaterThan(40);
  await page.evaluate(() => document.querySelector(".botnav-fab").click());
  const hoja = page.locator(".v4-exp-sheet");
  await expect(hoja).toBeVisible();
  await expect(hoja.getByTestId("ap-efectivo"), "la apertura de verdad sí lee la marca de efectivo").toHaveClass(/\bon\b/);
  await page.waitForTimeout(500);
  // Arrastrar sobre el velo, por encima de la hoja: ni mueve Inicio ni cierra nada.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 12 }] });
  for (let i = 1; i <= 8; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y: 12 + i * 9 }] }); await page.waitForTimeout(20); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(300);
  expect(await fondo(), "el arrastre sobre el velo movió la página de detrás").toBe(bajado);
  await expect(hoja).toBeVisible();
  expect(await clases(page)).toMatch(/\bsheet-open\b/);
  expect(await clases(page)).not.toMatch(/sheet-shell-off/);
  expect(await bajoElDedo(page), "arriba del todo manda el velo, no Inicio").toBe(true);
  // El teclado sigue apuntando.
  for (const d of ["1", "2"]) await hoja.locator(".v4-keys button", { hasText: d }).first().click();
  await expect(hoja.locator(".v4-cta")).toContainText("12");
  // «Todas las categorías» es una hoja de las de antes: mientras está, la app de detrás se apaga.
  await hoja.getByRole("button", { name: /^Las \d+/ }).click();
  await expect(page.locator(".v4-ficha-cat-back")).toBeVisible();
  expect(await clases(page)).toMatch(/sheet-shell-off/);
  await page.goBack();
  await expect(page.locator(".v4-ficha-cat-back")).toHaveCount(0);
  await expect.poll(() => clases(page)).not.toMatch(/sheet-shell-off/);
  await expect(hoja).toBeVisible();
  // Un toque en el velo cierra la hoja y no abre nada de Inicio.
  await page.waitForTimeout(500);
  await page.mouse.click(200, 30);
  await expect(page.locator(".v4-sheet-back")).toHaveCount(0);
  await expect.poll(() => sinRastro(page)).toEqual({ hojas: 0, html: "", overflow: "" });
  await expect(page.locator('.botnav-tab.active[data-tour="inicio"]')).toHaveCount(1);
});

test("Ficha de un gasto: se ensaya al entrar en Gastos, su velo se queda los toques y Filtros sigue apagando la app", async ({ page }) => {
  await abre(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const antes = await page.evaluate(() => history.length);
  await expect.poll(() => page.evaluate(() => window.__ensayos.some((e) => e.que === "ficha")), { timeout: 20_000 }).toBe(true);
  const e = await page.evaluate(() => window.__ensayos.find((x) => x.que === "ficha"));
  expect(e.sigue, "el ensayo seguía en el documento al acabar su tarea").toBe(false);
  expect(await sinRastro(page)).toEqual({ hojas: 0, html: "", overflow: "" });
  expect(await page.evaluate(() => history.length), "el ensayo apuntó una entrada de Atrás").toBe(antes);

  await gastosRoot(page).locator(".v4-gastos-list-body button.v4-mov", { hasText: "Frutería sintética" }).click();
  const hoja = page.locator(".v4-exp-sheet");
  await expect(hoja).toBeVisible();
  await expect(hoja.locator(".v4-exp-name")).toHaveValue("Frutería sintética");
  expect(await clases(page)).toMatch(/\bsheet-open\b/);
  expect(await clases(page)).not.toMatch(/sheet-shell-off/);
  expect(await bajoElDedo(page), "arriba del todo manda el velo, no la lista").toBe(true);
  await page.waitForTimeout(500);
  await page.mouse.click(200, 30);
  await expect(page.locator(".v4-sheet-back")).toHaveCount(0);
  await expect.poll(() => sinRastro(page)).toEqual({ hojas: 0, html: "", overflow: "" });
  // El gasto sigue como estaba: el toque en el velo no tocó ninguna fila ni cambió el importe.
  await expect(gastosRoot(page).locator(".v4-gastos-list-body button.v4-mov", { hasText: "Frutería sintética" })).toContainText("12,50");
  // Las demás hojas siguen apagando la app de detrás.
  await gastosAbreFiltros(page);
  expect(await clases(page)).toMatch(/sheet-shell-off/);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".app-shell")).pointerEvents)).toBe("none");
});
