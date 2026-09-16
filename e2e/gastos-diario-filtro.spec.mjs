import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Contrato confirmado por él el 16/9: Gastos arranca mostrando TODOS los bancos marcados como
 * gasto diario. «Todos los bancos» sigue disponible como ampliación explícita del histórico. */

const d = (n) => new Date(Date.now() - n * 86400000).toISOString();

const accounts = [
  { id: "tr", ent: "trade_republic", name: "Efectivo", value: 6300, role: "diario", spendFrom: true },
  { id: "rv", ent: "revolut", name: "Revolut", value: 800, role: "fijos" },
  { id: "sb", ent: "sabadell", name: "Cuenta", value: 2000, role: "fijos" },
];
const settings = { autoPrices: false, theme: "green", expenseBanks: ["trade_republic", "revolut"] };
const expenses = [
  { id: "e1", date: d(1), amount: 12, merchant: "Mercadona TR", category: "super", source: "ob", ent: "trade_republic" },
  { id: "e2", date: d(1), amount: 8, merchant: "Cafe Revolut", category: "bares", source: "ob", ent: "revolut" },
  { id: "e3", date: d(1), amount: 50, merchant: "Aporte TR", category: "inversion", source: "ob", ent: "trade_republic" },
  { id: "e4", date: d(1), amount: 80, merchant: "RECIBO LUZ", category: "energia", source: "ob", ent: "sabadell" },
];

const lista = (page) => page.locator(".v4-gastos-list-body button.v4-mov");
const fila = (page, nombre) => lista(page).filter({ hasText: nombre });

async function mostrarTodosLosBancos(page) {
  await page.locator("button.v4-chip").filter({ hasText: "🎛️" }).first().click();
  await page.getByRole("button", { name: /Todos los bancos|All banks|Tots els bancs/i }).click();
  await page.getByRole("button", { name: /Listo|Done|Fet/i }).click();
}

test.use({ viewport: { width: 375, height: 812 } });

test("por defecto salen todos los bancos de gasto diario, no el resto", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();

  // SIN tocar ningún filtro: los dos bancos diarios, incluida Revolut (no solo el principal).
  await expect(fila(page, "Mercadona TR")).toHaveCount(1);
  await expect(fila(page, "Cafe Revolut")).toHaveCount(1);
  await expect(fila(page, "Aporte TR")).toHaveCount(1);
  await expect(fila(page, "RECIBO LUZ"), "Sabadell no está marcado como gasto diario").toHaveCount(0);

  // Y lo que CUENTA sigue siendo solo lo suyo del día a día: las otras dos salen apagadas,
  // cada una diciendo POR QUÉ, que son motivos distintos.
  await expect(fila(page, "Mercadona TR")).not.toHaveClass(/v4-mov-skip/);
  await expect(fila(page, "Cafe Revolut")).not.toHaveClass(/v4-mov-skip/);
  await expect(fila(page, "Aporte TR")).toHaveClass(/v4-mov-skip/);
  await expect(fila(page, "Aporte TR")).toContainText("no es un gasto");
  // El total del mes: 12 + 8. La inversión no puede colarse.
  const resumen = page.locator(".v4-gastos-summary");
  await expect(resumen, "enseñar un movimiento no es contarlo").toContainText("20,00");
  await expect(resumen).not.toContainText("100,00");
});

test("★ un ingreso de un banco que no es de gasto diario dice que no cuenta, como un gasto (14/9)", async ({ page }) => {
  /* Su «el balance no me cuadra»: los ingresos de Sabadell salían en verde normal y el balance no
     los sumaba. Ahora la fila dice lo mismo que la cifra. Y un traspaso entrante, «no es un gasto». */
  const conIngresos = expenses.concat([
    { id: "i1", date: d(1), amount: -14.9, merchant: "Bizum de Ana", category: "ingreso", source: "macrodroid", ent: "trade_republic" },
    { id: "i2", date: d(1), amount: -4.33, merchant: "TRANSFERENCIA POL", category: "ingreso", source: "ob", ent: "sabadell" },
    { id: "i3", date: d(1), amount: -291.25, merchant: "Movimiento traspaso", category: "traspaso", source: "ob", ent: "trade_republic" },
  ]);
  await seedLoggedInDashboard(page, { accounts, settings, expenses: conIngresos, budget: 1000 });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await mostrarTodosLosBancos(page);

  await expect(fila(page, "Bizum de Ana")).not.toHaveClass(/v4-mov-skip/);
  await expect(fila(page, "TRANSFERENCIA POL")).toHaveClass(/v4-mov-skip/);
  await expect(fila(page, "TRANSFERENCIA POL")).toContainText(/no es del día a día|not day-to-day|no és del dia a dia/i);
  await expect(fila(page, "Movimiento traspaso")).toHaveClass(/v4-mov-skip/);
  await expect(fila(page, "Movimiento traspaso")).toContainText(/no es un gasto|not spending|no és una despesa/i);
});

test("al entrar, Gastos NO cree que ya tiene un filtro puesto", async ({ page }) => {
  /* Lo cazó Cursor en la review de la 4.19.65, no un test: al cambiar el default a «todos los
     bancos» (array vacío), tres sitios seguían pensando que el default era «los de gasto diario».
     Resultado: el botón Filtros se encendía con un «1» y el chip «Todos los bancos» salía como
     filtro activo NADA MÁS ENTRAR, sin que él hubiera tocado nada. */
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-gastos-summary")).toBeVisible();

  /* El síntoma exacto: el botón de Filtros (🎛️) se encendía con la clase `on` y un contador al
     lado. Se mide ESO y no la existencia del chip de limpiar, que es lo que se me ocurrió primero
     y no cazaba nada — comprobado volviendo a meter el fallo. */
  const btnFiltros = page.locator("button.v4-chip").filter({ hasText: "🎛️" }).first();
  await expect(btnFiltros).toBeVisible();
  await expect(btnFiltros, "el botón de filtros no puede salir encendido sin filtros").not.toHaveClass(/\bon\b/);
  await expect(btnFiltros, "ni con un contador al lado").toHaveText("🎛️");
});

test("«Todos los bancos» amplía el histórico y «Limpiar» vuelve a gasto diario", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-gastos-summary")).toBeVisible();

  await expect(fila(page, "RECIBO LUZ")).toHaveCount(0);
  await mostrarTodosLosBancos(page);
  await expect(fila(page, "RECIBO LUZ"), "Todos los bancos recupera el histórico completo").toHaveCount(1);

  const limpiar = page.locator(".v4-chip").filter({ hasText: /Limpiar|Clear|Netejar/i }).first();
  await expect(limpiar).toBeVisible();
  await limpiar.click();
  await expect(fila(page, "RECIBO LUZ"), "tras limpiar vuelve la preselección de gasto diario").toHaveCount(0);
});
