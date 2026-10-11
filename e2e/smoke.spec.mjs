import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard } from "./fixtures.mjs";

test("arranca y muestra la marca", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText(/Aely|Hola|Bienvenido|Welcome|Primeros|Tu dinero/i).first()).toBeVisible({ timeout: 15_000 });
});

test("onboarding o dashboard visible", async ({ page }) => {
  await page.goto("/");
  /* Se busca el SALUDO del onboarding, no el reclamo publicitario. El copy de marketing cambia
     —de «Tu dinero, por fin claro» a «Bienvenido/a» con el brief de Aely, 10/9— y cada vez que
     cambia este smoke se pone rojo sin que haya nada roto. El saludo es lo estable: mientras haya
     una pantalla de bienvenida, ahí estará. O la barra inferior, si ya pasó el onboarding. */
  const onboarding = page.getByText(/Bienvenido\/a|Welcome|Benvingut\/da/i);
  const dash = page.locator(".botnav");
  await expect(onboarding.or(dash)).toBeVisible({ timeout: 15_000 });
});

test("Inicio no inventa una ganancia mensual ni hereda la racha antigua", async ({ page }) => {
  await seedLoggedInDashboard(page,{
    monthStartNet:-9000,
    streak:99,
    budgetByMonth:{},
  });
  await page.goto("/");
  await expect(page.locator('[data-tour="hero"]')).toBeVisible({timeout:15_000});
  await expect(page.locator('[data-tour="hero"] .v4-pill')).toHaveCount(0);
  // El diseño 3b sustituyó la racha por el ritmo del ciclo. Los datos viejos no deben
  // reaparecer como una racha ni como una variación sin serie diaria acreditada.
  await expect(page.getByTestId("dash-budget-streak")).toHaveCount(0);
  await expect(page.getByTestId("inicio-net-delta")).toHaveCount(0);
  await expect(page.locator(".v42-cycle .st")).toBeVisible();
  await expect(page.locator(".v42-cycle")).not.toContainText("🔥");
});
