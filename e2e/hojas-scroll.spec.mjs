import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/**
 * Regresión 4.19.100 (feedback 13/9): flex+overflow:hidden en TODAS las `.v4-sheet`
 * dejó filtros/Más… sin poder bajar. 4.19.104: solo `:has(>.v4-sheet-body)` usa esa columna.
 */
test.use({ viewport: { width: 390, height: 700 } });

test("hoja SIN body: overflow auto y scrollea (CSS del filtro / Más…)", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  // Inyecta el mismo markup que PeriodMoreSheet / filtro (sin .v4-sheet-body): así el
  // guardián no depende de abrir Gastos con el cajón de Ajustes encima.
  await page.evaluate(() => {
    const back = document.createElement("div");
    back.className = "v4-sheet-back";
    back.setAttribute("data-e2e-sheet", "1");
    const sheet = document.createElement("div");
    sheet.className = "v4-sheet";
    sheet.style.maxHeight = "220px";
    sheet.innerHTML = '<div class="v4-sheet-handle"></div><div style="height:480px">alto</div>';
    back.appendChild(sheet);
    document.body.appendChild(back);
  });

  const sheet = page.locator('.v4-sheet-back[data-e2e-sheet] .v4-sheet');
  await expect(sheet).toBeVisible();
  const metrics = await sheet.evaluate((el) => {
    const cs = getComputedStyle(el);
    el.scrollTop = 80;
    return {
      overflow: cs.overflow + cs.overflowY,
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      scrollTop: el.scrollTop,
      display: cs.display,
    };
  });
  expect(metrics.overflow).toMatch(/auto/);
  expect(metrics.display).not.toBe("flex");
  expect(metrics.scrollH).toBeGreaterThan(metrics.clientH);
  expect(metrics.scrollTop).toBeGreaterThan(0);
});

test("Apuntar: CTA fuera del scroll; scrollea el body", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  await page.locator(".botnav-fab").click();
  const sheet = page.locator(".v4-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(350);

  const layout = await sheet.evaluate((el) => {
    const cs = getComputedStyle(el);
    const body = el.querySelector(":scope > .v4-sheet-body");
    const cta = el.querySelector(":scope > .v4-cta");
    return {
      overflow: cs.overflow + cs.overflowY,
      display: cs.display,
      hasBody: !!body,
      ctaOutside: !!cta,
      ctaInBody: !!(body && body.querySelector(".v4-cta")),
      bodyOverflow: body ? getComputedStyle(body).overflow + getComputedStyle(body).overflowY : "",
    };
  });
  expect(layout.hasBody).toBe(true);
  expect(layout.overflow).toMatch(/hidden/);
  expect(layout.display).toBe("flex");
  expect(layout.ctaOutside).toBe(true);
  expect(layout.ctaInBody).toBe(false);
  expect(layout.bodyOverflow).toMatch(/auto/);
});
