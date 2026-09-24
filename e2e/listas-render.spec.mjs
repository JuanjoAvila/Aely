import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Cobertura de las listas que AGENTS.md §8 tenía marcadas como HUECO: Deudas, Metas, Fijos y
   «Tus cuentas» en Cartera.
 *
 * El porqué está en el bug de 4.7.1: un `.map` que cambia de forma y deja de casar aguas abajo
 * hace DESAPARECER una lista entera, y `npm test` sigue en verde porque la sintaxis y la lógica
 * pura están perfectas — el fallo solo existe en lo que se PINTA. Estos tests abren la pantalla
 * de verdad y cuentan elementos del DOM, que es lo único que lo pilla.
 */

const hoy = new Date();
const iso = (d) => d.toISOString();

// Solo hay CUATRO pestañas (tabOrderOf): inicio · gastos · plan · cartera. Deudas, Metas y
// Recibos viven DENTRO de Plan, en su control de segmentos — así se llega igual que el usuario.
async function abrir(page, tab, overrides) {
  await seedLoggedInDashboard(page, overrides);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator(`.botnav-tab[data-tour="${tab}"]`).click();
}

async function abrirPlan(page, segmento, overrides) {
  await abrir(page, "plan", overrides);
  await page.locator(".v4-seg-btn").filter({ hasText: segmento }).click();
}

// Con mountNeighbors las pestañas vecinas siguen montadas; acotar a la activa evita coger
// textos duplicados (p. ej. «Internet» en Inicio›Próximos y en Plan›Recibos).
function paginaActiva(page) {
  return page.locator(".page-scroll-host");
}

/* ---------------- Deudas ---------------- */
const debts = [
  { id: "d1", name: "Coche", total: 12000, monthly: 250, rate: 6, start: "2026-01", months: 48, account: "sabadell" },
  { id: "d2", name: "Préstamo estudios", total: 6000, monthly: 150, rate: 3, start: "2025-06", months: 40, account: "sabadell" },
];

test("Plan › Deudas: se pinta una tarjeta por deuda, con su nombre", async ({ page }) => {
  await abrirPlan(page, /Deudas|Debts|Deutes/i, { debts });
  const cards = page.locator(".v4-debt-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Coche");
  await expect(cards.nth(1)).toContainText("Préstamo estudios");
});

test("Plan › Deudas: sin deudas no quedan tarjetas fantasma", async ({ page }) => {
  await abrirPlan(page, /Deudas|Debts|Deutes/i, { debts: [] });
  await expect(page.locator(".v4-debt-card")).toHaveCount(0);
});

/* ---------------- Metas ---------------- */
const goals = [
  { id: "g1", name: "Viaje a Japón", target: 4000, saved: 1500, emoji: "✈️" },
  { id: "g2", name: "Colchón", target: 6000, saved: 6000, emoji: "🛟", done: true },
];

test("Metas: una tarjeta por meta, con lo ahorrado y el objetivo", async ({ page }) => {
  await abrirPlan(page, /Metas|Goals|Fites/i, { goals });
  const cards = page.locator(".v4-goal-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Viaje a Japón");
  // El «X de Y» y el % son lo que de verdad mira el usuario: si el .map se rompe o el cálculo
  // deriva, aquí sale otra cosa (1500/4000 = 38 %).
  await expect(cards.nth(0)).toContainText("1500 €");
  await expect(cards.nth(0)).toContainText("4000 €");
  await expect(cards.nth(0)).toContainText("38%");
  await expect(cards.nth(1)).toContainText("Colchón");
});

/* ---------------- Fijos ---------------- */
const fixed = [
  { id: "f1", name: "Alquiler", amount: 850, freq: "mes", account: "sabadell", day: 1 },
  { id: "f2", name: "Internet", amount: 39.9, freq: "mes", account: "sabadell", day: 15 },
  // Anual y solo en marzo: NO debe salir en el mes en curso. Es a propósito — Recibos enseña lo
  // que se cobra ESTE mes, y colar aquí un anual descuadraría el total del mes.
  { id: "f3", name: "Seguro coche anual", amount: 320, freq: "año", account: "sabadell", months: [3] },
];

