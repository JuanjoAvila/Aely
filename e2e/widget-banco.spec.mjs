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

test("FIN-05: app y widget excluyen lápidas conservadas al reabrir después de un pago", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-27T10:00:00Z") });
  const expenses = [
    { id: "live", date: "2026-09-02T10:00:00Z", amount: 181, merchant: "Compra ficticia", category: "super", source: "macrodroid" },
    { id: "gone-out", date: "2026-09-03T10:00:00Z", amount: 3, merchant: "Borrado ficticio", category: "bares", source: "ob:trade_republic" },
    { id: "gone-in", date: "2026-09-04T10:00:00Z", amount: -15, merchant: "Ingreso borrado", category: "ingreso", source: "ob:trade_republic" },
  ];
  const deleted = expenses.slice(1).map(e => e.date.slice(0, 10) + "|" + e.amount + "|" + e.merchant);
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000, expenses, deleted,
    accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 2000 }],
    settings: { autoPrices: false, gTotalMode: "net" } });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.budgetLeft)).toBe(819);
  await dismissNews(page);
  // page-live también monta Gastos como vecino: comprobar Inicio, no ambas listas juntas.
  const inicio = page.locator('.page').filter({ has: page.locator('.v4-inicio-head') });
  await expect(inicio.locator('.v4-mov').filter({ hasText: "Compra ficticia" })).toHaveCount(1);
  await expect(inicio.locator('.v4-mov').filter({ hasText: /Borrado ficticio|Ingreso borrado/ })).toHaveCount(0);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const bar = page.locator('.v4-gastos-progress[role="progressbar"]');
  await expect(bar).toHaveAttribute("aria-valuenow", "181");
  await expect(page.locator('[data-expense-id="live"]')).toBeVisible();
  await expect(page.locator('[data-expense-id="gone-out"]')).toHaveCount(0);
  await expect(page.locator('[data-expense-id="gone-in"]')).toHaveCount(0);
  const beforeCash = await page.evaluate(() => ({ cash: window.__widgetSnapshot.cash, safe: window.__widgetSnapshot.safeLiq }));
  // El pago entra con la app cerrada; las filas antiguas permanecen para probar la contabilidad.
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("micartera_v3_exp"));
    rows.push({ id: "pay", date: "2026-09-27T10:00:00Z", amount: 5.45,
      merchant: "Pago ficticio", category: "super", source: "macrodroid" });
    localStorage.setItem("micartera_v3_exp", JSON.stringify(rows));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.budgetLeft)).toBe(813.55);
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(bar).toHaveAttribute("aria-valuenow", "186.45");
  const afterCash = await page.evaluate(() => ({ cash: window.__widgetSnapshot.cash, safe: window.__widgetSnapshot.safeLiq }));
  expect(afterCash.cash).toBeCloseTo(beforeCash.cash - 5.45, 2);
  expect(afterCash.safe).toBeCloseTo(beforeCash.safe - 5.45, 2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).deleted)).toEqual(deleted);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp")).length)).toBe(4);
});

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

/* INC-2909-01 (30/9): «el widget solo enseña Balance». Sus textos (APK) dicen «ESTE MES» y
   «gastado»; en modo Balance recibía |ingresos − gasto| y la nómina se pintaba como gasto.
   El widget manda ahora el gasto bruto del mes natural, igual que Inicio fuera de Mi ciclo. */
const INICIO = [
  { lang: "es", spent: "Has gastado" },
  { lang: "en", spent: "You've spent" },
  { lang: "ca", spent: "Has gastat" },
];
const MES_CON_NOMINA = [
  { id: "nomina", date: "2026-09-05T10:00:00Z", amount: -2000, merchant: "Nómina ficticia", category: "ingreso", ent: "trade_republic" },
  { id: "super", date: "2026-09-06T10:00:00Z", amount: 600, merchant: "Súper ficticio", category: "super", ent: "trade_republic" },
];
for (const caso of INICIO) {
  test(`widget y Inicio dicen el mismo gasto del mes en modo Balance (${caso.lang})`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-27T10:00:00Z") });
    await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000, expenses: MES_CON_NOMINA,
      accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 2000 }],
      settings: { autoPrices: false, lang: caso.lang, gTotalMode: "net", budgetCycle: false } });
    await bridge(page);
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(600);
    expect(await page.evaluate(() => window.__widgetSnapshot.budgetLeft)).toBe(400);
    await page.waitForFunction(() => !document.getElementById("mc-load"));
    await dismissNews(page);
    await expect(page.locator(".v4-budget .ph")).toContainText(caso.spent + " 600");
  });
}

