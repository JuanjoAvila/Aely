import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Interactive Brokers: el lector del fichero sigue, la tarjeta de importar no (19/11/2026).
 *
 * Entró por fichero en la 4.26.243 y al día siguiente él lo descartó: los brókers nunca por
 * fichero, para que nadie tenga que entrar en la app del bróker. Se quita la tarjeta de «Mis
 * bancos»; el lector y el aplicar se quedan para la conexión automática. Lo que más importa sigue
 * blindado aquí: re-importar con una posición VENDIDA no la borra; se marca «ya no está» y
 * borrarla sigue siendo cosa del usuario. Sin esto vuelven los «cadáveres» y las resurrecciones
 * de Revolut y Trade Republic.
 *
 * Fichero SINTÉTICO (tests/fixtures/brokers/ibkr-flex.xml, forma pública de la doc de Flex,
 * cifras inventadas): no hay ficheros reales y los de un usuario no se commitean (AGENTS §9).
 */
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "brokers");
const XML = fs.readFileSync(path.join(dir, "ibkr-flex.xml"), "utf8");

async function arranca(page, overrides) {
  await seedLoggedInDashboard(page, overrides);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
}

/* Lo mismo que hacía la tarjeta con «Crear todas» + «Aplicar» (lo vendido, marcado de serie), sin
   la tarjeta: el lector, la pareja por ISIN y `brkApplyFile` del propio bundle. */
function aplica(page, ficheros, investments) {
  return page.evaluate(([ficheros, investments]) => {
    const r = brokerAnalyze("ibkr", ficheros, {});
    if (!r.acc) throw new Error("no se ha leído: " + r.err);
    const map = {};
    r.acc.positions.forEach((p) => { map[p.key] = brkSuggest(p, investments, "ibkr") || "__new"; });
    const gone = r.acc.snapshot ? brkGoneOf(investments, "ibkr", r.acc.positions, map, r.acc.present) : [];
    const marca = {}; gone.forEach((i) => { marca[i.id] = 1; });
    return { inv: brkApplyFile({ investments }, "ibkr", r.acc.positions, map, marca, r.acc.to || "2024-11-15").investments,
      acc: r.acc, map, gone: gone.map((i) => i.id) };
  }, [ficheros, investments]);
}

async function bloqueIbkr(page, investments) {
  const p2 = await page.context().newPage();
  await page.close();
  await arranca(p2, { investments });
  await p2.locator('.botnav-tab[data-tour="cartera"]').click();
  await p2.getByRole("button", { name: /Ver todas tus inversiones/i }).click();
  const bloque = p2.locator('[data-inv-screen] [data-inv-broker="ibkr"]');
  await expect(bloque).toBeVisible();
  return { p2, bloque };
}

test("Mis bancos ya no ofrece Interactive Brokers por fichero, tampoco a quien ya lo usa", async ({ page }) => {
  await arranca(page, { investments: [{ id: "x1", ent: "ibkr", src: "csv:ibkr", name: "APPLE INC", isin: "US0378331005", shares: 1, value: 200, cost: 150, cur: "USD" }] });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(page.locator(".v4-banks-push")).toHaveClass(/open/, { timeout: 10_000 });
  await expect(page.locator('[data-broker-file="ibkr"]')).toHaveCount(0);
  await page.locator('[data-act="bk-conectar"]').click();
  await expect(page.locator('.bk-pick [data-bk-tile="trade_republic"]')).toHaveCount(1);
  await expect(page.locator(".bk-pick")).not.toContainText("Interactive Brokers");
});

test("Flex XML → bloque IBKR en Cartera; el derivado no entra y se avisa", async ({ page }) => {
  await arranca(page, { investments: [] });
  const { inv, acc } = await aplica(page, [XML], []);
  expect(acc.positions).toHaveLength(3);
  expect(acc.warnings.length).toBeGreaterThan(0);
  expect(inv.every((i) => i.ent === "ibkr" && i.src === "csv:ibkr")).toBe(true);
  const { bloque } = await bloqueIbkr(page, inv);
  await expect(bloque).toContainText("Interactive Brokers");
  await expect(bloque).toContainText("3 posiciones");
});

test("re-importar con una posición vendida NO la borra: la marca", async ({ page }) => {
  const base = { ent: "ibkr", src: "csv:ibkr", fileAt: "2024-11-15" };
  const antes = [
    Object.assign({ id: "aapl", name: "APPLE INC", isin: "US0378331005", fileSym: "AAPL", shares: 10, value: 2282.2, cost: 1500, cur: "USD" }, base),
    Object.assign({ id: "vwce", name: "VANGUARD FTSE ALL-WORLD", isin: "IE00BK5BQT80", fileSym: "VWCE", shares: 20, value: 2402, cost: 2000, costEur: 2000, cur: "EUR" }, base),
    Object.assign({ id: "pg", name: "PROCTER & GAMBLE CO", isin: "US7427181091", fileSym: "PG", shares: 30, value: 1365, cost: 1200, cur: "GBP" }, base),
    // Una de Trade Republic con el mismo ISIN: tiene su propia sincronización y no se toca.
    { id: "tr1", ent: "trade_republic", name: "Apple TR", isin: "US0378331005", ticker: "AAPL", shares: 2, value: 400, cost: 300, cur: "USD" },
  ];
  await arranca(page, { investments: [] });
  const sinPG = XML.replace(/<OpenPosition [^>]*symbol="PG"[^>]*\/>\r?\n/, "");
  const { inv, acc, map, gone } = await aplica(page, [sinPG], antes);
  expect(acc.positions).toHaveLength(2);
  // Las dos que siguen se casan solas por ISIN, nunca con la de Trade Republic; la vendida sale aparte.
  expect(Object.values(map).sort()).toEqual(["aapl", "vwce"]);
  expect(gone).toEqual(["pg"]);
  expect(inv).toHaveLength(4);
  expect(inv.find((i) => i.id === "tr1")).toMatchObject({ ent: "trade_republic", shares: 2 });
  expect(inv.find((i) => i.id === "pg")).toMatchObject({ shares: 30, value: 1365 });
  expect(inv.find((i) => i.id === "pg").fileGone).toBeTruthy();
  expect(inv.find((i) => i.id === "aapl").fileGone).toBeUndefined();

  const { p2, bloque } = await bloqueIbkr(page, inv);
  // Lo vendido NO suma: el total del bloque es solo Apple + Vanguard, y se dice por qué.
  await expect(bloque.locator(".hint[data-inv-gone]")).toHaveText("1 fuera del total");
  const usd = await p2.evaluate(() => { const s = JSON.parse(localStorage.getItem("micartera_v3")); return (s.fxRates && s.fxRates.USD) || s.fx; });
  const total = Math.round(+(2282.2 * usd).toFixed(2) + 2402);
  await expect(bloque.locator(".am")).toHaveText(new RegExp("^" + String(total).replace(/(\d)(?=(\d{3})$)/, "$1[.\\s]?") + "\\s*€$"));
  await bloque.locator("button").first().click();
  await expect(bloque.locator('[data-inv-position="pg"] .rsub')).toHaveText(/^ya no está · \d{2} \S+$/);
});
