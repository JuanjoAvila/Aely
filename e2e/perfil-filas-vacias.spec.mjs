/* INC-2709-10 (27/9): «casillas vacías gigantes» en el perfil.
 *
 * El modificador de fila vacía se llamaba `empty` a secas y heredaba la regla GLOBAL de estado
 * vacío (`.empty{text-align:center;padding:34px 20px}`): cada «Añadir» medía 127 px contra los
 * ~58 de una fila rellena, y el perfil vacío 1.787 px frente a 1.107 relleno (medido 30/9, 393×800).
 *
 * Se mide lo que se ve: con un solo campo relleno (teléfono), cada fila vacía debe medir como la
 * rellena, «Añadir» alineado a la izquierda y el toque seguir abriendo su diálogo (sin guardar). */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const TELEFONO = "600 000 000";   // ficticio

for (const lang of ["es", "en", "ca"]) for (const textSize of ["normal", "big", "huge"]) {
  test(`Perfil: las filas vacías miden como las rellenas (${lang}, ${textSize})`, async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 800 });
    await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000, expenses: [],
      settings: { autoPrices: false, lang, textSize, profile: { phone: TELEFONO } } });
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
    await dismissNews(page);
    await page.locator(".v4-avatar").click();
    const panel = page.locator(".profile-pull");
    await expect(panel).toHaveClass(/open/, { timeout: 5_000 });

    const m = await panel.evaluate((el, TELEFONO) => {
      const filas = [...el.querySelectorAll(".profile-row")].filter((r) => r.querySelector(".pr-edit")?.textContent === "✎");
      // Por CONTENIDO y no por clase: la clase es justo lo que cambia, y el rojo sobre main tiene que
      // fallar por la altura, no por no encontrar las filas.
      const llenas = filas.filter((r) => r.textContent.includes(TELEFONO));
      const vacias = filas.filter((r) => !r.textContent.includes(TELEFONO));
      // offsetHeight y no getBoundingClientRect: el panel se abre escalando desde el avatar y a mitad
      // de animación el rect mide la miniatura.
      const h = (r) => r.offsetHeight;
      return {
        vacias: vacias.map(h), llenas: llenas.map(h),
        alineado: vacias.map((r) => getComputedStyle(r.querySelector(".pr-val")).textAlign),
      };
    }, TELEFONO);
    expect(m.llenas.length).toBe(1);
    expect(m.vacias.length).toBeGreaterThanOrEqual(9);
    const ref = Math.max(...m.llenas);
    for (const h of m.vacias) {
      expect(h).toBeLessThanOrEqual(ref + 4);
      expect(h).toBeGreaterThanOrEqual(44);
    }
    for (const a of m.alineado) expect(["left", "start"]).toContain(a);

    // El toque sigue siendo el de siempre: abre el diálogo del campo; se cancela sin guardar.
    await panel.locator(".profile-row", { hasText: lang === "es" ? "Añadir" : lang === "en" ? "Add" : "Afegeix" }).first().click();
    await expect(page.locator(".ask-in").first()).toBeVisible({ timeout: 3_000 });
  });
}
