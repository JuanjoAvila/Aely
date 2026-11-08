import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos: lo que el dueño encontró probando la beta 4.26.200 en su móvil («va guay pero hay
   montón de bugs»). Cada prueba abre la pantalla de verdad un 31 de octubre (último día del mes)
   con varios bancos, recibos de cada tipo y cuotas de deuda enlazadas desde Gastos, y mira el DOM:
   - la hoja por pasos: Atrás vuelve un paso sin que la hoja salga volando, no cambia de alto,
     vuelve por donde se llegó («Visto en tu banco» de 2.050 €), los días no se esconden tras elegir
     meses y «Solo una vez» no arranca en un mes que ya no se puede elegir;
   - una cuota de deuda enlazada en Gastos se abre en su ficha con el cargo, sin saltar a Deudas;
   - los simuladores responden al primer toque y se ven enteros. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell", "caixabank", "trade_republic"] };
const accounts = [
  { id: "sb", ent: "sabadell", name: "Cuenta", value: 3200, role: "fijos" },
  { id: "cx", ent: "caixabank", name: "Cuenta", value: 900, role: "ambos" },
  { id: "tr", ent: "trade_republic", name: "Cash", value: 5000, role: "ambos" },
];
const g = (id, merchant, date, amount, ent, extra) => Object.assign({ id, merchant, obName: merchant, date, amount, ent, category: "otros", source: "ob", status: "BOOK" }, extra || {});
const expenses = [
  g("alq8", "ALQUILER PISO SL", "2026-08-01", 2050, "sabadell"),
  g("alq9", "ALQUILER PISO SL", "2026-09-01", 2050, "sabadell"),
  g("alq10", "ALQUILER PISO SL", "2026-10-01", 2050, "sabadell"),
  // Hipoteca marcada en Gastos con un cargo que no es la cuota exacta; préstamo sin día de cobro.
  g("hip10", "PRESTAMO HIPOTECARIO", "2026-10-01", 641.27, "sabadell", { category: "deudas", debtId: "hipo" }),
  g("coche10", "FINANC COCHE", "2026-10-15", 200, "caixabank", { category: "deudas", debtId: "coche" }),
];
const fixed = [
  { id: "net", name: "Internet", amount: 40, freq: "mes", day: 31, account: "caixabank", category: "recibos" },
  { id: "ibi", name: "IBI", amount: 400, freq: "año", schedule: [{ m: 4, day: 20, amt: 200 }, { m: 11, day: 20, amt: 200 }], day: 20, account: "sabadell" },
];
const debts = [
  { id: "hipo", name: "Hipoteca", value: 140000, original: 160000, monthly: 640, account: "sabadell", day: 1, asOf: 2026 * 12 + 9 },
  { id: "coche", name: "Préstamo coche", value: 6000, original: 9000, monthly: 200, account: "caixabank", asOf: 2026 * 12 + 9 },
];
const obBalAt = { "Banco Sabadell": "2026-10-31T08:00:00Z", "CaixaBank": "2026-10-31T08:00:00Z" };

async function abre(page, overrides, cuando) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date(cuando || "2026-10-31T12:00:00+01:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-10-31", bankTx: [], obBalAt, debts, flows: [], oneoffs: [], expenses, settings, accounts, fixed }, overrides || {}));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
const hoja = (page) => page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
const paso = (page, n) => hoja(page).locator('[data-rp4-paso="' + n + '"]');
const cta = (page) => hoja(page).locator(".rp4-cta");
const teclea = async (page, n, digits) => { for (const d of digits) await paso(page, n).locator('.v4-keys button[aria-label="' + d + '"]').click(); };
// Desplazamiento horizontal de la capa que se arrastra (el fondo de la hoja por pasos).
const capaX = (page) => page.locator(".v4-sheet-back").filter({ has: hoja(page) }).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
async function abreAlta(page, recibos) {
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Gestionar" }).click();
  await page.locator('[data-bills-manage] [data-act="bill-add"]').first().click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
}

