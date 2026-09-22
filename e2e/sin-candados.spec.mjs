import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* SIN CANDADOS (feedback 18/9, punto 14): «retirar los iconos de candado de la interfaz», sin
 * soltar ninguna protección. `tests/no-lock-icons.test.mjs` vigila el código fuente; esto vigila lo
 * que se PINTA en Tu cuenta y en Privacidad. La fila de huella solo existe con https o en la APK,
 * así que aquí no se pinta: su recorte `.replace(/^[^ ]+ /,"")`, que sin emoji delante se habría
 * comido la primera palabra, lo vigila `tests/no-lock-icons.test.mjs`. */
const CANDADO = /[\u{1F512}\u{1F513}\u{1F510}]/u;

test("Ajustes → Tu cuenta no enseña candados y las filas conservan su texto entero", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".set-card").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Tu cuenta/i }).click();

  const ajustes = page.locator(".settings-push.open");
  const privacidad = ajustes.locator("button.set-row").filter({ hasText: "Privacidad y datos" });
  await expect(privacidad).toBeVisible();
  expect(await ajustes.innerText()).not.toMatch(CANDADO);

  // La protección sigue: la privacidad abre su panel, que tampoco lleva candado en el título.
  await privacidad.click();
  await expect(page.getByText(/Privacidad/i).first()).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(CANDADO);
});
