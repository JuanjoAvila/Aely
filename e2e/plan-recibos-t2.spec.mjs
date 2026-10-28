import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos v6, tanda 2 (docs/design/plan-recibos/SPEC.md §2.3, §2.6 y §14): los avisos
   nuevos de «Para revisar» y su orden, los casos especiales de la ficha con su pareja de botones,
   posponer con deshacer y Pausar. Todo sale del estado sembrado: se mira el DOM, no el código. */
const YM = 2026 * 12 + 10;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const cuenta = [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }];
const recibo = (id, name, amount, day) => ({ id, name, amount, freq: "mes", day, account: "sabadell" });
const gasto = (id, merchant, date, amount, category) => ({ id, merchant, date, amount, ent: "sabadell", category: category || "otros", source: "ob" });
// Prueba de pago «expense», como la deja el enlace a mano (misma forma que plan-recibos-v6).
const prueba = (f, x) => ({ kind: "expense", key: "sabadell|" + x.date + "|" + x.amount + "|" + x.merchant,
  identity: JSON.stringify(["sabadell", x.date, x.amount, x.merchant]), expenseId: x.id,
  expenseKey: x.date + "|" + x.amount + "|" + x.merchant, expenseLegacyKey: x.date + "|" + x.amount + "|" + x.merchant,
  date: x.date, bank: "sabadell", amount: x.amount, model: JSON.stringify([f.id, "sabadell", f.amount, null]),
  modelVersion: 2, receiptId: f.id, receiptName: f.name });
const ymDe = (date) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
const pagadoCon = (f, ...xs) => { f.paymentProofs = Object.assign({}, f.paymentProofs); xs.forEach((x) => { f.paymentProofs[ymDe(x.date)] = prueba(f, x); }); return f; };

async function abrePlan(page, overrides) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-18T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-10-18", bankTx: [], debts: [], flows: [], oneoffs: [], settings, accounts: cuenta }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
const guardado = (page, id) => page.evaluate((rid) => mcLoadRaw(mcStateKey()).fixed.find((x) => x.id === rid) || null, id);

/* Cuatro avisos, uno de cada: «No ha llegado» (día 3), fantasma (cobrado en julio y nada en
   agosto ni septiembre, con el banco trayendo movimientos esos meses), «Esperabas» (Naturgy: el
   extracto lo casó solo a 61,00 con 60,00 previstos; enlazado a mano no se vuelve a preguntar) y
   «Ha subido» (Netflix a 13,99 en septiembre y en octubre). */
function cuatroAvisos() {
  const g7 = gasto("g7", "SEGURO MASCOTA", "2026-07-08", 12.5, "seguros");
  const n9 = gasto("n9", "NETFLIX.COM", "2026-09-14", 13.99, "ocio"), n10 = gasto("n10", "NETFLIX.COM", "2026-10-14", 13.99, "ocio");
  const super_ = (id, d) => gasto(id, "SUPERMERCADO", d, 20, "super");
  const fixed = [recibo("luz", "Luz", 55, 3), pagadoCon(recibo("pet", "Seguro mascota", 12.5, 8), g7),
    recibo("gas", "Naturgy", 60, 12), pagadoCon(recibo("nfx", "Netflix", 12.99, 14), n9, n10)];
  const bankTx = [{ id: "tx-gas", ent: "sabadell", date: "2026-10-12", amount: 61, merchant: "NATURGY IBERIA", status: "BOOK" }];
  return { fixed, bankTx, expenses: [g7, n9, n10, super_("s8", "2026-08-20"), super_("s9", "2026-09-20"), super_("s10", "2026-10-10")] };
}

