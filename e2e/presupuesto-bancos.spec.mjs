/* PRESUPUESTO-BANCOS (rechazo 4.19.1 + mudanza 4.19.55).
 *
 * Antes: chips en Mis bancos (`data-expbanks`). Ahora: roles en Cartera → editar cuenta
 * (`pickRole` escribe `expenseBanks`). Misma cifra de presupuesto al marcar un EXTRA.
 *
 * El sello `_bn*` es la misma rama que hace showToast (11-app-main). No miramos el toast
 * en pantalla: un sync fallido lo pisa.
 */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

function monthIso(day) {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), day, 12, 0, 0)).toISOString();
}

async function abrirCarteraEditar(page, overrides) {
  await seedLoggedInDashboard(page, Object.assign({
    hasBankLink: true,
  }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  // Como gastos-cabecera: pasar por Gastos cierra el drawer que tapa los rchip.
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.evaluate(() => {
    document.querySelectorAll(".settings-push.open").forEach((el) => el.classList.remove("open"));
    window.addEventListener("mc-bank-role-changed", (e) => e.stopImmediatePropagation(), true);
  });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.locator("button.edit-link").first().click();
  await expect(page.locator(".add-form")).toBeVisible({ timeout: 10_000 });
}

function rowCuenta(page, nameRe) {
  return page.locator(".add-form > div").filter({ hasText: nameRe }).first();
}

function expenseBanksOf(page) {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
    return ((s.settings && s.settings.expenseBanks) || []).slice().sort();
  });
}

test("Mis bancos ya no enseña el bloque de gasto diario; vive en Cartera", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    __cloudRows: {
      bank_links: [
        { aspsp_name: "Sabadell", aspsp_country: "ES", iban: "ES11", status: "active",
          valid_until: "2026-12-01T00:00:00Z", last_sync: "2026-09-01T09:00:00Z", accounts: [{ uid: "a1" }] },
      ],
    },
    hasBankLink: true,
    accounts: [
      { id: "a", ent: "sabadell", name: "Sabadell", value: 500, role: "diario", spendFrom: true },
    ],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(page.locator(".bk-sec, .bk-ver").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-expbanks]")).toHaveCount(0);
});

test("activar EXTRA en Cartera 40→60 sella el 50%; desactivar no borra filas", async ({ page }) => {
  const ym = new Date().toISOString().slice(0, 7);
  await abrirCarteraEditar(page, {
    accounts: [
      { id: "a", ent: "sabadell", name: "Sabadell", value: 500, role: "diario", spendFrom: true },
      { id: "b", ent: "caixabank", name: "Caixa", value: 200, role: "fijos" },
    ],
    settings: { expenseBanks: ["sabadell"] },
    budget: 100,
    expenses: [
      { id: "e-a", date: monthIso(5), amount: 40, merchant: "Mercadona", category: "super", source: "ob", ent: "sabadell" },
      { id: "e-b", date: monthIso(6), amount: 20, merchant: "Cafe", category: "ocio", source: "ob", ent: "caixabank" },
    ],
  });

  for (const th of [50, 80, 95, 100]) {
    await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) {} }, "_bn" + th + "_" + ym);
  }

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]"));
  const caixa = rowCuenta(page, /CaixaBank/);
  await caixa.locator("button.rchip", { hasText: /Gasto diario|Daily spending|Despesa diària/ }).click({ force: true });
  await expect.poll(() => expenseBanksOf(page)).toEqual(["caixabank", "sabadell"]);
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), "_bn50_" + ym)).toBe("1");

  await caixa.locator("button.rchip", { hasText: /Recibos|Bills|Rebuts/ }).click({ force: true });
  await expect.poll(() => expenseBanksOf(page)).toEqual(["sabadell"]);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]"));
  expect(after, "desactivar EXTRA no borra filas").toEqual(before);
});

async function cruzarUmbral(page, fromSpent, addSpent, bnKey) {
  const ym = new Date().toISOString().slice(0, 7);
  await abrirCarteraEditar(page, {
    accounts: [
      { id: "a", ent: "sabadell", name: "Sabadell", value: 500, role: "diario", spendFrom: true },
      { id: "b", ent: "caixabank", name: "Caixa", value: 200, role: "fijos" },
    ],
    settings: { expenseBanks: ["sabadell"] },
    budget: 100,
    expenses: [
      { id: "e-a", date: monthIso(5), amount: fromSpent, merchant: "Base", category: "super", source: "ob", ent: "sabadell" },
      { id: "e-b", date: monthIso(6), amount: addSpent, merchant: "Extra", category: "ocio", source: "ob", ent: "caixabank" },
    ],
  });
  for (const th of [50, 80, 95, 100]) {
    await page.evaluate(({ k }) => { try { localStorage.removeItem(k); } catch (e) {} }, { k: "_bn" + th + "_" + ym });
  }
  const caixa = rowCuenta(page, /CaixaBank/);
  await caixa.locator("button.rchip", { hasText: /Gasto diario|Daily spending|Despesa diària/ }).click({ force: true });
  await expect.poll(() => expenseBanksOf(page)).toEqual(["caixabank", "sabadell"]);
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), "_bn" + bnKey + "_" + ym)).toBe("1");
}

test("variante 70→90 sella el 80%", async ({ page }) => {
  await cruzarUmbral(page, 70, 20, 80);
});

test("variante 90→97 sella el 95%", async ({ page }) => {
  await cruzarUmbral(page, 90, 7, 95);
});

test("variante 97→102 sella el 100%", async ({ page }) => {
  await cruzarUmbral(page, 97, 5, 100);
});
