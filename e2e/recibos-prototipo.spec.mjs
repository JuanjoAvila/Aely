import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos como el prototipo (auditoría de la 4.26.216, SPEC docs/design/plan-recibos). Todo
   lo que aquí se mira es lo que se PINTA: el título «Por pagar», la fila sin el nombre repetido,
   el chip de banco legible en claro, los chips y filtros de Tus recibos, la cifra sin contar, el
   ojo que esconde importes y la tecla de borrar dibujada (P1-13). Datos inventados. */
const YM = 2026 * 12 + 11;
const r = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const fixed = [
  r("alq", "Alquiler", 850, 1, { category: "hogar" }),
  r("spo", "Spotify", 10.99, 2, { account: "revolut", category: "ocio" }),
  r("com", "Comunidad", 75, 5, { pausedFrom: YM, pausedUntil: YM + 1 }),
  r("luz", "Luz", 54.26, 20, { category: "luz" }),
  r("net", "Netflix", 13.99, 15, { category: "ocio", account: "revolut" }),
  r("hbo", "HBO Max", 9.99, 17, { account: "revolut" }),
  r("pepe", "Pepephone", 22, 21, { bankAmount: 85, reparto: [
    { id: "pe_pareja", n: "Pareja", via: "bizum", amt: 10 }, { id: "pe_fam", n: "Familia", via: "debt", debtId: "mama", amt: 53 }] }),
  r("yt", "YouTube Premium", 4.99, 22, { bankAmount: 9.98, reparto: [{ id: "pe_dani", n: "Dani", via: "transfer", amt: 4.99 }] }),
];
const mama = { id: "mama", name: "Mamá", monthly: 197, amort: 250, value: 5000, account: "sabadell", day: 20, asOf: YM - 1 };
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };

async function abrePlan(page, vp, extra) {
  test.info().annotations.push({ type: "own-clock" });
  await page.setViewportSize(vp || { width: 412, height: 915 });
  await page.clock.install({ time: new Date("2026-11-09T12:00:00+01:00") });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-11-09",
    accounts: [{ id: "s", ent: "sabadell", role: "fijos", value: 1830.45 }, { id: "rv", ent: "revolut", role: "fijos", value: 217 }],
    fixed, debts: [mama], oneoffs: [], flows: [], bankTx: [], expenses: [],
    settings: Object.assign({}, settings, (extra && extra.settings) || {}) }));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}

test("portada: «Por pagar», la categoría no repite el nombre y el saltado sale tachado", async ({ page }) => {
  const rec = await abrePlan(page);
  const due = rec.getByTestId("plan-due");
  await expect(due.locator(".pr6-sec-h > span").first()).toHaveText("Por pagar");
  // «Luz» con categoría «Luz»: debajo solo el banco, no «Luz · Sabadell».
  const luz = due.locator('[data-recibo="fixed_luz"] .sub');
  await expect(luz).toHaveText("Sabadell");
  // Una cuota con parte de otro recibo, en euros enteros como la SPEC.
  await expect(due.locator('[data-recibo="debt_mama"] .sub')).toContainText("pagas 197 € + 53 € de Pepephone");
  // El pausado este mes, tachado en «Ya pagados» con «este mes no».
  await rec.getByTestId("plan-paid").locator(".pr6-paid-h").click();
  const salt = rec.locator('[data-pausado="1"]');
  await expect(salt).toContainText("este mes no");
  expect(await salt.locator(".pr6-nm").evaluate((e) => getComputedStyle(e).textDecorationLine)).toContain("line-through");
});

test("360 px: «QUEDA POR PAGAR EN NOVIEMBRE» cabe en una línea", async ({ page }) => {
  const rec = await abrePlan(page, { width: 360, height: 780 });
  const micro = rec.getByTestId("plan-summary").locator(".pr6-sum-h .v4-micro");
  await expect(micro).toHaveText(/queda por pagar en noviembre/i);
  const lineas = await micro.evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
  expect(lineas).toBe(1);
});

test("tema claro: el banco elegido de «¿Y si gasto…?» se lee (relleno oscuro, letra blanca)", async ({ page }) => {
  const rec = await abrePlan(page, null, { settings: { theme: "light" } });
  await rec.getByTestId("plan-llega").click();
  const chip = page.locator('.pr6-ll-bks .chip[aria-pressed="true"]');
  await expect(chip).toBeVisible();
  const c = await chip.evaluate((e) => { const s = getComputedStyle(e); return { fg: s.color, bg: s.backgroundColor, ink: getComputedStyle(document.documentElement).getPropertyValue("--mint-ink").trim() }; });
  expect(c.fg).toBe("rgb(255, 255, 255)");
  // Relleno opaco de `--mint-ink` (#1A6B3F), no el tinte del 12 % de antes.
  expect(c.bg).toBe("rgb(26, 107, 63)");
  // La tecla de borrar va dibujada (un glifo de otra fuente costaba un fotograma largo la primera vez).
  await page.getByTestId("llega-gasto-amt").click();
  const borrar = page.locator('.pr6-ll .v4-keys button[aria-label="Borrar"]');
  await expect(borrar.locator("svg")).toHaveCount(1);
  await expect(borrar).toHaveText("");
});

