import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra, gastosEstado, gastosSeccion, gastosPulsaLarga } from "./fixtures.mjs";

/* GASTOS v5 · TANDA 2 (SPEC §2.1, §2.2, §5, §6 y §9). Las tres secciones de Gastos: Movimientos,
   Categorías y Suscripciones. Render puro derivado del estado (AGENTS §7): cada prueba abre la
   pantalla de verdad y mira el DOM.
   · iconos con su pestaña activa y el globito de las suscripciones por revisar;
   · el tirón de Plan, arriba del todo, recorre Movimientos → Categorías → Suscripciones →
     Movimientos; a mitad de lista es scroll normal;
   · un solo toque de vibración por cambio, sea por icono o por tirón;
   · Categorías enseña el desglose de antes (mismas cifras) con la barra del presupuesto;
   · Suscripciones enseña las detectadas como estaban, o «Todo en orden».
   El reloj es el de las fixtures: 26/9/2026 a mediodía. */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

const e = (id, ymd, amount, category, extra = {}) => ({ id, date: ymd + "T12:00:00Z", amount, category, merchant: id, source: "ob", ent: "trade_republic", ...extra });
const base = {
  budget: 1000,
  categoryBudgets: { super: 50 },
  settings: { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["trade_republic"] },
  accounts: [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 3000, role: "diario", spendFrom: true }],
};
// Septiembre: super 20 + 35 = 55 (límite 50), compras 30, bares 15 → 100 que cuentan.
// Muchos días más atrás para que la lista tenga scroll de verdad.
const expenses = [
  e("Hoy super", "2026-09-26", 20, "super"), e("Bar ayer", "2026-09-25", 15, "bares"),
  e("Compra del 20", "2026-09-20", 30, "compras"), e("Super del 10", "2026-09-10", 35, "super"),
  ...Array.from({ length: 40 }, (_, i) => e("Agosto " + i, "2026-08-" + String(1 + (i % 28)).padStart(2, "0"), 5 + i, "compras")),
];
// Un comercio que cobra lo mismo cuatro meses seguidos = suscripción detectada.
const subs = ["2026-06-14", "2026-07-14", "2026-08-14", "2026-09-14"].map((d, i) =>
  ({ id: "nf" + i, date: d + "T12:00:00Z", amount: 12.99, category: "ocio", merchant: "Netflix", source: "ob", ent: "trade_republic" }));

async function abre(page, overrides = {}, motor = false) {
  if (motor) {
    // El motor de vibración es un doble que apunta cada llamada (como ux16-round9-haptics):
    // el navegador no puede acreditar la sensación, sí cuántas veces se pide.
    await page.addInitScript(() => {
      window.__vib = [];
      window.Capacitor = { Plugins: { AelyHaptics: {
        edge(p) { window.__vib.push(p); return Promise.resolve({ tunable: true, shaped: true, amplitudeControl: true }); },
        fill(p) { window.__vib.push(p); return Promise.resolve({}); } } } };
    });
  }
  await seedLoggedInDashboard(page, { ...base, expenses, ...overrides });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
  // El carrusel tiene que haber llegado: un dedo de verdad no arrastra a mitad de la transición.
  await page.waitForFunction(() => {
    const tr = document.querySelector(".track"); if (!tr) return false;
    const v = getComputedStyle(tr).transform, q = window.__trQuieto;
    window.__trQuieto = { v, n: q && q.v === v ? q.n + 1 : 0 };
    return window.__trQuieto.n >= 3;
  }, null, { timeout: 10_000, polling: "raf" });
}
const seccion = (page) => gastosRoot(page).getAttribute("data-secc");
const tab = (page, id) => gastosRoot(page).locator(`[role="tab"][data-gx-tab="${id}"]`);
const panel = (page, id) => gastosRoot(page).locator(`[data-gx-secc="${id}"]`);

