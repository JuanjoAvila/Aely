import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* DOS CUENTAS CON LA MISMA CLAVE (revisión externa 15/11/2026, R8). Dos huchas manuales con el mismo
   id compartían la lista de cierres: con 1.000 y 500 hoy y cierres de 1.000, la gráfica de Inicio
   pintaba 1.000 + 1.000 + 200 = 2.200 en octubre y caía a 1.700 hoy sin haberse movido un euro. Al
   cargar, cada una recibe su clave: la línea queda plana (1.700 todos los días), lo mezclado se
   queda guardado sin tocar y cada una vuelve a apuntar su cierre. Datos inventados. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const accounts = [
  { id: "dup", ent: "familia", name: "Hucha A", value: 1000, role: "fijos" },
  { id: "dup", ent: "familia", name: "Hucha B", value: 500, role: "fijos" },
  { id: "otra", ent: "familia", name: "Hucha C", value: 200, role: "fijos" },
];
const mezclado = [{ day: "2026-10-01", value: 1000 }, { day: "2026-10-20", value: 1000 }];

test("Inicio: dos cuentas con la misma clave no doblan el pasado de la gráfica", async ({ page }) => {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-11-10T12:00:00+01:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-11-10", bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], fixed: [],
    investments: [], invHistory: [], assets: [], settings, accounts, obAccounts: [],
    accountBalanceHistory: { "acc:dup": mezclado, "acc:otra": [{ day: "2026-10-01", value: 200 }] } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  // La línea de la gráfica: todos sus puntos a la misma altura (1.700 cada día).
  const linea = page.getByTestId("inicio-net-current").locator(".v42-net-line");
  await expect(linea).toHaveCount(1);
  const alturas = await linea.getAttribute("d").then((d) => (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter((_, i) => i % 2 === 1));
  expect(alturas.length).toBeGreaterThan(1);
  expect(new Set(alturas.map((y) => y.toFixed(1))).size, "línea plana: " + alturas.join(",")).toBe(1);
  // Guardado: claves distintas, lo mezclado intacto y, ya en Cartera, un cierre de hoy por cuenta.
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator(".botnav-tab.active")).toHaveAttribute("data-tour", "cartera");
  await expect.poll(async () => page.evaluate(() => {
    const s = mcLoadRaw(mcStateKey()), claves = s.accounts.map((a) => accountOrderKeyOf(a, "account"));
    return { distintas: new Set(claves).size, mezclado: s.accountBalanceHistory["acc:dup"],
      hoy: claves.map((k) => ((s.accountBalanceHistory[k] || []).slice(-1)[0] || {}).value) };
  }), { timeout: 8000 }).toEqual({ distintas: 3, mezclado, hoy: [1000, 500, 200] });
});
