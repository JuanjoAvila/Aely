import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function inicio(page) {
  await seedLoggedInDashboard(page, { budget: 500, expenses: [{
    id: "acabado-gasto", date: new Date().toISOString(), amount: 100,
    merchant: "Compra de prueba", category: "super", source: "manual",
  }] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}

test("el anillo parte vacio y llega al porcentaje correcto", async ({ page }) => {
  await page.addInitScript(() => {
    window.__ringOffsets = [];
    new MutationObserver(() => {
      const ring = document.querySelector('circle[stroke-dasharray]');
      if (ring) window.__ringOffsets.push({
        offset: Number(ring.getAttribute("stroke-dashoffset")),
        circumference: Number(ring.getAttribute("stroke-dasharray")),
      });
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["stroke-dashoffset"] });
  });
  await inicio(page);
  const ring = page.locator('circle[stroke-dasharray]');
  await expect.poll(async () => Number(await ring.getAttribute("stroke-dashoffset")))
    .toBeCloseTo(2 * Math.PI * 48 * 0.8, 2);
  const samples = await page.evaluate(() => window.__ringOffsets);
  expect(samples.some((s) => Math.abs(s.offset - s.circumference) < 0.01)).toBe(true);
  await expect(page.locator(".num").filter({ hasText: /^20%$/ })).toHaveCSS("font-family", /Fraunces/);
});

test("la tira de categorias indica continuidad y llega al final", async ({ page }) => {
  await inicio(page);
  await page.locator(".botnav-fab").click();
  const strip = page.locator(".v4-chips:not(.wrap):not(.meta-chips)").filter({ has: page.locator("button") }).last();
  await expect(strip).toBeVisible();
  await expect(strip).toHaveCSS("mask-image", /linear-gradient/);
  const last = strip.locator("button").last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeVisible();
  expect(await strip.evaluate((el) => el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)).toBe(true);
});
