import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* PLAN › «A DÓNDE VA TU SUELDO» como cascada (orden del dueño 24/11): lo que entra, menos cada destino con su
   importe de TODO el mes, y el resultado («Te sobran / Te faltan»). Con el DOM real y datos sembrados: las líneas
   suman exactamente lo que entra menos el resultado, el resultado es el mismo número que la línea de cabecera, la
   flecha de Recibos y la línea abren la MISMA hoja, y lo que aún queda por pagar es otra sección. Reloj 26/09/2026. */
const YM = 2026 * 12 + 8;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"], reservaRules: [{ id: "rr1", name: "", kind: "fixed", value: 300, goalId: "g1", mensual: true }] };
const accounts = [{ id: "sb", ent: "sabadell", name: "Cuenta", value: 2380, role: "diario", spendFrom: true }];
const nomina = (amount) => ({ id: "n1", date: "2026-09-03T10:00:00.000Z", amount: -amount, category: "ingreso", merchant: "Nómina Empresa SL", ent: "sabadell", source: "manual" });
const gasto = { id: "g1", date: "2026-09-05T10:00:00.000Z", amount: 120.5, category: "super", merchant: "Comercio g1", ent: "sabadell", source: "manual" };
const prestamo = { id: "d1", ent: "familia", name: "Préstamo del piso", value: 12000, original: 12000, monthly: 260, months: 40, day: 28, asOf: YM - 6, account: "sabadell" };
const base = (sueldo) => ({ __seedOnce: true, bankTx: [], flows: [], oneoffs: [], settings, accounts, budget: 1200,
  expenses: [nomina(sueldo), gasto], fixed: [{ id: "r1", name: "Comunidad", amount: 95, freq: "mes", day: 28, account: "sabadell" }],
  debts: [prestamo], goals: [{ id: "g1", name: "Viaje a Japón", emoji: "✈️", target: 3000, saved: 100, deadline: "2027-08" }],
  aportaciones: [{ id: "a1", name: "Fondo indexado", amount: 200, ent: "myinvestor" }], reservaLog: [] });

async function abrePlan(page, estado) {
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.getByTestId("plan-reparto-chip")).toBeVisible();
}
// «3.473,35 €» → 347335 (céntimos); con o sin signo.
const cts = (txt) => Math.round(parseFloat(txt.replace(/[^0-9,]/g, "").replace(",", ".")) * 100);

async function lee(page) {
  const hoja = page.getByTestId("plan-reparto-hoja");
  const entra = cts(await page.getByTestId("plan-reparto-entra").innerText());
  const filas = await hoja.locator(".cas-row[data-c]").evaluateAll((els) => els.map((e) => ({ k: e.dataset.k, c: Number(e.dataset.c), txt: e.querySelector(".cas-am").innerText })));
  const res = await page.getByTestId("plan-reparto-res").getAttribute("class");
  const cifra = (await page.getByTestId("plan-reparto-cifra").count()) ? cts(await page.getByTestId("plan-reparto-cifra").innerText()) : 0;
  return { entra, filas, signo: /rojo/.test(res) ? -1 : 1, cifra };
}

test("sobra dinero: las líneas suman el plan y entra − plan = «Te sobran»", async ({ page }) => {
  await abrePlan(page, base(3000));
  const barra = page.getByTestId("plan-reparto-chip");
  await barra.click();
  if (process.env.CAPTURAS) { await page.waitForTimeout(700); await page.screenshot({ path: process.env.CAPTURAS + "/cascada-sobran-" + (process.env.TEMA || "oscuro") + ".png" }); }
  const x = await lee(page);
  expect(x.filas.map((f) => f.k)).toEqual(["rec", "deu", "met", "aho", "gas"]);
  // Lo que se pinta es lo que se suma: cada importe del DOM = su céntimo, con signo menos.
  for (const f of x.filas) expect(cts(f.txt)).toBe(f.c);
  const plan = x.filas.reduce((a, f) => a + f.c, 0);
  expect(plan).toBe(9500 + 26000 + 30000 + 20000 + 90000);
  expect(x.entra).toBe(300000);
  expect(x.signo).toBe(1);
  expect(x.cifra).toBe(x.entra - plan);
  await expect(page.getByTestId("plan-reparto-res")).toContainText("Te sobran");
});

test("faltan dinero: «Te faltan» = plan − entra, y sin bloque de aviso aparte", async ({ page }) => {
  await abrePlan(page, base(1500));
  const barra = page.getByTestId("plan-reparto-chip");
  await barra.click();
  if (process.env.CAPTURAS) { await page.waitForTimeout(700); await page.screenshot({ path: process.env.CAPTURAS + "/cascada-faltan-" + (process.env.TEMA || "oscuro") + ".png" }); }
  const x = await lee(page);
  const plan = x.filas.reduce((a, f) => a + f.c, 0);
  expect(x.signo).toBe(-1);
  expect(x.cifra).toBe(plan - x.entra);
  expect(x.cifra).toBe(25500);
  await expect(page.getByTestId("plan-reparto-res")).toContainText("Te faltan");
  await expect(page.getByTestId("plan-reparto-hoja").locator(".pm-aviso,[data-queda]")).toHaveCount(0);
});