test("para revisar: cada aviso en su caso y por prioridad (no cobrados antes que los cobrados raro)", async ({ page }) => {
  const recibos = await abrePlan(page, cuatroAvisos());
  const review = recibos.getByTestId("plan-review");
  await expect(review.locator(".v4-charge")).toHaveCount(4);
  await expect(review.locator(".v4-charge").nth(0)).toHaveAttribute("data-review", "late");
  await expect(review.locator(".v4-charge").nth(1)).toHaveAttribute("data-review", "ghost");
  await expect(review.locator(".v4-charge").nth(2)).toHaveAttribute("data-review", "diff");
  await expect(review.locator(".v4-charge").nth(3)).toHaveAttribute("data-review", "up");
  await expect(review.locator('[data-review="ghost"]')).toContainText("Hace 3 meses que no se cobra");
  await expect(review.locator('[data-review="diff"]')).toContainText("Esperabas 60,00 €");
  await expect(review.locator('[data-review="diff"]')).toContainText("61,00 €");
  await expect(review.locator('[data-review="up"]')).toContainText("Ha subido 1,00 €");
  // Tres a la vista y el cuarto tras «Ver los 4».
  await expect(review.locator(".v4-charge:not([inert] *)")).toHaveCount(3);
  await review.getByRole("button", { name: /Ver los 4/ }).click();
  await expect(review.locator(".v4-charge:not([inert] *)")).toHaveCount(4);
  // Lo cobrado (gas, Netflix) no suma en lo que queda; lo no cobrado (luz, mascota) sí.
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(55 + 12.5)));
});

test("ficha: cobró distinto → «Solo este mes» lo deja como pagado con ese cargo", async ({ page }) => {
  const recibos = await abrePlan(page, cuatroAvisos());
  await recibos.getByTestId("plan-review").locator('[data-review="diff"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await expect(ficha.getByTestId("recibo-nota")).toHaveText("Cobró 61,00 € · esperabas 60,00 €");
  const par = ficha.getByTestId("recibo-par");
  await expect(par.locator("button")).toHaveText(["Solo este mes", "Desde ahora"]);
  // La pareja sustituye a los normales: ni «Ya está pagado» ni «No es este recibo».
  await expect(ficha.locator('[data-act="pagado"], [data-act="no-es"]')).toHaveCount(0);
  await expect(ficha.getByTestId("recibo-baja")).toHaveCount(0);
  await par.getByRole("button", { name: "Solo este mes" }).click();
  await expect(ficha).toHaveCount(0);
  await expect(recibos.getByTestId("plan-review").locator('[data-recibo="fixed_gas"]')).toHaveCount(0);
  const paid = recibos.getByTestId("plan-paid");
  await paid.getByRole("button", { name: /Ya pagados/ }).click();
  await expect(paid.locator(".v4-paid").filter({ hasText: "Naturgy" })).toContainText("Cargo 61,00 €");
  await expect.poll(async () => (await guardado(page, "gas")).revisado).toEqual({ distinto: YM });
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(55 + 12.5)));
});

test("ficha: cobró distinto → «Desde ahora» cambia el importe sin devolver el pago a pendiente", async ({ page }) => {
  const recibos = await abrePlan(page, cuatroAvisos());
  await recibos.getByTestId("plan-review").locator('[data-review="diff"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await ficha.getByRole("button", { name: "Desde ahora" }).click();
  await expect(ficha).toHaveCount(0);
  await expect.poll(async () => (await guardado(page, "gas")).amount).toBe(61);
  await expect(recibos.getByTestId("plan-review").locator('[data-recibo="fixed_gas"]')).toHaveCount(0);
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_gas"]')).toHaveCount(0);
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(55 + 12.5)));
});

