import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Presupuesto por categoría: desglose bajo la cabecera, límite informativo, misma regla
   que expenseCountsBudget (banco fuera de gasto diario no llena la barra). */

const now = new Date("2026-09-15T12:00:00Z");
const d = (n) => new Date(now.getTime() - n * 86400000).toISOString();

const accounts = [
  { id: "tr", ent: "trade_republic", name: "Efectivo", value: 6300, role: "diario", spendFrom: true },
  { id: "rv", ent: "revolut", name: "Revolut", value: 200, role: "fijos" },
];

const settings = {
  autoPrices: false,
  theme: "green",
  gTotalMode: "split",
  expenseBanks: ["trade_republic"],
};

const expenses = [
  { id: "e-super", date: d(1), amount: 40, merchant: "Mercadona", category: "super", source: "macrodroid", ent: "trade_republic" },
  { id: "e-bares", date: d(2), amount: 20, merchant: "Bar", category: "bares", source: "macrodroid", ent: "trade_republic" },
  { id: "e-inv", date: d(3), amount: 100, merchant: "Broker", category: "inversion", source: "manual", ent: "trade_republic" },
  { id: "e-rv", date: d(4), amount: 70, merchant: "Zara", category: "ropa", source: "macrodroid", ent: "revolut" },
];

async function abreGastos(page) {
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-gastos-summary")).toBeVisible();
}

test("Gastos: desglose por categoría cuadra con la cabecera y excluye neutras/otrobanco", async ({ page }) => {
  await page.clock.install({ time: now });
  await seedLoggedInDashboard(page, {
    accounts, settings, expenses, budget: 1000,
    categoryBudgets: { super: 200 },
  });
  await abreGastos(page);

  const bar = page.locator('.v4-gastos-progress[role="progressbar"]');
  await expect(bar).toHaveAttribute("aria-valuenow", "60");

  const cats = page.locator('[data-testid="gastos-cats"] .v4-gastos-cat');
  await expect(cats).toHaveCount(2);
  await expect(page.locator('.v4-gastos-cat[data-cat="super"]')).toContainText("40");
  await expect(page.locator('.v4-gastos-cat[data-cat="bares"]')).toContainText("20");
  await expect(page.locator('.v4-gastos-cat[data-cat="inversion"]')).toHaveCount(0);
  await expect(page.locator('.v4-gastos-cat[data-cat="ropa"]')).toHaveCount(0);

  const superBar = page.locator('.v4-gastos-cat[data-cat="super"] [role="progressbar"]');
  await expect(superBar).toHaveAttribute("aria-valuemax", "200");
  await expect(superBar).toHaveAttribute("aria-valuenow", "40");
  await expect(page.locator('.v4-gastos-cat[data-cat="bares"] [role="progressbar"]')).toHaveCount(0);
});

test("Gastos: poner y quitar límite de categoría no mueve el presupuesto general", async ({ page }) => {
  await page.clock.install({ time: now });
  await seedLoggedInDashboard(page, {
    accounts, settings,
    expenses: [
      { id: "e1", date: d(1), amount: 40, merchant: "Mercadona", category: "super", source: "manual", ent: "trade_republic" },
    ],
    budget: 1000,
  });
  await abreGastos(page);

  const head = page.locator('.v4-gastos-progress[role="progressbar"]');
  await expect(head).toHaveAttribute("aria-valuenow", "40");
  await expect(head).toHaveAttribute("aria-valuemax", "1000");

  await page.locator('.v4-gastos-cat[data-cat="super"]').click();
  await expect(page.locator(".ask-sheet, .tabsheet").first()).toBeVisible();
  await page.locator(".chip", { hasText: "200 €" }).click();
  await page.locator(".btn-primary", { hasText: /Guardar|Save|Desa/ }).click();

  await expect(page.locator('.v4-gastos-cat[data-cat="super"] [role="progressbar"]')).toHaveAttribute("aria-valuemax", "200");
  await expect(head).toHaveAttribute("aria-valuemax", "1000");
  await expect(head).toHaveAttribute("aria-valuenow", "40");

  // set() vuelca a localStorage con debounce 400 ms — esperar a que quede escrito.
  await expect.poll(async () => {
    return page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
      return (s.categoryBudgets || {}).super;
    });
  }).toBe(200);
});

/* ─────────────────────────────────────────────────────────────────────────────
   SE PUEDE OCULTAR — petición de su pareja, 10/9
   Sus palabras: «esta chulo pero mi pareja lo vio y me dijo que es too much, que le gustaria que
   se pudiera ocultar y habilitarlo si tu quieres». El desglose lista TODAS las categorías con
   gasto del mes: con vida normal son ocho o diez filas fijas encima de la lista de gastos. A él
   le sirve, a ella le tapa lo que viene a mirar. No es un fallo: es que no todos quieren lo mismo
   abierto siempre.
   ───────────────────────────────────────────────────────────────────────────── */