test("Plan › Recibos: salen los fijos mensuales, con su importe", async ({ page }) => {
  await abrirPlan(page, /Recibos|Bills|Rebuts/i, { fixed });
  const activa = paginaActiva(page);
  await expect(activa.getByText("Alquiler", { exact: false }).first()).toBeVisible();
  await expect(activa.getByText("Internet", { exact: false }).first()).toBeVisible();
  await expect(activa.getByText("850", { exact: false }).first()).toBeVisible();
});

test("Plan › Recibos: un anual de otro mes NO se cuela en el mes en curso", async ({ page }) => {
  // Salvo que hoy sea marzo, claro: el test se adapta en vez de fallar tres semanas al año.
  const esMarzo = new Date().getMonth() === 2;
  await abrirPlan(page, /Recibos|Bills|Rebuts/i, { fixed });
  await expect(paginaActiva(page).getByText("Seguro coche anual", { exact: false })).toHaveCount(esMarzo ? 1 : 0);
});

test("Plan › Recibos: pinta el saldo más bajo y no inventa el día de una cuota sin fecha", async ({ page }) => {
  await abrirPlan(page, /Recibos|Bills|Rebuts/i, {
    accounts: [{ id: "a1", ent: "sabadell", name: "Cuenta recibos", value: 500, role: "fijos" }],
    fixed: [], oneoffs: [], flows: [],
    debts: [{ id: "d1", name: "Préstamo sin fecha", value: 800, monthly: 80, account: "sabadell" }],
  });
  const hero=paginaActiva(page).locator(".v4-card-hero").first();
  await expect(hero).toContainText(/saldo más bajo|lowest balance|saldo més baix/i);
  await expect(hero).toContainText("420 €");
  await expect(hero).not.toContainText(/día 1|day 1|dia 1/i);
});

/* ---------------- Cartera › Tus cuentas ---------------- */
const accounts = [
  { id: "a1", ent: "sabadell", name: "Cuenta nómina", value: 2400 },
  { id: "a2", ent: "trade_republic", name: "Gasto diario", value: 800, spendFrom: true },
];

test("Cartera › Tus cuentas: una fila por cuenta con su banco", async ({ page }) => {
  await abrir(page, "cartera", { accounts });
  const wealth = page.locator(".v4-card-list").first();
  await expect(wealth).toContainText("Sabadell");
  await expect(wealth).toContainText("Trade Republic");
});

/* ---------------- Banner de banco caído (feature 2026-07-24) ---------------- */
test("Cartera: un banco caducado saca el banner con su botón de reconectar", async ({ page }) => {
  await abrir(page, "cartera", {
    accounts,
    hasBankLink: true,
    bankIssues: [{ aspsp: "CaixaBank", ent: "caixabank", kind: "expired" }],
  });
  const banner = page.locator(".v4-bank-issue");
  await expect(banner).toHaveCount(1);
  await expect(banner).toContainText(/necesita tu permiso|needs your permission|necessita el teu perm/i);
  await expect(banner.getByRole("button")).toBeVisible();
  // El botón dice «Reconectar …» a secas: el candado abierto se retiró (feedback 18/9).
  await expect(banner.getByRole("button")).not.toContainText("🔓");
});

test("Cartera: un banco enlazado SIN cuentas dice lo suyo, no «permiso caducado»", async ({ page }) => {
  await abrir(page, "cartera", {
    accounts,
    hasBankLink: true,
    bankIssues: [{ aspsp: "BBVA", ent: "bbva", kind: "noacct" }],
  });
  const banner = page.locator(".v4-bank-issue");
  await expect(banner).toHaveCount(1);
  await expect(banner).toContainText(/conectado a medias|half connected|connectat a mitges/i);
});

test("Cartera: sin bancos caídos no hay banner", async ({ page }) => {
  await abrir(page, "cartera", { accounts, bankIssues: [] });
  await expect(page.locator(".v4-bank-issue")).toHaveCount(0);
});
