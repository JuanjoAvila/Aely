import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* MIS BANCOS POR DENTRO (D1, 19/11/2026; maquetas `dentro-v2` con el filtro de diseño).
 *
 * Lo que se blinda es lo que se ve: la lista con el logo en baldosa de 44 px y el anillo solo
 * cuando hay que hacer algo; el saldo del caducado atenuado y no escondido; fechas en relativo en
 * el idioma de la app (antes salía «11/18/2026, 10:00:00 AM»); la ficha en hoja con «Renovar» o
 * «Actualizar» y «Quitar» aparte, que pregunta qué hacer con los movimientos; y la hoja Conectar con
 * ✓ en lo conectado y sin chips de brókers. Va en e2e porque es render puro (AGENTS §7).
 */
const hace = (h) => new Date(Date.now() - h * 3600000).toISOString();
const en = (d) => new Date(Date.now() + d * 86400000).toISOString();
const LINKS = [
  { aspsp_name: "Banco de Sabadell", aspsp_country: "ES", iban: "ES11", status: "active", valid_until: en(60), last_sync: hace(1), accounts: [{ uid: "a1" }] },
  { aspsp_name: "CaixaBank", aspsp_country: "ES", iban: "ES22", status: "expired", valid_until: en(-2), last_sync: hace(50), accounts: [{ uid: "a2" }] },
  { aspsp_name: "Revolut", aspsp_country: "ES", iban: "ES33", status: "active", valid_until: en(5), last_sync: hace(2), accounts: [{ uid: "a3" }, { uid: "a4" }] },
];
const ASPSPS = ["Banco de Sabadell", "CaixaBank", "Revolut", "BBVA", "ING"].map((name) => ({ name, country: "ES" }));
const OB = [
  { key: "a1", ent: "sabadell", aspsp: "Banco de Sabadell", name: "Cuenta", value: 2184.3, cur: "EUR" },
  { key: "a2", ent: "caixabank", aspsp: "CaixaBank", name: "Cuenta", value: 1208.44, cur: "EUR" },
];

async function abre(page, extra = {}) {
  await seedLoggedInDashboard(page, Object.assign({
    __cloudRows: { bank_links: LINKS }, __cloudFns: { "bank-aspsps": { data: { ok: true, aspsps: ASPSPS }, error: null } },
    hasBankLink: true, obAccounts: OB, accounts: [],
    investments: [{ id: "i1", ent: "trade_republic", name: "Fondo e2e", isin: "IE00E2E", shares: 1, value: 90, cost: 80, cur: "EUR" }],
    settings: { autoPrices: false, theme: "green", brokersOn: ["trade_republic"] },
  }, extra));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  const push = page.locator(".v4-banks-push");
  await expect(push).toHaveClass(/open/, { timeout: 10_000 });
  return push;
}
const fila = (push, n) => push.locator(`.bk-row[data-aspsp="${n}"]`);

