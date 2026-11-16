import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, FIXTURE_NOW, installFixtureClock, gastosAbreGasto } from "./fixtures.mjs";

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

/* DIS-10 (lote 235) precarga el importe de Modificar con dos decimales (`montoEditable`). Revisión
   de dinero 235 (NO-GO leve): un gasto con MÁS de dos decimales (12,345, el cambio de una divisa)
   se precargaba redondeado, y guardar la ficha sin tocar el importe lo reescribía a 12,35 y, como el
   importe «cambiaba», borraba también el rastro de la divisa (origAmount/origCur). Reabrir y
   guardar no puede mover el dinero. */

const hoy = new Date(FIXTURE_NOW);
const iso = (d) => new Date(hoy.getFullYear(), hoy.getMonth(), d, 12).toISOString();
const accounts = [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 6300, role: "diario", spendFrom: true }];
const settings = { autoPrices: false, theme: "green", expenseBanks: ["trade_republic"] };
const gastos = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "null") || JSON.parse(localStorage.getItem("micartera_v3")).expenses);

for (const amount of [12.345, 1.005, 99.999]) {
  test(`★ reabrir y guardar un gasto de ${amount} no redondea ni pierde la divisa`, async ({ page }) => {
    const gasto = { id: "fx1", date: iso(hoy.getDate()), amount, merchant: "Librería", category: "ocio", source: "manual", ent: "trade_republic", origAmount: 14.2, origCur: "USD" };
    await seedLoggedInDashboard(page, { accounts, settings, expenses: [gasto], budget: 1000 });
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await gastosAbreGasto(page, "Librería");
    const sheet = page.locator(".v4-exp-sheet");
    await expect(sheet).toBeVisible();
    // Se guarda de verdad: cambia el concepto y se cierra con «Hecho».
    await sheet.locator(".v4-ficha-concept").fill("Librería centro");
    await sheet.locator(".v4-ficha-concept").press("Enter");
    await sheet.locator(".v4-ficha-done").click();
    await expect(sheet).toHaveCount(0);
    await expect.poll(async () => (await gastos(page)).find((e) => e.id === "fx1").merchant).toBe("Librería centro");
    const e = (await gastos(page)).find((x) => x.id === "fx1");
    expect(e.amount).toBe(amount);
    expect(e.origAmount).toBe(14.2);
    expect(e.origCur).toBe("USD");
  });
}
