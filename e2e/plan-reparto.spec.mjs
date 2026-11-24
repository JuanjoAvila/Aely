import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* PLAN › BARRA DE REPARTO, HOJA «A DÓNDE VA TU SUELDO», DEUDAS Y METAS NUEVAS (prototipo aprobado).
   Con el DOM real: la barra dice Libre con el reparto en su barra, la hoja suma 100 %, cada deuda y
   cada meta abre su ficha (escalera, interruptor «Restar del presupuesto», aportar) y apagar el
   interruptor deja las cifras como estaban. Cifras inventadas; reloj del 26/09/2026. */
const YM = 2026 * 12 + 8;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"], reservaRules: [{ id: "rr1", name: "", kind: "fixed", value: 300, goalId: "g1", mensual: true }] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 2380, role: "diario", spendFrom: true }];
const gasto = (id, d, amount, category) => ({ id, date: "2026-09-" + String(d).padStart(2, "0") + "T10:00:00.000Z", amount, category: category || "super", merchant: "Comercio " + id, ent: "sabadell", source: "manual" });
const nomina = { id: "n1", date: "2026-09-03T10:00:00.000Z", amount: -3000, category: "ingreso", merchant: "Nómina Empresa SL", ent: "sabadell", source: "manual" };
const prestamo = { id: "d1", ent: "familia", name: "Préstamo del piso", value: 12000, original: 12000, monthly: 260, months: 40, day: 28, asOf: YM - 6, account: "sabadell" };
const gimnasio = { id: "d2", ent: "familia", name: "Financiación del gimnasio en casa con cinta y bicicleta", value: 400, original: 600, monthly: 50, amort: 50, months: 8, day: 28, asOf: YM - 2, account: "sabadell" };
const base = (extra) => Object.assign({ __seedOnce: true, bankTx: [], flows: [], oneoffs: [], settings, accounts, budget: 1200,
  expenses: [nomina, gasto("g1", 5, 120.5)], fixed: [{ id: "r1", name: "Comunidad", amount: 95, freq: "mes", day: 28, account: "sabadell" }],
  debts: [prestamo], goals: [{ id: "g1", name: "Viaje a Japón", emoji: "✈️", target: 3000, saved: 100, deadline: "2027-08" }],
  aportaciones: [{ id: "a1", name: "Fondo indexado", amount: 200, ent: "myinvestor" }], reservaLog: [] }, extra || {});

async function abrePlan(page, estado) {
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.getByTestId("plan-reparto-barra")).toBeVisible();
}
const barraTexto = (page) => page.getByTestId("plan-reparto-barra").innerText();

test("la línea dice Libre y la hoja resta cada destino de lo que entra", async ({ page }) => {
  await abrePlan(page, base());
  const barra = page.getByTestId("plan-reparto-barra");
  await expect(barra).toHaveAttribute("data-st", "normal");
  // 3.000 − (95 + 260 + 300 + 200 + 900) = 1.245
  await expect(barra).toContainText("Libre");
  await expect(barra).toContainText(/1\.245,00/);
  await expect(barra).toContainText(/Entran 3\.000,00/);
  // La línea ya no lleva barra segmentada: el reparto está en la hoja.
  await expect(barra.locator(".rpt-pb")).toHaveCount(0);
  await barra.click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  await expect(hoja).toBeVisible();
  const ks = await hoja.locator(".cas-row[data-k]").evaluateAll((els) => els.map((e) => e.dataset.k));
  expect(ks).toEqual(["rec", "deu", "met", "aho", "gas"]);
  await expect(hoja.locator('.cas-row[data-k="rec"] .cas-am')).toContainText(/95,00/);
  await expect(hoja.locator('.cas-row[data-k="deu"] .cas-am')).toContainText(/260,00/);
  await expect(hoja.locator('.cas-row[data-k="met"] .cas-am')).toContainText(/300,00/);
  await expect(hoja.locator('.cas-row[data-k="gas"] .cas-sub')).toContainText(/120,50/);
  await expect(page.getByTestId("plan-reparto-res")).toContainText("Te sobran");
  await expect(page.getByTestId("plan-reparto-cifra")).toContainText(/1\.245,00/);
  // Tocar Deudas lleva a su pestaña y cierra la hoja.
  await hoja.locator('.cas-row[data-k="deu"]').click();
  await expect(hoja).toHaveCount(0);
  await expect(page.locator('.v4-seg-btn[data-seg="deudas"]')).toHaveAttribute("aria-selected", "true");
});

