import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Interactive Brokers por fichero (plan de brókers, fase 1 — 18/11/2026).
 *
 * Flex Query en XML → bloque IBKR en Cartera. Y lo que más importa: re-importar con una posición
 * VENDIDA no la borra; se marca «ya no está en el fichero» y borrarla sigue siendo cosa del
 * usuario. Sin esto vuelven los «cadáveres» y las resurrecciones de Revolut y Trade Republic.
 *
 * Fichero SINTÉTICO (tests/fixtures/brokers/ibkr-flex.xml, forma pública de la doc de Flex,
 * cifras inventadas): no hay ficheros reales y los de un usuario no se commitean (AGENTS §9).
 */
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "brokers");
const XML = fs.readFileSync(path.join(dir, "ibkr-flex.xml"), "utf8");
const xml = (txt) => ({ name: "flex.xml", mimeType: "text/xml", buffer: Buffer.from(txt) });

async function abrirTarjeta(page, overrides) {
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  const card = page.locator('[data-broker-file="ibkr"]');
  await expect(card).toHaveCount(1, { timeout: 10_000 });   // ya usa IBKR: su chip viene marcado solo
  await card.locator(".bk-brand").click();
  return card;
}

test("Flex XML → vista previa y bloque IBKR; el derivado no entra y se avisa", async ({ page }) => {
  await seedLoggedInDashboard(page, { __seedOnce: true, investments: [] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await page.locator(".v4-chip").filter({ hasText: /^Interactive Brokers$/ }).click();
  const card = page.locator('[data-broker-file="ibkr"]');
  await card.locator(".bk-brand").click();
  await card.locator('input[type="file"]').setInputFiles([xml(XML)]);
  await expect(card.locator("[data-bf-row]")).toHaveCount(3);
  await expect(card.getByText("Derivados: 1, no se importan")).toBeVisible();
  // En $: coste en su moneda y el porqué de que no esté anclado en €.
  await expect(card.locator('[data-bf-row="US0378331005"]')).toContainText("al cambio de hoy");
  await card.locator('[data-act="bf-create-all"]').click();
  await card.getByRole("button", { name: /Aplicar a 3/ }).click();
  await expect(card.getByText(/3 posiciones re-ancladas/)).toBeVisible();

  await page.waitForFunction(() => (localStorage.getItem("micartera_v3") || "").indexOf("csv:ibkr") >= 0);
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: /Ver todas tus inversiones/i }).click();
  const bloque = page.locator('[data-inv-screen] [data-inv-broker="ibkr"]');
  await expect(bloque).toBeVisible();
  await expect(bloque).toContainText("Interactive Brokers");
  await expect(bloque).toContainText("3 posiciones");
});

test("re-importar con una posición vendida NO la borra: la marca", async ({ page }) => {
  const base = { ent: "ibkr", src: "csv:ibkr", fileAt: "2024-11-15" };
  const card = await abrirTarjeta(page, { investments: [
    Object.assign({ id: "aapl", name: "APPLE INC", isin: "US0378331005", fileSym: "AAPL", shares: 10, value: 2282.2, cost: 1500, cur: "USD" }, base),
    Object.assign({ id: "vwce", name: "VANGUARD FTSE ALL-WORLD", isin: "IE00BK5BQT80", fileSym: "VWCE", shares: 20, value: 2402, cost: 2000, costEur: 2000, cur: "EUR" }, base),
    Object.assign({ id: "pg", name: "PROCTER & GAMBLE CO", isin: "US7427181091", fileSym: "PG", shares: 30, value: 1365, cost: 1200, cur: "GBP" }, base),
    // Una de Trade Republic con el mismo ISIN: tiene su propia sincronización y no se ofrece aquí.
    { id: "tr1", ent: "trade_republic", name: "Apple TR", isin: "US0378331005", ticker: "AAPL", shares: 2, value: 400, cost: 300, cur: "USD" },
  ] });
  const sinPG = XML.replace(/<OpenPosition [^>]*symbol="PG"[^>]*\/>\r?\n/, "");
  await card.locator('input[type="file"]').setInputFiles([xml(sinPG)]);
  await expect(card.locator("[data-bf-row]")).toHaveCount(2);
  // Las dos que siguen se casan solas por ISIN; la vendida sale aparte, marcada de serie.
  await expect(card.locator('[data-bf-row="US0378331005"] select')).toHaveValue("aapl");
  const gone = card.locator('[data-bf-gone="pg"]');
  await expect(gone).toContainText("PROCTER & GAMBLE CO");
  await expect(gone.locator("select")).toHaveValue("mark");
  await expect(card.locator('option[value="tr1"]')).toHaveCount(0);
  // La opción elegida cabe en su selector a 360 px, sin que la flecha pise el texto (filtro de diseño
  // 18/11: «VANGUARD FTSE ALL-WORLD · Interactive Bro▾»). Del mismo bróker, sin repetir su nombre.
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(card.locator('[data-bf-row="IE00BK5BQT80"] select option:checked')).toHaveText("VANGUARD FTSE ALL-WORLD");
  const cabe = await card.locator("select.bf-sel").evaluateAll((els) => els.map((el) => {
    const cs = getComputedStyle(el), ctx = document.createElement("canvas").getContext("2d");
    ctx.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    const libre = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { ok: ctx.measureText(el.selectedOptions[0].text).width <= libre, flecha: parseFloat(cs.paddingRight) >= 30, corta: cs.textOverflow };
  }));
  expect(cabe).toEqual(cabe.map(() => ({ ok: true, flecha: true, corta: "ellipsis" })));
  await card.getByRole("button", { name: /Aplicar a 3/ }).click();

  await page.waitForFunction(() => (localStorage.getItem("micartera_v3") || "").indexOf("fileGone") >= 0);
  const inv = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).investments);
  expect(inv).toHaveLength(4);
  expect(inv.find((i) => i.id === "tr1")).toMatchObject({ ent: "trade_republic", shares: 2 });
  expect(inv.find((i) => i.id === "pg")).toMatchObject({ shares: 30, value: 1365 });
  expect(inv.find((i) => i.id === "pg").fileGone).toBeTruthy();
  expect(inv.find((i) => i.id === "aapl").fileGone).toBeUndefined();

  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: /Ver todas tus inversiones/i }).click();
  const bloque = page.locator('[data-inv-screen] [data-inv-broker="ibkr"]');
  // Lo vendido NO suma: el total del bloque es solo Apple + Vanguard, y se dice por qué.
  await expect(bloque.locator("[data-inv-gone]")).toHaveText("1 fuera del total: ya no están en el fichero");
  const usd = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("micartera_v3")); return (s.fxRates && s.fxRates.USD) || s.fx; });
  const total = Math.round(+(2282.2 * usd).toFixed(2) + 2402);
  await expect(bloque.locator(".am")).toHaveText(new RegExp("^" + String(total).replace(/(\d)(?=(\d{3})$)/, "$1[.\\s]?") + "\\s*€$"));
  await bloque.locator("button").first().click();
  await expect(bloque.locator('[data-inv-position="pg"] .rsub')).toHaveText(/^ya no está · \d{2} \S+$/);
});
