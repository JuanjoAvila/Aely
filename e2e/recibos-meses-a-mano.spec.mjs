/* MESES MARCADOS A MANO: «SE TE VAN CADA MES» Y LA VISTA PREVIA DEL ALTA CUENTAN LO QUE SE COBRA
 * (FIN-20 y FIN-21).
 *
 * Un trimestral de 90 € con febrero, mayo y agosto se cobra tres veces: 270 € al año, 22,50 € al
 * mes. La cabecera lo contaba como cuatro (30 €). Y el alta de un anual de 600 € en marzo y
 * septiembre prometía 1.200 € al año, cuando el calendario cobra 300 € cada vez.
 * La cifra se comprueba contra la cuenta hecha a mano aquí, no contra el código. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

const accounts = [{ id: "sab", ent: "sabadell", name: "Nómina y recibos", value: 2000, role: "fijos" }];
const fixed = [
  { id: "luz", name: "Luz", amount: 50, freq: "mes", account: "sabadell", day: 5 },
  { id: "agua", name: "Agua", amount: 90, freq: "trimestral", months: [2, 5, 8], account: "sabadell", day: 12 },
];
const A_MANO = 50 + 90 * 3 / 12;            // 72,50
const CON_ALTA = A_MANO + 600 / 12;         // 122,50

const hub = (page) => page.locator("[data-bills-manage]");
const alta = (page) => page.locator('.v4-sheet[data-sheet="bill-add"]');
const num = (s) => Number(String(s).replace(/[^\d,]/g, "").replace(",", "."));
const cifra = async (page) => num(await hub(page).locator(".v4-bills-hero-amt").innerText());
const grupo = async (page, id) => num(await hub(page).locator(`.v4-bills-group[data-group="${id}"] .v4-bills-group-amt`).innerText());

test("la cabecera cuenta los cobros marcados y el alta dice lo que se cobrará", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, fixed, debts: [], flows: [], oneoffs: [], budget: 1000 });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const nombre = await page.evaluate(() => t("v4_gestionar"));
  await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button", { name: nombre, exact: true }).click();
  await expect(hub(page)).toBeVisible();

  expect(await cifra(page)).toBeCloseTo(A_MANO, 2);
  expect(await grupo(page, "serv")).toBeCloseTo(A_MANO, 2);

  await hub(page).locator(".v4-bills-add").first().click();
  await alta(page).locator("input.v4-bills-search").fill("Seguro coche");
  await alta(page).locator(".v4-cta").click();
  for (const k of ["6", "0", "0"]) await alta(page).getByRole("button", { name: k, exact: true }).click();
  await alta(page).locator(".v4-cta").click();
  await alta(page).locator(".v4-ficha-op").filter({ hasText: "Una vez al año" }).click();
  await alta(page).locator(".v4-cta").click();
  await expect(alta(page)).toHaveAttribute("data-step", "months");
  await alta(page).locator(".mchip").filter({ hasText: /^mar$/i }).click();
  await alta(page).locator(".mchip").filter({ hasText: /^sep$/i }).click();
  const aviso = alta(page).locator(".hint");
  await expect(aviso).toHaveText("Se cobrarán 300,00 € en Mar, Sep (600,00 € al año): 50,00 € al mes repartidos.");
  await expect(aviso).not.toContainText("1200");
  await expect(aviso).not.toContainText("1.200");

  await alta(page).locator(".v4-cta").click();
  await expect(alta(page)).toHaveAttribute("data-step", "when");
  await alta(page).locator('.v4-cta[data-act="confirm"]').click();
  await expect(alta(page)).toHaveCount(0, { timeout: 5000 });

  // Lo guardado es lo que la vista previa describía: 600 € al año, en marzo y septiembre.
  const nuevo = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).fixed.find((f) => f.name === "Seguro coche"));
  expect(nuevo).toMatchObject({ amount: 600, freq: "año", months: [3, 9] });
  await expect.poll(() => cifra(page), { timeout: 5000 }).toBeCloseTo(CON_ALTA, 2);
});
