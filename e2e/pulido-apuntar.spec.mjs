import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* PULIDO v4 — P8: las teclas del teclado propio a 56 px.
 *
 * El QA checklist de la v4 se marcó con «teclas 56» y en el código estaban a 46. El brief avisa de
 * que subirlas puede no caber en un móvil de 667 px de alto.
 *
 * MEDIDO ANTES DE TOCAR NADA, para no colgarle a este cambio un problema que ya estaba: a 360×667
 * el fondo del teclado ya caía en 855 px CON las teclas a 46. O sea que el sheet ya desbordaba y
 * ya scrolleaba; subir a 56 lo mueve a 895, no introduce el desbordamiento. Por eso lo que se
 * comprueba aquí no es «cabe en la ventana» —no cabía antes tampoco— sino lo que de verdad
 * importa: que **se llegue** a la última fila de teclas y quede entera dentro de la pantalla.
 * La palabra final sigue siendo su móvil.
 */

const MOVIL_PEQUENO = { width: 360, height: 667 };

async function abrirApuntar(page) {
  await seedLoggedInDashboard(page, { budget: 500 });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator(".botnav-fab").click();
  await expect(page.locator(".v4-keys")).toBeVisible({ timeout: 10_000 });
}

async function ultimaTeclaVisible(page) {
  const borrar = page.locator(".v4-keys button").last();
  await borrar.scrollIntoViewIfNeeded();
  const caja = await borrar.boundingBox();
  return caja;
}

test("★ P8: las teclas miden 56 y se llega a la última fila en un 360×667", async ({ page }) => {
  await page.setViewportSize(MOVIL_PEQUENO);
  await abrirApuntar(page);

  const caja = await page.locator(".v4-keys button").first().boundingBox();
  expect(Math.round(caja.height)).toBe(56);

  const ultima = await ultimaTeclaVisible(page);
  expect(ultima.y).toBeGreaterThanOrEqual(0);
  expect(ultima.y + ultima.height).toBeLessThanOrEqual(MOVIL_PEQUENO.height + 1);
});

test("P8 con «Letra grande» (root 18px): la última fila sigue alcanzándose", async ({ page }) => {
  await page.setViewportSize(MOVIL_PEQUENO);
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.fontSize = "18px"; });
  });
  await abrirApuntar(page);

  const ultima = await ultimaTeclaVisible(page);
  expect(ultima.y).toBeGreaterThanOrEqual(0);
  expect(ultima.y + ultima.height).toBeLessThanOrEqual(MOVIL_PEQUENO.height + 1);
});

/* NOTA de lo medido, para que nadie lo persiga como si fuera de P8: el sheet de Apuntar es un
 * panel alto y con scroll propio. A 430×932 el fondo del teclado cae en 1261 px, y a 360×667 caía
 * en 855 YA con las teclas a 46. O sea que llegar al teclado siempre ha pedido arrastrar un poco;
 * eso no lo trae este cambio y no se arregla subiendo o bajando 10 px de tecla. Si molesta, es
 * otra tarea y hay que medirlo en su móvil, no aquí. */
