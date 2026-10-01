/* INC-2709-12 (27/9): en Cyberpunk una línea atravesaba el botón +.
 *
 * Es la «corriente» de neón que recorre el filo de la barra (`.botnav::after`, 1 px en top:-1px).
 * El + sobresale 26 px por encima de la barra y en Cyberpunk es `position:relative` sin z-index:
 * la línea, último elemento posicionado de la barra, se pintaba ENCIMA del botón.
 *
 * Medida: se congela la línea visible (sin animación, entera, opaca) y se compara la franja del +
 * que cruza con la misma captura con la línea oculta. Si el + tapa la línea, las dos capturas son
 * idénticas; en la base difieren. Todas las pestañas, 320/393/430 px, letra enorme, zona segura
 * inferior y la pila con la barra oculta y otra vez visible (clase puesta a mano: no prueba el
 * scroll real ni la inercia, que el cambio no toca). */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const CONGELA = 'html[data-theme="cyber"] .botnav::after{animation:none!important;transform:none!important;opacity:1!important;}';
const OCULTA = 'html[data-theme="cyber"] .botnav::after{display:none!important;}';

async function franjaDelMas(page) {
  // La igualdad de PNG protege la corriente, no el dithering del degradado: al quitar un
  // retirar la línea Chromium variaba 1 nivel RGB en toda la franja, con geometría idéntica (lease21).
  // Fondo opaco del mismo tema y aro quieto conservan forma/z-index y hacen visible el rojo real.
  const decoracion = await page.addStyleTag({ content: 'html[data-theme="cyber"] .botnav-fab{background:var(--cyber-mag)!important;}html[data-theme="cyber"] .botnav-fab::after{animation:none!important;opacity:0!important;}' });
  await page.evaluate(() => document.fonts.ready);
  const estilo = await page.addStyleTag({ content: CONGELA });
  await page.waitForTimeout(100);
  const fab = await page.locator(".botnav-fab").boundingBox();
  const nav = await page.locator(".botnav").boundingBox();
  // La línea va en la fila nav.y−1. Solo cuenta la parte de esa fila que cae DENTRO del círculo:
  // fuera de él la corriente debe seguir viéndose (en 320 px el + asoma poco y la cuerda es corta).
  const r = fab.width / 2, cx = fab.x + r, cy = fab.y + r, fila = nav.y - 1;
  const medio = Math.sqrt(Math.max(0, r * r - Math.max((cy - fila) ** 2, (cy - (fila + 2)) ** 2))) * 0.8;
  expect(medio, "el + debe asomar por encima de la línea para poder cruzarla").toBeGreaterThan(4);
  const clip = { x: Math.ceil(cx - medio), y: Math.floor(fila - 1), width: Math.floor(2 * medio), height: 3 };
  // Tras cambiar de pestaña hay transiciones en curso: esperar a que la franja esté quieta.
  let previa = await page.screenshot({ clip, animations: "disabled" });
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(100);
    const ahora = await page.screenshot({ clip, animations: "disabled" });
    if (ahora.equals(previa)) break;
    previa = ahora;
  }
  const con = await page.screenshot({ clip, animations: "disabled" });
  const oculta = await page.addStyleTag({ content: OCULTA });
  const sin = await page.screenshot({ clip, animations: "disabled" });
  await oculta.evaluate((n) => n.remove());
  await estilo.evaluate((n) => n.remove());
  await decoracion.evaluate((n) => n.remove());
  return con.equals(sin);
}

async function abrir(page, ancho, extra = {}) {
  await page.setViewportSize({ width: ancho, height: 800 });
  await seedLoggedInDashboard(page, { __seedOnce: true,
    settings: Object.assign({ autoPrices: false, theme: "cyber", reduceMotion: false }, extra) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cyber");
}

for (const ancho of [320, 393, 430]) {
  test(`★ Cyberpunk: la línea de la barra no cruza el + (${ancho} px, todas las pestañas)`, async ({ page }) => {
    await abrir(page, ancho);
    for (const tab of ["inicio", "gastos", "plan", "cartera"]) {
      await page.locator(`.botnav-tab[data-tour="${tab}"]`).click();
      await expect(page.locator(`.botnav-tab[data-tour="${tab}"]`)).toHaveClass(/active/);
      expect(await franjaDelMas(page), `pestaña ${tab}`).toBe(true);
    }
  });
}

test("★ Cyberpunk con letra enorme, zona segura y la barra al esconderse y volver", async ({ page }) => {
  await abrir(page, 393, { textSize: "huge" });
  // Zona segura de un móvil con gestos: la barra crece por abajo, la línea sigue arriba.
  await page.addStyleTag({ content: ":root{--safe-bottom:34px!important;}" });
  expect(await franjaDelMas(page), "letra enorme + zona segura").toBe(true);
  await page.evaluate(() => document.querySelector(".botnav").classList.add("botnav-hidden"));
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector(".botnav").classList.remove("botnav-hidden"));
  await page.waitForTimeout(700);
  expect(await franjaDelMas(page), "tras esconderse y volver").toBe(true);
  // El + sigue siendo lo que recibe el toque en su centro.
  const fab = await page.locator(".botnav-fab").boundingBox();
  const encima = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest(".botnav-fab"));
  }, { x: fab.x + fab.width / 2, y: fab.y + fab.height / 2 });
  expect(encima).toBe(true);
});
