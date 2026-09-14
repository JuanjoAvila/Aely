/* SEC-01 (4.23.0): al volver del banco con ?bank=error&msg=…, el toast NO pinta el texto
 * inventado de la URL. Quien fabrique el enlace no puede meter un aviso falso. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard } from "./fixtures.mjs";

const INVENTADO = "URGENT: tu cuenta sera bloqueada — llama al 900-FAKE-BANK ahora";

test("★ ?bank=error con msg inventado: toast genérico, el texto NO aparece", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/?bank=error&msg=" + encodeURIComponent(INVENTADO));
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });

  // Antes de dismissNews: el toast solo vive ~2–4 s.
  const toast = page.locator(".toast");
  await expect(toast).toBeVisible({ timeout: 5_000 });
  await expect(toast).toContainText(/No se pudo conectar el banco|Couldn't connect the bank|No s'ha pogut connectar el banc/i);
  await expect(toast).not.toContainText("URGENT");
  await expect(toast).not.toContainText("900-FAKE");
  await expect(toast).not.toContainText("bloqueada");
  await expect(page).not.toHaveURL(/bank=error/);
});

test("código corto caducado: mensaje claro, sin el código crudo", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/?bank=error&msg=caducado");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });

  const toast = page.locator(".toast");
  await expect(toast).toBeVisible({ timeout: 5_000 });
  await expect(toast).toContainText(/permiso ya se usó|permission was already used|permís ja s'ha usat/i);
  await expect(toast).not.toHaveText(/caducado/i);
});

test("★ nolink con texto inventado: toast con 🏦, el texto NO aparece", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/?bank=error&msg=" + encodeURIComponent("nolink:Tu cuenta está bloqueada, llama al 900-FAKE"));
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });

  const toast = page.locator(".toast");
  await expect(toast).toBeVisible({ timeout: 5_000 });
  await expect(toast).toContainText("🏦");
  await expect(toast).not.toContainText("900-FAKE");
  await expect(toast).not.toContainText("bloqueada");
});

test("nolink:Banco Sabadell → etiqueta Sabadell", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/?bank=error&msg=" + encodeURIComponent("nolink:Banco Sabadell"));
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });

  const toast = page.locator(".toast");
  await expect(toast).toBeVisible({ timeout: 5_000 });
  await expect(toast).toContainText("Sabadell");
  await expect(toast).not.toContainText("Banco Sabadell");
});

test("★ back.html no pinta msg inventado y reenvía solo error", async ({ page }) => {
  // Antes del redirect a micartera:// (400 ms).
  await page.goto("/back.html?msg=" + encodeURIComponent(INVENTADO), { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toContainText("URGENT");
  await expect(page.locator("body")).not.toContainText("900-FAKE");
  await expect(page.locator("#msg")).toHaveText(/Volviendo a Aely/i);
  await expect(page.locator("#btn")).toHaveAttribute("href", "micartera://bank?msg=error");
});
