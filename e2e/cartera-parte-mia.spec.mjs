/* «PARTE MÍA» DE UNA CUENTA (14/10/2026).
 *
 * Una conjunta con la pareja contaba entera en el patrimonio. Ahora la ficha de la cuenta en
 * Cartera → Tus cuentas dice qué parte es suya, y el patrimonio cuenta solo esa parte. Lo que ata
 * este fichero, de punta a punta por la pantalla de verdad:
 *  · el banco da dos titulares y no hay parte puesta → la ficha lo sugiere, sin preguntar;
 *  · poner 50 % con el diálogo de la casa (no el nativo) → Liquidez de Cartera y el patrimonio de
 *    Inicio bajan a la mitad de esa cuenta; la fila sigue con lo que hay en el banco y dice «50 % tuyo»;
 *  · la «i» de Inicio dice que solo cuenta su parte;
 *  · lo que no es un número entre 0 y 100 no se guarda.
 */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ viewport: { width: 375, height: 812 } });

const hace = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(12, 0, 0, 0); return d.toISOString(); };

async function abrirCartera(page) {
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "sb", ent: "sabadell", name: "Nómina", value: 2000, role: "fijos" }],
    obAccounts: [{ key: "u-conjunta", ent: "revolut", aspsp: "Revolut", iban: "ES00SYNTH000000000002", name: "ANA SINTÉTICA & LUIS SINTÉTICO", value: 1000, cur: "EUR" }],
    obLabels: {}, hasBankLink: true,
    // Un apunte a cero en cada banco hace días: la gráfica de Inicio tiene más de un punto y «i».
    expenses: [{ id: "alta-sb", date: hace(3), amount: 0, category: "otros", ent: "sabadell", merchant: "Alta" },
      { id: "alta-rv", date: hace(3), amount: 0, category: "otros", ent: "revolut", source: "ob", merchant: "Alta" }],
    settings: { autoPrices: false, theme: "green" },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator('button.v4-mov[data-ob-key="u-conjunta"]')).toBeVisible();
}
const liquidez = (page) => page.locator(".v4-legend-btn").first();
const ficha = (page) => page.locator(".v4-sheet");

test("poner 50 % en la conjunta: Liquidez y patrimonio de Inicio cuentan solo su parte", async ({ page }) => {
  await abrirCartera(page);
  await expect(liquidez(page)).toContainText(/3\.?000/);

  await page.locator('button.v4-mov[data-ob-key="u-conjunta"]').click();
  await expect(ficha(page)).toBeVisible();
  await expect(ficha(page).getByTestId("ac-share-pct")).toHaveText("100 %");
  // Dos titulares en el nombre del banco y sin parte puesta: se sugiere en la ficha.
  await expect(ficha(page)).toContainText("Parece una cuenta con dos titulares");

  // Lo que no es un número entre 0 y 100 no se guarda: avisa y se puede volver a intentar.
  await ficha(page).getByTestId("ac-share-edit").click();
  const ask = page.locator(".askback .tabsheet");
  await expect(ask).toContainText("¿Qué parte de esta cuenta es tuya?");
  await ask.locator("input").fill("150");
  await ask.getByRole("button", { name: "Guardar" }).click();
  await expect(ask).toContainText("Pon un número entre 0 y 100");
  await ask.getByRole("button", { name: "Aceptar" }).click();
  await expect(ask.locator("input")).toBeVisible();
  await ask.locator("input").fill("50");
  await ask.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".askback")).toHaveCount(0);

  await expect(ficha(page).getByTestId("ac-share-pct")).toHaveText("50 %");
  await expect(ficha(page)).toContainText(/En tu patrimonio cuentan 500,00/);
  await expect(ficha(page)).not.toContainText("Parece una cuenta con dos titulares");
  // El saldo de hoy de la ficha sigue siendo lo que hay en el banco.
  await expect(ficha(page).locator(".v4-account-amount")).toContainText(/1\.?000,00/);
  await page.locator(".v4-sheet-back").click({ position: { x: 10, y: 10 } });
  await expect(ficha(page)).toHaveCount(0);

  await expect(liquidez(page)).toContainText(/2\.?500/);
  const fila = page.locator('button.v4-mov[data-ob-key="u-conjunta"]');
  await expect(fila).toContainText("50 % tuyo");
  await expect(fila.locator(".am")).toContainText(/1\.?000,00/);

  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  const hero = page.getByTestId("inicio-net-current");
  await expect(hero.locator(".v4-hero-amt")).toContainText(/2\.?500,00/);
  await hero.locator(".v42-net-info").click();
  const filas = page.locator('[data-sheet="net-info"] .row');
  await expect(filas.filter({ hasText: "Cuentas compartidas" })).toContainText("solo tu parte del saldo y de sus movimientos");
});

