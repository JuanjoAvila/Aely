import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* MIS BANCOS · remates D2: separadores, ficha MyInvestor, descripción TR en Conectar y monogramas
   en «Otro banco». Render puro en el DOM (AGENTS §7). */
const hace = (h) => new Date(Date.now() - h * 3600000).toISOString();
const en = (d) => new Date(Date.now() + d * 86400000).toISOString();
const LINKS = [
  { aspsp_name: "Banco de Sabadell", aspsp_country: "ES", iban: "ES11", status: "active", valid_until: en(60), last_sync: hace(1), accounts: [{ uid: "a1" }] },
  { aspsp_name: "CaixaBank", aspsp_country: "ES", iban: "ES22", status: "expired", valid_until: en(-2), last_sync: hace(50), accounts: [{ uid: "a2" }] },
  {
    aspsp_name: "Revolut", aspsp_country: "ES", iban: "ES33", status: "active", valid_until: en(5), last_sync: hace(2),
    accounts: [{ uid: "a3" }, { uid: "a4" }, { uid: "a5" }],
  },
];
const ASPSPS = [
  { name: "Banco de Sabadell", country: "ES" },
  { name: "CaixaBank", country: "ES" },
  { name: "Revolut", country: "ES" },
  { name: "BBVA", country: "ES" },
  { name: "ING", country: "ES" },
  { name: "Ålandsbanken", country: "FI" },
  { name: "ÍÑigo Crédito", country: "ES" },
  { name: "Caja Rural de Asturias", country: "ES" },
  { name: "Trade Republic", country: "DE" },
];

async function abre(page, extra = {}) {
  await page.setViewportSize({ width: 360, height: 800 });
  await seedLoggedInDashboard(page, Object.assign({
    __cloudRows: { bank_links: LINKS, myinvestor_links: [{ status: "active", last_sync: hace(2) }] },
    __cloudFns: { "bank-aspsps": { data: { ok: true, aspsps: ASPSPS }, error: null } },
    hasBankLink: true, obAccounts: [],
    investments: [{ id: "i1", ent: "myinvestor", name: "Fondo e2e", isin: "IE00E2E", shares: 1, value: 40, cost: 30, cur: "EUR" }],
    settings: { autoPrices: false, theme: "green", textSize: "huge", brokersOn: ["trade_republic", "myinvestor"] },
  }, extra));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  const push = page.locator(".v4-banks-push");
  await expect(push).toHaveClass(/open/, { timeout: 10_000 });
  await expect(page.locator("html")).toHaveClass(/hugetext/);
  return push;
}

/** Renglones de `.bk-mt` que empiezan (tras espacios) por «·». */
async function puntosHuerfanos(page) {
  return page.locator(".bk-mt, .bk-last").evaluateAll((els) => {
    const bad = [];
    for (const el of els) {
      for (const line of (el.innerText || "").split("\n")) {
        if (/^\s*·/.test(line)) bad.push(line.trim());
      }
    }
    return bad;
  });
}

test("con letra Enorme a 360 ningún renglón del subtítulo empieza por «·»", async ({ page }) => {
  const push = await abre(page);
  await expect(push.locator(".bk-row")).toHaveCount(5);
  expect(await puntosHuerfanos(page)).toEqual([]);
  await push.locator('.bk-row[data-broker="trade_republic"]').click();
  await page.goBack();
  expect(await puntosHuerfanos(page)).toEqual([]);
  await push.locator('[data-aspsp="CaixaBank"]').click();
  const ficha = page.locator('.bk-ficha[data-bk-ficha="CaixaBank"]');
  await expect(ficha.locator(".bk-last")).toBeVisible();
  expect(await puntosHuerfanos(page)).toEqual([]);
});

test("MyInvestor conectado: «Quitar» y sin textos de estado repetidos", async ({ page }) => {
  const push = await abre(page);
  await push.locator('.bk-row[data-broker="myinvestor"]').click();
  const ficha = page.locator('.bk-ficha[data-bk-ficha="myinvestor"]');
  await expect(ficha).toBeVisible();
  await expect(ficha.locator(".bk-chip")).toHaveText("● Al día");
  await expect(ficha.locator('[data-act="bk-br-quitar"]')).toHaveText(/Quitar MyInvestor/);
  await expect(ficha).not.toContainText("MyInvestor conectado");
  await expect(ficha.locator(".hint")).toHaveCount(0);
});

test("Trade Republic en «Otro banco»: descripción corta en una sola línea", async ({ page }) => {
  const push = await abre(page, { __cloudRows: { bank_links: [] }, hasBankLink: false, settings: { autoPrices: false, theme: "green", textSize: "huge", brokersOn: [] } });
  await push.locator('[data-act="bk-conectar"]').click();
  await page.locator('[data-bk-tile="otro"]').click();
  const tr = page.locator('.bk-pick-row:has(.nm:text("Trade Republic"))');
  await expect(tr).toBeVisible();
  const meta = tr.locator(".meta");
  await expect(meta).toHaveText("Solo movimientos con tarjeta");
  const partido = await meta.evaluate((el) => el.getClientRects().length > 1);
  expect(partido, "la descripción no debe partirse en dos renglones").toBe(false);
});

test("«Otro banco»: monograma real y nunca «··»", async ({ page }) => {
  const push = await abre(page, { __cloudRows: { bank_links: [] }, hasBankLink: false });
  await push.locator('[data-act="bk-conectar"]').click();
  await page.locator('[data-bk-tile="otro"]').click();
  const monos = await page.locator(".bk-pick-row .mono").evaluateAll((els) => els.map((e) => {
    const t = (e.textContent || "").trim();
    if (t) return t;
    return e.querySelector("img") ? "__logo__" : t;
  }));
  expect(monos.length).toBeGreaterThan(3);
  const letras = monos.filter((m) => m !== "__logo__");
  expect(letras.every((m) => m && m !== "··")).toBe(true);
  expect(monos).toContain("ÅLAN");
  expect(monos).toContain("ÍC");
  expect(letras).toContain("CR");
});