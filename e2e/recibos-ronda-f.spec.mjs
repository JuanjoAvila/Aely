/* Recibos, ronda F (19/11/2026). Datos sintéticos.
 * DIN-10: «Nuevo precio» desde Para revisar mueve la parte «Lo descuento» a partes iguales; si su
 *   deuda no cuadra, pregunta como al editar o quitar el recibo (antes guardaba callando).
 * D-03: el nombre del recibo se lee entero, sin elipsis, también con letra Enorme a 360. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const debt = { id: "rf-debt", name: "Préstamo sintético", value: 6000, monthly: 210, amort: 270, months: 30, asOf: 2026 * 12 + 9, day: 15, account: "sabadell" };
const bill = { id: "rf-bill", name: "Fibra sintética", amount: 40, bankAmount: 80, freq: "mes", day: 15, account: "sabadell",
  reparto: [{ id: "persona-rf", n: "Persona", via: "debt", debtId: debt.id, amt: 40, auto: true }] };
// Dos meses seguidos cobrando 100 en vez de 80, enlazados como los deja el enlace a mano: «Ha subido».
const cargos = [
  { id: "rf-sep", date: "2026-09-15", amount: 100, merchant: "FIBRA SINTETICA", ent: "sabadell", category: "otros", source: "ob" },
  { id: "rf-oct", date: "2026-10-15", amount: 100, merchant: "FIBRA SINTETICA", ent: "sabadell", category: "otros", source: "ob" },
];
const prueba = (f, x) => ({ kind: "expense", key: "sabadell|" + x.date + "|" + x.amount + "|" + x.merchant,
  identity: JSON.stringify(["sabadell", x.date, x.amount, x.merchant]), expenseId: x.id,
  expenseKey: x.date + "|" + x.amount + "|" + x.merchant, expenseLegacyKey: x.date + "|" + x.amount + "|" + x.merchant,
  date: x.date, bank: "sabadell", amount: x.amount, model: JSON.stringify([f.id, "sabadell", f.amount, f.bankAmount || null]),
  modelVersion: 2, receiptId: f.id, receiptName: f.name });
const ymDe = (date) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
bill.paymentProofs = Object.fromEntries(cargos.map((x) => [ymDe(x.date), prueba(bill, x)]));

async function abrePlan(page, overrides = {}) {
  await page.clock.install({ time: new Date("2026-10-18T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-10-18", bankTx: [], debts: [debt], fixed: [bill], flows: [], oneoffs: [], expenses: cargos,
    accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }],
    settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] }, ...overrides });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
}
const ask = (page) => page.locator(".askback .tabsheet");
const guardado = (page) => page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return { fixed: s.fixed, debts: s.debts }; });

async function nuevoPrecio(page) {
  await page.locator('.page-live .v4-screen > [data-seg="recibos"] [data-recibo="fixed_rf-bill"][data-review="up"]').click();
  await page.locator('[data-sheet="recibo"] [data-act="actualizar"]').click();
}

test("DIN-10: «Nuevo precio» con una deuda que no cuadra pregunta y la deja cuadrada", async ({ page }) => {
  await abrePlan(page);
  await nuevoPrecio(page);
  await expect(ask(page)).toBeVisible();
  await expect(ask(page)).toContainText("Préstamo sintético");
  await ask(page).getByRole("button", { name: "Ajustar la deuda" }).click();
  await expect.poll(async () => { const s = await guardado(page); return [s.fixed[0].bankAmount, s.fixed[0].amount, s.debts[0].monthly, s.debts[0].amort]; }, { timeout: 5_000 })
    .toEqual([100, 50, 200, 250]);
});

test("DIN-10: no tocar la deuda guarda el precio y deja la deuda como estaba", async ({ page }) => {
  await abrePlan(page);
  await nuevoPrecio(page);
  await expect(ask(page)).toBeVisible();
  await ask(page).getByRole("button", { name: "Dejarla como está" }).click();
  await expect.poll(async () => { const s = await guardado(page); return [s.fixed[0].bankAmount, s.debts[0].monthly, s.debts[0].amort]; }, { timeout: 5_000 })
    .toEqual([100, 210, 270]);
});

test("DIN-10: con la deuda ya cuadrada, la cuota baja sola y no se pregunta", async ({ page }) => {
  await abrePlan(page, { debts: [{ ...debt, amort: 250 }] });
  await nuevoPrecio(page);
  await expect.poll(async () => { const s = await guardado(page); return [s.fixed[0].bankAmount, s.debts[0].monthly]; }, { timeout: 5_000 }).toEqual([100, 200]);
  await expect(ask(page)).toHaveCount(0);
});

for (const [letra, ancho] of [["normal", 360], ["huge", 360], ["huge", 412]]) {
  test(`D-03: nombres de recibo enteros, sin elipsis ni salirse (${letra}, ${ancho})`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 1600 });
    const largo = "Seguro del hogar de la casa de la playa con cobertura ampliada";
    await abrePlan(page, { debts: [], expenses: [], fixed: [
      { id: "rf-l1", name: largo, amount: 38.5, freq: "mes", day: 25, account: "sabadell" },
      { id: "rf-l2", name: "Comunidad de propietarios del edificio", amount: 75, freq: "mes", day: 28, account: "sabadell" },
    ], settings: { autoPrices: false, theme: "green", lang: "es", textSize: letra, expenseBanks: ["sabadell"] } });
    const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
    await expect(recibos.locator(".pr6-nm", { hasText: largo })).toBeVisible();
    const m = await recibos.evaluate((r) => [...r.querySelectorAll(".v4-charge .pr6-nm")].map((el) => {
      const fila = el.closest(".v4-charge").getBoundingClientRect(), b = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return { txt: el.textContent, cortado: el.scrollWidth > el.clientWidth + 1 || cs.textOverflow === "ellipsis" && cs.whiteSpace === "nowrap",
        fuera: b.right > fila.right + 0.5, ancho: b.width / fila.width };
    }));
    expect(m.length).toBeGreaterThan(0);
    for (const x of m) { expect(x.cortado, x.txt).toBe(false); expect(x.fuera, x.txt).toBe(false); }
    // Con Enorme en estrecho el nombre toma el ancho del importe (rejilla de Inicio): no una columna de una palabra.
    if (letra === "huge" && ancho === 360) for (const x of m) expect(x.ancho, x.txt).toBeGreaterThan(0.6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
