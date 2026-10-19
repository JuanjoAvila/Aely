/* LA CIFRA GRANDE NUNCA PINTA UN NÚMERO QUE NO ES (beta 4.26.150).
 *
 * `useCountUp` contaba desde 0 y se quedaba en 0 mientras su puerta (`ready`) estaba cerrada: Cartera
 * enseñaba «0,00 €» todo lo que duraba el deslizamiento hasta que el bus la daba por activa, e Inicio
 * igual detrás del splash. En «Tus recibos», tocar un grupo antes de los 950 ms dejaba una cifra a
 * medias. Aquí se muestrea la cifra en CADA frame (rAF) y ninguno puede mostrar algo distinto del
 * total real. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

const accounts = [
  { id: "sab", ent: "sabadell", name: "Nómina y recibos", value: 2000, role: "fijos" },
  { id: "rev", ent: "revolut", name: "Tarjeta", value: 300, role: "diario", spendFrom: true },
];

async function muestrear(page, selector) {
  await page.addInitScript((sel) => {
    window.__frames = [];
    const tick = () => {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) window.__frames.push(el.textContent.replace(/\s+/g, " ").trim());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, selector);
}

async function arranca(page) {
  await seedLoggedInDashboard(page, { accounts, expenses: [], investments: [], assets: [], debts: [], budget: 1000 });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
}

test("Cartera: ningún frame del deslizamiento enseña 0,00 € con 2.300 € de total", async ({ page }) => {
  await muestrear(page, ".cartera-hero-amt");
  await arranca(page);
  await dismissNews(page);
  await page.evaluate(() => { window.__frames.length = 0; });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator(".cartera-hero-amt")).toContainText("2300,00 €");
  await page.waitForTimeout(1200);
  const frames = await page.evaluate(() => window.__frames);
  expect(frames.length).toBeGreaterThan(5);
  const distintos = [...new Set(frames)];
  expect(distintos, JSON.stringify(distintos.slice(0, 8))).toEqual(["2300,00 €"]);
});

test("Inicio: la cifra sale con su valor desde el primer frame visible", async ({ page }) => {
  await muestrear(page, '[data-tour="hero-amt"]');
  await arranca(page);
  await page.waitForTimeout(1200);
  const frames = await page.evaluate(() => window.__frames);
  expect(frames.length).toBeGreaterThan(5);
  const distintos = [...new Set(frames)];
  expect(distintos.every((f) => f.includes("2300,00 €")), JSON.stringify(distintos.slice(0, 8))).toBe(true);
});