async function tiron(page, { y0 = 330, dy = 220, pasos = 10 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y: y0 + (dy * i) / pasos }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("tres iconos de sección: Movimientos activo al entrar, cada uno con su nombre", async ({ page }) => {
  await abre(page);
  const lista = gastosRoot(page).locator('[role="tablist"]');
  await expect(lista).toHaveAttribute("aria-label", "Secciones de Gastos");
  await expect(lista.locator('[role="tab"]')).toHaveCount(3);
  await expect(tab(page, "movs")).toHaveAttribute("aria-selected", "true");
  await expect(tab(page, "movs")).toHaveAttribute("aria-label", "Movimientos");
  await expect(tab(page, "cats")).toHaveAttribute("aria-label", "Categorías");
  await expect(tab(page, "subs")).toHaveAttribute("aria-label", "Suscripciones");
  // Sin suscripciones por revisar no hay globito.
  await expect(gastosRoot(page).getByTestId("gastos-subs-globo")).toHaveCount(0);
  await expect(panel(page, "movs")).toHaveAttribute("aria-hidden", "false");
  await expect(panel(page, "cats")).toHaveAttribute("aria-hidden", "true");
  // Buscador y lista solo en Movimientos.
  await expect(panel(page, "movs").locator(".searchbar-in")).toBeVisible();
  await expect(panel(page, "movs").locator("button.v4-mov").first()).toBeVisible();
});

/* Captura suya de la beta 4.26.164 (24/10, Mi ciclo + balance): encima de la lista se apilaban la
   ayuda de Mi ciclo, «12 categorías · Mi ciclo ▸ Ver» y «Actualizar gastos» con su texto y su hora,
   y la lista no mandaba. Ahora arriba solo hay cabecera, buscador con Filtros y lista; la ayuda
   vive en Filtros → Periodo, el desglose en Categorías y «Actualizar gastos» al final. */
test("en Mi ciclo, entre la cabecera y la lista solo está el buscador; nada se pierde", async ({ page }) => {
  await abre(page, { settings: { ...base.settings, budgetCycle: true, gTotalMode: "net" },
    expenses: expenses.concat([e("Nómina", "2026-09-24", -2000, "ingreso", { merchant: "Nómina" })]) });
  await expect(gastosRoot(page)).toHaveAttribute("data-periodo", "cycle");
  const movs = panel(page, "movs");
  const orden = await movs.evaluate((p) => {
    const lista = p.querySelector(".gx-list"), pie = p.querySelector(".gx-pie");
    const antes = [...p.querySelectorAll(".v4-cycle-box, .v4-gastos-cat, .action-row, .sync-note")]
      .filter((el) => lista.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING).length;
    return { antes, pieTrasLista: !!(lista.compareDocumentPosition(pie) & Node.DOCUMENT_POSITION_FOLLOWING), syncEnPie: !!pie.querySelector(".action-row .btn") };
  });
  expect(orden).toEqual({ antes: 0, pieTrasLista: true, syncEnPie: true });
  // La primera tarjeta queda justo bajo el buscador (el día de hoy y su gasto, sin nada en medio).
  const buscador = await movs.locator(".searchbar").boundingBox(), dia = await movs.locator(".gx-dia").first().boundingBox();
  expect(dia.y - (buscador.y + buscador.height)).toBeLessThan(40);
  // Las puertas siguen: la ayuda de Mi ciclo en Filtros, «Actualizar gastos» al final, el desglose en Categorías.
  await gastosRoot(page).locator("button.v4-chip").filter({ hasText: "🎛️" }).first().click();
  await expect(page.locator(".v4-gastos-filter-sheet").getByTestId("gastos-cycle-help")).toContainText("Del 24/9");
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } });
  await page.locator(".v4-sheet-back").waitFor({ state: "detached" });
  await movs.locator(".gx-pie .action-row .btn").scrollIntoViewIfNeeded();
  await expect(movs.locator(".gx-pie .action-row .btn")).toBeVisible();
  await gastosSeccion(page, "cats");
  await expect(panel(page, "cats").locator(".v4-gastos-cat").first()).toBeVisible();
});

