import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* AHORRO POR BOLSAS a 375 px: el ahorro de antes está en «Otros», se reparte desde Inicio sin perder euros y la cascada
   «A dónde va tu sueldo» enseña cada bolsa. Reloj 26/09/2026; cifras inventadas. */
test.use({ viewport: { width: 375, height: 760 } });
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const estado = { __seedOnce: true, bankTx: [], flows: [], oneoffs: [], settings, budget: 1200, fixed: [{ id: "r1", name: "Comunidad", amount: 95, freq: "mes", day: 28, account: "sabadell" }], debts: [], goals: [], reservaLog: [],
  accounts: [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 2380, role: "diario", spendFrom: true }],
  expenses: [{ id: "n1", date: "2026-09-03T10:00:00.000Z", amount: -3000, category: "ingreso", merchant: "Nómina Empresa SL", ent: "sabadell", source: "manual" }],
  aportaciones: [{ id: "a1", name: "Fondo indexado", amount: 200, ent: "myinvestor" }] };
const foto = async (page, nombre) => { if (process.env.CAPTURAS) { await page.waitForTimeout(700); await page.screenshot({ path: process.env.CAPTURAS + "/" + nombre + ".png" }); } };
const aps = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem("micartera_v3") || "{}").aportaciones || []).map((a) => [a.bolsa || "otros", a.amount]));

test("repartir el ahorro en bolsas desde Inicio y verlo en la cascada", async ({ page }) => {
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator(".v4-budget").first().click();
  const bs = page.locator(".v4-budget-sheet");
  await expect(bs.getByTestId("budget-ahorro-val")).toContainText("200");
  await expect(bs.getByTestId("budget-bolsas")).toHaveCount(0);
  await bs.getByTestId("budget-ahorro-toggle").click();
  await expect(bs.locator('.v4-bol-row[data-bolsa="otros"] input')).toHaveValue("200");
  await bs.getByRole("textbox", { name: "Fondo de emergencia" }).fill("80");
  await bs.getByRole("textbox", { name: "Inversión" }).fill("100");
  await bs.getByRole("textbox", { name: "Otros" }).fill("20");
  await bs.getByTestId("budget-bolsa-add").click();
  await bs.getByRole("textbox", { name: "Nombre" }).fill("Vacaciones");
  await bs.getByRole("textbox", { name: "Vacaciones", exact: true }).fill("30,50");
  await expect(bs.getByTestId("budget-ahorro-val")).toContainText("230,50");
  await foto(page, "bolsas-inicio");
  await bs.locator(".v4-cta").click();
  await expect.poll(() => aps(page)).toEqual([["otros", 20], ["emergencia", 80], ["inversion", 100], ["propia", 30.5]]);

  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.getByTestId("plan-reparto-chip").click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  const fila = hoja.locator('.cas-row[data-k="aho"]');
  await expect(fila).toHaveAttribute("data-c", "23050");
  await fila.click();
  const lineas = await hoja.locator(".cas-bolsa").evaluateAll((els) => els.map((e) => Number(e.dataset.cts)));
  expect(lineas).toEqual([8000, 10000, 2000, 3050]);
  await foto(page, "bolsas-cascada");
  await hoja.getByTestId("plan-bolsas-editar").click();
  await expect(page.getByTestId("plan-reparto-detalle").locator("[data-savings-row]")).toHaveCount(4);
  await page.getByTestId("plan-reparto-detalle").locator("[data-savings-edit]").click();
  await foto(page, "bolsas-cartera-editar");
});
