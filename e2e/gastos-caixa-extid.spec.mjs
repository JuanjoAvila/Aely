import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* INC-2709-06. Dos cargos del mismo banco, día, importe y comercio tienen que verse los dos
   en Gastos, con el filtro de bancos de gasto diario y el mes en curso, en los tres idiomas.
   El comercio no se traduce; la categoría sí. Reloj de fixture: 26/9/2026. */

const day = "2026-09-26";
const noon = new Date(day + "T12:00:00").toISOString();
const salt = new Date(day + "T18:30:00").toISOString();
const accounts = [{ id: "cx", ent: "caixabank", name: "Caixa", value: 400, role: "diario", spendFrom: true }];
const expenses = [
  { id: "e-caixa-a", date: noon, amount: 12.5, merchant: "MERCADONA", category: "super", source: "ob", ent: "caixabank", extId: "cargo-A" },
  { id: "e-caixa-b", date: salt, amount: 12.5, merchant: "MERCADONA", category: "super", source: "ob", ent: "caixabank", extId: "cargo-B" },
];

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

for (const caso of [
  { lang: "es", cat: "Supermercado" },
  { lang: "en", cat: "Groceries" },
  { lang: "ca", cat: "Supermercat" },
]) {
  test("Gastos enseña los dos cargos Caixa del mismo día (" + caso.lang + ")", async ({ page }) => {
    await seedLoggedInDashboard(page, {
      accounts,
      expenses,
      settings: { autoPrices: false, lang: caso.lang, budgetCycle: false, expenseBanks: ["caixabank"] },
    });
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    const filas = page.locator(".v4-gastos-list-body button.v4-mov");
    await expect(filas).toHaveCount(2);
    await expect(filas.nth(0)).toContainText("MERCADONA");
    await expect(filas.nth(1)).toContainText("MERCADONA");
    await expect(filas.nth(0)).toContainText(caso.cat);
    await expect(filas.nth(1)).toContainText(caso.cat);
    await expect(page.locator('.v4-gastos-list-body button.v4-mov[data-expense-id="e-caixa-a"]')).toHaveCount(1);
    await expect(page.locator('.v4-gastos-list-body button.v4-mov[data-expense-id="e-caixa-b"]')).toHaveCount(1);
  });
}

test("sync a demanda sin altas: el sello nuevo sigue tras recargar y no duplica", async ({ page }) => {
  const feed = {
    ok: true,
    links: [{
      aspsp: "CaixaBank",
      ok: true,
      accounts: [{
        uid: "cx-unica",
        ok: true,
        balances: [{ type: "ITAV", amount: 400, currency: "EUR" }],
        transactions: [
          { ext_id: "cargo-B", date: day, amount: 12.5, merchant: "MERCADONA", status: "BOOK" },
          { ext_id: "cargo-A", date: day, amount: 12.5, merchant: "MERCADONA", status: "BOOK" },
        ],
      }],
    }],
  };
  await seedLoggedInDashboard(page, {
    __seedOnce: true,
    hasBankLink: true,
    accounts,
    expenses: [
      { id: "e-caixa-a", date: noon, amount: 12.5, merchant: "MERCADONA", obName: "MERCADONA", category: "super", source: "ob", ent: "caixabank", extId: "cargo-A" },
      { id: "e-caixa-b", date: noon, amount: 12.5, merchant: "MERCADONA", obName: "MERCADONA", category: "super", source: "ob", ent: "caixabank", extId: "cargo-B" },
    ],
    settings: { autoPrices: false, lang: "es", budgetCycle: false, expenseBanks: ["caixabank"] },
    __cloudFns: { "bank-sync": { data: feed, error: null } },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: /Sincronizar bancos/i }).click();
  await expect.poll(async () => page.evaluate((d) => {
    const rows = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
    const b = rows.find((e) => e && e.extId === "cargo-B");
    return !!(b && b.date === histDate(d, "ob-ext|caixabank|cargo-B"));
  }, day)).toBe(true);
  const antes = await page.evaluate((d) => {
    const rows = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
    const a = rows.find((e) => e.extId === "cargo-A");
    const b = rows.find((e) => e.extId === "cargo-B");
    return {
      n: rows.length,
      ids: rows.map((e) => e.extId).sort().join(","),
      rowIds: rows.map((e) => e.id).sort().join(","),
      a: a && a.date,
      b: b && b.date,
      noon: histDate(d),
      salt: histDate(d, "ob-ext|caixabank|cargo-B"),
    };
  }, day);
  expect(antes.n).toBe(2);
  expect(antes.ids).toBe("cargo-A,cargo-B");
  expect(antes.rowIds).toBe("e-caixa-a,e-caixa-b");
  expect(antes.a).toBe(antes.noon);
  expect(antes.b).toBe(antes.salt);
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  const despues = await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
    return {
      n: rows.length,
      ids: rows.map((e) => e && e.extId).sort().join(","),
      rowIds: rows.map((e) => e && e.id).sort().join(","),
      a: (rows.find((e) => e.extId === "cargo-A") || {}).date,
      b: (rows.find((e) => e.extId === "cargo-B") || {}).date,
    };
  });
  expect(despues).toEqual({ n: 2, ids: "cargo-A,cargo-B", rowIds: "e-caixa-a,e-caixa-b", a: antes.a, b: antes.b });
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const filas = page.locator(".v4-gastos-list-body button.v4-mov");
  await expect(filas).toHaveCount(2);
  await expect(filas.nth(0)).toContainText("MERCADONA");
  await expect(filas.nth(1)).toContainText("MERCADONA");
  await expect(page.locator('.v4-gastos-list-body button.v4-mov[data-expense-id="e-caixa-a"]')).toHaveCount(1);
  await expect(page.locator('.v4-gastos-list-body button.v4-mov[data-expense-id="e-caixa-b"]')).toHaveCount(1);
});
