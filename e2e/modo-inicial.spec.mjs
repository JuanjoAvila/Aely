import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* MODO INICIAL — la app como recién instalada, sin vaciarse la cartera de verdad.
 *
 * Petición suya del 9/9, y es una petición con razón: el banco de pruebas COPIA la cartera real,
 * así que no había forma de mirar las pantallas vacías del pulido v4 (hero sin gráfico, tarjetas
 * de presupuesto/recibos/metas, racha a cero). Con sus palabras: «si no, te marcaré el 50% de las
 * pruebas que no puedo reproducirlo».
 *
 * Lo que este test protege es lo único que da miedo aquí: que vaciar las pruebas NO toque la
 * cartera real. Se comprueba leyendo las dos claves de localStorage por separado.
 */
async function ajustes(page, estado) {
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".set-card").first()).toBeVisible({ timeout: 10_000 });
}

test("★ la cartera REAL no se toca al sembrar la vacía", async ({ page }) => {
  await ajustes(page, { budget: 777, accounts: [{ id: "a1", ent: "sabadell", name: "Banco", value: 4321 }] });

  const antes = await page.evaluate(() => localStorage.getItem("micartera_v3"));
  await page.evaluate(() => mcSeedSandboxVacio());
  const despues = await page.evaluate(() => localStorage.getItem("micartera_v3"));
  expect(despues).toBe(antes);

  // Y la de pruebas queda como recién instalada: sin datos y sin presupuesto.
  const pruebas = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_sandbox") || "null"));
  expect(pruebas.budget).toBe(0);
  expect(pruebas.accounts).toEqual([]);
  expect(pruebas.expenses).toEqual([]);
  // `onboarded` va a true a propósito: con el onboarding delante te obliga a poner presupuesto,
  // y entonces la tarjeta vacía de presupuesto no se puede ver nunca.
  expect(pruebas.onboarded).toBe(true);
});

/* La FILA de Ajustes no se cubre aquí a propósito: ese bloque solo lo ve el dueño
 * (`profiles.is_admin`, «solamente para mí» fue la petición), y el usuario de los e2e no es admin,
 * así que el panel ni la pinta. Comprobado: con el usuario de pruebas, «Banco de pruebas» tampoco
 * aparece. Lo que sí se cubre arriba es lo único que da miedo de verdad: que vaciar las pruebas no
 * roce la cartera real. */
