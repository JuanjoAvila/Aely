import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, FIXTURE_NOW, installFixtureClock, gastosAbreGasto } from "./fixtures.mjs";

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

/* DIS-11 (15/11/2026): la ficha Modificar tenía dos mandos para lo mismo, el Gasto/Ingreso de
   arriba y la fila «Es un ingreso, no un gasto». Se queda el de arriba. TOCA DINERO (el signo del
   importe), así que lo que se guarda tiene que ser IDÉNTICO al de la fila vieja: el objeto
   esperado de abajo se sacó en la base 0184ef82c pulsando la fila, y salía igual por el mando. */

const hoy = new Date(FIXTURE_NOW);
const iso = (d) => new Date(hoy.getFullYear(), hoy.getMonth(), d, 12).toISOString();
const accounts = [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 6300, role: "diario", spendFrom: true }];
const settings = { autoPrices: false, theme: "green", expenseBanks: ["trade_republic"] };
const otro = { id: "e3", date: iso(hoy.getDate()), amount: 30, merchant: "Mercadona", category: "super", source: "macrodroid", ent: "trade_republic" };
const manual = { id: "e4", date: iso(hoy.getDate()), amount: 12.5, merchant: "Panadería", category: "super", source: "manual", ent: "trade_republic" };
// Lo que dejaba la fila vieja en la base 0184ef82c (volcado real del localStorage).
const ESPERADO_INGRESO = { id: "e4", date: manual.date, amount: -12.5, merchant: "Panadería", category: "ingreso", source: "manual", ent: "trade_republic", noCard: true };

const gastos = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "null") || JSON.parse(localStorage.getItem("micartera_v3")).expenses);

async function abreFicha(page) {
  await seedLoggedInDashboard(page, { accounts, settings, expenses: [otro, manual], budget: 1000 });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await gastosAbreGasto(page, "Panadería");
  const sheet = page.locator(".v4-exp-sheet");
  await expect(sheet).toBeVisible();
  return sheet;
}

test("★ Gasto/Ingreso de arriba guarda lo mismo que la fila vieja, y la fila ya no está", async ({ page }) => {
  const sheet = await abreFicha(page);
  await expect(sheet.locator(".v4-ficha-ajuste").filter({ hasText: /ingreso/i })).toHaveCount(0);
  const seg = sheet.locator(".v4-ficha-seg .v4-seg-btn");
  await seg.nth(1).click();
  await expect(seg.nth(1)).toHaveClass(/\bon\b/);
  await sheet.locator(".v4-ficha-done").click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(async () => (await gastos(page)).find((e) => e.id === "e4")).toEqual(ESPERADO_INGRESO);
  // Ninguna otra cifra guardada se mueve.
  expect((await gastos(page)).find((e) => e.id === "e3")).toEqual(otro);
});

test("★ volver a Gasto restaura el signo y la categoría, como hacía la fila", async ({ page }) => {
  const sheet = await abreFicha(page);
  const seg = sheet.locator(".v4-ficha-seg .v4-seg-btn");
  await seg.nth(1).click();
  await expect.poll(async () => (await gastos(page)).find((e) => e.id === "e4").amount).toBe(-12.5);
  await seg.nth(0).click();
  await expect.poll(async () => (await gastos(page)).find((e) => e.id === "e4").amount).toBe(12.5);
  const e4 = (await gastos(page)).find((e) => e.id === "e4");
  // Mismo saveEdit({income:false}) que la fila: categoría automática y noCard se conserva.
  expect(e4.category).not.toBe("ingreso");
  expect(e4.noCard).toBe(true);
  expect((await gastos(page)).find((e) => e.id === "e3")).toEqual(otro);
});
