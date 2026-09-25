import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* GUARDADO PARTIDO del estado (2026-07-24) — la causa gorda del «cuanto más la uso, más lenta va».
 *
 * Los gastos viven en su propia clave y solo se reescriben cuando cambian. La parte delicada es la
 * MIGRACIÓN: los móviles que ya están en marcha traen los gastos dentro de la clave principal y sin
 * clave de gastos. Si el primer guardado «ligero» reescribiera la principal sin gastos y no creara
 * la otra, el histórico desaparecería del móvil. Estos tests cubren justo eso. */

const KEY = "micartera_v3";
const KEY_EXP = "micartera_v3_exp";

test("widget se refresca al volver por el evento nativo sin visibilitychange", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    budget: 100,
    deleted: ["x|1|y"],
    accounts: [{ id: "a", ent: "sabadell", role: "diario", spendFrom: true, value: 1000 }],
    expenses: [{ id: "a", date: new Date().toISOString(), amount: 40, merchant: "Compra", category: "otros", source: "manual", ent: "sabadell" }],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["sabadell"] },
  });
  await page.addInitScript(() => {
    window.__nativeListeners = {};
    window.__widgetCalls = [];
    const addListener = (name, cb) => {
      const list = window.__nativeListeners[name] || (window.__nativeListeners[name] = []);
      list.push(cb);
      return Promise.resolve({ remove() { const i = list.indexOf(cb); if (i >= 0) list.splice(i, 1); } });
    };
    window.Capacitor = { isNativePlatform: () => false, Plugins: {
      App: { addListener },
      MiCartera: new Proxy({ addListener, updateWidget: async data => {
        window.__widgetCalls.push(data);
        window.__widgetSnapshot = data;
      } }, { get: (target, key) => target[key] || (() => Promise.resolve({})) }),
    } };
  });
  await page.goto("/");
  await dismissNews(page);
  await expect(page.locator(".v4-screen:has(.v4-inicio-head) .v4-budget-txt .ph")).toContainText("Has gastado 40 €");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(40);
  expect(await page.evaluate(() => ({ budget: window.__widgetSnapshot.budget,
    left: window.__widgetSnapshot.budgetLeft, bank: window.__widgetSnapshot.cashEnt })))
    .toEqual({ budget: 100, left: 60, bank: "sabadell" });
  expect(await page.evaluate(() => window.__widgetSnapshot.deletedKeys)).toContain("|x%7C1%7Cy|");
  // Ingest puede sobrescribir las preferencias mientras la app está en segundo plano.
  // Algunos Android solo notifican appStateChange: simular también visibilitychange escondería el bug.
  await page.evaluate(() => {
    window.__widgetSnapshot = { spent: 70 };
    for (const cb of window.__nativeListeners.appStateChange || []) cb({ isActive: false });
  });
  expect(await page.evaluate(() => window.__widgetSnapshot.spent)).toBe(70);
  await page.evaluate(() => {
    for (const cb of window.__nativeListeners.appStateChange || []) cb({ isActive: true });
  });
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(40);
  await expect(page.locator(".v4-screen:has(.v4-inicio-head) .v4-budget-txt .ph")).toContainText("Has gastado 40 €");
});