test("hoja por pasos: Atrás vuelve un paso sin que la hoja salga volando, también arrastrando", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "El gesto táctil real usa CDP");
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  await paso(page, 0).locator('[data-rp4="name"]').fill("Agua");
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  await hoja(page).locator('[data-act="back"]').click();
  // El paso cambia ya y la hoja no se mueve de sitio (antes: 420 ms volando a la derecha y vuelta de golpe).
  await expect(hoja(page)).toHaveAttribute("data-paso", "0", { timeout: 200 });
  expect(Math.abs(await capaX(page))).toBeLessThan(2);
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  await page.waitForTimeout(450);
  // Arrastrar hacia la derecha y soltar: la hoja NO acompaña al dedo de lado (se veía el fondo y dos
  // pasos a la vez, vídeo del dueño 8/11); al soltar vuelve un paso con el carril.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 120, y: 300 }] });
  for (const x of [160, 220, 280, 330]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 302 }] });
  expect(await capaX(page)).toBe(0);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(hoja(page)).toHaveAttribute("data-paso", "0", { timeout: 300 });
  expect(await capaX(page)).toBe(0);
  await expect(hoja(page)).toBeVisible();
  // En el primer paso, Atrás sí cierra.
  await hoja(page).locator('[data-act="back"]').click();
  await expect(hoja(page)).toHaveCount(0);
});

test("hoja por pasos: el alto no salta de un paso a otro", async ({ page }) => {
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  const arriba = () => hoja(page).evaluate((el) => Math.round(el.getBoundingClientRect().top));
  await page.waitForTimeout(600);
  const t0 = await arriba();
  await paso(page, 0).locator('[data-rp4="name"]').fill("Agua");
  await cta(page).click();
  await teclea(page, 1, "30");
  await page.waitForTimeout(450);
  expect(await arriba()).toBe(t0);
  await cta(page).click();
  await paso(page, 2).locator('[data-rp4-dia="5"]').click();
  await page.waitForTimeout(450);
  expect(await arriba()).toBe(t0);
  await cta(page).click();
  await page.waitForTimeout(450);
  expect(await arriba()).toBe(t0);
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await page.waitForTimeout(450);
  expect(await arriba()).toBe(t0);
});

