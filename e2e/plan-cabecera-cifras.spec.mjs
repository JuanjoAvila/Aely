import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* PLAN › RECIBOS: la cabecera conserva su diseño y, al tocarla, se despliega «Tu mes en cifras» (diseño
   plan-mezcla): desglose por tipo, saldo contra lo que queda, aviso «te faltan» DENTRO de la hoja y un
   puntito en la flecha de la cabecera solo si hay aviso. Cifras inventadas; reloj del 26/09/2026. */
const YM = 2026 * 12 + 8;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 2380, role: "diario", spendFrom: true }];
const nomina = (amount) => ({ id: "n1", date: "2026-09-03T10:00:00.000Z", amount: -amount, category: "ingreso", merchant: "Nómina Empresa SL", ent: "sabadell", source: "manual" });
const prestamo = { id: "d1", ent: "familia", name: "Préstamo del piso", value: 12000, original: 12000, monthly: 260, months: 40, day: 28, asOf: YM - 6, account: "sabadell" };
const base = (sueldo) => ({ __seedOnce: true, bankTx: [], flows: [], oneoffs: [], settings, accounts, budget: 1200,
  expenses: [nomina(sueldo)], fixed: [{ id: "r1", name: "Comunidad", amount: 95, freq: "mes", day: 28, account: "sabadell" }],
  debts: [prestamo], goals: [], aportaciones: [{ id: "a1", name: "Fondo indexado", amount: 200, ent: "myinvestor" }], reservaLog: [] });

async function abrePlan(page, estado, tema) {
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  if (tema) await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), tema);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.getByTestId("plan-cifras")).toBeVisible();
}
const captura = async (page, nombre) => {
  await page.waitForTimeout(900);
  if (process.env.CAPTURAS) await page.screenshot({ path: process.env.CAPTURAS + "/" + nombre + ".png" });
};

test("tocar la cabecera abre la hoja con el desglose y se cierra con Esc, scrim y asa", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrePlan(page, base(3000), process.env.TEMA);
  const tap = page.getByTestId("plan-cifras");
  // El diseño de la cabecera sigue: etiqueta, cifra y cuenta de recibos
  await expect(page.getByTestId("plan-summary")).toContainText(/Queda por pagar en/i);
  await expect(page.getByTestId("plan-count")).toBeVisible();
  await expect(tap.locator(".pr6-big")).toBeVisible();
  await expect(tap).toHaveAttribute("data-aviso", "0");
  await expect(page.getByTestId("plan-cifras-punto")).toHaveCount(0);
  await captura(page, "cabecera-cerrada-" + (process.env.TEMA || "oscuro"));
  await tap.click();
  const hoja = page.getByTestId("plan-mes-hoja");
  await expect(hoja).toBeVisible();
  await expect(hoja).toHaveAttribute("aria-modal", "true");
  expect(await page.evaluate(() => document.getElementById("root").hasAttribute("inert"))).toBe(true);
  await expect(page.getByTestId("plan-mes-queda")).toContainText(/\d/);
  await expect(hoja.locator('.rpt-kv[data-k="rec"]')).toContainText("Recibos");
  await expect(hoja.locator('.rpt-kv[data-k="deu"]')).toContainText("Deudas");
  await expect(hoja.locator('.rpt-kv[data-k="gas"]')).toContainText("Gastos");
  await expect(hoja.locator('.rpt-kv[data-k="aho"]')).toContainText("Ahorro");
  await expect(page.getByTestId("plan-mes-aviso")).toHaveCount(0);
  await expect(page.getByTestId("plan-mes-estado")).toContainText(/Tu saldo/);
  await page.waitForTimeout(500);
  await captura(page, "hoja-abierta-" + (process.env.TEMA || "oscuro"));
  await page.keyboard.press("Escape");
  await expect(hoja).toHaveCount(0);
  expect(await page.evaluate(() => document.getElementById("root").hasAttribute("inert"))).toBe(false);
  // Y el scrim también cierra
  await tap.click();
  await expect(hoja).toBeVisible();
  await page.mouse.click(195, 40);
  await expect(hoja).toHaveCount(0);
});

test("si los ingresos no llegan al plan, el aviso va dentro de la hoja y la flecha lleva un punto", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrePlan(page, base(300), process.env.TEMA);
  const tap = page.getByTestId("plan-cifras");
  await expect(tap).toHaveAttribute("data-aviso", "1");
  await expect(page.getByTestId("plan-cifras-punto")).toHaveCount(1);
  await expect(tap).toHaveAttribute("aria-label", /te faltan/);
  // La cifra de la cabecera queda limpia: el aviso no se pinta debajo
  await expect(page.getByTestId("plan-summary").getByText(/te faltan/i)).toHaveCount(0);
  await captura(page, "cabecera-aviso-" + (process.env.TEMA || "oscuro"));
  await tap.click();
  await expect(page.getByTestId("plan-mes-aviso")).toContainText(/te faltan .*€/);
  await page.waitForTimeout(500);
  await captura(page, "hoja-aviso-" + (process.env.TEMA || "oscuro"));
});

test("las pestañas Recibos, Deudas y Metas siguen cambiando de vista", async ({ page }) => {
  await abrePlan(page, base(3000));
  const tabs = page.locator(".v4-plan-tabs .v4-seg-btn");
  await expect(tabs).toHaveCount(3);
  await expect(tabs.first()).toHaveClass(/on/);
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveClass(/on/);
  await captura(page, "pestanas-deudas");
});
