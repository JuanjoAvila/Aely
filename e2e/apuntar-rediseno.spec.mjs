/* APUNTAR, REDISEÑO APROBADO (auditoría de diseño 15/11, bloque A). Se mide en el sitio donde se ve
 * —`getBoundingClientRect` y `elementFromPoint`, como `apuntar-teclado-visible`— en un móvil bajo
 * (360×640), en uno normal (390×844) y en el del dueño (412×915), con la letra por defecto y con la
 * Enorme (zoom 1,26 en el body: los rect llegan en px de pantalla).
 *
 *  DIS-02  El importe se veía a 34 px, menos que la cifra de Gastos que queda detrás: una regla
 *          posterior con la misma especificidad le pisaba el clamp. Y su alto no puede saltar al
 *          teclear la primera cifra (arreglo D1), ni cortarse un importe largo a 360. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ hasTouch: true, isMobile: true });

const TAMANOS = [[360, 640], [390, 844], [412, 915]];
const LETRAS = ["normal", "huge"];

async function abreApuntar(page, { w, h, letra }) {
  await page.setViewportSize({ width: w, height: h });
  await seedLoggedInDashboard(page, { settings: { autoPrices: false, theme: "green", budgetCycle: true, textSize: letra } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator(".botnav-fab").click();
  const hoja = page.locator(".v4-exp-sheet");
  await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
  // Fin de la entrada de la hoja (sheetup, 420 ms): a mitad todo está aún más abajo.
  await page.waitForTimeout(600);
  return hoja;
}

for (const [w, h] of TAMANOS) for (const letra of LETRAS) {
  test.describe(`${w}×${h}, letra ${letra}`, () => {
    test("DIS-02: el importe va grande, no salta al teclear y un importe largo no se corta", async ({ page }) => {
      const hoja = await abreApuntar(page, { w, h, letra });
      const importe = hoja.locator(".v4-ficha-amount");
      const mide = () => importe.evaluate((el) => ({
        // En px de pantalla: con la letra Enorme el body lleva zoom y el CSS se encoge para caber.
        px: parseFloat(getComputedStyle(el).fontSize) * (parseFloat(getComputedStyle(document.body).zoom) || 1),
        alto: el.getBoundingClientRect().height,
        cabe: el.scrollWidth <= el.clientWidth + 1,
      }));
      const vacio = await mide();
      // El clamp de la ficha (40-56 px, 13vw): unos 47 px a 360 y 51 a 390; la cifra de Gastos, 46.
      expect(vacio.px).toBeGreaterThanOrEqual(46);
      for (const k of ["1", "2", "5"]) await hoja.getByRole("button", { name: k, exact: true }).click();
      await expect(importe).toHaveText("125");
      const lleno = await mide();
      expect(Math.abs(lleno.alto - vacio.alto)).toBeLessThan(0.5);
      // El más largo que deja escribir el teclado: siete cifras con decimales.
      for (let i = 0; i < 3; i++) await hoja.getByRole("button", { name: "Borrar", exact: true }).click();
      for (const k of ["1", "2", "3", "4", "5", ",", "6", "7"]) await hoja.getByRole("button", { name: k, exact: true }).click();
      await expect(importe).toHaveText("12345,67");
      expect((await mide()).cabe).toBe(true);
    });
  });
}
