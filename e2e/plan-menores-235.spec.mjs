import { test, expect } from "@playwright/test";
import { datosDeuda } from "./plan-ficha-helpers.mjs";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan: remates de la auditoría de diseño del 15/11 (lote de menores).
   - DIS-29: una cuota enlazada dice a QUÉ cargo («Enlazado al cargo del 1 oct») y no repite un
     importe casi igual al de la derecha; el importe sigue en el aria-label.
   - DIS-30: las cuotas de Deudas llevan céntimos («660,85 €/mes», no «661 €/mes»).
   - DIS-27: sin emojis en el resumen ni en el icono de cada deuda (trazo SVG como la barra).
   - DIS-28: Metas vacía no pinta «Ahorrado en metas 0,00 €» y ofrece un botón principal. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 3200, role: "ambos" }];
const debts = [
  { id: "hipo", name: "Hipoteca", value: 140000, original: 160000, monthly: 660.85, account: "sabadell", day: 1, asOf: 2026 * 12 + 9 },
  { id: "coche", name: "Préstamo coche", value: 6000, original: 9000, monthly: 372.19, account: "sabadell", day: 5, asOf: 2026 * 12 + 9 },
];
const expenses = [{ id: "hip10", merchant: "PRESTAMO HIPOTECARIO", obName: "PRESTAMO HIPOTECARIO", date: "2026-10-01", amount: 661.27,
  ent: "sabadell", category: "deudas", debtId: "hipo", source: "ob", status: "BOOK" }];

async function abrePlan(page, overrides) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-20T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-10-20", bankTx: [], debts, goals: [], flows: [], oneoffs: [], expenses, settings, accounts, fixed: [] }, overrides || {}));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
}
const segmento = (page, seg) => page.locator('.page-live .v4-screen > [data-seg="' + seg + '"]');

test("Recibos: la cuota enlazada dice el día del cargo y no repite su importe", async ({ page }) => {
  await abrePlan(page);
  const hipo = segmento(page, "recibos").getByTestId("plan-review").locator('[data-recibo="debt_hipo"]');
  await expect(hipo).toContainText("Enlazado al cargo del 1 oct");
  await expect(hipo.locator(".nm")).not.toContainText("661,27");
  await expect(hipo).toHaveAttribute("aria-label", /661,27 €/);
});

test("Deudas: cuotas con céntimos y sin emojis", async ({ page }) => {
  await abrePlan(page);
  await page.locator('.v4-seg-btn[data-seg="deudas"]').click();
  const deudas = segmento(page, "deudas");
  const resumen = deudas.locator(".plan-summary");
  await expect(resumen).toContainText("1.033,04 €/mes en cuotas");
  await expect(resumen).not.toContainText("📉");
  const hipo = deudas.locator('[data-debt-id="hipo"]');
  expect(await datosDeuda(page,hipo)).toContain("660,85");
  await expect(hipo.locator('.v4-debt-ico svg[data-ico="home"]')).toHaveCount(1);
  await expect(deudas.locator('[data-debt-id="coche"] .v4-debt-ico svg[data-ico="car"]')).toHaveCount(1);
  // El icono es trazo, no texto: ningún emoji en la cabecera de la tarjeta.
  expect(await hipo.locator(".v4-debt-ico").innerText()).toBe("");
});

test("Metas vacía: sin el cero grande y con un botón principal que abre el alta", async ({ page }) => {
  await abrePlan(page);
  await page.locator('.v4-seg-btn[data-seg="metas"]').click();
  const metas = segmento(page, "metas");
  await expect(metas.getByText("Aún no tienes metas")).toBeVisible();
  await expect(metas.getByText("Ahorrado en metas")).toHaveCount(0);
  await expect(metas.locator(".v4-ghost-add", { hasText: "Nueva meta" })).toHaveCount(0);
  const crear = metas.locator('[data-act="goal-first"]');
  await expect(crear).toHaveText("Crear mi primera meta");
  const caja = await crear.boundingBox();
  expect(caja.height).toBeGreaterThanOrEqual(48);
  await crear.click();
  // Desde DIS-31 el alta va en su hoja (portal a <body>), no dentro de la lista.
  await expect(page.locator(".v4-sheet.plan-edit-sheet").getByTestId("goal-add-form")).toBeVisible();
});

test("Metas con una meta: vuelve el resumen y el botón de añadir otra", async ({ page }) => {
  await abrePlan(page, { goals: [{ id: "g1", name: "Viaje", emoji: "✈️", target: 1000, saved: 250 }] });
  await page.locator('.v4-seg-btn[data-seg="metas"]').click();
  const metas = segmento(page, "metas");
  await expect(metas.getByText("Ahorrado en metas")).toBeVisible();
  await expect(metas.locator(".v4-ghost-add", { hasText: "Nueva meta" })).toHaveCount(1);
  await expect(metas.locator('[data-act="goal-first"]')).toHaveCount(0);
});
