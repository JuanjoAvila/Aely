import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* PRO-02: la raya de Inicio junta `state.history` (números sin fecha) con el total de ahora.
 * El alta guarda un 0, la semilla de ejemplo no es un calendario y no hay otro escritor.
 * Aquí se comprueba el texto y la escala, con importes sintéticos, sin reescribir saldos. */

const NOTA = '[data-testid="inicio-chart-note"]';
const CUENTA = { id: "a1", ent: "sabadell", name: "Banco", value: 1000, role: "fijos", spendFrom: false };

function ysDe(valores) {
  const min = Math.min.apply(null, valores);
  const max = Math.max.apply(null, valores);
  const rng = (max - min) || 1;
  const h = 70, pad = 4;
  return valores.map(function (v) { return pad + (1 - (v - min) / rng) * (h - 2 * pad); });
}

async function inicio(page, estado) {
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}

function heroRe(amount, sym) {
  const neg = amount < 0 ? "-" : "";
  const raw = Math.abs(amount).toFixed(2).replace(".", ",");
  const miles = raw.replace(/^(\d+)(,)/, function (_, ent, comma) {
    return ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + comma;
  });
  return new RegExp(neg + "(?:" + miles.replace(/\./g, "\\.") + "|" + raw + ") " + sym);
}

async function nota(page) {
  const el = page.locator(NOTA);
  await expect(el).toBeVisible();
  return (await el.innerText()).replace(/\s+/g, " ").trim();
}

async function guardado(page) {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
    const a = (s.accounts || [])[0];
    return { history: s.history, value: a ? a.value : null };
  });
}

async function puntos(page) {
  const d = await page.locator(".v4-hero svg.spark path").nth(1).getAttribute("d");
  const nums = (d || "").match(/-?\d+(?:\.\d+)?/g).map(Number);
  const out = [];
  for (let i = 0; i < nums.length; i += 2) out.push(nums[i + 1]);
  return out;
}

test("sin cifras guardadas solo está el total de ahora", async ({ page }) => {
  await inicio(page, { history: [], accounts: [CUENTA], budget: 500 });
  await expect(page.locator(".v4-hero svg.spark")).toHaveCount(0);
  const texto = await nota(page);
  expect(texto).toMatch(/Tu histórico empieza hoy/i);
  expect(texto).toMatch(/sin fechas y sin ganancia/i);
  expect(texto).not.toMatch(/diario|mensual|rentabilidad|evolución/i);
  await expect(page.locator(".v4-hero-amt")).toContainText(heroRe(1000, "€"));
  const g = await guardado(page);
  expect(g.history).toEqual([]);
  expect(g.value).toBe(1000);
});

test("el alta no convierte el cero guardado en una serie", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    onboarded: false,
    history: [],
    budget: 0,
    accounts: [{ id: "a1", ent: "sabadell", name: "Banco", value: 1500, role: "fijos", spendFrom: false }],
  });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await page.getByRole("button", { name: "Saltar" }).click();
  await expect(page.locator(".v4-hero svg.spark")).toHaveCount(1);
  const texto = await nota(page);
  expect(texto).toMatch(/no es una ganancia/i);
  expect(texto).not.toMatch(/diario|mensual|rentabilidad|evolución/i);
  await expect(page.locator(".v4-hero-amt")).toContainText(heroRe(1500, "€"));
  const ys = ysDe([0, 1500]);
  const dibujo = await puntos(page);
  expect(dibujo.length).toBe(2);
  expect(dibujo[1]).toBeCloseTo(ys[1], 4);
  const g = await guardado(page);
  expect(g.history).toEqual([0]);
  expect(g.value).toBe(1500);
});

test("un solo número guardado no se lee como calendario", async ({ page }) => {
  await inicio(page, { history: [250], accounts: [CUENTA], budget: 500 });
  const texto = await nota(page);
  expect(texto).toMatch(/no tiene fecha/i);
  expect(texto).toMatch(/no es una ganancia/i);
  const ys = ysDe([250, 1000]);
  const dibujo = await puntos(page);
  expect(dibujo.length).toBe(2);
  expect(dibujo[0]).toBeCloseTo(ys[0], 4);
  expect(dibujo[1]).toBeCloseTo(ys[1], 4);
  await expect(page.locator(".v4-hero-amt")).toContainText(heroRe(1000, "€"));
  expect((await guardado(page)).history).toEqual([250]);
});

