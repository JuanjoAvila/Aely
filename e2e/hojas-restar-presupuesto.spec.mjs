import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, padTeclea, ponCelda } from "./fixtures.mjs";

/* HOJAS DE DEUDA Y META: «Restar del presupuesto» (hojas-255). Editar una deuda abre la hoja nueva (la de Añadir deuda), el
   interruptor vive en las hojas de alta y edición de deudas y metas, y la ficha de la deuda explica con las cifras del reparto
   qué cambia. En las metas el interruptor es la antigua tarjeta «Ahorro mensual»: crea, actualiza y quita la regla de reserva
   mensual de esa meta. Cifras inventadas; reloj del 26/09/2026. */
const YM = 2026 * 12 + 8;
const cuentas = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 2380, role: "diario", spendFrom: true }];
const nomina = { id: "n1", date: "2026-09-03T10:00:00.000Z", amount: -3000, category: "ingreso", merchant: "Nómina Empresa SL", ent: "sabadell", source: "manual" };
const prestamo = { id: "d1", ent: "familia", name: "Préstamo del piso", value: 12000, original: 12000, monthly: 260, months: 40, day: 28, asOf: YM - 6, account: "sabadell" };
const meta = { id: "g1", name: "Viaje a Japón", emoji: "✈️", target: 3000, saved: 100, deadline: "2027-08", monthly: 150 };
const base = (extra) => Object.assign({ __seedOnce: true, bankTx: [], flows: [], oneoffs: [], accounts: cuentas, budget: 1200,
  settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"], reservaRules: [] },
  expenses: [nomina], fixed: [], debts: [prestamo], goals: [meta], aportaciones: [], reservaLog: [] }, extra || {});
const estado = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")));

async function abre(page, seg, extra) {
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, base(extra));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator('.v4-seg-btn[data-seg="' + seg + '"]').click();
}
const hojaDeuda = (page) => page.getByTestId("debt-edit-form");

test("editar una deuda abre la hoja nueva y el interruptor guarda restarPres", async ({ page }) => {
  await abre(page, "deudas");
  await page.locator('[data-debt-id="d1"]').click();
  await page.getByTestId("plan-deuda-ficha").locator('[data-act="ficha-editar"]').click();
  const hoja = hojaDeuda(page);
  await expect(hoja).toBeVisible();
  // La hoja vieja (PlanEditSheet) ya no sale por ningún camino.
  await expect(page.locator(".plan-edit-sheet")).toHaveCount(0);
  const sw = hoja.locator('[data-act="hoja-restar"]');
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect(sw).toContainText("260,00");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  // Nada se guarda hasta pulsar Guardar.
  expect((await estado(page)).debts[0].restarPres).toBeUndefined();
  await hoja.locator('[data-act="hoja-guardar"]').click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => (await estado(page)).debts[0].restarPres).toBe(true);
  // Y al apagarlo se quita el campo, no se deja a false.
  await page.locator('[data-debt-id="d1"]').click();
  await page.getByTestId("plan-deuda-ficha").locator('[data-act="ficha-editar"]').click();
  await hoja.locator('[data-act="hoja-restar"]').click();
  await hoja.locator('[data-act="hoja-guardar"]').click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => "restarPres" in (await estado(page)).debts[0]).toBe(false);
});

test("el interruptor de la hoja de Añadir deuda se guarda con la deuda", async ({ page }) => {
  await abre(page, "deudas", { debts: [] });
  await page.getByRole("button", { name: "Añadir deuda", exact: true }).click();
  const hoja = page.getByTestId("debt-add-form");
  await hoja.locator('[data-debt-add="name"]').fill("Coche sintético");
  await hoja.locator('[data-debt-add="value"]').click();
  await padTeclea(hoja, "5000");
  await hoja.locator('[data-debt-add="monthly"]').click();
  await padTeclea(hoja, "125");
  const sw = hoja.locator('[data-act="hoja-restar"]');
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await hoja.locator('[data-act="hoja-guardar"]').click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).debts || []).length).toBe(1);
  expect((await estado(page)).debts[0].restarPres).toBe(true);
});

test("sin el interruptor, la deuda nueva nace sin restarPres", async ({ page }) => {
  await abre(page, "deudas", { debts: [] });
  await page.getByRole("button", { name: "Añadir deuda", exact: true }).click();
  const hoja = page.getByTestId("debt-add-form");
  await hoja.locator('[data-debt-add="value"]').click();
  await padTeclea(hoja, "900");
  await hoja.locator('[data-debt-add="monthly"]').click();
  await padTeclea(hoja, "100");
  await hoja.locator('[data-act="hoja-guardar"]').click();
  await expect.poll(async () => ((await estado(page)).debts || []).length).toBe(1);
  expect("restarPres" in (await estado(page)).debts[0]).toBe(false);
});

