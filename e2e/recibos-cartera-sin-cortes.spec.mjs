import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos y Cartera sin NADA cortado a 360, 393 y 412 px (auditoría de diseño 237). Se leía
   «Sabadell · falta s…», «Ya ha entra…» y «CaixaBank · 🛒 Gasto diario…», y las píldoras de
   «¿Te llega?» y «Te deben» iban apiladas a 393 y 360. Aquí se mide el DOM: ningún texto más ancho
   que su caja, ni con elipsis ni desbordado. Datos inventados. */
const r = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const fixed = [
  r("alq", "Alquiler", 650, 1, { category: "hogar", account: "caixabank" }),
  r("luz", "Luz", 54.26, 8, { category: "luz" }),
  r("pepe", "Pepephone", 22, 20, { bankAmount: 32, reparto: [{ id: "pe_pareja", n: "Pareja", via: "bizum", amt: 10 }] }),
  r("agua", "Agua", 28.15, 22, { category: "agua" }),
  r("digi", "Internet Digi", 30, 24, { category: "recibos" }),
  r("gym", "Gimnasio", 39.9, 28, { category: "deporte", account: "caixabank" }),
];
const gasto = (id, date, amount, ent, merchant) => ({ id, extId: "b-" + id, ent, date: date + "T10:00:00.000Z", amount, merchant, obName: merchant, source: "ob", status: "BOOK", category: "otros" });
const estado = {
  __seedOnce: true, lastBackup: "2026-11-16", _dynBalAnchored: true,
  accounts: [
    { id: "sab", ent: "sabadell", name: "Cuenta Expansión", role: "diario", value: 2830.45 },
    { id: "rev", ent: "revolut", name: "Revolut", role: "fijos", value: 228.69 },
    { id: "cxa", ent: "caixabank", name: "Cuenta Nómina", role: "fijos", value: 1520, balanceAt: "2026-11-16T08:00:00.000Z" },
    { id: "ef", ent: "efectivo", name: "Efectivo", value: 80 },
  ],
  fixed, debts: [], oneoffs: [],
  assets: [{ id: "seat", kind: "coche", name: "Seat León", value: 14500 }],
  investments: [{ id: "i2", ent: "trade_republic", name: "MSCI World", ticker: "IWDA", shares: 80, value: 8420.37, cost: 7000, cur: "EUR" }],
  flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 2150, to: "sabadell", day: 3 }],
  bankTx: [{ id: "b-alq", ent: "caixabank", date: "2026-11-01", amount: 650, merchant: "ALQUILER PISO", concept: "ALQUILER PISO", status: "BOOK" }],
  expenses: [gasto("alq", "2026-11-01", 650, "caixabank", "ALQUILER PISO"), gasto("s1", "2026-11-02", 62.4, "sabadell", "MERCADONA")],
  settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell", "revolut", "caixabank", "efectivo"], dailyOnlyBanks: ["efectivo", "revolut"] },
};

async function abre(page, vp) {
  test.info().annotations.push({ type: "own-clock" });
  await page.setViewportSize(vp);
  await page.clock.install({ time: new Date("2026-11-16T12:00:00+01:00") });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  await seedLoggedInDashboard(page, JSON.parse(JSON.stringify(estado)));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}
/* Todo lo que tenga texto dentro de `sel` y no se lea entero: recortado por su caja (elipsis u
   overflow oculto) o saliéndose de la tarjeta. Un `::after` de área de toque no cuenta: no es texto. */
const cortados = (page, sel) => page.evaluate((sel) => {
  const out = [];
  document.querySelectorAll(sel).forEach((root) => {
    const rb = root.getBoundingClientRect();
    [root].concat(Array.from(root.querySelectorAll("*"))).forEach((e) => {
      if (e instanceof SVGElement || !e.textContent.trim() || !e.getClientRects().length) return;
      const cs = getComputedStyle(e), b = e.getBoundingClientRect(), recorta = cs.overflowX !== "visible";
      if (recorta && e.scrollWidth > e.clientWidth + 1) out.push("recortado " + e.className + ": " + e.textContent.trim());
      if (b.right > rb.right + 1 || b.left < rb.left - 1) out.push("fuera " + e.className + ": " + e.textContent.trim());
    });
  });
  return out;
}, sel);

for (const vp of [{ width: 360, height: 740 }, { width: 393, height: 851 }, { width: 412, height: 915 }]) {
  test("Recibos sin cortes a " + vp.width + " px: cuándo bajo el importe, píldoras en fila y «Ya ha entrado» entero", async ({ page }) => {
    await abre(page, vp);
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
    await expect(recibos.getByTestId("plan-due")).toBeVisible();

    // Pepephone: «Sabadell · falta su parte» entero y «en 4 días» debajo del importe.
    const pepe = recibos.locator('[data-recibo="fixed_pepe"]');
    await expect(pepe.locator(".pr6-cat")).toHaveText("Sabadell · falta su parte");
    await expect(pepe.locator(".pr6-am .pr6-when")).toHaveText("en 4 días");
    await expect(recibos.locator('[data-recibo="fixed_digi"] .pr6-cat')).toHaveText("Recibos · Sabadell");

    // Las dos píldoras en la misma fila, enteras y con su flecha dentro.
    const pills = recibos.locator(".pr6-pills > .pr6-pill");
    await expect(pills).toHaveCount(2);
    const [a, b] = await pills.evaluateAll((ps) => ps.map((p) => ({ top: Math.round(p.getBoundingClientRect().top), cw: p.clientWidth, sw: p.scrollWidth })));
    expect(a.top, "en fila").toBe(b.top);
    for (const p of [a, b]) expect(p.sw).toBeLessThanOrEqual(p.cw + 1);

    // Cabeceras plegadas: solo la flecha, sin «Ver», y el título entero.
    for (const id of ["plan-paid", "plan-entrado"]) {
      const h = recibos.getByTestId(id).locator(".pr6-paid-h");
      await expect(h.locator(".pr6-chev")).toBeVisible();
      await expect(h).not.toContainText(/\bVer\b|Ocultar/);
    }
    await expect(recibos.getByTestId("plan-entrado").locator(".pr6-paid-l")).toHaveText("Ya ha entrado");

    expect(await cortados(page, '.page-live [data-seg="recibos"] .pr6-sum, .page-live [data-seg="recibos"] .pr6-sec .v4-charge, .page-live [data-seg="recibos"] .pr6-paid-h')).toEqual([]);
  });

  test("Cartera sin cortes a " + vp.width + " px: uso de la cuenta sin emoji, leyenda y bienes con baldosa", async ({ page }) => {
    await abre(page, vp);
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    const caixa = page.locator('.page-live button.v4-mov[data-account-id="cxa"] .meta');
    await expect(caixa).toHaveText("CaixaBank · Diario + Recibos");
    await expect(page.locator('.page-live button.v4-mov[data-account-id] .meta').filter({ hasText: /🛒|🏦/ })).toHaveCount(0);
    await expect(page.locator('.page-live [data-act="bank-add"]')).toHaveText("Añadir");
    // El bien, en la misma baldosa de 44 px que las cuentas.
    const seat = page.locator(".page-live button.v4-mov").filter({ hasText: "Seat León" });
    expect(Math.round((await seat.locator(".tile").boundingBox()).width)).toBe(44);
    await expect(seat.locator(".am")).toHaveText("14.500 €");
    await expect(page.locator('.page-live [data-broker-key="trade_republic"] .am')).toHaveText("8.420,37 €");
    expect(await cortados(page, ".page-live .v4-legend, .page-live .v4-card-list button.v4-mov")).toEqual([]);
  });
}
