/* INC-2709-13: la rayita de la pestaña activa (`.botnav-ind`) se quedaba flotando 9 px por encima
 * de una barra ya escondida. En el host nativo la barra oculta colapsa su caja a 0 pero conserva
 * `overflow-clip-margin:30px`, y la rayita (top:-9px) cabe justo dentro de ese margen.
 *
 * Se mide el estilo CALCULADO de la rayita y de la corriente Cyberpunk (`.botnav::after`) con la
 * clase `botnav-hidden` puesta y quitada, y una vez con un arrastre real de dedo. La corriente NO
 * se apaga en la prueba: el arreglo tiene que esconder la rayita sin llevársela por delante. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

async function abrir(page, settings) {
  await seedLoggedInDashboard(page, { __seedOnce: true, settings: Object.assign({ autoPrices: false }, settings) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

const opacidadRayita = (page) =>
  page.evaluate(() => Number(getComputedStyle(document.querySelector(".botnav-ind")).opacity));
const corriente = (page) =>
  page.evaluate(() => {
    const s = getComputedStyle(document.querySelector(".botnav"), "::after");
    return { animacion: s.animationName, opacidad: Number(s.opacity), contenido: s.content };
  });
const esconder = (page, si) =>
  page.evaluate((si) => document.querySelector(".botnav").classList.toggle("botnav-hidden", si), si);

for (const tema of ["green", "cyber"]) {
  for (const reduce of [false, true]) {
    test(`rayita: visible, oculta con la barra y vuelve (${tema}, reducir animaciones ${reduce})`, async ({ page }) => {
      await abrir(page, { theme: tema, reduceMotion: reduce });
      await expect.poll(() => opacidadRayita(page)).toBe(1);
      const antes = await corriente(page);

      await esconder(page, true);
      await expect.poll(() => opacidadRayita(page), { timeout: 2_000 }).toBe(0);
      // La corriente Cyberpunk no depende de la rayita: lo que tenía antes de esconder, lo conserva.
      expect(await corriente(page)).toEqual(antes);

      await esconder(page, false);
      await expect.poll(() => opacidadRayita(page), { timeout: 2_000 }).toBe(1);
    });
  }
}

test("Cyberpunk: la corriente sigue animada con la barra oculta", async ({ page }) => {
  await abrir(page, { theme: "cyber", reduceMotion: false });
  await esconder(page, true);
  await expect.poll(() => opacidadRayita(page)).toBe(0);
  const c = await corriente(page);
  expect(c.animacion, "la corriente tiene que seguir con su animación").not.toBe("none");
  expect(c.opacidad).toBeGreaterThan(0);
});

test("arrastrando con el dedo la rayita se va con la barra y vuelve al subir", async ({ page }) => {
  await abrir(page, { theme: "green", reduceMotion: false });
  const cdp = await page.context().newCDPSession(page);
  const oculta = () => page.evaluate(() => document.querySelector(".botnav").classList.contains("botnav-hidden"));
  const arrastre = async (desde, paso) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 187, y: desde }] });
    for (let i = 1; i <= 24; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 187, y: desde + i * paso }] });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await arrastre(600, -16);
  await expect.poll(oculta, { timeout: 2_000 }).toBe(true);
  await expect.poll(() => opacidadRayita(page), { timeout: 2_000 }).toBe(0);
  await arrastre(200, 16);
  await expect.poll(oculta, { timeout: 3_000 }).toBe(false);
  await expect.poll(() => opacidadRayita(page), { timeout: 2_000 }).toBe(1);
});
