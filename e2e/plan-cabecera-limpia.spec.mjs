import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* PLAN (orden del dueño, 24/11): la línea «Libre · Entran» de arriba ya no existe (acceso: chip «Tu sueldo» en la tarjeta de Recibos); las pestañas Recibos / Deudas /
   Metas bajan DEBAJO de la tarjeta resumen de cada segmento; sin flecha ⌄ en Recibos; Deudas
   tiene la tarjeta de Recibos (cifra en rojo, chips) con cada lista en su tarjeta y «Añadir» pequeño en la cabecera.
   Cifras inventadas; reloj del 26/09/2026. */
const YM = 2026 * 12 + 8;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 2380, role: "diario", spendFrom: true }];
const nomina = (amount) => ({ id: "n1", date: "2026-09-03T10:00:00.000Z", amount: -amount, category: "ingreso", merchant: "Nómina Empresa SL", ent: "sabadell", source: "manual" });
const prestamo = { id: "d1", ent: "familia", name: "Préstamo del piso", value: 12000, original: 12000, monthly: 260, months: 40, day: 28, asOf: YM - 6, account: "sabadell" };
const gimnasio = { id: "d2", ent: "familia", name: "Financiación del gimnasio", value: 400, original: 600, monthly: 50, amort: 50, months: 8, day: 28, asOf: YM - 2, account: "sabadell" };
const base = (sueldo) => ({ __seedOnce: true, bankTx: [], flows: [], oneoffs: [], settings, accounts, budget: 1200,
  expenses: [nomina(sueldo)], fixed: [{ id: "r1", name: "Comunidad", amount: 95, freq: "mes", day: 28, account: "sabadell" }],
  debts: [prestamo, gimnasio], goals: [{ id: "g1", name: "Viaje", emoji: "✈️", target: 3000, saved: 100, deadline: "2027-08" }],
  aportaciones: [{ id: "a1", name: "Fondo indexado", amount: 200, ent: "myinvestor" }], reservaLog: [] });

async function abrePlan(page, estado, tema) {
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  if (tema) await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), tema);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.getByTestId("plan-reparto-chip")).toBeVisible();
  // Como primer test del worker la pantalla aún entra deslizándose: esperar a que la tarjeta quede asentada dentro del viewport.
  await page.waitForFunction(() => { const c = document.querySelector('[data-testid="plan-summary"]'); if (!c) return false; const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; });
  await page.waitForTimeout(400);
}
const captura = async (page, nombre) => {
  await page.waitForTimeout(700);
  if (process.env.CAPTURAS) await page.screenshot({ path: process.env.CAPTURAS + "/" + nombre + ".png" });
};
const top = (loc) => loc.evaluate((e) => e.getBoundingClientRect().top);
const bottom = (loc) => loc.evaluate((e) => e.getBoundingClientRect().bottom);

test("Plan va sin la fila Libre/Entran ni la flecha ⌄; el icono «i» abre la hoja con la cascada", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrePlan(page, base(300), process.env.TEMA);
  await expect(page.getByTestId("plan-reparto-barra")).toHaveCount(0);
  await expect(page.locator(".rpt-lb")).toHaveCount(0);
  await expect(page.locator(".v4-plan-screen, .page-live").first()).not.toContainText(/Entran\s/);
  await expect(page.locator(".pr6-sum-dot")).toHaveCount(0);
  // Sin flecha «⌄» a la derecha de la cifra: lo único a la derecha es el icono «i» (sin texto).
  const chip = page.getByTestId("plan-reparto-chip");
  await expect(chip).toHaveText("");
  expect((await chip.boundingBox()).width).toBeGreaterThanOrEqual(43);
  await expect(chip.locator("svg")).toHaveCount(1);
  const cb = await chip.locator("svg").boundingBox(), big = await page.locator(".pr6-big").first().boundingBox(), cnt = await page.getByTestId("plan-count").boundingBox(), card = await page.getByTestId("plan-summary").boundingBox();
  expect(cb.y).toBeGreaterThanOrEqual(big.y + big.height - 2);          // debajo de la cifra, no a su altura
  expect(cb.x + cb.width).toBeLessThanOrEqual(card.x + card.width + 1);   // dentro de la tarjeta
  expect(cb.x).toBeGreaterThan(cnt.x + cnt.width * 0.6);                  // a la derecha, no pegado a la cifra
  expect(Math.abs((cb.y + cb.height / 2) - (cnt.y + cnt.height / 2))).toBeLessThan(10); // en la línea de «N recibos»
  await captura(page, "plan-recibos-" + (process.env.TEMA || "oscuro"));
  await chip.click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  await expect(hoja).toBeVisible();
  await expect(hoja.locator(".cas-row")).not.toHaveCount(0);
  await expect(page.getByTestId("plan-reparto-res")).toContainText("Te faltan");
  await hoja.locator(".rpt-sx").click();
  await expect(hoja).toHaveCount(0);
  // Tocar la cifra abre ESTA misma hoja (no una segunda).
  await page.getByTestId("plan-cifras").click();
  await expect(page.getByTestId("plan-reparto-hoja")).toBeVisible();
  await expect(page.getByTestId("plan-mes-hoja")).toHaveCount(0);
});

