import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra, gastosEstado, gastosPeriodo, gastosBajaAlDia } from "./fixtures.mjs";

/* GASTOS v5 · TANDA 1 (20/10/2026, docs/design/gastos-v5/SPEC.md §3, §4 y §11).
   Render puro derivado del estado: lo que `npm test` no ve (AGENTS §7). Cada prueba abre la
   pantalla de verdad y mira el DOM:
   · la cifra de arriba ES la tarjeta del mes de Inicio (misma fuente, mismos bancos);
   · al bajar, la cifra es lo gastado hasta el día que queda bajo la cabecera;
   · un mes cerrado nunca se compara con el límite de hoy;
   · recibos y cuotas del banco salen agrupados en una fila gris que no suma al día;
   · reagrupar no pierde ninguna fila de las que la lista enseñaba;
   · Mi ciclo sigue elegible y su cifra es la de Inicio en modo ciclo.
   El reloj es el de las fixtures: 26/9/2026 a mediodía. */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

const e = (id, ymd, amount, category, extra = {}) => ({ id, date: ymd + "T12:00:00Z", amount, category, merchant: id, source: "ob", ent: "trade_republic", ...extra });
const base = {
  budget: 1000,
  settings: { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["trade_republic"] },
  accounts: [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 3000, role: "diario", spendFrom: true }],
  fixed: [{ id: "luz", name: "Luz", amount: 62, freq: "mes", account: "trade_republic", day: 20 }],
  debts: [{ id: "coche", ent: "familia", name: "Préstamo coche", value: 5000, original: 9000, monthly: 197, day: 20, account: "trade_republic" }],
};
// Septiembre: 20 + 15 + 30 + 35 = 100 que cuentan. El recibo y la cuota del 20 salen, no suman.
// Agosto: 140. Julio: 50 (+5 del 28 de junio, que hace que julio esté ENTERO en el histórico).
const expenses = [
  e("Hoy super", "2026-09-26", 20, "super"), e("Bar ayer", "2026-09-25", 15, "restaurantes"),
  e("Compra del 20", "2026-09-20", 30, "compras"),
  e("ENDESA", "2026-09-20", 62, "recibos", { reciboId: "luz" }),
  e("PRESTAMO COCHE", "2026-09-20", 197, "deudas", { debtId: "coche" }),
  e("Super del 10", "2026-09-10", 35, "super"),
  e("Agosto 30", "2026-08-30", 40, "super"), e("Agosto 15", "2026-08-15", 100, "compras"),
  e("Julio 10", "2026-07-10", 50, "super"), e("Junio 28", "2026-06-28", 5, "super"),
];

async function abre(page, overrides = {}) {
  await seedLoggedInDashboard(page, { ...base, expenses, ...overrides });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}
async function aGastos(page) {
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
}

test("la cifra de arriba es la tarjeta del mes de Inicio, y su margen el mismo", async ({ page }) => {
  await abre(page);
  // Inicio: 1000 de presupuesto, 100 gastados → quedan 900.
  await expect(page.locator(".v4-budget .v42-cycle-amount>.serif")).toHaveText("900 €");
  await aGastos(page);
  await expect(gastosCifra(page)).toHaveText("100,00 €");
  await expect(gastosEstado(page)).toHaveText("gastado en septiembre · 900 € por debajo");
  await expect(gastosEstado(page).locator(".gx-tone-mint")).toHaveCount(1);
  // La línea de cada día suma lo que cuenta: el 20 son 30 €, sin el recibo (62) ni la cuota (197).
  const dia20 = gastosRoot(page).locator('[data-gx-day="20260920"]');
  await expect(dia20.getByTestId("gastos-dia-total")).toHaveText("30,00 €");
});

test("al bajar, la cifra es lo gastado hasta el día que queda debajo; un mes cerrado no mira el límite", async ({ page }) => {
  await abre(page);
  await aGastos(page);
  await gastosBajaAlDia(page, "2026-09-20");
  await expect(gastosEstado(page)).toHaveText("gastado en septiembre hasta el 20");
  await expect(gastosCifra(page), "10 (35) + 20 (30)").toHaveText("65,00 €");
  await expect(gastosRoot(page).locator(".gx-head")).toHaveClass(/compact/);
  // Los meses aparecen fijos al bajar, con septiembre marcado.
  await expect(gastosRoot(page).locator('.gx-mes[aria-pressed="true"]')).toHaveText("septiembre");

  await gastosBajaAlDia(page, "2026-08-30");
  await expect(gastosCifra(page)).toHaveText("140,00 €");
  // Agosto contra julio entero (el histórico empieza el 28 de junio), NUNCA contra el límite de hoy.
  await expect(gastosEstado(page)).toHaveText("agosto · cerrado · 90 € más que en julio");
  await expect(gastosEstado(page)).not.toContainText(/por debajo|por encima/);
  await expect(gastosRoot(page).locator('.gx-mes[aria-pressed="true"]')).toHaveText("agosto");

  await gastosBajaAlDia(page, "2026-07-10");
  // Julio no se compara: junio no está entero en el histórico.
  await expect(gastosEstado(page)).toHaveText("julio · cerrado");
  await expect(gastosCifra(page)).toHaveText("50,00 €");
});

