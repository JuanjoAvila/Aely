import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* PLAN (orden del dueño, 24/11): las hojas de alta (Añadir deuda, Nueva meta y su edición, Añadir bien) son la de Añadir
   recibo (importe grande con teclado propio, celdas compactas, «Más datos» plegado, botón de abajo); los botones de la
   ficha de una deuda son uno principal y Editar / Eliminar discretos; las cabeceras de Recibos, Deudas y Metas miden lo
   mismo (las pestañas no saltan), Recibos con dos celdas y «+ Añadir» pequeño también en Metas. Cifras inventadas; reloj
   del 26/09/2026. Con CAPTURAS=<carpeta> guarda las capturas del revisor (390 px, TEMA=light para claro). */
const YM = 2026 * 12 + 8;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 2380, role: "diario", spendFrom: true }];
const nomina = { id: "n1", date: "2026-09-03T10:00:00.000Z", amount: -3000, category: "ingreso", merchant: "Nómina Empresa SL", ent: "sabadell", source: "manual" };
const prestamo = { id: "d1", ent: "familia", name: "Préstamo del piso", value: 12000, original: 12000, monthly: 260, months: 40, day: 28, asOf: YM - 6, account: "sabadell" };
const viaje = { id: "g1", name: "Viaje", emoji: "✈️", target: 3000, saved: 100, deadline: "2027-08", monthly: 50 };
const base = (extra = {}) => Object.assign({ __seedOnce: true, bankTx: [], flows: [], oneoffs: [], settings, accounts, budget: 1200, expenses: [nomina],
  fixed: [{ id: "r1", name: "Comunidad", amount: 95, freq: "mes", day: 28, account: "sabadell" }], debts: [prestamo], goals: [viaje], assets: [],
  aportaciones: [], reservaLog: [] }, extra);

const estado = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")));
const pad = async (hoja, txt) => { for (const ch of txt) await hoja.locator('.v4-keys button[aria-label="' + ch + '"]').click(); };
const captura = async (page, nombre) => {
  await page.waitForTimeout(700);
  if (process.env.CAPTURAS) await page.screenshot({ path: process.env.CAPTURAS + "/" + nombre + "-" + (process.env.TEMA || "oscuro") + ".png" });
};

async function abre(page, estadoInicial, destino = "plan") {
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, estadoInicial);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  if (process.env.TEMA) await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), process.env.TEMA);
  await page.locator('.botnav-tab[data-tour="' + destino + '"]').click();
}
const seg = (page, s) => page.locator('.v4-seg-btn[data-seg="' + s + '"]').click();
const topTabs = (page) => page.locator(".v4-plan-tabs").evaluate((e) => Math.round(e.getBoundingClientRect().top));

test("Recibos, Deudas y Metas: la cabecera mide lo mismo y las pestañas no saltan", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abre(page, base());
  const alturas = {};
  for (const s of ["recibos", "deudas", "metas"]) {
    await seg(page, s);
    await page.waitForTimeout(700);
    alturas[s] = await topTabs(page);
  }
  expect(alturas.deudas).toBe(alturas.recibos);
  expect(alturas.metas).toBe(alturas.recibos);
  await captura(page, "cabecera-metas");
});

test("Recibos: siempre dos celdas con divisor; la que falta la ocupa «Ya pagados»", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abre(page, base());
  const pills = page.getByTestId("plan-summary").locator(".pr6-pill");
  await expect(pills).toHaveCount(2);
  await expect(pills.nth(0)).toContainText("¿Te llega?");
  await expect(page.getByTestId("plan-deben")).toHaveCount(0);
  await expect(page.getByTestId("plan-pagado")).toContainText(/Ya pagados\s*0,00/);
  const [a, b] = await Promise.all([pills.nth(0).boundingBox(), pills.nth(1).boundingBox()]);
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);
  await captura(page, "cabecera-recibos");
});

