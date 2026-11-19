import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Sugerir categoría al escribir el concepto en Apuntar (13/9, opción A).
 * Lo aprendido de sus correcciones y las palabras clave se aplican solos; sin IA de pago (19/11). */

test.use({ viewport: { width: 375, height: 812 } });

async function openApuntar(page, settingsExtra, cloudFns) {
  const settings = Object.assign(
    { autoPrices: false, theme: "green", currency: "EUR", lang: "es" },
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
  // La fila son las cuatro más usadas (DIS-01): se toca la primera que no es supermercado.
  const otraId = await sheet.locator(".v4-ficha-cats .v4-ficha-cat:not(.on):not(.more)").first().getAttribute("data-testid");
  const otra = sheet.locator('[data-testid="' + otraId + '"]');
  await otra.click();
  await expect(otra).toHaveClass(/on/);
  await sheet.locator(".v4-input").fill("Mercadona");
  await page.waitForTimeout(700);
  await expect(otra, "tocar a mano manda").toHaveClass(/on/);
  await expect(sheet.locator('[data-testid="ap-cat-super"]')).not.toHaveClass(/on/);
});

/* Sin IA de pago desde el 19/11: la Edge `categorize` nunca tuvo clave y solo repetía las palabras
   clave. Ni chip, ni llamada, aunque quede el ajuste viejo guardado y la Edge respondiera. */
test("Apuntar: un concepto desconocido no pide nada a la nube ni ofrece chip de IA", async ({ page }) => {
  const sheet = await openApuntar(page, { aiCat: true }, {
    categorize: { data: { ok: true, category: "ocio", source: "ai" }, error: null },
  });
  await sheet.locator(".v4-input").fill("Xyzzy Studio");
  await page.waitForTimeout(1200);
  await expect(sheet.locator('[data-testid="ap-ia-chip"]')).toHaveCount(0);
  await expect(sheet.locator('[data-testid="ap-cat-super"]'), "sigue el defecto").toHaveClass(/on/);
  expect(await page.evaluate(() => (window.__e2eInvokes || []).filter((x) => x.name === "categorize").length)).toBe(0);
});

test("Apuntar: lo que él corrigió antes se aplica solo al escribir el mismo comercio", async ({ page }) => {
  await seedLoggedInDashboard(page, { settings: { autoPrices: false, theme: "green", currency: "EUR", lang: "es" },
    catOverrides: { "mercadona 1234": "bares" } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator(".botnav-fab").click();
  const sheet = page.locator(".v4-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(450);
  await sheet.locator(".v4-input").fill("MERCADONA");
  await expect(sheet.locator('[data-testid="ap-cat-bares"]'), "lo aprendido gana a la palabra clave").toHaveClass(/on/, { timeout: 3_000 });
  await expect(sheet.locator('[data-testid="ap-cat-super"]')).not.toHaveClass(/on/);
});
