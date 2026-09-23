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
  const ritmo=await page.locator(".v4-exp-sheet").evaluate(el=>{ const s=getComputedStyle(el); return {entrada:parseFloat(s.animationDuration)*1000,salida:parseFloat(s.transitionDuration)*1000}; });
  expect(ritmo.entrada).toBeGreaterThanOrEqual(400);
  expect(ritmo.salida).toBeGreaterThanOrEqual(300);
  await nombre.fill("Mercadona centro");
  await nombre.blur();                                   // el blur es el que guarda

  // El blur guarda mientras sigues editando; el botón explícito confirma y cierra con animación.
  await expect(nombre).toHaveValue("Mercadona centro");
  const done = page.locator(".v4-exp-sheet .v4-ficha-done");
  await expect(done).toBeVisible();
  await done.click();
  await expect(page.locator(".v4-exp-sheet")).toHaveCSS("transform", /matrix|translate3d/);
  await expect(page.locator(".v4-exp-sheet")).toHaveCount(0);
  // Al terminar, la app tiene que quedar viva: sin candado de scroll y respondiendo.
  await expect(page.locator("html")).not.toHaveClass(/sheet-open/);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  // La prueba de que se puede seguir usando: cambiar de pestaña y volver.
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(fila(page, "Mercadona centro")).toHaveCount(1);
});

test("reducir movimiento cierra la ficha sin esperar una animación invisible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await abreGastos(page);
  await fila(page, "Mercadona").click();
  await expect(page.locator(".v4-exp-sheet")).toBeVisible();

  const elapsed = await page.evaluate(() => new Promise((resolve, reject) => {
    const start=performance.now();
    const timeout=setTimeout(() => { observer.disconnect(); reject(new Error("la ficha no se cerró")); },1000);
    const observer=new MutationObserver(() => {
      if(document.querySelector(".v4-exp-sheet")) return;
      clearTimeout(timeout); observer.disconnect(); resolve(performance.now()-start);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    document.querySelector(".v4-exp-sheet .v4-ficha-done").click();
  }));
  expect(elapsed).toBeLessThan(100);
  await expect(page.locator("html")).not.toHaveClass(/sheet-open/);
});

test("ficha v4.1: un movimiento automático enseña su origen y bloquea importe y banco", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await abreGastos(page);

  await fila(page, "Mercadona").click();
  const sheet = page.locator(".v4-exp-sheet");
  await expect(sheet.locator('[data-testid="exp-trace"]')).toBeVisible();
  await expect(sheet.locator('[data-testid="exp-bank"]')).toHaveClass(/locked/);
  await expect(sheet.locator(".v4-ficha-foot .v4-cta")).toHaveCount(0);
  await expect(sheet.locator(".v4-ficha-saved")).toContainText("Se guarda al momento");
  await expect(sheet.locator(".v4-ficha-done")).toBeVisible();

  const before = await sheet.locator(".v4-ficha-amount").innerText();
  await sheet.locator(".v4-keys").getByRole("button", { name: "9", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("El importe lo manda el banco");
  await expect(sheet.locator(".v4-ficha-amount")).toHaveText(before);

  // Regresión del vídeo 17/9: quien scrollea es el body interior. Una bajada cuando ya está
  // desplazado debe seguir moviendo contenido, no aplicar translate3d a toda la ficha.
  const body = sheet.locator(".v4-sheet-body");
  const scrolled = await body.evaluate((el) => {
    el.scrollTop = Math.min(260, Math.max(1, el.scrollHeight - el.clientHeight));
    return el.scrollTop;
  });
  expect(scrolled).toBeGreaterThan(0);
  const bb = await body.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(bb.x + bb.width / 2);
  const y = Math.round(bb.y + Math.min(120, bb.height / 2));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + 70 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(sheet).toBeVisible();
  await expect.poll(() => sheet.evaluate((el) => el.style.transform || "none")).toBe("none");

  // `touchcancel` es frecuente cuando Android entrega el gesto al WebView: cancela, no cierra.
  await body.evaluate((el) => { el.scrollTop = 0; });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + 70 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(sheet).toBeVisible();
  await expect.poll(() => sheet.evaluate((el) => el.style.transform || "none")).toBe("none");
});

test("borrar permite deshacer y restaura el mismo id también en la nube", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await abreGastos(page);
  await page.evaluate(() => {
    window.__undoWrites = [];
    cloud.deleteExpense = async (e) => {
      window.__undoWrites.push(["delete", e.id]);
      await new Promise((resolve) => setTimeout(resolve, 80));
    };
    cloud.addExpense = async (e) => { window.__undoWrites.push(["add", e.id]); };
  });

  await fila(page, "Mercadona").click();
  await page.locator(".v4-ficha-del").click();
  await expect(page.locator(".askback .ts-hint")).toContainText("5 segundos");
  await page.locator(".askback .btn-primary").click();
  await expect(fila(page, "Mercadona")).toHaveCount(0);

  const undo = page.locator('[data-testid="expense-undo"]');
  await expect(undo).toBeVisible();
  // El toast anterior moría a 2,2 s; este sigue disponible durante la ventana prometida.
  await page.waitForTimeout(2500);
  await expect(undo).toBeVisible();
  await undo.getByRole("button", { name: "Deshacer" }).click();
  await expect(fila(page, "Mercadona")).toHaveCount(1);

  await expect.poll(() => page.evaluate(() => window.__undoWrites)).toEqual([
    ["delete", "e1"], ["add", "e1"],
  ]);
  await page.waitForTimeout(600);
  const saved = await page.evaluate(() => ({
    expenses: JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]"),
    deleted: (JSON.parse(localStorage.getItem("micartera_v3") || "{}") || {}).deleted || [],
  }));
  expect(saved.expenses.filter((e) => e.id === "e1")).toHaveLength(1);
  expect(saved.deleted).toHaveLength(0);
});

test("y se puede volver a verlo todo sin dejar el filtro pegado", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, settings, expenses, budget: 1000 });
  await abreGastos(page);

  await page.locator('button.v4-chip:has-text("🎛️")').first().click();
  await page.locator('.v4-sheet button.v4-chip:has-text("Ingresos")').click();
  await cierraSheet(page);
  await expect(lista(page)).toHaveCount(1);

  /* «Limpiar» se lleva el cajón y vuelve al default confirmado el 16/9: bancos de gasto diario.
     Para ver el histórico entero se elige «Todos los bancos» expresamente. */
  await page.locator('button.v4-chip:has-text("Limpiar")').first().click();
  await expect(lista(page)).toHaveCount(3);
  await expect(fila(page, "RECIBO ENDESA")).toHaveCount(0);

  await page.locator('button.v4-chip:has-text("🎛️")').first().click();
  await page.locator('.v4-sheet button.v4-chip:has-text("Todos los bancos")').click();
  await cierraSheet(page);
  await expect(lista(page)).toHaveCount(4);
  await expect(fila(page, "RECIBO ENDESA"), "Todos los bancos recupera el histórico completo").toHaveCount(1);
});
