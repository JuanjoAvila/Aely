import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* LAS CUOTAS DE TUS DEUDAS, FILTRABLES EN GASTOS (4.21.0). Idea suya del 12/9: «categorías
   automáticamente por las deudas… y así se pudieran filtrar». La pasada que las marca está en
   `tests/cuotas-deudas`; esto es lo que `npm test` no ve: que al abrir Gastos la fila salga en
   «Deudas» y que el filtro tenga un chip por cada deuda (y ninguno si no hay deudas). */

const hoy = new Date();
const dia = hoy.getDate();
const iso = (d) => new Date(hoy.getFullYear(), hoy.getMonth(), d, 12).toISOString();

const accounts = [
  { id: "tr", ent: "trade_republic", name: "Efectivo", value: 6300, role: "diario", spendFrom: true },
  { id: "sb", ent: "sabadell", name: "Cuenta", value: 2000, role: "fijos" },
];
const settings = { autoPrices: false, theme: "green", expenseBanks: ["trade_republic"] };
const debts = [
  { id: "robot", name: "Financiación robot", value: 900, original: 900, monthly: 149.75, account: "trade_republic", day: dia },
  { id: "piso", name: "Préstamo piso", value: 9000, original: 9000, monthly: 197, account: "sabadell", day: dia },
];
// Como le llegan de verdad: ninguna se llama como la deuda.
const expenses = [
  { id: "e1", date: iso(dia), amount: 149.75, merchant: "Amazon", category: "compras", source: "macrodroid", ent: "trade_republic" },
  { id: "e2", date: iso(dia), amount: 197, merchant: "Nombre De Persona", category: "otros", source: "ob", ent: "sabadell" },
  { id: "e3", date: iso(dia), amount: 30, merchant: "Mercadona", category: "super", source: "macrodroid", ent: "trade_republic" },
];

const lista = (page) => page.locator(".v4-gastos-list-body button.v4-mov");
const fila = (page, nombre) => lista(page).filter({ hasText: nombre });

async function abreGastos(page) {
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
}
async function abreFiltros(page) {
  await page.locator('.v4-gastos button.v4-chip:has-text("🎛️"), button.v4-chip:has-text("🎛️")').first().click();
  await expect(page.locator(".v4-sheet")).toBeVisible();
}
async function cierraSheet(page) {
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".v4-sheet-back")).toHaveCount(0);
}

test("★ la cuota que llega con otro nombre sale en «Deudas» y dice por qué no cuenta", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, debts, budget: 1000 });
  await abreGastos(page);

  await expect(fila(page, "Amazon")).toContainText("Deudas");
  await expect(fila(page, "Amazon")).toContainText("ya cuenta en el Plan");
  await expect(fila(page, "Amazon")).toHaveClass(/v4-mov-skip/);
  await expect(fila(page, "Mercadona")).not.toHaveClass(/v4-mov-skip/);
});

test("★ el filtro tiene un chip por deuda y cada uno enseña solo su cuota", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, debts, budget: 1000 });
  await abreGastos(page);
  await expect(fila(page, "Amazon")).toContainText("Deudas");

  await abreFiltros(page);
  const categoriesToggle = page.locator('.v4-sheet .v4-filter-cats-toggle');
  await expect(categoriesToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('#gastos-filter-cats-body')).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator('#gastos-filter-cats-body')).toHaveCSS("visibility", "hidden");
  await categoriesToggle.click();
  await expect(categoriesToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('#gastos-filter-cats-body')).toHaveCSS("visibility", "visible");
  const chips = page.locator('.v4-sheet [data-testid="filtro-deudas"] button.v4-chip');
  await expect(chips).toHaveCount(2);
  // La cuota elegida vive en Sabadell, fuera del default de gasto diario: ampliar primero a todos.
  await page.locator('.v4-sheet button.v4-chip:has-text("Todos los bancos")').click();
  await chips.filter({ hasText: "Préstamo piso" }).click();
  await cierraSheet(page);

  await expect(lista(page)).toHaveCount(1);
  await expect(fila(page, "Nombre De Persona")).toHaveCount(1);
});

test("★ su rechazo: desde la ficha se marca a mano «Es la cuota de…», también una deuda ya acabada", async ({ page }) => {
  /* 4.22.2: «Hay una compra de Cofidis que es la cuota de una deuda, no la puedo cambiar
     manualmente?». Su financiación ya había terminado y el banco cobraba 24,99 contra 25,02. */
  const acabada = { id: "suelo", name: "Financiación suelo", value: 75.06, original: 75.06, monthly: 25.02,
    account: "trade_republic", day: 6, months: 3, asOf: (hoy.getFullYear() * 12 + hoy.getMonth()) - 6 };
  const cofidis = { id: "e9", date: iso(dia), amount: 24.99, merchant: "Cofidis", category: "compras", source: "macrodroid", ent: "trade_republic" };
  await seedLoggedInDashboard(page, { accounts, settings, expenses: [cofidis], debts: debts.concat([acabada]), budget: 1000 });
  await abreGastos(page);
  await expect(fila(page, "Cofidis")).not.toContainText("Deudas");

  await fila(page, "Cofidis").click();
  await page.locator(".v4-ficha-adjust-row").filter({ hasText: "Es la cuota" }).click();
  const chips = page.locator('.v4-exp-sheet [data-testid="exp-cuota-de"] button.v4-chip');
  await expect(chips).toHaveCount(3);
  await chips.filter({ hasText: "Financiación suelo" }).click();
  await expect(chips.filter({ hasText: "Financiación suelo" })).toHaveClass(/on/);
  await cierraSheet(page);

  await expect(fila(page, "Cofidis")).toContainText("Deudas");
  await expect(fila(page, "Cofidis")).toContainText("ya cuenta en el Plan");
});

test("sin deudas no sale la sección ni la categoría «Deudas»", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, debts: [], budget: 1000 });
  await abreGastos(page);
  await abreFiltros(page);
  await page.locator('.v4-sheet .v4-filter-cats-toggle').click();
  await expect(page.locator('.v4-sheet [data-testid="filtro-deudas"]')).toHaveCount(0);
  await expect(page.locator('.v4-sheet button.v4-chip:has-text("💳")')).toHaveCount(0);
});
