import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, gastosRoot, gastosCifra, gastosEstado } from "./fixtures.mjs";

/* LAS TRES SUPERFICIES DICEN LO MISMO (capturas del dueño, 26/10/2026 11:46, mes natural y modo
   Balance): el widget decía «1.912 € · 412 € de más», Inicio «0 %» y «-411,95 € de 1500 €», y
   Gastos «1426,23 € · balance de octubre · 74 € por debajo». El margen contra el límite es el
   gasto bruto del mes en las tres; Gastos puede seguir enseñando el balance en grande, pero dice
   de qué es el margen. Importes sintéticos con la misma forma que su mes. */
test.use({ timezoneId: "Europe/Madrid" });

const GASTO = [1200, 711.95], INGRESO = 485.72, LIMITE = 1500;

async function abre(page, mode = "net") {
  await page.clock.install({ time: new Date("2026-10-26T10:46:00Z") });
  await seedLoggedInDashboard(page, { budget: LIMITE,
    accounts: [{ id: "a", ent: "sabadell", name: "Cuenta sintética", value: 5000, role: "diario", spendFrom: true }],
    settings: { autoPrices: false, budgetCycle: false, gTotalMode: mode, expenseBanks: ["sabadell"] },
    expenses: [
      { id: "g1", date: "2026-10-03T12:00:00Z", amount: GASTO[0], merchant: "Compra sintética", category: "super", ent: "sabadell" },
      { id: "g2", date: "2026-10-10T12:00:00Z", amount: GASTO[1], merchant: "Ocio sintético", category: "ocio", ent: "sabadell" },
      { id: "i1", date: "2026-10-12T12:00:00Z", amount: -INGRESO, merchant: "Bizum sintético", category: "ingreso", ent: "sabadell" },
      { id: "t1", date: "2026-10-14T12:00:00Z", amount: 300, merchant: "Traspaso sintético", category: "traspaso", ent: "sabadell" },
    ] });
  // El puente nativo guarda lo que la app le manda al widget: es lo que pinta la APK (contrato 2,
  // el de su móvil; la APK51 conserva a propósito su payload neto en Balance, ver widget-banco).
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => false, Plugins: {
      MiCartera: new Proxy({ widgetContract: async () => ({ v: 2 }),
        updateWidget: async data => { window.__widgetSnapshot = data; },
        addListener: async () => ({ remove() {} }) },
      { get: (target, key) => target[key] || (() => Promise.resolve({})) }),
    } };
  });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}

test("widget, Inicio y Gastos: el mismo exceso sobre el límite con ingresos en el mes", async ({ page }) => {
  await abre(page);
  // Primera vía: la cuenta a mano con las filas sembradas (el traspaso no es gasto).
  const gastado = GASTO[0] + GASTO[1], exceso = +(gastado - LIMITE).toFixed(2);
  expect(exceso).toBe(411.95);

  // Widget: el nativo pinta «gasto de límite» y el exceso como gasto − límite.
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(gastado);
  const w = await page.evaluate(() => window.__widgetSnapshot);
  expect(w.budget).toBe(LIMITE);
  expect(+(w.spent - w.budget).toFixed(2)).toBe(exceso);
  expect(w.budgetLeft).toBe(0);

  // Inicio: el anillo cuenta lo usado (127 %), lleno, y el exceso en positivo.
  const card = page.locator(".v42-cycle");
  await expect(card).toHaveAttribute("data-state", "over");
  await expect(card.locator(".v42-cycle-percent")).toHaveText("127%");
  await expect(card.locator(".v42-cycle-amount>.serif")).toHaveText("411,95 €");
  await expect(card.locator(".v42-cycle-of")).toHaveText(/^de más · límite 1\.500 €$/);
  await expect(card).toHaveAttribute("aria-label", /^Te has pasado 411,95 €\. 411,95 € de más · límite 1\.500 €$/);
  expect(await card.locator(".v42-cycle-draw").evaluate(el => el.getAttribute("stroke-dasharray"))).toBe("100 100");

  // Gastos: el balance en grande (su preferencia), pero el margen es el del gasto: 412 € por encima.
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosRoot(page)).toBeVisible();
  await expect(gastosCifra(page)).toHaveText("1.426,23 €");
  await expect(gastosEstado(page)).toHaveText("balance de octubre · gastos 412 € por encima");
  await expect(gastosEstado(page).locator(".gx-tail")).toHaveClass(/gx-tone-coral/);
  await expect(gastosRoot(page).getByTestId("gastos-desglose")).toHaveText("gastos 1.911,95 € · ingresos 485,72 €");
  // Segunda vía: el exceso que dice Gastos es el del widget redondeado a euros.
  const dice = await gastosEstado(page).locator(".gx-tail").textContent();
  expect(Number(dice.replace(/[^\d]/g, ""))).toBe(Math.round(w.spent - w.budget));
});

test("en modo Gastos la línea no cambia de forma y la barra de Categorías mide el gasto", async ({ page }) => {
  await abre(page, "split");
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toHaveText("1.911,95 €");
  await expect(gastosEstado(page)).toHaveText("gastado en octubre · 412 € por encima");
  await gastosRoot(page).locator('[role="tab"][data-gx-tab="cats"]').click();
  await expect(gastosRoot(page).locator(".gx-cats-barra")).toHaveAttribute("aria-valuenow", "1911.95");
});
