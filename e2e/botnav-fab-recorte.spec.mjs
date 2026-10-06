/* AL ESCONDERSE LA BARRA, EL FAB NO SE RECORTA EN RECTO NI QUEDA UN CASQUETE (INC-2709-13).
 *
 * Con la pestaña en host de scroll, `.botnav-hidden` ponía `overflow:hidden` de golpe y el rectángulo
 * de la barra cortaba la parte del FAB que asoma por encima (el círculo perdía ~8% en el primer
 * frame). El arreglo `overflow:clip` con margen lo resolvió, pero dejaba pintado un casquete de ~14px
 * del FAB pegado al borde inferior al terminar la bajada (max-height:0): lo corrige esconder SOLO el
 * FAB con `visibility` retardado. Este test ata las cuatro fases a lo que se VE, en píxeles:
 *   primer frame (se pausa la transición en t=1 ms), ocultación total final (sin pausa), reveal y
 *   cancelación CSS medida antes de que acabe la bajada. Matriz: green safe 0 / cyber safe 34 ×
 *   movimiento normal / «Reducir animaciones» de la app / prefers-reduced-motion del sistema.
 * Además guarda lo que no se puede romper: sin transform, bottom 0, nada bajo el viewport y la barra
 * sin opacity (fondo sólido). Pixeles, no código: un screenshot aquí no mide fluidez.
 */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard } from "./fixtures.mjs";
import { decodePng, fabPixels } from "./helpers/fab-pixels.mjs";

test.use({ viewport: { width: 393, height: 812 }, hasTouch: true });

const TEMAS = [{ theme: "green", safe: 0 }, { theme: "cyber", safe: 34 }];
const MOVS = [
  { name: "normal", sistema: "no-preference", app: false },
  { name: "app-reducido", sistema: "no-preference", app: true },
  { name: "sistema-reducido", sistema: "reduce", app: false },
];