const OUT_TIROS = process.env.MC_TIROS || "";

async function gastosSembrado(page) {
  await page.clock.install({ time: now });
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000, __seedOnce: true });
  await abreGastos(page);
}

test("★ por defecto se ve ABIERTO: a quien ya lo tenía no se le esconde nada sin avisar", async ({ page }) => {
  await gastosSembrado(page);
  const cab = page.locator('[data-testid="gastos-cats"] .v4-gastos-cats-h');
  await expect(cab).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('[data-testid="gastos-cats"] .v4-gastos-cat').first()).toBeVisible();
});

test("★ plegarlo deja UNA línea, y dice cuántas categorías esconde", async ({ page }) => {
  await gastosSembrado(page);
  const bloque = page.locator('[data-testid="gastos-cats"]');
  const cab = bloque.locator(".v4-gastos-cats-h");
  const cuantas = await bloque.locator(".v4-gastos-cat").count();
  expect(cuantas).toBeGreaterThan(0);

  await cab.click();
  await expect(cab).toHaveAttribute("aria-expanded", "false");
  await expect(bloque.locator(".v4-gastos-cat").first()).toBeHidden();
  // Plegado no puede quedarse mudo: tiene que decir qué hay debajo, o parece que se ha perdido.
  await expect(bloque.locator(".v4-gastos-cats-t")).toContainText(String(cuantas));
  await expect(bloque.locator(".v4-gastos-cats-fold")).toContainText(/Ver/i);
});

test("★ y se queda plegado al volver: es una preferencia, no un gesto que haya que repetir", async ({ page }) => {
  await gastosSembrado(page);
  await page.locator('[data-testid="gastos-cats"] .v4-gastos-cats-h').click();
  await expect(page.locator('[data-testid="gastos-cats"] .v4-gastos-cats-h')).toHaveAttribute("aria-expanded", "false");
  /* Se guarda en `settings`, o sea por cuenta: él puede tenerlo abierto y ella cerrado.
     Con `poll` porque el guardado no es instantáneo (va por el volcado diferido del estado):
     leerlo a pelo justo después del toque lo pilla a medias y el test parpadea. */
  await expect.poll(async () => page.evaluate(() => (mcLoadRaw("micartera_v3").settings || {}).gastosCatsOff),
    { timeout: 10_000 }).toBe(true);

  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-gastos-summary")).toBeVisible();
  await expect(page.locator('[data-testid="gastos-cats"] .v4-gastos-cats-h')).toHaveAttribute("aria-expanded", "false");
});

test("volver a abrirlo lo deja como estaba, con sus límites y sus barras", async ({ page }) => {
  await gastosSembrado(page);
  const cab = page.locator('[data-testid="gastos-cats"] .v4-gastos-cats-h');
  const antes = await page.locator('[data-testid="gastos-cats"] .v4-gastos-cat').count();
  await cab.click();
  await cab.click();
  await expect(cab).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('[data-testid="gastos-cats"] .v4-gastos-cat')).toHaveCount(antes);
  expect(await page.evaluate(() => (mcLoadRaw("micartera_v3").settings || {}).gastosCatsOff)).toBeUndefined();
});

test("plegar el desglose NO toca ni un límite ni una cifra", async ({ page }) => {
  await gastosSembrado(page);
  const antes = await page.evaluate(() => JSON.stringify(mcLoadRaw("micartera_v3").categoryBudgets || {}));
  /* La cifra grande del mes, NO el texto entero de la cabecera: el desglose vive DENTRO de
     `.v4-gastos-summary`, así que plegarlo cambia ese texto por definición. Lo que no puede
     cambiar es el dinero. */
  const cifra = await page.locator(".v4-gastos-progress-lbl, .v4-gastos-summary .num").first().innerText();
  await page.locator('[data-testid="gastos-cats"] .v4-gastos-cats-h').click();
  expect(await page.evaluate(() => JSON.stringify(mcLoadRaw("micartera_v3").categoryBudgets || {}))).toBe(antes);
  expect(await page.locator(".v4-gastos-progress-lbl, .v4-gastos-summary .num").first().innerText()).toBe(cifra);
});

test("tiros: cómo se ve abierto y plegado", async ({ page }) => {
  test.skip(!OUT_TIROS, "solo cuando se piden capturas con MC_TIROS");
  await gastosSembrado(page);
  await page.locator('[data-testid="gastos-cats"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: OUT_TIROS + "/cats-abierto.png" });
  await page.locator('[data-testid="gastos-cats"] .v4-gastos-cats-h').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT_TIROS + "/cats-plegado.png" });
});