test("Categorías enseña el desglose de antes con la barra del presupuesto, y la cifra no cambia", async ({ page }) => {
  await abre(page);
  await expect(gastosCifra(page)).toHaveText("100,00 €");
  await gastosSeccion(page, "cats");
  await expect(tab(page, "cats")).toHaveAttribute("aria-selected", "true");
  await expect(gastosCifra(page)).toHaveText("100,00 €");
  await expect(gastosEstado(page)).toHaveText("septiembre por categoría · 900 € por debajo");
  const barra = panel(page, "cats").locator(".gx-cats-barra");
  await expect(barra).toHaveAttribute("aria-valuemax", "1000");
  await expect(barra).toHaveAttribute("aria-valuenow", "100");
  await expect(panel(page, "cats").locator(".gx-cats-pie")).toContainText("de 1000 €");
  const filas = panel(page, "cats").locator(".v4-gastos-cat");
  // Mayor a menor, solo lo que cuenta este mes; el límite de super sigue con su barra.
  await expect(filas).toHaveCount(3);
  await expect(filas.nth(0)).toHaveAttribute("data-cat", "super");
  await expect(filas.nth(0)).toContainText("55");
  await expect(filas.nth(1)).toHaveAttribute("data-cat", "compras");
  await expect(filas.nth(2)).toHaveAttribute("data-cat", "bares");
  const lim = filas.nth(0).locator('[role="progressbar"]');
  await expect(lim).toHaveAttribute("aria-valuemax", "50");
  await expect(lim).toHaveAttribute("aria-valuenow", "55");
  // Mantenerla pulsada abre su límite (tanda 3: el toque filtra, ver gastos-v5-filtro).
  await gastosPulsaLarga(page, filas.nth(1));
  await expect(page.locator(".ask-sheet, .tabsheet").first()).toBeVisible();
  // La lista de movimientos no se ve en Categorías.
  await expect(panel(page, "movs")).toHaveAttribute("aria-hidden", "true");
  await expect(panel(page, "movs").locator(".searchbar-in")).toBeHidden();
});

test("cambiar de sección vuelve arriba del todo", async ({ page }) => {
  await abre(page);
  await page.evaluate(() => document.querySelector(".page-scroll-host").scrollTo(0, 900));
  await expect(gastosRoot(page).locator(".gx-head")).toHaveClass(/compact/);
  await tab(page, "cats").click();
  await expect.poll(() => page.evaluate(() => document.querySelector(".page-scroll-host").scrollTop)).toBe(0);
  await expect(gastosRoot(page).locator(".gx-head")).not.toHaveClass(/compact/);
  // En Categorías la fila de meses está siempre (tanda 3, SPEC §2.1), con el mes en curso marcado.
  await expect(gastosRoot(page).getByTestId("gastos-meses")).toHaveAttribute("aria-hidden", "false");
  await expect(gastosRoot(page).locator(".gx-mes.on")).toHaveText("septiembre");
  await tab(page, "movs").click();
  await expect(gastosEstado(page)).toHaveText("gastado en septiembre · 900 € por debajo");
});

test("el tirón arriba del todo recorre Movimientos → Categorías → Suscripciones → Movimientos, con UN toque cada vez", async ({ page }) => {
  await abre(page, {}, true);
  // Solo los toques de sección (su par del ajustador): el anillo de Inicio sigue sonando un
  // momento al entrar y no es lo que se mide aquí.
  const toques = () => page.evaluate(() => window.__vib.filter((v) => v.amplitude === mcHapticTune().segAmp).length);
  const antes = await toques();
  await tiron(page);
  await expect.poll(() => seccion(page)).toBe("cats");
  await expect.poll(toques).toBe(antes + 1);
  await tiron(page);
  await expect.poll(() => seccion(page)).toBe("subs");
  await tiron(page);
  await expect.poll(() => seccion(page)).toBe("movs");
  await page.waitForTimeout(300);
  expect(await toques(), "un toque por cambio, nunca doble").toBe(antes + 3);
  // Por icono, también uno solo.
  await tab(page, "subs").click();
  await expect.poll(toques).toBe(antes + 4);
  await page.waitForTimeout(300);
  expect(await toques()).toBe(antes + 4);
});

test("al salir de Gastos y volver se aterriza en Movimientos (todas las puertas vienen a ver movimientos)", async ({ page }) => {
  await abre(page);
  await gastosSeccion(page, "cats");
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await expect(page.locator(".botnav-tab.active")).toHaveAttribute("data-tour", "inicio");
  // Con Inicio activa, Gastos no es la página anfitriona: se lee de su raíz directamente.
  await expect(page.locator(".gx-root")).toHaveAttribute("data-secc", "movs", { timeout: 5_000 });
  // Inicio «Ver gastos ›» lleva a la lista, no a la última sección que se miró.
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(tab(page, "movs")).toHaveAttribute("aria-selected", "true");
  await expect(panel(page, "movs").locator("button.v4-mov").first()).toBeVisible();
});

