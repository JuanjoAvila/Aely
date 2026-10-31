import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* INICIO Y GASTOS CON TRASPASOS Y FIN DE MES (petición del dueño, 31/10/2026).
   1. «Próximos cargos» con todo pagado a final de mes enseñaba el vacío de quien empieza («Aún no
      hay recibos · Conecta tu banco»). Con bancos o recibos salen los del mes que viene; sin nada
      que enseñar, la sección no sale; el vacío queda para quien no tiene ni banco ni recibos.
   2. «Últimos movimientos» enseñaba sus transferencias de Sabadell: ahora es la lista de Gastos
      tal como se abre (bancos del gasto diario) sin lo plegado en sus bloques.
   3. En Gastos, los traspasos van plegados en «Traspasos · no cuentan», al final del día.
   Render puro: lo que `npm test` no ve (AGENTS.md §7). Las cifras no cambian: la del día y la de
   arriba se comprueban iguales con y sin el traspaso. */

const accounts = [
  { id: "tr", ent: "trade_republic", name: "Efectivo", value: 3000, role: "diario", spendFrom: true },
  { id: "sb", ent: "sabadell", name: "Cuenta", value: 2000, role: "fijos" },
];
const obAccounts = [{ id: "ob-sb", ent: "sabadell", name: "Cuenta sintética", value: 2000, cur: "EUR" }];
const settings = { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["trade_republic"] };
const dia = "2026-10-30T10:00:00";
const expenses = [
  { id: "cafe", date: "2026-10-30T09:00:00", amount: 3.2, merchant: "Café ficticio", category: "restaurantes", source: "macrodroid", ent: "trade_republic" },
  { id: "tr-in", date: dia, amount: -1550, merchant: "Movimiento", category: "traspaso", source: "ob", ent: "trade_republic" },
  { id: "tr-out", date: dia, amount: 200, merchant: "Traspaso a ahorro", category: "traspaso", source: "ob", ent: "trade_republic" },
  { id: "sb-out", date: dia, amount: 1550, merchant: "Titular ficticio", category: "otros", source: "ob", ent: "sabadell" },
  { id: "pan", date: "2026-10-29T09:00:00", amount: 1.5, merchant: "Pan ficticio", category: "super", source: "macrodroid", ent: "trade_republic" },
];

async function open(page, overrides, time = "2026-10-31T10:00:00") {
  await page.clock.install({ time: new Date(time) });
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, budget: 1000, accounts, obAccounts, settings, expenses,
    fixed: [], debts: [], flows: [], oneoffs: [], bankTx: [] }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await expect(page.locator(".v4-skel")).toHaveCount(0);
}
const inicio = (page) => page.locator(".page-scroll-host");

test("Últimos movimientos: solo bancos del gasto diario y sin traspasos; en Gastos, plegados al final", async ({ page }) => {
  await open(page, {});
  const recent = inicio(page).getByTestId("inicio-recent").locator(".v4-mov");
  await expect(recent).toHaveCount(2);
  await expect(recent.nth(0)).toContainText("Café ficticio");
  await expect(recent.nth(1)).toContainText("Pan ficticio");
  await expect(inicio(page).getByTestId("inicio-recent")).not.toContainText("Titular ficticio");
  await expect(inicio(page).getByTestId("inicio-recent")).not.toContainText("1.550");

  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const body = page.locator(".v4-gastos-list-body");
  const dia30 = body.locator('section.gx-dia[data-gx-day="20261030"]');
  const gris = dia30.locator('.gx-gris[data-gris="traspaso"]');
  await expect(gris).toHaveCount(1);
  await expect(gris.locator(".gx-gris-t")).toHaveText("Traspasos · no cuentan");
  // Una pata entra y otra sale: sin cifra en el rótulo (sumarlas daría dinero que no se movió).
  await expect(gris.locator(".gx-gris-amt")).toHaveCount(0);
  await expect(gris.locator(".gx-gris-n")).toHaveText("2");
  // Al final del día, debajo de los gastos, y plegado.
  await expect(dia30.locator(":scope > *").last()).toHaveAttribute("data-gris", "traspaso");
  await expect(gris).not.toHaveClass(/abierto/);
  await expect(dia30.locator("button.v4-mov")).toHaveCount(1);
  // La pata de Sabadell no es de un banco del gasto diario: tampoco sale en Gastos al abrir.
  await expect(body).not.toContainText("Titular ficticio");
  await gris.locator(".gx-gris-h").click();
  await expect(gris).toHaveClass(/abierto/);
  await expect(gris.locator('.gx-gris-it[data-gris-id="tr-in"]')).toContainText("+1.550,00");
  await expect(gris.locator('.gx-gris-it[data-gris-id="tr-out"]')).toContainText("200,00");
  // El total del día es solo el café: el traspaso sigue sin contar.
  await expect(dia30.getByTestId("gastos-dia-total")).toHaveText("3,20 €");
  // Sin enlace a Plan: los traspasos no viven en ninguna pantalla.
  await expect(gris.locator(".gx-gris-plan")).toHaveCount(0);
});

test("todas las patas en el mismo sentido: el rótulo lleva su cifra", async ({ page }) => {
  await open(page, { expenses: expenses.filter((e) => e.id !== "tr-out") });
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const gris = page.locator('.v4-gastos-list-body .gx-gris[data-gris="traspaso"]');
  await expect(gris.locator(".gx-gris-amt")).toHaveText("+1.550,00 €");
});

test("Próximos cargos a final de mes con todo pagado: los del mes que viene", async ({ page }) => {
  const fixed = [{ id: "luz", name: "Luz ficticia", amount: 60, freq: "mes", day: 5, account: "sabadell", paidYm: 2026 * 12 + 10, paidDay: 5 }];
  await open(page, { fixed });
  const sec = inicio(page).getByTestId("inicio-upcoming");
  await expect(sec).toHaveAttribute("data-mes", "siguiente");
  await expect(sec.getByTestId("inicio-upcoming-mes")).toHaveText("En noviembre");
  await expect(sec.locator(".v4-charge")).toHaveCount(1);
  await expect(sec.locator(".v4-charge")).toContainText("Luz ficticia");
  await expect(sec.locator(".v4-charge .m")).toHaveText("nov");
  await expect(inicio(page).getByText("Aún no hay recibos", { exact: true })).toHaveCount(0);
});

test("con banco y sin nada este mes ni el que viene: la sección no sale", async ({ page }) => {
  await open(page, {});
  await expect(inicio(page).getByTestId("inicio-upcoming")).toHaveCount(0);
  await expect(inicio(page).getByText("Aún no hay recibos", { exact: true })).toHaveCount(0);
});

test("sin banco ni recibos: sigue el vacío de quien empieza", async ({ page }) => {
  await open(page, { obAccounts: [] });
  await expect(inicio(page).getByText("Aún no hay recibos", { exact: true })).toBeVisible();
  await expect(inicio(page).getByTestId("inicio-upcoming")).toHaveCount(0);
});

test("con recibos pendientes este mes: los de este mes, sin rótulo de mes", async ({ page }) => {
  const fixed = [{ id: "luz", name: "Luz ficticia", amount: 60, freq: "mes", day: 30, account: "sabadell" }];
  await open(page, { fixed }, "2026-10-20T10:00:00");
  const sec = inicio(page).getByTestId("inicio-upcoming");
  await expect(sec).toHaveAttribute("data-mes", "este");
  await expect(sec.getByTestId("inicio-upcoming-mes")).toHaveCount(0);
  await expect(sec.locator(".v4-charge .m")).toHaveText("oct");
});