test("tocar un mes salta a su primer día", async ({ page }) => {
  await abre(page);
  await aGastos(page);
  await gastosBajaAlDia(page, "2026-09-25");
  await gastosRoot(page).locator('.gx-mes[data-ym="2026-08"]').click();
  await expect(gastosEstado(page)).toHaveText("agosto · cerrado · 90 € más que en julio");
  await gastosRoot(page).locator('.gx-mes[data-ym="2026-09"]').click();
  await expect(gastosEstado(page)).toHaveText("gastado en septiembre · 900 € por debajo");
});

test("recibo y cuota del banco salen agrupados en filas grises que no suman y se despliegan", async ({ page }) => {
  await abre(page);
  await aGastos(page);
  const dia20 = gastosRoot(page).locator('[data-gx-day="20260920"]');
  const recibos = dia20.locator('.gx-gris[data-gris="recibo"]'), deudas = dia20.locator('.gx-gris[data-gris="deuda"]');
  await expect(recibos.locator(".gx-gris-h")).toContainText("Recibos · no cuentan");
  await expect(recibos.locator(".gx-gris-h")).toContainText("62,00 €");
  await expect(deudas.locator(".gx-gris-h")).toContainText("Deudas · no cuentan");
  await expect(deudas.locator(".gx-gris-h")).toContainText("197,00 €");
  // Agrupadas: no son tarjetas sueltas del día.
  await expect(dia20.locator("button.v4-mov")).toHaveCount(1);
  // Cerrada no deja tocar nada de dentro; abierta enseña el cargo y la salida a Plan.
  await expect(recibos.locator(".gx-gris-it")).toBeHidden();
  await recibos.locator(".gx-gris-h").click();
  await expect(recibos.locator(".gx-gris-h")).toHaveAttribute("aria-expanded", "true");
  await expect(recibos.locator(".gx-gris-it")).toBeVisible();
  await expect(recibos.locator(".gx-gris-it")).toContainText("ENDESA");
  await expect(recibos.locator(".gx-gris-it")).toContainText("Luz");
  // El cargo sigue abriendo su ficha (ahí vive «No es este recibo»).
  await recibos.locator(".gx-gris-it").click();
  await expect(page.locator(".v4-exp-sheet")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await expect(page.locator(".v4-exp-sheet")).toHaveCount(0);
  await recibos.locator(".gx-gris-plan").click();
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
  await expect(page.locator('.page-scroll-host .v4-seg-btn.on')).toContainText("Recibos");
});

test("«Abrir en Plan · Deudas» lleva al segmento Deudas", async ({ page }) => {
  await abre(page);
  await aGastos(page);
  const deudas = gastosRoot(page).locator('[data-gx-day="20260920"] .gx-gris[data-gris="deuda"]');
  await deudas.locator(".gx-gris-h").click();
  await expect(deudas.locator(".gx-gris-it")).toContainText("Préstamo coche");
  await deudas.locator(".gx-gris-plan").click();
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
  await expect(page.locator('.page-scroll-host .v4-seg-btn.on')).toContainText("Deudas");
});

test("reagrupar no pierde ninguna fila: tarjetas + cargos de las filas grises = todos los movimientos", async ({ page }) => {
  await abre(page);
  await aGastos(page);
  await expect(gastosRoot(page).locator(".gx-fin")).toContainText("Hasta aquí");
  const tarjetas = await gastosRoot(page).locator("button.v4-mov").count();
  const grises = await gastosRoot(page).locator(".gx-gris-it").count();
  expect(tarjetas + grises).toBe(expenses.length);
  expect(grises).toBe(2);
  // Buscando no se agrupa: lo que buscas no puede quedar plegado.
  await gastosRoot(page).locator(".searchbar-in").fill("endesa");
  await expect(gastosRoot(page).locator("button.v4-mov")).toHaveCount(1);
  await expect(gastosRoot(page).locator(".gx-gris")).toHaveCount(0);
});

/* Su rechazo de la beta 4.26.164 (24/10): Gastos en Mi ciclo con vista balance, bajando hasta el
   final. La cabecera se encogía pero su fondo seguía bajando 36 px para una fila de meses que en
   Mi ciclo no existe: una franja vacía que tapaba la lista («no salen los meses ni nada»). Sin
   fila de meses, lo que hay justo debajo de la cabecera encogida tiene que ser la lista. */
test("Mi ciclo al bajar hasta el final: cabecera encogida sin franja vacía debajo", async ({ page }) => {
  const cycle = [
    e("Antes de cobrar", "2026-09-20", 200, "super"),
    e("Nómina", "2026-09-24", -2000, "ingreso", { merchant: "Nómina" }),
    e("Cena", "2026-09-25", 100, "restaurantes"),
    e("ENDESA", "2026-09-25", 62, "recibos", { reciboId: "luz" }),
    e("Bizum recibido", "2026-09-25", -40, "ingreso"),
    e("Café", "2026-09-26", 3, "restaurantes"),
  ];
  await abre(page, { expenses: cycle, settings: { ...base.settings, budgetCycle: true, gTotalMode: "net" } });
  await aGastos(page);
  await expect(gastosRoot(page)).toHaveAttribute("data-periodo", "cycle");
  await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); h.scrollTo(0, h.scrollHeight); });
  const head = gastosRoot(page).locator(".gx-head");
  await expect(head).toHaveClass(/compact/);
  await expect(gastosRoot(page).getByTestId("gastos-meses")).toHaveCount(0);
  /* El fondo (su `::before`) no puede bajar de la caja de la cabecera: sin fila de meses que
     tapar, cualquier alargamiento es una franja vacía encima de la lista. Y tampoco puede quedarse
     hasta el borde de la caja: encogidas la cifra y la línea suben, y lo que quedaba debajo de
     ellas era la otra mitad del hueco. Se espera al final de la transición del fondo (200 ms). */
  await expect.poll(() => head.evaluate((h) => {
    const r = h.getBoundingClientRect(), b = parseFloat(getComputedStyle(h, "::before").bottom);
    const linea = h.querySelector('[data-testid="gastos-desglose"]') || h.querySelector('[data-testid="gastos-estado"]');
    const finTexto = linea.getBoundingClientRect().bottom, finFondo = r.bottom - b;
    return { fondoNoBaja: b >= 0, huecoBajoTexto: Math.round(finFondo - finTexto) };
  }), { timeout: 3_000 }).toEqual({ fondoNoBaja: true, huecoBajoTexto: 8 });
});

