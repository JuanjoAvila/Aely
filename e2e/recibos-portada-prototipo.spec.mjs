import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos: la portada como el prototipo de Claude Design (docs/design/plan-recibos/SPEC.md §2
   y §4; auditoría del 9/11/2026). Lo que se rompió no se ve leyendo el código sino en la pantalla:
   «Ya pagados» partido en dos renglones con la letra del sistema al 110 %, el importe de «¿Y si
   gasto…?» aplastado por los bancos, «¿Cuánto es?» tapado con un nombre largo. Aquí se mide el DOM:
   una fila «de una línea» mide lo que una línea de su texto. Datos inventados. */
const YM = 2026 * 12 + 11;
const r = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const fixed = [
  r("coche", "Seguro coche", 41, 2, { category: "coche" }), r("movil", "Móvil", 15, 3, { account: "revolut" }),
  r("agua", "Agua", 28.15, 4, { category: "agua" }), r("gas", "Gas", 32, 1, { category: "gas" }),
  r("digi", "Internet Digi", 30, 12, { category: "recibos" }), r("bas", "Basuras", 90, 14, { category: "tasas" }),
  r("net", "Netflix", 13.99, 15, { category: "ocio", account: "revolut" }),
  r("pepe", "Pepephone", 22, 20, { bankAmount: 32, reparto: [{ id: "pe_pareja", n: "Pareja", via: "bizum", amt: 10 }] }),
  r("cx", "Seguro hogar", 25, 26, { account: "caixabank" }),
  r("alq", "Alquiler", 998, 1, { category: "hogar" }), r("luz", "Luz", 54.26, 8, { category: "luz" }),
];
const cargo = (id, date, amount, merchant) => ({ id, extId: "b-" + id, ent: "sabadell", date: date + "T12:00:00.000Z", amount, merchant, obName: merchant, source: "ob", status: "BOOK", category: "otros" });

async function abre(page, vp, overrides) {
  test.info().annotations.push({ type: "own-clock" });
  await page.setViewportSize(vp);
  await page.clock.install({ time: new Date("2026-11-09T12:00:00+01:00") });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-11-09",
    accounts: [{ id: "s", ent: "sabadell", role: "fijos", value: 1830.45 }, { id: "rv", ent: "revolut", role: "fijos", value: 217 }, { id: "c", ent: "caixabank", role: "fijos", value: 500 }],
    fixed, debts: [], oneoffs: [],
    flows: [{ id: "tr", kind: "transfer", name: "A Revolut", amount: 200, from: "sabadell", to: "revolut", day: 15 }, { id: "nom", kind: "income", name: "Nómina", amount: 1850, to: "sabadell", day: 28 }],
    bankTx: [{ id: "b-alq", ent: "sabadell", date: "2026-11-01", amount: 998, merchant: "ALQUILER SINTETICO", concept: "RECIBO ALQUILER", status: "BOOK" },
      { id: "b-luz", ent: "sabadell", date: "2026-11-08", amount: 54.71, merchant: "IBERDROLA CLIENTES SAU", concept: "RECIBO LUZ", status: "BOOK" }],
    // La luz se cobró 45 céntimos más que lo previsto (él confirma el cargo): así salía «Previsto» y la fila se partía.
    expenses: [cargo("alq", "2026-11-01", 998, "ALQUILER SINTETICO"), cargo("luz", "2026-11-08", 54.71, "IBERDROLA CLIENTES SAU")], settings }, overrides || {}));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
// Letra del sistema al 110 %: como el «tamaño de letra» de Android, crece el texto y no los rellenos.
const letraGrande = (page) => page.evaluate(() => {
  const all = Array.from(document.querySelectorAll(".page-live *")), fs = all.map((e) => parseFloat(getComputedStyle(e).fontSize));
  all.forEach((e, i) => { e.style.fontSize = fs[i] * 1.1 + "px"; });
});
// Alto del elemento frente al de UNA línea de su propio texto: si se parte, mide dos.
const renglones = (loc) => loc.evaluate((e) => {
  const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
  return Math.round(e.getBoundingClientRect().height / lh * 10) / 10;
});

