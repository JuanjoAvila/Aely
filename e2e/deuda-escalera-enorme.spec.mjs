import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* H7: a 360 px y letra Enorme, el importe de la línea de la escalera («−260 €/mes» en es/ca,
   «−260 €/mo» en inglés) no se parte; la línea sí puede saltar entre sus trozos (los « · »).
   Mide el DOM real. Datos inventados. */

const YM = 2026 * 12 + 8;
const prestamo = {
  id: "d1", ent: "familia", name: "Préstamo sintético",
  value: 12000, original: 12000, monthly: 260, months: 40, day: 28, asOf: YM - 6, account: "sabadell",
};
const gimnasio = {
  id: "d2", ent: "familia", name: "Financiación sintética del gimnasio",
  value: 400, original: 600, monthly: 50, amort: 50, months: 8, day: 28, asOf: YM - 2, account: "sabadell",
};

async function abreFicha(page, lang) {
  await page.setViewportSize({ width: 360, height: 800 });
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, {
    __seedOnce: true, bankTx: [], flows: [], oneoffs: [],
    settings: { autoPrices: false, theme: "green", lang, simpleMode: false, expenseBanks: ["sabadell"], textSize: "huge" },
    accounts: [{ id: "sb", ent: "sabadell", name: "Cuenta sintética", value: 2380, role: "diario", spendFrom: true }],
    budget: 1200,
    expenses: [{ id: "n1", date: "2026-09-03T10:00:00.000Z", amount: -3000, category: "ingreso", merchant: "Nómina Empresa SL", ent: "sabadell", source: "manual" }],
    fixed: [], debts: [prestamo, gimnasio], goals: [], aportaciones: [], reservaLog: [],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator('.v4-seg-btn[data-seg="deudas"]').click();
  await page.locator('[data-debt-id="d1"]').click();
  const ficha = page.getByTestId("plan-deuda-ficha");
  await expect(ficha).toBeVisible();
  const linea = ficha.locator(".rpt-stc");
  await expect(linea).toBeVisible();
  return { ficha, linea };
}

/* Recortes de línea del trozo «−260 €/mes» (o «/mo»), ignorando uniones y espacios duros. */
function medirImporte(el) {
  const pieces = [];
  let full = "";
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode()); ) {
    pieces.push({ n, start: full.length });
    full += n.data;
  }
  const re = /−(?:[\u2060\u00A0\u202F\s]*[0-9.,])+[\u2060\u00A0\u202F\s]*€[\u2060\u00A0\u202F\s]*\/[\u2060\u00A0\u202F\s]*(?:mes|mo)/;
  const m = full.match(re);
  if (!m) return { found: false, full };
  const from = m.index, to = from + m[0].length;
  const place = (range, idx, edge) => {
    for (const p of pieces) {
      const end = p.start + p.n.data.length;
      if (idx < end || idx === end) {
        if (edge === "start") range.setStart(p.n, Math.min(idx - p.start, p.n.data.length));
        else range.setEnd(p.n, Math.min(idx - p.start, p.n.data.length));
        return;
      }
    }
  };
  const rectsDe = (a, b) => {
    const range = document.createRange();
    place(range, a, "start");
    place(range, b, "end");
    return [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
  };
  const tops = (rects) => {
    const ys = [];
    for (const r of rects) {
      const y = r.top;
      if (!ys.some((z) => Math.abs(z - y) < 2)) ys.push(y);
    }
    return ys;
  };
  const rectsImporte = rectsDe(from, to);
  const rectsLinea = rectsDe(0, full.length);
  const cs = getComputedStyle(el);
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;left:-9999px;top:0;white-space:nowrap;font:" + cs.font + ";letter-spacing:" + cs.letterSpacing + ";";
  probe.textContent = full;
  document.body.appendChild(probe);
  const anchoTexto = probe.getBoundingClientRect().width;
  probe.remove();
  return {
    found: true,
    sample: m[0].replace(/\u2060/g, "").replace(/[\u00A0\u202F]/g, " "),
    lineasImporte: tops(rectsImporte).length,
    lineasTotales: tops(rectsLinea).length,
    rectsImporte: rectsImporte.map((r) => ({ t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width) })),
    anchoTexto: Math.round(anchoTexto),
    anchoCaja: Math.round(el.getBoundingClientRect().width),
    whiteSpace: cs.whiteSpace,
  };
}

for (const [lang, sufijo] of [["es", "/mes"], ["en", "/mo"], ["ca", "/mes"]]) {
  test(`escalera: «−260 €${sufijo}» no se parte a 360 px con letra Enorme (${lang})`, async ({ page }) => {
    const { linea } = await abreFicha(page, lang);
    await expect(linea).toContainText("−260");
    // El importe va en su propio trozo sin corte; el texto de cap() (aria-label y data-cap) no cambia.
    await expect(linea.locator("span", { hasText: "−260" })).toHaveCSS("white-space", "nowrap");
    const caps = await page.locator(".rpt-stp").evaluateAll((bs) => bs.map((b) => (b.getAttribute("aria-label") || "") + (b.getAttribute("data-cap") || "")));
    for (const c of caps) expect(c).not.toMatch(/\u2060/);
    const med = await linea.evaluate(medirImporte);
    expect(med, "la línea enseña el importe de la escalera").toEqual(expect.objectContaining({ found: true }));
    expect(med.sample.replace(/\s+/g, " ")).toMatch(new RegExp("^−260 €" + sufijo.replace("/", "\\/") + "$"));
    // Si la frase no cabe, puede saltar en los « · », pero el importe queda en una sola línea.
    expect(med.lineasImporte, JSON.stringify(med)).toBe(1);
    expect(med.whiteSpace).not.toBe("nowrap");
    if (med.anchoTexto > med.anchoCaja + 1) expect(med.lineasTotales).toBeGreaterThan(1);
  });
}
