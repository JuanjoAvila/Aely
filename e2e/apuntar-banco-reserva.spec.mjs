/* Apuntar sin banco de gasto diario (ronda 242, decisión del dueño 18/11/2026): la baldosa del banco
 * salía vacía con un «+». Ahora usa el banco del widget como reserva, solo si no hay otra fuente y si
 * su gasto cuenta. Dos bancos en cada caso: el elegido tiene que ser el del widget, no el primero.
 * Esto es dinero: se mira lo que queda guardado y si cuenta, no solo lo que se ve. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const dos = (marcaSabadell = {}, settings = {}) => ({
  accounts: [
    Object.assign({ id: "sb", ent: "sabadell", name: "Cuenta uno", value: 1000, role: "fijos" }, marcaSabadell),
    { id: "cx", ent: "caixabank", name: "Cuenta dos", value: 500, role: "fijos" },
  ],
  settings: Object.assign({ autoPrices: false, theme: "green", widgetBank: "caixabank", expenseBanks: ["sabadell", "caixabank"] }, settings),
  expenses: [],
});

async function abreApuntar(page, estado) {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator(".botnav-fab").click();
  const hoja = page.locator(".v4-exp-sheet");
  await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
  return hoja;
}

test("sin banco diario: la baldosa trae el banco del widget y el gasto cuenta en él", async ({ page }) => {
  const hoja = await abreApuntar(page, dos());
  await expect(hoja.getByTestId("ap-bank")).toContainText("CaixaBank");
  for (const d of ["7", "5"]) await hoja.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  await hoja.locator(".v4-ficha-concept").fill("Compra reserva");
  await hoja.locator(".v4-ficha-concept").press("Enter");
  await hoja.locator(".v4-cta").click();
  await expect(hoja).toHaveCount(0, { timeout: 5_000 });
  const r = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("micartera_v3"));
    s.expenses = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
    const e = s.expenses.find((x) => x.merchant === "Compra reserva");
    return e && { ent: e.ent, amount: e.amount, cuenta: expenseCountsCash(e, s), cajon: expenseBucket(e, s) };
  });
  expect(r).toEqual({ ent: "caixabank", amount: 75, cuenta: true, cajon: "cuenta" });
});

test("con un banco diario manda el diario, no el del widget", async ({ page }) => {
  const hoja = await abreApuntar(page, dos({ role: "diario", spendFrom: true }));
  await expect(hoja.getByTestId("ap-bank")).toContainText("Sabadell");
});

test("si el banco del widget ya no existe, la baldosa sigue vacía", async ({ page }) => {
  const hoja = await abreApuntar(page, dos({}, { widgetBank: "bbva" }));
  await expect(hoja.getByTestId("ap-bank")).toContainText("Sin banco");
});

/* Revisión de dinero 242, P2 (fallo previo): sin cuenta diaria, pasar de Efectivo a Tarjeta ponía el
 * primer banco de la lista (Sabadell), que no cuenta, y el gasto dejaba de sumar sin avisar. Ahora
 * vuelve a la reserva o a ningún banco. */
const conSobre = (settings) => {
  const s = dos({}, settings);
  s.accounts = s.accounts.concat([{ id: "ef", ent: "efectivo", name: "El sobre", value: 80, role: "fijos" }]);
  return s;
};
async function deEfectivoATarjeta(hoja) {
  await hoja.getByTestId("ap-efectivo").click();
  await expect(hoja.getByTestId("ap-efectivo")).toHaveAttribute("aria-pressed", "true");
  await hoja.getByTestId("ap-pay-card").click();
  await expect(hoja.getByTestId("ap-pay-card")).toHaveAttribute("aria-pressed", "true");
}
async function guardaYMira(page, hoja, concepto) {
  for (const d of ["4", "2"]) await hoja.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  await hoja.locator(".v4-ficha-concept").fill(concepto);
  await hoja.locator(".v4-ficha-concept").press("Enter");
  await hoja.locator(".v4-cta").click();
  await expect(hoja).toHaveCount(0, { timeout: 5_000 });
  return page.evaluate((concepto) => {
    const s = JSON.parse(localStorage.getItem("micartera_v3"));
    s.expenses = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
    const e = s.expenses.find((x) => x.merchant === concepto);
    return e && { ent: e.ent || null, cuenta: expenseCountsCash(e, s), cajon: expenseBucket(e, s) };
  }, concepto);
}

test("sin diario ni reserva, de Efectivo a Tarjeta no pone un banco que no cuenta", async ({ page }) => {
  const hoja = await abreApuntar(page, conSobre({ widgetBank: "bbva", expenseBanks: ["caixabank", "efectivo"] }));
  await expect(hoja.getByTestId("ap-bank")).toContainText("Sin banco");
  await deEfectivoATarjeta(hoja);
  await expect(hoja.getByTestId("ap-bank")).toContainText("Sin banco");
  expect(await guardaYMira(page, hoja, "Vuelta sin banco")).toEqual({ ent: null, cuenta: true, cajon: "cuenta" });
});

test("con reserva, de Efectivo a Tarjeta vuelve al banco del widget", async ({ page }) => {
  const hoja = await abreApuntar(page, conSobre({ widgetBank: "caixabank", expenseBanks: ["caixabank", "efectivo"] }));
  await deEfectivoATarjeta(hoja);
  await expect(hoja.getByTestId("ap-bank")).toContainText("CaixaBank");
  expect(await guardaYMira(page, hoja, "Vuelta a la reserva")).toEqual({ ent: "caixabank", cuenta: true, cajon: "cuenta" });
});

/* Revisión de dinero 242b: con el sobre como cuenta DIARIA y ningún banco que cuente, salir de Efectivo
 * no puede dejar el gasto sin banco: sin banco se atribuye a la diaria y el sobre bajaba por un pago con
 * tarjeta (D1 del 15/11 por otra puerta). Va al banco, como en producción, y el sobre no se mueve. */
test("con el sobre como diario y ningún banco que cuente, Tarjeta no baja el sobre", async ({ page }) => {
  const hoja = await abreApuntar(page, {
    accounts: [
      { id: "sb", ent: "sabadell", name: "Cuenta uno", value: 1000, role: "fijos" },
      { id: "ef", ent: "efectivo", name: "El sobre", value: 80, role: "diario", spendFrom: true },
    ],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["efectivo"] },
    expenses: [],
  });
  const sobre = () => page.evaluate(() => {
    const s = mcLoadRaw(mcStateKey());
    return Math.round(saldoCuentaMostrada(s.accounts.find((a) => a.ent === "efectivo"), insumosSaldoGasto(s)) * 100);
  });
  const antes = await sobre();
  await expect(hoja.getByTestId("ap-efectivo")).toHaveAttribute("aria-pressed", "true");
  await hoja.getByTestId("ap-pay-card").click();
  await expect(hoja.getByTestId("ap-bank")).toContainText("Sabadell");
  for (const d of ["2", "0"]) await hoja.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  await hoja.locator(".v4-ficha-concept").fill("Tarjeta con sobre diario");
  await hoja.locator(".v4-ficha-concept").press("Enter");
  await hoja.locator(".v4-cta").click();
  await expect(hoja).toHaveCount(0, { timeout: 5_000 });
  const e = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").find((x) => x.merchant === "Tarjeta con sobre diario"));
  expect(e && e.ent).toBe("sabadell");
  expect(await sobre()).toBe(antes);
});
