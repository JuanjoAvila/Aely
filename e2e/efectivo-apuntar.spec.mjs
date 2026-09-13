import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/**
 * Hotfix efectivo (13/9): en Apuntar hay que poder elegir «💶 Efectivo» y el gasto
 * baja el sobre (ent:"efectivo"), no el banco diario.
 */
test.use({ viewport: { width: 375, height: 812 } });

test("Apuntar deja elegir Efectivo y el gasto lleva ent efectivo", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    accounts: [
      { id: "rv", ent: "revolut", name: "Del día", value: 200, role: "diario", spendFrom: true },
      { id: "ef", ent: "efectivo", name: "El sobre", value: 80, role: "fijos" },
    ],
    settings: {
      autoPrices: false, theme: "green",
      expenseBanks: ["revolut", "efectivo"],
      dailyOnlyBanks: ["efectivo"],
    },
    expenses: [],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);

  await page.locator(".botnav-fab").click();
  const sheet = page.locator(".v4-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);

  // Chip DIRECTO al lado de 📅/🏦 (no dentro de la lista del banco).
  const cashChip = sheet.locator('[data-testid="ap-efectivo"]');
  await expect(cashChip).toBeVisible();
  await cashChip.click();
  await expect(cashChip).toHaveClass(/on/);

  // 12 € con el teclado propio (mismo patrón que apuntar-sheet: dígitos enteros, no céntimos)
  for (const d of ["1", "2"]) {
    await sheet.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  }
  await sheet.locator(".v4-input").fill("Sobre e2e");
  await sheet.locator(".v4-cta").click();
  await expect(sheet).toHaveCount(0, { timeout: 5_000 });

  await expect(page.getByText("Sobre e2e").first()).toBeVisible({ timeout: 5_000 });
  // Persistencia debounced ~400 ms — no leer localStorage al momento del cierre.
  await page.waitForFunction(() => {
    const exps = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
    return exps.some((e) => e && e.merchant === "Sobre e2e");
  }, null, { timeout: 5_000 });
  const exp = await page.evaluate(() => {
    const exps = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
    return exps.find((e) => e && e.merchant === "Sobre e2e") || null;
  });
  expect(exp, "tiene que haber un gasto manual del sobre").toBeTruthy();
  expect(exp.ent).toBe("efectivo");
  expect(Math.abs(exp.amount - 12)).toBeLessThan(0.01);
});
