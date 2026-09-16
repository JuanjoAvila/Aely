import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* BANCO DE PRUEBAS (petición 2026-07-24: «un entorno de pruebas solamente para mí dentro de mi
   móvil, para probar antes de que se suba a prod para el resto»).

   Lo que hay que blindar con tests no es la UI, es la PROMESA: mientras estás dentro, tu cartera
   real no se toca y no sale nada a la nube. Si eso falla, el modo pruebas es peor que no tenerlo,
   porque invita a trastear con datos que sí son reales. */

const REAL = "micartera_v3";
const TEST = "micartera_sandbox";

/** Deja el móvil «dentro del banco de pruebas» antes de que arranque la app. */
async function entraEnPruebas(page, { real, pruebas }) {
  // OJO: addInitScript corre en CADA carga, también tras el location.reload() de salir del modo
  // pruebas. Sin este guardo, el test volvería a activarlo y nunca vería la salida.
  await page.addInitScript(([r, p, kR, kT]) => {
    if (localStorage.getItem("_e2eSeeded")) return;
    localStorage.setItem("_e2eSeeded", "1");
    localStorage.setItem(kR, JSON.stringify(r));
    localStorage.setItem(kT, JSON.stringify(p));
    localStorage.setItem("_mcSandbox", "1");
    localStorage.setItem("_seenVersion", "dev");
  }, [real, pruebas, REAL, TEST]);
}

test("dentro del modo pruebas se ven los datos de PRUEBA, no los reales", async ({ page }) => {
  // Se siembra el estado base con el helper y luego se duplica a las dos claves con presupuestos
  // distintos: así se ve de un vistazo cuál de los dos está leyendo la app.
  await seedLoggedInDashboard(page, { budget: 500 });
  await page.addInitScript(([kR, kT]) => {
    const base = JSON.parse(localStorage.getItem(kR));
    localStorage.setItem(kT, JSON.stringify(Object.assign({}, base, { budget: 9999 })));
    localStorage.setItem("_mcSandbox", "1");
  }, [REAL, TEST]);

  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  // La banda naranja avisa de que NO son datos reales: sin ella es cuestión de tiempo apuntar un
  // gasto de verdad en la cartera de mentira.
  await expect(page.locator(".sandbox-bar")).toBeVisible();

  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-gastos-summary")).toContainText("9999");
});

test("lo que haces en pruebas NO toca la cartera real", async ({ page }) => {
  await seedLoggedInDashboard(page, { budget: 500 });
  await page.addInitScript(([kR, kT]) => {
    const base = JSON.parse(localStorage.getItem(kR));
    localStorage.setItem(kT, JSON.stringify(Object.assign({}, base, { budget: 9999 })));
    localStorage.setItem("_mcSandbox", "1");
  }, [REAL, TEST]);

  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  // Desde 4.8.0 el estado va PARTIDO: los gastos viven en `<clave>_exp`. Se vigilan las dos
  // claves reales — la promesa es que ninguna se toque estando en pruebas.
  const realAntes = await page.evaluate((k) => [localStorage.getItem(k), localStorage.getItem(k + "_exp")], REAL);

  // Apunta un gasto dentro del modo pruebas (FAB → teclado propio → Guardar).
  await page.locator(".botnav-fab").click();
  await expect(page.locator(".v4-sheet")).toBeVisible();
  await page.waitForTimeout(450);   // fin de la animación sheetup
  for (const k of ["7", "7"]) await page.locator(".v4-keys button", { hasText: new RegExp(`^${k}$`) }).first().click();
  await page.locator(".v4-exp-sheet > .v4-cta").click();
  await page.waitForTimeout(900);   // el guardado a localStorage va con debounce de 400 ms

  // El gasto entra en la cartera de PRUEBAS…
  const gastosPrueba = await page.evaluate((k) => JSON.parse(localStorage.getItem(k + "_exp") || "[]"), TEST);
  expect(gastosPrueba.some((e) => Math.abs(e.amount) === 77)).toBe(true);

  // …y la REAL sigue byte a byte como estaba, en sus dos claves.
  const realDespues = await page.evaluate((k) => [localStorage.getItem(k), localStorage.getItem(k + "_exp")], REAL);
  expect(realDespues).toEqual(realAntes);
});

test("salir del modo pruebas devuelve la cartera real intacta", async ({ page }) => {
  await entraEnPruebas(page, {
    real: { budget: 500, expenses: [], accounts: [], investments: [], assets: [], debts: [], fixed: [], flows: [], oneoffs: [], aportaciones: [], goals: [], shared: [], history: [], obAccounts: [], settings: {}, onboarded: true, _dataVer: 6 },
    pruebas: { budget: 9999, expenses: [], accounts: [], investments: [], assets: [], debts: [], fixed: [], flows: [], oneoffs: [], aportaciones: [], goals: [], shared: [], history: [], obAccounts: [], settings: {}, onboarded: true, _dataVer: 6 },
  });
  await page.goto("/");
  await expect(page.locator(".sandbox-bar")).toBeVisible({ timeout: 15_000 });

  // Tocar la banda = salir (y recargar).
  await page.locator(".sandbox-bar").click();
  await page.waitForLoadState("load");
  await expect(page.locator(".sandbox-bar")).toHaveCount(0);

  const sandboxFlag = await page.evaluate(() => localStorage.getItem("_mcSandbox"));
  expect(sandboxFlag).toBeNull();

  // La cartera de pruebas se queda guardada (para seguir otro día), la real no se ha tocado.
  const real = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), REAL);
  expect(real.budget).toBe(500);
  const test0 = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), TEST);
  expect(test0.budget).toBe(9999);
});

test("fuera del modo pruebas no hay ni rastro de la banda", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".sandbox-bar")).toHaveCount(0);
});