test("las pestañas van debajo de la tarjeta resumen en Recibos, Deudas y Metas y siguen cambiando de vista", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrePlan(page, base(3000), process.env.TEMA);
  const tabs = page.locator(".v4-plan-tabs");
  await expect(tabs).toHaveCount(1);
  expect(await top(tabs)).toBeGreaterThanOrEqual(await bottom(page.getByTestId("plan-summary")) - 1);
  await tabs.locator('[data-seg="deudas"]').click();
  await expect(page.locator('.v4-seg-btn[data-seg="deudas"]')).toHaveAttribute("aria-selected", "true");
  await expect(tabs).toHaveCount(1);
  expect(await top(tabs)).toBeGreaterThanOrEqual(await bottom(page.getByTestId("debts-summary")) - 1);
  await tabs.locator('[data-seg="metas"]').click();
  await expect(page.locator('.v4-seg-btn[data-seg="metas"]')).toHaveAttribute("aria-selected", "true");
  await expect(tabs).toHaveCount(1);
  expect(await top(tabs)).toBeGreaterThanOrEqual(await bottom(page.getByTestId("goals-summary")) - 1);
  await tabs.locator('[data-seg="recibos"]').click();
  await expect(page.getByTestId("plan-summary")).toBeVisible();
});

test("el icono «i» también está en Deudas y Metas y abre la misma hoja (zona de toque ≥44 px, sin texto)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await abrePlan(page, base(3000), process.env.TEMA);
  for (const seg of ["deudas", "metas"]) {
    await page.locator('.v4-plan-tabs [data-seg="' + seg + '"]').click();
    const i = page.getByTestId("plan-reparto-info-" + seg);
    await expect(i).toBeVisible();
    await expect(i).toHaveText("");
    await expect(i).toHaveAttribute("aria-label", "A dónde va tu sueldo");
    const b = await i.boundingBox(), card = await page.getByTestId(seg === "deudas" ? "debts-summary" : "goals-summary").boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(43); expect(b.height).toBeGreaterThanOrEqual(43);
    expect(b.x + b.width).toBeLessThanOrEqual(card.x + card.width + 13);
    await captura(page, "plan-info-" + seg);
    await i.click();
    await expect(page.getByTestId("plan-reparto-hoja")).toBeVisible();
    await page.getByTestId("plan-reparto-hoja").locator(".rpt-sx").click();
    await expect(page.getByTestId("plan-reparto-hoja")).toHaveCount(0);
  }
});

test("A dónde va tu sueldo: Deudas va en verde (no amarillo) en su leyenda", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrePlan(page, base(3000), process.env.TEMA);
  await page.getByTestId("plan-cifras").click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  await expect(hoja).toBeVisible();
  const col = (loc) => loc.evaluate((e) => getComputedStyle(e).backgroundColor);
  const verde = await page.evaluate(() => { const d = document.createElement("i"); d.style.background = "var(--mint)"; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
  expect(await col(hoja.locator('.cas-row[data-k="deu"] .rpt-sw'))).toBe(verde);
  await captura(page, "hoja-cifras-" + (process.env.TEMA || "oscuro"));
});

test("Deudas: cabecera como la de Metas con la cifra en rojo, listas en tarjeta y Añadir pequeño", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrePlan(page, base(3000), process.env.TEMA);
  await page.locator('.v4-seg-btn[data-seg="deudas"]').click();
  const hero = page.getByTestId("debts-summary");
  await expect(hero).toHaveClass(/rpt-hero/);
  await expect(hero.locator(".rpt-facts.m .rpt-fact")).toHaveCount(2);
  await expect(hero).toContainText("Este mes pagas");
  await expect(page.getByTestId("debts-mes")).toContainText(/310,00/);
  await expect(page.getByTestId("debts-pagados")).toContainText(/pagados · faltan/);
  await expect(page.getByTestId("debts-debes")).toContainText(/Debes/);
  await expect(page.getByTestId("debts-acaba")).toContainText(/Acaba antes/);
  await page.waitForTimeout(500);
  if (process.env.CAPTURAS) { await page.locator('.v4-seg-btn[data-seg="metas"]').click(); await captura(page, "plan-metas-" + (process.env.TEMA || "oscuro")); await page.locator('.v4-seg-btn[data-seg="deudas"]').click(); await page.waitForTimeout(400); }
  const color = await page.getByTestId("debts-mes").evaluate((e) => getComputedStyle(e).color);
  const coral = await page.evaluate(() => { const d = document.createElement("i"); d.style.color = "var(--coral)"; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  expect(color).toBe(coral);
  // La cifra grande de las tres cabeceras es del mismo tamaño
  const px = (loc) => loc.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const deudaPx = await px(page.getByTestId("debts-mes"));
  expect(deudaPx).toBeGreaterThanOrEqual(34);
  // Por pagar en su tarjeta, con el total a la derecha de la cabecera
  const pend = page.locator('[data-seg="deudas"] [data-sec="pend"]');
  await expect(pend.locator(".rpt-list.rpt-card")).toBeVisible();
  await expect(pend.locator(".rpt-card .rpt-row")).toHaveCount(2);
  await expect(page.getByTestId("debts-suma-pend")).toContainText(/310,00/);
  // Añadir: pequeño, en la cabecera, abre la hoja; el botón verde ancho ya no existe
  const add = hero.locator('[data-act="debt-add"]');
  await expect(add).toBeVisible();
  expect((await add.boundingBox()).width).toBeLessThan(140);
  await expect(page.locator('[data-seg="deudas"] .btn-primary.btn-block')).toHaveCount(0);
  await captura(page, "plan-deudas-" + (process.env.TEMA || "oscuro"));
  await add.click();
  await expect(page.getByTestId("debt-add-form")).toBeVisible();
});
