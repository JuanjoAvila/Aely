import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra, gastosGrisFila } from "./fixtures.mjs";

/* «ES APORTACIÓN A LA META X» (decisión del dueño, 24/10/2026). Render puro derivado del estado:
   lo que `npm test` no ve (AGENTS §7). Las cifras las vigila `tests/meta-aportacion`; aquí se abre
   la pantalla de verdad y se mira el DOM del camino entero que va a hacer él:
   · desde la ficha de un cargo del banco se marca como aportación, con su confirmación;
   · el cargo pasa a la fila gris «Metas · no cuentan» y ni el día ni la cifra lo suman;
   · Inicio dice lo mismo que Gastos;
   · en Plan → Metas la meta enseña lo ahorrado + lo marcado, y de dónde viene;
   · quitar la marca lo deja todo como estaba.
   Reloj de las fixtures: 26/9/2026 a mediodía. */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

const e = (id, ymd, amount, category, extra = {}) => ({ id, date: ymd + "T12:00:00Z", amount, category, merchant: id, source: "ob", ent: "trade_republic", ...extra });
const base = {
  budget: 1000,
  settings: { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["trade_republic"] },
  accounts: [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 3000, role: "diario", spendFrom: true }],
  goals: [{ id: "viaje", name: "Viaje", emoji: "✈️", target: 1000, saved: 100, done: false, createdAt: "2026-08-01T10:00:00Z" }],
};
// Septiembre: 20 + 30 + 250 = 300 que cuentan. Marcada la hucha (250), quedan 50.
const expenses = [
  e("Hoy super", "2026-09-26", 20, "super"),
  e("Compra del 20", "2026-09-20", 30, "compras"),
  e("TRASPASO HUCHA", "2026-09-20", 250, "otros", { extId: "ref-hucha" }),
];

const fila = (page, nombre) => gastosRoot(page).locator("button.v4-mov").filter({ hasText: nombre });
const dia20 = (page) => gastosRoot(page).locator('[data-gx-day="20260920"]');
const grisMeta = (page) => gastosRoot(page).locator('.gx-gris[data-gris="meta"]');
const inicioQuedan = (page) => page.locator(".v4-budget .v42-cycle-amount>.serif");

async function abre(page) {
  await seedLoggedInDashboard(page, { ...base, expenses });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}
async function aTab(page, id) { await page.locator('.botnav-tab[data-tour="' + id + '"]').click(); }
async function cierraFicha(page) {
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".v4-sheet-back")).toHaveCount(0);
}
async function aMetas(page) {
  await aTab(page, "plan");
  await page.getByRole("tab", { name: "Metas", exact: true }).click();
  await expect(page.locator('[data-goal-id="viaje"]')).toBeVisible();
}