test("Mi ciclo sigue elegible y su cifra es la de Inicio en modo ciclo", async ({ page }) => {
  // Presupuesto por ciclo: Inicio mira desde la nómina del 24; Gastos arranca ahí.
  const cycle = [
    e("Antes de cobrar", "2026-09-20", 200, "super"),
    e("Nómina", "2026-09-24", -2000, "ingreso", { merchant: "Nómina" }),
    e("Cena", "2026-09-25", 100, "restaurantes"),
    e("Bizum recibido", "2026-09-25", -40, "ingreso"),
  ];
  await abre(page, { expenses: cycle, settings: { ...base.settings, budgetCycle: true } });
  // Inicio en ciclo: neto 100 − 40 = 60 → quedan 940 de 1000.
  await expect(page.locator(".v42-cycle-head>span")).toHaveText("Este ciclo");
  await expect(page.locator(".v4-budget .v42-cycle-amount>.serif")).toHaveText("940 €");
  await aGastos(page);
  await expect(gastosRoot(page)).toHaveAttribute("data-periodo", "cycle");
  await expect(gastosCifra(page)).toHaveText("60,00 €");
  await expect(gastosEstado(page)).toHaveText("en tu ciclo · 940 € por debajo");
  await expect(gastosRoot(page).getByTestId("gastos-desglose")).toHaveText("gastos 100,00 € · ingresos 40,00 €");
  await expect(gastosRoot(page).getByTestId("gastos-cycle-help")).toBeVisible();
  // Se puede salir a meses y volver a elegirlo desde Filtros.
  await gastosPeriodo(page, "months");
  await expect(gastosRoot(page).getByTestId("gastos-cycle-help")).toHaveCount(0);
  await gastosPeriodo(page, "cycle");
  await expect(gastosCifra(page)).toHaveText("60,00 €");
  await expect(gastosEstado(page)).toHaveText("en tu ciclo · 940 € por debajo");
});
