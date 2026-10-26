import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, gastosRoot, gastosCifra, gastosEstado } from "./fixtures.mjs";

/* LAS TRES SUPERFICIES DICEN LO MISMO (capturas del dueño, 26/10/2026, mes natural y modo Balance).
   Primero (4.26.183) se unificaron en el gasto bruto; luego decidió el dueño la regla del mes
   natural: los ingresos descuentan del límite (Bizums, devoluciones…) SALVO la nómina. Su mes:
   1.922,19 € de gasto, 485,72 € recibidos, límite 1.500 € → «64 € por debajo» (antes «422 € por
   encima»), y el 30/10 entra la nómina de 3.333 € sin mover nada. Importes sintéticos con la misma
   forma que su mes. Oráculos cambiados: el widget manda lo comparado (1.436,47, no el bruto),
   Inicio pasa de «over/127 %» a quedar 63,53 € y Gastos dice «64 € por debajo» sin «gastos». */
test.use({ timezoneId: "Europe/Madrid" });

const GASTO = [1200, 722.19], INGRESO = 485.72, LIMITE = 1500, NOMINA = 3333;

async function abre(page, { mode = "net", nomina = false, at = "2026-10-26T10:46:00Z" } = {}) {
  await page.clock.install({ time: new Date(at) });
  const expenses = [
    { id: "g1", date: "2026-10-03T12:00:00Z", amount: GASTO[0], merchant: "Compra sintética", category: "super", ent: "sabadell" },
    { id: "g2", date: "2026-10-10T12:00:00Z", amount: GASTO[1], merchant: "Ocio sintético", category: "ocio", ent: "sabadell" },
    { id: "i1", date: "2026-10-12T12:00:00Z", amount: -INGRESO, merchant: "Bizum sintético", category: "ingreso", ent: "sabadell" },
    { id: "t1", date: "2026-10-14T12:00:00Z", amount: 300, merchant: "Traspaso sintético", category: "traspaso", ent: "sabadell" },
  ];
  if (nomina) expenses.push({ id: "n1", date: "2026-10-30T08:00:00Z", amount: -NOMINA, merchant: "Empresa sintética", note: "NÓMINA OCTUBRE", category: "ingreso", ent: "sabadell" });
  await seedLoggedInDashboard(page, { budget: LIMITE,
    accounts: [{ id: "a", ent: "sabadell", name: "Cuenta sintética", value: 5000, role: "diario", spendFrom: true }],
    settings: { autoPrices: false, budgetCycle: false, gTotalMode: mode, expenseBanks: ["sabadell"] },
    expenses });
  // El puente nativo guarda lo que la app le manda al widget: es lo que pinta la APK (contrato 2,
  // el de su móvil; la APK51 conserva a propósito su payload legado, ver widget-banco).
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

for (const nomina of [false, true]) {
  test(`widget, Inicio y Gastos: 63,53 € por debajo del límite${nomina ? " también con la nómina del 30/10" : ""}`, async ({ page }) => {
    await abre(page, nomina ? { nomina, at: "2026-10-30T10:00:00Z" } : {});
    // Primera vía: la cuenta a mano con las filas sembradas (el traspaso no es gasto; la nómina no resta).
    const usado = +(GASTO[0] + GASTO[1] - INGRESO).toFixed(2), queda = +(LIMITE - usado).toFixed(2);
    expect([usado, queda]).toEqual([1436.47, 63.53]);

    // Widget: el nativo pinta «quedan» como límite − `spent`.
    await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(usado);
    const w = await page.evaluate(() => window.__widgetSnapshot);
    expect(w.budget).toBe(LIMITE);
    expect(w.budgetLeft).toBe(queda);
    expect(+(w.budget - w.spent).toFixed(2)).toBe(queda);

    // Inicio: no se ha pasado; el anillo dice lo que queda.
    const card = page.locator(".v42-cycle");
    await expect(card).not.toHaveAttribute("data-state", "over");
    await expect(card.locator(".v42-cycle-amount>.serif")).toHaveText("63,53 €");
    await expect(card.locator(".v42-cycle-percent")).toHaveText("4%");

    // Gastos: su preferencia en grande (el balance) y el mismo margen que Inicio y el widget.
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await expect(gastosRoot(page)).toBeVisible();
    await expect(gastosCifra(page)).toHaveText(nomina ? "1.896,53 €" : "1.436,47 €");
    await expect(gastosEstado(page)).toHaveText("balance de octubre · 64 € por debajo");
    await expect(gastosEstado(page).locator(".gx-tail")).toHaveClass(/gx-tone-mint/);
    // Segunda vía: el margen que dice Gastos es el del widget redondeado a euros.
    const dice = await gastosEstado(page).locator(".gx-tail").textContent();
    expect(Number(dice.replace(/[^\d]/g, ""))).toBe(Math.round(w.budgetLeft));
  });
}

// La barra de presupuesto de Categorías se quitó el 26/10/2026 («quítala, no me gusta»): ahora se
// comprueba que la línea de Categorías dice el mismo margen y que la barra ya no está.
test("en modo Gastos la cifra es el bruto, pero la línea de Movimientos y la de Categorías miden lo mismo que Inicio", async ({ page }) => {
  await abre(page, { mode: "split" });
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toHaveText("1.922,19 €");
  await expect(gastosEstado(page)).toHaveText("gastado en octubre · 64 € por debajo");
  await gastosRoot(page).locator('[role="tab"][data-gx-tab="cats"]').click();
  await expect(gastosEstado(page)).toHaveText("octubre por categoría · 64 € por debajo");
  await expect(gastosRoot(page).locator(".gx-cats-barra")).toHaveCount(0);
});
