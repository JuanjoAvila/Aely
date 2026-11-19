import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Brókers por CONEXIÓN: IBKR (Flex) y Kraken (solo lectura) — 19/11/2026.
 *
 * El dueño: nada de ficheros, «que nadie tenga que entrar en la app del bróker». Lo que se blinda
 * aquí, abriendo la pantalla de verdad con el backend simulado (`__cloudFns`):
 *   1. Alta de Kraken en su hoja → primera lectura en vista previa → la posición entra en Cartera.
 *   2. Una clave que puede mover dinero se rechaza con su texto y no toca nada.
 *   3. IBKR ya revisado: al abrir la app re-ancla lo que casa y PROPONE lo nuevo sin crearlo.
 * Datos SINTÉTICOS: el XML es el fixture de la 243 y Kraken va inventado (AGENTS §9).
 */
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "brokers");
const XML = fs.readFileSync(path.join(dir, "ibkr-flex.xml"), "utf8");
const KRAKEN_SYNC = { ok: true, broker: "kraken", asOf: "2026-11-19", snapshot: true,
  positions: [{ key: "BTC", isin: null, sym: "BTC", exch: null, name: "BTC", shares: 0.25, cur: "EUR", valueHint: 15000, price: 60000, cost: null, costEur: null, costWhy: "api_nocost", kind: "crypto" }],
  present: [], cash: [{ cur: "EUR", amt: 12.5 }], warnings: [{ k: "staked", name: "BTC" }] };

async function abrirBancos(page, overrides) {
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(page.locator(".bk-sec")).toBeVisible({ timeout: 10_000 });
}

test("Kraken: conectar en la hoja → vista previa → la posición entra en Cartera, sin coste inventado", async ({ page }) => {
  await abrirBancos(page, { investments: [], settings: { brokersOn: ["kraken"] }, __cloudRows: { broker_links: [] },
    __cloudFns: { "broker-connect": { data: { ok: true, connected: true, broker: "kraken", sync: KRAKEN_SYNC }, error: null } } });
  const card = page.locator('[data-broker-api="kraken"]');
  await expect(card).toHaveCount(1);
  // Sin conectar, la tarjeta es logo, nombre y «Conectar»: sin subtítulo que repita el botón.
  await expect(card.locator(".meta")).toHaveCount(0);
  await card.locator('[data-act="bx-open"]').click();
  const sheet = page.locator('[data-broker-api-sheet="kraken"]');
  await expect(sheet).toBeVisible();
  // Pasos plegados en una línea; al abrirlos, lo que hay que marcar en Kraken.
  await expect(sheet.locator(".bx-steps")).toHaveCount(0);
  await sheet.locator('[data-act="bx-steps"]').click();
  await expect(sheet.locator('[data-act="bx-steps"]')).toHaveAttribute("aria-expanded", "true");
  await expect(sheet.locator(".bx-steps")).toContainText("Consultar fondos");
  await expect(sheet.locator('[data-bx="a"]')).toHaveAttribute("placeholder", "Pega aquí");
  const connect = sheet.locator('[data-act="bx-connect"]');
  await expect(connect).toBeDisabled();
  await sheet.locator('[data-bx="a"]').fill("SINTETICAPUBLICKEY000000");
  await sheet.locator('[data-bx="b"]').fill("c2ludGV0aWNhLXNlY3JldGE=");
  // Lo que el servidor contestará después de guardar: la fila ya activa.
  await page.evaluate(() => { window.__e2eCloudRows.broker_links = [{ broker: "kraken", status: "active", last_sync: new Date().toISOString(), last_code: null, meta: {} }]; });
  await connect.click();
  await expect(sheet).toHaveCount(0);
  const body = await page.evaluate(() => (window.__e2eInvokes || []).filter((x) => x.name === "broker-connect").map((x) => x.body));
  expect(body).toEqual([{ broker: "kraken", a: "SINTETICAPUBLICKEY000000", b: "c2ludGV0aWNhLXNlY3JldGE=" }]);

  // Primera lectura: vista previa, con «—» de coste y su porqué; nada aplicado aún.
  const row = card.locator('[data-bf-row="BTC"]');
  await expect(row).toBeVisible();
  // Cripto en su unidad, sin «participaciones» ni un «—» suelto; el porqué del coste, en su línea.
  await expect(row).toContainText("0,25 BTC");
  await expect(row).not.toContainText("particip");
  await expect(row.locator(".rval")).toHaveCount(0);
  await expect(row).toContainText("el bróker no lo da");
  await expect(card).toContainText("incluye lo que tienes en staking");
  expect(await page.evaluate(() => (localStorage.getItem("micartera_v3") || "").indexOf("api:kraken"))).toBe(-1);
  // Cartera vacía: no hay nada que pisar, así que «crear» viene puesto y Aplicar no se queda en 0.
  await expect(row.locator("select")).toHaveValue("__new");
  await card.getByRole("button", { name: /Aplicar a 1/ }).click();
  await expect(card).toContainText("Kraken al día");
  await page.waitForFunction(() => (localStorage.getItem("micartera_v3") || "").indexOf("api:kraken") >= 0);
  const inv = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).investments);
  expect(inv.map((i) => [i.ent, i.src, i.fileSym, i.shares, i.value, i.cost])).toEqual([["kraken", "api:kraken", "BTC", 0.25, 15000, null]]);
  // Ya conectada: Actualizar y Desconectar, no el alta.
  await expect(card.locator('[data-act="bx-sync"]')).toBeVisible();
  await expect(card.locator('[data-act="bx-open"]')).toHaveCount(0);
});

