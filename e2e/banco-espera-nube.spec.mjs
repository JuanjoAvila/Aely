import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard } from "./fixtures.mjs";

/* PRIMERO LA NUBE, LUEGO EL BANCO (15/9, el «+18,09» de su balance).
 *
 * Medido en su nube: el 13/9 una web que llevaba tres días cerrada sincronizó Trade Republic con
 * su estado local viejo. No conocía el «Movimiento» de 18,09 € que él ya había renombrado a
 * «Transferencia a banco Sabadell» desde el móvil, lo metió otra vez con id nuevo, y al bajar la
 * nube había dos: el traspaso contaba como gasto.
 *
 * Aquí se reproduce igual: el móvil tiene el estado de antes (sin la fila), la nube la tiene
 * renombrada y TARDA en contestar, y el banco devuelve el «Movimiento». Se dispara una petición
 * explícita tras abrir: el bootstrap bancario desatendido se retiró para no gastar el cupo PSD2.
 * Con el código viejo acababan dos filas de 18,09.
 */

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const base = () => ({
  accounts: [{ id: "tr", ent: "trade_republic", name: "Trade Republic", role: "diario", value: 900 }],
  settings: { autoPrices: false, theme: "green", expenseBanks: ["trade_republic"] },
  hasBankLink: true,
  expenses: [],
});

const renombradaEnLaNube = () => ({
  id: "11111111-1111-4111-8111-111111111111", fecha: hoy() + "T10:00:00+00:00", importe: 18.09,
  comercio: "Transferencia a banco Sabadell", ob_name: "Movimiento", cat: "traspaso",
  source: "ob:trade_republic", no_card: false, nota: null, nota_edit: false,
});

const bancoConMovimiento = () => ({
  "bank-sync": {
    data: {
      ok: true,
      links: [{
        aspsp: "Trade Republic", ok: true,
        accounts: [{ uid: "t1", ok: true, balances: [], transactions: [{ date: hoy(), amount: 18.09, merchant: "Movimiento" }] }],
      }],
    },
    error: null,
  },
});

const filas1809 = (page) => page.evaluate(() => {
  const exps = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
  return exps.filter((e) => Math.abs(Math.abs(e.amount) - 18.09) < 0.005)
    .map((e) => e.merchant);
});

test("★ con la nube lenta, el banco espera: el «Movimiento» ya renombrado no se repite", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    ...base(),
    __cloudRows: { expenses: [renombradaEnLaNube()] },
    __cloudDelays: { expenses: 2500 },
    __cloudFns: bancoConMovimiento(),
  });
  await page.addInitScript(() => {
    window.__nBankSync = 0;
    const t = setInterval(() => {
      if (typeof cloud === "undefined" || !cloud.bankSync || cloud.bankSync.__contado) return;
      const real = cloud.bankSync;
      cloud.bankSync = function () { window.__nBankSync++; return real.apply(this, arguments); };
      cloud.bankSync.__contado = true;
      clearInterval(t);
    }, 5);
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-bank-role-changed")));

  // Que el banco se llegó a consultar: si no, el verde de abajo no probaría nada.
  await expect.poll(() => page.evaluate(() => window.__nBankSync), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect.poll(() => filas1809(page), { timeout: 15_000 }).toContain("Transferencia a banco Sabadell");
  await page.waitForTimeout(1500);   // el sync del banco ya terminó: nada más tiene que entrar
  expect(await filas1809(page), "una sola fila: la que él renombró").toEqual(["Transferencia a banco Sabadell"]);
});

test("si la nube falla, no se llama al banco (y nada se apunta con el estado viejo)", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    ...base(),
    __cloudErrors: { expenses: "sin red" },
    __cloudFns: bancoConMovimiento(),
  });
  await page.addInitScript(() => {
    window.__nBankSync = 0;
    const t = setInterval(() => {
      if (typeof cloud === "undefined" || !cloud.bankSync || cloud.bankSync.__contado) return;
      const real = cloud.bankSync;
      cloud.bankSync = function () { window.__nBankSync++; return real.apply(this, arguments); };
      cloud.bankSync.__contado = true;
      clearInterval(t);
    }, 5);
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  // Sync a mano del banco, además del de arranque.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-bank-role-changed")));
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => window.__nBankSync), "sin pull de la nube no se consulta el banco").toBe(0);
  expect(await filas1809(page)).toEqual([]);
});