test("Recibos con «Te deben»: son esas dos celdas y no sale «Ya pagados»", async ({ page }) => {
  const pepe = { id: "pepe", name: "Pepephone", amount: 22, freq: "mes", day: 20, account: "sabadell", bankAmount: 85, reparto: [
    { id: "pe_pareja", n: "Pareja", via: "bizum", amt: 10 }, { id: "pe_fam", n: "Familia", via: "debt", debtId: "mama", amt: 53 }] };
  const mama = { id: "mama", name: "Mamá", monthly: 197, amort: 250, value: 5000, account: "sabadell", day: 20, asOf: YM - 1 };
  await abre(page, base({ fixed: [pepe], debts: [mama] }));
  const pills = page.getByTestId("plan-summary").locator(".pr6-pill");
  await expect(pills).toHaveCount(2);
  await expect(page.getByTestId("plan-deben")).toContainText("Te deben");
  await expect(page.getByTestId("plan-pagado")).toHaveCount(0);
});

test("Metas: «+ Añadir» pequeño en la cabecera, sin botón verde ancho", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abre(page, base());
  await seg(page, "metas");
  const add = page.getByTestId("goals-summary").locator('[data-act="goal-new"]');
  await expect(add).toBeVisible();
  expect((await add.boundingBox()).width).toBeLessThan(140);
  await expect(page.locator('[data-seg="metas"] .btn-primary.btn-block')).toHaveCount(0);
  await add.click();
  await expect(page.getByTestId("goal-add-form")).toBeVisible();
});

test("Ficha de deuda: Amortizar como acción principal; Editar y Eliminar discretos, alineados y funcionando", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abre(page, base());
  await seg(page, "deudas");
  await page.locator('[data-debt-id="d1"]').click();
  const ficha = page.getByTestId("plan-deuda-ficha");
  await expect(ficha).toBeVisible();
  const pie = ficha.locator(".rpt-sf");
  const amort = pie.locator('[data-act="ficha-amortizar"]'), editar = pie.locator('[data-act="ficha-editar"]'), elim = pie.locator('[data-act="ficha-eliminar"]');
  await expect(pie.locator("button")).toHaveCount(3);
  await expect(amort).toHaveText("Amortizar");
  const [ba, be, bx] = await Promise.all([amort.boundingBox(), editar.boundingBox(), elim.boundingBox()]);
  // Editar y Eliminar en la misma línea, bajo la acción principal y con menos peso (sin caja ancha).
  expect(Math.abs(be.y - bx.y)).toBeLessThan(2);
  expect(be.y).toBeGreaterThan(ba.y + ba.height - 1);
  expect(be.width).toBeLessThan(140);
  expect(bx.width).toBeLessThan(140);
  const bg = (loc) => loc.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await bg(editar)).toBe("rgba(0, 0, 0, 0)");
  expect(await bg(elim)).toBe("rgba(0, 0, 0, 0)");
  const color = (loc) => loc.evaluate((e) => getComputedStyle(e).color);
  const coral = await page.evaluate(() => { const d = document.createElement("i"); d.style.color = "var(--coral)"; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  expect(await color(elim)).toBe(coral);
  await captura(page, "ficha-deuda");
  // Amortizar pide el importe; se cancela sin tocar la deuda.
  await amort.click();
  await expect(page.locator(".askback")).toBeVisible();
  await page.locator(".askback").getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.locator(".askback")).toHaveCount(0);
  // Eliminar pide confirmación y, cancelada, no borra nada.
  await page.locator('.rpt-sheet [data-act="ficha-eliminar"]').click();
  await expect(page.locator(".askback")).toBeVisible();
  await page.locator(".askback").getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(((await estado(page)).debts || []).length).toBe(1);
  // Editar abre la hoja de edición de la deuda.
  await seg(page, "deudas");
  await page.locator('[data-debt-id="d1"]').click();
  await page.locator('.rpt-sheet [data-act="ficha-editar"]').click();
  await expect(page.getByTestId("debt-edit-form")).toBeVisible();
});

