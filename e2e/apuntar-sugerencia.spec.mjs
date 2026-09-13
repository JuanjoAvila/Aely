import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Sugerir categoría al escribir el concepto en Apuntar (13/9, opción A).
 * Palabras clave se aplican solas; la IA ofrece un chip (nunca sola). */

test.use({ viewport: { width: 375, height: 812 } });

async function openApuntar(page, settingsExtra, cloudFns) {
  const settings = Object.assign(
    { autoPrices: false, theme: "green", currency: "EUR", lang: "es", aiCat: true },
    settingsExtra || {}
  );
  const overrides = { settings };
  if (cloudFns) overrides.__cloudFns = cloudFns;
  await seedLoggedInDashboard(page, overrides);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator(".botnav-fab").click();
  const sheet = page.locator(".v4-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(450);
  return sheet;
}

test("Apuntar: escribir Mercadona selecciona supermercado con ✨", async ({ page }) => {
  const sheet = await openApuntar(page);
  await sheet.locator(".v4-input").fill("Mercadona");
  const superChip = sheet.locator('[data-testid="ap-cat-super"]');
  await expect.poll(async () => {
    const cls = await superChip.getAttribute("class");
    const txt = await superChip.innerText();
    return (cls || "").includes(" on") && txt.includes("✨");
  }, { timeout: 3_000, message: "las palabras clave no han marcado supermercado" }).toBe(true);
});

test("Apuntar: si tocas otra categoría a mano, escribir más no la mueve", async ({ page }) => {
  const sheet = await openApuntar(page);
  await sheet.locator('[data-testid="ap-cat-ocio"]').click();
  await expect(sheet.locator('[data-testid="ap-cat-ocio"]')).toHaveClass(/on/);
  await sheet.locator(".v4-input").fill("Mercadona");
  await page.waitForTimeout(700);
  await expect(sheet.locator('[data-testid="ap-cat-ocio"]'), "tocar a mano manda").toHaveClass(/on/);
  await expect(sheet.locator('[data-testid="ap-cat-super"]')).not.toHaveClass(/on/);
});

test("Apuntar: la IA ofrece chip ✨ y solo se aplica al tocarlo", async ({ page }) => {
  const sheet = await openApuntar(page, null, {
    categorize: { data: { ok: true, category: "ocio", source: "ai" }, error: null },
  });
  await sheet.locator(".v4-input").fill("Xyzzy Studio");
  const ia = sheet.locator('[data-testid="ap-ia-chip"]');
  await expect(ia, "debe aparecer el chip de IA").toBeVisible({ timeout: 5_000 });
  await expect(ia).toContainText("Ocio");
  // Opción A: no se aplica sola — sigue el defecto (supermercado) hasta el toque.
  await expect(sheet.locator('[data-testid="ap-cat-super"]')).toHaveClass(/on/);
  await expect(sheet.locator('[data-testid="ap-cat-ocio"]')).not.toHaveClass(/on/);
  await ia.click();
  await expect(sheet.locator('[data-testid="ap-cat-ocio"]')).toHaveClass(/on/);
  await expect(sheet.locator('[data-testid="ap-cat-super"]')).not.toHaveClass(/on/);
});

test("Apuntar: con IA apagada no sale el chip aunque la Edge respondería", async ({ page }) => {
  const sheet = await openApuntar(page, { aiCat: false }, {
    categorize: { data: { ok: true, category: "ocio", source: "ai" }, error: null },
  });
  await sheet.locator(".v4-input").fill("Xyzzy Studio");
  await page.waitForTimeout(1200);
  await expect(sheet.locator('[data-testid="ap-ia-chip"]')).toHaveCount(0);
});
