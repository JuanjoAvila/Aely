import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* DEGIRO: el lector del fichero sigue, la tarjeta de importar no (19/11/2026).
 *
 * Entró por fichero en la 4.26.243 (plan de brókers, fase 1) y al día siguiente él lo descartó:
 * los brókers nunca por fichero, como Trade Republic o MyInvestor, para que nadie tenga que entrar
 * en la app del bróker. Se quita la tarjeta de «Mis bancos»; el lector y el aplicar se quedan para
 * la conexión automática, y aquí se blinda lo que ya leen: Cartera + Transacciones → bloque DEGIRO
 * en Cartera con su total en € y la posición en $ con su coste anclado en €.
 * Va en e2e porque lo que se protege es lo que se PINTA (AGENTS §7).
 *
 * Los ficheros son SINTÉTICOS (tests/fixtures/brokers/, cifras inventadas con la forma pública
 * del export de DEGIRO): no hay ficheros reales y los de un usuario no se commitean (AGENTS §9).
 */
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "brokers");
const txt = (name) => fs.readFileSync(path.join(dir, name), "utf8");

async function arranca(page, overrides) {
  await seedLoggedInDashboard(page, overrides);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
}

/* Lo mismo que hacía la tarjeta al pulsar «Crear todas» + «Aplicar», sin la tarjeta: el lector,
   la pareja por ISIN y `brkApplyFile` del propio bundle. Devuelve las inversiones resultantes. */
function aplica(page, ent, ficheros, investments) {
  return page.evaluate(([ent, ficheros, investments]) => {
    const r = brokerAnalyze(ent, ficheros, {});
    if (!r.acc) throw new Error("no se ha leído: " + r.err);
    const map = {};
    r.acc.positions.forEach((p) => { map[p.key] = brkSuggest(p, investments, ent) || "__new"; });
    const gone = r.acc.snapshot ? brkGoneOf(investments, ent, r.acc.positions, map, r.acc.present) : [];
    const marca = {}; gone.forEach((i) => { marca[i.id] = 1; });
    return { inv: brkApplyFile({ investments }, ent, r.acc.positions, map, marca, r.acc.to || "2024-11-15").investments, acc: r.acc };
  }, [ent, ficheros, investments]);
}

test("Mis bancos ya no ofrece DEGIRO por fichero, tampoco a quien ya tiene posiciones de DEGIRO", async ({ page }) => {
  await arranca(page, { investments: [{ id: "d1", ent: "degiro", src: "csv:degiro", name: "APPLE INC.", isin: "US0378331005", shares: 1, value: 200, cost: 150, cur: "USD" }] });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(page.locator(".bk-sec").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".v4-chip").filter({ hasText: "Trade Republic" })).toHaveCount(1);
  await expect(page.locator(".v4-chip").filter({ hasText: /^DEGIRO$/ })).toHaveCount(0);
  await expect(page.locator('[data-broker-file="degiro"]')).toHaveCount(0);
  // Revolut por CSV sigue donde estaba.
  await page.locator(".v4-chip").filter({ hasText: /^Revolut$/ }).click();
  await expect(page.locator(".bk-card.bk-csv")).toHaveCount(1);
});

test("Cartera + Transacciones (en orden inverso) → bloque DEGIRO con su total en € y el coste anclado", async ({ page }) => {
  await arranca(page, { investments: [] });
  // El orden no importa: Transacciones antes que Cartera.
  const { inv, acc } = await aplica(page, "degiro", [txt("degiro-transacciones-es.csv"), txt("degiro-cartera-es.csv")], []);
  expect(acc.positions).toHaveLength(3);
  expect(acc.cash.length).toBeGreaterThan(0);   // el efectivo se lee, pero no se toca
  const aapl = inv.find((i) => i.isin === "US0378331005");
  // Apple: 10 títulos en $, coste anclado en € de las operaciones (1.871 × 10/12).
  expect(aapl).toMatchObject({ ent: "degiro", cur: "USD", shares: 10, value: 2282.2, cost: 1700.91, costEur: 1559.17 });
  expect(aapl.ticker).toBeUndefined();   // sin precio en vivo hasta que `prices` sepa la moneda
  // ASML no sale en Transacciones: sin coste, no uno inventado.
  expect(inv.find((i) => i.isin === "NL0010273215").cost).toBeNull();

  const p2 = await page.context().newPage();
  await page.close();
  await arranca(p2, { investments: inv });
  await p2.locator('.botnav-tab[data-tour="cartera"]').click();
  await p2.getByRole("button", { name: /Ver todas tus inversiones/i }).click();
  const bloque = p2.locator('[data-inv-screen] [data-inv-broker="degiro"]');
  await expect(bloque).toBeVisible();
  await expect(bloque).toContainText("3 posiciones");
  // 2.282,20 $ al cambio que tenga la app + 1.501,25 + 1.300, redondeado en la cabecera. El cambio
  // se lee del estado (el arranque lo refresca), no se clava en el test.
  const usd = await p2.evaluate(() => { const s = JSON.parse(localStorage.getItem("micartera_v3")); return (s.fxRates && s.fxRates.USD) || s.fx; });
  const total = Math.round(+(2282.2 * usd).toFixed(2) + 1501.25 + 1300);
  await expect(bloque.locator(".am")).toHaveText(new RegExp("^" + String(total).replace(/(\d)(?=(\d{3})$)/, "$1[.\\s]?") + "\\s*€$"));
  await bloque.locator("button").first().click();
  // La posición dice de dónde sale el valor y de qué día: no se hace pasar por un precio de hoy.
  await expect(bloque.locator(`[data-inv-position="${aapl.id}"] .rsub`)).toHaveText(/^\d{2} \S+ · DEGIRO$/);
  // El importe no se parte en dos líneas («1.501,25» / «€», filtro de diseño 18/11): con el nombre
  // largo de DEGIRO es justo donde pasaba. Una sola fila de cajas para el texto de la cifra.
  await p2.setViewportSize({ width: 360, height: 780 });
  const lineas = await bloque.locator("[data-inv-position] .rval").evaluateAll((els) => els.map((el) => {
    const r = document.createRange(); r.selectNodeContents(el.firstChild);
    return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
  }));
  expect(lineas).toEqual([1, 1, 1]);
});
