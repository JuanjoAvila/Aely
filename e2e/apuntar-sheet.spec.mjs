import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard } from "./fixtures.mjs";

// Táctil real (CDP): el sheet del «+» debe poder cerrarse tirando hacia abajo, igual que la
// ficha de editar gasto (petición 2026-07-18). Y desde 4.2.0 lleva chips de banco.
test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

test("Apuntar (+): banco en pastilla que se despliega y cierre tirando hacia abajo", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  const dismissNews = page.getByRole("button", { name: /Entendido|Got it/i });
  if (await dismissNews.count()) await dismissNews.first().click();

  await page.locator(".botnav-fab").click();
  const sheet = page.locator(".v4-sheet");
  await expect(sheet).toBeVisible();
  const ritmo=await sheet.evaluate(el=>{ const s=getComputedStyle(el); return {entrada:parseFloat(s.animationDuration)*1000,salida:parseFloat(s.transitionDuration)*1000}; });
  expect(ritmo.entrada).toBeGreaterThanOrEqual(400);
  expect(ritmo.salida).toBeGreaterThanOrEqual(300);
  // Esperar sheetup (.42s): si mides/arrastras a mitad de animación el gesto no cierra (flaky).
  await page.waitForTimeout(560);

  // Banco del apunte: una pastilla (como filtros en Gastos). Al tocarla salen
  // «Sin banco» y los bancos de las cuentas (Sabadell en el seed).
  await expect(sheet.locator('[data-testid="ap-bank"]')).toBeVisible();
  await expect(sheet.locator('[data-testid="ap-bank-list"]')).toHaveCount(0);
  await sheet.locator('[data-testid="ap-bank"]').click();
  const bankList = sheet.locator('[data-testid="ap-bank-list"]');
  await expect(bankList).toBeVisible();
  await expect(bankList.getByRole("button", { name: /Sabadell/ })).toBeVisible();
  await expect(bankList.getByRole("button", { name: /Sin banco|No bank|Sense banc/ })).toBeVisible();

  // Tirar hacia abajo desde la zona del importe → el sheet se va (mismo gesto que editar gasto).
  const bb = await sheet.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(bb.x + bb.width / 2);
  const y0 = Math.round(bb.y + 24);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + i * 48 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(sheet).toHaveCount(0, { timeout: 3_000 });

  // También debe cerrar arrastrando desde el TECLADO numérico (la zona que más se toca).
  await page.locator(".botnav-fab").click();
  await expect(sheet).toBeVisible();
  // Esperar el fin de la animación de entrada (420 ms): medir el teclado a mitad de sheetup
  // da coordenadas fuera del viewport y los toques no llegan (falso negativo del test).
  await page.waitForTimeout(560);
  const keys = await page.locator(".v4-keys").boundingBox();
  const kx = Math.round(keys.x + keys.width / 2);
  const ky = Math.round(keys.y + 10);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: kx, y: ky }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: kx, y: ky + i * 40 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(sheet).toHaveCount(0, { timeout: 3_000 });
});

test("Bizum es forma de pago: el gasto conserva Salud como categoría real", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  const dismissNews = page.getByRole("button", { name: /Entendido|Got it/i });
  if (await dismissNews.count()) await dismissNews.first().click();

  await page.locator(".botnav-fab").click();
  const sheet = page.locator(".v4-sheet");
  await expect(sheet.locator('[data-testid="ap-payment"]')).toContainText(/Con tarjeta/);
  await expect(sheet.locator('[data-testid="ap-cat-bizum"]')).toHaveCount(0);
  await sheet.locator(".v4-input").fill("Fisio");
  await sheet.locator('[data-testid="ap-payment"]').click();
  await expect(sheet.locator('[data-testid="ap-payment"]')).toContainText(/Bizum o transferencia/);
  await sheet.locator('[data-testid="ap-cat-salud"]').click();
  for (const d of ["4", "7"]) {
    await sheet.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  }
  await sheet.locator(".v4-cta").click();
  await expect(sheet).toHaveCount(0, { timeout: 3_000 });

  await expect.poll(() => page.evaluate(() => {
    const xs=JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]");
    const e=xs.find((x) => x.merchant==="Fisio");
    return e && { category:e.category, noCard:e.noCard, amount:e.amount };
  })).toEqual({ category:"salud", noCard:true, amount:47 });
});