test("una categoría con dinero en el plan nunca se cae de la suma: con Ahorro a 0 no sale su línea y sigue cuadrando", async ({ page }) => {
  await abrePlan(page, { ...base(3000), aportaciones: [] });
  await page.getByTestId("plan-reparto-chip").click();
  const x = await lee(page);
  expect(x.filas.map((f) => f.k)).toEqual(["rec", "deu", "met", "gas"]);
  expect(x.cifra).toBe(x.entra - x.filas.reduce((a, f) => a + f.c, 0));
});

test("el chip «Tu sueldo» de Recibos y tocar la cifra abren la MISMA hoja; «Ver banco a banco» ya no está y el detalle sigue en «¿Te llega?»", async ({ page }) => {
  await abrePlan(page, base(3000));
  await page.getByTestId("plan-reparto-chip").click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  const desdeLinea = await hoja.innerText();
  await hoja.locator(".rpt-sx").click();
  await expect(hoja).toHaveCount(0);
  await page.getByTestId("plan-cifras").click();
  await expect(hoja).toBeVisible();
  expect(await hoja.innerText()).toBe(desdeLinea);
  await expect(page.getByTestId("plan-mes-hoja")).toHaveCount(0);
  await expect(hoja).not.toContainText("Ver banco a banco");
  // El bloque «Lo que aún queda por pagar» ya no está en la hoja (25/11): esa información vive en «¿Te llega?».
  await expect(page.getByTestId("plan-reparto-pend")).toHaveCount(0);
  await expect(hoja).not.toContainText("Lo que aún queda por pagar");
  await hoja.locator(".rpt-sx").click();
  // El banco a banco se alcanza desde el chip de Recibos.
  await expect(page.getByTestId("plan-llega")).toBeVisible();
  await page.getByTestId("plan-llega").click();
  const llega = page.locator(".v4-sheet-back .v4-sheet").last();
  await expect(llega).toBeVisible();
  await expect(llega).toContainText("Tienes hoy");
  await expect(llega).toContainText("Recibos que faltan");
});

test("gastado por encima del presupuesto: Gastos cuenta lo gastado y la cascada sigue cuadrando", async ({ page }) => {
  await abrePlan(page, { ...base(3000), expenses: [nomina(3000), { ...gasto, amount: 1500 }] });
  const barra = page.getByTestId("plan-reparto-chip");
  await barra.click();
  const x = await lee(page);
  expect(x.filas.find((f) => f.k === "gas").c).toBe(150000);
  expect(x.cifra).toBe(x.entra - x.filas.reduce((a, f) => a + f.c, 0));
  expect(x.cifra).toBe(64500);
});

test("sin presupuesto el resultado dice «Libre hasta hoy», no «Te sobran»", async ({ page }) => {
  await abrePlan(page, { ...base(3000), budget: 0 });
  await page.getByTestId("plan-reparto-chip").click();
  await expect(page.getByTestId("plan-reparto-res")).toContainText("Libre hasta hoy");
});

test("una deuda con cuota de siete cifras no desaparece de la cascada ni descuadra: su línea sale entera, sin desbordar la hoja", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const gorda = { ...prestamo, id: "d9", name: "Préstamo enorme", value: 200_000_000, original: 200_000_000, monthly: 1_234_567.89, months: 160 };
  await abrePlan(page, { ...base(3000), debts: [gorda] });
  const barra = page.getByTestId("plan-reparto-chip");
  await barra.click();
  const x = await lee(page);
  const deu = x.filas.find((f) => f.k === "deu");
  expect(deu).toBeTruthy();
  expect(deu.c).toBe(123456789);
  expect(cts(deu.txt)).toBe(123456789);
  expect(x.signo).toBe(-1);
  expect(x.cifra).toBe(x.filas.reduce((a, f) => a + f.c, 0) - x.entra);
  // Nada se sale por el lado: ni la fila ni la cifra gigante del resultado.
  const sobra = await page.getByTestId("plan-reparto-hoja").evaluate((h) => {
    const w = h.getBoundingClientRect();
    return Array.from(h.querySelectorAll(".cas-row,.cas-am,.cas-nm,.cas-res b")).filter((e) => { const r = e.getBoundingClientRect(); return r.right > w.right + 1 || r.left < w.left - 1; }).length;
  });
  expect(sobra).toBe(0);
});

