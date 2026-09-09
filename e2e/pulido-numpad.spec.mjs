import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* PULIDO v4 — P9 (mantener ⌫ borra de seguido) y P10 (separador del idioma).
   El teclado está extraído a NumPad: un solo sitio, dos hojas (Apuntar y Aportar). */

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

async function abrirApuntar(page, overrides) {
  await seedLoggedInDashboard(page, Object.assign({ budget: 500 }, overrides || {}));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await page.locator(".botnav-fab").click();
  const sheet = page.locator(".v4-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(450);
  return sheet;
}

async function teclear(sheet, digits) {
  for (const d of digits) {
    await sheet.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  }
}

function cifrasImporte(txt) {
  return String(txt).replace(/[^\d.,]/g, "");
}

async function pointerDownBorrar(page) {
  // React 17+ escucha en el root: el evento tiene que burbujear. dispatchEvent de Playwright
  // por defecto NO burbujea y el hold no arranca (lo vimos: 6 cifras intactas).
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".v4-keys button")]
      .find((b) => b.getAttribute("aria-label") === "Borrar");
    btn.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, button: 0, buttons: 1, pointerId: 1, isPrimary: true, pointerType: "touch",
    }));
  });
}
async function pointerUpBorrar(page) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".v4-keys button")]
      .find((b) => b.getAttribute("aria-label") === "Borrar");
    if (!btn) return;
    btn.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, button: 0, buttons: 0, pointerId: 1, isPrimary: true, pointerType: "touch",
    }));
  });
}

test("★ P9: mantener pulsado ⌫ borra varias cifras y al soltar PARA", async ({ page }) => {
  const sheet = await abrirApuntar(page);
  await teclear(sheet, ["1", "2", "3", "4", "5", "6"]);
  await expect(sheet.locator(".v4-apuntar-amt")).toContainText("123456");

  await pointerDownBorrar(page);
  await page.waitForTimeout(560);
  const aMitad = cifrasImporte(await sheet.locator(".v4-apuntar-amt").innerText());
  expect(aMitad.replace(/[.,]/g, "").length).toBeLessThan(6);
  expect(aMitad.replace(/[.,]/g, "").length).toBeGreaterThan(0);

  await pointerUpBorrar(page);
  await page.waitForTimeout(400);
  const alSoltar = cifrasImporte(await sheet.locator(".v4-apuntar-amt").innerText());
  expect(alSoltar).toBe(aMitad);
});

test("★ P9: cerrar el sheet a mitad de pulsación no deja el timer vivo", async ({ page }) => {
  const sheet = await abrirApuntar(page);
  await teclear(sheet, ["1", "2", "3", "4", "5"]);
  await pointerDownBorrar(page);
  // El overlay se cierra con history.back (useBackClose), no con Escape. Así el NumPad se
  // desmonta SIN pointerup — justo el caso en el que el timer se comía el siguiente importe.
  await page.goBack();
  await expect(page.locator(".v4-sheet")).toHaveCount(0, { timeout: 3_000 });
  await page.waitForTimeout(800);

  await page.locator(".botnav-fab").click();
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(450);
  await teclear(sheet, ["9", "9"]);
  const antes = cifrasImporte(await sheet.locator(".v4-apuntar-amt").innerText());
  expect(antes).toContain("99");
  await page.waitForTimeout(500);
  const despues = cifrasImporte(await sheet.locator(".v4-apuntar-amt").innerText());
  expect(despues).toBe(antes);
});
