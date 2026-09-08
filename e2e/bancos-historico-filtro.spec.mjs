import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* IMPORTAR HISTÓRICO — el filtro de banco tiene que filtrar de VERDAD.
 *
 * Bug real reportado (3/8): «seleccioné Trade Republic y salían también movimientos de Banco
 * Sabadell». La causa (ver BankHistoryImport, 10-app-components.js): esta pantalla nunca tuvo
 * filtro de banco — se buscaba e importaba SIEMPRE de todos los bancos conectados a la vez, sin
 * forma de acotar a uno. Es justo el tipo de regresión que AGENTS §7 obliga a cubrir con e2e:
 * esconder o filtrar filas de una lista es algo que `npm test` (lógica pura) no ve, solo el DOM
 * real — y aquí además hay que comprobar que el filtro no es solo cosmético: lo que queda oculto
 * tiene que desaparecer también del contador de "Importar N", que es el propio bug reportado.
 *
 * Puerta (tanda 4 / plan K): SOLO Ajustes → Importaciones. Se quitó el botón de Mis bancos.
 */

const bankLinks = [
  { aspsp_name: "Trade Republic", aspsp_country: "ES", status: "active",
    valid_until: "2026-10-01T00:00:00Z", last_sync: "2026-07-25T09:00:00Z", accounts: [{ uid: "a1" }] },
  { aspsp_name: "Sabadell", aspsp_country: "ES", status: "active",
    valid_until: "2026-10-01T00:00:00Z", last_sync: "2026-07-25T09:00:00Z", accounts: [{ uid: "a2" }] },
];

const histLinks = [
  { aspsp: "Trade Republic", accounts: [{ transactions: [
    { date: "2026-07-20", amount: 12.5, merchant: "Cafe TR", card: true, ext_id: "tr1" },
  ] }] },
  { aspsp: "Sabadell", accounts: [{ transactions: [
    { date: "2026-07-18", amount: 45, merchant: "Super Sabadell", card: true, ext_id: "sb1" },
  ] }] },
];

async function abrirHistorico(page) {
  await seedLoggedInDashboard(page, {
    hasBankLink: true,
    __cloudRows: { bank_links: bankLinks },
    __cloudFns: { "bank-sync": { data: { ok: true, links: histLinks }, error: null } },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  // Ajustes → Importaciones (única puerta desde tanda 4).
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".set-card").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Importaciones/i }).click();
  await page.locator("button.set-row").filter({ hasText: /Importar histórico/i }).click();
  const overlay = page.locator(".hist-import");
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: /Buscar movimientos/i }).click();
  await expect(overlay.getByText("Cafe TR")).toBeVisible({ timeout: 10_000 });
  await expect(overlay.getByText("Super Sabadell")).toBeVisible();
  return overlay;
}

test("Mis bancos ya no ofrece Importar histórico (solo Importaciones)", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    hasBankLink: true,
    __cloudRows: { bank_links: bankLinks },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(page.locator("[data-aspsp]")).toHaveCount(2, { timeout: 10_000 });
  await expect(page.locator("button").filter({ hasText: /^Importar histórico$/ })).toHaveCount(0);
});

test("Importar histórico: sin tocar el filtro salen los movimientos de TODOS los bancos conectados", async ({ page }) => {
  const overlay = await abrirHistorico(page);
  await expect(overlay.getByRole("button", { name: /Importar 2/ })).toBeVisible();
});

test("Importar histórico: filtrar a un banco esconde los del resto Y los saca del botón de importar (el bug reportado)", async ({ page }) => {
  const overlay = await abrirHistorico(page);

  await overlay.getByRole("button", { name: "Trade Republic", exact: true }).click();

  // Lo que reportó: Sabadell no puede seguir apareciendo si solo se pidió Trade Republic.
  await expect(overlay.getByText("Super Sabadell")).toHaveCount(0);
  await expect(overlay.getByText("Cafe TR")).toBeVisible();

  // Y no basta con esconderlo: el botón de importar tiene que contar solo lo que se ve — si no,
  // el bug seguiría de facto (Sabadell se importaría igual, solo que con la fila oculta debajo).
  await expect(overlay.getByRole("button", { name: /Importar 1/ })).toBeVisible();
});

test("Importar histórico: volver a «Todos los bancos» recupera la vista completa", async ({ page }) => {
  const overlay = await abrirHistorico(page);
  await overlay.getByRole("button", { name: "Trade Republic", exact: true }).click();
  await expect(overlay.getByText("Super Sabadell")).toHaveCount(0);

  await overlay.getByRole("button", { name: "Todos los bancos" }).click();
  await expect(overlay.getByText("Super Sabadell")).toBeVisible();
  await expect(overlay.getByRole("button", { name: /Importar 2/ })).toBeVisible();
});
