import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra, gastosEstado, gastosSeccion } from "./fixtures.mjs";
import { historicoSuscripciones, SUBS_NO } from "./subs-historico.mjs";

/* SUSCRIPCIONES: QUÉ SALE Y QUÉ NO, CON UN EXTRACTO DE VERDAD (auditoría de diseño 237, P1-3 y P1-6).
   La bandeja decía «913 € al mes · 12 por revisar» con Mercadona, Repsol, el bar y la cuota del
   coche: el detector sumaba por mes. Aquí se siembran seis meses de una familia (`subs-historico`,
   el mismo que mira el unitario) y se abre la pantalla de verdad: salen solo los cobros iguales con
   periodo fijo, la cifra es lo que pesan al mes y a 360 no se corta nada. Reloj: 26/9/2026. */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

async function abre(page) {
  await seedLoggedInDashboard(page, historicoSuscripciones());
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
  await gastosSeccion(page, "subs");
}
const tarjetas = (page) => gastosRoot(page).locator('[data-gx-secc="subs"] .gx-sub');
const tarjeta = (page, nombre) => tarjetas(page).filter({ hasText: nombre });
// Por el nombre ENTERO: «Digi» no puede casar con «Kiosko Digital».
const exacta = (page, nombre) => tarjetas(page).filter({ has: page.locator(".gx-sub-nm", { hasText: new RegExp("^" + nombre.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + "$") }) });

test("del extracto salen las suscripciones de verdad y ni el súper, ni la gasolina, ni el bar, ni la deuda", async ({ page }) => {
  await abre(page);
  // Mensuales de más a menos, luego la semanal y la anual. Apple cobra dos cosas: dos tarjetas.
  // Digi no sale: ya hay un recibo que se llama así.
  await expect(tarjetas(page).locator(".gx-sub-nm")).toHaveText([
    "Basic-Fit", "Netflix", "Spotify", "APPLE.COM/BILL", "Amazon", "APPLE.COM/BILL", "Kiosko Digital", "Antivirus Sintético",
  ]);
  for (const nombre of SUBS_NO.concat("Digi")) await expect(exacta(page, nombre), nombre).toHaveCount(0);
  await expect(gastosRoot(page).getByTestId("gastos-subs-globo")).toHaveText("8");
  // Lo que pesan al mes: 29,99 + 13,99 + 10,99 + 9,99 + 4,99 + 2,99 + 1,99×52/12 + 39,99/12. Antes, 1.317 €.
  await expect(gastosCifra(page)).toHaveText("84,89 €");
  await expect(gastosEstado(page)).toHaveText("al mes · 8 por revisar");
  await expect(tarjeta(page, "Netflix").locator(".gx-sub-am")).toHaveText("13,99 €");
  await expect(tarjeta(page, "Netflix").locator(".gx-sub-meta")).toHaveText("Cada mes · Revolut");
  await expect(tarjeta(page, "Kiosko").locator(".gx-sub-meta")).toHaveText("Cada semana · Revolut");
  await expect(tarjeta(page, "Antivirus").locator(".gx-sub-meta")).toHaveText("Cada año · Sabadell");
  await expect(tarjetas(page).locator(".gx-sub-mes")).toHaveCount(0);
  // La semanal y la anual dicen lo que pesan al mes: así las filas cuadran con la cifra de arriba.
  await expect(tarjeta(page, "Kiosko").locator(".gx-sub-am")).toHaveText("1,99 €8,62 € al mes");
  await expect(tarjeta(page, "Antivirus").locator(".gx-sub-am")).toHaveText("39,99 €3,33 € al mes");
  await expect(tarjeta(page, "Netflix").locator(".gx-sub-eq")).toHaveCount(0);
});

test("a 360 no se corta nada en las tarjetas", async ({ page }) => {
  await abre(page);
  await expect(tarjetas(page)).toHaveCount(8);
  const cortes = await tarjetas(page).evaluateAll((els) => els.flatMap((el) =>
    [...el.querySelectorAll(".gx-sub-nm,.gx-sub-meta,.gx-sub-am")]
      .filter((x) => x.scrollWidth > x.clientWidth + 1)
      .map((x) => x.textContent)));
  expect(cortes).toEqual([]);
});

test("la anual se pasa a Recibos como anual, en su mes y su día", async ({ page }) => {
  await abre(page);
  await tarjeta(page, "Antivirus").click();
  const f = page.locator('[data-sheet="sub-ficha"]');
  await expect(f).toBeVisible();
  await expect(f.locator(".gx-subf-cab .gx-sub-meta")).toHaveText(["Se cobra el 1 de septiembre · Sabadell", "3 años seguidos"]);
  await expect(f.locator(".gx-subf-cab .gx-sub-mes")).toHaveText("al año");
  await expect(f.locator(".gx-subf-anio")).toContainText("Unos 40 € al año.");
  await f.locator('[data-sub-accion="recibos"]').click();
  await expect(f).toHaveCount(0);
  await expect.poll(async () => (await page.evaluate(() => mcLoadRaw(mcStateKey()))).fixed.find((x) => x.name === "Antivirus Sintético") || null)
    .toMatchObject({ amount: 39.99, freq: "anual", months: [9], day: 1 });
  await expect(tarjeta(page, "Antivirus")).toHaveCount(0);
  await expect(gastosEstado(page)).toHaveText("al mes · 7 por revisar");
});

test("la semanal dice qué día de la semana", async ({ page }) => {
  await abre(page);
  await tarjeta(page, "Kiosko").click();
  const f = page.locator('[data-sheet="sub-ficha"]');
  await expect(f.locator(".gx-subf-cab .gx-sub-meta")).toHaveText(["Cada lunes · Revolut", "12 semanas seguidas"]);
  await expect(f.locator(".gx-subf-cab .gx-sub-mes")).toHaveText("a la semana");
});
