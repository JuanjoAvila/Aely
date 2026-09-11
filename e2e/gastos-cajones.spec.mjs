import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* QUÉ CUENTA Y QUÉ NO, en Gastos (petición suya al volver del crucero, 2026-08-17).
   Sus palabras: «en gastos que salga de manera clasificada los gastos que no cuentan porque hay
   bastante caos entre gastos que cuentan, ingresos y movimientos que no cuentan sean inversiones
   o movimientos sin más».

   Antes la lista marcaba con un «no afecta» genérico tanto una inversión como un recibo del banco
   de gastos fijos, que no se parecen en nada: uno es dinero suyo cambiando de sitio, el otro es un
   gasto de verdad que simplemente no sale de la cuenta del día a día.

   Esto es render + filtro, o sea justo lo que `npm test` no ve (AGENTS.md §7): la función de
   cajones puede estar perfecta y aun así no pintarse. Por eso abre Gastos de verdad. */

const d = (n) => new Date(Date.now() - n * 86400000).toISOString();

const accounts = [
  { id: "tr", ent: "trade_republic", name: "Efectivo", value: 6300, role: "diario", spendFrom: true },
  { id: "sb", ent: "sabadell", name: "Cuenta", value: 2000, role: "fijos" },
];
const settings = { autoPrices: false, theme: "green", expenseBanks: ["trade_republic"] };

const expenses = [
  { id: "e1", date: d(1), amount: 45.2, merchant: "Mercadona", category: "super", source: "macrodroid", ent: "trade_republic" },
  { id: "e2", date: d(2), amount: -1200, merchant: "Nomina", category: "ingreso", source: "macrodroid", ent: "trade_republic" },
  { id: "e3", date: d(3), amount: 50, merchant: "Aporte FTSE", category: "inversion", source: "macrodroid", ent: "trade_republic" },
  { id: "e4", date: d(4), amount: 448.39, merchant: "RECIBO ENDESA", category: "hogar", source: "ob", ent: "sabadell" },
];

async function abreGastos(page) {
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  // El filtro de banco arranca en la cuenta diaria; para ver los cuatro cajones hace falta todo.
  await page.locator('button.v4-chip[title="Filtros"], button.v4-chip:has-text("🎛️")').first().click();
  await page.locator('.v4-sheet button.v4-chip:has-text("Todos los bancos")').click();
  await cierraSheet(page);
}

/** El sheet se cierra tocando fuera: Escape deja el backdrop puesto y tapa los clics de después. */
async function cierraSheet(page) {
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".v4-sheet-back")).toHaveCount(0);
}

/* Acotado al contenedor de la lista a propósito: la app PREMONTA las pestañas ocultas a los ~3 s,
   así que un selector suelto puede acabar resolviendo a la copia escondida de otra pestaña y
   ningún timeout lo arregla. */
const lista = (page) => page.locator(".v4-gastos-list-body button.v4-mov");
const fila = (page, nombre) => lista(page).filter({ hasText: nombre });

test("una inversión y un recibo de otro banco ya NO dicen lo mismo", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await abreGastos(page);

  // Los dos siguen sin contar…
  await expect(fila(page, "Aporte FTSE")).toHaveClass(/v4-mov-skip/);
  await expect(fila(page, "RECIBO ENDESA")).toHaveClass(/v4-mov-skip/);
  // …pero cada uno dice POR QUÉ, que es lo que pedía.
  await expect(fila(page, "Aporte FTSE")).toContainText("no es un gasto");
  await expect(fila(page, "RECIBO ENDESA")).toContainText("no es del día a día");
  // Y el genérico de antes ya no sale por ninguna parte.
  await expect(page.locator(".v4-gastos-list-body")).not.toContainText("no afecta");
});

test("un gasto normal y un ingreso no salen apagados", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await abreGastos(page);

  await expect(fila(page, "Mercadona")).not.toHaveClass(/v4-mov-skip/);
  // Un ingreso NO es un gasto descartado: entra dinero. No puede pintarse como los de arriba.
  await expect(fila(page, "Nomina")).not.toHaveClass(/v4-mov-skip/);
  await expect(fila(page, "Nomina")).toContainText("+");
});

test("el filtro «Qué contar» deja ver un cajón a solas", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await abreGastos(page);
  await expect(lista(page)).toHaveCount(4);

  await page.locator('button.v4-chip:has-text("🎛️")').first().click();
  await page.locator('.v4-sheet button.v4-chip:has-text("Inversión y traspasos")').click();
  await cierraSheet(page);

  await expect(lista(page)).toHaveCount(1);
  await expect(fila(page, "Aporte FTSE")).toHaveCount(1);
});

test("★ guardar un cambio NO deja la pantalla muerta", async ({ page }) => {
  /* Rechazo suyo de la 4.17.0.1: «al modificarlo y guardarlo se bloquea la pantalla, no deja hacer
     nada, solo si tiras para atrás ahí puedes seguir». El sheet decidía pintarse con
     `!exp || !editExp` pero sus candados iban con `!!exp`: al guardar se vaciaba `editExp`, el
     sheet dejaba de pintarse y el `overflow:hidden` + el bloqueo de `touchmove` se quedaban
     puestos sobre una pantalla vacía. Venía de la v3.108.0 y saltaba con cualquier blur del
     importe o del nombre; se destapó al pedirle que renombrara un «Movimiento». */
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await abreGastos(page);

  await fila(page, "Mercadona").click();
  const nombre = page.locator(".v4-exp-name");
  await expect(nombre).toBeVisible();
  await nombre.fill("Mercadona centro");
  await nombre.blur();                                   // el blur es el que guarda

  // El sheet sigue en pie con lo guardado dentro: «al perder el foco se guarda, no se cierra».
  await expect(nombre).toHaveValue("Mercadona centro");

  // Y al cerrarlo de verdad, la app tiene que quedar viva: sin candado de scroll y respondiendo.
  await cierraSheet(page);
  await expect(page.locator("html")).not.toHaveClass(/sheet-open/);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  // La prueba de que se puede seguir usando: cambiar de pestaña y volver.
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(fila(page, "Mercadona centro")).toHaveCount(1);
});

test("y se puede volver a verlo todo sin dejar el filtro pegado", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await abreGastos(page);

  await page.locator('button.v4-chip:has-text("🎛️")').first().click();
  await page.locator('.v4-sheet button.v4-chip:has-text("Ingresos")').click();
  await cierraSheet(page);
  await expect(lista(page)).toHaveCount(1);

  /* «Limpiar» tiene que llevarse también este, no solo categorías y bancos. Deja el filtro como
     al entrar — y desde el 11/9 al entrar salen TODAS las cuentas, no solo las de gasto diario
     (su petición: «TODAS las cuentas deben salir en el apartado de gastos aunque no esté marcado
     gasto diario»). Así que vuelven los cuatro, incluido el recibo de Sabadell: se VE, pero sigue
     sin contar para el presupuesto, que es lo que se prueba en `gastos-diario-filtro`. */
  await page.locator('button.v4-chip:has-text("Limpiar")').first().click();
  await expect(lista(page)).toHaveCount(4);
  await expect(fila(page, "RECIBO ENDESA"), "limpiar no puede dejar fuera una cuenta suya").toHaveCount(1);
});
