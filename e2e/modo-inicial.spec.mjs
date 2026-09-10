import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* MODO INICIAL — la app como recién instalada, sin vaciarse la cartera de verdad.
 *
 * Petición suya del 9/9, y es una petición con razón: el banco de pruebas COPIA la cartera real,
 * así que no había forma de mirar las pantallas vacías del pulido v4 (hero sin gráfico, tarjetas
 * de presupuesto/recibos/metas, racha a cero). Con sus palabras: «si no, te marcaré el 50% de las
 * pruebas que no puedo reproducirlo».
 *
 * Lo que este test protege es lo único que da miedo aquí: que vaciar las pruebas NO toque la
 * cartera real. Se comprueba leyendo las dos claves de localStorage por separado.
 */
async function ajustes(page, estado) {
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".set-card").first()).toBeVisible({ timeout: 10_000 });
}

test("★ la cartera REAL no se toca al sembrar la vacía", async ({ page }) => {
  await ajustes(page, { budget: 777, accounts: [{ id: "a1", ent: "sabadell", name: "Banco", value: 4321 }] });

  const antes = await page.evaluate(() => localStorage.getItem("micartera_v3"));
  await page.evaluate(() => mcSeedSandboxVacio());
  const despues = await page.evaluate(() => localStorage.getItem("micartera_v3"));
  expect(despues).toBe(antes);

  /* Y la de pruebas queda como recién instalada: sin datos y sin presupuesto.
     ⚠ Se lee por `mcLoadRaw`, NO por `localStorage.getItem` (10/9). Leyendo la clave a pelo se ve
     solo la mitad ligera —que sí se vaciaba— y este test salía verde con la función rota en su
     móvil: los gastos viven en `micartera_sandbox_exp` y volvían todos al arrancar. Un test tiene
     que mirar por donde mira la app. */
  const pruebas = await page.evaluate(() => mcLoadRaw("micartera_sandbox"));
  expect(pruebas.budget).toBe(0);
  expect(pruebas.accounts).toEqual([]);
  expect(pruebas.expenses).toEqual([]);
  // `onboarded` va a true a propósito: con el onboarding delante te obliga a poner presupuesto,
  // y entonces la tarjeta vacía de presupuesto no se puede ver nunca.
  expect(pruebas.onboarded).toBe(true);
});

/* La FILA de Ajustes no se cubre aquí a propósito: ese bloque solo lo ve el dueño
 * (`profiles.is_admin`, «solamente para mí» fue la petición), y el usuario de los e2e no es admin,
 * así que el panel ni la pinta. Comprobado: con el usuario de pruebas, «Banco de pruebas» tampoco
 * aparece. Lo que sí se cubre arriba es lo único que da miedo de verdad: que vaciar las pruebas no
 * roce la cartera real. */

/* ─────────────────────────────────────────────────────────────────────────────
   EL RECHAZO DEL 10/9, Y POR QUÉ EL TEST DE ARRIBA NO LO CAZÓ
   Sus palabras: «No funciona, entra sin más al banco de pruebas» y «Tampoco pasa nada, solamente
   sigue en el banco de pruebas como estaba, no resetea nada».
   Causa: el estado está PARTIDO —lo ligero en `micartera_sandbox` y los gastos en
   `micartera_sandbox_exp`— y sembrar escribía la clave principal a pelo. La app no lee de ahí:
   lee por `mcLoadRaw`, que pisa `expenses` con la mitad partida. Él ya había entrado antes al
   banco de pruebas, así que esa mitad tenía sus gastos y volvían todos.
   El test de arriba leía `localStorage.getItem("micartera_sandbox")`, o sea justo la mitad que sí
   se vaciaba: verde en CI, roto en su móvil. Desde aquí se comprueba por donde lo lee la app.
   ───────────────────────────────────────────────────────────────────────────── */

