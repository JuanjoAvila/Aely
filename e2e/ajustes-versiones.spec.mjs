/* Ajustes enseña OTA y APK (2026-07-26): sin esto no sabías si el icono nuevo estaba
 * instalado o seguías en una APK vieja aunque la web ya estuviera al día. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test("Ajustes muestra web/OTA y APK cuando el puente nativo responde", async ({ page }) => {
  await page.addInitScript(() => {
    window.Capacitor = {
      Plugins: {
        MiCartera: {
          appInfo: async () => ({ versionName: "4.12.0", versionCode: 35 }),
        },
      },
    };
  });
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);

  await page.locator(".v4-avatar").click();
  await expect(page.locator(".profile-pull.open")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: /Ir a Ajustes|Go to Settings|Ves a Ajustos/i }).click();
  const ajustes = page.locator(".settings-push.open");
  await expect(ajustes).toBeVisible({ timeout: 5_000 });

  // Pie permanente: «Aely · web vX · app Y» (en e2e la web puede ser «vdev»).
  const pie = ajustes.getByText(/Aely · web v/i);
  await expect(pie).toBeVisible();
  await expect(pie).toContainText(/app 4\.12\.0/i);
});

test("en el navegador (sin puente) Ajustes enseña solo la versión web", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await dismissNews(page);

  await page.locator(".v4-avatar").click();
  await page.getByRole("button", { name: /Ir a Ajustes|Go to Settings|Ves a Ajustos/i }).click();
  const ajustes = page.locator(".settings-push.open");
  await expect(ajustes).toBeVisible({ timeout: 5_000 });

  const pie = ajustes.getByText(/Aely · v/i);
  await expect(pie).toBeVisible();
  // Sin puente nativo no se inventa una APK: solo el número web.
  await expect(pie).not.toContainText(/web v.*· app /i);
});
