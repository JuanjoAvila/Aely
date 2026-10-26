import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra, gastosEstado, gastosPeriodo, gastosBajaAlDia, gastosAbreFiltros, gastosCierraFiltros } from "./fixtures.mjs";

/* GASTOS v5 · TANDA 1 (20/10/2026, docs/design/gastos-v5/SPEC.md §3, §4 y §11).
   Render puro derivado del estado: lo que `npm test` no ve (AGENTS §7). Cada prueba abre la
   pantalla de verdad y mira el DOM:
   · la cifra de arriba ES la tarjeta del mes de Inicio (misma fuente, mismos bancos);
   · al bajar, la cifra es lo gastado hasta el día que queda bajo la cabecera;
   · un mes cerrado nunca se compara con el límite de hoy;
   · los recibos salen sueltos y atenuados; cuotas, metas e inversiones, en su fila gris; nada de eso suma al día;
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

/* Su captura de la beta 4.26.164 (24/10), con la letra grande del sistema: «24/10 ·» y «Trade
   Republic» en dos líneas, un punto huérfano y la tarjeta el doble de alta. El WebView escala el
   TEXTO (textZoom) pero no las cajas: se imita multiplicando el tamaño de letra de cada nodo de la
   tarjeta, que es lo que hace Android. «fecha · banco» tiene que quedar en UNA línea (con puntos
   suspensivos si no cabe) y el importe entero, sin partirse. */
for (const zoom of [1.3, 1.6]) {
  test(`con la letra del sistema al ${Math.round(zoom * 100)} %, «fecha · banco» va en una línea y el importe no se parte`, async ({ page }) => {
    await abre(page, { expenses: [e("Amazon", "2026-09-26", 1239.59, "compras"), e("Barcelona Cooking Experience Sociedad Limitada", "2026-09-25", 44.22, "restaurantes")] });
    await aGastos(page);
    const tarjetas = gastosRoot(page).locator("button.v4-mov");
    await expect(tarjetas).toHaveCount(2);
    const medida = await tarjetas.evaluateAll((els, z) => els.map((card) => {
      // Primero se leen todos y luego se escriben: escribir sobre la marcha escalaría dos veces
      // a los hijos, que heredan el tamaño ya escalado del padre.
      const nodos = [...card.querySelectorAll("*")], tam = nodos.map((n) => parseFloat(getComputedStyle(n).fontSize));
      nodos.forEach((n, i) => { n.style.fontSize = tam[i] * z + "px"; });
      const meta = card.querySelector(".meta"), am = card.querySelector(".am");
      const lineas = (el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight === "normal" ? parseFloat(getComputedStyle(el).fontSize) * 1.25 : getComputedStyle(el).lineHeight));
      const tops = [...meta.children].map((c) => Math.round(c.getBoundingClientRect().top));
      const r = card.getBoundingClientRect(), ra = am.getBoundingClientRect();
      return { metaUnaLinea: Math.max(...tops) - Math.min(...tops) <= 2, amUnaLinea: lineas(am) <= 1, amDentro: ra.right <= r.right && ra.left >= r.left };
    }), zoom);
    for (const m of medida) expect(m).toEqual({ metaUnaLinea: true, amUnaLinea: true, amDentro: true });
  });
}

/* LOS RECIBOS VAN SUELTOS Y ATENUADOS; CUOTAS, METAS E INVERSIONES, AGRUPADAS (decisión suya,
   26/10/2026, con su captura de Gastos: «recibos grisáceo como está comunidad, y metas, deudas e
   inversiones agrupado»). Dos recibos del mismo día y del mismo banco que los gastos, más una cuota,
   una aportación a meta y otra a un bróker: los recibos son tarjetas atenuadas que dicen cuál son
   y abren su ficha; lo demás sigue en su bloque. Qué cuenta no cambia: el día 20 suma 30 y el mes 100. */