for (const vp of [{ width: 412, height: 915 }, { width: 360, height: 780 }]) {
  test("«Ya pagados» en una línea a " + vp.width + " px, también con la letra al 110 %", async ({ page }) => {
    const recibos = await abre(page, vp);
    // Con otro nombre y 45 céntimos de más sale en «Para revisar» y se confirma desde la ficha (P1-11).
    const review = recibos.getByTestId("plan-review");
    await review.getByRole("button", { name: /Ver los/ }).click();
    await review.locator('[data-recibo="fixed_luz"]').click();
    const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
    await ficha.locator('[data-act="es-este"]').click();
    await expect(ficha).toHaveCount(0);
    const paid = recibos.getByTestId("plan-paid"), h = paid.locator(".pr6-paid-h");
    // La fila dice lo que se cobró de verdad; la cabecera, solo la suma.
    await expect(paid.locator('[data-recibo="fixed_luz"]')).toContainText("54,71");
    await expect(h).toContainText("Ya pagados");
    await expect(h).toContainText("· 2");
    await expect(h).toContainText("1.052,26 €");
    await expect(h).not.toContainText("Previsto");
    for (const grande of [false, true]) {
      if (grande) await letraGrande(page);
      expect(await renglones(paid.locator(".pr6-paid-t"))).toBeLessThan(1.5);
      expect(await renglones(paid.locator(".pr6-paid-amt"))).toBeLessThan(1.5);
      // Nada se corta: ni el número de pagados ni el importe.
      for (const sel of [".pr6-n", ".pr6-paid-amt"]) {
        const [cw, sw] = await paid.locator(sel).evaluate((e) => [e.clientWidth, e.scrollWidth]);
        expect(sw).toBeLessThanOrEqual(cw + 1);
      }
      // «Ver» como el prototipo donde cabe; donde no, la flecha en su sitio (nunca las dos, nunca ninguna).
      const ver = await paid.locator(".pr6-paid-v").isVisible(), flecha = await paid.locator(".pr6-paid-h .pr6-chev").isVisible();
      expect(ver !== flecha).toBe(true);
      if (vp.width === 412 && !grande) expect(ver).toBe(true);
    }
    await h.click();
    await expect(h).toHaveAttribute("aria-expanded", "true");
    if (await paid.locator(".pr6-paid-v").isVisible()) await expect(paid.locator(".pr6-paid-v")).toHaveText("Ocultar");
  });
}

test("portada: tres en «Para revisar», «Todos ›» abre la gestión y «Por pagar» en tres líneas", async ({ page }) => {
  const recibos = await abre(page, { width: 360, height: 780 });
  const review = recibos.getByTestId("plan-review");
  // Cuatro sin cargo y la luz, que cobró distinto con otro nombre (P1-11).
  await expect(review.locator(".v4-charge")).toHaveCount(5);
  await expect(review.locator(".v4-charge:not([inert] *)")).toHaveCount(3);
  await expect(review.getByRole("button", { name: /Ver los 5/ })).toBeVisible();

  const due = recibos.getByTestId("plan-due");
  const basuras = due.locator('[data-recibo="fixed_bas"]');
  // «categoría · banco» en su renglón (la categoría se acorta si no cabe; el banco, no) y «cuándo» debajo.
  await expect(basuras.locator(".pr6-bk")).toHaveText("· Sabadell");
  expect(await renglones(basuras.locator(".sub"))).toBeLessThan(1.5);
  expect(await renglones(basuras.locator(".pr6-when"))).toBeLessThan(1.5);
  await expect(basuras.locator(".nm > .pr6-when")).toHaveText("en 5 días");
  // Con una sola persona no sale «te han pagado 0 de 1».
  await expect(due.locator('[data-recibo="fixed_pepe"] .sub')).toContainText("falta su parte");
  await expect(due).not.toContainText("de 1");

  // Traspasos y entradas con la misma tarjeta, sin «ingreso (entra)».
  await expect(recibos.getByTestId("plan-transfers").locator(".pr6-row")).toHaveCount(1);
  await expect(recibos.getByTestId("plan-income").locator(".pr6-row")).toContainText("Sabadell");
  await expect(recibos.getByTestId("plan-income")).not.toContainText("entra)");

  // Las píldoras no se salen a 360 px, ni con la letra al 110 %, y no pierden la flecha
  // (auditoría 4.26.218: «Te deben 34,95 €» se quedaba sin ella y tocando el borde).
  const pildoras = async () => {
    for (const id of ["plan-llega", "plan-deben"]) {
      const p = await recibos.getByTestId(id).evaluate((e) => {
        const g = e.querySelector(".pr6-pill-go"), b = e.getBoundingClientRect(), gb = g.getBoundingClientRect();
        return { cw: e.clientWidth, sw: e.scrollWidth, go: getComputedStyle(g).display, dentro: gb.width > 0 && gb.right <= b.right - 4 };
      });
      expect(p.sw, id).toBeLessThanOrEqual(p.cw + 1);
      expect(p.go, id + ": la flecha").not.toBe("none");
      expect(p.dentro, id + ": la flecha dentro").toBe(true);
    }
  };
  await pildoras();
  await recibos.locator(".pr6-pills").evaluate((e) => e.querySelectorAll(".pr6-pill").forEach((p) => { p.style.fontSize = "15.4px"; }));
  await pildoras();
  const todos = due.getByTestId("plan-todos");
  await expect(todos).toHaveText("Todos");
  await todos.click();
  await expect(page.locator("[data-bills-manage]")).toBeVisible();
});

