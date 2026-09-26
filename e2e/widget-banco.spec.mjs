import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function bridge(page) {
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => false, Plugins: {
      MiCartera: new Proxy({ updateWidget: async data => { window.__widgetSnapshot = data; },
        addListener: async () => ({ remove() {} }) },
      { get: (target, key) => target[key] || (() => Promise.resolve({})) }),
    } };
  });
}
async function settings(page) {
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator(".v4-avatar").click();
  await page.getByRole("button", { name: /Ir a Ajustes/i }).click();
  const panel = page.locator(".settings-push.open");
  await panel.getByRole("button", { name: /Banco del widget/ }).click();
  return panel;
}

test("elegir otro banco actualiza el widget aunque tenga el mismo saldo y persiste", async ({ page }) => {
  const accounts = [
    { id: "caixa", ent: "caixabank", role: "diario", spendFrom: true, value: 500 },
    { id: "sabadell", ent: "sabadell", role: "fijos", value: 500 },
  ];
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 100, accounts,
    settings: { autoPrices: false, theme: "green", expenseBanks: ["caixabank"] } });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("caixabank");
  const panel = await settings(page);
  await panel.getByRole("combobox", { name: "Banco del widget" }).selectOption("sabadell");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("sabadell");
  expect(await page.evaluate(() => ({ cash: window.__widgetSnapshot.cash,
    left: window.__widgetSnapshot.budgetLeft, afford: window.__widgetSnapshot.afford })))
    .toEqual({ cash: 500, left: 100, afford: 100 });
  await expect(panel.getByRole("combobox", { name: "Banco del widget" })).toHaveValue("sabadell");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).settings.widgetBank)).toBe("sabadell");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).accounts)).toEqual(accounts);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).settings.expenseBanks)).toEqual(["caixabank"]);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("sabadell");
  const again = await settings(page);
  await again.getByRole("combobox", { name: "Banco del widget" }).selectOption("");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("caixabank");
});

test("el límite usa la liquidez del banco elegido y suma sus cuentas sin duplicar opciones", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-26T10:00:00Z") });
  await seedLoggedInDashboard(page, { budget: 500,
    accounts: [
      { id: "a", ent: "caixabank", role: "diario", spendFrom: true, value: 900 },
      { id: "b", ent: "sabadell", role: "fijos", value: 120 },
      { id: "c", ent: "sabadell", role: "fijos", value: 80 },
      { id: "cash", ent: "efectivo", value: 60 },
      { id: "family", ent: "familia", value: 25 },
    ], fixed: [{ id: "f", name: "Recibo", amount: 75, freq: "mes", account: "sabadell", day: 28 }],
    settings: { autoPrices: false, widgetBank: "sabadell" } });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cash)).toBe(200);
  expect(await page.evaluate(() => ({ bank: window.__widgetSnapshot.cashEnt,
    safe: window.__widgetSnapshot.safeLiq, afford: window.__widgetSnapshot.afford })))
    .toEqual({ bank: "sabadell", safe: 125, afford: 125 });
  const panel = await settings(page);
  await expect(panel.getByRole("option", { name: "Sabadell", exact: true })).toHaveCount(1);
  await expect(panel.getByRole("option", { name: /Efectivo|Familia/ })).toHaveCount(0);
});

for (const chosen of ["sabadell", "efectivo", "familia"]) {
test("banco ausente o no bancario vuelve a la cuenta diaria: " + chosen, async ({ page }) => {
  await seedLoggedInDashboard(page, { settings: { autoPrices: false, widgetBank: chosen },
    accounts: [{ id: "a", ent: "caixabank", role: "diario", spendFrom: true, value: 90 },
      { id: "cash", ent: "efectivo", value: 60 }, { id: "family", ent: "familia", value: 25 }] });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("caixabank");
  const panel = await settings(page);
  await expect(panel.getByRole("combobox", { name: "Banco del widget" })).toHaveValue("");
});
}

// El filtro de la elección no puede quitar una cuenta diaria que ya alimentaba el widget.
test("automático conserva Efectivo como cuenta diaria incluso con una elección antigua inválida", async ({ page }) => {
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 500,
    accounts: [{ id: "cash", ent: "efectivo", role: "diario", spendFrom: true, value: 200 },
      { id: "bank", ent: "sabadell", role: "fijos", value: 900 }] });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("efectivo");
  expect(await page.evaluate(() => ({ cash: window.__widgetSnapshot.cash, safe: window.__widgetSnapshot.safeLiq })))
    .toEqual({ cash: 200, safe: 200 });
  const panel = await settings(page);
  await expect(panel.getByRole("combobox", { name: "Banco del widget" })).toHaveValue("");
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("micartera_v3"));
    saved.settings.widgetBank = "efectivo";
    localStorage.setItem("micartera_v3", JSON.stringify(saved));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("efectivo");
  const again = await settings(page);
  await expect(again.getByRole("combobox", { name: "Banco del widget" })).toHaveValue("");
  await expect(again.getByRole("option", { name: "Efectivo", exact: true })).toHaveCount(0);
});
