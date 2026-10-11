import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

const day = "2026-07-20";
const balanceAt = "2026-09-26T11:59:30.000Z";
const links = [{
  aspsp: "CaixaBank", ok: true, syncFrom: "2026-07-10", gapBeyondCap: true, gapPending: true, balanceAt,
  accounts: [{ uid: "cx", ok: true, balances: [{ type: "ITAV", amount: 80, currency: "EUR" }], transactions: [
    { ext_id: "cx-nueva", date: day, amount: 14.2, merchant: "Farmacia Norte", status: "BOOK", card: true },
    { ext_id: "cx-noti", date: day, amount: 22.15, merchant: "Mercadona", status: "BOOK", card: true },
    { ext_id: "cx-hist", date: day, amount: 9.9, merchant: "Seguro ya", status: "BOOK", card: true },
    { ext_id: "cx-fuera", date: "2026-06-01", amount: 5, merchant: "Demasiado viejo", status: "BOOK", card: true },
  ] }],
}, {
  aspsp: "Banco de Sabadell", ok: true, syncFrom: "2026-08-01", gapBeyondCap: false, gapPending: false, balanceAt,
  accounts: [{ uid: "sb", ok: true, balances: [{ type: "ITAV", amount: 40, currency: "EUR" }], transactions: [
    { ext_id: "sb-mano", date: "2026-08-10", amount: 6.5, merchant: "Bar Paco", status: "BOOK", card: true },
    { ext_id: "sb-nueva", date: "2026-08-10", amount: 3.4, merchant: "Panadería Sol", status: "BOOK", card: true },
  ] }],
}];
const syncCalls = (page) => page.evaluate(() => (window.__e2eInvokes || []).filter((x) => x.name === "bank-sync"));

async function abre(page, overrides) {
  await seedLoggedInDashboard(page, Object.assign({
    hasBankLink: true,
    accounts: [{ id: "cx", ent: "caixabank", name: "Caixa", role: "diario", value: 80 }],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["caixabank"] },
    expenses: [], fixed: [], debts: [], oneoffs: [], flows: [], bankTx: [],
    __cloudRows: { bank_links: [{ aspsp_name: "CaixaBank", status: "active", last_sync: "2026-05-01T00:00:00Z" }] },
    __cloudFns: { "bank-sync": { data: { ok: true, links: [links[0]] }, error: null } },
  }, overrides || {}));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

test("el sync a demanda recupera el hueco, no duplica y dice sin diálogo lo que el banco ya no entrega", async ({ page }) => {
  await abre(page, {
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
    __cloudRows: { bank_links: [
      { aspsp_name: "CaixaBank", status: "active", last_sync: "2026-05-01T00:00:00Z" },
      { aspsp_name: "Banco de Sabadell", status: "active", last_sync: "2026-09-01T00:00:00Z" },
    ] },
    __cloudFns: { "bank-sync": { data: { ok: true, links }, error: null } },
  });
  expect(await syncCalls(page)).toHaveLength(0);

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: /Sincronizar bancos/i }).click();

  const report = page.locator(".sync-report");
  await expect(report).toBeVisible({ timeout: 15_000 });
  const cap = report.locator(".sync-report-row", { hasText: "más de 90 días" });
  await expect(cap).toHaveCount(1);
  await expect(cap).toContainText("CaixaBank");
  await expect(cap).toContainText("solo entrega los últimos 90 días");
  await expect(cap).toContainText("no está disponible por esta vía");
  await expect(report).not.toContainText("Importar histórico");
  // Lo que queda por traer usa el aviso de lectura incompleta de siempre: otra pulsación sigue.
  const more = report.locator(".sync-report-row", { hasText: "la descarga está incompleta" });
  await expect(more).toHaveCount(1);
  await expect(more).toContainText("CaixaBank");
  await expect(page.locator(".askback")).toHaveCount(0);

  const calls = await syncCalls(page);
  expect(calls).toHaveLength(1);
  expect(calls[0].body).toEqual({ recoverGaps: true });

  await expect.poll(() => page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
    return rows.map((e) => e.merchant).sort();
  })).toEqual(["Bar Paco", "Farmacia Norte", "Mercadona", "Panadería Sol", "Seguro ya"]);
  const farma = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").find((e) => e.merchant === "Farmacia Norte"));
  expect(String(farma.date).slice(0, 10)).toBe(day);
  expect(farma.amount).toBe(14.2);
});

test("«Saldo actualizado» pinta la hora en que se leyó el saldo, no el cursor del extracto", async ({ page }) => {
  await abre(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: /Sincronizar bancos/i }).click();
  await expect(page.locator(".sync-report")).toBeVisible({ timeout: 15_000 });
  await page.locator(".sync-report-back").click({ position: { x: 5, y: 5 } });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  const meta = page.locator('[data-aspsp="CaixaBank"] .meta').first();
  await expect(meta).toBeVisible({ timeout: 15_000 });
  const [leido, cursor] = await page.evaluate((iso) => [new Date(iso).toLocaleString(), new Date("2026-05-01T00:00:00Z").toLocaleString()], balanceAt);
  await expect(meta).toContainText(leido);
  await expect(meta).not.toContainText(cursor);
});

test("el aviso no deja la sincronización atascada: se puede volver a pulsar", async ({ page }) => {
  await abre(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const pulsa = () => page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((el) => /sincronizar bancos/i.test(el.getAttribute("aria-label") || ""));
    if (b) b.click();
  });
  await pulsa();
  await expect(page.locator(".sync-report")).toContainText("más de 90 días", { timeout: 15_000 });
  await pulsa();
  await expect.poll(async () => (await syncCalls(page)).length).toBe(2);
});

test("un sync que no has pedido tú no enseña avisos del tramo", async ({ page }) => {
  await abre(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-bank-role-changed")));
  await expect.poll(async () => (await syncCalls(page)).length).toBe(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").length)).toBe(3);
  await expect(page.locator(".askback")).toHaveCount(0);
  await expect(page.locator(".sync-report")).toHaveCount(0);
  await expect(page.getByText(/más de 90 días|la descarga está incompleta/)).toHaveCount(0);
});