test("sin nómina: «—» y sin resultado", async ({ page }) => {
  await abrePlan(page, base({ expenses: [gasto("g1", 5, 120.5)], flows: [{ id: "f1", kind: "income", name: "Nómina", amount: 3000, day: 3, to: "sabadell" }] }));
  const barra = page.getByTestId("plan-reparto-barra");
  await expect(barra).toHaveAttribute("data-st", "wait");
  await expect(barra).toContainText("—");
  await expect(barra).not.toContainText("Falta tu nómina");
  await barra.click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  await expect(hoja).toContainText("Falta tu nómina");
  await expect(page.getByTestId("plan-reparto-entra")).toHaveText("—");
  await expect(page.getByTestId("plan-reparto-cifra")).toHaveCount(0);
});

test("te faltan: sin signo, y el saldo lo cubre o no llega", async ({ page }) => {
  await abrePlan(page, base({ expenses: [{ ...nomina, amount: -1500 }, gasto("g1", 5, 120.5)] }));
  const barra = page.getByTestId("plan-reparto-barra");
  // 1.500 − 1.755 = 255 de menos; el saldo (2.380) cubre lo que queda por pagar
  await expect(barra).toContainText("Te faltan");
  await expect(barra).toContainText(/255,00/);
  await expect(barra).not.toContainText("−");
  // Ni barra ni frase en la línea: la frase se queda dentro de la hoja.
  await expect(barra).not.toContainText("Si gastas todo el presupuesto");
  await barra.click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  await expect(page.getByTestId("plan-reparto-res")).toContainText("Te faltan");
  await expect(page.getByTestId("plan-reparto-cifra")).toContainText(/255,00/);
  // El saldo cubre lo que queda por pagar: va en su sección aparte, no en el resultado.
  const pend = page.getByTestId("plan-reparto-pend");
  await expect(pend).toContainText("Lo que aún queda por pagar este mes");
  await expect(pend).toContainText("Te quedaría");
});

test("Deudas: cabecera, filas, ficha con escalera e interruptor que mueve dinero de Gastos a Libre", async ({ page }) => {
  await abrePlan(page, base({ debts: [prestamo, gimnasio] }));
  await page.locator('.v4-seg-btn[data-seg="deudas"]').click();
  const deudas = page.locator('[data-seg="deudas"]');
  await expect(deudas.getByTestId("debts-summary")).toContainText("Este mes pagas");
  await expect(deudas.getByTestId("debts-summary")).toContainText(/310,00/);
  await expect(deudas.locator('[data-debt-id="d1"]')).toBeVisible();
  await expect(deudas.locator('[data-debt-id="d2"]')).toBeVisible();
  await deudas.locator('[data-debt-id="d1"]').click();
  const ficha = page.getByTestId("plan-deuda-ficha");
  await expect(ficha).toBeVisible();
  await expect(ficha.getByTestId("ficha-saldo")).toContainText(/10\.440,00/);
  // Escalera: «Hoy» y los escalones de las deudas que acaban antes.
  const esc = ficha.locator("[data-stair] .rpt-stp");
  expect(await esc.count()).toBeGreaterThanOrEqual(3);
  await expect(ficha.locator(".rpt-stc")).toContainText("−260");
  // El icono de la deuda del gimnasio no es la casa aunque el nombre diga «casa».
  await page.getByTestId("plan-deuda-ficha").locator('[data-act="ficha-editar"]').count();
  // Interruptor: apagado por defecto; la hoja de reparto no cambia hasta encenderlo.
  const lib0 = await barraTexto(page);
  expect(lib0).toMatch(/Libre[\s\S]*1\.195,00/);
  const sw = ficha.locator('[data-act="restar-presupuesto"]');
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect(ficha.locator('[data-pv="m"]')).toContainText("260,00");
  await expect(ficha.locator('[data-pv="m"]')).toContainText("pasan de Gastos a Libre · no entra dinero");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  // La barra de debajo (tapada por la hoja pero viva) ya dice Libre + 260.
  await expect.poll(() => barraTexto(page)).toMatch(/1\.455,00/);
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => barraTexto(page)).toMatch(/1\.195,00/);
  // Cerrar la ficha.
  await ficha.locator(".rpt-sx").click();
  await expect(ficha).toHaveCount(0);
});

