import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test("al entrar en Cartera el patrimonio cuenta, no aparece ya puesto", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "e2e", ent: "sabadell", name: "Cuenta", value: 4321 }],
    debts: [], investments: [], assets: [],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 10_000 }).catch(() => {});
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.evaluate(() => {
    window.__mcB2 = [];
    window.__mcB2Stop = false;
    const tick = () => {
      const el = document.querySelector(".page-scroll-host .cartera-hero-amt");
      const m = el && (el.textContent || "").replace(/\s/g, " ").match(/([\d.]+)/);
      if (m) window.__mcB2.push(Number(m[1].replace(/\./g, "")));
      if (!window.__mcB2Stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator(".page-scroll-host .cartera-hero-amt")).toBeVisible();
  await page.waitForTimeout(1000);
  const muestras = await page.evaluate(() => {
    window.__mcB2Stop = true;
    return window.__mcB2 || [];
  });
  expect(muestras.at(-1)).toBe(4321);
  expect(muestras.some((v) => v > 0 && v < 4321)).toBe(true);
});
