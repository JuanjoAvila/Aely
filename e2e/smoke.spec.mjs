import { test, expect } from "@playwright/test";

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
