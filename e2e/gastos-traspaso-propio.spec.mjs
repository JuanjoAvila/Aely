import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, gastosCifra, gastosEstado, gastosRoot } from "./fixtures.mjs";

/* EL TRASPASO ENTRE TUS CUENTAS, EN LA PANTALLA (caso real del 21/11/2026): la llegada sin nombre
   contaba como ingreso y la cabecera enseñaba ese neto como si fuera gasto. Importes inventados. */
const now = new Date("2026-11-20T12:00:00Z");
const accounts = [
  { id: "cx", ent: "caixabank", name: "Cuenta", value: 1000, role: "fijos" },
  { id: "tr", ent: "trade_republic", name: "Efectivo", value: 900, role: "diario", spendFrom: true },
];
const settings = { autoPrices: false, theme: "green", gTotalMode: "net", expenseBanks: ["caixabank", "trade_republic"],
  profile: { fullName: "Nadia Prueba Ejemplo" } };
const fila = (id, ent, day, amount, merchant, category) => ({ id, ent, date: `2026-11-${day}T12:00:00.000Z`, amount, merchant,
  obName: merchant, category, source: "ob", status: "BOOK" });
const NOMINA = fila("nom", "caixabank", 18, -912.3, "NOMINA ACME SL", "ingreso");
const SALE = fila("sale", "caixabank", 18, 873.45, "TRANSFERENCIA A NADIA PRUEBA EJEMPLO", "traspaso");
const ENTRA = fila("entra", "trade_republic", 18, -873.45, "Movimiento", "ingreso");
const CAFE = fila("cafe", "trade_republic", 19, 3.2, "Panaderia Ejemplo", "super");
const limpio = (s) => String(s || "").replace(/\s+/g, " ").trim();

async function abreGastos(page, over) {
  await page.clock.install({ time: now });
  await seedLoggedInDashboard(page, Object.assign({ accounts, settings, budget: 0 }, over));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
}

test("★ la llegada del traspaso no es ingreso y un neto a favor lleva «+»", async ({ page }) => {
  await abreGastos(page, { expenses: [NOMINA, SALE, ENTRA, CAFE] });
  await expect.poll(async () => limpio(await gastosCifra(page).textContent())).toBe("+909,10 €");
  await expect(gastosEstado(page)).toContainText("a tu favor");
  const desglose = gastosRoot(page).getByTestId("gastos-desglose");
  await expect.poll(async () => limpio(await desglose.textContent())).toBe("gastos 3,20 € · ingresos 912,30 €");
  // Las filas siguen ahí, sin reescribirse: solo cambia cómo cuentan.
  const guardadas = await page.evaluate(() => loadState().expenses);
  expect(guardadas.find((e) => e.id === "entra").category).toBe("ingreso");
});

test("★ en Mi ciclo la línea no dice «ingresos» a secas: la nómina va aparte", async ({ page }) => {
  await abreGastos(page, { expenses: [NOMINA, SALE, ENTRA, CAFE], settings: Object.assign({}, settings, { budgetCycle: true }) });
  await expect.poll(async () => limpio(await gastosCifra(page).textContent())).toBe("3,20 €");
  await expect(gastosRoot(page).getByTestId("gastos-desglose")).toContainText("otros ingresos 0,00 €");
});

test("★ una cifra imposible se enseña como «—», nunca el número", async ({ page }) => {
  await abreGastos(page, { expenses: [fila("roto", "trade_republic", 19, 123456789012, "Dato roto", "super")] });
  await expect.poll(async () => limpio(await gastosCifra(page).textContent())).toBe("—");
  await expect(gastosRoot(page).getByTestId("gastos-desglose")).not.toContainText("123");
});

test("★ el destino de un traspaso ofrece también las cuentas que no son de recibos", async ({ page }) => {
  await page.clock.install({ time: now });
  await seedLoggedInDashboard(page, { accounts, settings, budget: 0, expenses: [], debts: [], oneoffs: [], flows: [{ id: "n", kind: "income", name: "Cobro", amount: 900, to: "caixabank", day: 28 }],
    fixed: [{ id: "luz", name: "Luz", amount: 50, freq: "mes", day: 28, account: "caixabank" }] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator('.page-live .v4-screen > [data-seg="recibos"]').getByTestId("plan-todos").click();
  await page.locator('[data-act="bill-add-flow"]').first().click();
  const hoja = page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
  await hoja.locator('[data-rp4-tipo="transfer"]').click();
  await expect(hoja.locator('[data-rp4-destino="trade_republic"]')).toHaveCount(1);
  await expect(hoja.locator('[data-rp4-banco="trade_republic"]')).toHaveCount(0);
});
