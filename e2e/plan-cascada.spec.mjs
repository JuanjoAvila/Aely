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
  await expect(page.getByTestId("plan-reparto-barra")).toBeVisible();
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

test("sobra dinero: las líneas suman el plan y entra − plan = «Te sobran», el mismo número que la cabecera", async ({ page }) => {
  await abrePlan(page, base(3000));
  const barra = page.getByTestId("plan-reparto-barra");
  const cab = cts(await barra.locator(".rpt-lb-a").innerText());
  await barra.click();
  const x = await lee(page);
  expect(x.filas.map((f) => f.k)).toEqual(["rec", "deu", "met", "aho", "gas"]);
  // Lo que se pinta es lo que se suma: cada importe del DOM = su céntimo, con signo menos.
  for (const f of x.filas) expect(cts(f.txt)).toBe(f.c);
  const plan = x.filas.reduce((a, f) => a + f.c, 0);
  expect(plan).toBe(9500 + 26000 + 30000 + 20000 + 90000);
  expect(x.entra).toBe(300000);
  expect(x.signo).toBe(1);
  expect(x.cifra).toBe(x.entra - plan);
  expect(x.cifra).toBe(cab);
  await expect(page.getByTestId("plan-reparto-res")).toContainText("Te sobran");
});

test("faltan dinero: «Te faltan» = plan − entra, igual que la cabecera, y sin bloque de aviso aparte", async ({ page }) => {
  await abrePlan(page, base(1500));
  const barra = page.getByTestId("plan-reparto-barra");
  await expect(barra).toContainText("Te faltan");
  const cab = cts(await barra.locator(".rpt-lb-a").innerText());
  await barra.click();
  const x = await lee(page);
  const plan = x.filas.reduce((a, f) => a + f.c, 0);
  expect(x.signo).toBe(-1);
  expect(x.cifra).toBe(plan - x.entra);
  expect(x.cifra).toBe(cab);
  expect(x.cifra).toBe(25500);
  await expect(page.getByTestId("plan-reparto-res")).toContainText("Te faltan");
  await expect(page.getByTestId("plan-reparto-hoja").locator(".pm-aviso,[data-queda]")).toHaveCount(0);
});

test("una categoría con dinero en el plan nunca se cae de la suma: con Ahorro a 0 no sale su línea y sigue cuadrando", async ({ page }) => {
  await abrePlan(page, { ...base(3000), aportaciones: [] });
  await page.getByTestId("plan-reparto-barra").click();
  const x = await lee(page);
  expect(x.filas.map((f) => f.k)).toEqual(["rec", "deu", "met", "gas"]);
  expect(x.cifra).toBe(x.entra - x.filas.reduce((a, f) => a + f.c, 0));
});

test("la línea de cabecera y la flecha de Recibos abren la MISMA hoja; «Ver banco a banco» ya no está y el detalle sigue en «¿Te llega?»", async ({ page }) => {
  await abrePlan(page, base(3000));
  await page.getByTestId("plan-reparto-barra").click();
  const hoja = page.getByTestId("plan-reparto-hoja");
  const desdeLinea = await hoja.innerText();
  await hoja.locator(".rpt-sx").click();
  await expect(hoja).toHaveCount(0);
  await page.getByTestId("plan-cifras").click();
  await expect(hoja).toBeVisible();
  expect(await hoja.innerText()).toBe(desdeLinea);
  await expect(page.getByTestId("plan-mes-hoja")).toHaveCount(0);
  await expect(hoja).not.toContainText("Ver banco a banco");
  // Sección secundaria con título inequívoco: queda por pagar, saldo y «te quedaría».
  const pend = page.getByTestId("plan-reparto-pend");
  await expect(pend).toContainText("Lo que aún queda por pagar este mes");
  await expect(pend).toContainText("Saldo en tus cuentas");
  await expect(pend).toContainText("Te quedaría");
  const v = await pend.locator(".rpt-kv b").allInnerTexts();
  expect(cts(v[1]) - cts(v[0])).toBe(cts(v[2]));
  await hoja.locator(".rpt-sx").click();
  // El banco a banco se alcanza desde el chip de Recibos.
  await expect(page.getByTestId("plan-llega")).toBeVisible();
  await page.getByTestId("plan-llega").click();
  await expect(page.locator(".v4-sheet-back .v4-sheet").last()).toBeVisible();
});

test("gastado por encima del presupuesto: Gastos cuenta lo gastado y la cascada sigue cuadrando con la cabecera", async ({ page }) => {
  await abrePlan(page, { ...base(3000), expenses: [nomina(3000), { ...gasto, amount: 1500 }] });
  const barra = page.getByTestId("plan-reparto-barra");
  const cab = cts(await barra.locator(".rpt-lb-a").innerText());
  await barra.click();
  const x = await lee(page);
  expect(x.filas.find((f) => f.k === "gas").c).toBe(150000);
  expect(x.cifra).toBe(x.entra - x.filas.reduce((a, f) => a + f.c, 0));
  expect(x.cifra).toBe(cab);
  expect(x.cifra).toBe(64500);
});

test("sin presupuesto el resultado dice «Libre hasta hoy», no «Te sobran»", async ({ page }) => {
  await abrePlan(page, { ...base(3000), budget: 0 });
  await page.getByTestId("plan-reparto-barra").click();
  await expect(page.getByTestId("plan-reparto-res")).toContainText("Libre hasta hoy");
});

test("una deuda con cuota de siete cifras no desaparece de la cascada ni descuadra: su línea sale entera, sin desbordar la hoja", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const gorda = { ...prestamo, id: "d9", name: "Préstamo enorme", value: 200_000_000, original: 200_000_000, monthly: 1_234_567.89, months: 160 };
  await abrePlan(page, { ...base(3000), debts: [gorda] });
  const barra = page.getByTestId("plan-reparto-barra");
  const cab = cts(await barra.locator(".rpt-lb-a").innerText());
  await barra.click();
  const x = await lee(page);
  const deu = x.filas.find((f) => f.k === "deu");
  expect(deu).toBeTruthy();
  expect(deu.c).toBe(123456789);
  expect(cts(deu.txt)).toBe(123456789);
  expect(x.signo).toBe(-1);
  expect(x.cifra).toBe(x.filas.reduce((a, f) => a + f.c, 0) - x.entra);
  expect(x.cifra).toBe(cab);
  // Nada se sale por el lado: ni la fila ni la cifra gigante del resultado.
  const sobra = await page.getByTestId("plan-reparto-hoja").evaluate((h) => {
    const w = h.getBoundingClientRect();
    return Array.from(h.querySelectorAll(".cas-row,.cas-am,.cas-nm,.cas-res b")).filter((e) => { const r = e.getBoundingClientRect(); return r.right > w.right + 1 || r.left < w.left - 1; }).length;
  });
  expect(sobra).toBe(0);
});