test("una serie sin fechas acaba en el total y no reescribe el saldo", async ({ page }) => {
  const history = [100, 800, 300];
  await inicio(page, { history: history.slice(), accounts: [CUENTA], budget: 500 });
  const texto = await nota(page);
  expect(texto).toMatch(/acaba en el total de hoy/i);
  expect(texto).not.toMatch(/diario|mensual|rentabilidad|evolución/i);
  const ys = ysDe(history.concat([1000]));
  const dibujo = await puntos(page);
  expect(dibujo.length).toBe(4);
  for (let i = 0; i < ys.length; i++) expect(dibujo[i]).toBeCloseTo(ys[i], 4);
  expect(dibujo[1]).toBeLessThan(dibujo[0]);
  expect(dibujo[1]).toBeLessThan(dibujo[2]);
  await expect(page.locator(".v4-hero-amt")).toContainText(heroRe(1000, "€"));
  const g = await guardado(page);
  expect(g.history).toEqual(history);
  expect(g.value).toBe(1000);
});

test("la semilla de ejemplo no sustituye al total de ahora", async ({ page }) => {
  const history = [42000, 42150, 42300, 42450, 42600, 42750, 42800];
  await inicio(page, { history: history.slice(), accounts: [CUENTA], budget: 500 });
  await expect(page.locator(".v4-hero-amt")).toContainText(heroRe(1000, "€"));
  await expect(page.locator(".v4-hero-amt")).not.toContainText("42.800");
  const texto = await nota(page);
  expect(texto).toMatch(/no es una ganancia/i);
  const ys = ysDe(history.concat([1000]));
  const dibujo = await puntos(page);
  expect(dibujo[dibujo.length - 1]).toBeCloseTo(ys[ys.length - 1], 4);
  expect((await guardado(page)).history).toEqual(history);
  expect((await guardado(page)).value).toBe(1000);
});

test("patrimonio negativo: el final queda abajo y el saldo no cambia", async ({ page }) => {
  const history = [100, 200];
  const cuenta = { id: "a1", ent: "sabadell", name: "Banco", value: -2500, role: "fijos", spendFrom: false };
  await inicio(page, { history: history.slice(), accounts: [cuenta], budget: 500 });
  await expect(page.locator(".v4-hero-amt")).toContainText(heroRe(-2500, "€"));
  const ys = ysDe(history.concat([-2500]));
  const dibujo = await puntos(page);
  expect(dibujo[dibujo.length - 1]).toBeCloseTo(ys[ys.length - 1], 4);
  expect(dibujo[dibujo.length - 1]).toBeGreaterThan(dibujo[0]);
  const g = await guardado(page);
  expect(g.history).toEqual(history);
  expect(g.value).toBe(-2500);
});

test("otra moneda cambia el total pintado y no la escala en euros", async ({ page }) => {
  const history = [100, 500, 2000];
  await page.route("https://api.frankfurter.dev/**", function (route) { return route.abort(); });
  await inicio(page, {
    history: history.slice(),
    accounts: [CUENTA],
    budget: 500,
    settings: { autoPrices: false, theme: "green", currency: "USD" },
    fxRates: { USD: 0.5 },
  });
  await expect(page.locator(".v4-hero-amt")).toContainText(heroRe(2000, "\\$"));
  const texto = await nota(page);
  expect(texto).toMatch(/no es una ganancia/i);
  expect(texto).not.toMatch(/%|rentabilidad/i);
  const ys = ysDe(history.concat([1000]));
  const dibujo = await puntos(page);
  expect(dibujo[dibujo.length - 1]).toBeCloseTo(ys[ys.length - 1], 4);
  expect(Math.abs(dibujo[dibujo.length - 1] - 4)).toBeGreaterThan(10);
  expect((await guardado(page)).value).toBe(1000);
  expect((await guardado(page)).history).toEqual(history);
});

test("inglés y catalán dicen el límite, no un calendario", async ({ page }) => {
  await inicio(page, {
    history: [],
    accounts: [CUENTA],
    budget: 500,
    settings: { autoPrices: false, theme: "green", lang: "en" },
  });
  await expect(page.locator(NOTA)).toContainText("Only today's total is here");
  await page.goto("about:blank");
  await inicio(page, {
    history: [100, 200],
    accounts: [CUENTA],
    budget: 500,
    settings: { autoPrices: false, theme: "green", lang: "ca" },
  });
  await expect(page.locator(NOTA)).toContainText("no és un guany");
  await expect(page.locator(".v4-hero-amt")).toContainText(heroRe(1000, "€"));
  expect((await guardado(page)).value).toBe(1000);
});
