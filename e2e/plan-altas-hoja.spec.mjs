import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

/* DIS-31 (15/11/2026): «Añadir deuda» y «Nueva meta» pasan de abrirse dentro de la lista a una hoja
   con etiquetas, y la fecha límite usa el calendario de la app. CREAN DINERO, así que lo guardado
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
  const hoja = page.locator(".v4-sheet.plan-edit-sheet");
  await expect(hoja).toBeVisible();
  const f = hoja.getByTestId("debt-add-form");
  // Cada campo tiene su etiqueta: se rellena por ella, no por el texto de ejemplo.
  await f.getByLabel("Nombre", { exact: true }).fill("Coche sintético");
  await f.getByLabel("Importe €", { exact: true }).fill("12000,50");
  await expect(f.getByLabel("Cuota al mes (€)", { exact: true })).toHaveAttribute("placeholder", "Vacía si es al 0 %");
  await f.getByLabel("Plazo (meses)", { exact: true }).fill("48");
  await f.getByLabel("Día", { exact: true }).fill("16");
  await f.locator("label", { hasText: "Cuenta" }).locator("select").selectOption("trade_republic");
  await f.getByLabel("Entrada € (opcional)", { exact: true }).fill("1500");
  await f.getByLabel("Pago final € (coche)", { exact: true }).fill("4000");
  await f.getByLabel("Cuotas ya pagadas", { exact: true }).fill("3");
  await f.getByRole("button", { name: "Añadir deuda", exact: true }).click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).debts || []).length).toBe(1);
  const d = (await estado(page)).debts[0];
  expect(typeof d.id).toBe("string");
  expect(sinId(d)).toEqual(DEUDA_BASE);
});

test("★ la validación sigue igual: sin importe no crea nada y la hoja se queda", async ({ page }) => {
  await abrePlan(page, "Deudas");
  await page.getByRole("button", { name: "Añadir deuda", exact: true }).click();
  const hoja = page.locator(".v4-sheet.plan-edit-sheet");
  await hoja.getByTestId("debt-add-form").getByRole("button", { name: "Añadir deuda", exact: true }).click();
  await expect(page.getByText("Falta el importe total de la deuda").first()).toBeVisible();
  await expect(hoja).toBeVisible();
  expect(((await estado(page)).debts || []).length).toBe(0);
});

// Sin metas, la entrada es el botón principal «Crear mi primera meta» (DIS-28, integrado en la 235):
// abre la misma hoja que «+ Nueva meta de ahorro».
test("★ nueva meta desde la hoja, con el calendario de la app, guarda la misma meta", async ({ page }) => {
  await abrePlan(page, "Metas");
  await page.getByRole("button", { name: "Crear mi primera meta", exact: true }).click();
  const hoja = page.locator(".v4-sheet.plan-edit-sheet");
  await expect(hoja).toBeVisible();
  const f = hoja.getByTestId("goal-add-form");
  await expect(f.locator('input[type="month"]')).toHaveCount(0);
  await f.getByLabel("Nombre", { exact: true }).fill("Viaje sintético");
  await f.getByLabel("Objetivo €", { exact: true }).fill("3000");
  await f.getByLabel("Ya ahorrado €", { exact: true }).fill("250,5");
  const fecha = f.locator('[data-goal-add="deadline"]');
  await expect(fecha).toHaveText("Sin fecha");
  await fecha.click();
  const cal = f.getByTestId("mc-cal");
  await expect(cal).toBeVisible();
  // De septiembre de 2026 (reloj del fixture) a junio de 2027.
  for (let i = 0; i < 9; i++) await cal.locator(".mc-cal-nav button").last().click();
  await cal.locator(".mc-cal-day", { hasText: /^15$/ }).click();
  await expect(cal).toHaveCount(0);
  await expect(fecha).toHaveText(/junio 2027/i);
  await f.getByLabel("Aporte al mes € (opcional)", { exact: true }).fill("120");
  await f.getByRole("button", { name: "Crear meta", exact: true }).click();
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
  const hoja = page.locator(".v4-sheet.plan-edit-sheet");
  await hoja.getByTestId("goal-add-form").getByLabel("Objetivo €", { exact: true }).fill("500");
  await hoja.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(hoja).toHaveCount(0);
  expect(((await estado(page)).goals || []).length).toBe(0);
  await page.getByRole("button", { name: "Crear mi primera meta", exact: true }).click();
  await expect(hoja.getByTestId("goal-add-form").getByLabel("Objetivo €", { exact: true })).toHaveValue("");
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
  const hoja = page.locator(".v4-sheet.plan-edit-sheet");
  const f = hoja.getByTestId("debt-add-form");
  await f.getByLabel("Importe €", { exact: true }).fill("900");
  await f.getByLabel("Cuota al mes (€)", { exact: true }).fill("100");
  await tresToques(f.getByRole("button", { name: "Añadir deuda", exact: true }));
  await expect(hoja).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(((await estado(page)).debts || []).length).toBe(1);
  // Y la siguiente alta, con la hoja nueva, vuelve a funcionar.
  await page.getByRole("button", { name: "Añadir deuda", exact: true }).click();
  await f.getByLabel("Importe €", { exact: true }).fill("500");
  await f.getByLabel("Cuota al mes (€)", { exact: true }).fill("50");
  await f.getByRole("button", { name: "Añadir deuda", exact: true }).click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).debts || []).length).toBe(2);
});

test("★ triple toque en «Crear meta» crea UNA meta", async ({ page }) => {
  await abrePlan(page, "Metas");
  await page.getByRole("button", { name: "Crear mi primera meta", exact: true }).click();
  const hoja = page.locator(".v4-sheet.plan-edit-sheet");
  const f = hoja.getByTestId("goal-add-form");
  await f.getByLabel("Objetivo €", { exact: true }).fill("800");
  await tresToques(f.getByRole("button", { name: "Crear meta", exact: true }));
  await expect(hoja).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(((await estado(page)).goals || []).length).toBe(1);
  await page.getByRole("button", { name: /Nueva meta|Crear mi primera meta/ }).first().click();
  await f.getByLabel("Objetivo €", { exact: true }).fill("300");
  await f.getByRole("button", { name: "Crear meta", exact: true }).click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).goals || []).length).toBe(2);
});
