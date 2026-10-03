/* INC-2709-14 (27/9): en Pregúntame el botón Preguntar quedaba demasiado lejos del borde inferior.
 *
 * `.v4-sheet:has(>.v4-sheet-body)` (especificidad 0,2,0) añadía 52 px + zona segura de padding a la
 * hoja, y la anulación de la hoja de ayuda (0,1,0) perdía: debajo del compositor quedaba hueco de
 * sobra y la zona segura se contaba dos veces; con el teclado, otro hueco encima de él.
 *
 * Medida: lo único que puede haber entre el botón y el borde inferior de la hoja es el padding
 * inferior del propio compositor, y ese padding es 10 px + zona segura sin teclado y 10 px con
 * teclado. El teclado se simula por la vía del componente —un `visualViewport` más bajo—, así que es
 * el componente quien pone su `marginBottom` y su `data-help-kb`. El teclado real de Android queda
 * pendiente de su móvil. No se envía ninguna pregunta. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const SAFE = 34, TECLADO = 300;

async function abrir(page, { lang, textSize, safe, teclado }) {
  await page.setViewportSize({ width: 393, height: 800 });
  if (teclado) {
    // Un visualViewport más bajo que la ventana: es lo que ve la WebView con el teclado fuera.
    await page.addInitScript((kb) => {
      const vv = new EventTarget();
      Object.defineProperties(vv, {
        height: { get: () => window.innerHeight - kb }, width: { get: () => window.innerWidth },
        offsetTop: { value: 0 }, offsetLeft: { value: 0 }, scale: { value: 1 },
      });
      Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    }, TECLADO);
  }
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000, expenses: [],
    settings: { autoPrices: false, lang, textSize: textSize || "normal" } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  if (safe) await page.addStyleTag({ content: `:root{--safe-bottom:${SAFE}px!important;}` });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-help", { detail: {} })));
  const hoja = page.locator(".aely-help-sheet");
  await expect(hoja).toBeVisible();
  await page.waitForTimeout(600);   // la hoja sube animada
  return hoja;
}

async function medir(page) {
  return page.evaluate(() => {
    const hoja = document.querySelector(".aely-help-sheet"), comp = document.querySelector(".aely-help-composer");
    const boton = document.querySelector(".aely-help-send");
    const zoom = comp.getBoundingClientRect().width / comp.offsetWidth || 1;
    return {
      hueco: hoja.getBoundingClientRect().bottom - boton.getBoundingClientRect().bottom,
      paddingComp: parseFloat(getComputedStyle(comp).paddingBottom) * zoom,
      paddingHoja: parseFloat(getComputedStyle(hoja).paddingBottom) * zoom,
      bottomHoja: hoja.getBoundingClientRect().bottom, alto: window.innerHeight,
      kb: document.querySelector(".aely-help-back").getAttribute("data-help-kb"),
      zoom,
    };
  });
}

for (const lang of ["es", "en", "ca"]) for (const textSize of ["normal", "huge"]) for (const safe of [false, true]) {
  test(`★ Preguntar pegado al borde sin teclado (${lang}, letra ${textSize}, zona segura ${safe ? SAFE : 0})`, async ({ page }) => {
    await abrir(page, { lang, textSize, safe });
    const m = await medir(page);
    expect(m.paddingHoja, "la hoja no añade padding bajo el compositor").toBeLessThan(0.5);
    expect(m.hueco).toBeCloseTo(m.paddingComp, 0);
    expect(m.paddingComp).toBeCloseTo((10 + (safe ? SAFE : 0)) * m.zoom, 0);
    await expect(page.locator(".aely-help-send")).toBeInViewport();
  });
}

for (const lang of ["es", "en", "ca"]) {
  test(`★ con el teclado, Preguntar queda justo encima y sin zona segura doble (${lang})`, async ({ page }) => {
    await abrir(page, { lang, safe: true, teclado: true });
    const m = await medir(page);
    expect(m.kb, "el componente detecta el teclado").toBe("1");
    expect(m.bottomHoja).toBeCloseTo(m.alto - TECLADO, 0);      // la hoja se apoya en el teclado
    expect(m.paddingHoja).toBeLessThan(0.5);
    expect(m.paddingComp).toBeCloseTo(10, 0);
    expect(m.hueco).toBeCloseTo(10, 0);
    // El contenido de arriba sigue alcanzable: la hoja no se sale por encima.
    const top = await page.evaluate(() => document.querySelector(".aely-help-sheet").getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
  });
}
