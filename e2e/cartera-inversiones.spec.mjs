import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// Test de regresión (bug real, v4.7.1 2026-07-23): al quitar la UI de ordenar brókers, el orden
// fijo se dejó como `groups=groupsBase.map(g=>g[0])` — convierte las ternas [id,nombre,subtítulo]
// en strings sueltos. Aguas abajo se lee g[0]/g[1], así que g[0] pasaba a ser la PRIMERA LETRA
// ("revolut"[0]==="r"), el filtro por i.ent no casaba nada y los tres bloques de brókers
// desaparecían de Cartera → Inversiones sin que ningún test se enterara (build y unitarios
// pasaban igual: el bug solo existe en lo que se PINTA, no en la sintaxis ni en la lógica pura).
const investments = [
  { id: "i1", ent: "revolut", name: "Apple", shares: 5, value: 900, cost: 700, cur: "USD" },
  { id: "i2", ent: "trade_republic", name: "MSCI World", shares: 10, value: 1500, cost: 1200, cur: "EUR" },
  { id: "i3", ent: "myinvestor", name: "Indexado SP500", shares: 3, value: 2000, cost: 1800, cur: "EUR" },
];

test("Cartera › Inversiones: los tres brókers se pintan, en orden, con sus importes", async ({ page }) => {
  await seedLoggedInDashboard(page, { investments });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  /* ⚠ ACOTADO A LA TARJETA DE INVERSIONES (11/9/2026). Antes esto era `.v4-card-list
     button.v4-mov` a secas, y el día que las filas de CUENTAS pasaron de `div` a `button` —para
     poder tocarlas y abrir su ficha— este test empezó a contarlas también: pedía 3 brókers y
     encontraba 4. Es el agujero de siempre: un selector sin acotar mide la página entera, no la
     tarjeta. Ver [[e2e-getbytext-pestanas-premontadas]]. */
  const listaInv = page.locator(".v4-card-list").filter({ hasText: /posiciones|positions|posicions/ }).first();
  const blocks = listaInv.locator("button.v4-mov");
  await expect(blocks).toHaveCount(3);

  // Orden fijo: Revolut → Trade Republic → MyInvestor (groupsBase, 06-sync-brokers.js).
  await expect(blocks.nth(0)).toContainText("Revolut");
  await expect(blocks.nth(1)).toContainText("Trade Republic");
  await expect(blocks.nth(2)).toContainText("MyInvestor");
});

test("Cartera › Inversiones: bróker sin posiciones no deja bloque fantasma", async ({ page }) => {
  await seedLoggedInDashboard(page, { investments: investments.filter((i) => i.ent !== "myinvestor") });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  /* ⚠ ACOTADO A LA TARJETA DE INVERSIONES (11/9/2026). Antes esto era `.v4-card-list
     button.v4-mov` a secas, y el día que las filas de CUENTAS pasaron de `div` a `button` —para
     poder tocarlas y abrir su ficha— este test empezó a contarlas también: pedía 3 brókers y
     encontraba 4. Es el agujero de siempre: un selector sin acotar mide la página entera, no la
     tarjeta. Ver [[e2e-getbytext-pestanas-premontadas]]. */
  const listaInv = page.locator(".v4-card-list").filter({ hasText: /posiciones|positions|posicions/ }).first();
  const blocks = listaInv.locator("button.v4-mov");
  await expect(blocks).toHaveCount(2);
  await expect(blocks.filter({ hasText: "MyInvestor" })).toHaveCount(0);
});

test("Herramientas de inversión: ya no hay UI de ordenar brókers (retirada en 4.7.1)", async ({ page }) => {
  await seedLoggedInDashboard(page, { investments });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByText(/Herramientas de inversión|Investment tools/i).click();
  await expect(page.getByText(/Precios, redondeo, proyecci/i)).toBeVisible();

  await expect(page.getByText(/Orden de los brókers|Broker order/i)).toHaveCount(0);
  await expect(page.locator(".wedit-bar")).toHaveCount(0);
});
