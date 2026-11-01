import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* «¿Cuál es el cargo?» con el cargo todavía sin confirmar por el banco (beta 4.26.210, 1/11/2026):
   compra en domingo que el banco apunta el lunes y como pendiente. Decía «Sin cargos de Sabadell
   este mes» con el cargo ya en Gastos. Se lista aparte y sin poder elegirlo; al confirmarse, se
   elige como siempre. Recibo compartido: lo que se busca es el importe ENTERO del banco. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const recibo = { id: "vid", name: "Video Premium", amount: 4.99, bankAmount: 29.99, freq: "mes", day: 2, account: "sabadell" };
const cargo = (extra) => Object.assign({ id: "g1", merchant: "COMPRA TARJ. 0000XXXXXXXX0000 GOOGLE", date: "2026-11-02", amount: 29.99,
  ent: "sabadell", category: "recibos", source: "ob", status: "PDNG", obPending: true }, extra || {});

async function abreCargo(page, iso, expenses) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date(iso) });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: iso.slice(0, 10), bankTx: [], debts: [], flows: [], oneoffs: [], settings,
    accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 2000 }], fixed: [recibo], expenses });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  await recibos.getByTestId("plan-due").locator(".v4-charge").filter({ hasText: "Video Premium" }).click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await ficha.locator('[data-act="pagado"]').click();
  await expect(ficha.getByText("¿Cuál es el cargo?")).toBeVisible();
  return ficha;
}

test("pendiente del banco: se ve aparte, no se puede elegir y no dice «Sin cargos»", async ({ page }) => {
  const ficha = await abreCargo(page, "2026-11-01T21:04:00+01:00", [cargo()]);
  const pend = ficha.getByTestId("recibo-cargos-pend");
  await expect(pend.locator(".pr6-cand")).toHaveCount(1);
  await expect(pend).toContainText("GOOGLE");
  await expect(pend).toContainText("Pendiente del banco");
  await expect(pend.locator("button")).toHaveCount(0);
  await expect(ficha.getByTestId("recibo-cargos").locator(".pr6-cand")).toHaveCount(0);
  await expect(ficha.locator(".pr6-empty")).toHaveCount(0);
  await expect(ficha).not.toContainText("Sin cargos de Sabadell");
});

test("confirmado por el banco: sale en la lista normal y elegirlo lo da por pagado", async ({ page }) => {
  const ficha = await abreCargo(page, "2026-11-02T09:00:00+01:00", [cargo({ status: "BOOK", obPending: undefined })]);
  await expect(ficha.getByTestId("recibo-cargos-pend")).toHaveCount(0);
  const cargos = ficha.getByTestId("recibo-cargos");
  await expect(cargos.locator(".pr6-cand")).toHaveCount(1);
  await cargos.locator(".pr6-cand").first().click();
  await expect(ficha).toHaveCount(0);
  const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  await expect(recibos.getByTestId("plan-due").locator(".v4-charge").filter({ hasText: "Video Premium" })).toHaveCount(0);
});
