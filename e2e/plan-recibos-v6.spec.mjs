import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos v6, tanda 1 (docs/design/plan-recibos/SPEC.md §2 y §14). Cada lista de la
   portada sale del estado (`planChargesMonth` + `paymentEvidenceUI`): si un `.map` cambia de
   forma, la pantalla se queda vacía con `npm test` en verde (AGENTS §7). Aquí se mira el DOM. */
const YM = 2026 * 12 + 10;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const recibo = (id, name, amount, day) => ({ id, name, amount, freq: "mes", day, account: "sabadell" });

async function abrePlan(page, overrides) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-18T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-10-18", bankTx: [], debts: [], flows: [], oneoffs: [], settings }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}

test("tarjeta: suma lo pendiente; «Por pagar» enseña tres y «Ver los N» despliega el resto", async ({ page }) => {
  const fixed = [recibo("a", "Agua", 30.5, 19), recibo("b", "Gimnasio", 40, 20), recibo("c", "Internet", 45.25, 22),
    recibo("d", "Seguro hogar", 25, 26), recibo("e", "Comunidad", 60, 28)];
  const recibos = await abrePlan(page, { accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }], fixed, expenses: [] });
  const total = await page.evaluate(() => eur(30.5 + 40 + 45.25 + 25 + 60));
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(total);
  await expect(recibos.getByTestId("plan-count")).toHaveText("5 recibos · 3 esta semana");
  // Con 3.000 € y 200,75 € pendientes en el único banco, llega.
  await expect(recibos.getByTestId("plan-llega")).toContainText("Te llega");

  const due = recibos.getByTestId("plan-due");
  const visibles = due.locator(".v4-charge:not([inert] *)");
  await expect(due.locator(".v4-charge")).toHaveCount(5);
  await expect(visibles).toHaveCount(3);
  await expect(visibles.nth(0)).toContainText("Agua");
  await expect(visibles.nth(0)).toContainText("mañana");
  const ver = due.getByRole("button", { name: /Ver los 5/ });
  await expect(ver).toHaveAttribute("aria-expanded", "false");
  await ver.click();
  await expect(due.locator(".v4-charge:not([inert] *)")).toHaveCount(5);
  await expect(due.getByRole("button", { name: /Ver menos/ })).toHaveAttribute("aria-expanded", "true");
  // Nada pagado aún: la fila plegada está, con su cero, y no hay «Para revisar».
  await expect(recibos.getByTestId("plan-paid")).toContainText(/Ya pagados.*0,00/);
  await expect(recibos.getByTestId("plan-review")).toHaveCount(0);
});

test("para revisar: no ha llegado y cuotas sin cargo del banco, como mucho tres a la vista", async ({ page }) => {
  // Día 3, 5, 8 y 12 con hoy 18 y sin cargo: pasado el margen, «No ha llegado». El 17 aún no.
  const fixed = [recibo("l1", "Luz", 55, 3), recibo("l2", "Gas", 32, 5), recibo("l3", "Móvil", 15, 8), recibo("l4", "Seguro coche", 41, 12),
    recibo("l5", "Alarma", 29.9, 17)];
  const debts = [{ id: "pr", ent: "familia", name: "Préstamo sintético", value: 900, original: 1200, monthly: 100, amort: 100, months: 12, day: 2, asOf: YM - 3, account: "sabadell" }];
  const recibos = await abrePlan(page, { accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }], fixed, debts, expenses: [] });
  const review = recibos.getByTestId("plan-review");
  await expect(review.locator(".v4-charge")).toHaveCount(5);
  await expect(review.locator(".v4-charge:not([inert] *)")).toHaveCount(3);
  await expect(review.locator('[data-review="late"]')).toHaveCount(4);
  await expect(review.locator('[data-review="unconf"]')).toContainText("Préstamo sintético");
  await expect(review.locator(".pr6-sec-h, .pr6-n").first()).toContainText("5");
  // Lo vencido sigue sumando en lo que queda por pagar; la cuota pagada por calendario no.
  const total = await page.evaluate(() => eur(55 + 32 + 15 + 41 + 29.9));
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(total);
  // «Alarma» venció ayer: dentro del margen se queda en «Por pagar», con su aviso de cuándo tocaba.
  await expect(recibos.getByTestId("plan-due").locator(".v4-charge").filter({ hasText: "Alarma" })).toContainText("tocaba ayer");
  await review.getByRole("button", { name: /Ver los 5/ }).click();
  await expect(review.locator(".v4-charge:not([inert] *)")).toHaveCount(5);
  // La cuota lleva a Deudas en vez de a una ficha de recibo.
  await review.locator('[data-review="unconf"]').click();
  await expect(page.locator('.v4-seg-btn[data-seg="deudas"]')).toHaveAttribute("aria-selected", "true");
});