test("ficha: ha subido → «Actualizar precio» cambia el importe y el recibo sigue pagado; enlace de baja", async ({ page }) => {
  const recibos = await abrePlan(page, cuatroAvisos());
  const review = recibos.getByTestId("plan-review");
  await review.getByRole("button", { name: /Ver los 4/ }).click();
  await review.locator('[data-review="up"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await expect(ficha.getByTestId("recibo-nota")).toHaveText("Antes 12,99 €");
  await expect(ficha.getByTestId("recibo-par").locator("button")).toHaveText(["Actualizar precio", "Ya no lo tengo"]);
  const baja = ficha.getByTestId("recibo-baja");
  await expect(baja).toHaveText("Cómo darte de baja en Netflix");
  await expect(baja).toHaveAttribute("href", "https://help.netflix.com/es-es/node/407");
  await ficha.getByRole("button", { name: "Actualizar precio" }).click();
  await expect(ficha).toHaveCount(0);
  await expect.poll(async () => (await guardado(page, "nfx")).amount).toBe(13.99);
  // Cambiar el importe no puede devolver a pendiente un pago ya hecho: la cifra no se mueve.
  await expect(review.locator('[data-recibo="fixed_nfx"]')).toHaveCount(0);
  const paid = recibos.getByTestId("plan-paid");
  await paid.getByRole("button", { name: /Ya pagados/ }).click();
  await expect(paid.locator(".v4-paid").filter({ hasText: "Netflix" })).toHaveCount(1);
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_nfx"]')).toHaveCount(0);
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(55 + 12.5)));
});

test("ficha: fantasma → «Ya no lo tengo» pide confirmación, tocar fuera la cancela; no ha llegado lleva sus botones", async ({ page }) => {
  const recibos = await abrePlan(page, cuatroAvisos());
  const review = recibos.getByTestId("plan-review");
  await review.locator('[data-review="ghost"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await expect(ficha.getByTestId("recibo-nota")).toHaveText("Hace 3 meses que no se cobra");
  await expect(ficha.getByTestId("recibo-par").locator("button")).toHaveText(["Sigue activo", "Ya no lo tengo"]);
  await expect(ficha.locator('[data-act="pagado"]')).toHaveCount(0);
  // Sin enlace de baja comprobado para este servicio, no sale.
  await expect(ficha.getByTestId("recibo-baja")).toHaveCount(0);
  await ficha.locator('[data-act="quitar"]').click();
  await expect(ficha.locator('[data-act="quitar"]')).toHaveText("¿Seguro? Borrar");
  await ficha.getByTestId("recibo-nota").click();
  await expect(ficha.locator('[data-act="quitar"]')).toHaveText("Ya no lo tengo");
  await ficha.locator('[data-act="quitar"]').click();
  await ficha.locator('[data-act="quitar"]').click();
  await expect(ficha).toHaveCount(0);
  await expect.poll(() => guardado(page, "pet")).toBeNull();
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(55)));

  await review.locator('[data-review="late"]').click();
  await expect(ficha.getByTestId("recibo-nota")).toHaveText("Tocaba el 3 y no ha llegado");
  await expect(ficha.getByTestId("recibo-par")).toHaveCount(0);
  await expect(ficha.locator('[data-act="pagado"]')).toHaveText("Ya está pagado");
});

