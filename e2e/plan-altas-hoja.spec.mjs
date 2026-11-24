import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

/* DIS-31 (15/11/2026): «Añadir deuda» y «Nueva meta» pasan de abrirse dentro de la lista a una hoja,
   y la fecha límite usa el calendario de la app. Desde el 24/11 la hoja es la de Añadir recibo (importe grande, celdas
   que se teclean con el teclado propio, «Más datos» plegado): se teclea con `pad`, el resultado guardado es el mismo. CREAN DINERO, así que lo guardado
   tiene que ser campo a campo lo que guardaba el formulario viejo: los objetos de abajo se volcaron
   del localStorage en la base 0184ef82c rellenando los mismos valores (solo cambian id y createdAt). */

const accounts = [
  { id: "tr", ent: "trade_republic", name: "Efectivo", value: 6300, role: "diario", spendFrom: true },
  { id: "sb", ent: "sabadell", name: "Cuenta", value: 2000, role: "fijos" },
];
const settings = { autoPrices: false, theme: "green", expenseBanks: ["trade_republic"] };
const DEUDA_BASE = { ent: "familia", name: "Coche sintético", value: 12000.5, original: 12000.5, monthly: 166.68, asOf: 24318,
  account: "trade_republic", note: "Añadida manualmente", day: 16, months: 48, amort: 166.68, balloon: 4000, downPayment: 1500, startMonth: 24318 };
const META_BASE = { name: "Viaje sintético", emoji: "🎯", target: 3000, saved: 250.5, deadline: "2027-06", monthly: 120, color: "#5FD08A", done: false, doneAt: null };

const estado = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")));
const sinId = (o) => { const c = Object.assign({}, o); delete c.id; delete c.createdAt; return c; };
// Teclea con el teclado propio de la hoja (la coma es el separador decimal en castellano).
const pad = async (hoja, txt) => { for (const ch of txt) await hoja.locator('.v4-keys button[aria-label="' + ch + '"]').click(); };
const deuda = (page) => page.getByTestId("debt-add-form");
const meta = (page) => page.getByTestId("goal-add-form");

async function abrePlan(page, seg) {
  await seedLoggedInDashboard(page, { accounts, settings, debts: [], goals: [], budget: 1000 });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.getByRole("tab", { name: seg, exact: true }).click();
}

test("★ añadir deuda desde la hoja guarda la misma deuda que el formulario viejo", async ({ page }) => {
  await abrePlan(page, "Deudas");
  await page.getByRole("button", { name: "Añadir deuda", exact: true }).click();
  const hoja = deuda(page);
  await expect(hoja).toBeVisible();
  // Lo opcional (entrada, pago final, cuotas pagadas) va plegado bajo «Más datos».
  await expect(hoja.locator('[data-act="mas-datos"]')).toHaveAttribute("aria-expanded", "false");
  await expect(hoja.locator('.pr6-fold:not(.open) [data-debt-add="down"]')).toHaveCount(1);
  await hoja.locator('[data-debt-add="name"]').fill("Coche sintético");
  await hoja.locator('[data-debt-add="value"]').click();
  await pad(hoja, "12000,50");
  await hoja.locator('[data-debt-add="months"]').click();
  await pad(hoja, "48");
  await hoja.locator('[data-debt-add="day"]').click();
  await pad(hoja, "16");
  await hoja.locator('[data-act="mas-datos"]').click();
  // La cuenta nace elegida (la del gasto diario) y se puede cambiar dentro de «Más datos».
  await expect(hoja.locator('[data-debt-add-account="trade_republic"]')).toHaveAttribute("aria-pressed", "true");
  await hoja.locator('[data-debt-add-account="sabadell"]').click();
  await hoja.locator('[data-debt-add-account="trade_republic"]').click();
  await hoja.locator('[data-debt-add="down"]').click();
  await pad(hoja, "1500");
  await hoja.locator('[data-debt-add="balloon"]').click();
  await pad(hoja, "4000");
  await hoja.locator('[data-debt-add="paid"]').click();
  await pad(hoja, "3");
  await hoja.locator('[data-act="hoja-guardar"]').click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).debts || []).length).toBe(1);
  const d = (await estado(page)).debts[0];
  expect(typeof d.id).toBe("string");
  expect(sinId(d)).toEqual(DEUDA_BASE);
});

test("★ la validación sigue igual: sin importe o sin cuota ni plazo no se puede guardar y la hoja se queda", async ({ page }) => {
  await abrePlan(page, "Deudas");
  await page.getByRole("button", { name: "Añadir deuda", exact: true }).click();
  const hoja = deuda(page);
  const guardar = hoja.locator('[data-act="hoja-guardar"]');
  await expect(guardar).toHaveAttribute("aria-disabled", "true");
  await guardar.evaluate((b) => b.click());
  await expect(hoja).toBeVisible();
  await pad(hoja, "900");
  await expect(guardar).toHaveAttribute("aria-disabled", "true");
  await hoja.locator('[data-debt-add="monthly"]').click();
  await pad(hoja, "100");
  await expect(guardar).toHaveAttribute("aria-disabled", "false");
  expect(((await estado(page)).debts || []).length).toBe(0);
});

