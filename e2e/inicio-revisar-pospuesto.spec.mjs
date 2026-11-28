import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* «Para revisar» de Inicio y de Plan › Recibos dicen lo mismo (feedback 28/11/2026): pospuesto un
   recibo con «Recuérdamelo mañana», en Plan salía de la lista pero Inicio lo seguía enseñando como
   «No ha llegado», porque Inicio tenía su propia regla (sin el margen de dos días ni lo pospuesto).
   Se mira el DOM de las dos pantallas, sembrando el estado: nada de leer el código. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const recibo = (id, name, amount, day) => ({ id, name, amount, freq: "mes", day, account: "sabadell" });
// Luz: día 3, quince días sin cargo. Agua: día 17, ayer; dentro del margen, aún no se revisa.
const fixed = () => [recibo("luz", "Luz", 55, 3), recibo("agua", "Agua", 20, 17)];

async function abreInicio(page, pospuesto) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-18T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  if (pospuesto) await page.addInitScript((p) => { localStorage.setItem("mc_pr6_pospuesto", JSON.stringify(p)); }, pospuesto);
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-10-18", bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [],
    settings, accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }], fixed: fixed() });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}
const filaInicio = (page, rid) => page.locator('.page-scroll-host [data-testid="inicio-revisar-fila"][data-inicio-recibo="' + rid + '"]');
const recibos = (page) => page.locator('.page-live .v4-screen > [data-seg="recibos"]');

test("posponer en Recibos lo quita también de «Para revisar» de Inicio, y «Deshacer» lo devuelve", async ({ page }) => {
  await abreInicio(page);
  await expect(filaInicio(page, "fixed_luz")).toHaveCount(1);
  // La misma regla que Plan: un día de retraso aún no es «No ha llegado».
  await expect(filaInicio(page, "fixed_agua")).toHaveCount(0);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const review = recibos(page).getByTestId("plan-review");
  await expect(review.locator('[data-recibo="fixed_agua"]')).toHaveCount(0);
  await review.locator('[data-recibo="fixed_luz"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await ficha.locator('[data-act="posponer"]').click();
  await expect(ficha).toHaveCount(0);
  await expect(review.locator('[data-recibo="fixed_luz"]')).toHaveCount(0);
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await expect(filaInicio(page, "fixed_luz")).toHaveCount(0);
  // Deshacer (desde Plan) lo vuelve a poner en las dos.
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await recibos(page).getByTestId("plan-deshacer").getByRole("button", { name: "Deshacer" }).click();
  await expect(review.locator('[data-recibo="fixed_luz"]')).toHaveCount(1);
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await expect(filaInicio(page, "fixed_luz")).toHaveCount(1);
});

test("lo pospuesto hoy no sale en «Para revisar» de Inicio al abrir",async ({ page }) => {
  await abreInicio(page, { fixed_luz: "2026-10-18" });
  await expect(page.locator(".page-scroll-host .v4-section").first()).toBeVisible();
  await expect(filaInicio(page, "fixed_luz")).toHaveCount(0);
});

test("lo pospuesto ayer vuelve a «Para revisar» de Inicio", async ({ page }) => {
  await abreInicio(page, { fixed_luz: "2026-10-17" });
  await expect(filaInicio(page, "fixed_luz")).toHaveCount(1);
});