test("con Mi ciclo activo el widget sigue en su mes natural, que es lo que dicen sus textos", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-27T10:00:00Z") });
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000,
    expenses: [{ id: "antes", date: "2026-09-02T10:00:00Z", amount: 250, merchant: "Compra anterior", category: "super", ent: "trade_republic" }]
      .concat(MES_CON_NOMINA.map((e) => Object.assign({}, e, { merchant: e.id === "nomina" ? "NOMINA EMPRESA" : e.merchant }))),
    accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 2000 }],
    settings: { autoPrices: false, gTotalMode: "net", budgetCycle: true, expenseBanks: ["trade_republic"] } });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(850);
  const snap = await page.evaluate(() => ({ start: window.__widgetSnapshot.periodStart, month: inicioDeMesMs(Date.now()) }));
  expect(snap.start).toBe(snap.month);
});

/* INC-2909-01 E2: un widget que declara el contrato v2 recibe la ventana y la cifra de Inicio:
   el ciclo desde el cobro en neto (sin la nómina que lo abre) o el mes en bruto, y su idioma.
   La app deja además la ventana en app_state para que `ingest` la siga con la app cerrada. */
async function bridgeV2(page) {
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => false, Plugins: {
      MiCartera: new Proxy({ updateWidget: async data => { window.__widgetSnapshot = data; },
        widgetContract: async () => ({ v: 2 }),
        addListener: async () => ({ remove() {} }) },
      { get: (target, key) => target[key] || (() => Promise.resolve({})) }),
    } };
  });
}
const CICLO = [
  { id: "antes", date: "2026-09-02T10:00:00Z", amount: 250, merchant: "Compra anterior", category: "super", ent: "trade_republic" },
  { id: "nomina", date: "2026-09-05T10:00:00Z", amount: -2000, merchant: "NOMINA EMPRESA", category: "ingreso", ent: "trade_republic" },
  { id: "super", date: "2026-09-06T10:00:00Z", amount: 600, merchant: "Súper ficticio", category: "super", ent: "trade_republic" },
  { id: "bizum", date: "2026-09-07T10:00:00Z", amount: -100, merchant: "Bizum recibido", category: "ingreso", ent: "trade_republic" },
];
for (const caso of [{ lang: "es" }, { lang: "en" }, { lang: "ca" }]) {
  test(`E2: widget v2 con Mi ciclo recibe la ventana y el neto de Inicio (${caso.lang})`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-27T10:00:00Z") });
    await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000, expenses: CICLO,
      accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 2000 }],
      settings: { autoPrices: false, lang: caso.lang, gTotalMode: "net", budgetCycle: true, expenseBanks: ["trade_republic"] } });
    await bridgeV2(page);
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.periodKind)).toBe("ciclo");
    const snap = await page.evaluate(() => window.__widgetSnapshot);
    expect(snap.contract).toBe(2);
    expect(snap.magnitude).toBe("neto");
    expect(snap.lang).toBe(caso.lang);
    expect(snap.spent).toBe(500);            // 600 − 100; la nómina abre el ciclo y la compra del día 2 es del anterior
    expect(snap.budgetLeft).toBe(500);
    expect(snap.periodStart).toBe(await page.evaluate(() => new Date(2026, 8, 5).getTime()));
    // `ingest` seguirá esta ventana con la app cerrada, sin sumar la nómina.
    await expect.poll(() => page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
      return s.widgetPeriod && s.widgetPeriod.kind + "|" + s.widgetPeriod.anchor;
    })).toBe("ciclo|2026-09-05|-2000|NOMINA EMPRESA");
    await page.waitForFunction(() => !document.getElementById("mc-load"));
    await dismissNews(page);
    await expect(page.locator(".v4-budget .ph")).toContainText("500");
  });
}

test("E2: widget v2 sin Mi ciclo recibe el mes en bruto; un nativo antiguo sigue en contrato 1", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-27T10:00:00Z") });
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000, expenses: CICLO,
    accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 2000 }],
    settings: { autoPrices: false, gTotalMode: "net", budgetCycle: false, expenseBanks: ["trade_republic"] } });
  await bridgeV2(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.contract)).toBe(2);
  const snap = await page.evaluate(() => window.__widgetSnapshot);
  expect(snap.periodKind).toBe("mes");
  expect(snap.magnitude).toBe("gasto");
  expect(snap.spent).toBe(850);
  expect(snap.periodStart).toBe(await page.evaluate(() => inicioDeMesMs(Date.now())));
});