for (const tm of TEMAS) for (const mv of MOVS) {
  test("FAB al esconder/revelar la barra: " + tm.theme + " safe" + tm.safe + " " + mv.name, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 812 }, hasTouch: true, reducedMotion: mv.sistema });
    const page = await ctx.newPage();
    await seedLoggedInDashboard(page, { settings: { autoPrices: false, theme: tm.theme } });
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
    const news = page.getByRole("button", { name: /Entendido|Got it/i });
    if (await news.count()) await news.first().click();
    // Halos animados fuera: se mide el recorte, no la corriente del tema cyber.
    await page.addStyleTag({ content: ":root{--safe-bottom:" + tm.safe + "px!important;}.botnav-fab::after,.botnav::after{animation:none!important;opacity:0!important}" });
    if (mv.app) await page.evaluate(() => document.documentElement.classList.add("reduce-motion"));
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

    const cdp = await ctx.newCDPSession(page);
    const gesto = async (dir) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 196, y: 500 }] });
      for (let i = 1; i <= 16; i++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 196, y: 500 - dir * i * 16 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const oculta = () => page.evaluate(() => document.querySelector(".botnav").classList.contains("botnav-hidden"));
    // Franja del borde inferior donde el casquete quedaba: con el FAB oculto por CSS tiene que ser idéntica.
    const franja = { x: 0, y: 812 - 40, width: 393, height: 40 };
    const casquete = async () => {
      const a = decodePng(await page.screenshot({ clip: franja }));
      const st = await page.addStyleTag({ content: ".botnav-fab{visibility:hidden!important}" });
      const b = decodePng(await page.screenshot({ clip: franja }));
      await st.evaluate((n) => n.remove());
      let dif = 0;
      for (let i = 0; i < a.px.length; i += 4) {
        if (Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2]) > 40) dif++;
      }
      return dif;
    };

    // 1) Primer frame oculto, transición pausada en t=1 ms.
    await page.evaluate(() => {
      const n = document.querySelector(".botnav");
      window.__primero = false;
      new MutationObserver(() => {
        if (!window.__primero && n.classList.contains("botnav-hidden")) {
          window.__primero = true;
          n.getAnimations().forEach((a) => { a.pause(); a.currentTime = 1; });
        }
      }).observe(n, { attributes: true, attributeFilter: ["class"] });
      // La transición de `visibility` del FAB nace en el siguiente recálculo de estilos, no en esta
      // microtarea: sin pausarla también, el reloj real la consumiría mientras se hace la captura.
      const pausar = (e) => { e.target.getAnimations().forEach((a) => { a.pause(); a.currentTime = 1; }); };
      n.addEventListener("transitionrun", pausar);
      window.__soltar = () => n.removeEventListener("transitionrun", pausar);
    });
    await gesto(1);
    await page.waitForFunction(() => window.__primero === true, null, { timeout: 5000 });
    const estado = await page.evaluate(() => {
      const n = document.querySelector(".botnav"), cs = getComputedStyle(n);
      return { transform: cs.transform, bottom: cs.bottom, overflow: cs.overflow, opacity: cs.opacity, bajo: n.getBoundingClientRect().bottom - innerHeight };
    });
    expect(estado.transform).toBe("none");
    expect(estado.bottom).toBe("0px");
    expect(estado.opacity, "la barra no se desvanece: fondo sólido").toBe("1");
    expect(estado.bajo, "la barra no saca la caja por debajo del viewport").toBeLessThanOrEqual(0);
    expect(estado.overflow, "`visible` dejaría desbordamiento bajo el viewport; `hidden` recorta el FAB en recto").toBe("clip");
    if (!mv.app && mv.sistema === "no-preference") {
      expect((await medir()) / completo, "primer frame: el círculo sigue pintado").toBeGreaterThanOrEqual(0.98);
    }

    // Terminar la captura pausada solo sirve para recogerla; NO acredita el final natural.
    await page.evaluate(() => { window.__soltar(); document.getAnimations().forEach((a) => { a.play(); a.finish(); }); });
    await page.waitForTimeout(1500);
    expect(await oculta()).toBe(true);


    // Cada retirada de la clase registra visibility en el primer rAF, no 1,2s después.
    await page.evaluate(() => {
      const n = document.querySelector(".botnav");
      window.__revealFrames = [];
      new MutationObserver(() => {
        if (!n.classList.contains("botnav-hidden")) requestAnimationFrame(() => {
          window.__revealFrames.push(getComputedStyle(n.querySelector(".botnav-fab")).visibility);
        });
      }).observe(n, { attributes: true, attributeFilter: ["class"] });
    });
    // 2) Reveal: el FAB vuelve entero y visible en su primer frame.
    await gesto(-1);
    await page.waitForFunction(() => !document.querySelector(".botnav").classList.contains("botnav-hidden"), null, { timeout: 5000 });
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.__revealFrames.at(-1)), "reveal primer frame").toBe("visible");
    expect((await medir()) / completo, "reveal: el FAB vuelve completo").toBeGreaterThanOrEqual(0.98);

    // 3) NUEVA ocultación por gesto, sin pausa ni finish: consume su retardo natural.
    await gesto(1);
    await page.waitForFunction(() => document.querySelector(".botnav").classList.contains("botnav-hidden"), null, { timeout: 5000 });
    await page.waitForTimeout(1500);
    expect(await oculta()).toBe(true);
    expect(await casquete(), "final natural: no queda casquete del FAB").toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector(".botnav-fab")).visibility)).toBe("hidden");
    await gesto(-1);
    await page.waitForFunction(() => !document.querySelector(".botnav").classList.contains("botnav-hidden"), null, { timeout: 5000 });
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.__revealFrames.at(-1))).toBe("visible");

    // 4) Interrupción CSS controlada. Los gestos y touchcancel del controlador se vigilan además
    // en botnav-esconder; aquí se mide la inversión de clase dentro de los 550ms, sin depender
    // de latencia CDP/inercia. Un retardo pendiente no puede ocultar el FAB después del reveal.
    const cancel = await page.evaluate(async () => {
      const n = document.querySelector(".botnav"), fab = n.querySelector(".botnav-fab");
      n.classList.add("botnav-hidden");
      const hiddenAt = performance.now();
      getComputedStyle(fab).visibility; // iniciar la transición antes de la espera
      await new Promise(r => setTimeout(r, 100));
      n.classList.remove("botnav-hidden");
      const elapsed = performance.now() - hiddenAt;
      await new Promise(r => requestAnimationFrame(r));
      return { elapsed, visibility: getComputedStyle(fab).visibility };
    });
    if (!mv.app && mv.sistema === "no-preference") {
      expect(cancel.elapsed, "cancelación anterior al final de la bajada").toBeGreaterThan(0);
      expect(cancel.elapsed).toBeLessThan(550);
    }
    expect(cancel.visibility, "cancel primer frame").toBe("visible");
    await page.waitForTimeout(1200);
    expect(await oculta()).toBe(false);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector(".botnav-fab")).visibility), "sin ocultación tardía tras cancelar").toBe("visible");
    expect((await medir()) / completo).toBeGreaterThanOrEqual(0.98);
    await ctx.close();
  });
}
