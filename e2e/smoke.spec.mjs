import { test, expect } from "@playwright/test";

test("arranca y muestra la marca", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText(/Aely|Hola|Bienvenido|Welcome|Primeros|Tu dinero/i).first()).toBeVisible({ timeout: 15_000 });
});

test("onboarding o dashboard visible", async ({ page }) => {
  await page.goto("/");
  // v4: claim «Tu dinero, por fin claro» / EN «Your money, finally clear» · o nav inferior si ya onboarded
  const onboarding = page.getByText(/Tu dinero, por fin claro|Your money, finally clear|Els teus diners, per fi clars/i);
  const dash = page.locator(".botnav");
  await expect(onboarding.or(dash)).toBeVisible({ timeout: 15_000 });
});
