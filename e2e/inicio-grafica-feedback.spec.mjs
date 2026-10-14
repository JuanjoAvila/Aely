import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { seedLoggedInDashboard, dismissNews, estadoHeredado } from "./fixtures.mjs";

/* Feedback del dueño sobre la gráfica de Inicio (13/10, beta 4.26.123), cinco quejas:
   hueco entre la línea y el punto de hoy, rojo a mitad de ciclo con el presupuesto sin agotar,
   sólo «Todo» con histórico desde junio, texto fijo bajo la gráfica y una «i» enorme.
   Se abre Inicio de verdad, en viewport de móvil, con la cartera heredada del incidente. */
test.use({ viewport: { width: 412, height: 915 } });

async function abrir(page, state, lang = "es") {
  await page.clock.install({ time: new Date("2026-10-13T12:00:00Z") });
  await seedLoggedInDashboard(page, { __seedOnce: true, ...state, settings: { ...state.settings, lang } });
  await page.goto("/"); await page.waitForFunction(() => !document.getElementById("mc-load")); await dismissNews(page);
  const hero = page.getByTestId("inicio-net-current");
  await expect(hero.locator(".v42-net-line")).toHaveCount(1);
  return hero;
}
/* Filas de la hoja «Cómo se calcula»: [etiqueta, dato]. La fecha corta sale del mismo Intl que la app. */
const filas = (page) => page.locator('[data-sheet="net-info"] .row').evaluateAll((els) => els.map((e) => [e.querySelector(".rname").textContent, e.querySelector(".rval").textContent]));
const fechaCorta = (day, lang) => new Intl.DateTimeFormat({ es: "es", en: "en-GB", ca: "ca" }[lang], { timeZone: "Europe/Madrid", day: "numeric", month: "short" }).format(Date.parse(day + "T12:00:00Z"));
/* Color real de una variable CSS, para comparar con lo pintado sin fijar un hexadecimal en el test. */
const cssColor = (page, name) => page.evaluate((name) => { const probe = document.createElement("span"); probe.style.color = "var(--" + name + ")"; document.body.appendChild(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; }, name);

/* Un usuario que cobra, gasta y aporta: `spend` al día desde el 1/6. Con 110 €/día se funde la nómina. */
function ciclo(spend) {
  const expenses = [], invHistory = []; let acc = 0;
  for (let ms = Date.parse("2026-03-01T12:00:00Z"); ms <= Date.parse("2026-10-13T12:00:00Z"); ms += 864e5) {
    const day = new Date(ms).toISOString().slice(0, 10), d = Number(day.slice(8));
    if (d === 28) expenses.push({ id: "pay-" + day, date: day + "T09:00:00Z", amount: -2400, merchant: "Nómina sintética", category: "ingreso", ent: "sabadell" });
    if (d === 5) { expenses.push({ id: "inv-" + day, date: day + "T09:00:00Z", amount: 300, category: "inversion", ent: "sabadell", merchant: "Aportación sintética" }); acc += 300; }
    expenses.push({ id: "spend-" + day, date: day + "T12:00:00Z", amount: spend, category: "super", ent: "sabadell", merchant: "Compra sintética" });
    invHistory.push({ d: day, v: acc });
  }
  return { budget: 1500, settings: { autoPrices: false, theme: "green", budgetCycle: true }, expenses, invHistory,
    accounts: [{ id: "a", ent: "sabadell", name: "Cuenta sintética", value: 3000, role: "diario", spendFrom: true, bankIban: "ES-SYNTHETIC-CYCLE" }],
    investments: [{ id: "fund", ent: "trade_republic", name: "Fondo sintético", value: acc }], assets: [], debts: [], fixed: [], flows: [], oneoffs: [], goals: [], shared: [], onboarded: true };
}

test("la línea llega hasta el punto de hoy: sin hueco al final", async ({ page }, testInfo) => {
  const hero = await abrir(page, estadoHeredado("2026-10-13"));
  // Deja terminar la animación de revelado (1,1 s) y el punto (1,5 s) antes de mirar píxeles.
  await page.waitForTimeout(2200);
  const svg = hero.locator(".v42-net-chart svg");
  const geo = await svg.evaluate((el) => {
    const box = el.getBoundingClientRect(), d = el.querySelector(".v42-net-line").getAttribute("d");
    const last = d.trim().split(/[ML]/).filter(Boolean).at(-1).trim().split(" ").map(Number), dot = el.querySelector(".v42-net-dot");
    return { x: box.left + last[0] / 320 * box.width, y: box.top + last[1] / 80 * box.height, w: box.width, dotCx: Number(dot.getAttribute("cx")), lastX: last[0], lastY: last[1] };
  });
  expect(geo.dotCx).toBe(geo.lastX);
  const png = PNG.sync.read(await page.screenshot({ animations: "disabled" }));
  // La captura va a la escala del dispositivo emulado (Pixel 5 = 2,75×): las coordenadas CSS se escalan.
  const k = png.width / page.viewportSize().width;
  const at = (x, y) => { const i = (Math.round(y * k) * png.width + Math.round(x * k)) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
  const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const fondo = at(geo.x - 12, geo.y - 22);
  // Justo a la izquierda del punto de hoy tiene que haber línea: en el móvil del dueño faltaba
  // el último 10 % (stroke-dasharray con pathLength y trazo sin escalar en un SVG estirado).
  for (const dx of [8, 14, 20]) {
    const column = [-2, -1, 0, 1, 2].map((dy) => diff(at(geo.x - dx, geo.y + dy), fondo));
    expect(Math.max(...column), "línea pintada " + dx + " px antes del punto").toBeGreaterThan(60);
  }
  await testInfo.attach("inicio-sin-hueco", { body: PNG.sync.write(png), contentType: "image/png" });
});

for (const lang of ["es", "en", "ca"]) test("histórico desde junio: 1M y 3M, sin texto fijo y la i en tres líneas " + lang, async ({ page }) => {
  const hero = await abrir(page, estadoHeredado("2026-10-13"), lang);
  await expect(hero.locator(".v42-net-ranges button")).toHaveText({ es: ["1M", "3M", "Todo"], en: ["1M", "3M", "All"], ca: ["1M", "3M", "Tot"] }[lang]);
  await expect(hero.locator(".v42-net-ranges button").first()).toHaveAttribute("aria-pressed", "true");
  await expect(hero.locator(".hint")).toHaveCount(0);
  await expect(hero.getByTestId("inicio-net-coverage")).toHaveCount(0);
  // Cobra el día 1, gasta por debajo del presupuesto y paga la hipoteca: nunca en rojo.
  const delta = hero.getByTestId("inicio-net-delta");
  await expect(delta).toHaveAttribute("data-verdict", /^(up|flat)$/);
  await expect(delta).toContainText({ es: "más que el mes pasado", en: "more than last month", ca: "més que el mes passat" }[lang]);
  await expect(delta).not.toContainText({ es: "menos", en: "less", ca: "menys" }[lang]);
  const verdict = await delta.getAttribute("data-verdict");
  expect(await hero.locator(".v42-net-chart svg").evaluate((el) => getComputedStyle(el).color)).toBe(await cssColor(page, verdict === "up" ? "mint" : "blue"));
  // La «i» abre una hoja: la página no cambia de altura ni la tarjeta del ciclo se mueve.
  const antes = await page.evaluate(() => [document.documentElement.scrollHeight, document.querySelector(".v42-cycle-section").getBoundingClientRect().top]);
  await hero.locator(".v42-net-info").click();
  const sheet = page.getByRole("dialog", { name: { es: "Cómo se calcula", en: "How it's worked out", ca: "Com es calcula" }[lang] });
  await expect(sheet).toBeVisible();
  expect(await page.evaluate(() => [document.documentElement.scrollHeight, document.querySelector(".v42-cycle-section").getBoundingClientRect().top])).toEqual(antes);
  expect(await filas(page)).toEqual({
    es: [["Cuentas", "movimientos reales desde " + fechaCorta("2026-06-15", "es")], ["Inversiones, bienes y cuentas manuales", "valor conocido mantenido"], ["Deudas", "según sus cuotas; las cuotas sin tipo de interés se cuentan enteras como capital"], ["Comparación", "frente al mismo día del mes pasado"]],
    en: [["Accounts", "real transactions from " + fechaCorta("2026-06-15", "en")], ["Investments, property and manual accounts", "known value kept"], ["Debts", "by their payment schedule; payments with no interest rate count in full as capital"], ["Comparison", "against the same day last month"]],
    ca: [["Comptes", "moviments reals des de " + fechaCorta("2026-06-15", "ca")], ["Inversions, béns i comptes manuals", "valor conegut mantingut"], ["Deutes", "segons les seves quotes; les quotes sense tipus d\'interès es compten senceres com a capital"], ["Comparació", "davant del mateix dia del mes passat"]] }[lang]);
  expect(await page.evaluate(() => document.activeElement && document.activeElement.closest('[data-sheet="net-info"]') != null)).toBe(true);
  // Ninguna fila se sale de la hoja ni se corta.
  expect(await sheet.evaluate((el) => [...el.querySelectorAll(".row")].every((r) => r.scrollWidth <= r.clientWidth + 1 && r.getBoundingClientRect().right <= el.getBoundingClientRect().right))).toBe(true);
  await sheet.getByRole("button", { name: { es: "Entendido", en: "Got it", ca: "Entesos" }[lang] }).click();
  await expect(sheet).toHaveCount(0);
  await hero.locator(".v42-net-info").click(); await expect(sheet).toBeVisible();
  await page.mouse.click(10, 60); await expect(sheet).toHaveCount(0);
});

// Una siembra por test: dos `seedLoggedInDashboard` en la misma página se pisan (el primero gana).
// La cifra es hoy (13/10) frente al mismo día de hace un mes (13/9): una nómina y 30 días de
// gasto; 3M, frente al 13/7: tres nóminas y 92 días. Los extremos que se ven en la gráfica.
for (const [spend, verdict, tone, word, mes, tres] of [[30, "up", "mint", "más", "1.500", "4.440"], [110, "down", "coral", "menos", "900", "2.920"]]) test("rojo sólo si se come la nómina (" + spend + " €/día → " + verdict + "); la línea sigue el mismo veredicto", async ({ page }) => {
  const hero = await abrir(page, ciclo(spend));
  const delta = hero.getByTestId("inicio-net-delta");
  await expect(delta).toHaveAttribute("data-verdict", verdict);
  await expect(delta).toHaveText(mes + " € " + word + " que el mes pasado");
  expect(await delta.evaluate((el) => getComputedStyle(el).color)).toBe(await cssColor(page, tone));
  expect(await hero.locator(".v42-net-chart svg").evaluate((el) => getComputedStyle(el).color)).toBe(await cssColor(page, tone));
  // Con 3M compara con tres meses de calendario atrás y lo dice.
  await hero.locator(".v42-net-ranges button").nth(1).click();
  await expect(delta).toHaveText(tres + " € " + word + " que hace 3 meses");
  // La hoja dice con qué día se compara el periodo elegido.
  await hero.locator(".v42-net-info").click();
  expect((await filas(page)).at(-1)).toEqual(["Comparación", "frente al mismo día de hace 3 meses"]);
});

test("usuario nuevo: ni veredicto, ni periodos, ni líneas en la i", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-13T12:00:00Z") });
  await seedLoggedInDashboard(page, { accounts: [], obAccounts: [], investments: [], assets: [], debts: [], expenses: [], budget: 0, invHistory: [], accountBalanceHistory: {} });
  await page.goto("/"); await page.waitForFunction(() => !document.getElementById("mc-load")); await dismissNews(page);
  const hero = page.getByTestId("inicio-net-current");
  await expect(hero).toContainText("Tu histórico empieza hoy");
  await expect(hero.getByTestId("inicio-net-delta")).toHaveCount(0);
  await expect(hero.locator(".v42-net-ranges button")).toHaveCount(0);
  await expect(hero.locator("svg")).toHaveCount(0);
  // Sin nada que explicar, la «i» no se enseña.
  await expect(hero.locator(".v42-net-info")).toHaveCount(0);
});

test("sin bancos: una hucha con cierres y un piso tienen gráfica, sin veredicto inventado", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-13T12:00:00Z") });
  await seedLoggedInDashboard(page, { __seedOnce: true, accounts: [{ id: "hucha", ent: "efectivo", name: "Hucha", value: 500, role: "fijos" }], obAccounts: [], investments: [], invHistory: [],
    assets: [{ id: "home", name: "Piso sintético", kind: "piso", value: 100000 }], debts: [], expenses: [], budget: 0, accountBalanceHistory: { "acc:hucha": [{ day: "2026-09-20", value: 400 }, { day: "2026-10-13", value: 500 }] } });
  await page.goto("/"); await page.waitForFunction(() => !document.getElementById("mc-load")); await dismissNews(page);
  const hero = page.getByTestId("inicio-net-current");
  await expect(hero.locator(".v4-hero-amt")).toContainText("100.500,00 €");
  await expect(hero.locator(".v42-net-line")).toHaveCount(1);
  await expect(hero.locator(".v42-net-ranges button")).toHaveText(["Todo"]);
  await expect(hero.getByTestId("inicio-net-delta")).toHaveAttribute("data-verdict", "none");
  await hero.locator(".v42-net-info").click();
  // La hucha arranca la gráfica con su primer cierre: no hay «antes» que declarar; los bienes sí.
  expect(await filas(page)).toEqual([["Cuentas", "movimientos reales desde " + fechaCorta("2026-09-20", "es")], ["Bienes", "valor conocido mantenido"]]);
});