test("al cambiar de mes en segundo plano, Inicio y el push nativo dejan el gasto anterior", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-30T21:30:00Z") });
  await seedLoggedInDashboard(page, {
    budget: 100,
    accounts: [{ id: "a", ent: "trade_republic", role: "diario", spendFrom: true, value: 200 }],
    expenses: [{ id: "a", date: "2026-09-30T12:00:00Z", amount: 40,
      merchant: "Compra", category: "otros", source: "macrodroid" }],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["trade_republic"] },
  });
  await page.addInitScript(() => {
    window.__nativeListeners = {};
    const addListener = (name, cb) => {
      (window.__nativeListeners[name] ||= []).push(cb);
      return Promise.resolve({ remove() {} });
    };
    window.Capacitor = { isNativePlatform: () => false, Plugins: {
      App: { addListener },
      MiCartera: new Proxy({ addListener, updateWidget: async data => { window.__widgetSnapshot = data; } },
        { get: (target, key) => target[key] || (() => Promise.resolve({})) }),
    } };
  });
  await page.goto("/");
  await dismissNews(page);
  const title = page.locator(".v4-screen:has(.v4-inicio-head) .v4-budget-txt .ph");
  await expect(title).toContainText("Has gastado 40 €");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(40);
  const oldPeriod = await page.evaluate(() => window.__widgetSnapshot.periodStart);
  // UTC sigue en 30/9: solo Europe/Madrid ha pasado a octubre.
  await page.clock.setFixedTime(new Date("2026-09-30T22:05:00Z"));
  await page.evaluate(() => { for (const cb of window.__nativeListeners.appStateChange || []) cb({ isActive: true }); });
  await expect(title).toContainText("Has gastado 0 €");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(0);
  expect(await page.evaluate(() => window.__widgetSnapshot.periodStart)).toBeGreaterThan(oldPeriod);
  expect(await page.evaluate(() => window.__widgetSnapshot.budgetLeft)).toBe(100);
});

test("reentrada espera el gasto nuevo de la nube antes de sobrescribir el widget", async ({ page }) => {
  const fecha = new Date().toISOString();
  await seedLoggedInDashboard(page, {
    budget: 100,
    accounts: [{ id: "a", ent: "trade_republic", role: "diario", spendFrom: true, value: 200 }],
    expenses: [{ id: "a", date: fecha, amount: 40, merchant: "Primera", category: "otros",
      source: "macrodroid", ent: "trade_republic" }],
    __cloudRows: { expenses: [{ id: "550e8400-e29b-41d4-a716-446655440001", fecha,
      importe: 40, comercio: "Primera", cat: "otros", source: "macrodroid",
      ingest_event_id: "tr:trade_republic:v1_first" }] },
    __cloudDelays: { expenses: 350 },
  });
  await page.addInitScript(() => {
    window.__widgetCalls = [];
    window.__nativeListeners = {};
    const addListener = (name, cb) => {
      (window.__nativeListeners[name] ||= []).push(cb);
      return Promise.resolve({ remove() {} });
    };
    window.Capacitor = { isNativePlatform: () => false, Plugins: {
      App: { addListener },
      MiCartera: new Proxy({ addListener, updateWidget: async data => {
        window.__widgetCalls.push(data);
        window.__widgetSnapshot = data;
      } }, { get: (target, key) => target[key] || (() => Promise.resolve({})) }),
    } };
  });
  await page.goto("/");
  await dismissNews(page);
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(40);
  await page.evaluate(() => {
    window.__widgetSnapshot = { spent: 70 };
    window.__e2eCloudRows.expenses.push({ id: "550e8400-e29b-41d4-a716-446655440002",
      fecha: new Date().toISOString(), importe: 30, comercio: "Segunda", cat: "otros", source: "macrodroid",
      ingest_event_id: "tr:trade_republic:v1_second" });
    window.__widgetCalls = [];
    for (const cb of window.__nativeListeners.appStateChange || []) cb({ isActive: true });
  });
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__widgetSnapshot.spent)).toBe(70);
  expect(await page.evaluate(() => window.__widgetCalls.length)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.budgetLeft)).toBe(30);
  expect(await page.evaluate(() => window.__widgetSnapshot.coveredEvents)).toContain("|tr:trade_republic:v1_second|");
  expect(await page.evaluate(() => window.__widgetSnapshot.coveredEvents)).toContain("|550e8400-e29b-41d4-a716-446655440002|");
  await expect(page.locator(".v4-screen:has(.v4-inicio-head) .v4-budget-txt .ph")).toContainText("Has gastado 70 €");
  expect(await page.evaluate(() => window.__widgetSnapshot.spent)).toBe(70);
  await page.evaluate(() => {
    window.__e2eCloudDelays.expenses = [400, 50];
    for (const cb of window.__nativeListeners.appStateChange || []) cb({ isActive: true });
  });
  await page.waitForTimeout(30);
  await page.evaluate(() => {
    window.__e2eCloudRows.expenses.push({ id: "550e8400-e29b-41d4-a716-446655440003",
      fecha: new Date().toISOString(), importe: 10, comercio: "Tercera", cat: "otros", source: "macrodroid" });
    for (const cb of window.__nativeListeners.appStateChange || []) cb({ isActive: true });
  });
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(80);
  await page.waitForTimeout(430);
  expect(await page.evaluate(() => window.__widgetSnapshot.spent)).toBe(80);
  await expect(page.locator(".v4-screen:has(.v4-inicio-head) .v4-budget-txt .ph")).toContainText("Has gastado 80 €");
});

