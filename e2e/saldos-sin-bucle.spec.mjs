import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, estadoHeredado } from "./fixtures.mjs";

test.use({ viewport: { width: 412, height: 915 }, timezoneId: "Europe/Madrid", serviceWorkers: "block" });
test.describe.configure({ retries: 0 });

/* EL CIERRE DIARIO DE SALDOS NO PUEDE DEJAR LA APP EN BUCLE (14/11/2026).
 *
 * Dos filas de «Tus cuentas» con la misma clave de histórico y saldos distintos se pisaban el
 * cierre de hoy la una a la otra: cada render veía que «la otra» no coincidía, escribía, el
 * histórico cambiaba de referencia y el efecto volvía a correr. Miles de renders por segundo, el
 * estado reescrito en disco sin parar y las pestañas sin cambiar (la transición nunca terminaba).
 * `estadoHeredado()` lo traía de serie —sus cuentas de banco conectadas no tienen `key`— y
 * media docena de pruebas corrían con la app así sin que ninguna lo dijera.
 *
 * Se cuentan las escrituras envolviendo `localStorage.setItem`. El arranque guarda lo suyo durante
 * unos seis segundos (primer cierre del día, copia de seguridad, vuelta de la nube); pasado eso
 * no queda nada que guardar. En bucle eran siete u ocho escrituras cada tres segundos: se deja
 * UNA de margen para una máquina lenta, que sigue separando de sobra un caso del otro. */
const contarEscrituras = (page) => page.addInitScript(() => {
  const original = Storage.prototype.setItem;
  window.__escrituras = [];
  Storage.prototype.setItem = function (key, value) {
    if (this === window.localStorage && String(key).indexOf("micartera_v3") === 0) window.__escrituras.push(String(key));
    return original.call(this, key, value);
  };
});
const abrir = async (page, state) => {
  await contarEscrituras(page);
  await seedLoggedInDashboard(page, { __seedOnce: true, ...state });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 10000 });
  await dismissNews(page);
};
const enReposo = async (page) => {
  await page.waitForTimeout(7000);
  await page.evaluate(() => { window.__escrituras.length = 0; });
  await page.waitForTimeout(3000);
  return page.evaluate(() => window.__escrituras.slice());
};
const cambiaDePestaña = async (page) => {
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour", "gastos", { timeout: 3000 });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour", "cartera", { timeout: 3000 });
};

test("cuentas de banco sin clave: en reposo no se escribe y las pestañas cambian", async ({ page }) => {
  const state = estadoHeredado("2026-10-13");
  // La premisa del caso: si un día la fixture gana `key`, este test dejaría de vigilar nada.
  expect(state.obAccounts.length).toBeGreaterThan(1);
  expect(state.obAccounts.every((o) => o.key === undefined)).toBe(true);
  await abrir(page, state);
  const escrituras = await enReposo(page);
  expect(escrituras.length, "escrituras de micartera_v3* en 3 s de reposo: " + escrituras.join(", ")).toBeLessThanOrEqual(1);
  await cambiaDePestaña(page);
  // Una cuenta que no se sabe cuál es no deja cierre: ni con la clave rota de antes ni con otra.
  const claves = await page.evaluate(() => Object.keys(mcLoadRaw("micartera_v3").accountBalanceHistory || {}));
  expect(claves).not.toContain("ob:undefined");
  expect(claves).not.toContain("ob:");
  expect(claves).toContain("acc:sab");
});

test("dos cuentas con la misma clave: ninguna pisa el cierre de la otra", async ({ page }) => {
  const state = estadoHeredado("2026-10-13");
  const previo = [{ day: "2026-10-01", value: 700 }];
  state.obAccounts = [
    { ...state.obAccounts[0], key: "repetida" },
    { ...state.obAccounts[1], key: "repetida" }];
  state.accountBalanceHistory["ob:repetida"] = previo;
  await abrir(page, state);
  const escrituras = await enReposo(page);
  expect(escrituras.length, "escrituras de micartera_v3* en 3 s de reposo: " + escrituras.join(", ")).toBeLessThanOrEqual(1);
  await cambiaDePestaña(page);
  const hist = await page.evaluate(() => mcLoadRaw("micartera_v3").accountBalanceHistory || {});
  // Lo que hubiera se queda como estaba: no se sabe de cuál de las dos sería el cierre de hoy.
  expect(hist["ob:repetida"]).toEqual(previo);
  expect(hist["acc:sab"].length).toBe(1);
});
