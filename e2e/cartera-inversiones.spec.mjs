import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// Test de regresión (bug real, v4.7.1 2026-07-23): al quitar la UI de ordenar brókers, el orden
// fijo se dejó como `groups=groupsBase.map(g=>g[0])` — convierte las ternas [id,nombre,subtítulo]
// en strings sueltos. Aguas abajo se lee g[0]/g[1], así que g[0] pasaba a ser la PRIMERA LETRA
// ("revolut"[0]==="r"), el filtro por i.ent no casaba nada y los tres bloques de brókers
// desaparecían de Cartera → Inversiones sin que ningún test se enterara (build y unitarios
// pasaban igual: el bug solo existe en lo que se PINTA, no en la sintaxis ni en la lógica pura).
const investments = [
  { id: "i1", ent: "revolut", name: "Apple", ticker: "AAPL", shares: 5, value: 900, cost: 700, cur: "USD" },
  { id: "i2", ent: "trade_republic", name: "MSCI World", ticker: "IWDA", shares: 10, value: 1500, cost: 1200, cur: "EUR" },
  { id: "i3", ent: "myinvestor", name: "Indexado SP500", shares: 3, value: 2000, cost: 1800, cur: "EUR" },
];

async function openInvestments(page) {
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const door = page.getByRole("button", { name: /Ver todas tus inversiones|See all your investments|Veure totes les inversions/i });
  await door.click();
  await expect(page.locator("[data-inv-screen]")).toBeVisible();
  return door;
}