test("a mitad de la lista, tirar hacia abajo es scroll normal y no cambia de sección", async ({ page }) => {
  await abre(page);
  await page.evaluate(() => document.querySelector(".page-scroll-host").scrollTo(0, 1200));
  await tiron(page, { y0: 400, dy: 200 });
  await page.waitForTimeout(300);
  expect(await seccion(page)).toBe("movs");
  expect(await page.evaluate(() => document.querySelector(".page-scroll-host").scrollTop)).toBeLessThan(1200);
});

test("un tirón corto vuelve a su sitio sin cambiar de sección", async ({ page }) => {
  await abre(page);
  await tiron(page, { dy: 20, pasos: 4 });
  await page.waitForTimeout(400);
  expect(await seccion(page)).toBe("movs");
  expect(await panel(page, "movs").evaluate((el) => el.style.transform)).toBe("");
});

test("Suscripciones: las detectadas salen como estaban, con globito y su suma al mes", async ({ page }) => {
  await abre(page, { expenses: expenses.concat(subs) });
  await expect(gastosRoot(page).getByTestId("gastos-subs-globo")).toHaveText("1");
  await expect(tab(page, "subs")).toHaveAttribute("aria-label", "Suscripciones · 1 por revisar");
  // Ya no están en Movimientos.
  await expect(panel(page, "movs").locator(".sub-row")).toHaveCount(0);
  await gastosSeccion(page, "subs");
  await expect(gastosCifra(page)).toHaveText("12,99 €");
  await expect(gastosEstado(page)).toHaveText("al mes · 1 por revisar");
  const filas = panel(page, "subs").locator(".sub-row").filter({ has: page.locator(".sub-name") });
  await expect(filas).toHaveCount(1);
  await expect(filas.first()).toContainText("Netflix");
  // La acción de siempre: descartarla la quita, el globito se va y la sección dice que todo está bien.
  await filas.first().locator("button").nth(1).click();
  await expect(filas).toHaveCount(0);
  await expect(gastosRoot(page).getByTestId("gastos-subs-globo")).toHaveCount(0);
  await expect(panel(page, "subs")).toContainText("Todo en orden");
  await expect(gastosEstado(page)).toHaveText("nada por revisar");
});

test("Suscripciones vacía dice «Todo en orden»", async ({ page }) => {
  await abre(page);
  await gastosSeccion(page, "subs");
  await expect(panel(page, "subs").locator(".gx-vacio-t")).toHaveText("Todo en orden");
  await expect(gastosEstado(page)).toHaveText("nada por revisar");
  await expect(gastosCifra(page)).toHaveText("0,00 €");
});

/* La captura de la tanda 2 enseñaba DOS filas «Otros» (90 y 15 €): una categoría con un id que ya
   no existe se pinta como «Otros» pero se agrupaba aparte. Ahora es una sola fila y suma lo mismo. */
test("Categorías junta en una sola fila «Otros» lo que se pinta como Otros, y el total cuadra", async ({ page }) => {
  await abre(page, { expenses: expenses.concat([
    e("Raro", "2026-09-22", 15, "categoria-que-ya-no-existe"), e("Sin cat", "2026-09-21", 90, "otros")]) });
  await expect(gastosCifra(page)).toHaveText("205,00 €");
  await gastosSeccion(page, "cats");
  const filas = panel(page, "cats").locator(".v4-gastos-cat");
  await expect(filas.filter({ hasText: "Otros" })).toHaveCount(1);
  await expect(filas.filter({ hasText: "Otros" })).toContainText("105 €");
  const total = await filas.evaluateAll((els) => els.reduce((s, el) => s + parseFloat(el.querySelector(".v4-gastos-cat-amt").textContent.replace(/[^\d,]/g, "").replace(",", ".")), 0));
  expect(total).toBe(205);
});