test("nube conserva inversión y traspaso al pintar Inicio y Gastos", async ({ page }) => {
  const fecha = new Date().toISOString();
  await seedLoggedInDashboard(page, {
    budget: 500, _fixMovInvasion2: true,
    accounts: [{ id: "a", ent: "sabadell", role: "diario", spendFrom: true, value: 1000 }],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["sabadell"] },
    __cloudRows: { expenses: [
      { id: "550e8400-e29b-41d4-a716-446655440001", fecha, importe: 20, comercio: "Compra", cat: "otros", source: "manual:sabadell" },
      { id: "550e8400-e29b-41d4-a716-446655440002", fecha, importe: 200, comercio: "Aporte prueba", cat: "inversion", source: "manual:sabadell" },
      { id: "550e8400-e29b-41d4-a716-446655440003", fecha, importe: 100, comercio: "Traspaso prueba", cat: "traspaso", source: "manual:sabadell" },
    ] },
  });
  await page.goto("/");
  await dismissNews(page);
  // La cifra que este caso protege es la de Inicio; se acota porque las pestañas se premontan.
  await expect(page.locator(".v4-screen:has(.v4-inicio-head) .v4-budget-txt .ph")).toContainText("Has gastado 20 €");
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator("button.v4-mov").filter({ hasText: "Aporte prueba" })).toHaveClass(/v4-mov-skip/);
  await expect(page.locator("button.v4-mov").filter({ hasText: "Traspaso prueba" })).toHaveClass(/v4-mov-skip/);
  await expect(page.locator("button.v4-mov").filter({ hasText: "Compra" })).not.toHaveClass(/v4-mov-skip/);
});

function gastos(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: "g" + i, date: new Date(Date.now() - i * 3600_000).toISOString(), amount: 10 + i, merchant: "Comercio " + i, category: "super", source: "manual" });
  }
  return out;
}

/** Cuenta cuántas veces se escribe REALMENTE cada clave, envolviendo localStorage.setItem.
 *  (Marcar el array con una propiedad no vale: JSON.stringify de un Array tira todo lo que no
 *   sea índice, así que el centinela nunca llegaba al disco — falso positivo del primer intento.) */
async function contarEscrituras(page) {
  await page.evaluate(() => {
    window.__w = { exp: 0, base: 0 };
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      if (k === "micartera_v3_exp") window.__w.exp++;
      else if (k === "micartera_v3") window.__w.base++;
      return orig(k, v);
    };
  });
}

