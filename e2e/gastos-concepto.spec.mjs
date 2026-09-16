import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* CONCEPTO de los movimientos (petición del padre, 2026-07-24).
   Es render puro derivado del estado, justo el tipo de cosa que `npm test` no ve (AGENTS.md §7):
   la lógica de cleanNote puede estar perfecta y aun así no pintarse nada si la fila se rompe.
   Por eso esto abre Gastos de verdad y mira el DOM. */

const hoy = new Date().toISOString();
const expenses = [
  { id: "e1", date: hoy, amount: 40, merchant: "Bizum a Pedro", category: "otros", source: "manual", note: "Cena del sábado", noCard: true },
  { id: "e2", date: hoy, amount: 12.5, merchant: "Mercadona", category: "super", source: "manual" },
  { id: "e3", date: hoy, amount: 30, merchant: "Bizum a Ana", category: "otros", source: "manual", note: "Bizum a Ana" },
];

async function abreGastos(page) {
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
}

test("Gastos: el concepto se pinta bajo el título del movimiento", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses });
  await abreGastos(page);

  const fila = page.locator("button.v4-mov").filter({ hasText: "Bizum a Pedro" });
  await expect(fila).toHaveCount(1);
  await expect(fila.locator(".nm-note")).toHaveText("Cena del sábado");
});

test("Gastos: sin concepto no se cuela una línea vacía", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses });
  await abreGastos(page);

  const fila = page.locator("button.v4-mov").filter({ hasText: "Mercadona" });
  await expect(fila.locator(".nm-note")).toHaveCount(0);
});

test("Gastos: un concepto que repite el título no se pinta dos veces", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses });
  await abreGastos(page);

  // e3 trae note === merchant: cleanNote lo descarta y la fila queda limpia.
  const fila = page.locator("button.v4-mov").filter({ hasText: "Bizum a Ana" });
  await expect(fila.locator(".nm-note")).toHaveCount(0);
});

test("Gastos: el buscador encuentra por concepto, no solo por comercio", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses });
  await abreGastos(page);

  // «sábado» no aparece en ningún título: si sale la fila, es que se buscó en el concepto.
  await page.locator(".searchbar-in").fill("sábado");
  /* ⚠ ACOTADO A LA LISTA DE GASTOS (11/9/2026). Contaba `button.v4-mov` de toda la página, y las
     pestañas VECINAS van premontadas: el día que las filas de cuentas de Cartera pasaron de `div`
     a `button` —para abrir su ficha— este test empezó a contarlas y pedía 1 encontrando 2.
     Es exactamente [[e2e-getbytext-pestanas-premontadas]], que ya nos costó dos veces. */
  const filas = page.locator(".v4-gastos-list-body button.v4-mov");
  await expect(filas).toHaveCount(1);
  await expect(filas.first()).toContainText("Bizum a Pedro");
});

test("Ficha del movimiento: el concepto es editable y se guarda", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses });
  await abreGastos(page);

  await page.locator("button.v4-mov").filter({ hasText: "Bizum a Pedro" }).click();
  await page.locator(".v4-ficha-adjust-row").filter({ hasText: "Nota" }).click();
  const campo = page.locator(".v4-exp-note-in");
  await expect(campo).toBeVisible();
  await expect(campo).toHaveValue("Cena del sábado");

  await campo.fill("Cena con los del trabajo");
  await campo.blur();

  // Cierra la ficha y comprueba que la LISTA refleja el texto nuevo (no solo el input).
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } });
  const fila = page.locator("button.v4-mov").filter({ hasText: "Bizum a Pedro" });
  await expect(fila.locator(".nm-note")).toHaveText("Cena con los del trabajo");
});