test("«Visto en tu banco» de 2.050 €: Atrás vuelve a la lista y cada línea del resumen vuelve al resumen", async ({ page }) => {
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  const visto = paso(page, 0).getByTestId("rp4-visto").locator(".pr6-cand", { hasText: "ALQUILER PISO SL" });
  await expect(visto).toContainText("2.050,00 €");
  await visto.click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await expect(paso(page, 4).locator('[data-rp4="sum-amt"]')).toHaveText("2.050,00 €");
  // Tocar «Importe» y volver con el botón: al resumen, no al paso siguiente.
  await paso(page, 4).locator('[data-rp4-fila="1"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  await expect(cta(page)).toHaveText("Listo");
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  // Atrás desde el resumen: a la lista de donde se eligió, sin pasar por Cuenta, Cuándo ni Importe.
  await hoja(page).locator('[data-act="back"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  await page.goBack();
  await expect(hoja(page)).toHaveCount(0);
});

test("el camino del dueño: «Visto en tu banco» → resumen → «Nombre» → Atrás vuelve al resumen con el borrador", async ({ page }) => {
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  await paso(page, 0).getByTestId("rp4-visto").locator(".pr6-cand", { hasText: "ALQUILER PISO SL" }).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await paso(page, 4).locator('[data-rp4-fila="0"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  await hoja(page).locator('[data-act="back"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await expect(paso(page, 4).locator('[data-rp4="sum-amt"]')).toHaveText("2.050,00 €");
  // También con el atrás del sistema.
  await paso(page, 4).locator('[data-rp4-fila="0"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  await page.goBack();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
});

test("desde el resumen, «Cuenta» y «Cuándo» vuelven al resumen con Atrás", async ({ page }) => {
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  await paso(page, 0).locator('[data-rp4="name"]').fill("Agua");
  await cta(page).click();
  await teclea(page, 1, "30");
  await cta(page).click();
  await paso(page, 2).locator('[data-rp4-dia="5"]').click();
  await cta(page).click();
  await paso(page, 3).locator('[data-rp4-banco="sabadell"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  for (const fila of ["3", "2", "1"]) {
    await paso(page, 4).locator('[data-rp4-fila="' + fila + '"]').click();
    await expect(hoja(page)).toHaveAttribute("data-paso", fila);
    await hoja(page).locator('[data-act="back"]').click();
    await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  }
  // Y el camino de ida sigue entero detrás: Cuenta, Cuándo, Importe, Nombre y cerrar.
  for (const n of ["3", "2", "1", "0"]) { await hoja(page).locator('[data-act="back"]').click(); await expect(hoja(page)).toHaveAttribute("data-paso", n); }
});

test("un doble toque en «Siguiente» o «Listo» no guarda sin pasar por el resumen", async ({ page }) => {
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  await paso(page, 0).locator('[data-rp4="name"]').fill("Agua");
  await cta(page).click();
  await teclea(page, 1, "30");
  await cta(page).click();
  await paso(page, 2).locator('[data-rp4-dia="5"]').click();
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "3");
  await cta(page).dblclick();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await page.waitForTimeout(500);
  await expect(hoja(page)).toBeVisible();
  expect(await page.evaluate(() => mcLoadRaw(mcStateKey()).fixed.some((f) => f.name === "Agua"))).toBe(false);
  // En edición: «Listo» dos veces enseña el resumen y no guarda el importe.
  await paso(page, 4).locator('[data-rp4-fila="1"]').click();
  await teclea(page, 1, "45");
  await cta(page).dblclick();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await page.waitForTimeout(500);
  await expect(hoja(page)).toBeVisible();
  await cta(page).click();
  await expect(hoja(page)).toHaveCount(0);
  expect(await page.evaluate(() => mcLoadRaw(mcStateKey()).fixed.filter((f) => f.name === "Agua").map((f) => f.amount))).toEqual([45]);
});

test("Cuándo: al elegir los meses, los días quedan a la vista", async ({ page }) => {
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  await paso(page, 0).locator('[data-rp4="name"]').fill("Seguro hogar");
  await cta(page).click();
  await teclea(page, 1, "240");
  await cta(page).click();
  await paso(page, 2).locator('[data-rp4-freq="año"]').click();
  await paso(page, 2).locator(".month-picker button", { hasText: /^Mar$/ }).click();
  const dia = paso(page, 2).locator('[data-rp4-dia="31"]');
  // Encima del botón fijo de abajo, no tapado por él (antes quedaba la primera fila asomando).
  await expect.poll(async () => {
    const d = await dia.boundingBox(), f = await hoja(page).locator(".rp4-foot").boundingBox();
    return d && f ? Math.round(f.y - (d.y + d.height)) : -1;
  }, { timeout: 2000 }).toBeGreaterThanOrEqual(0);
  await dia.click();
  await expect(cta(page)).toBeEnabled();
});

test("«Solo una vez» el último día del mes empieza el mes que viene", async ({ page }) => {
  const recibos = await abre(page);
  await abreAlta(page, recibos);
  await paso(page, 0).locator('[data-rp4="name"]').fill("ITV");
  await cta(page).click();
  await teclea(page, 1, "45");
  await cta(page).click();
  await paso(page, 2).locator('[data-rp4-modo="once"]').click();
  await expect(paso(page, 2).locator(".rp4-mes.on")).toHaveText(/^nov$/i);
  await paso(page, 2).getByRole("button", { name: "Un día después" }).click();
  await expect(paso(page, 2).locator('[data-rp4="dia"]')).toHaveText("día 1");
  await expect(cta(page)).toBeEnabled();
  await cta(page).click();
  await paso(page, 3).locator('[data-rp4-banco="sabadell"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await cta(page).click();
  await expect(hoja(page)).toHaveCount(0);
  const s = await page.evaluate(() => mcLoadRaw(mcStateKey()).oneoffs);
  expect(s).toEqual([expect.objectContaining({ name: "ITV", amount: 45, month: 11, year: 2026, day: 1 })]);
});

test("cuota enlazada por el motor con otro importe: se abre su ficha con el cargo y el motivo, sin saltar a Deudas", async ({ page }) => {
  const recibos = await abre(page);
  const cifra = recibos.getByTestId("plan-summary").locator(".serif.num");
  // Internet 40 + préstamo sin día 200: lo enlazado por el motor no cambia ninguna cifra.
  await expect(cifra).toHaveText("240,00 €");
  const hipo = recibos.getByTestId("plan-review").locator('[data-recibo="debt_hipo"]');
  await expect(hipo).toContainText("Enlazado · 641,27 €");
  await hipo.click();
  const ficha = page.locator('.v4-sheet[data-sheet="deuda"]');
  await expect(ficha).toBeVisible();
  await expect(ficha.getByTestId("deuda-cargo")).toContainText("641,27 €");
  await expect(ficha.getByTestId("deuda-cargo")).toHaveAttribute("data-acredita", "0");
  await expect(ficha.getByTestId("deuda-nota")).toHaveText("Se cobró 641,27 € y la cuota es 640,00 €.");
  // Sin pagar, el cargo no lleva un aro vacío que parezca algo que marcar.
  await expect(ficha.getByTestId("deuda-cargo").locator(".pr6-ring")).toHaveCount(0);
  await expect(page.locator('.v4-seg-btn[data-seg="recibos"]')).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(ficha).toHaveCount(0);
  const coche = recibos.getByTestId("plan-due").locator('[data-recibo="debt_coche"]');
  await expect(coche).toContainText("Enlazado · 200,00 €");
  await coche.click();
  await expect(ficha.getByTestId("deuda-nota")).toHaveText("La cuota no tiene día de cobro.");
  await ficha.locator('[data-act="ver-deuda"]').click();
  await expect(ficha).toHaveCount(0);
  await expect(page.locator('.v4-seg-btn[data-seg="deudas"]')).toHaveAttribute("aria-selected", "true");
  await expect(cifra).toHaveText("240,00 €");
});

test("hipoteca marcada a mano con 641,27: pagada, con lo cobrado y «Esperabas 640,00 €»", async ({ page }) => {
  const recibos = await abre(page, { expenses: [g("hip10", "PRESTAMO HIPOTECARIO", "2026-10-01", 641.27, "sabadell", { category: "deudas", debtId: "hipo", debtManual: true })] });
  await recibos.getByTestId("plan-paid").locator(".pr6-paid-h").click();
  const hipo = recibos.getByTestId("plan-paid").locator('[data-recibo="debt_hipo"]');
  await expect(hipo).toContainText("Cargo 641,27 €");
  await expect(recibos.getByTestId("plan-review").locator('[data-recibo="debt_hipo"]')).toHaveCount(0);
  await hipo.click();
  const ficha = page.locator('.v4-sheet[data-sheet="deuda"]');
  await expect(ficha.getByTestId("deuda-cargo")).toHaveAttribute("data-acredita", "1");
  await expect(ficha.getByTestId("deuda-nota")).toHaveText("Esperabas 640,00 €");
});

test("cuota cobrada justa: su ficha la da por pagada con el cargo y sin nota", async ({ page }) => {
  const recibos = await abre(page, { expenses: [g("hip10", "PRESTAMO HIPOTECARIO", "2026-10-01", 640, "sabadell", { category: "deudas", debtId: "hipo" })] });
  await recibos.getByTestId("plan-paid").locator(".pr6-paid-h").click();
  await recibos.locator('[data-recibo="debt_hipo"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="deuda"]');
  await expect(ficha.getByTestId("deuda-cargo")).toHaveAttribute("data-acredita", "1");
  await expect(ficha.getByTestId("deuda-nota")).toHaveCount(0);
});

test("«¿Y si gasto…?»: tocar la zona abre el teclado y queda a la vista con tres bancos", async ({ page }) => {
  const recibos = await abre(page, { fixed: fixed.concat([{ id: "gym", name: "Gimnasio", amount: 30, freq: "mes", day: 31, account: "trade_republic" }]) });
  await recibos.getByTestId("plan-llega").click();
  const zona = page.getByTestId("llega-gasto");
  await zona.locator(".pr6-ll-n").click();
  await expect(page.getByTestId("llega-gasto-amt")).toHaveAttribute("aria-expanded", "true");
  const tecla = zona.locator('.v4-keys button[aria-label="5"]');
  await expect.poll(async () => { const b = await tecla.boundingBox(); return b ? Math.round(b.y + b.height) : 9999; }, { timeout: 2000 })
    .toBeLessThanOrEqual(page.viewportSize().height);
  await tecla.click();
  await expect(page.getByTestId("llega-gasto-txt")).toBeVisible();
});

const filaGuardada = (page, id) => page.evaluate((id) => { const x = (mcLoadRaw(mcStateKey() + EXP_SUFFIX) || []).find((e) => e.id === id); return x ? String(x.debtId) + "|" + String(x.debtManual) : ""; }, id);
const cocheConDia = [{ id: "coche", name: "Préstamo coche", value: 6000, original: 9000, monthly: 200, account: "caixabank", day: 20, asOf: 2026 * 12 + 9 }];
const internet25 = [{ id: "net", name: "Internet", amount: 40, freq: "mes", day: 25, account: "caixabank" }];
test("cuota marcada a mano en Gastos con otro importe antes de su día: pagada en Recibos, Inicio y «¿Te llega?», sin restarse dos veces", async ({ page }) => {
  // 18/10: préstamo de 200 que vence el 20; CaixaBank ya cobró el 17 «FINANC XYZ» 203,40 (el motor no lo casa).
  const recibos = await abre(page, { debts: cocheConDia, fixed: internet25,
    expenses: [g("coche10", "FINANC XYZ", "2026-10-17", 203.4, "caixabank")] }, "2026-10-18T12:00:00+02:00");
  const cifra = recibos.getByTestId("plan-summary").locator(".serif.num");
  await expect(cifra).toHaveText("240,00 €");
  // Él lo marca en Gastos: «Es la cuota de…» → Préstamo coche.
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator(".v4-gastos-list-body button.v4-mov").filter({ hasText: "FINANC XYZ" }).click();
  await page.locator(".v4-ficha-adjust-row").filter({ hasText: "Es la cuota" }).click();
  await page.locator('.v4-exp-sheet [data-testid="exp-cuota-de"] button.v4-chip').filter({ hasText: "Préstamo coche" }).click();
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".v4-sheet-back")).toHaveCount(0);
  // La fila queda marcada como «a mano»: es lo que la deja pagar la cuota con otro importe.
  await expect.poll(() => filaGuardada(page, "coche10")).toBe("coche|true");
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(cifra).toHaveText("40,00 €");
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="debt_coche"]')).toHaveCount(0);
  await recibos.getByTestId("plan-paid").locator(".pr6-paid-h").click();
  await expect(recibos.getByTestId("plan-paid").locator('[data-recibo="debt_coche"]')).toContainText("Cargo 203,40 €");
  // «¿Te llega?» de CaixaBank: el saldo (900 menos el cargo de 203,40) − Internet 40; la cuota no se resta otra vez (antes 456,60).
  await recibos.getByTestId("plan-llega").click();
  await expect(page.locator('[data-testid="llega-banco"][data-bank="caixabank"]').getByTestId("llega-cifra")).toContainText("656,60 €");
  await page.keyboard.press("Escape");
  await page.goBack();
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await expect(page.locator(".page-scroll-host .v4-charge").filter({ hasText: "Internet" }).first()).toBeVisible();
  await expect(page.locator(".page-scroll-host .v4-charge").filter({ hasText: "Préstamo coche" })).toHaveCount(0);
});

test("el motor enlaza por nombre «PRESTAMO COCHE» 203,40: la cuota de 200 sigue pendiente", async ({ page }) => {
  const recibos = await abre(page, { debts: cocheConDia, fixed: internet25,
    expenses: [g("coche10", "PRESTAMO COCHE", "2026-10-17", 203.4, "caixabank")] }, "2026-10-18T12:00:00+02:00");
  // La pasada del motor la marca como cuota (por nombre e importe parecido) sin decir «a mano».
  await expect.poll(() => filaGuardada(page, "coche10"), { timeout: 5000 }).toBe("coche|undefined");
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText("240,00 €");
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="debt_coche"]')).toContainText("Enlazado · 203,40 €");
});

test("enlazada por el motor con otro importe: tocar su chip encendido la confirma a mano y pasa a pagada", async ({ page }) => {
  // R3: el chip «Es la cuota de…» salía encendido y tocarlo no hacía nada.
  const recibos = await abre(page, { debts: cocheConDia, fixed: internet25,
    expenses: [g("coche10", "PRESTAMO COCHE", "2026-10-17", 203.4, "caixabank")] }, "2026-10-18T12:00:00+02:00");
  const cifra = recibos.getByTestId("plan-summary").locator(".serif.num");
  await expect.poll(() => filaGuardada(page, "coche10"), { timeout: 5000 }).toBe("coche|undefined");
  await expect(cifra).toHaveText("240,00 €");
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator(".page-scroll-host .gx-root .gx-gris[data-gris=\"deuda\"] .gx-gris-h").first().click();
  await page.locator(".page-scroll-host .gx-root .gx-gris[data-gris=\"deuda\"] button").filter({ hasText: "PRESTAMO COCHE" }).first().click();
  await page.locator(".v4-ficha-adjust-row").filter({ hasText: "Es la cuota" }).click();
  const chip = page.locator('.v4-exp-sheet [data-testid="exp-cuota-de"] button.v4-chip').filter({ hasText: "Préstamo coche" });
  await expect(chip).toHaveClass(/on/);
  await expect(chip).not.toHaveAttribute("data-manual", "1");
  await chip.click();
  await expect(page.getByText("Confirmada como cuota de Préstamo coche")).toBeVisible();
  await expect.poll(() => filaGuardada(page, "coche10")).toBe("coche|true");
  await expect(chip).toHaveAttribute("data-manual", "1");
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".v4-sheet-back")).toHaveCount(0);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(cifra).toHaveText("40,00 €");
  await recibos.getByTestId("plan-paid").locator(".pr6-paid-h").click();
  await expect(recibos.getByTestId("plan-paid").locator('[data-recibo="debt_coche"]')).toContainText("Cargo 203,40 €");
});

test("«¿Y si gasto…?»: elegir otro banco no abre el teclado", async ({ page }) => {
  const recibos = await abre(page, { fixed: fixed.concat([{ id: "gym", name: "Gimnasio", amount: 30, freq: "mes", day: 31, account: "trade_republic" }]) });
  await recibos.getByTestId("plan-llega").click();
  const zona = page.getByTestId("llega-gasto");
  await zona.locator('.chip[data-bank="caixabank"]').click();
  await expect(zona.locator('.chip[data-bank="caixabank"]')).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(450);
  await expect(page.getByTestId("llega-gasto-amt")).toHaveAttribute("aria-expanded", "false");
});

test("«¿Me lo puedo permitir?» se abre ya desplegado", async ({ page }) => {
  const recibos = await abre(page);
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Gestionar" }).click();
  await page.locator(".v4-bills-afford").click();
  const sim = page.getByTestId("afford-sim");
  await expect(sim).toBeVisible();
  const importe = sim.getByPlaceholder("Importe €");
  await expect(importe).toBeInViewport();
  await importe.fill("5000");
  await expect(sim.locator(".af-verdict")).toBeVisible();
});
