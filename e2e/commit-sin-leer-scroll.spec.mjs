import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* R-07 (ronda E2). Tras CADA commit de App se leía `scrollTop` de las cuatro páginas para decidir
   una clase (`mc-touch-own`) que no se llegaba a poner nunca: la condición miraba una pestaña
   «inicio» y la pestaña se llama «dash». Cada lectura forzaba una maquetación; en el arranque
   eran tres, 155 ms con la CPU frenada (traza de la ronda D). Se quitó entero. Esto vigila que
   re-renderizar App no vuelva a leer el scroll de las páginas. */
test("re-renderizar App no lee el scroll de ninguna página", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.addInitScript(() => {
    const d = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
    window.__lecturas = 0;
    Object.defineProperty(Element.prototype, "scrollTop", { configurable: true,
      get() { if (this.classList && this.classList.contains("page")) window.__lecturas++; return d.get.call(this); },
      set(v) { d.set.call(this, v); } });
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.waitForTimeout(1500);   // que se asiente el arranque
  await page.evaluate(() => { window.__lecturas = 0; });
  // Abrir la hoja de Apuntar re-renderiza App sin tocar el scroll.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-apuntar")));
  await expect(page.locator(".v4-keys")).toBeVisible();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__lecturas)).toBe(0);
});
