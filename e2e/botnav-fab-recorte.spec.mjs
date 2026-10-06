/* AL ESCONDERSE LA BARRA, EL FAB NO SE RECORTA EN RECTO (INC-2709-13).
 *
 * Con la pestaña en host de scroll, `.botnav-hidden` ponía `overflow:hidden` de golpe y el rectángulo
 * de la barra cortaba la parte del FAB que asoma por encima (el círculo perdía ~8% en el primer
 * frame). El arreglo es `overflow:clip` con margen; este test lo ata a lo que se VE: se pausa la
 * transición en t=1 ms del primer frame oculto y se cuenta cuánto círculo sigue pintado. Falla en la
 * base (0,92) y pasa con la candidata (~0,99). Pixeles, no código: un screenshot aquí no mide fluidez.
 * Además guarda lo que no se puede romper al arreglarlo: sin transform, bottom 0 y nada bajo el viewport.
 */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard } from "./fixtures.mjs";
import { decodePng, fabPixels } from "../docs/briefs/inc-2709-13-fab-contour-probe.mjs";

test.use({ viewport: { width: 393, height: 812 }, hasTouch: true });

test("el primer frame oculto conserva el círculo del FAB y la barra no se sale de pantalla", async ({ page }) => {
  await seedLoggedInDashboard(page, { settings: { autoPrices: false } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  const news = page.getByRole("button", { name: /Entendido|Got it/i });
  if (await news.count()) await news.first().click();
  await page.evaluate(() => {
    const s = document.createElement("div"); s.style.height = "2000px";
    document.querySelector(".page.page-live").appendChild(s);
  });
  await page.waitForTimeout(1100);
  const box = await page.evaluate(() => {
    const r = document.querySelector(".botnav-fab").getBoundingClientRect();
    return { x: Math.floor(r.left) - 4, y: Math.floor(r.top) - 4, width: Math.ceil(r.width) + 8, height: Math.ceil(r.height) + 8 };
  });
  const medir = async () => fabPixels(decodePng(await page.screenshot({ clip: box })));
  const completo = await medir();
  expect(completo, "el FAB visible tiene que pintar un círculo medible").toBeGreaterThan(1500);

  await page.evaluate(() => {
    const n = document.querySelector(".botnav");
    window.__primero = false;
    new MutationObserver(() => {
      if (!window.__primero && n.classList.contains("botnav-hidden")) {
        window.__primero = true;
        n.getAnimations().forEach((a) => { a.pause(); a.currentTime = 1; });
      }
    }).observe(n, { attributes: true, attributeFilter: ["class"] });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 196, y: 600 }] });
  for (let i = 1; i <= 16; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 196, y: 600 - i * 16 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForFunction(() => window.__primero === true, null, { timeout: 5000 });

  const estado = await page.evaluate(() => {
    const n = document.querySelector(".botnav"), cs = getComputedStyle(n);
    return { transform: cs.transform, bottom: cs.bottom, overflow: cs.overflow, bajo: n.getBoundingClientRect().bottom - innerHeight };
  });
  expect(estado.transform).toBe("none");
  expect(estado.bottom).toBe("0px");
  expect(estado.bajo, "la barra no saca la caja por debajo del viewport").toBeLessThanOrEqual(0);
  expect(estado.overflow, "`visible` dejaría desbordamiento bajo el viewport; `hidden` recorta el FAB en recto").toBe("clip");
  expect((await medir()) / completo).toBeGreaterThanOrEqual(0.98);
});