test("★ marcar un cargo como aportación: fila gris de Metas, no suma, la meta sube y quitarla lo deja como estaba", async ({ page }) => {
  await abre(page);
  await expect(inicioQuedan(page)).toHaveText("700 €");
  await aTab(page, "gastos");
  await expect(gastosCifra(page)).toHaveText("300,00 €");
  await expect(dia20(page).getByTestId("gastos-dia-total")).toHaveText("280,00 €");
  await expect(grisMeta(page)).toHaveCount(0);

  // Ficha → «Es aportación a una meta» → Viaje, y confirma diciendo qué cambia.
  await fila(page, "TRASPASO HUCHA").click();
  await expect(page.getByTestId("exp-meta-value")).toHaveText("No");
  await page.getByTestId("exp-meta").click();
  await page.getByTestId("exp-meta-viaje").click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.locator(".ts-title")).toHaveText("¿Es aportación a «Viaje»?");
  await expect(dlg.locator(".ts-hint")).toContainText("250,00 € dejan de contar en el gasto del mes y la meta pasa de 100,00 € a 350,00 €.");
  // La meta ya tenía algo ahorrado: avisa de que no lo sume dos veces.
  await expect(dlg.locator(".ts-hint")).toContainText("contaría dos veces");
  await dlg.getByRole("button", { name: "Sí, es para la meta" }).click();
  await expect(page.getByTestId("exp-meta-viaje")).toHaveClass(/on/);
  await expect(page.getByTestId("exp-meta-value")).toHaveText("✈️ Viaje");
  await cierraFicha(page);

  // La fila gris de Metas del día 20, y la cifra y el día sin los 250.
  await expect(fila(page, "TRASPASO HUCHA"), "ya no es una tarjeta suelta").toHaveCount(0);
  await expect(grisMeta(page).locator(".gx-gris-h")).toContainText("Metas · no cuentan");
  await expect(grisMeta(page).locator(".gx-gris-amt")).toHaveText("250,00 €");
  await expect(await gastosGrisFila(page, "TRASPASO HUCHA")).toContainText("Meta: ✈️ Viaje");
  await expect(gastosCifra(page)).toHaveText("50,00 €");
  await expect(dia20(page).getByTestId("gastos-dia-total")).toHaveText("30,00 €");

  // Inicio dice lo mismo: 1000 − 50.
  await aTab(page, "inicio");
  await expect(inicioQuedan(page)).toHaveText("950 €");

  // Plan → Metas: 100 a mano + 250 marcados = 350 (35 %), y dice de dónde vienen.
  await aMetas(page);
  const card = page.locator('[data-goal-id="viaje"]');
  await expect(card.getByTestId("goal-saved")).toHaveText("350 € de 1.000 €");
  await expect(card.getByTestId("goal-from-gastos")).toHaveText("250,00 € desde Gastos");
  await expect(card).toContainText("35%");
  // Lo apuntado a mano NO cambia: el campo de la meta sigue diciendo 100.
  await card.locator(".plan-item-open").click();
  await expect(page.locator('[data-goal-field="saved"]')).toHaveValue("100");
  await expect(page.getByTestId("goal-edit-from-gastos")).toHaveText("250,00 € desde Gastos");
  await page.keyboard.press("Escape").catch(() => {});
  await page.goBack().catch(() => {});

  // Quitar la marca desde el cargo de la fila gris: todo vuelve a como estaba.
  await aTab(page, "gastos");
  await (await gastosGrisFila(page, "TRASPASO HUCHA")).click();
  await page.getByTestId("exp-meta").click();
  await page.getByTestId("exp-meta-quitar").click();
  await expect(page.getByTestId("exp-meta-value")).toHaveText("No");
  await cierraFicha(page);
  await expect(grisMeta(page)).toHaveCount(0);
  await expect(fila(page, "TRASPASO HUCHA")).toHaveCount(1);
  await expect(gastosCifra(page)).toHaveText("300,00 €");
  await expect(dia20(page).getByTestId("gastos-dia-total")).toHaveText("280,00 €");
  await aMetas(page);
  await expect(page.locator('[data-goal-id="viaje"]').getByTestId("goal-saved")).toHaveText("100 € de 1.000 €");
  await expect(page.locator('[data-goal-id="viaje"]').getByTestId("goal-from-gastos")).toHaveCount(0);
});

test("una cuota o un apunte a mano no ofrecen la marca de meta", async ({ page }) => {
  await seedLoggedInDashboard(page, { ...base,
    debts: [{ id: "coche", name: "Préstamo coche", value: 5000, original: 9000, monthly: 197, day: 20, account: "trade_republic" }],
    expenses: [
      e("PRESTAMO COCHE", "2026-09-20", 197, "deudas", { debtId: "coche" }),
      { id: "cine", date: "2026-09-21T12:00:00Z", amount: 9, category: "ocio", merchant: "Cine", source: "manual", ent: "trade_republic" },
    ] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await aTab(page, "gastos");
  // La cuota: la fila se ve pero explica por qué no (una marca por gasto) y no hay metas que elegir.
  await (await gastosGrisFila(page, "PRESTAMO COCHE")).click();
  await page.getByTestId("exp-meta").click();
  await expect(page.getByTestId("exp-meta-options")).toContainText("Cada gasto lleva una sola marca");
  await expect(page.getByTestId("exp-meta-viaje")).toHaveCount(0);
  await cierraFicha(page);
  // El apunte a mano: ni la fila.
  await fila(page, "Cine").click();
  await expect(page.getByTestId("exp-meta")).toHaveCount(0);
});

/* LA MARCA QUE NO LLEGÓ A LA NUBE SE REINTENTA (revisión del 25/10/2026). Marcada sin red, la fila
   se queda con `metaPend`, que la protege del pull; si nadie volvía a subirla, este móvil la sacaba
   del gasto y el otro y el widget la seguían contando para siempre. Al abrir Gastos se reintenta. */
test("una marca de meta pendiente se vuelve a subir al abrir", async ({ page }) => {
  await seedLoggedInDashboard(page, { ...base,
    expenses: [e("TRASPASO HUCHA", "2026-09-20", 250, "otros", { extId: "ref-hucha", goalId: "viaje", metaPend: true })],
    __cloudRows: { expenses: [{ id: "7d0c3a4e-0b9f-4c55-9d7e-1f2a3b4c5d6e", fecha: "2026-09-20T12:00:00.000Z", importe: 250, comercio: "TRASPASO HUCHA", cat: "otros", source: "ob:trade_republic#refref-hucha" }] } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await aTab(page, "gastos");
  await expect.poll(() => page.evaluate(() => (window.__e2eUpdates || []).filter((u) => u.tabla === "expenses").map((u) => u.value.source)))
    .toContain("ob:trade_republic~meta.viaje#refref-hucha");
});
