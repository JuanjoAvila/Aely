/* Recibo anual en ReciboPasos: hay que poder elegir mes(es) y día; el botón Siguiente no parpadea al
 * cambiar de paso ni al volver atrás. Sin el arreglo del mes, el alta anual no llega a guardarse. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

test.beforeEach(async ({ page }) => {
  await installFixtureClock(page);
});

const accounts = [{ id: "sab", ent: "sabadell", name: "Nómina y recibos", value: 2000, role: "fijos" }];
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const fixedBase = [{ id: "luz", name: "Luz", amount: 50, freq: "mes", account: "sabadell", day: 5 }];

const hoja = (page) => page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
const paso = (page, n) => hoja(page).locator('[data-rp4-paso="' + n + '"]');
const cta = (page) => hoja(page).locator('[data-rp4-cta="1"]');

async function abreTusRecibos(page, overrides) {
  await seedLoggedInDashboard(page, Object.assign({ accounts, fixed: fixedBase, debts: [], flows: [], oneoffs: [], budget: 1000, settings }, overrides || {}));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const nombre = await page.evaluate(() => t("pr6_todos"));
  await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button", { name: nombre, exact: true }).click();
  return page.locator("[data-bills-manage]");
}

async function abreAlta(page) {
  const hub = await abreTusRecibos(page);
  await hub.locator('[data-act="bill-add"]').first().click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
}

async function hastaCuando(page, name, amountDigits) {
  await paso(page, 0).locator('[data-rp4="name"]').fill(name);
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  for (const d of amountDigits) await paso(page, 1).locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "2");
}

async function expectCtaEstable(page, accion) {
  await page.evaluate(() => {
    window.__rp4Cta = { unmounts: 0, ops: [] };
    const btn = document.querySelector('[data-sheet="recibo-pasos"] [data-rp4-cta="1"]');
    if (!btn) return;
    window.__rp4Cta.ops.push(+getComputedStyle(btn).opacity);
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.removedNodes) if (n === btn || (n.contains && n.contains(btn))) window.__rp4Cta.unmounts++;
    }).observe(btn.parentElement, { childList: true });
    const t0 = performance.now();
    (function f() {
      const b = document.querySelector('[data-sheet="recibo-pasos"] [data-rp4-cta="1"]');
      if (b) window.__rp4Cta.ops.push(+getComputedStyle(b).opacity);
      if (performance.now() - t0 < 450) requestAnimationFrame(f);
    })();
  });
  await accion();
  await page.waitForTimeout(460);
  const rec = await page.evaluate(() => window.__rp4Cta);
  expect(rec.unmounts, "el botón Siguiente no debe desmontarse").toBe(0);
  expect(rec.ops.length).toBeGreaterThan(3);
  expect(Math.max(...rec.ops) - Math.min(...rec.ops)).toBeLessThan(0.08);
}

test("alta anual: cuadrícula de meses, vista previa y guardado", async ({ page }) => {
  await abreAlta(page);
  await hastaCuando(page, "Seguro anual", ["6", "0", "0"]);
  await paso(page, 2).locator('[data-rp4-freq="año"]').click();
  await expect(paso(page, 2).locator(".month-picker .mchip")).toHaveCount(12);
  await expect(cta(page)).toHaveAttribute("aria-disabled", "true");
  await paso(page, 2).locator(".month-picker button", { hasText: /^Oct$/i }).click();
  await expect(paso(page, 2).locator('[data-rp4-dia="10"]')).toBeVisible();
  const aviso = paso(page, 2).locator(".hint");
  await expect(aviso).toContainText("50,00 € al mes repartidos");
  await expect(aviso).toContainText("600,00 € al año");
  await paso(page, 2).locator('[data-rp4-dia="10"]').click();
  await expect(cta(page)).toHaveAttribute("aria-disabled", "false");
  await cta(page).click();
  await paso(page, 3).locator('[data-rp4-banco="sabadell"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await cta(page).click();
  await expect(hoja(page)).toHaveCount(0, { timeout: 5000 });
  const nuevo = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).fixed.find((f) => f.name === "Seguro anual"));
  expect(nuevo).toMatchObject({ amount: 600, freq: "año", months: [10], day: 10, account: "sabadell" });
});

test("editar anual: el mes guardado sale preseleccionado", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    accounts,
    fixed: [{ id: "seg", name: "Seguro hogar", amount: 400, freq: "año", months: [9], day: 20, account: "sabadell" }, ...fixedBase],
    debts: [],
    flows: [],
    oneoffs: [],
    budget: 1000,
    settings,
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator('.v4-screen > [data-seg="recibos"]');
  await recibos.getByTestId("plan-review").getByRole("button", { name: /Seguro hogar/i }).click();
  await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
  await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
  await paso(page, 4).locator('[data-rp4-fila="2"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "2");
  await expect(paso(page, 2).locator(".month-picker .mchip.on")).toHaveText(/^Sep$/i);
  await expect(paso(page, 2).locator('[data-rp4-dia="20"]')).toHaveClass(/ on/);
});

test("Siguiente estable al avanzar y al volver atrás", async ({ page }) => {
  await abreAlta(page);
  await paso(page, 0).locator('[data-rp4="name"]').fill("Prueba CTA");
  await expectCtaEstable(page, async () => {
    await cta(page).click();
    await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  });
  await paso(page, 1).locator(".v4-keys").getByRole("button", { name: "5", exact: true }).click();
  await expectCtaEstable(page, async () => {
    await cta(page).click();
    await expect(hoja(page)).toHaveAttribute("data-paso", "2");
  });
  await expectCtaEstable(page, async () => {
    await hoja(page).locator('[data-act="back"]').click();
    await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  });
  await expectCtaEstable(page, async () => {
    await hoja(page).locator('[data-act="back"]').click();
    await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  });
});