test("Cartera › Inversiones: los tres brókers se pintan, en orden, con sus importes", async ({ page }) => {
  await seedLoggedInDashboard(page, { investments, accounts: [{ id: "daily", ent: "trade_republic", name: "Trade Republic", value: 1000, spendFrom: true }] });
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
  // El redondeo/Saveback no pertenecía al sheet que se retira: sigue en Cartera y operativo.
  await expect(page.getByText(/Round-up & Saveback \(TR\)/).first()).toBeVisible();
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

test("Inversiones v4: abre como pantalla hija, conserva el cálculo y devuelve el foco", async ({ page }) => {
  const one = [{ id: "euro", ent: "trade_republic", name: "Fondo prueba", ticker: "TEST", shares: 10, value: 1500, cost: 1200, cur: "EUR" }];
  await seedLoggedInDashboard(page, { investments: one, lastPriceSync: Date.now() });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  const door = await openInvestments(page);
  const screen = page.locator("[data-inv-screen]");
  await expect(screen).toHaveAttribute("role", "dialog");
  await expect(screen).toHaveAttribute("aria-modal", "true");
  await expect(screen.locator("h1")).toBeFocused();
  // Desde el título, Shift+Tab va al último control de la hija; el Tab siguiente vuelve al
  // botón Atrás. El foco nunca cae en la navegación que queda cubierta por el portal.
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.querySelector("[data-inv-screen]").contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Tab");
  await expect(screen.locator('[data-act="back"]')).toBeFocused();
  await expect(page.locator("[data-inv-hero]")).toContainText(/1[.,]?500/);
  await expect(page.locator("[data-inv-hero]")).toContainText(/Pusiste 1[.,]?200|You put in 1[,]?200|Hi vas posar 1[.]?200/i);
  await expect(page.locator("[data-inv-hero]")).toContainText(/Han ganado 300|They gained 300|Han guanyat 300/i);
  await expect(page.locator("[data-inv-type]")).toBeVisible();
  await expect(page.locator(".v4-embed-legacy")).toHaveCount(0);

  await page.locator('[data-inv-screen] [data-act="back"]').click();
  await expect(page.locator("[data-inv-screen]")).toHaveCount(0);
  await expect(door).toBeFocused();
});

test("Inversiones v4: coste cero no finge +0%, manual se identifica y solo edita su bróker", async ({ page }) => {
  const rows = [
    { id: "manual", ent: "trade_republic", name: "Fondo manual", shares: 2, value: 500, cost: 0, cur: "EUR" },
    { id: "other", ent: "revolut", name: "Otra posición", ticker: "OTHER", shares: 1, value: 100, cost: 0, cur: "EUR" },
  ];
  await seedLoggedInDashboard(page, { investments: rows });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await openInvestments(page);

  await expect(page.locator("[data-inv-hero]")).not.toContainText("+0.00%");
  await expect(page.locator("[data-inv-hero]")).toContainText(/Dime lo que pusiste|Tell me what you put in|Digues-me què hi vas posar/i);
  const tr = page.locator('[data-inv-broker="trade_republic"]');
  const revolut = page.locator('[data-inv-broker="revolut"]');
  const trHead = tr.locator("button.v4-mov");
  await expect(trHead).toHaveAttribute("aria-expanded", "false");
  await trHead.click();
  await expect(trHead).toHaveAttribute("aria-expanded", "true");
  await expect(tr.locator('[data-inv-position="manual"]')).toContainText(/a mano|by hand|a mà/i);
  await expect(tr.locator('[data-inv-position="manual"]')).not.toContainText("· —");
  await tr.locator('[data-act="inv-edit"]').click();
  await expect(tr.locator("input")).toHaveCount(2);
  await revolut.locator("button.v4-mov").click();
  await expect(revolut.locator("input")).toHaveCount(0);
  await tr.locator("input").first().fill("501");
  await tr.getByRole("button", { name: /Guardar|Save|Desa/i }).click();
  await expect(tr.locator('[data-inv-position="manual"] .rsub')).toContainText(/a mano · \d|by hand · \d|a mà · \d/i);
});

test("Inversiones v4: Ask conserva su foco y Escape no cierra la pantalla hija", async ({ page }) => {
  await seedLoggedInDashboard(page, { investments: [
    { id: "ask-row", ent: "trade_republic", name: "Posición para borrar", value: 500, cost: 400, cur: "EUR" },
  ] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await openInvestments(page);

  const broker=page.locator('[data-inv-broker="trade_republic"]');
  await broker.locator("button.v4-mov").click();
  await broker.locator('[data-act="inv-edit"]').click();
  await broker.getByRole("button",{name:/Borrar|Delete|Esborra/i}).click();
  const ask=page.locator(".askback [role=dialog]");
  await expect(ask).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.querySelector(".askback [role=dialog]")?.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.querySelector(".askback [role=dialog]").contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator(".askback")).toHaveCount(0);
  await expect(page.locator("[data-inv-screen]")).toBeVisible();
  await expect(broker).toBeVisible();
});

test("Inversiones v4: un coste parcial nunca se convierte en ganancia inventada", async ({ page }) => {
  const lastPriceSync=Date.now()-65_000;
  await seedLoggedInDashboard(page, { investments: [
    { id: "known", ent: "trade_republic", name: "Con dato", ticker: "KNOWN", shares: 1, value: 120, cost: 100, cur: "EUR" },
    { id: "unknown", ent: "revolut", name: "Sin dato", shares: 1, value: 500, cost: 0, cur: "EUR" },
  ], lastPriceSync });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await openInvestments(page);

  const hero=page.locator("[data-inv-hero]");
  await expect(hero).toContainText(/Ganancia —|Gain —|Guany —/);
  await expect(hero).toContainText(/Falta lo que pusiste|one or more positions is missing|Falta el que vas posar/i);
  await expect(hero).toContainText(/Actualizado \d{2}:\d{2}|Updated \d{2}:\d{2}|Actualitzat \d{2}:\d{2}/i);
  await expect(hero).not.toContainText(/Han ganado 520|They gained 520|Han guanyat 520/i);
  await expect(hero).not.toContainText(/520\.00%/);
});

test("Inversiones v4: alta desde bróker enfoca el nombre, conserva opciones reales y devuelve el foco", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    investments: [{ id: "custom", ent: "degiro", name: "Posición existente", value: 300, cost: 250, cur: "EUR" }],
    accounts: [{ id: "bank", ent: "sabadell", name: "Sabadell", value: 1000 }],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await openInvestments(page);

  const broker=page.locator('[data-inv-broker="degiro"]');
  await broker.locator("button.v4-mov").click();
  const trigger=broker.locator('[data-act="inv-add"]');
  await trigger.click();
  const add=page.locator("[data-inv-manual-add]");
  const name=add.locator('[data-field="inv-name"]');
  await expect(name).toBeFocused();
  const options=await add.locator("select option").evaluateAll((nodes) => nodes.map((n) => ({value:n.value,text:n.textContent})));
  expect(options.map((o) => o.value)).toEqual(["revolut","trade_republic","myinvestor","degiro"]);
  expect(options.some((o) => /Sabadell/i.test(o.text))).toBe(false);
  await add.getByRole("button",{name:/Cancelar|Cancel|Cancel·la/i}).click();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(name).toBeFocused();
  await name.fill("Segunda posición");
  await add.locator('[data-field="inv-value"]').fill("42");
  await add.getByRole("button",{name:/Guardar|Save|Desa/i}).click();
  await expect(trigger).toBeFocused();
  await expect(broker.getByText("Segunda posición")).toBeVisible();
});

test("Inversiones v4: vacío accionable", async ({ page }) => {
  await seedLoggedInDashboard(page, { investments: [] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await openInvestments(page);

  await expect(page.locator(".v4-empty[data-inv-empty]")).toBeVisible();
  await page.locator('.v4-empty [data-act="inv-add"]').click();
  const add=page.locator("[data-inv-manual-add]");
  await expect(add).toBeVisible();
  await expect(page.locator("[data-inv-screen]")).toBeVisible();
  await add.locator('[data-field="inv-name"]').fill("Fondo de prueba");
  await add.locator('[data-field="inv-value"]').fill("1250,50");
  await add.locator('[data-field="inv-cost"]').fill("1000");
  await add.getByRole("button",{name:/Guardar|Save|Desa/i}).click();
  const broker=page.locator('[data-inv-broker="trade_republic"]');
  await expect(broker).toBeVisible();
  await expect(broker.locator("button.v4-mov")).toHaveAttribute("aria-expanded","true");
  await expect(broker.getByText("Fondo de prueba")).toBeVisible();
  await expect(broker.getByText(/a mano · \d|by hand · \d|a mà · \d/i)).toBeVisible();
});

test("Inversiones v4: actualizar precios confirma la hora real", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    investments: [{ id: "live", ent: "trade_republic", name: "ETF", ticker: "TEST", shares: 2, value: 100, cost: 80, cur: "EUR" }],
    lastPriceSync: Date.now()-60_000,
    __cloudFns: { prices: { data: { prices: { TEST: 160 } }, error: null } },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await openInvestments(page);
  await page.locator('[data-act="inv-refresh"]').click();
  await expect(page.locator(".toast")).toContainText(/Precios actualizados · \d{2}:\d{2}|Prices updated · \d{2}:\d{2}|Preus actualitzats · \d{2}:\d{2}/i);
  await expect(page.locator("[data-inv-hero]")).toContainText("320");
});

test("Inversiones v4: datos viejos siguen visibles y un fallo conserva los datos con reintento", async ({ page }) => {
  const old = Date.now() - 72 * 60 * 60 * 1000;
  await seedLoggedInDashboard(page, {
    investments: [{ id: "stale", ent: "trade_republic", name: "ETF", ticker: "ETF", shares: 2, value: 500, cost: 400, cur: "EUR" }],
    lastPriceSync: old,
    __cloudFns: { prices: { data: null, error: { message: "sin red" } } },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await openInvestments(page);

  await expect(page.locator("[data-inv-hero] .chip")).toContainText(/datos del|data from|dades del/i);
  await expect(page.locator("[data-inv-hero]")).toContainText("500");
  await page.locator('[data-act="inv-refresh"]').click();
  const alert = page.locator('[data-inv-screen] [role="alert"]');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/Conservamos|still here|Conservem/i);
  await expect(alert.getByRole("button", { name: /Reintentar|Try again|Torna-ho a provar/i })).toBeVisible();
  await expect(page.locator("[data-inv-hero]")).toContainText("500");
});

test("Inversiones v4: reducir movimiento evita animaciones y el total no espera un count-up", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedLoggedInDashboard(page, { investments: [{ id: "rm", ent: "trade_republic", name: "ETF", value: 1234, cost: 1000, cur: "EUR" }] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await openInvestments(page);

  await expect(page.locator("[data-inv-hero]")).toContainText(/1[.,]?234/);
  const motion = await page.evaluate(() => ({
    push: getComputedStyle(document.querySelector("[data-inv-screen]")).transitionDuration,
    hero: getComputedStyle(document.querySelector("[data-inv-hero]")).animationName,
    bar: getComputedStyle(document.querySelector("[data-inv-hero] .v4-stackbar i")).animationName,
  }));
  expect(motion.push).toBe("0s");
  expect(motion.hero).toBe("none");
  expect(motion.bar).toBe("none");
});

test("Inversiones v4: Reducir animaciones de Aely también evita el count-up y el spinner", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    investments: [{ id: "rm-app", ent: "trade_republic", name: "ETF", value: 1234, cost: 1000, cur: "EUR" }],
    settings: { reduceMotion: true, theme: "green" },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await openInvestments(page);

  await expect(page.locator("[data-inv-hero]")).toContainText(/1[.,]?234/);
  await page.evaluate(() => {
    const spin=document.createElement("span"); spin.className="spin"; spin.dataset.rmProbe="1";
    document.querySelector("[data-inv-screen]").appendChild(spin);
  });
  await expect(page.locator('[data-rm-probe="1"]')).toHaveCSS("display","none");
});

test("Ajustes › Dinero conserva actualización automática y proyección", async ({ page }) => {
  await seedLoggedInDashboard(page, { investments, settings: { autoPrices: false, theme: "green" } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  const settings = page.locator(".settings-push.open");
  await expect(settings).toBeVisible();
  await settings.locator("button.set-row").filter({ hasText: /Dinero|Money/i }).first().click();

  const automatic = settings.locator("button.set-row").filter({ hasText: /Actualizar precios USD al abrir|Update USD prices on app open|Actualitza preus USD/i });
  await expect(automatic).toBeVisible();
  await automatic.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).settings.autoPrices)).toBe(true);

  const projection = settings.locator("button.set-row").filter({ hasText: /Proyección|Projection|Projecció/i });
  await expect(projection).toBeVisible();
  await projection.click();
  await expect(settings.locator("[data-inv-settings-projection]")).toBeVisible();
  await expect(settings.locator("[data-inv-settings-projection] input[type=range]")).toBeVisible();
});

test("Inversiones v4: apertura medida con CPU x6", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "El freno de CPU usa CDP");
  const largeExpenses=Array.from({length:5000},(_,i)=>({
    id:"perf-exp-"+i,date:"2026-09-"+String(1+(i%16)).padStart(2,"0")+"T12:00:00.000Z",
    merchant:"Compra "+i,amount:1+(i%40),category:"otros",source:"manual",
  }));
  await seedLoggedInDashboard(page, { investments, expenses:largeExpenses,
    accounts:[{id:"daily",ent:"trade_republic",name:"Trade Republic",value:1000,spendFrom:true}] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  const samples = [];
  try {
    for (let i = 0; i < 5; i += 1) {
      samples.push(await page.evaluate(() => new Promise((resolve, reject) => {
        const start = performance.now();
        const door = [...document.querySelectorAll("button")].find((b) => /Ver todas tus inversiones|See all your investments|Veure totes les inversions/i.test(b.textContent || ""));
        if (!door) return reject(new Error("puerta de inversiones no encontrada"));
        door.click();
        let frames = 0;
        const tick = () => {
          if (document.querySelector("[data-inv-screen]")) return requestAnimationFrame(() => resolve(performance.now() - start));
          if (++frames > 120) return reject(new Error("la hija de inversiones no abrió"));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      })));
      await page.evaluate(() => new Promise((resolve, reject) => {
        document.querySelector('[data-inv-screen] [data-act="back"]').click();
        let frames = 0;
        const tick = () => {
          if (!document.querySelector("[data-inv-screen]")) return requestAnimationFrame(resolve);
          if (++frames > 120) return reject(new Error("la hija de inversiones no cerró"));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }));
    }
  } finally {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
  const ordered = samples.slice().sort((a, b) => a - b);
  const median = ordered[Math.floor(ordered.length / 2)];
  console.log(`INV_OPEN_CPU_X6 median=${median.toFixed(1)}ms samples=${samples.map((x) => x.toFixed(1)).join(",")}`);
  expect(median).toBeLessThan(600);
});
