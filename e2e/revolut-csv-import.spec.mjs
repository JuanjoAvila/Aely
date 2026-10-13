import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Import CSV de Revolut: el extracto de la cuenta en € NO es un fichero ilegible.
 *
 * Bug real (2026-07-25). Desde la 4.9.0 el coste del oro se calcula cruzando el extracto de
 * «Materias primas» (las onzas) con el de la cuenta normal en € (los euros). El usuario subió
 * justo el segundo —el que hacía falta para saber cuánto gana— y la app le contestó «No he podido
 * leer el CSV (¿formato raro?)», cuando lo había leído perfectamente: los euros de sus seis
 * conversiones a XAU estaban dentro. El importador solo daba un fichero por entendido si sacaba
 * POSICIONES, y ese no trae ninguna.
 *
 * Va con e2e y no con un unitario porque lo que falló no fue un parser (los tres funcionaban)
 * sino lo que se PINTA a partir de ellos — justo el hueco que describe AGENTS §7.
 *
 * Los CSV reales del usuario no se commitean (AGENTS §9): estas fixtures son inventadas con la
 * misma forma, cabeceras incluidas.
 */

const CAB = "Tipo,Producto,Fecha de inicio,Fecha de finalización,Descripción,Importe,Comisión,Divisa,State,Saldo";
const fila = (ts, desc, imp, com, div, saldo) =>
  `Cambio,Actual,${ts},${ts},${desc},${imp},${com},${div},COMPLETADO,${saldo}`;

// Extracto de la cuenta NORMAL: los euros que pusiste en cada conversión (100 + 150).
const CUENTA_EUR = [CAB,
  fila("2025-08-28 15:56:48", "Conversión a XAU", "-100.00", "0.00", "EUR", "595.93"),
  fila("2025-09-29 14:49:11", "Conversión a XAU", "-150.00", "0.00", "EUR", "286.46"),
].join("\n");

// Extracto de MATERIAS PRIMAS: las onzas. El saldo de la última fila es la posición viva.
const MATERIAS = [CAB,
  fila("2025-08-28 15:56:48", "Conversión a XAU", "0.033804", "0.000338", "XAU", "0.033466"),
  fila("2025-09-29 14:49:11", "Conversión a XAU", "0.030402", "0.000304", "XAU", "0.063564"),
].join("\n");

async function abrirTarjetaCsv(page) {
  // Con una posición de Revolut en cartera, su chip viene marcado de serie (4.9.1).
  await seedLoggedInDashboard(page, {
    investments: [{ id: "i1", ent: "revolut", name: "Oro (XAU)", ticker: "XAU", shares: 0.03, cost: 100, value: 110 }],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  const csv = page.locator(".bk-card.bk-csv");
  await expect(csv).toHaveCount(1, { timeout: 10_000 });
  await csv.locator(".bk-brand").click();
  await expect(csv.locator("textarea")).toBeVisible();
  return csv;
}

async function analizar(csv, texto) {
  await csv.locator("textarea").fill(texto);
  await csv.getByRole("button", { name: /Analizar/i }).click();
}

test("el extracto de la cuenta en € no se rechaza: dice qué falta y guarda los costes", async ({ page }) => {
  const csv = await abrirTarjetaCsv(page);
  await analizar(csv, CUENTA_EUR);

  // Lo que salía antes y no debe volver a salir.
  await expect(csv.getByText(/No he podido leer el CSV/i)).toHaveCount(0);
  // Lo que sale ahora: confirmación + qué fichero falta.
  await expect(csv.getByText(/extracto de tu cuenta normal en €/i)).toBeVisible();
  await expect(csv.getByText(/Materias primas/i).first()).toBeVisible();
  // Y no es una alarma: el fichero está bien.
  await expect(csv.locator(".alarmbox")).toHaveCount(0);
});

test("al subir después el de materias primas, el coste del oro sale solo", async ({ page }) => {
  const csv = await abrirTarjetaCsv(page);
  await analizar(csv, CUENTA_EUR);
  await expect(csv.getByText(/extracto de tu cuenta normal en €/i)).toBeVisible();

  // Segunda tanda en la MISMA tarjeta: los euros de antes siguen guardados.
  await analizar(csv, MATERIAS);
  await expect(csv.getByText(/1 posiciones detectadas|1 posición detectada/i)).toBeVisible();
  await expect(csv.getByText("0.063564 onzas")).toBeVisible();
  await expect(csv.locator(".rval").filter({ hasText: "250,00" })).toHaveCount(1);
  // Y se explica de dónde sale ese número, que el usuario no ha tecleado.
  await expect(csv.getByText(/El coste sale de tu extracto de la cuenta en €/i)).toBeVisible();
});

test("subir solo materias primas sigue funcionando, con el coste en «—»", async ({ page }) => {
  const csv = await abrirTarjetaCsv(page);
  await analizar(csv, MATERIAS);

  await expect(csv.getByText("0.063564 onzas")).toBeVisible();
  await expect(csv.locator(".rval").filter({ hasText: "—" })).toHaveCount(1);
  // Sin la pata en €, se pide a mano en vez de inventar un coste (AGENTS §1).
  await expect(csv.getByText(/este extracto solo trae ONZAS/i)).toBeVisible();
});

test("un CSV que de verdad no se entiende sigue avisando", async ({ page }) => {
  const csv = await abrirTarjetaCsv(page);
  await analizar(csv, "hola,que,tal\n1,2,3");

  await expect(csv.getByText(/No he podido leer el CSV/i)).toBeVisible();
  await expect(csv.locator(".alarmbox")).toHaveCount(1);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).lastRevolutImport)).toBeUndefined();
});

test("el CSV sella la importación aplicada sin inventar una fecha de cotización", async ({ page }) => {
  const csv=await abrirTarjetaCsv(page);
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")));
  await analizar(csv,MATERIAS);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).lastRevolutImport)).toBeUndefined();
  const started=await page.evaluate(()=>Date.now());
  await csv.getByRole("button",{name:/Aplicar a 1/}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).lastRevolutImport||0)).toBeGreaterThanOrEqual(started);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")));
  expect(after.lastPriceSync).toBe(before.lastPriceSync);
  expect(after.lastMiSync).toBe(before.lastMiSync);
  expect(after.lastTrSync).toBe(before.lastTrSync);
  expect(after.investments[0].cost).toBe(100);
});