test("ficha: enlazar el cargo lo pasa a «Ya pagados»; «No es este recibo» lo devuelve", async ({ page }) => {
  // El nombre del cargo no se parece al del recibo: el motor no lo casa solo, hay que elegirlo.
  const fixed = [recibo("luz", "Luz", 48.2, 16), recibo("agua", "Agua", 20, 25)];
  const expenses = [
    { id: "x1", merchant: "IBERDROLA CLIENTES SAU", date: "2026-10-14", amount: 47.9, ent: "sabadell", category: "otros", source: "ob" },
    { id: "x2", merchant: "Supermercado", date: "2026-10-16", amount: 12.3, ent: "sabadell", category: "super", source: "ob" },
  ];
  const recibos = await abrePlan(page, { accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 2000 }], fixed, expenses });
  const due = recibos.getByTestId("plan-due");
  await expect(due.locator(".v4-charge").filter({ hasText: "Luz" })).toHaveCount(1);
  await due.locator(".v4-charge").filter({ hasText: "Luz" }).click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await expect(ficha).toContainText("Se cobra el 16 · Sabadell");
  await ficha.locator('[data-act="pagado"]').click();
  await expect(ficha.getByText("¿Cuál es el cargo?")).toBeVisible();
  // El candidato por importe parecido va primero; el súper no entra (fuera de ± max(2 €, 15 %)).
  const cargos = ficha.getByTestId("recibo-cargos");
  await expect(cargos.locator(".pr6-cand")).toHaveCount(1);
  await expect(cargos.locator(".pr6-cand")).toContainText("IBERDROLA CLIENTES SAU");
  // El buscador encuentra por importe con coma.
  await ficha.getByPlaceholder("Buscar por nombre o importe").fill("12,3");
  await expect(cargos.locator(".pr6-cand")).toContainText("Supermercado");
  await ficha.getByPlaceholder("Buscar por nombre o importe").fill("");
  await cargos.locator(".pr6-cand").first().click();
  await expect(ficha).toHaveCount(0);

  const paid = recibos.getByTestId("plan-paid");
  await expect(paid.locator(".v4-paid").filter({ hasText: "Luz" })).toContainText("cargo de Sabadell");
  await expect(due.locator(".v4-charge").filter({ hasText: "Luz" })).toHaveCount(0);
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(20)));
  const proof = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); const f = s.fixed.find((x) => x.id === "luz"); const p = fixedPaymentProof(s, f, 2026, 10, 18); return p && p.expenseId; });
  expect(proof).toBe("x1");

  // Desde «Ya pagados», la ficha enseña el cargo y deja deshacerlo.
  await paid.getByRole("button", { name: /Ya pagados/ }).click();
  await paid.locator(".v4-paid").filter({ hasText: "Luz" }).click();
  await expect(ficha.getByTestId("recibo-cargo")).toContainText("IBERDROLA CLIENTES SAU");
  await ficha.locator('[data-act="no-es"]').click();
  await expect(ficha.getByText("¿Con cuál se pagó?")).toBeVisible();
  await ficha.locator('[data-act="aun-no"]').click();
  await expect(ficha).toHaveCount(0);
  await expect(due.locator(".v4-charge").filter({ hasText: "Luz" })).toHaveCount(1);
  await expect(paid.locator(".v4-paid").filter({ hasText: "Luz" })).toHaveCount(0);
});
