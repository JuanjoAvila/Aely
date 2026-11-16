/* DOBLE TOQUE EN «APUNTAR» (encargo 236, P2-1). Mientras la hoja baja tras guardar, el botón sigue
 * debajo del dedo: dos toques rápidos apuntaban DOS gastos iguales, y en un gasto real eso es dinero
 * contado dos veces. Se comprueba lo que queda GUARDADO, no lo que se ve, y que el cerrojo se suelta
 * al volver a abrir la hoja (si no, el segundo apunte del día no se guardaría). */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ hasTouch: true, isMobile: true });

const guardados = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]"));

async function arranca(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLoggedInDashboard(page, {
    expenses: [],
    accounts: [{ id: "rv", ent: "revolut", name: "Del día", value: 200, role: "diario", spendFrom: true }],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["revolut"] },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

async function abreYTeclea(page, cifras, ingreso) {
  await page.locator(".botnav-fab").click();
  const hoja = page.locator(".v4-exp-sheet");
  await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
  if (ingreso) await hoja.locator(".v4-ficha-head .v4-seg-btn").nth(1).click();
  for (const d of cifras) await hoja.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  return hoja;
}

for (const ingreso of [false, true]) {
  const que = ingreso ? "ingreso" : "gasto";
  test(`doble toque en Apuntar guarda UN ${que}`, async ({ page }) => {
    await arranca(page);
    const hoja = await abreYTeclea(page, ["1", "7"], ingreso);
    // Doble click de verdad: dos `click` seguidos sobre el mismo punto, sin esperar a nada entre medias.
    await hoja.locator(".v4-cta").dblclick();
    await expect(hoja).toHaveCount(0, { timeout: 5_000 });
    // Con la hoja ya cerrada, lo que tuviera que escribir el segundo toque ya está escrito.
    await page.waitForTimeout(500);
    const lista = (await guardados(page)).filter((x) => Math.abs(x.amount) === 17);
    expect(lista, "un solo movimiento de 17 €").toHaveLength(1);
    expect(lista[0].amount).toBe(ingreso ? -17 : 17);
  });
}

test("tras un doble toque, el siguiente Apuntar se guarda igual", async ({ page }) => {
  await arranca(page);
  let hoja = await abreYTeclea(page, ["1", "7"]);
  await hoja.locator(".v4-cta").dblclick();
  await expect(hoja).toHaveCount(0, { timeout: 5_000 });
  hoja = await abreYTeclea(page, ["2", "3"]);
  await hoja.locator(".v4-cta").click();
  await expect(hoja).toHaveCount(0, { timeout: 5_000 });
  await page.waitForTimeout(500);
  const importes = (await guardados(page)).map((x) => x.amount).sort((a, b) => a - b);
  expect(importes).toEqual([17, 23]);
});