test("Tus recibos: chip relleno, el banco filtra avisos y personas, cuota en una línea y la cifra sin contar", async ({ page }) => {
  const rec = await abrePlan(page);
  await rec.getByTestId("plan-todos").click();
  const hub = page.locator('[data-screen="bills-home"]');
  const todas = hub.locator('[data-mg-bank="todas"]');
  await expect(todas).toHaveAttribute("aria-checked", "true");
  const fondo = await todas.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(document.documentElement).getPropertyValue("--mint").trim()]);
  expect(fondo[0]).not.toBe("rgba(0, 0, 0, 0)");
  // Cuota de Mamá: «197 € + 53 € de Pepephone» en un renglón.
  const cuota = hub.locator('[data-mg-sec="debt"] [data-bill-id="mama"] .sub');
  await expect(cuota).toHaveText("197 € + 53 € de Pepephone");
  const h = await cuota.evaluate((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight));
  expect(Math.round(h)).toBe(1);
  // Sin filtro: el aviso de series (Netflix y HBO, los dos de Revolut) y las tres personas.
  await expect(hub.locator('[data-solape="series"]')).toHaveCount(1);
  await expect(hub.locator("[data-persona]")).toHaveCount(3);
  // La cifra cambia de golpe: justo después del toque ya es la del año, sin pasar por otras.
  const total = hub.locator("[data-bills-total]");
  const mes = await total.textContent();
  await hub.locator("[data-bills-hero]").click();
  const ano = await total.textContent();
  expect(ano).not.toBe(mes);
  await page.waitForTimeout(600);
  await expect(total).toHaveText(ano);
  await hub.locator("[data-bills-hero]").click();
  // Sabadell: el aviso de series (todo Revolut) se va y solo quedan las personas de recibos de Sabadell.
  await hub.locator('[data-mg-bank="sabadell"]').click();
  await expect(hub.locator('[data-mg-bank="sabadell"]')).toHaveAttribute("aria-checked", "true");
  await expect(hub.locator('[data-solape="series"]')).toHaveCount(0);
  await expect(hub.locator("[data-persona]")).toHaveCount(3);
  await hub.locator('[data-mg-bank="revolut"]').click();
  await expect(hub.locator('[data-solape="series"]')).toHaveCount(1);
  await expect(hub.locator("[data-persona]")).toHaveCount(0);
  // Personas: «se descuenta de Mamá» se lee entero (hasta dos renglones).
  await hub.locator('[data-mg-bank="todas"]').click();
  const fam = hub.locator('[data-persona="pe_fam"] .sub');
  await expect(fam).toContainText("se descuenta de Mamá");
  expect(await fam.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
});

test("el ojo: esconde todas las cifras de dinero, deja los conteos y se recuerda al volver", async ({ page }) => {
  const rec = await abrePlan(page);
  const ojo = page.locator('.page-live [data-testid="ojo-importes"]');
  await expect(ojo).toHaveAttribute("aria-pressed", "false");
  const cifras = () => page.evaluate(() => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const el = n.parentElement; if (!el || !el.getClientRects().length || el.closest('[style*="content-visibility"],[aria-hidden="true"]')) continue;
      if (/\d[\d.,]*\s?€/.test(n.textContent)) out.push(n.textContent); }
    return out;
  });
  expect((await cifras()).length).toBeGreaterThan(0);
  await ojo.click();
  await expect(ojo).toHaveAttribute("aria-pressed", "true");
  await expect(rec.getByTestId("plan-summary").locator(".pr6-big")).toHaveText("•••• €");
  await expect(rec.getByTestId("plan-count")).toContainText("recibos");
  expect(await cifras()).toEqual([]);
  await rec.getByTestId("plan-llega").click();
  await expect(page.locator(".pr6-ll")).toBeVisible();
  expect(await cifras()).toEqual([]);
  await page.goBack();
  await rec.getByTestId("plan-todos").click();
  await expect(page.locator("[data-bills-total]")).toHaveText("•••• €");
  expect(await cifras()).toEqual([]);
  await page.goBack();
  for (const tab of ["inicio", "gastos", "cartera"]) {
    await page.locator('.botnav-tab[data-tour="' + tab + '"]').click();
    await page.waitForTimeout(400);
    expect(await cifras(), tab).toEqual([]);
  }
  // Se guarda en settings: tras recargar sigue escondido; otro toque las devuelve.
  expect(await page.evaluate(() => mcLoadRaw(mcStateKey()).settings.ocultarImportes)).toBe(true);
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('.page-live [data-testid="ojo-importes"]')).toHaveAttribute("aria-pressed", "true");
  expect(await cifras()).toEqual([]);
  await page.locator('.page-live [data-testid="ojo-importes"]').click();
  await expect(rec.getByTestId("plan-summary").locator(".pr6-big")).not.toHaveText("•••• €");
  expect((await cifras()).length).toBeGreaterThan(0);
});

test("alta: cada sugerencia lleva su dibujo, no el emoji de la categoría", async ({ page }) => {
  const rec = await abrePlan(page);
  await rec.getByTestId("plan-todos").click();
  await page.locator('[data-act="bill-add"]').click();
  for (const k of ["gimnasio", "netflix", "spotify", "internet", "movil"]) {
    const s = page.locator('[data-rp4-sug="' + k + '"] .rp4-sug-i');
    await expect(s.locator("svg path")).toHaveCount(1);
    await expect(s).toHaveText("");
  }
});