test("la ficha de la deuda dice con cifras qué cambia al restarla del presupuesto", async ({ page }) => {
  await abre(page, "deudas");
  await page.locator('[data-debt-id="d1"]').click();
  const ficha = page.getByTestId("plan-deuda-ficha");
  await expect(ficha.locator('[data-rsv="d1"]')).toContainText("Restar del presupuesto");
  await expect(ficha.locator('[data-rsv="d1"]')).toContainText("260,00 € al mes");
  await expect(ficha.locator('[data-pv="m"]')).toContainText(/Libre sube[\s\S]*260,00/);
  await expect(ficha.locator('[data-pv="m"]')).not.toContainText("no entra dinero");
});

test("meta: el interruptor crea la regla mensual de esa meta y su cifra sigue al «Al mes»", async ({ page }) => {
  await abre(page, "metas", { goals: [] });
  // Ya no existe la tarjeta suelta «Ahorro mensual» en Metas.
  await expect(page.locator("[data-reserva-rule]")).toHaveCount(0);
  await page.getByRole("button", { name: "Crear mi primera meta", exact: true }).click();
  const hoja = page.getByTestId("goal-add-form");
  await hoja.locator('[data-goal-add="name"]').fill("Reforma sintética");
  await hoja.locator('[data-goal-add="target"]').click();
  await padTeclea(hoja, "2000");
  await hoja.locator('[data-act="mas-datos"]').click();
  await hoja.locator('[data-goal-add="monthly"]').click();
  await padTeclea(hoja, "80");
  const sw = hoja.locator('[data-act="hoja-restar"]');
  await expect(sw).toContainText("80,00 € al mes");
  await sw.click();
  await hoja.locator('[data-act="hoja-guardar"]').click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).goals || []).length).toBe(1);
  const s = await estado(page), g = s.goals[0], reglas = s.settings.reservaRules;
  expect(reglas).toHaveLength(1);
  expect(reglas[0]).toMatchObject({ goalId: g.id, kind: "fixed", value: 80, mensual: true });
});

test("meta: editar el «Al mes» actualiza la regla y apagar el interruptor la quita", async ({ page }) => {
  const regla = { id: "rr1", name: "", kind: "fixed", value: 150, goalId: "g1", mensual: true };
  await abre(page, "metas", { settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"], reservaRules: [regla] } });
  const abrirEditar = async () => {
    await page.locator('[data-goal-id="g1"]').click();
    await page.getByTestId("plan-meta-ficha").locator('[data-act="ficha-editar"]').click();
    return page.getByRole("dialog", { name: "Editar meta", exact: true });
  };
  let hoja = await abrirEditar();
  const sw = hoja.locator('[data-act="hoja-restar"]');
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await ponCelda(hoja, "data-goal-field", "monthly", "90");
  await hoja.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => (await estado(page)).settings.reservaRules.map((r) => r.value)).toEqual([90]);
  expect((await estado(page)).settings.reservaRules[0].id).toBe("rr1");
  hoja = await abrirEditar();
  await hoja.locator('[data-act="hoja-restar"]').click();
  await hoja.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => (await estado(page)).settings.reservaRules.length).toBe(0);
});

test("meta: una regla con porcentaje no se toca mientras el interruptor siga encendido", async ({ page }) => {
  const regla = { id: "rr2", name: "Paga extra", kind: "percent", value: 10, goalId: "g1", mensual: false };
  await abre(page, "metas", { settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"], reservaRules: [regla] } });
  await page.locator('[data-goal-id="g1"]').click();
  await page.getByTestId("plan-meta-ficha").locator('[data-act="ficha-editar"]').click();
  const hoja = page.getByRole("dialog", { name: "Editar meta", exact: true });
  await expect(hoja.locator('[data-act="hoja-restar"]')).toHaveAttribute("aria-checked", "true");
  await ponCelda(hoja, "data-goal-field", "monthly", "90");
  await hoja.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => (await estado(page)).goals[0].monthly).toBe(90);
  expect((await estado(page)).settings.reservaRules).toEqual([regla]);
});

// H2-H4: una meta ya cumplida no reserva nada, así que su hoja no enseña el interruptor encendido y guardarla no toca sus reglas.
test("meta cumplida: la hoja no enseña el interruptor y guardar no toca la regla", async ({ page }) => {
  const regla = { id: "rr3", name: "", kind: "fixed", value: 150, goalId: "g1", mensual: true };
  const hecha = { ...meta, saved: 3000, done: true, doneAt: "2026-09-01T10:00:00.000Z" };
  await abre(page, "metas", { goals: [hecha], settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"], reservaRules: [regla] } });
  await page.locator('[data-goal-id="g1"]').click();
  await page.getByTestId("plan-meta-ficha").locator('[data-act="ficha-editar"]').click();
  const hoja = page.getByRole("dialog", { name: "Editar meta", exact: true });
  await expect(hoja).toBeVisible();
  await expect(hoja.locator('[data-act="hoja-restar"]')).toHaveCount(0);
  await ponCelda(hoja, "data-goal-field", "monthly", "90");
  await hoja.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => (await estado(page)).goals[0].monthly).toBe(90);
  expect((await estado(page)).settings.reservaRules).toEqual([regla]);
});
