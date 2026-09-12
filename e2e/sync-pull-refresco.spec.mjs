import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* PULL MUERTO (12/9). Tras el one-shot, Aigües en nube era correcta y el móvil seguía en
 * `viajes` con «Ya estás al día». Causa: sync solo AÑADÍA claves nuevas; nunca refrescaba.
 * Este e2e siembra la misma clave en local (viajes) y en la nube (agua) y exige que un
 * sync deje la categoría de la nube. (Antes la nube decía `energia`; se partió en agua/luz/gas.) */

const fecha = "2026-09-10T12:00:00.000Z";

test("un sync refresca la categoría de una fila que ya teníamos", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "a", ent: "sabadell", name: "Sabadell", value: 500, role: "diario", spendFrom: true }],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["sabadell"] },
    expenses: [{
      id: "loc-aigues", date: fecha, amount: 81.29,
      merchant: "AIGUES DE BARCELONA", category: "viajes", source: "ob", ent: "sabadell",
    }],
    __cloudRows: {
      expenses: [{
        id: "cloud-aigues", fecha, importe: 81.29,
        comercio: "AIGUES DE BARCELONA", cat: "agua", source: "ob:sabadell",
      }],
    },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);

  await expect.poll(() => page.evaluate(() => {
    const ex = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
    const hit = ex.find((e) => /AIGUES/i.test(e.merchant || ""));
    return hit && hit.category;
  })).toBe("agua");
});

test("un sync con cat legacy energia de la nube acaba en agua", async ({ page }) => {
  /* Su nube AÚN tiene `energia` (one-shot de esta mañana). Al bajar, resolveCategory no
     encuentra el id en CAT y cae a autoCategory → agua. No es seedFlows: el pull llega después. */
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "a", ent: "sabadell", name: "Sabadell", value: 500, role: "diario", spendFrom: true }],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["sabadell"] },
    expenses: [{
      id: "loc-aigues-leg", date: fecha, amount: 81.29,
      merchant: "AIGUES DE BARCELONA", category: "viajes", source: "ob", ent: "sabadell",
    }],
    __cloudRows: {
      expenses: [{
        id: "cloud-aigues-leg", fecha, importe: 81.29,
        comercio: "AIGUES DE BARCELONA", cat: "energia", source: "ob:sabadell",
      }],
    },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);

  await expect.poll(() => page.evaluate(() => {
    const ex = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
    const hit = ex.find((e) => /AIGUES/i.test(e.merchant || ""));
    return hit && hit.category;
  })).toBe("agua");
});

test("un sync NO borra una fila local que la nube no ha mandado", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "a", ent: "sabadell", name: "Sabadell", value: 500, role: "diario", spendFrom: true }],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["sabadell"] },
    expenses: [
      { id: "keep-me", date: fecha, amount: 12, merchant: "SoloLocal", category: "otros", source: "ob", ent: "sabadell" },
    ],
    __cloudRows: { expenses: [] },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.waitForTimeout(800);

  const merchants = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").map((e) => e.merchant));
  expect(merchants).toContain("SoloLocal");
});
