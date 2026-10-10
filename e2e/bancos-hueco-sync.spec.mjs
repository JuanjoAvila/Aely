import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, FIXTURE_NOW } from "./fixtures.mjs";

const day = "2026-07-20";
const links = [{
  aspsp: "CaixaBank", ok: true, syncFrom: "2026-07-10", gapBeyondCap: true,
  accounts: [{ uid: "cx", ok: true, balances: [{ type: "ITAV", amount: 80, currency: "EUR" }], transactions: [
    { ext_id: "cx-nueva", date: day, amount: 14.2, merchant: "Farmacia Norte", status: "BOOK", card: true },
    { ext_id: "cx-noti", date: day, amount: 22.15, merchant: "Mercadona", status: "BOOK", card: true },
    { ext_id: "cx-hist", date: day, amount: 9.9, merchant: "Seguro ya", status: "BOOK", card: true },
    { ext_id: "cx-fuera", date: "2026-06-01", amount: 5, merchant: "Demasiado viejo", status: "BOOK", card: true },
  ] }],
}, {
  aspsp: "Banco de Sabadell", ok: true, syncFrom: "2026-08-01", gapBeyondCap: false,
  accounts: [{ uid: "sb", ok: true, balances: [{ type: "ITAV", amount: 40, currency: "EUR" }], transactions: [
    { ext_id: "sb-mano", date: "2026-08-10", amount: 6.5, merchant: "Bar Paco", status: "BOOK", card: true },
    { ext_id: "sb-nueva", date: "2026-08-10", amount: 3.4, merchant: "Panadería Sol", status: "BOOK", card: true },
  ] }],
}];

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

test("el sync a demanda recupera el hueco, no duplica y avisa si supera 90 días", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    hasBankLink: true,
    accounts: [
      { id: "cx", ent: "caixabank", name: "Caixa", role: "diario", value: 80 },
      { id: "sb", ent: "sabadell", name: "Sabadell", role: "extra", value: 40 },
    ],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["caixabank", "sabadell"] },
    expenses: [
      { id: "noti", date: day + "T12:00:00.000Z", amount: 22.15, merchant: "Mercadona", category: "super", source: "wallet", ent: "caixabank" },
      { id: "hist", date: day + "T12:00:00.000Z", amount: 9.9, merchant: "Seguro ya", category: "otros", source: "ob-hist", ent: "caixabank", extId: "cx-hist" },
      { id: "mano", date: "2026-08-10T12:00:00.000Z", amount: 6.5, merchant: "Bar Paco", category: "bares", source: "manual", ent: "sabadell" },
    ],
    fixed: [], debts: [], oneoffs: [], flows: [], bankTx: [],
    __cloudRows: { bank_links: [
      { aspsp_name: "CaixaBank", status: "active", last_sync: "2026-05-01T00:00:00Z" },
      { aspsp_name: "Banco de Sabadell", status: "active", last_sync: "2026-09-01T00:00:00Z" },
    ] },
    __cloudFns: { "bank-sync": { data: { ok: true, links }, error: null } },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  expect(await page.evaluate(() => (window.__e2eInvokes || []).filter((x) => x.name === "bank-sync").length)).toBe(0);

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: /Sincronizar bancos/i }).click();

  const ask = page.locator(".askback");
  await expect(ask).toBeVisible({ timeout: 15_000 });
  await expect(ask.locator("#ask-dialog-title")).toContainText("CaixaBank");
  await expect(ask.locator("#ask-dialog-title")).toContainText("más de 90 días");
  await expect(ask).toContainText("Importar histórico");

  const calls = await page.evaluate(() => (window.__e2eInvokes || []).filter((x) => x.name === "bank-sync"));
  expect(calls).toHaveLength(1);
  expect(calls[0].body).toEqual({ recoverGaps: true });

  await expect.poll(() => page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
    return rows.map((e) => e.merchant).sort();
  })).toEqual(["Bar Paco", "Farmacia Norte", "Mercadona", "Panadería Sol", "Seguro ya"]);
  const farma = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").find((e) => e.merchant === "Farmacia Norte"));
  expect(String(farma.date).slice(0, 10)).toBe(day);
  expect(farma.amount).toBe(14.2);

  await ask.locator("button.btn-primary").click();
  await expect(page.locator(".hist-import")).toBeVisible({ timeout: 15_000 });
  expect(FIXTURE_NOW).toBe(Date.parse("2026-09-26T12:00:00Z"));
});