test("un Bizum antiguo no cambia solo y se puede pasar a su categoría real", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses:[{
    id:"bizum-antiguo", date:"2026-09-24", amount:47, merchant:"Bizum a Ana",
    category:"bizum", source:"macrodroid", noCard:true
  }] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  const dismissNews = page.getByRole("button", { name: /Entendido|Got it/i });
  if (await dismissNews.count()) await dismissNews.first().click();
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const row=page.locator('[data-expense-id="bizum-antiguo"]');
  await expect(row).toBeVisible();
  await row.evaluate((el) => el.click());

  const sheet=page.locator(".v4-exp-sheet");
  await expect(sheet.locator('[data-testid="exp-cat-bizum"]')).toHaveClass(/on/);
  await expect(sheet.locator('[data-testid="exp-payment"]')).toContainText(/Bizum o transferencia/);
  await sheet.locator('[data-testid="exp-cat-bares"]').click();

  await expect.poll(() => page.evaluate(() => {
    const xs=JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]");
    const e=xs.find((x) => x.id==="bizum-antiguo");
    return e && { category:e.category, noCard:e.noCard };
  })).toEqual({ category:"bares", noCard:true });
});

// Multidivisa 4.14.0: la moneda del apunte es INDEPENDIENTE de la de visualización.
// Apuntas en ₺ con la app en €; el gasto se guarda convertido a euros.
test("Apuntar en ₺ con la app en €: convierte y guarda en euros", async ({ page }) => {
  // Sin esto, refreshFx (idle o al tocar ₺) pisa el fxRates sembrado con el BCE real
  // → 150 ₺ deja de ser 3,00 € y el assert falla en CI (flaky desde que .dev está en la CSP).
  await page.route(/api\.frankfurter\.(dev|app)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        amount: 1, base: "EUR", date: "2026-08-04",
        // frankfurter: 1 EUR = N divisa → la app guarda XXX→EUR = 1/N. TRY:50 → 0,02 €/₺.
        rates: { TRY: 50, USD: 1.1, GBP: 0.85, CHF: 0.95, JPY: 160, CAD: 1.5, AUD: 1.6,
          CNY: 7.5, MXN: 20, SEK: 11, NOK: 11, DKK: 7.5, PLN: 4.3, BRL: 6, INR: 90 },
      }),
    });
  });
  await seedLoggedInDashboard(page, {
    settings: { autoPrices: false, theme: "green", currency: "EUR", lang: "es" },
    fxRates: { TRY: 0.02, USD: 0.92, GBP: 1.15, CHF: 1.05 },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  const dismissNews = page.getByRole("button", { name: /Entendido|Got it/i });
  if (await dismissNews.count()) await dismissNews.first().click();

  await page.locator(".botnav-fab").click();
  const sheet = page.locator(".v4-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(450);

  await sheet.getByRole("button", { name: "₺ TRY", exact: true }).click();
  await expect(sheet.locator(".v4-apuntar-amt")).toContainText("₺");
  for (const d of ["1", "5", "0"]) {
    await sheet.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  }
  await sheet.locator(".v4-input").fill("Café Estambul");
  await sheet.locator(".v4-cta").click();
  await expect(sheet).toHaveCount(0, { timeout: 3_000 });

  // 150 ₺ × 0,02 = 3 €. Café visible + importe (el debounce de localStorage no entra).
  await expect(page.getByText("Café Estambul").first()).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("3,00 €").first()).toBeVisible();
});

// El sheet «Más…» de períodos en Gastos era el ÚNICO sin swipe-para-cerrar (feedback 2026-07-18,
// «el más de la foto»): ahora usa el mismo patrón que el resto.
test("Gastos › Más… (períodos): cierra tirando hacia abajo", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  const dismissNews = page.getByRole("button", { name: /Entendido|Got it/i });
  if (await dismissNews.count()) await dismissNews.first().click();

  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.getByRole("button", { name: /Más…|More…|Més…/ }).first().click();
  const sheet = page.locator(".v4-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(450); // fin de la animación de entrada antes de medir

  const bb = await sheet.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(bb.x + bb.width / 2);
  const y0 = Math.round(bb.y + 30);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + i * 40 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(sheet).toHaveCount(0, { timeout: 3_000 });
});

test("Apuntar (+): el calendario es de la casa, no el nativo de Android", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  const dismissNews = page.getByRole("button", { name: /Entendido|Got it/i });
  if (await dismissNews.count()) await dismissNews.first().click();

  await page.locator(".botnav-fab").click();
  const sheet = page.locator(".v4-sheet");
  await expect(sheet).toBeVisible();
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await page.locator('[data-testid="ap-date"]').click();
  await expect(page.locator('[data-testid="mc-cal"]')).toBeVisible();
  await expect(page.locator('[data-testid="mc-cal"] .mc-cal-day').first()).toBeVisible();
});
