import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* DEGIRO por fichero (plan de brókers, fase 1 — 18/11/2026).
 *
 * Soltar Cartera + Transacciones → vista previa con sus filas → aplicar → Cartera enseña el
 * bloque DEGIRO con su total en € y la posición en $ con su coste anclado en €.
 * Va en e2e porque lo que se protege es lo que se PINTA (AGENTS §7): una vista previa que no
 * enseña el «—» del coste, o un bloque que no aparece, no lo ve ningún unitario.
 *
 * Los ficheros son SINTÉTICOS (tests/fixtures/brokers/, cifras inventadas con la forma pública
 * del export de DEGIRO): no hay ficheros reales y los de un usuario no se commitean (AGENTS §9).
 */
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "brokers");
const fichero = (name) => ({ name, mimeType: "text/csv", buffer: fs.readFileSync(path.join(dir, name)) });

async function abrirTarjeta(page, overrides) {
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(page.locator(".bk-sec").first()).toBeVisible({ timeout: 10_000 });
  // Nadie lo usa todavía: se elige en «¿Qué brókers usas?» y trae su tarjeta.
  await page.locator(".v4-chip").filter({ hasText: /^DEGIRO$/ }).click();
  const card = page.locator('[data-broker-file="degiro"]');
  await expect(card).toHaveCount(1);
  await card.locator(".bk-brand").click();
  return card;
}

test("Cartera + Transacciones en orden inverso → vista previa con coste, «—» con su porqué", async ({ page }) => {
  const card = await abrirTarjeta(page, { investments: [] });
  // Pasos para exportar: plegados, en una línea cada uno.
  await card.getByRole("button", { name: /Cómo exportarlo/ }).click();
  await expect(card.locator("ol li")).toHaveCount(3);

  await card.locator('input[type="file"]').setInputFiles([fichero("degiro-transacciones-es.csv"), fichero("degiro-cartera-es.csv")]);
  const filas = card.locator("[data-bf-row]");
  await expect(filas).toHaveCount(3);
  // Por defecto, NADA se toca: sin pareja por ISIN, «no tocar».
  await expect(card.locator("select").first()).toHaveValue("");
  await expect(card.getByRole("button", { name: /Aplicar a 0/ })).toBeDisabled();
  // Apple: 10 títulos en $, coste anclado en € de las operaciones (1.871 × 10/12).
  const aapl = card.locator('[data-bf-row="US0378331005"]');
  await expect(aapl).toContainText("APPLE INC. - COMMON STOCK · USD");
  await expect(aapl.locator(".rval")).toContainText(/1[.\s]?559,17/);
  // ASML no sale en Transacciones: «—» y se dice por qué.
  const asml = card.locator('[data-bf-row="NL0010273215"]');
  await expect(asml.locator(".rval")).toHaveText("—");
  await expect(asml).toContainText("no está en Transacciones");
  // El efectivo se enseña, pero no se toca.
  await expect(card.getByText(/Efectivo en el fichero: 125,40? EUR/)).toBeVisible();
});

test("aplicar → bloque DEGIRO en Cartera con su total en € y la posición en $ con su coste", async ({ page }) => {
  const card = await abrirTarjeta(page, { investments: [] });
  await card.locator('input[type="file"]').setInputFiles([fichero("degiro-cartera-es.csv"), fichero("degiro-transacciones-es.csv")]);
  await expect(card.locator("[data-bf-row]")).toHaveCount(3);
  await card.locator('[data-act="bf-create-all"]').click();
  await card.getByRole("button", { name: /Aplicar a 3/ }).click();
  await expect(card.getByText(/3 posiciones re-ancladas/)).toBeVisible();

  // Lo guardado: solo lo del fichero, sin ticker (sin precio en vivo hasta que `prices` sepa la moneda).
  await page.waitForFunction(() => (localStorage.getItem("micartera_v3") || "").indexOf("csv:degiro") >= 0);
  const inv = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).investments);
  const aapl = inv.find((i) => i.isin === "US0378331005");
  expect(aapl).toMatchObject({ ent: "degiro", cur: "USD", shares: 10, value: 2282.2, cost: 1700.91, costEur: 1559.17 });
  expect(aapl.ticker).toBeUndefined();
  expect(inv.find((i) => i.isin === "NL0010273215").cost).toBeNull();

  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: /Ver todas tus inversiones/i }).click();
  const bloque = page.locator('[data-inv-screen] [data-inv-broker="degiro"]');
  await expect(bloque).toBeVisible();
  await expect(bloque).toContainText("3 posiciones");
  // 2.282,20 $ al cambio que tenga la app + 1.501,25 + 1.300, redondeado en la cabecera. El cambio
  // se lee del estado (el arranque lo refresca), no se clava en el test.
  const usd = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("micartera_v3")); return (s.fxRates && s.fxRates.USD) || s.fx; });
  const total = Math.round(+(2282.2 * usd).toFixed(2) + 1501.25 + 1300);
  await expect(bloque.locator(".am")).toHaveText(new RegExp("^" + String(total).replace(/(\d)(?=(\d{3})$)/, "$1[.\\s]?") + "\\s*€$"));
  await bloque.locator("button").first().click();
  // La posición dice de dónde sale el valor y de qué día: no se hace pasar por un precio de hoy.
  await expect(bloque.locator(`[data-inv-position="${aapl.id}"]`)).toContainText("según DEGIRO");
});