/** Deja el banco de pruebas como lo tenía él: usado antes, con la clave partida ya creada. */
async function conPruebasUsadas(page) {
  await page.evaluate(() => {
    mcSaveRaw("micartera_sandbox", {
      _dataVer: 6, onboarded: true, budget: 1000,
      accounts: [{ id: "x", ent: "revolut", name: "R", value: 99 }],
      expenses: [
        { id: "g1", amount: 12.5, cat: "comida", date: "2026-09-01" },
        { id: "g2", amount: 2.4, cat: "comida", date: "2026-09-10" },
      ],
    });
  });
  expect(await page.evaluate(() => mcLoadRaw("micartera_sandbox").expenses.length)).toBe(2);
}

test("★ vaciar las pruebas las deja SIN GASTOS de verdad (la mitad partida también)", async ({ page }) => {
  await ajustes(page, { budget: 777, accounts: [{ id: "a1", ent: "sabadell", name: "Banco", value: 4321 }] });
  await conPruebasUsadas(page);

  await page.evaluate(() => mcSeedSandboxVacio());

  // Lo que ve la APP al arrancar, no la clave a pelo. Esta es la línea que faltaba.
  const visto = await page.evaluate(() => mcLoadRaw("micartera_sandbox"));
  expect(visto.expenses, "el gasto que vuelve es justo lo que él vio: «sigue como estaba»").toEqual([]);
  expect(visto.accounts).toEqual([]);
  expect(visto.budget).toBe(0);
  // Y la mitad partida existe y está vacía, no ausente: si faltara, el primer guardado la crearía
  // con lo que hubiera en memoria.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_sandbox_exp")))).toEqual([]);
});

test("★ y la cartera REAL sigue intacta, con sus gastos", async ({ page }) => {
  await ajustes(page, { budget: 777, accounts: [{ id: "a1", ent: "sabadell", name: "Banco", value: 4321 }] });
  await page.evaluate(() => {
    const real = mcLoadRaw("micartera_v3") || {};
    real.expenses = [{ id: "r1", amount: 40, cat: "casa", date: "2026-09-02" }];
    mcSaveRaw("micartera_v3", real);
  });
  const antes = await page.evaluate(() => JSON.stringify(mcLoadRaw("micartera_v3")));
  await conPruebasUsadas(page);
  await page.evaluate(() => mcSeedSandboxVacio());
  expect(await page.evaluate(() => JSON.stringify(mcLoadRaw("micartera_v3")))).toBe(antes);
});

test("entrar al banco de pruebas COPIA los gastos reales, no una cartera a medias", async ({ page }) => {
  await ajustes(page, { budget: 777 });
  await page.evaluate(() => {
    const real = mcLoadRaw("micartera_v3") || {};
    real.expenses = [{ id: "r1", amount: 40, cat: "casa", date: "2026-09-02" }, { id: "r2", amount: 5, cat: "ocio", date: "2026-09-03" }];
    mcSaveRaw("micartera_v3", real);
    localStorage.removeItem("micartera_sandbox");
    localStorage.removeItem("micartera_sandbox_exp");
    mcEnterSandbox();
  });
  /* El segundo fallo del mismo origen: `store.get(STATE_KEY_REAL)` devuelve la mitad LIGERA, así
     que entrar al banco de pruebas te dejaba una cartera sin un solo gasto — y probar con eso no
     vale para nada, que es justo lo que motivó el modo inicial. */
  expect(await page.evaluate(() => mcLoadRaw("micartera_sandbox").expenses.length)).toBe(2);
});

test("tirar la cartera de pruebas se lleva las DOS mitades", async ({ page }) => {
  await ajustes(page, { budget: 777 });
  await conPruebasUsadas(page);
  await page.evaluate(() => mcResetSandbox());
  expect(await page.evaluate(() => localStorage.getItem("micartera_sandbox"))).toBeNull();
  // Si esta se quedaba huérfana, la siguiente entrada mezclaba los gastos de la sesión anterior
  // con la copia nueva de la cartera real.
  expect(await page.evaluate(() => localStorage.getItem("micartera_sandbox_exp"))).toBeNull();
});