test("los recibos salen sueltos y atenuados; cuota, meta e inversión siguen en su fila gris; nada suma", async ({ page }) => {
  await abre(page, {
    fixed: [...base.fixed, { id: "gas", name: "Gas", amount: 5.75, freq: "mes", account: "trade_republic", day: 20 }],
    goals: [{ id: "viaje", name: "Viaje", emoji: "✈️", target: 1000, saved: 100, done: false, createdAt: "2026-08-01T10:00:00Z" }],
    expenses: [...expenses,
      e("PEPE ENERGY", "2026-09-20", 5.75, "recibos", { reciboId: "gas" }),
      e("TRASPASO HUCHA", "2026-09-20", 250, "otros", { goalId: "viaje" }),
      e("APORTACION MYINVESTOR", "2026-09-20", 300, "inversion")],
  });
  await aGastos(page);
  await expect(gastosCifra(page)).toHaveText("100,00 €");
  await expect(gastosEstado(page)).toHaveText("gastado en septiembre · 900 € por debajo");
  const dia20 = gastosRoot(page).locator('[data-gx-day="20260920"]');
  await expect(dia20.getByTestId("gastos-dia-total")).toHaveText("30,00 €");

  // Sin bloque de recibos: cada uno es su tarjeta atenuada, con el recibo que paga.
  await expect(dia20.locator('.gx-gris[data-gris="recibo"]')).toHaveCount(0);
  await expect(dia20).not.toContainText("Recibos · no cuentan");
  const endesa = dia20.locator("button.v4-mov").filter({ hasText: "ENDESA" }), pepe = dia20.locator("button.v4-mov").filter({ hasText: "PEPE ENERGY" });
  await expect(endesa).toHaveClass(/v4-mov-skip/);
  await expect(endesa).toContainText("Recibo: Luz");
  await expect(pepe).toHaveClass(/v4-mov-skip/);
  await expect(pepe).toContainText("Recibo: Gas");
  await expect(dia20.locator("button.v4-mov")).toHaveCount(3);
  await expect(dia20.locator("button.v4-mov.v4-mov-skip")).toHaveCount(2);

  // Cuota, meta e inversión siguen plegadas en su fila gris, cada una con su total.
  await expect(dia20.locator(".gx-gris")).toHaveCount(3);
  const deudas = dia20.locator('.gx-gris[data-gris="deuda"]'), metas = dia20.locator('.gx-gris[data-gris="meta"]'), inv = dia20.locator('.gx-gris[data-gris="inversion"]');
  await expect(deudas.locator(".gx-gris-h")).toContainText("Deudas · no cuentan");
  await expect(deudas.locator(".gx-gris-h")).toContainText("197,00 €");
  await expect(metas.locator(".gx-gris-h")).toContainText("Metas · no cuentan");
  await expect(metas.locator(".gx-gris-h")).toContainText("250,00 €");
  await expect(inv.locator(".gx-gris-h")).toContainText("Inversiones · no cuentan");
  await expect(inv.locator(".gx-gris-h")).toContainText("300,00 €");

  // Tocar un recibo abre su ficha, como la fila de cualquier otro movimiento (ahí vive «No es este recibo»).
  await pepe.click();
  await expect(page.locator(".v4-exp-sheet")).toBeVisible();
  await expect(page.locator('[data-testid="exp-recibo-marca"]')).toContainText("Gas");
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
  expect(grises).toBe(1);   // solo la cuota: los recibos van sueltos
  // Buscando no se agrupa: lo que buscas no puede quedar plegado.
  await gastosRoot(page).locator(".searchbar-in").fill("endesa");
  await expect(gastosRoot(page).locator("button.v4-mov")).toHaveCount(1);
  await expect(gastosRoot(page).locator(".gx-gris")).toHaveCount(0);
});

/* Su rechazo de la beta 4.26.164 (24/10): Gastos en Mi ciclo con vista balance, bajando hasta el
   final. La cabecera se encogía pero su fondo seguía bajando 36 px para una fila de meses que en
   Mi ciclo no existía: una franja vacía que tapaba la lista («no salen los meses ni nada»).
   Desde la tanda 6 Mi ciclo SÍ tiene su fila (la de ciclos), y desde el 25/10 sale al bajar como
   la de Meses: el fondo baja con ella y acaba justo donde acaba la fila, ni un píxel de franja. */
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
  // Un solo ciclo con su cobro (el del 24): la fila tiene su pastilla, marcada.
  await expect(gastosRoot(page).getByTestId("gastos-meses").locator(".gx-mes")).toHaveCount(1);
  await expect(gastosRoot(page).locator('.gx-mes[aria-pressed="true"]')).toHaveCount(1);
  /* La fila de ciclos acaba justo donde acaba el fondo (su `::before`): cualquier diferencia es una
     franja vacía encima de la lista. Se espera al final de la transición del fondo (200 ms). */
  await expect(gastosRoot(page).getByTestId("gastos-meses")).toHaveAttribute("aria-hidden", "false");
  await expect.poll(() => head.evaluate((h) => {
    const r = h.getBoundingClientRect(), b = parseFloat(getComputedStyle(h, "::before").bottom);
    const fila = h.querySelector('[data-testid="gastos-meses"]').getBoundingClientRect();
    return { franja: Math.round(r.bottom - b - fila.bottom) };
  }), { timeout: 3_000 }).toEqual({ franja: 0 });
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
  await expect(gastosEstado(page)).toHaveText("24 sep – 23 oct · 940 € por debajo");
  await expect(gastosRoot(page).getByTestId("gastos-desglose")).toHaveText("gastos 100,00 € · ingresos 40,00 €");
  // Su ayuda vive con el periodo, en Filtros (tanda 2): encima de la lista tapaba los movimientos.
  await expect(page.getByTestId("gastos-cycle-help")).toHaveCount(0);
  await gastosAbreFiltros(page);
  await expect(page.getByTestId("gastos-cycle-help")).toBeVisible();
  await gastosCierraFiltros(page);
  // Se puede salir a meses y volver a elegirlo desde Filtros.
  await gastosPeriodo(page, "months");
  await gastosAbreFiltros(page);
  await expect(page.getByTestId("gastos-cycle-help")).toHaveCount(0);
  await gastosCierraFiltros(page);
  await gastosPeriodo(page, "cycle");
  await expect(gastosCifra(page)).toHaveText("60,00 €");
  await expect(gastosEstado(page)).toHaveText("24 sep – 23 oct · 940 € por debajo");
});
