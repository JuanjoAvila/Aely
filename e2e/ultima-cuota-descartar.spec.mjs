import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* «ÚLTIMA CUOTA» EN INICIO — se puede quitar (reportado por él desde la app el 12/9):
 * «está chulo que te aparezca el aviso pero cansa mucho verlo cada día… estaría bien poder
 * quitarlo». La tarjeta sigue saliendo; lo que se añade es «Descartar», el mismo de la tarjeta
 * del mes cerrado.
 *
 * ⚠ Se siembran DOS deudas en la misma situación a propósito: con UNA sola, una implementación
 * que escondiera la tarjeta ENTERA (o que apagara el aviso para siempre) pasaría igual de bien.
 * Descartar es por deuda: la otra tiene que seguir ahí. */

// Día 2: el cargo del día 28 aún no ha pasado, así que quedan cuotas por pagar (debtLeft = 1).
const RELOJ = new Date("2026-09-02T12:00:00+02:00");
const deuda = (id, name) => ({ id, name, value: 1200, monthly: 100, months: 1, day: 28 });

test("Inicio: la última cuota se descarta, y solo la que descartas", async ({ page }) => {
  await page.clock.install({ time: RELOJ });
  await seedLoggedInDashboard(page, {
    debts: [deuda("d-coche", "Coche"), deuda("d-sofa", "Sofá")],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  const card = page.locator(".v4-party");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card).toContainText("Coche");
  await expect(card).toContainText("Sofá");

  // El botón se busca DENTRO de la fila de esa deuda (hija directa de la tarjeta), no el
  // primero de la página ni el div más hondo que lleva el texto y ningún botón.
  const fila = card.locator("> div").filter({ hasText: "Coche" });
  await fila.getByTestId("party-dismiss").click();

  await expect(card).not.toContainText("Coche");
  await expect(card).toContainText("Sofá");
});

test("Inicio: descartada la última, la tarjeta entera desaparece y no vuelve al recargar", async ({ page }) => {
  await page.clock.install({ time: RELOJ });
  // __seedOnce: si no, el fixture vuelve a sembrar en CADA navegación y el reload borraría el
  // descarte — el test estaría midiendo el fixture, no la app.
  await seedLoggedInDashboard(page, { debts: [deuda("d-coche", "Coche")], __seedOnce: true });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  const card = page.locator(".v4-party");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByTestId("party-dismiss").click();
  await expect(card).toHaveCount(0);

  // Lo que él pidió es no verlo CADA DÍA: tiene que sobrevivir a cerrar y abrir la app.
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await expect(page.locator(".v4-party")).toHaveCount(0);

  const guardado = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
    return (s.settings && s.settings.partyDismissed) || [];
  });
  expect(guardado).toContain("d-coche");
});