test("Kraken: una clave que puede retirar se rechaza con su texto y no guarda nada", async ({ page }) => {
  await abrirBancos(page, { investments: [], settings: { brokersOn: ["kraken"] }, __cloudRows: { broker_links: [] },
    __cloudFns: { "broker-connect": { data: { ok: false, rejected: true, code: "kraken_perm", perm: "withdraw-funds" }, error: null } } });
  const card = page.locator('[data-broker-api="kraken"]');
  await card.locator('[data-act="bx-open"]').click();
  const sheet = page.locator('[data-broker-api-sheet="kraken"]');
  await sheet.locator('[data-bx="a"]').fill("SINTETICAPUBLICKEY000000");
  await sheet.locator('[data-bx="b"]').fill("c2ludGV0aWNhLXNlY3JldGE=");
  await sheet.locator('[data-act="bx-connect"]').click();
  await expect(sheet.locator(".alarmbox")).toContainText("puede operar o retirar dinero");
  await expect(card.locator("[data-bf-row]")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).investments.length)).toBe(0);
});

test("IBKR ya revisado: al abrir re-ancla lo que casa y PROPONE lo nuevo sin crearlo", async ({ page }) => {
  await seedLoggedInDashboard(page, { __seedOnce: true,
    investments: [{ id: "vwce", ent: "ibkr", src: "api:ibkr", name: "VANGUARD FTSE ALL-WORLD", isin: "IE00BK5BQT80", fileSym: "VWCE", shares: 15, value: 1700, cost: 1500, costEur: 1500, cur: "EUR" }],
    settings: { brokersOn: ["ibkr"] },
    brokerApi: { ibkr: { known: ["IE00BK5BQT80"], pend: [], at: 0, asOf: "2024-11-14" } },
    __cloudRows: { broker_links: [{ broker: "ibkr", status: "active", last_sync: "2024-11-15T18:00:00Z", last_code: null, meta: { accounts: 1 } }] },
    __cloudFns: { "broker-sync": { data: { ok: true, broker: "ibkr", asOf: "2024-11-15", snapshot: true, flexXml: XML }, error: null } } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForFunction(() => {
    const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
    return s.brokerApi && s.brokerApi.ibkr && s.brokerApi.ibkr.pend && s.brokerApi.ibkr.pend.length === 2;
  }, null, { timeout: 15_000 });
  const inv = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).investments);
  expect(inv.length).toBe(1);
  expect([inv[0].shares, inv[0].value, inv[0].cost, inv[0].fileAt]).toEqual([20, 2402, 2000, "2024-11-15"]);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  const card = page.locator('[data-broker-api="ibkr"]');
  await expect(card).toContainText("2 posiciones nuevas en IBKR");
  await card.locator(".bx-card-h").click();
  await card.locator('[data-act="bx-review"]').click();
  await expect(card.locator("[data-bf-row]")).toHaveCount(2);
  await expect(card.locator('[data-bf-row="US0378331005"] select')).toHaveValue("");
});

