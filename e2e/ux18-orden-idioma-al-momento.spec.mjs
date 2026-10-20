import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* UX-18: el orden de «Tus cuentas» y el idioma se refrescaban solo al recargar la app.
 * Tras acotar las dependencias de las pestañas (perf-cuentas, 4.26.154) cada cambio de Ajustes o
 * de orden tiene que seguir llegando al DOM al momento, sin location.reload(). */

const accounts = [
  { id: "a", ent: "sabadell", name: "Nómina", value: 500, role: "fijos" },
  { id: "b", ent: "revolut", name: "Del día", value: 80, role: "diario", spendFrom: true },
  { id: "c", ent: "efectivo", name: "El sobre", value: 40, role: "fijos" },
];

test.use({ viewport: { width: 375, height: 812 } });

async function abrirCartera(page) {
  await seedLoggedInDashboard(page, {
    accounts,
    settings: { autoPrices: false, theme: "green", expenseBanks: ["revolut"] },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator(".v4-card-list button.v4-mov[data-account-id]").first()).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const el = document.querySelector(".v4-card-list button.v4-mov[data-account-id]");
    return el ? el.getBoundingClientRect().left : 999;
  })).toBeLessThan(40);
}

async function arrastrar(page, rows, de, a) {
  const from = await rows.nth(de).boundingBox();
  const to = await rows.nth(a).boundingBox();
  const x0 = Math.round(from.x + from.width / 2);
  const y0 = Math.round(from.y + from.height / 2);
  const y1 = Math.round(to.y + to.height / 2);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  await page.waitForTimeout(480);
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0, y: Math.round(y0 + (y1 - y0) * i / 6) }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

const nombres = (rows) => rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-account-key")));

test("ordenar «Tus cuentas», cambiar de pestaña y volver: el orden nuevo sigue sin recargar", async ({ page }) => {
  await abrirCartera(page);
  const rows = page.locator(".v4-card-list button.v4-mov[data-account-key]");
  await expect(rows).toHaveCount(3);
  expect(await nombres(rows)).toEqual(["acc:a", "acc:b", "acc:c"]);
  await arrastrar(page, rows, 0, 2);
  await expect.poll(() => nombres(rows)).toEqual(["acc:b", "acc:c", "acc:a"]);
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect.poll(() => nombres(rows)).toEqual(["acc:b", "acc:c", "acc:a"]);
  // Un segundo orden encima del primero tambien llega al DOM.
  await arrastrar(page, rows, 2, 0);
  await expect.poll(() => nombres(rows)).toEqual(["acc:a", "acc:b", "acc:c"]);
});

test("cambiar el idioma en Ajustes repinta Cartera y Ajustes al momento, sin recargar", async ({ page }) => {
  await abrirCartera(page);
  const titulo = page.locator(".v4-screen .v4-title", { hasText: /Tu cartera|Your portfolio/ });
  await expect(titulo).toHaveText("Tu cartera");
  await expect(page.locator(".v4-screen", { hasText: "Tus cuentas" }).first()).toBeAttached();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.getByRole("heading", { name: /Ajustes/i })).toBeVisible({ timeout: 8_000 });
  await page.locator("button.set-row", { hasText: /Apariencia/ }).first().click();
  await page.locator(".set-row", { hasText: /Idioma/ }).first().click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  // Ajustes mismo ya esta en ingles...
  await expect(page.getByRole("heading", { name: /^Settings$/ })).toBeVisible({ timeout: 8_000 });
  // ...y Cartera (montada detras) tambien, sin recargar ni tocar nada mas.
  await expect(titulo).toHaveText("Your portfolio");
  await expect(page.locator(".v4-screen", { hasText: "Your accounts" }).first()).toBeAttached();
  await expect(page.locator(".v4-screen", { hasText: "Tus cuentas" })).toHaveCount(0);
});