test("Meta: se edita por la hoja nueva (objetivo con el teclado propio) y se puede borrar con confirmación", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abre(page, base());
  await seg(page, "metas");
  await page.locator('[data-goal-id="g1"]').click();
  await page.locator('.rpt-sheet [data-act="ficha-editar"]').click();
  const hoja = page.getByTestId("goal-add-form");
  await expect(hoja).toBeVisible();
  await expect(hoja.locator('[data-goal-field="target"]')).toContainText("3.000");
  await expect(hoja.locator('[data-goal-field="name"]')).toHaveValue("Viaje");
  await captura(page, "editar-meta");
  // El primer número tecleado sustituye al objetivo que había.
  await hoja.locator('[data-goal-field="target"]').click();
  await pad(hoja, "4000,5");
  await hoja.locator('[data-goal-field="saved"]').click();
  await pad(hoja, "250");
  await hoja.locator('[data-act="hoja-guardar"]').click();
  await expect(hoja).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).goals || [])[0].target).toBe(4000.5);
  const g = (await estado(page)).goals[0];
  expect(g).toMatchObject({ name: "Viaje", emoji: "✈️", saved: 250, deadline: "2027-08", monthly: 50 });
  // Borrar: arriba en la hoja, con confirmación; cancelada, la meta sigue.
  await page.locator('[data-goal-id="g1"]').click();
  await page.locator('.rpt-sheet [data-act="ficha-editar"]').click();
  await hoja.locator('[data-act="hoja-eliminar"]').click();
  await expect(page.locator(".askback")).toBeVisible();
  await page.locator(".askback").getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(((await estado(page)).goals || []).length).toBe(1);
});

test("Meta: con una coma mal puesta no se puede guardar (misma validación que antes)", async ({ page }) => {
  await abre(page, base());
  await seg(page, "metas");
  await page.locator('[data-goal-id="g1"]').click();
  await page.locator('.rpt-sheet [data-act="ficha-editar"]').click();
  const hoja = page.getByTestId("goal-add-form");
  await hoja.locator('[data-goal-field="target"]').click();
  await pad(hoja, "0");
  await hoja.locator('[data-act="hoja-guardar"]').click();
  await expect(hoja.getByRole("alert")).toBeVisible();
  expect((await estado(page)).goals[0].target).toBe(3000);
});

test("Añadir deuda y Añadir bien: la hoja de Añadir recibo (importe grande, teclado propio, Más datos plegado)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abre(page, base({ debts: [] }));
  await seg(page, "deudas");
  await page.locator('[data-act="debt-add"]').click();
  const deuda = page.getByTestId("debt-add-form");
  await expect(deuda.locator(".rp4-amt-v")).toBeVisible();
  await expect(deuda.locator(".v4-keys")).toBeVisible();
  await expect(deuda.locator(".rpa-in > .rpa-grid .rpa-cell")).toHaveCount(3);
  await captura(page, "anadir-deuda");
  await deuda.locator('[data-debt-add="name"]').fill("Móvil");
  await deuda.locator('[data-debt-add="value"]').click();
  await pad(deuda, "600");
  await deuda.locator('[data-debt-add="monthly"]').click();
  await pad(deuda, "50");
  await deuda.locator('[data-act="hoja-guardar"]').click();
  await expect(deuda).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).debts || []).length).toBe(1);
  expect((await estado(page)).debts[0]).toMatchObject({ name: "Móvil", value: 600, monthly: 50, account: "sabadell", day: 1 });

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: "Añadir bien", exact: true }).click();
  const bien = page.getByTestId("asset-sheet");
  await expect(bien).toBeVisible();
  const guardar = bien.locator('[data-act="hoja-guardar"]');
  await expect(guardar).toHaveAttribute("aria-disabled", "true");
  await captura(page, "anadir-bien");
  await bien.locator('[data-asset-field="name"]').fill("Coche");
  await bien.locator('[data-asset-field="value"]').click();
  await pad(bien, "8500,5");
  await bien.locator('[data-asset-kind="coche"]').click();
  await expect(guardar).toHaveAttribute("aria-disabled", "false");
  await guardar.click();
  await expect(bien).toHaveCount(0);
  await expect.poll(async () => ((await estado(page)).assets || []).length).toBe(1);
  expect((await estado(page)).assets[0]).toMatchObject({ name: "Coche", kind: "coche", value: 8500.5 });
});
