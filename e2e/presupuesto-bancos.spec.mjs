/* PRESUPUESTO-BANCOS (rechazo 4.19.1/avisos-presupuesto, 2026-09-08).
 *
 * La cuenta principal de gasto diario siempre cuenta; desmarcarla no hace nada útil.
 * El guion pide probar con un EXTRA. E2E: principal A=40, extra B=20, presupuesto 100.
 */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const links = [
  { aspsp_name: "Sabadell", aspsp_country: "ES", iban: "ES11", status: "active",
    valid_until: "2026-12-01T00:00:00Z", last_sync: "2026-09-01T09:00:00Z", accounts: [{ uid: "a1" }] },
  { aspsp_name: "CaixaBank", aspsp_country: "ES", iban: "ES22", status: "active",
    valid_until: "2026-12-01T00:00:00Z", last_sync: "2026-09-01T09:00:00Z", accounts: [{ uid: "a2" }] },
];

function monthIso(day) {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), day, 12, 0, 0)).toISOString();
}

async function abrirMisBancos(page, overrides) {
  await seedLoggedInDashboard(page, Object.assign({
    __cloudRows: { bank_links: links },
    hasBankLink: true,
  }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(page.locator("[data-expbanks]")).toBeVisible({ timeout: 10_000 });
}

test("la cuenta principal de gasto diario no se desmarca; avisa al tocarla", async ({ page }) => {
  await abrirMisBancos(page, {
    accounts: [
      { id: "a", ent: "sabadell", name: "Sabadell", value: 500, role: "diario", spendFrom: true },
      { id: "b", ent: "caixabank", name: "Caixa", value: 200, role: "fijos" },
    ],
    settings: { expenseBanks: ["sabadell", "caixabank"] },
    budget: 100,
  });

  const primary = page.locator('[data-expbanks] button[data-ent="sabadell"]');
  await expect(primary).toHaveAttribute("data-primary", "1");
  await expect(primary).toContainText(/principal|main|obligat/i);
  await primary.click();
  await expect(page.locator(".toast").filter({ hasText: /gasto diario|daily-spend|despesa diària/i })).toBeVisible({ timeout: 8_000 });
  await expect(primary).toHaveClass(/on/);
});

test("activar EXTRA 40→60 cruza el 50% una vez; desactivar vuelve a 40 sin borrar filas", async ({ page }) => {
  const ym = new Date().toISOString().slice(0, 7);
  await abrirMisBancos(page, {
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

  await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) {} }, "_bn50_" + ym);
  await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) {} }, "_bn80_" + ym);
  await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) {} }, "_bn95_" + ym);
  await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) {} }, "_bn100_" + ym);

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]"));
  const extra = page.locator('[data-expbanks] button[data-ent="caixabank"]');
  await expect(extra).not.toHaveClass(/on/);
  await extra.click();
  await expect(extra).toHaveClass(/on/);
  await expect(page.locator(".toast").filter({ hasText: /Mitad del presupuesto|Half the monthly|Meitat del pressupost/i })).toBeVisible({ timeout: 10_000 });

  // Segunda pulsación no debe re-disparar el 50 del mismo mes.
  await page.waitForTimeout(500);
  const toasts50 = await page.locator(".toast").filter({ hasText: /Mitad del presupuesto|Half the monthly|Meitat del pressupost/i }).count();
  expect(toasts50).toBeLessThanOrEqual(1);

  await extra.click();
  await expect(extra).not.toHaveClass(/on/);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]"));
  expect(after, "desactivar EXTRA no borra filas").toEqual(before);
});

async function cruzarUmbral(page, fromSpent, addSpent, toastRe) {
  const ym = new Date().toISOString().slice(0, 7);
  await abrirMisBancos(page, {
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
  await page.locator('[data-expbanks] button[data-ent="caixabank"]').click();
  await expect(page.locator(".toast").filter({ hasText: toastRe })).toBeVisible({ timeout: 10_000 });
}

test("variante 70→90 cruza el 80% una vez", async ({ page }) => {
  await cruzarUmbral(page, 70, 20, /80%|80 %/i);
});

test("variante 90→97 cruza el 95% una vez", async ({ page }) => {
  await cruzarUmbral(page, 90, 7, /95%|95 %/i);
});

test("variante 97→102 cruza el 100% una vez", async ({ page }) => {
  await cruzarUmbral(page, 97, 5, /100%|presupuesto.*100|budget.*100|pressupost/i);
});