test("Deudas: puertas de siempre — editar, amortizar, poner día y archivadas siguen ahí", async ({ page }) => {
  const sinDia = { id: "d3", ent: "familia", name: "Portátil a plazos", value: 360, original: 550, monthly: 45, amort: 45, months: 10, asOf: YM - 2, account: "sabadell" };
  delete sinDia.day;
  const archivada = { id: "d4", ent: "familia", name: "Móvil viejo", value: 0, original: 720, monthly: 0, archivedAt: "2026-03-01T10:00:00.000Z", settledAt: "2026-03-01T10:00:00.000Z", account: "sabadell" };
  await abrePlan(page, base({ debts: [prestamo, sinDia, archivada] }));
  await page.locator('.v4-seg-btn[data-seg="deudas"]').click();
  const deudas = page.locator('[data-seg="deudas"]');
  // Deuda sin día: la fila lo dice y la ficha deja ponerlo.
  await expect(deudas.locator('[data-debt-id="d3"]')).toContainText("Falta el día");
  await deudas.locator('[data-debt-id="d3"]').click();
  const ficha = page.getByTestId("plan-deuda-ficha");
  await ficha.locator('[data-act="ficha-poner-dia"]').click();
  await expect(page.locator(".plan-edit-sheet")).toBeVisible();
  await page.locator(".plan-edit-sheet .btn-ghost").first().click();
  // Editar y Amortizar desde la ficha de otra deuda.
  await deudas.locator('[data-debt-id="d1"]').click();
  await expect(page.getByTestId("plan-deuda-ficha").locator('[data-act="ficha-amortizar"]')).toBeVisible();
  await page.getByTestId("plan-deuda-ficha").locator('[data-act="ficha-editar"]').click();
  await expect(page.locator(".plan-edit-sheet")).toBeVisible();
  await page.locator(".plan-edit-sheet .btn-ghost").first().click();
  // Archivadas: el botón y su lista.
  await deudas.getByRole("button", { name: /Archivadas|archivadas/i }).click();
  await expect(deudas.locator('[data-archived-debt="d4"]')).toBeVisible();
});

test("Metas: cabecera, filas con su previsión de siempre y ficha con aportar, editar y eliminar", async ({ page }) => {
  await abrePlan(page, base());
  await page.locator('.v4-seg-btn[data-seg="metas"]').click();
  const metas = page.locator('[data-seg="metas"]');
  await expect(metas.getByTestId("goals-summary")).toContainText("Ahorrado en metas");
  await expect(metas.getByTestId("goals-summary")).toContainText(/300,00 €\/mes|300 €\/mes/);
  const fila = metas.locator('[data-goal-id="g1"]');
  await expect(fila).toContainText("Viaje a Japón");
  await expect(fila).toContainText(/Vas bien|Necesitas/);
  await fila.click();
  const ficha = page.getByTestId("plan-meta-ficha");
  await expect(ficha).toBeVisible();
  await expect(ficha.getByTestId("goal-saved")).toContainText(/400/);
  await expect(ficha.locator('[data-act="ficha-aportar"]')).toBeVisible();
  await expect(ficha.locator('[data-act="ficha-editar"]')).toBeVisible();
  await expect(ficha.locator('[data-act="ficha-eliminar"]')).toBeVisible();
  await ficha.locator('[data-act="ficha-aportar"]').click();
  await expect(page.locator(".v4-apuntar-amt")).toBeVisible();
});

test("Mi ciclo: la línea y la hoja siguen cuadrando", async ({ page }) => {
  await abrePlan(page, base({ settings: { ...settings, budgetCycle: true }, expenses: [{ ...nomina, date: "2026-09-14T10:00:00.000Z" }, gasto("g1", 16, 120.5)] }));
  const barra = page.getByTestId("plan-reparto-barra");
  await expect(barra).toContainText("Libre");
  await barra.click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  const cts = await hoja.locator(".cas-row[data-c]").evaluateAll((els) => els.map((e) => Number(e.dataset.c)));
  expect(cts.length).toBeGreaterThan(0);
  await expect(page.getByTestId("plan-reparto-res")).toContainText("Te sobran");
});
