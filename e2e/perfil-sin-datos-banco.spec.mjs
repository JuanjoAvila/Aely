/* Privacidad (decisión del dueño, 14/10/2026): el perfil guarda SOLO nombre y apodo. Una cartera
 * que traiga de antes nacionalidad, dirección, teléfono, etc. los pierde al cargar, y lo que se
 * sube a la nube ya no los lleva. Datos sintéticos: ningún dato real en el repo. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const VIEJO = { handle: "@sintetico", fullName: "Persona Sintética", birth: "01/01/2000", nationality: "XX",
  address: "Calle Falsa 1", phone: "600 000 000", accountPurpose: "x", taxResidency: "XX", jobStatus: "x",
  jobSector: "x", jobRole: "x", salaryRange: "x", wealthSource: "x", netWorthRange: "x", investorPurpose: "x" };

test("Perfil: al cargar se borran los datos tipo banco y no se suben", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 800 });
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000, expenses: [],
    settings: { autoPrices: false, lang: "es", profile: VIEJO } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);

  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).settings.profile);
  expect(guardado).toEqual({ handle: "@sintetico", fullName: "Persona Sintética" });

  // Aunque un estado antiguo vuelva de la nube, lo que sube sale limpio.
  const subida = await page.evaluate((viejo) => {
    return slimForCloud({ settings: { profile: viejo }, accounts: [] }).settings.profile;
  }, VIEJO);
  expect(subida).toEqual({ handle: "@sintetico", fullName: "Persona Sintética" });

  await page.locator(".v4-avatar").click();
  const panel = page.locator(".profile-pull");
  await expect(panel).toHaveClass(/open/, { timeout: 5_000 });
  const filas = panel.locator(".profile-row").filter({ has: page.locator(".pr-edit", { hasText: "✎" }) });
  await expect(filas).toHaveCount(2);   // nombre y correo
  await expect(panel).not.toContainText("600 000 000");
  await expect(panel).not.toContainText("Calle Falsa");
});
