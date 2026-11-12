import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos: lo que entra y lo que mueves con el ciclo de un recibo (petición del dueño,
   12/11/2026: «sale en "Lo que aún entrará" y luego se pierde»). Lo que llega pasa a «Ya ha
   entrado» con su movimiento de Gastos; lo que no, sigue a la vista; la ficha deja elegirlo,
   rechazarlo o marcarlo a mano; y el alta es la misma hoja por pasos que un recibo. Datos inventados. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const mov = (id, ent, date, amount, merchant) => ({ id, extId: "b-" + id, ent, date: date + "T12:00:00.000Z", amount, merchant, obName: merchant,
  source: "ob", status: "BOOK", category: amount < 0 ? "ingreso" : "otros" });

async function abre(page, extra) {
  test.info().annotations.push({ type: "own-clock" });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.clock.install({ time: new Date("2026-11-26T12:00:00+01:00") });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-11-26",
    accounts: [{ id: "s", ent: "sabadell", role: "fijos", value: 1500 }, { id: "rv", ent: "revolut", role: "fijos", value: 300 }],
    fixed: [{ id: "luz", name: "Luz", amount: 50, freq: "mes", day: 28, account: "sabadell" }], debts: [], oneoffs: [], bankTx: [],
    flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 1850, to: "sabadell", day: 28 },
      { id: "tr", kind: "transfer", name: "A Revolut", amount: 200, from: "sabadell", to: "revolut", day: 15 }],
    // La nómina llegó el 25 (antes de su día); el traspaso del 15 no tiene movimiento exacto.
    expenses: [mov("nomina", "sabadell", "2026-11-25", -1850, "EMPRESA SINTETICA SL"), mov("rev", "revolut", "2026-11-16", -199, "TRASPASO RECIBIDO")],
    settings }, extra || {}));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}

test("lo que llega pasa a «Ya ha entrado» con su movimiento, y «No es este» lo devuelve", async ({ page }) => {
  const recibos = await abre(page);
  await expect(recibos.getByTestId("plan-income")).toHaveCount(0);
  const ent = recibos.getByTestId("plan-entrado");
  await expect(ent.locator(".pr6-paid-l")).toHaveText("Ya ha entrado");
  await expect(ent.getByTestId("plan-entrado-total")).toHaveText("+1.850,00 €");
  await ent.locator(".pr6-paid-h").click();
  const fila = ent.locator('[data-flujo="flow_nom"]');
  await expect(fila).toContainText("25");
  await expect(fila).toContainText("movimiento de Sabadell");
  await fila.click();
  const ficha = page.locator('.v4-sheet[data-sheet="flujo"]');
  await expect(ficha.getByTestId("flujo-mov")).toContainText("EMPRESA SINTETICA SL");
  await ficha.locator('[data-act="no-es"]').click();
  await expect(ficha.locator(".pr6-pick-t")).toHaveText("¿Cuál es el ingreso?");
  await ficha.locator('[data-act="aun-no"]').click();
  await expect(ficha).toHaveCount(0);
  await expect(recibos.getByTestId("plan-income").locator('[data-flujo="flow_nom"]')).toContainText("Sabadell");
  await expect(recibos.getByTestId("plan-entrado")).toHaveCount(0);
  // El rechazo viaja con el estado: el motor no lo vuelve a elegir.
  await expect.poll(() => page.evaluate(() => (loadState().reciboNo || []).some((k) => k.indexOf("flow:nom|") === 0))).toBe(true);
});

test("lo que no llega sigue a la vista; se elige su movimiento a mano o «Lo moví de otra forma»", async ({ page }) => {
  const recibos = await abre(page);
  const tr = recibos.getByTestId("plan-transfers").locator('[data-flujo="flow_tr"]');
  await expect(tr).toContainText("de Sabadell a Revolut");
  await expect(tr).toContainText("tocaba");
  await tr.click();
  const ficha = page.locator('.v4-sheet[data-sheet="flujo"]');
  await expect(ficha.getByTestId("flujo-nota")).toContainText("Tocaba el 15");
  await ficha.locator('[data-act="llego"]').click();
  await expect(ficha.locator(".pr6-pick-t")).toHaveText("¿Cuál es el movimiento?");
  await ficha.locator('[data-cargo="rev"]').click();
  await expect(ficha).toHaveCount(0);
  const ent = recibos.getByTestId("plan-entrado");
  await ent.locator(".pr6-paid-h").click();
  await expect(ent.locator('[data-flujo="flow_tr"]')).toContainText("movimiento de Revolut");
  // El traspaso no suma a lo que ha entrado: no es dinero nuevo.
  await expect(ent.getByTestId("plan-entrado-total")).toHaveText("+1.850,00 €");
  await expect(recibos.getByTestId("plan-transfers")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => loadState().flows.find((f) => f.id === "tr").llegadas[2026 * 12 + 11].expenseId)).toBe("rev");

  // Deshacer con el aviso y marcarlo «de otra forma».
  await page.getByTestId("plan-deshacer").getByRole("button").click();
  await recibos.getByTestId("plan-transfers").locator('[data-flujo="flow_tr"]').click();
  await ficha.locator('[data-act="llego"]').click();
  await ficha.locator('[data-act="a-mano"]').click();
  await expect(ent.locator('[data-flujo="flow_tr"]')).toContainText("marcado a mano");
});

test("el alta y la edición de lo que entra son la hoja por pasos de un recibo", async ({ page }) => {
  const recibos = await abre(page);
  await recibos.getByTestId("plan-todos").click();
  await page.locator('[data-act="bill-add-flow"]').first().click();
  const hoja = page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
  await expect(hoja).toHaveAttribute("data-modo", "add");
  await expect(hoja.locator('[data-rp4-tipo="income"]')).toHaveAttribute("aria-checked", "true");
  await hoja.locator('[data-rp4-sug="fl_s_pension"]').click();
  await expect(hoja).toHaveAttribute("data-paso", "1");
  for (const k of ["9", "0", "0"]) await hoja.locator('[data-rp4-paso="1"]').getByRole("button", { name: k, exact: true }).click();
  await hoja.locator(".rp4-cta").click();
  await hoja.locator('[data-rp4-paso="2"] [data-rp4-regla="last"]').click();
  await hoja.locator(".rp4-cta").click();
  await hoja.locator('[data-rp4-paso="3"] [data-rp4-banco="revolut"]').click();
  await expect(hoja).toHaveAttribute("data-paso", "4");
  await expect(hoja.locator('[data-rp4-paso="4"]')).toContainText("Entra en");
  await hoja.locator(".rp4-cta").click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.stringify(loadState().flows.filter((f) => f.name === "Pensión").map((f) => [f.kind, f.amount, f.to, f.when, f.day || null]))))
    .toBe(JSON.stringify([["income", 900, "revolut", "last", null]]));

  // Editar un traspaso abre la misma hoja en el resumen, con de dónde sale y adónde va.
  await page.locator(".v4-bills-row").filter({ hasText: "A Revolut" }).click();
  await expect(hoja).toHaveAttribute("data-modo", "edit");
  await expect(hoja.locator('[data-rp4-paso="4"]')).toContainText("Va a");
  await expect(hoja.locator('[data-rp4-paso="4"]')).toContainText("Revolut");
});