test("hoja con letra Enorme a 360: los pasos abiertos desplazan el cuerpo y «Conectar» queda entero a la vista", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await abrirBancos(page, { investments: [], settings: { brokersOn: ["ibkr"], textSize: "huge" }, __cloudRows: { broker_links: [] } });
  await page.locator('[data-broker-api="ibkr"] [data-act="bx-open"]').click();
  const sheet = page.locator('[data-broker-api-sheet="ibkr"]');
  await sheet.locator('[data-act="bx-steps"]').click();
  await expect(sheet.locator(".bx-steps li")).toHaveCount(5);
  await expect(sheet.locator(".bx-head h2")).toHaveText("Conectar IBKR");
  await expect(sheet.locator("label.bx-field").nth(1)).toContainText("Query ID");
  await expect(sheet.locator(".bx-x")).toBeVisible();
  const vp = page.viewportSize();
  const btn = await sheet.locator('[data-act="bx-connect"]').boundingBox();
  expect(btn.y).toBeGreaterThanOrEqual(0);
  expect(btn.y + btn.height).toBeLessThanOrEqual(vp.height);
  await expect(sheet.locator(".bx-safe")).toBeVisible();
  // El cuerpo es el que desplaza: el último campo se alcanza sin mover el botón.
  await sheet.locator('[data-bx="b"]').scrollIntoViewIfNeeded();
  await expect(sheet.locator('[data-bx="b"]')).toBeInViewport();
  expect((await sheet.locator('[data-act="bx-connect"]').boundingBox()).y).toBeCloseTo(btn.y, 0);
  // La ✕ a la derecha del título, también en Enorme.
  const x = await sheet.locator(".bx-x").boundingBox(), h = await sheet.locator(".bx-head h2").boundingBox();
  expect(x.x).toBeGreaterThan(h.x + h.width - 1);
});

test("D7: el sync de MyInvestor con el mismo ISIN que IBKR solo toca la suya; la de IBKR no se mueve", async ({ page }) => {
  await seedLoggedInDashboard(page, { __seedOnce: true,
    investments: [
      { id: "ib", ent: "ibkr", src: "api:ibkr", name: "VWCE IBKR", isin: "IE00BK5BQT80", fileSym: "VWCE", shares: 10, value: 1250, cost: 1000, cur: "EUR" },
      { id: "mi", ent: "myinvestor", name: "VWCE MyInvestor", isin: "IE00BK5BQT80", shares: 2, value: 250, cost: 200, cur: "EUR" }],
    brokerApi: { ibkr: { known: ["IE00BK5BQT80"], links: { IE00BK5BQT80: "ib" }, pend: [], at: Date.now(), asOf: "2026-11-18" } },
    lastMiSync: 0,
    __cloudRows: { myinvestor_links: [{ status: "active" }], broker_links: [{ broker: "ibkr", status: "active" }] },
    __cloudFns: { "myinvestor-sync": { data: { ok: true, positions: [{ isin: "IE00BK5BQT80", name: "VWCE", shares: 4, value: 500, cost: 400 }] }, error: null } } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForFunction(() => {
    const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
    return (s.investments || []).some((i) => i.id === "mi" && i.shares === 4);
  }, null, { timeout: 15_000 });
  const inv = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).investments);
  const by = Object.fromEntries(inv.map((i) => [i.id, i]));
  expect([by.mi.shares, by.mi.value]).toEqual([4, 500]);
  expect([by.ib.shares, by.ib.value, by.ib.src]).toEqual([10, 1250, "api:ibkr"]);
});

test("R3: en la vista previa una posición no se puede elegir en dos filas", async ({ page }) => {
  const SYNC2 = Object.assign({}, KRAKEN_SYNC, { positions: KRAKEN_SYNC.positions.concat([{ key: "ETH", sym: "ETH", name: "ETH", shares: 2, cur: "EUR", valueHint: 6000, price: 3000, cost: null, costEur: null, costWhy: "api_nocost" }]) });
  await abrirBancos(page, { investments: [{ id: "m", ent: "kraken", name: "Cripto a mano", value: 100, cost: 80, cur: "EUR" }], settings: { brokersOn: ["kraken"] }, __cloudRows: { broker_links: [] },
    __cloudFns: { "broker-connect": { data: { ok: true, connected: true, broker: "kraken", sync: SYNC2 }, error: null } } });
  const card = page.locator('[data-broker-api="kraken"]');
  await card.locator('[data-act="bx-open"]').click();
  const sheet = page.locator('[data-broker-api-sheet="kraken"]');
  await sheet.locator('[data-bx="a"]').fill("SINTETICAPUBLICKEY000000");
  await sheet.locator('[data-bx="b"]').fill("c2ludGV0aWNhLXNlY3JldGE=");
  await sheet.locator('[data-act="bx-connect"]').click();
  await card.locator('[data-bf-row="BTC"] select').selectOption("m");
  await expect(card.locator('[data-bf-row="ETH"] option[value="m"]')).toBeDisabled();
  await expect(card.locator('[data-bf-row="BTC"] option[value="m"]')).toBeEnabled();
});
