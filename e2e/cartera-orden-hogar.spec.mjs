import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Cartera ordenable + Hogar mudado al perfil (petición 2026-07-25).
 *
 * El usuario: «poder ordenar las cosas de la tab de cartera, y lo de hogar y gastos compartidos
 * se debería mover a otro lugar… ahí abajo del todo de Cartera no». Hogar se va al perfil (que va
 * de ti y de los tuyos, y está a un toque desde el avatar) y Cartera estrena el «⇅ Ordenar
 * secciones» que ya tenían las otras pestañas.
 *
 * Va con e2e por AGENTS §7: mover una pantalla de sitio es el caso exacto en el que se quedan
 * huérfanas las puertas de entrada (pasó en el rediseño v4 con el rol de cuenta, Hogar, la huella
 * y el cerrar sesión). Lo que hay que blindar no es que el botón esté: es que SE LLEGA.
 */

const INVERSIONES = [
  { id: "i1", ent: "trade_republic", name: "VWCE", ticker: "VWCE", shares: 10, cost: 1000, value: 1200 },
];

async function abrirApp(page) {
  await seedLoggedInDashboard(page, {
    investments: INVERSIONES,
    assets: [{ id: "a1", kind: "coche", name: "Coche", value: 9000 }],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
}

async function irACartera(page) {
  await page.locator(".botnav-tab").filter({ hasText: "Cartera" }).click();
  await expect(page.getByText("Tus cuentas")).toBeVisible({ timeout: 10_000 });
}

test("Hogar ya no cuelga del final de Cartera", async ({ page }) => {
  await abrirApp(page);
  await irACartera(page);
  await expect(page.locator(".v4-screen").getByText(/Hogar y gastos compartidos/i)).toHaveCount(0);
});

test("se llega a Hogar desde el perfil, y se abre de verdad", async ({ page }) => {
  await abrirApp(page);
  await page.locator(".v4-avatar").click();
  const perfil = page.locator(".profile-pull");
  await expect(perfil).toHaveClass(/open/, { timeout: 5_000 });

  // Arriba del todo: el panel mide ~1.700 px y lo de abajo no lo ve nadie.
  await expect(perfil.getByText("Tu gente")).toBeVisible();
  // Desde 240 la fila es una sola línea, «Hogar compartido» (antes decía Hogar dos veces).
  await perfil.locator(".profile-row").filter({ hasText: /Hogar compartido/i }).click();

  // Y no es solo el botón: la pantalla de Hogar tiene que aparecer.
  await expect(page.getByText(/🏠 Hogar y gastos compartidos/)).toBeVisible({ timeout: 5_000 });
});

/* «⇅ Ordenar secciones» se quitó (16/11/2026, petición suya). Lo que hay que blindar ahora es
   que el orden que ya tuviera guardado se siga respetando: quitar el botón no debe recolocarle la
   pantalla. */
test("Cartera sin «Ordenar secciones» y respetando el orden que ya estaba guardado", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    investments: INVERSIONES,
    assets: [{ id: "a1", kind: "coche", name: "Coche", value: 9000 }],
    settings: { secOrder: { cartera: ["inversiones", "bienes", "cuentas"] } },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await irACartera(page);

  const pantalla = page.locator(".v4-screen").filter({ has: page.locator('[data-cartera-sec="inversiones"]') });
  await expect(pantalla.getByRole("button", { name: /Ordenar secciones/i })).toHaveCount(0);
  await expect(pantalla.locator(".v4-sec-order")).toHaveCount(0);
  const titulos = pantalla.locator(".v4-section-h > span:first-child");
  await expect(titulos).toHaveText([/inversiones/, /Bienes/, /Tus cuentas/]);
});