test("la lista: baldosa de 44, anillo solo si hay que actuar, saldo del caducado y fechas en relativo", async ({ page }) => {
  const push = await abre(page);
  await expect(push.locator(".bk-row[data-aspsp]")).toHaveCount(3);
  // Logo real en baldosa de 44 px.
  const lado = await fila(push, "Banco de Sabadell").locator(".bk-slot .mono").evaluate((el) => el.getBoundingClientRect().width);
  expect(Math.round(lado)).toBe(44);
  // Anillo: caducado punteado, caduca pronto en arco; al día, nada.
  await expect(fila(push, "CaixaBank").locator(".bk-slot.bad svg")).toHaveCount(1);
  await expect(fila(push, "Revolut").locator(".bk-slot.warn svg")).toHaveCount(1);
  await expect(fila(push, "Banco de Sabadell").locator(".bk-slot svg")).toHaveCount(0);
  // El caducado no esconde su saldo: atenuado, con su estado y «Renovar» en la fila.
  const cx = fila(push, "CaixaBank");
  await expect(cx.locator(".bk-am")).toHaveText(/1\.208,44\s*€/);
  await expect(cx.locator(".bk-am")).toHaveClass(/fade/);
  await expect(cx.locator(".bk-mt")).toHaveText(/^Permiso caducado\s·\s(ayer|hace \d+ (h|días))$/);
  await expect(cx.getByRole("button", { name: "Renovar" })).toBeVisible();
  // Fechas en relativo y en español: ni «AM», ni segundos, ni barras de fecha.
  await expect(fila(push, "Banco de Sabadell").locator(".bk-mt")).toHaveText("hace 1 h");
  await expect(fila(push, "Revolut").locator(".bk-mt")).toContainText("caduca en 5 días");
  await expect(fila(push, "Revolut").locator(".bk-mt")).toContainText("2 cuentas");
  await expect(fila(push, "Revolut").locator(".bk-am")).toHaveText("—");
  await expect(push).not.toContainText(/AM|PM|\d{1,2}\/\d{1,2}\/\d{4}|:\d{2}:\d{2}/);
  await expect(push.locator(".bk-upd")).toHaveText(/^hace 1 h$/);
  // Sin chips de brókers: los brókers entran por Conectar.
  await expect(push.locator(".v4-chip")).toHaveCount(0);
  /* Inversiones con las MISMAS filas (pasada 3 del filtro, bloqueante 1): nada de la tarjeta de la
     243 con monograma «TR» y franja negra; su conexión va en la ficha, no en la lista. */
  const tr = push.locator('[data-bk-list="inv"] .bk-row[data-broker="trade_republic"]');
  await expect(tr).toHaveCount(1);
  expect(Math.round(await tr.locator(".bk-slot .mono").evaluate((el) => el.getBoundingClientRect().width))).toBe(44);
  await expect(tr.locator(".bk-nm")).toHaveText("Trade Republic");
  await expect(tr.locator(".bk-am")).toHaveText(/90,00\s*€/);
  await expect(tr.locator(".bk-mt")).toHaveText(/^Sin conectar\s·\s1 posición$/);
  await expect(push.locator(".bk-flow, .bk-card, .bk-brand, .bk-logo")).toHaveCount(0);
  await tr.locator(".bk-nm").click();
  const ficha = page.locator('.bk-ficha[data-bk-ficha="trade_republic"]');
  await expect(ficha.locator(".bk-fh h2")).toHaveText("Trade Republic");
  await expect(ficha.locator(".bk-chip")).toHaveText("● Sin conectar");
  await expect(ficha.locator('[data-broker-flow="trade_republic"]')).toBeVisible();
});

test("Conectar: el ✓ de un bróker sale de su conexión real, no de tenerlo en la lista", async ({ page }) => {
  // TR en la lista pero sin sesión en el móvil y MyInvestor sin fila en la nube: ningún ✓.
  let push = await abre(page, { settings: { autoPrices: false, theme: "green", brokersOn: ["trade_republic", "myinvestor"] } });
  await push.locator('[data-act="bk-conectar"]').click();
  await expect(page.locator('.bk-pick [data-bk-tile="trade_republic"]')).toBeVisible();
  await expect(page.locator('.bk-pick [data-bk-tile="trade_republic"] .bk-tile-ok')).toHaveCount(0);
  await expect(page.locator('.bk-pick [data-bk-tile="myinvestor"] .bk-tile-ok')).toHaveCount(0);

  // Con la sesión de TR viva en el puente y MyInvestor activo en la nube: ✓ en los dos, y la fila
  // dice lo mismo que la baldosa.
  const p2 = await page.context().newPage();
  await page.close();
  await p2.addInitScript(() => { window.MiCarteraTR = { status: async () => ({ connected: true }) }; });
  push = await abre(p2, {
    __cloudRows: { bank_links: LINKS, myinvestor_links: [{ status: "active", last_sync: hace(3) }] },
    settings: { autoPrices: false, theme: "green", brokersOn: ["trade_republic", "myinvestor"] },
  });
  await expect(push.locator('.bk-row[data-broker="trade_republic"] .bk-mt')).not.toContainText("Sin conectar");
  await expect(push.locator('.bk-row[data-broker="myinvestor"] .bk-mt')).not.toContainText("Sin conectar");
  await push.locator('[data-act="bk-conectar"]').click();
  await expect(p2.locator('.bk-pick [data-bk-tile="trade_republic"] .bk-tile-ok')).toHaveCount(1);
  await expect(p2.locator('.bk-pick [data-bk-tile="myinvestor"] .bk-tile-ok')).toHaveCount(1);
});

