import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const MOVIL_PEQUENO = { width: 360, height: 667 };

async function abrirApuntar(page) {
  await seedLoggedInDashboard(page, { budget: 500 });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator(".botnav-fab").click();
  await expect(page.locator(".v4-keys")).toBeVisible();
}

test("las teclas miden 56 y la ultima fila es accesible", async ({ page }) => {
  await page.setViewportSize(MOVIL_PEQUENO);
  await abrirApuntar(page);
  const keys = page.locator(".v4-keys button");
  expect(Math.round((await keys.first().boundingBox()).height)).toBe(56);
  const last = keys.last();
  await last.scrollIntoViewIfNeeded();
  const box = await last.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(MOVIL_PEQUENO.height + 1);
});

test("con letra grande la ultima fila sigue siendo accesible", async ({ page }) => {
  await page.setViewportSize(MOVIL_PEQUENO);
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.fontSize = "18px"; });
  });
  await abrirApuntar(page);
  const last = page.locator(".v4-keys button").last();
  await last.scrollIntoViewIfNeeded();
  const box = await last.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(MOVIL_PEQUENO.height + 1);
});
