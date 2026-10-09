/* INC-2709-13: el clip del host dejaba la rayita flotando al colapsar la barra.
 * Gestos por el controlador real; clase, geometría, píxeles y corriente se comprueban juntos.
 * La matriz no desactiva pseudos ni animaciones. Son pruebas sintéticas de Chromium. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";
import { decodePng } from "./helpers/fab-pixels.mjs";

test.use({ viewport: { width: 393, height: 812 }, hasTouch: true });
const movimientos = [
  { nombre: "normal", app: false, sistema: "no-preference" },
  { nombre: "app-reducido", app: true, sistema: "no-preference" },
  { nombre: "sistema-reducido", app: false, sistema: "reduce" },
];

async function estado(page) {
  return page.evaluate(() => {
    const nav = document.querySelector(".botnav");
    if(!nav) throw new Error("La navegación debe seguir montada en la app");
    const ind = nav.querySelector(".botnav-ind");
    const fab = nav.querySelector(".botnav-fab"), cs = getComputedStyle(nav);
    const corriente = getComputedStyle(nav, "::after");
    return { oculta: nav.classList.contains("botnav-hidden"), opacity: Number(getComputedStyle(ind).opacity),
      indHide: ind.classList.contains("hide"), host: document.querySelector(".app-shell").classList.contains("scroll-host-on"),
      alto: nav.getBoundingClientRect().height, bottom: nav.getBoundingClientRect().bottom,
      transform: cs.transform, fondo: cs.backgroundColor, navOpacity: cs.opacity, transicion: cs.transitionDuration,
      sistemaReducido: matchMedia("(prefers-reduced-motion:reduce)").matches,
      fabVisible: getComputedStyle(fab).visibility, fabTop: fab.getBoundingClientRect().top,
      viewport: innerHeight, corriente: { animation: corriente.animationName, duration: corriente.animationDuration,
        fondo: corriente.backgroundImage, opacity: corriente.opacity, content: corriente.content } };
  });
}
async function gesto(cdp, page, { desde = 600, paso = -16, pasos = 24, cancelar = false } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 196, y: desde }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 196, y: desde + i * paso }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: cancelar ? "touchCancel" : "touchEnd", touchPoints: [] });
}

async function comprobar(page, oculta, corriente, indHide = false) {
  await expect.poll(async () => {
    const s = await estado(page);
    return { oculta: s.oculta, opacity: s.opacity, indHide: s.indHide };
  }).toEqual({ oculta, opacity: oculta || indHide ? 0 : 1, indHide });
  const s = await estado(page);
  // La opacidad normal cambia con el reloj de cybercurrent: comparar dos instantes la congelaría.
  const { opacity: opacidadAntes, ...reglaAntes } = corriente;
  const { opacity: opacidadAhora, ...reglaAhora } = s.corriente;
  expect(reglaAhora).toEqual(reglaAntes);
  if (corriente.animation === "none") expect(opacidadAhora).toBe(opacidadAntes);
  expect(s.navOpacity, "fondo sin desvanecer").toBe("1");
  expect(s.fondo).not.toBe("rgba(0, 0, 0, 0)");
  expect(s.fondo.startsWith("rgba("), "el color base no lleva alfa").toBe(false);
  expect(s.bottom).toBeLessThanOrEqual(s.viewport + 1);
  expect(s.fabVisible).toBe("visible");
  if (s.sistemaReducido) expect(s.transicion, "la barra visible y oculta conserva transition:none del sistema").toBe("0s");
  if (oculta) {
    expect(s.host).toBe(true);
    expect(s.transform).toBe("none");
    await expect.poll(async () => (await estado(page)).alto).toBeLessThanOrEqual(1);
    expect((await estado(page)).fabTop).toBeGreaterThanOrEqual(s.viewport);
  } else {
    await expect.poll(async () => (await estado(page)).alto).toBeGreaterThan(50);
    await expect.poll(async () => (await estado(page)).fabTop).toBeLessThan(s.viewport - 30);
  }
}

// La misma franja con el span suprimido distingue opacidad de pintura efectiva.
// Se recorta la rayita, lejos del FAB central y de la corriente del borde inferior.
async function pixelesRayita(page) {
  // El contenido detrás no debe seguir con inercia entre ambas capturas: sería una diferencia
  // de la página, no de la rayita. No se fuerza scrollTop ni se pausa la corriente Cyberpunk.
  let ultimo = -1, quietas = 0;
  await expect.poll(async () => {
    const y = await page.locator(".page.page-scroll-host").evaluate(el => el.scrollTop);
    quietas = y === ultimo ? quietas + 1 : 0;
    ultimo = y;
    return quietas;
  }, { intervals: [100], timeout: 5000 }).toBeGreaterThanOrEqual(3);
  const clip = await page.locator(".botnav-ind").evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.floor(r.width), height: 4 };
  });
  const a = decodePng(await page.screenshot({ clip }));
  const control = await page.addStyleTag({ content: ".botnav-ind span{visibility:hidden!important}" });
  const b = decodePng(await page.screenshot({ clip }));
  await control.evaluate(el => el.remove());
  let distintos = 0;
  for (let i = 0; i < a.px.length; i += 4) {
    if (Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2]) > 40) distintos++;
  }
  return distintos;
}

for (const tema of ["green", "cyber"]) for (const safe of [0, 34]) for (const mv of movimientos) {
  test("indicador con gestos y paneles: " + tema + " safe" + safe + " " + mv.nombre, async ({ page }, testInfo) => {
    const errores=[];
    page.on("pageerror", error => errores.push(error.message));
    page.on("console", msg => { if(msg.type()==="error" && !msg.text().startsWith("Failed to load resource:")) errores.push(msg.text()); });
    try {
    await page.emulateMedia({ reducedMotion: mv.sistema });
    await seedLoggedInDashboard(page, { __seedOnce: true, settings: { autoPrices: false, theme: tema, reduceMotion: mv.app } });
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() => !document.getElementById("mc-load"));
    await dismissNews(page);
    await page.addStyleTag({ content: ":root{--safe-bottom:" + safe + "px!important;}" });
    await page.waitForTimeout(1100);
    const antes = await estado(page), corriente = antes.corriente;
    expect(antes.host).toBe(true);
    await comprobar(page, false, corriente);
    if (tema === "cyber") {
      expect(corriente.content).not.toBe("none");
      if (!mv.app && mv.sistema === "no-preference") expect(corriente.animation).not.toBe("none");
      else {
        expect(corriente.animation).toBe("none");
        expect(Number(corriente.opacity)).toBe(0);
      }
    }
    expect(await pixelesRayita(page), "la rayita visible pinta").toBeGreaterThan(30);
    const cdp = await page.context().newCDPSession(page);
    await gesto(cdp, page);
    await comprobar(page, true, corriente);
    if (tema === "cyber" && !mv.app && mv.sistema === "no-preference") {
      await expect.poll(async () => Number((await estado(page)).corriente.opacity), { timeout: 8000 }).toBeGreaterThan(0);
    }
    expect(await page.locator(".page.page-scroll-host").evaluate(el => el.scrollTop), "el gesto movió el host").toBeGreaterThan(40);
    expect(await pixelesRayita(page), "la rayita oculta no pinta").toBe(0);
    await gesto(cdp, page, { desde: 200, paso: 16 });
    await comprobar(page, false, corriente);

    // touchcancel real y re-render: no basta con poner la clase por JS.
    // Al aterrizar arriba la app fija la navegación visible un segundo; respetar ese contrato
    // permite que el segundo gesto mida cancelación en el fondo, no el pin del tope.
    await page.waitForTimeout(1100);
    await gesto(cdp, page, { pasos: 30, cancelar: true });
    await comprobar(page, true, corriente);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await comprobar(page, true, corriente);
    await gesto(cdp, page, { desde: 200, paso: 16 });
    await comprobar(page, false, corriente);
    await page.locator('.botnav-tab[data-tour="inicio"]').click();
    await page.locator(".v4-avatar").click();
    await expect(page.locator(".profile-pull.open")).toBeVisible();
    await comprobar(page, false, corriente, true);
    // La transferencia Perfil→Ajustes rompe el historial también en8dcc (acta OPEN).
    // Las dos entradas independientes siguen probando su cierre real, sin forzar la pila.
    await page.locator(".profile-pull-h .back").click();
    await expect(page.locator(".profile-pull.open")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => _mcIgnorePop)).toBe(false);
    await comprobar(page, false, corriente);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 20, y: 200 }] });
    for(let i=1;i<=20;i++){
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 20+i*16, y: 200 }] });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.locator(".settings-push.open")).toBeVisible();
    await comprobar(page, false, corriente, true);
    await page.locator(".settings-push-h .back").click();
    await expect(page.locator(".settings-push.open")).toHaveCount(0);
    await comprobar(page, false, corriente);
    await page.locator(".botnav-fab").click();
    await expect(page.locator(".v4-keys")).toBeVisible();
    expect(errores).toEqual([]);
    } finally {
      if(errores.length) await testInfo.attach("errores-render",{body:JSON.stringify(errores),contentType:"application/json"});
    }
  });
}
