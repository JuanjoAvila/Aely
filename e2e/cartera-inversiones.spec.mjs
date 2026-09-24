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
  { id: "i4", ent: "trade_republic", name: "Fondo en pérdida", shares: 4, value: 800, cost: 1000, cur: "EUR" },
  { id: "i5", ent: "trade_republic", name: "Sin valor actual", shares: 2, value: null, cost: 500, cur: "EUR" },
  { id: "i3", ent: "myinvestor", name: "Indexado SP500", shares: 3, value: 2000, cost: 1800, cur: "EUR" },
];

async function openInvestmentTools(page) {
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByText(/Herramientas de inversión|Investment tools|Eines d.inversió/i).click();
  await expect(page.locator('.v4-sheet [data-act="inv-refresh"]')).toBeVisible();
}

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
  // Sin entrar en otra pantalla, cada posición enseña beneficio en euros Y porcentaje.
  await blocks.nth(1).click();
  const trPos = listaInv.locator(".row").filter({hasText:"MSCI World"});
  await expect(trPos).toContainText(/\+300(?:[.,]00)?\s*€\s*·\s*\+25[.,]00%/);
  const lossPos = listaInv.locator(".row").filter({hasText:"Fondo en pérdida"});
  await expect(lossPos.locator(".rvsub.neg")).toContainText(/−200(?:[.,]00)?\s*€\s*·\s*−20[.,]00%/);
  await expect(listaInv.locator(".row").filter({hasText:"Sin valor actual"}).locator(".rvsub")).toHaveCount(0);
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

test("Herramientas de inversión: el botón resincroniza MyInvestor aunque no haya ticker", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    investments: [{ id:"mi", ent:"myinvestor", name:"Fondo indexado", isin:"IE00TEST", shares:2, value:100, cost:80, cur:"EUR" }],
    lastMiSync: Date.now(),
    __cloudRows: { myinvestor_links:[{ status:"active" }] },
    __cloudFns: {
      "myinvestor-sync": { data:{ ok:true, positions:[{ isin:"IE00TEST", name:"Fondo indexado", shares:2, value:250, cost:80 }] }, error:null },
    },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout:15_000 });
  await dismissNews(page);
  await openInvestmentTools(page);

  const refresh=page.locator('.v4-sheet [data-act="inv-refresh"]');
  await expect(refresh).toContainText(/Actualizar inversiones|Update investments|Actualitzar inversions/i);
  await refresh.click();
  await expect(page.locator(".toast")).toContainText(/Brókers al día|Brokers up to date|Brókers al dia/i);
  await expect(page.locator(".v4-sheet")).toContainText("250");
});

test("Herramientas de inversión: un bróker caducado no queda tapado por precios correctos", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    investments: [{ id:"mi-exp", ent:"myinvestor", name:"Fondo", ticker:"TEST", shares:2, value:100, cost:80, cur:"EUR" }],
    lastMiSync: Date.now(),
    lastPriceSync: Date.now()-60_000,
    __cloudRows: { myinvestor_links:[{ status:"active" }] },
    __cloudFns: {
      "myinvestor-sync": { data:{ ok:false, authExpired:true }, error:null },
      prices: { data:{ prices:{ TEST:160 } }, error:null },
    },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout:15_000 });
  await dismissNews(page);
  await openInvestmentTools(page);

  await page.locator('.v4-sheet [data-act="inv-refresh"]').click();
  const toast=page.locator(".toast");
  await expect(toast).toContainText("MyInvestor");
  await expect(toast).toContainText(/caducada|expired/i);
  await expect(toast).toContainText(/Precios actualizados|Prices updated|Preus actualitzats/i);
});

test("Herramientas de inversión: un bróker sin respuesta tampoco queda tapado por los precios", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    investments: [{ id:"mi-soft", ent:"myinvestor", name:"Fondo", ticker:"TEST", shares:2, value:100, cost:80, cur:"EUR" }],
    lastMiSync: Date.now(),
    lastPriceSync: Date.now()-60_000,
    __cloudRows: { myinvestor_links:[{ status:"active" }] },
    __cloudFns: {
      "myinvestor-sync": { data:{ ok:false }, error:null },
      prices: { data:{ prices:{ TEST:160 } }, error:null },
    },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout:15_000 });
  await dismissNews(page);
  await openInvestmentTools(page);

  await page.locator('.v4-sheet [data-act="inv-refresh"]').click();
  const toast=page.locator(".toast");
  await expect(toast).toContainText("MyInvestor");
  await expect(toast).toContainText(/no respondió|didn't answer|no ha respost/i);
  await expect(toast).toContainText(/Precios actualizados|Prices updated|Preus actualitzats/i);
});

test("Herramientas de inversión: sin conexión ni ticker no finge una actualización", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    investments:[{id:"manual",ent:"myinvestor",name:"Fondo manual",value:100,cost:80,cur:"EUR"}],
    __cloudRows:{myinvestor_links:[]},
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:15_000});
  await dismissNews(page);
  await openInvestmentTools(page);

  await page.locator('.v4-sheet [data-act="inv-refresh"]').click();
  await expect(page.locator(".toast")).toContainText(/Sin brókers conectados|No brokers connected|Sense bròkers connectats/i);
});