test("posponer: «Recuérdamelo mañana» lo pasa a Pendiente hasta mañana y «Deshacer» lo devuelve", async ({ page }) => {
  const recibos = await abrePlan(page, cuatroAvisos());
  const review = recibos.getByTestId("plan-review");
  const total = await page.evaluate(() => eur(55 + 12.5));
  await review.locator('[data-review="late"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await ficha.locator('[data-act="posponer"]').click();
  await expect(ficha).toHaveCount(0);
  await expect(review.locator('[data-recibo="fixed_luz"]')).toHaveCount(0);
  // No desaparece: vuelve a Pendiente y sigue sumando.
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_luz"]')).toHaveCount(1);
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(total);
  const aviso = recibos.getByTestId("plan-deshacer");
  await expect(aviso).toContainText("Luz: te lo recuerdo mañana");
  await aviso.getByRole("button", { name: "Deshacer" }).click();
  await expect(review.locator('[data-recibo="fixed_luz"]')).toHaveCount(1);
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_luz"]')).toHaveCount(0);
  // Pospuesto otra vez y al día siguiente vuelve solo.
  await review.locator('[data-review="late"]').click();
  await ficha.locator('[data-act="posponer"]').click();
  await expect(review.locator('[data-recibo="fixed_luz"]')).toHaveCount(0);
  await page.clock.setSystemTime(new Date("2026-10-19T09:00:00+02:00"));
  await page.reload();
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(recibos.getByTestId("plan-review").locator('[data-recibo="fixed_luz"]')).toHaveCount(1);
});

test("pausar: un recibo ya pagado no sale del mes; uno pendiente «Solo este mes» se descuenta y vuelve al tocarlo", async ({ page }) => {
  const a10 = gasto("a10", "CANAL ISABEL II", "2026-10-05", 20);
  const fixed = [pagadoCon(recibo("agua", "Agua", 20, 5), a10), recibo("gym", "Gimnasio", 40, 25), recibo("int", "Internet", 30, 27)];
  const recibos = await abrePlan(page, { fixed, expenses: [a10] });
  const summary = recibos.getByTestId("plan-summary").locator(".serif.num");
  await expect(summary).toHaveText(await page.evaluate(() => eur(70)));
  const paid = recibos.getByTestId("plan-paid");
  await paid.getByRole("button", { name: /Ya pagados/ }).click();
  await paid.locator(".v4-paid").filter({ hasText: "Agua" }).click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await ficha.locator('[data-act="pausar"]').click();
  const chips = ficha.getByTestId("recibo-pausa");
  // Ya pagado: no hay «Solo este mes», la pausa empieza el mes que viene.
  await expect(chips.locator("button")).toHaveText(["Hasta dic", "Hasta ene", "Hasta feb", "Hasta abr"]);
  await chips.getByRole("button", { name: "Hasta dic" }).click();
  await expect(ficha).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveText("Agua pausado hasta dic");
  await expect.poll(async () => { const f = await guardado(page, "agua"); return [f.pausedFrom, f.pausedUntil]; }).toEqual([YM + 1, YM + 2]);
  await expect(paid.locator(".v4-paid:not(.pr6-skip)").filter({ hasText: "Agua" })).toHaveCount(1);
  await expect(summary).toHaveText(await page.evaluate(() => eur(70)));

  // Pendiente → «Solo este mes»: sale de Pendiente, la cifra baja 40 y sale tachado en Ya pagados.
  await recibos.getByTestId("plan-due").locator('[data-recibo="fixed_gym"]').click();
  await ficha.locator('[data-act="pausar"]').click();
  await expect(chips.locator("button").first()).toHaveText("Solo este mes");
  await chips.getByRole("button", { name: "Solo este mes" }).click();
  await expect(ficha).toHaveCount(0);
  await expect(summary).toHaveText(await page.evaluate(() => eur(30)));
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_gym"]')).toHaveCount(0);
  await expect(recibos.getByTestId("plan-count")).toHaveText(/^1 recibo/);
  const tachado = paid.locator('[data-pausado="1"]');
  await expect(tachado).toContainText("Gimnasio");
  await expect(tachado).toContainText("este mes no");
  await expect.poll(async () => { const f = await guardado(page, "gym"); return [f.pausedFrom, f.pausedUntil]; }).toEqual([YM, YM + 1]);
  // Tocarlo lo devuelve al mes.
  await tachado.click();
  await expect(summary).toHaveText(await page.evaluate(() => eur(70)));
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_gym"]')).toHaveCount(1);
  await expect.poll(async () => (await guardado(page, "gym")).pausedUntil).toBeUndefined();

  // En Todos se ve hasta cuándo está pausado.
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Todos" }).click();
  await page.locator(".v4-bills-group").filter({ hasText: "Servicios y suministros" }).click();
  await expect(page.locator('[data-screen="bills-group"] [data-bill-id="agua"]')).toContainText("pausado hasta dic");
  await expect(page.locator('[data-screen="bills-group"] [data-bill-id="gym"]')).not.toContainText("pausado");
});
