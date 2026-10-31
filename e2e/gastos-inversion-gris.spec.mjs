import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra, gastosGrisFila, gastosSeccion } from "./fixtures.mjs";

/* FILA GRIS DE INVERSIONES (petición del dueño, 25/10/2026: «lo de deudas, metas y demás mola,
   haz lo mismo para inversiones»). Render puro derivado del estado (AGENTS §7): se abre Gastos de
   verdad y se mira el DOM.
   · las aportaciones a brókers (categoría Inversión, sale dinero) van a «Inversiones · no
     cuentan», cada una con su destino;
   · un traspaso entre cuentas propias y una venta (entra dinero) NO: no son aportaciones;
   · la cifra, el total del día e Inicio no cambian (la regla de qué cuenta es la de siempre);
   · buscando sale suelta y atenuada; con filtro de categoría no sale;
   · «Abrir en Cartera ›» lleva a Cartera → Tus inversiones; en modo sencillo no hay enlace.
   Reloj de las fixtures: 26/9/2026 a mediodía. */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

const e = (id, ymd, amount, category, extra = {}) => ({ id, date: ymd + "T12:00:00Z", amount, category, merchant: id, source: "ob", ent: "trade_republic", ...extra });
const base = {
  budget: 1000,
  settings: { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["trade_republic"] },
  accounts: [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 3000, role: "diario", spendFrom: true }],
  investments: [{ id: "msci", name: "MSCI World", ent: "trade_republic", shares: 1, value: 100, cost: 100, cur: "EUR" }],
};
/* Septiembre: lo que cuenta es 20 (hoy) + 30 (día 20) = 50, igual sin la fila gris que con ella:
   las inversiones y el traspaso ya eran neutras. El día 20 suma 30. */
const expenses = [
  e("Hoy super", "2026-09-26", 20, "super"),
  e("Compra del 20", "2026-09-20", 30, "compras"),
  e("APORTACION MYINVESTOR", "2026-09-20", 300, "inversion"),
  e("Redondeo", "2026-09-20", 1.5, "inversion", { investInvId: "msci" }),
  e("TRASPASO A SABADELL", "2026-09-20", 500, "traspaso"),
  e("VENTA ETF", "2026-09-21", -200, "inversion"),
];

const fila = (page, nombre) => gastosRoot(page).locator("button.v4-mov").filter({ hasText: nombre });
const dia20 = (page) => gastosRoot(page).locator('[data-gx-day="20260920"]');
const grisInv = (page) => gastosRoot(page).locator('.gx-gris[data-gris="inversion"]');
const inicioQuedan = (page) => page.locator(".v4-budget .v42-cycle-amount>.serif");

async function abre(page, overrides = {}) {
  await seedLoggedInDashboard(page, { ...base, expenses, ...overrides });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}
async function aTab(page, id) { await page.locator('.botnav-tab[data-tour="' + id + '"]').click(); }

test("★ las aportaciones a brókers van a «Inversiones · no cuentan» con su destino y las cifras no cambian", async ({ page }) => {
  await abre(page);
  await expect(inicioQuedan(page)).toHaveText("950 €");
  await aTab(page, "gastos");
  await expect(gastosCifra(page)).toHaveText("50,00 €");
  await expect(dia20(page).getByTestId("gastos-dia-total")).toHaveText("30,00 €");

  // Una sola fila gris en el día 20, con las dos aportaciones.
  await expect(grisInv(page)).toHaveCount(1);
  await expect(dia20(page).locator('.gx-gris[data-gris="inversion"]')).toHaveCount(1);
  await expect(grisInv(page).locator(".gx-gris-h")).toContainText("Inversiones · no cuentan");
  await expect(grisInv(page).locator(".gx-gris-amt")).toHaveText("301,50 €");
  await expect(grisInv(page).locator(".gx-gris-n")).toHaveText("2");
  await expect(fila(page, "APORTACION MYINVESTOR"), "ya no es una tarjeta suelta").toHaveCount(0);
  // El destino: el bróker que nombra el concepto, y la posición que compró la app con el cargo.
  await expect(await gastosGrisFila(page, "APORTACION MYINVESTOR")).toContainText("Inversión: MyInvestor");
  await expect(await gastosGrisFila(page, "Redondeo")).toContainText("Inversión: MSCI World");

  // Una venta sigue como tarjeta, atenuada y sin contar; el traspaso entre cuentas propias va a su
  // propio bloque, «Traspasos · no cuentan» (31/10/2026), nunca al de Inversiones.
  await expect(fila(page, "TRASPASO A SABADELL")).toHaveCount(0);
  await expect(page.locator('.v4-gastos-list-body .gx-gris[data-gris="traspaso"] .gx-gris-it').filter({ hasText: "TRASPASO A SABADELL" })).toHaveCount(1);
  await expect(fila(page, "VENTA ETF")).toHaveClass(/v4-mov-skip/);
  await expect(grisInv(page).locator(".gx-gris-it").filter({ hasText: "TRASPASO" })).toHaveCount(0);
  await expect(grisInv(page).locator(".gx-gris-it").filter({ hasText: "VENTA" })).toHaveCount(0);

  // Abrir un cargo de la fila abre su ficha, como en las otras grises.
  await (await gastosGrisFila(page, "APORTACION MYINVESTOR")).click();
  await expect(page.locator(".v4-exp-name")).toBeVisible();
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".v4-sheet-back")).toHaveCount(0);

  // «Abrir en Cartera ›» lleva a Cartera con «Tus inversiones» a la vista.
  const ir = grisInv(page).locator(".gx-gris-plan");
  await expect(ir).toHaveText("Abrir en Cartera ›");
  await ir.click();
  await expect(page.locator('.botnav-tab[data-tour="cartera"]')).toHaveClass(/active/);
  await expect(page.locator('[data-cartera-sec="inversiones"]')).toBeInViewport();
});

test("buscando sale suelta y atenuada con su destino; con filtro de categoría no sale", async ({ page }) => {
  await abre(page);
  await aTab(page, "gastos");
  await gastosRoot(page).locator(".searchbar-in").fill("myinvestor");
  await expect(grisInv(page)).toHaveCount(0);
  await expect(fila(page, "APORTACION MYINVESTOR")).toHaveCount(1);
  await expect(fila(page, "APORTACION MYINVESTOR")).toHaveClass(/v4-mov-skip/);
  await expect(fila(page, "APORTACION MYINVESTOR")).toContainText("Inversión: MyInvestor");
  await gastosRoot(page).locator(".searchbar-in").fill("");
  await expect(grisInv(page)).toHaveCount(1);

  // Categorías → Compras: solo sus movimientos, sin la fila gris.
  await gastosSeccion(page, "cats");
  await gastosRoot(page).locator('[data-gx-secc="cats"] .v4-gastos-cat[data-cat="compras"]').click();
  await expect(gastosRoot(page)).toHaveAttribute("data-secc", "movs");
  await expect(fila(page, "Compra del 20")).toHaveCount(1);
  await expect(gastosRoot(page).locator(".gx-gris")).toHaveCount(0);
});

test("en modo sencillo la fila sale pero sin enlace a Cartera", async ({ page }) => {
  await abre(page, { settings: { ...base.settings, simpleMode: true } });
  await aTab(page, "gastos");
  await expect(grisInv(page)).toHaveCount(1);
  await grisInv(page).locator(".gx-gris-h").click();
  await expect(grisInv(page).locator(".gx-gris-it")).toHaveCount(2);
  await expect(grisInv(page).locator(".gx-gris-plan")).toHaveCount(0);
});