// Sin metas, la entrada es el botón principal «Crear mi primera meta» (DIS-28, integrado en la 235):
// abre la misma hoja que «+ Nueva meta de ahorro».
test("★ nueva meta desde la hoja, con el calendario de la app, guarda la misma meta", async ({ page }) => {
  await abrePlan(page, "Metas");
  await page.getByRole("button", { name: "Crear mi primera meta", exact: true }).click();
  const hoja = meta(page);
  await expect(hoja).toBeVisible();
  const f = hoja;
  await expect(f.locator('input[type="month"]')).toHaveCount(0);
  await f.locator('[data-goal-add="name"]').fill("Viaje sintético");
  await f.locator('[data-goal-add="target"]').click();
  await pad(f, "3000");
  await f.locator('[data-goal-add="saved"]').click();
  await pad(f, "250,5");
  const fecha = f.locator('[data-goal-add="deadline"]');
  await expect(fecha).toContainText("Sin fecha");
  await fecha.click();
  const cal = f.getByTestId("mc-cal");
  await expect(cal).toBeVisible();
  // De septiembre de 2026 (reloj del fixture) a junio de 2027.
  for (let i = 0; i < 9; i++) await cal.locator(".mc-cal-nav button").last().click();
  await cal.locator(".mc-cal-day", { hasText: /^15$/ }).click();
  await expect(cal).toHaveCount(0);
  await expect(fecha).toContainText(/junio 2027/i);
  await f.locator('[data-act="mas-datos"]').click();
  await f.locator('[data-goal-add="monthly"]').click();
  await pad(f, "120");
  await f.locator('[data-act="hoja-guardar"]').click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).goals || []).length).toBe(1);
  const g = (await estado(page)).goals[0];
  expect(typeof g.id).toBe("string");
  expect(Number.isNaN(Date.parse(g.createdAt))).toBe(false);
  expect(sinId(g)).toEqual(META_BASE);
});

test("cerrar la hoja de meta descarta, como el viejo «Cancelar»", async ({ page }) => {
  await abrePlan(page, "Metas");
  await page.getByRole("button", { name: "Crear mi primera meta", exact: true }).click();
  const hoja = meta(page);
  await pad(hoja, "500");
  await hoja.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(hoja).toHaveCount(0);
  expect(((await estado(page)).goals || []).length).toBe(0);
  await page.getByRole("button", { name: "Crear mi primera meta", exact: true }).click();
  await expect(hoja.locator('[data-goal-add="target"]')).toContainText("0 €");
});

/* Revisión de dinero 235 (M1): la hoja baja animada y el formulario sigue vivo mientras tanto, así
   que un segundo o tercer toque en el botón volvía a dar de alta (3 toques → 3 deudas; la base, 1).
   Los toques van seguidos dentro de la página, sin esperar a Playwright, que es lo que hace un dedo. */
async function tresToques(boton) {
  await boton.evaluate((b) => { b.click(); b.click(); b.click(); });
}

test("★ triple toque en «Añadir deuda» crea UNA deuda", async ({ page }) => {
  await abrePlan(page, "Deudas");
  await page.getByRole("button", { name: "Añadir deuda", exact: true }).click();
  const hoja = deuda(page);
  await pad(hoja, "900");
  await hoja.locator('[data-debt-add="monthly"]').click();
  await pad(hoja, "100");
  await tresToques(hoja.locator('[data-act="hoja-guardar"]'));
  await expect(hoja).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(((await estado(page)).debts || []).length).toBe(1);
  // Y la siguiente alta, con la hoja nueva, vuelve a funcionar.
  await page.getByRole("button", { name: "Añadir deuda", exact: true }).click();
  await expect(hoja.locator('[data-debt-add="value"]')).toContainText("0 €");
  await pad(hoja, "500");
  await hoja.locator('[data-debt-add="monthly"]').click();
  await pad(hoja, "50");
  await hoja.locator('[data-act="hoja-guardar"]').click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).debts || []).length).toBe(2);
});

test("★ triple toque en «Crear meta» crea UNA meta", async ({ page }) => {
  await abrePlan(page, "Metas");
  await page.getByRole("button", { name: "Crear mi primera meta", exact: true }).click();
  const hoja = meta(page);
  await pad(hoja, "800");
  await tresToques(hoja.locator('[data-act="hoja-guardar"]'));
  await expect(hoja).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(((await estado(page)).goals || []).length).toBe(1);
  // Con una meta ya hecha, «+ Añadir» de la cabecera abre la misma hoja.
  await page.locator('[data-act="goal-new"]').click();
  await expect(hoja.locator('[data-goal-add="target"]')).toContainText("0 €");
  await pad(hoja, "300");
  await hoja.locator('[data-act="hoja-guardar"]').click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).goals || []).length).toBe(2);
});
