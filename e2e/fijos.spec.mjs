import { test, expect } from "@playwright/test";
import {
  bootDashboard,
  goPlan,
  gestionarSheet,
  openGestionarFijos,
  planScreen,
  readFixedFromStorage,
  serviciosBlock,
  VIEWPORT_COMPACT,
  VIEWPORT_PIXEL,
} from "./fixtures.mjs";

const fixedAlquiler = {
  id: "fx-rent",
  name: "Alquiler e2e",
  amount: 650,
  freq: "mes",
  account: "sabadell",
  day: 28,
};

const fixedTrim = {
  id: "fx-trim",
  name: "Seguro trimestral",
  amount: 120,
  freq: "trimestral",
  account: "sabadell",
  months: [1, 4, 7, 10],
  day: 15,
};

test.describe("Plan › Recibos (fijos en vista diaria)", () => {
  test("estado vacío: sin cargos pinta cero pendiente", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_PIXEL);
    await bootDashboard(page, { fixed: [], debts: [] });
    await goPlan(page);
    const hero = planScreen(page).locator(".v4-card-hero .serif.num").first();
    await expect(hero).toContainText("0");
    await expect(planScreen(page).getByText(/^Pendiente$/)).toBeVisible();
  });

  test("lista cargos pendientes con importe y día @393x851", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_PIXEL);
    await bootDashboard(page, { fixed: [fixedAlquiler], debts: [] });
    await goPlan(page);
    const charge = planScreen(page).locator(".v4-charge").filter({ hasText: "Alquiler e2e" });
    await expect(charge).toHaveCount(1);
    await expect(charge).toContainText("650");
    await expect(charge).toContainText("28");
  });

  test("misma lista en viewport compacto @360x740", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_COMPACT);
    await bootDashboard(page, { fixed: [fixedAlquiler], debts: [] });
    await goPlan(page);
    await expect(planScreen(page).locator(".v4-charge").filter({ hasText: "Alquiler e2e" })).toHaveCount(1);
  });
});

test.describe("Plan › Gestionar › Servicios (CRUD y recurrencia)", () => {
  test("alta de gasto fijo mensual", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_PIXEL);
    await bootDashboard(page, { fixed: [] });
    await goPlan(page);
    await openGestionarFijos(page);

    const block = serviciosBlock(page);
    await block.getByRole("button", { name: /Añadir gasto fijo|Add fixed cost/i }).click();
    await gestionarSheet(page).getByPlaceholder(/Concepto|ej\. Gimnasio|What/i).fill("Gimnasio e2e");
    await gestionarSheet(page).locator(".add-form input.num").first().fill("45");
    await block.getByRole("button", { name: /Añadir gasto fijo|Add fixed cost/i }).click();

    await expect(block.locator(".rname").filter({ hasText: "Gimnasio e2e" })).toHaveCount(1);
    const fixed = await readFixedFromStorage(page);
    expect(fixed.some((f) => f.name === "Gimnasio e2e" && f.amount === 45)).toBeTruthy();
  });

  test("edición de importe y día", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_PIXEL);
    await bootDashboard(page, { fixed: [{ ...fixedAlquiler, amount: 600, day: 1 }] });
    await goPlan(page);
    await openGestionarFijos(page);

    const block = serviciosBlock(page);
    await block.getByRole("button", { name: /^Editar$|^Edit$/i }).click();
    await block.locator("input.editv").first().fill("620");
    await block.locator('.edit-extra input[inputmode="numeric"]').first().fill("5");
    await block.getByRole("button", { name: /^Guardar$|^Save$/i }).click();

    await expect(block.locator(".row").filter({ hasText: "Alquiler e2e" })).toContainText("620");
    const fixed = await readFixedFromStorage(page);
    const item = fixed.find((f) => f.id === "fx-rent");
    expect(item && item.amount === 620 && item.day === 5).toBeTruthy();
  });

  test("borrado en modo edición", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_COMPACT);
    await bootDashboard(page, { fixed: [fixedAlquiler] });
    await goPlan(page);
    await openGestionarFijos(page);

    const block = serviciosBlock(page);
    await block.getByRole("button", { name: /^Editar$|^Edit$/i }).click();
    const row = block.locator(".row").filter({ hasText: "Alquiler e2e" });
    await row.locator("button.del-btn").click();
    await block.getByRole("button", { name: /^Guardar$|^Save$/i }).click();

    await expect(block.locator(".rname").filter({ hasText: "Alquiler e2e" })).toHaveCount(0);
    const fixed = await readFixedFromStorage(page);
    expect(fixed.find((f) => f.id === "fx-rent")).toBeFalsy();
  });

  test("recurrencia trimestral conserva meses e importe en lista", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_PIXEL);
    await bootDashboard(page, { fixed: [fixedTrim] });
    await goPlan(page);
    await openGestionarFijos(page);

    const block = serviciosBlock(page);
    await expect(block.locator(".rname").filter({ hasText: "Seguro trimestral" })).toBeVisible();
    await expect(block.locator(".row").filter({ hasText: "Seguro trimestral" })).toContainText("120");
    const fixed = await readFixedFromStorage(page);
    const item = fixed.find((f) => f.id === "fx-trim");
    expect(item && item.freq === "trimestral" && (item.months || []).length === 4).toBeTruthy();
  });

  test("total mensual del bloque Servicios", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_COMPACT);
    await bootDashboard(page, {
      fixed: [
        fixedAlquiler,
        { id: "fx-net", name: "Internet", amount: 40, freq: "mes", account: "sabadell" },
      ],
    });
    await goPlan(page);
    await openGestionarFijos(page);
    const block = serviciosBlock(page);
    await expect(block.locator(".subtotal")).toContainText("690");
  });
});