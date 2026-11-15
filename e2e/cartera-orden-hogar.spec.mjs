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
  await perfil.locator(".profile-row").filter({ hasText: /Hogar y gastos compartidos/i }).click();

  // Y no es solo el botón: la pantalla de Hogar tiene que aparecer.
  await expect(page.getByText(/🏠 Hogar y gastos compartidos/)).toBeVisible({ timeout: 5_000 });
});

test("Cartera se puede reordenar y el orden se guarda en el estado", async ({ page }) => {
  await abrirApp(page);
  await irACartera(page);

  const pantalla = page.locator(".v4-screen");
  const titulos = pantalla.locator(".v4-sec-h");
  await expect(titulos.first()).toContainText("Tus cuentas");

  const ordenar = pantalla.locator(".v4-sec-order");
  // Botón fantasma de 44 px como mínimo, no texto suelto (DIS-32, auditoría de diseño 233).
  expect((await ordenar.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await pantalla.getByRole("button", { name: /Ordenar secciones/i }).click();
  // Una sola marca al ordenar: `done` ya trae «✓» y el botón le ponía otra delante (DIS-36).
  await expect(ordenar).toHaveText("Listo ✓");
  // En modo orden, cada bloque enseña su etiqueta y sus flechas. Bienes va APARTE de las cuentas
  // (feedback 2026-07-25: «¿por qué has metido bienes junto con mis cuentas?»).
  const bloques = pantalla.locator(".wedit");
  await expect(bloques).toHaveCount(3);
  await expect(bloques.nth(0).locator(".wedit-lbl")).toContainText("Tus cuentas");
  await expect(bloques.nth(1).locator(".wedit-lbl")).toContainText("Bienes");
  await expect(bloques.nth(2).locator(".wedit-lbl")).toContainText("inversiones");

  await bloques.first().locator(".wedit-btns button").nth(1).click();   // ↓
  await expect(pantalla.locator(".wedit .wedit-lbl").first()).toContainText("Bienes");

  /* Y sobrevive a cerrar la app: el orden vive en settings.secOrder, que se guarda y sincroniza
     como todo lo demás. Se busca por TODAS las claves porque desde la 4.8.0 el estado se guarda
     partido, y clavar aquí el nombre de una clave sería atarse a un detalle de almacenamiento. */
  await page.waitForTimeout(700);   // el guardado va con debounce (400 ms)
  const guardado = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      try {
        const o = JSON.parse(localStorage.getItem(localStorage.key(i)));
        const v = o && o.settings && o.settings.secOrder && o.settings.secOrder.cartera;
        if (v) return v;
      } catch (e) { /* claves que no son JSON */ }
    }
    return null;
  });
  expect(guardado).toEqual(["bienes", "cuentas", "inversiones"]);
});