test("«¿Y si gasto…?»: con tres bancos el importe no se aplasta y «900,00 €» va en una línea", async ({ page }) => {
  const recibos = await abre(page, { width: 393, height: 727 });
  await recibos.getByTestId("plan-llega").click();
  const zona = page.getByTestId("llega-gasto");
  await expect(zona.locator(".chip")).toHaveCount(3);
  await page.getByTestId("llega-gasto-amt").click();
  for (const k of ["9", "0", "0"]) await zona.locator('.v4-keys button[aria-label="' + k + '"]').click();
  const amt = page.getByTestId("llega-gasto-amt");
  await expect(amt).toHaveText("900,00 €");
  const ancho = await amt.evaluate((e) => e.getBoundingClientRect().width);
  expect(ancho).toBeGreaterThan(140);
  const [cw, sw] = await amt.evaluate((e) => [e.clientWidth, e.scrollWidth]);
  expect(sw).toBeLessThanOrEqual(cw + 1);
  // Cada banco sigue entero y tocable.
  for (const c of await zona.locator(".chip").all()) expect((await c.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await zona.locator('.chip[data-bank="revolut"]').click();
  await expect(page.getByTestId("llega-gasto-txt")).toContainText("No llega");
  // Atrás con el teclado abierto lo pliega a él; el segundo atrás ya cierra la hoja.
  await expect(amt).toHaveAttribute("aria-expanded", "true");
  await page.goBack();
  await expect(amt).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("llega-sheet")).toBeVisible();
  await expect(amt).toHaveText("900,00 €");
  await page.goBack();
  await expect(page.getByTestId("llega-sheet")).toHaveCount(0);
});

test("«¿Cuánto es?» con un nombre largo: el nombre en un renglón y el título a la vista", async ({ page }) => {
  const recibos = await abre(page, { width: 393, height: 727 });
  await recibos.getByTestId("plan-todos").click();
  await page.locator('[data-bills-manage] [data-act="bill-add"]').first().click();
  const hoja = page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
  await hoja.locator('[data-rp4-paso="0"] [data-rp4="name"]').fill("Seguro de hogar Mapfre con nombre muy largo de verdad");
  await hoja.locator(".rp4-cta").click();
  await expect(hoja).toHaveAttribute("data-paso", "1");
  for (const d of "9999999") await hoja.locator('[data-rp4-paso="1"] .v4-keys button[aria-label="' + d + '"]').click();
  const paso = hoja.locator('[data-rp4-paso="1"]');
  expect(await renglones(paso.locator(".rp4-amt > .rp4-dim"))).toBeLessThan(1.5);
  const m = await hoja.evaluate((h) => {
    const b = h.querySelector(".rp4-body"), t = h.querySelector('[data-rp4-paso="1"] .rp4-h').getBoundingClientRect();
    return { top: t.top - b.getBoundingClientRect().top, sobra: b.scrollHeight - b.clientHeight };
  });
  expect(m.top).toBeGreaterThanOrEqual(-1);
  // El paso cabe entero: no hay nada que desplazar (el carril mide 1 px más a propósito).
  expect(m.sobra).toBeLessThanOrEqual(2);
});