test("estado ya partido: un cambio que no toca gastos NO reescribe el histórico", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: gastos(50) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForTimeout(800);   // deja que se asiente el primer guardado (y la partición)

  await contarEscrituras(page);

  // Un montón de interacción que NO toca gastos: cambiar de pestaña una y otra vez.
  for (let i = 0; i < 3; i++) {
    for (const tab of ["plan", "cartera", "inicio", "gastos"]) {
      await page.locator(`.botnav-tab[data-tour="${tab}"]`).click();
      await page.waitForTimeout(80);
    }
  }
  await page.waitForTimeout(900);

  const w = await page.evaluate(() => window.__w);
  // Cero reescrituras del histórico: eso es justo lo que quita el lag que crecía con los meses.
  expect(w.exp, `el histórico se reescribió ${w.exp} vez/veces sin que cambiara ningún gasto`).toBe(0);
});

test("apuntar un gasto SÍ reescribe el histórico", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: gastos(50) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForTimeout(800);

  const antes = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).length, KEY_EXP);

  await page.locator(".botnav-fab").click();
  await expect(page.locator(".v4-sheet")).toBeVisible();
  await page.waitForTimeout(450);
  for (const k of ["4", "2"]) await page.locator(".v4-keys button", { hasText: new RegExp(`^${k}$`) }).first().click();
  await page.locator(".v4-exp-sheet > .v4-cta").click();
  await page.waitForTimeout(900);

  const despues = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY_EXP);
  expect(despues.length).toBe(antes + 1);
  expect(despues.some((e) => Math.abs(e.amount) === 42)).toBe(true);
});

test("MIGRACIÓN: un estado viejo (todo junto) no pierde el histórico al partirse", async ({ page }) => {
  // Estado en formato ANTIGUO: gastos dentro de la clave principal y sin clave `_exp`.
  await seedLoggedInDashboard(page, { expenses: gastos(30) });
  await page.addInitScript((kExp) => { localStorage.removeItem(kExp); }, KEY_EXP);

  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  // Interacción que NO toca gastos: es justo el caso que podía tirar el histórico.
  for (const tab of ["plan", "cartera", "inicio"]) {
    await page.locator(`.botnav-tab[data-tour="${tab}"]`).click();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(900);

  // Los 30 gastos siguen ahí, ahora en la clave partida.
  const exp = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), KEY_EXP);
  expect(Array.isArray(exp), "no se creó la clave de gastos al migrar").toBe(true);
  expect(exp.length).toBe(30);

  // Y al recargar se ven igual (que es lo que de verdad importa).
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator("button.v4-mov").first()).toBeVisible({ timeout: 10_000 });
  const filas = await page.locator("button.v4-mov").count();
  expect(filas).toBeGreaterThan(0);
});

test("recargar conserva los gastos apuntados (ida y vuelta completa)", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: gastos(10) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForTimeout(600);

  await page.locator(".botnav-fab").click();
  await page.waitForTimeout(450);
  for (const k of ["9", "9"]) await page.locator(".v4-keys button", { hasText: new RegExp(`^${k}$`) }).first().click();
  await page.locator(".v4-exp-sheet > .v4-cta").click();
  await page.waitForTimeout(900);

  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator("button.v4-mov").filter({ hasText: "99" }).first()).toBeVisible({ timeout: 10_000 });
});

/* EL caso que causaba el lag: volver a primer plano. Pasa decenas de veces al día (abrir la app,
   cambiar de app y volver) y dispara syncCloudExpenses. Antes, cada vuelta reescribía el estado
   ENTERO — medido aquí: 477 KB con 2.000 gastos y 1.912 KB con 8.000, o sea que el coste crecía
   con el histórico. Eso es literalmente «cuanto más tiempo la uso, más se ralentiza». Ahora se
   escribe ~1 KB, y esa cifra ya NO depende de cuántos gastos tengas. */
test("volver a primer plano no reescribe el histórico (el lag que crecía con los meses)", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: gastos(400) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForTimeout(1200);

  await contarEscrituras(page);

  // Tres ciclos de segundo plano → primer plano.
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(700);
  }

  const w = await page.evaluate(() => window.__w);
  expect(w.exp, `cada vuelta a primer plano reescribió el histórico (${w.exp} veces)`).toBe(0);
});