test("cambiar el presupuesto desde Inicio mueve la fila Gastos y «Te faltan»/«Te sobran»", async ({ page }) => {
  await abrePlan(page, base(1500));
  await page.getByTestId("plan-reparto-chip").click();
  const antes = await lee(page);
  const gasAntes = antes.filas.find((f) => f.k === "gas").c;
  await page.keyboard.press("Escape");
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await page.locator(".v4-budget").first().click();
  const hoja = page.locator(".v4-budget-sheet");
  await expect(hoja).toBeVisible();
  await hoja.getByRole("button", { name: "+", exact: true }).click();
  await hoja.getByRole("button", { name: "+", exact: true }).click();
  await hoja.locator(".v4-cta").click();
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.getByTestId("plan-reparto-chip").click();
  const despues = await lee(page);
  const gasDespues = despues.filas.find((f) => f.k === "gas").c;
  expect(gasDespues - gasAntes).toBe(10000);
  // El resultado se mueve igual de céntimos: entra − plan.
  const res = (x) => x.signo * x.cifra;
  expect(res(despues)).toBe(res(antes) - 10000);
});

test("cambiar el presupuesto con Mi ciclo y deuda que resta del presupuesto mueve la fila Gastos y «Te faltan»/«Te sobran»", async ({ page }) => {
  const e = base(1500); e.settings = { ...settings, budgetCycle: true }; e.debts = [{ ...prestamo, restarPres: true }]; e.budget = 1500;
  await abrePlan(page, e);
  await page.getByTestId("plan-reparto-chip").click();
  const antes = await lee(page);
  const gasAntes = antes.filas.find((f) => f.k === "gas").c;
  await page.keyboard.press("Escape");
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await page.locator(".v4-budget").first().click();
  const hoja = page.locator(".v4-budget-sheet");
  await expect(hoja).toBeVisible();
  await hoja.getByRole("button", { name: "+", exact: true }).click();
  await hoja.getByRole("button", { name: "+", exact: true }).click();
  await hoja.locator(".v4-cta").click();
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.getByTestId("plan-reparto-chip").click();
  const despues = await lee(page);
  const gasDespues = despues.filas.find((f) => f.k === "gas").c;
  expect(gasDespues - gasAntes).toBe(10000);
  // El resultado se mueve igual de céntimos: entra − plan.
  const res = (x) => x.signo * x.cifra;
  expect(res(despues)).toBe(res(antes) - 10000);
});

test("«Entran este mes» suma el sueldo y los ingresos reales del mes, sin contarlos dos veces", async ({ page }) => {
  const otro = { id: "o1", date: "2026-09-10T10:00:00.000Z", amount: -146.85, category: "bizum", merchant: "Bizum comida", ent: "sabadell", source: "manual" };
  // Presupuesto por encima del gasto: la fila Gastos vale el presupuesto y el ingreso cuenta entero.
  await abrePlan(page, { ...base(3000), expenses: [nomina(3000), gasto, otro] });
  await page.getByTestId("plan-reparto-chip").click();
  const a = await lee(page);
  expect(a.entra).toBe(300000 + 14685);
  expect(a.filas.find((f) => f.k === "gas").c).toBe(90000);
  await page.keyboard.press("Escape");
});

test("la fila Ahorro abre su edición y cambiarla mueve la cascada; Inicio edita la misma cifra", async ({ page }) => {
  await abrePlan(page, base(3000));
  await page.getByTestId("plan-reparto-chip").click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  const antes = await lee(page);
  await hoja.locator('.cas-row[data-k="aho"]').click();
  const det = page.getByTestId("plan-reparto-detalle");
  await expect(det.locator("[data-savings-plan]")).toBeVisible();
  await det.locator("[data-savings-edit]").click();
  const inp = det.locator('[data-savings-draft="a1"] input.num');
  await inp.fill("300");
  await det.locator("[data-savings-save]").click();
  await det.locator(".rpt-sback").click();
  const despues = await lee(page);
  expect(despues.filas.find((f) => f.k === "aho").c).toBe(30000);
  expect(despues.cifra * despues.signo).toBe(antes.cifra * antes.signo - 10000);
  await page.keyboard.press("Escape");
  // Inicio: la hoja del presupuesto lleva «Ahorro al mes» con la MISMA cifra (300) y al guardar cambia la lista única de aportaciones.
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await page.locator(".v4-budget").first().click();
  const bs = page.locator(".v4-budget-sheet");
  await expect(bs.getByTestId("budget-ahorro-val")).toContainText("300");
  await bs.getByRole("button", { name: "+ Ahorro al mes" }).click();
  await bs.locator(".v4-cta").click();
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("micartera_v3") || "{}").aportaciones || []).reduce((a, x) => a + x.amount, 0))).toBe(350);
});