test("los movimientos viejos sin cuenta: él decide de qué cuenta son y se puede deshacer", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "sb", ent: "sabadell", name: "Nómina", value: 2000, role: "fijos" }],
    obAccounts: [
      { key: "u-personal", ent: "revolut", aspsp: "Revolut", iban: "ES00SYNTH000000000001", name: "LUIS SINTÉTICO", value: 1000, cur: "EUR" },
      { key: "u-conjunta", ent: "revolut", aspsp: "Revolut", iban: "ES00SYNTH000000000002", name: "ANA SINTÉTICA & LUIS SINTÉTICO", value: 1000, cur: "EUR" }],
    obLabels: {}, hasBankLink: true,
    expenses: [{ id: "alta-sb", date: hace(5), amount: 0, category: "otros", ent: "sabadell", merchant: "Alta" },
      // Antiguo, de antes de guardar la cuenta de cada movimiento: no dice de cuál salió.
      { id: "viejo", date: hace(3), amount: 400, category: "otros", ent: "revolut", source: "ob", merchant: "Crucero sintético" }],
    settings: { autoPrices: false, theme: "green" },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.locator('button.v4-mov[data-ob-key="u-conjunta"]').click();
  // Al 100 % no se pregunta nada: no cambiaría ninguna cifra.
  await expect(ficha(page).getByTestId("ac-legacy")).toHaveCount(0);
  await ficha(page).getByTestId("ac-share-edit").click();
  const ask = page.locator(".askback .tabsheet");
  await ask.locator("input").fill("50");
  await ask.getByRole("button", { name: "Guardar" }).click();
  const bloque = ficha(page).getByTestId("ac-legacy");
  await expect(bloque).toContainText("Los 1 movimientos antiguos de Revolut que no dicen su cuenta: ¿son de esta cuenta?");

  // «Preguntar después» no guarda nada.
  await bloque.getByTestId("ac-legacy-btn").click();
  await ask.getByRole("button", { name: "Preguntar después" }).click();
  await expect(page.locator(".askback")).toHaveCount(0);
  await expect(bloque).toContainText("¿son de esta cuenta?");

  await bloque.getByTestId("ac-legacy-btn").click();
  await ask.getByRole("button", { name: "Sí, son de esta cuenta" }).click();
  await expect(bloque).toContainText("cuentan como de esta cuenta");
  await expect(bloque.getByTestId("ac-legacy-btn")).toHaveText("Deshacer");
  await page.locator(".v4-sheet-back").click({ position: { x: 10, y: 10 } });
  await expect(ficha(page)).toHaveCount(0);
  await expect(liquidez(page)).toContainText(/3\.?500/);

  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  const hero = page.getByTestId("inicio-net-current");
  await hero.locator(".v42-net-info").click();
  await expect(page.locator('[data-sheet="net-info"] .row').filter({ hasText: "Cuentas compartidas" })).toContainText("los antiguos de Revolut, como dijiste en la ficha de la cuenta");
  await page.getByRole("button", { name: "Entendido" }).click();

  // Se deshace en la misma ficha y vuelve la pregunta.
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.locator('button.v4-mov[data-ob-key="u-conjunta"]').click();
  await ficha(page).getByTestId("ac-legacy-btn").click();
  await expect(ficha(page).getByTestId("ac-legacy")).toContainText("¿son de esta cuenta?");
});
