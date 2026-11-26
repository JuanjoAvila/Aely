import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* El recuadro gris/morado detrás de un importe grande («Lo que debes · 0 €») fuera «en todos los sitios en lo que
   salga» (feedback 26/11). Salía al elegir el campo (hojas de alta y edición), al volver a un importe ya escrito
   (recibo) y en la nómina. El subrayado de las temáticas se queda. Tamaño OnePlus 13; datos inventados. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const estado = { __seedOnce: true, lastBackup: "2026-10-10", bankTx: [], oneoffs: [], expenses: [], aportaciones: [], reservaLog: [], assets: [], settings, budget: 1200,
  accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 500 }],
  fixed: [{ id: "luz", name: "Luz", amount: 50, freq: "mes", day: 28, account: "sabadell" }],
  flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 1000, to: "sabadell", day: 20 }],
  debts: [{ id: "d1", ent: "familia", name: "Préstamo", value: 1200, original: 1200, monthly: 100, months: 12, day: 28, asOf: 2026 * 12 + 9, account: "sabadell" }],
  goals: [{ id: "g1", name: "Viaje", emoji: "✈️", target: 3000, saved: 100, deadline: "2027-08", monthly: 50 }] };

test.use({ viewport: { width: 412, height: 906 }, deviceScaleFactor: 3.5 });

async function abre(page) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-10T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  // El tema y la temática de su móvil, que es donde se veían el recuadro morado y el subrayado.
  await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "cyber"); document.documentElement.setAttribute("data-season", "invierno"); });
  await page.locator('.botnav-tab[data-tour="plan"]').click();
}
const seg = (page, s) => page.locator('.v4-seg-btn[data-seg="' + s + '"]').click();

async function sinRecuadro(page, importe, nombre) {
  await expect(importe).toBeVisible();
  await page.waitForTimeout(700);
  if (process.env.CAPTURAS) await page.screenshot({ path: process.env.CAPTURAS + "/importe-" + nombre + ".png" });
  const e = await importe.evaluate((n) => { const s = getComputedStyle(n); return { fondo: s.backgroundColor, imagen: s.backgroundImage, raya: s.textDecorationLine }; });
  expect(e).toEqual({ fondo: "rgba(0, 0, 0, 0)", imagen: "none", raya: "underline" });
}

test("Nueva deuda: el importe sin recuadro", async ({ page }) => {
  await abre(page);
  await seg(page, "deudas");
  await page.locator('[data-act="debt-add"]').click();
  await sinRecuadro(page, page.getByTestId("debt-add-form").locator(".rpa-amt"), "nueva-deuda");
});

test("Editar deuda: el importe sin recuadro", async ({ page }) => {
  await abre(page);
  await seg(page, "deudas");
  await page.locator('[data-debt-id="d1"]').click();
  await page.locator('.rpt-sheet [data-act="ficha-editar"]').click();
  const hoja = page.getByTestId("debt-edit-form");
  await hoja.locator(".rpa-amt").click();
  await sinRecuadro(page, hoja.locator(".rpa-amt"), "editar-deuda");
});

test("Nueva meta: el importe sin recuadro", async ({ page }) => {
  await abre(page);
  await seg(page, "metas");
  await page.getByTestId("goals-summary").locator('[data-act="goal-new"]').click();
  await sinRecuadro(page, page.getByTestId("goal-add-form").locator(".rpa-amt"), "nueva-meta");
});

test("Añadir bien: el importe sin recuadro", async ({ page }) => {
  await abre(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: "Añadir bien", exact: true }).click();
  await sinRecuadro(page, page.getByTestId("asset-sheet").locator(".rpa-amt"), "anadir-bien");
});

test("Recibo: al volver a un importe ya escrito, sin recuadro", async ({ page }) => {
  await abre(page);
  await page.getByTestId("plan-due").getByTestId("plan-todos").click();
  await page.locator('[data-bills-manage] [data-act="bill-add"]').first().click();
  const hoja = page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
  await hoja.locator('[data-rp4="name"]').fill("Agua");
  await hoja.locator(".rp4-cta").click();
  const paso = hoja.locator('[data-rp4-paso="1"]');
  for (const d of "32") await paso.locator('.v4-keys button[aria-label="' + d + '"]').click();
  await hoja.locator('[data-act="back"]').click();
  await expect(hoja).toHaveAttribute("data-paso", "0");
  await hoja.locator(".rp4-cta").click();
  await expect(hoja).toHaveAttribute("data-paso", "1");
  await sinRecuadro(page, paso.locator('[data-rp4="amount"]'), "recibo");
});

test("Nómina desde «¿Te llega?»: el importe sin recuadro", async ({ page }) => {
  await abre(page);
  await page.getByTestId("plan-llega").click();
  await page.getByTestId("llega-sheet").getByTestId("llega-flow").first().click();
  await sinRecuadro(page, page.getByTestId("nomina-sheet").getByTestId("nomina-importe"), "nomina");
});
