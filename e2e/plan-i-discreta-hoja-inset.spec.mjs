import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* Dos fallos que vio en su móvil (26/11): la «i» de Plan flotaba a media pantalla, grande y en verde, y
   el final de «A dónde va tu sueldo» quedaba debajo de la barra de gestos. La «i» de referencia es la de
   «Patrimonio neto» de Inicio, así que se compara contra ella. Tamaño OnePlus 13; datos inventados. */
const YM = 2026 * 12 + 8;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"], reservaRules: [{ id: "rr1", name: "", kind: "fixed", value: 300, goalId: "g1", mensual: true }] };
const mov = (id, date, amount, category, merchant) => ({ id, date: date + "T10:00:00.000Z", amount, category, merchant, ent: "sabadell", source: "manual" });
const estado = { __seedOnce: true, bankTx: [], oneoffs: [], settings, budget: 1200,
  flows: [], accounts: [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 2380, role: "diario", spendFrom: true }],
  expenses: [mov("n1", "2026-09-03", -3000, "ingreso", "Nómina Empresa SL"), mov("g1", "2026-09-05", 120.5, "super", "Comercio"),
    mov("t1", "2026-09-06", -800, "traspaso", "Traspaso entre cuentas")],
  fixed: [{ id: "r1", name: "Comunidad", amount: 95, freq: "mes", day: 28, account: "sabadell" }],
  debts: [{ id: "d1", ent: "familia", name: "Préstamo del piso", value: 12000, original: 12000, monthly: 260, months: 40, day: 28, asOf: YM - 6, account: "sabadell" }],
  goals: [{ id: "g1", name: "Viaje", emoji: "✈️", target: 3000, saved: 100, deadline: "2027-08" }],
  aportaciones: [{ id: "a1", name: "Fondo indexado", amount: 200, ent: "myinvestor" }], reservaLog: [],
  accountBalanceHistory: { "acc:sb": [{ day: "2026-08-01", value: 2000 }, { day: "2026-09-01", value: 2200 }, { day: "2026-09-26", value: 2380 }] } };

const ABAJO = 24, ARRIBA = 40; // barra de gestos y barra de estado del OnePlus 13, en px CSS
test.use({ viewport: { width: 412, height: 906 }, deviceScaleFactor: 3.5 });

async function abre(page, tema) {
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { ...estado, settings: { ...settings, theme: tema || "green" } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  // En un PC `env(safe-area-inset-*)` vale 0: se fuerzan las variables que usa toda la app.
  await page.addStyleTag({ content: `:root:root:root{--safe-bottom:${ABAJO}px!important;--safe-top:${ARRIBA}px!important}` });
}
async function aPlan(page) {
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.waitForFunction(() => { const c = document.querySelector('[data-testid="plan-summary"]'); if (!c) return false; const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; });
}
const captura = async (page, nombre) => {
  if (!process.env.CAPTURAS) return;
  await page.waitForTimeout(900);
  await page.screenshot({ path: process.env.CAPTURAS + "/" + nombre + ".png" });
};
const dibujo = (loc) => loc.evaluate((e) => {
  const s = getComputedStyle(e), r = e.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), borde: s.borderTopWidth + " " + s.borderTopColor, color: s.color, letra: s.fontSize, texto: e.textContent };
});
// La zona de toque es el pseudo-elemento de alrededor: se mide preguntando quién recibe el dedo.
const dedo = (loc) => loc.evaluate((e) => {
  const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  return [[-21, 0], [21, 0], [0, -21], [0, 21]].every(([dx, dy]) => document.elementFromPoint(x + dx, y + dy) === e);
});

test("la «i» de Plan es la de «Patrimonio neto»: mismo dibujo, pegada al título y con zona de toque", async ({ page }) => {
  await abre(page, process.env.TEMA);
  await captura(page, "inicio");
  const ref = await dibujo(page.getByTestId("inicio-net-current").locator(".v42-net-info"));
  await aPlan(page);
  await captura(page, "plan-recibos");
  for (const [seg, testid, resumen, titulo] of [["recibos", "plan-reparto-chip", "plan-summary", ".v4-micro"],
    ["deudas", "plan-reparto-info-deudas", "debts-summary", ".rpt-ht"], ["metas", "plan-reparto-info-metas", "goals-summary", ".rpt-ht"]]) {
    await page.locator('.v4-plan-tabs [data-seg="' + seg + '"]').click();
    const i = page.getByTestId(testid);
    await expect(i).toBeVisible();
    await page.waitForTimeout(600);
    await captura(page, "plan-" + seg);
    expect(await dibujo(i)).toEqual(ref);
    const t = await page.getByTestId(resumen).locator(titulo).first().boundingBox(), b = await i.boundingBox();
    expect(b.x - (t.x + t.width)).toBeGreaterThanOrEqual(4);
    expect(b.x - (t.x + t.width)).toBeLessThanOrEqual(12);
    expect(Math.abs(b.y + b.height / 2 - (t.y + t.height / 2))).toBeLessThanOrEqual(3);
    expect(await dedo(i)).toBe(true);
    await i.click();
    await expect(page.getByTestId("plan-reparto-hoja")).toBeVisible();
    await page.getByTestId("plan-reparto-hoja").locator(".rpt-sx").click();
    await expect(page.getByTestId("plan-reparto-hoja")).toHaveCount(0);
  }
});

test("«A dónde va tu sueldo» acaba por encima de la barra de gestos, con aire", async ({ page }) => {
  await abre(page, process.env.TEMA);
  await aPlan(page);
  await page.getByTestId("plan-cifras").click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  // La última línea de la hoja: encima de ella puede ir la previsión, con la misma clase.
  const ultima = hoja.locator(".rpt-own").last();
  await expect(ultima).toBeVisible();
  await page.waitForTimeout(700);
  await captura(page, "hoja-sueldo");
  const hueco = async () => {
    await hoja.locator(".rpt-sb").evaluate((e) => { e.scrollTop = e.scrollHeight; });
    return ultima.evaluate((e) => innerHeight - e.getBoundingClientRect().bottom);
  };
  expect(await hueco()).toBeGreaterThanOrEqual(ABAJO + 20);
  // Con la hoja llena (móvil bajo) el margen tiene que estar al final del scroll, no solo cuando sobra sitio.
  await page.setViewportSize({ width: 360, height: 560 });
  await page.waitForTimeout(500);
  expect(await hueco()).toBeGreaterThanOrEqual(ABAJO + 20);
  await captura(page, "hoja-sueldo-baja-fondo");
});