test("con letra Enorme a 360, ningún trozo del subtítulo se parte («Permiso / caducado»)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const push = await abre(page, { settings: { autoPrices: false, theme: "green", textSize: "huge", brokersOn: ["trade_republic"] } });
  await expect(page.locator("html")).toHaveClass(/hugetext/);
  await expect(push.locator(".bk-row")).toHaveCount(4);
  const partidos = await push.locator(".bk-mt .mc-pt, .bk-mt .bad, .bk-mt .warn, .bk-mt .nw").evaluateAll((els) =>
    els.filter((e) => e.getClientRects().length > 1).map((e) => e.textContent));
  expect(partidos).toEqual([]);
  // Y lo que no cabe salta entero al renglón siguiente sin salirse de la fila.
  const fuera = await push.locator(".bk-mt").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.innerText));
  expect(fuera).toEqual([]);
});

test("la ficha en hoja: «Renovar permiso» si caducó, «Actualizar» si no, y «Quitar» pregunta qué hacer con los movimientos", async ({ page }) => {
  const push = await abre(page);
  await fila(push, "CaixaBank").locator(".bk-nm").click();
  const ficha = page.locator('.bk-ficha[data-bk-ficha="CaixaBank"]');
  await expect(ficha).toBeVisible();
  await expect(ficha.locator(".bk-fh h2")).toHaveText("CaixaBank");
  await expect(ficha.locator(".bk-chip.bad")).toHaveText("● Caducado");
  await expect(ficha.locator(".bk-life-l")).toHaveText(/^caducó (ayer|hace \d+ días)$/);
  await expect(ficha.locator('[data-act="bk-renovar"]')).toHaveText("Renovar permiso");
  await expect(ficha.locator(".bk-last")).toHaveText(/^Último saldo 1\.208,44\s*€ · (ayer|hace \d+ (h|días))$/);
  // El título deja aire hasta la ✕.
  const aire = await ficha.evaluate((f) => {
    const h = f.querySelector(".bk-fh h2"), x = f.querySelector(".bk-x"), r = document.createRange();
    r.selectNodeContents(h); return x.getBoundingClientRect().left - Math.max(...[...r.getClientRects()].map((q) => q.right));
  });
  expect(aire).toBeGreaterThanOrEqual(12);
  // Quitar: askChoice en hoja inferior con las dos opciones; cancelar no quita nada.
  // El logo lleva la misma baldosa que en la lista (en claro quedaba suelto sobre la hoja).
  expect(await ficha.locator(".bk-fh .mono").evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("1px");
  await ficha.locator('[data-act="bk-quitar"]').click();
  await expect(page.locator(".ask-opt")).toHaveCount(2);
  await expect(page.locator(".ask-opt").first()).toContainText("Que sigan contando");
  // Textos cortos (boceto 2c): una línea por opción, sin la entradilla de cuatro renglones.
  await expect(page.locator(".ask-opt").first()).toContainText("Solo se corta la conexión.");
  await expect(page.locator(".ask-opt").last()).toContainText("Salen del gasto del mes, también de los meses pasados.");
  await page.keyboard.press("Escape").catch(() => {});
  await page.goBack();
  await expect(page.locator(".ask-opt")).toHaveCount(0);
  await expect(fila(push, "CaixaBank")).toHaveCount(1);

  // Un banco al día: «Actualizar» en vez de renovar, y «caduca en N días».
  await fila(push, "Banco de Sabadell").locator(".bk-nm").click();
  const sab = page.locator('.bk-ficha[data-bk-ficha="Banco de Sabadell"]');
  await expect(sab.locator(".bk-chip")).toHaveText("● Al día");
  // Sin «↻ Actualizar todos» dentro de un solo banco: actualizar es el ↻ de la cabecera.
  await expect(sab.locator('[data-act="bk-actualizar"]')).toHaveCount(0);
  await expect(sab).not.toContainText("todos");
  await expect(sab.locator('[data-act="bk-renovar"]')).toHaveCount(0);
  await expect(sab.locator(".bk-life-l")).toHaveText(/^caduca en (59|60) días$/);
  // Atrás baja la hoja antes que la pantalla.
  await page.goBack();
  await expect(sab).toHaveCount(0);
  await expect(push).toHaveClass(/open/);
});

test("la hoja Conectar: logos sin teclado, ✓ en lo conectado, «Otro banco» abre el buscador y los brókers entran por aquí", async ({ page }) => {
  const push = await abre(page, { settings: { autoPrices: false, theme: "green", brokersOn: [] } });
  await expect(push.locator('[data-broker]')).toHaveCount(0);
  await push.locator('[data-act="bk-conectar"]').click();
  const hoja = page.locator(".bk-pick");
  await expect(hoja).toBeVisible();
  expect(await page.evaluate(() => document.activeElement && document.activeElement.tagName)).not.toBe("INPUT");
  for (const e of ["sabadell", "caixabank", "revolut"]) await expect(hoja.locator(`[data-bk-tile="${e}"] .bk-tile-ok`)).toHaveCount(1);
  await expect(hoja.locator('[data-bk-tile="myinvestor"] .bk-tile-ok')).toHaveCount(0);
  // Sin brókers por fichero: DEGIRO no sale; IBKR sí, pero es la conexión por API (último test).
  await expect(hoja.locator('[data-bk-tile="degiro"]')).toHaveCount(0);
  // Otro banco: el buscador con la lista entera, sin repetir lo que ya está conectado.
  await hoja.locator('[data-bk-tile="otro"]').click();
  await expect(hoja.locator("input")).toBeVisible();
  await expect(hoja.locator(".bk-pick-row")).toHaveCount(2);
  expect(await hoja.locator(".bk-pick-row .nm").allTextContents()).toEqual(["BBVA", "ING"]);
  await hoja.locator("input").fill("bbv");
  await expect(hoja.locator(".bk-pick-row")).toHaveCount(1);
  // Atrás desde «Otro banco» vuelve a las baldosas; el segundo atrás cierra Conectar.
  await page.goBack();
  await expect(hoja.locator('[data-bk-grid="bancos"]')).toBeVisible();
  await expect(hoja.locator("input")).toHaveCount(0);
  await page.goBack();
  await expect(hoja).toHaveCount(0);
  // Un bróker desde Conectar: se abre su ficha con la conexión y queda como fila en Inversiones.
  await push.locator('[data-act="bk-conectar"]').click();
  await page.locator('.bk-pick [data-bk-tile="myinvestor"]').click();
  await expect(page.locator(".bk-pick")).toHaveCount(0);
  await expect(page.locator('.bk-ficha[data-bk-ficha="myinvestor"] [data-broker-flow="myinvestor"]')).toBeVisible();
  await expect(push.locator('.bk-row[data-broker="myinvestor"]')).toHaveCount(1);
});

test("«Otro banco» crece deslizando, sin salto, y su lista llega hasta el borde de la hoja", async ({ page }) => {
  const push = await abre(page);
  await push.locator('[data-act="bk-conectar"]').click();
  const hoja = page.locator(".bk-pick");
  await expect(hoja.locator('[data-bk-tile="otro"]')).toBeVisible();
  await page.waitForTimeout(600);   // que acabe de subir la hoja
  const altos = await page.evaluate(() => new Promise((ok) => {
    const el = document.querySelector(".bk-pick"), hs = [el.offsetHeight];
    el.querySelector('[data-bk-tile="otro"]').click();
    const t0 = performance.now();
    const paso = () => { hs.push(el.offsetHeight); if (performance.now() - t0 < 700) requestAnimationFrame(paso); else ok(hs); };
    requestAnimationFrame(paso);
  }));
  const h0 = altos[0], h1 = altos[altos.length - 1];
  expect(h1 - h0).toBeGreaterThan(100);
  // Pasa por varios altos intermedios (antes saltaba de golpe al final en un fotograma).
  const medios = new Set(altos.filter((h) => h > h0 + 2 && h < h1 - 2));
  expect(medios.size).toBeGreaterThanOrEqual(4);
  // Nunca encoge ni se pasa por el camino.
  for (let i = 1; i < altos.length; i++) expect(altos[i]).toBeGreaterThanOrEqual(altos[i - 1] - 1);
  // El scroll acaba en el borde de la hoja (antes dejaba 66 px vacíos y cortaba una fila en seco).
  const hueco = await hoja.evaluate((s) => s.getBoundingClientRect().bottom - s.querySelector(".v4-sheet-body").getBoundingClientRect().bottom);
  expect(Math.abs(hueco)).toBeLessThanOrEqual(1);
});

test("sin bancos: «Aún no hay nada conectado» y un botón que abre Conectar", async ({ page }) => {
  const push = await abre(page, { __cloudRows: { bank_links: [] }, hasBankLink: false, obAccounts: [], settings: { autoPrices: false, theme: "green", brokersOn: [] } });
  await expect(push.locator(".bk-vacio")).toContainText("Aún no hay nada conectado");
  await expect(push.locator(".bk-upd")).toHaveCount(0);
  await push.locator(".bk-vacio .btn").click();
  await expect(page.locator(".bk-pick")).toBeVisible();
});

/* IBKR y Kraken por API (4.26.246) se unen a Conectar en la 4.26.247: la baldosa lanza
   `mc-open-broker-api` y `BrokerApiSection` (06) abre la hoja de alta de verdad. Antes de juntar
   las dos rondas nadie atendía ese evento y la baldosa cerraba Conectar sin hacer nada. */
test("Conectar: las baldosas de IBKR y Kraken abren su hoja de alta", async ({ page }) => {
  await page.addInitScript(() => {
    window.__brokerApi = [];
    window.addEventListener("mc-open-broker-api", (e) => window.__brokerApi.push(e.detail && e.detail.ent));
  });
  const push = await abre(page);
  await push.locator('[data-act="bk-conectar"]').click();
  await expect(page.locator('.bk-pick [data-bk-grid="inv"] .bk-tile')).toHaveCount(4);
  await page.locator('.bk-pick [data-bk-tile="kraken"]').click();
  await expect(page.locator(".bk-pick")).toHaveCount(0);
  expect(await page.evaluate(() => window.__brokerApi)).toEqual(["kraken"]);
  const sheet = page.locator('[data-broker-api-sheet="kraken"]');
  await expect(sheet).toBeVisible();
  // Cerrarla y volver a tocar la baldosa la reabre (cada toque es una petición nueva).
  await sheet.locator(".bx-x").click();
  await expect(sheet).toHaveCount(0);
  await push.locator('[data-act="bk-conectar"]').click();
  await page.locator('.bk-pick [data-bk-tile="kraken"]').click();
  await expect(page.locator('[data-broker-api-sheet="kraken"]')).toBeVisible();
  // Y sin ficheros: la tarjeta que queda es la de conectar, no la de importar.
  await expect(push.locator('[data-broker-api="kraken"]')).toHaveCount(1);
  await expect(push.locator('[data-broker-file]')).toHaveCount(0);
});
