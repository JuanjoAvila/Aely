import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra, gastosEstado, gastosSeccion, gastosAbreFiltros, gastosCierraFiltros } from "./fixtures.mjs";

/* GASTOS v5 · TANDA 6 (25/10/2026, cuatro reportes suyos desde el móvil). Render puro: cada prueba
   abre la pantalla de verdad y mira el DOM.
   · Al final de Movimientos no queda un hueco de pantalla vacía (antes, el pie de una pantalla de
     alto dejaba el borde de la última tarjeta bajo la cabecera y nada más); el último día sigue
     llegando a la cabecera.
   · En Mi ciclo hay fila de ciclos, fija y marcada: se cambia de ciclo, y la cifra, su desglose y
     los totales de cada día cuadran entre sí; un ciclo pasado no mira el límite.
   · El tirón de sección funciona aunque empiece en la mitad baja de una sección vacía.
   · Con un filtro de la hoja, la cifra de arriba y el total de cada día son los de lo filtrado.
   El reloj es el de las fixtures: 26/9/2026 a mediodía. */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

const e = (id, ymd, amount, category, extra = {}) => ({ id, date: ymd + "T12:00:00Z", amount, category, merchant: id, source: "ob", ent: "trade_republic", ...extra });
const base = {
  budget: 1000,
  settings: { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["trade_republic"], budgetCycle: true, gTotalMode: "net" },
  accounts: [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 3000, role: "diario", spendFrom: true }],
};
/* Tres nóminas (24 de julio, agosto y septiembre): el ciclo en curso empieza el 24/9 y los dos de
   antes, el 24/8 y el 24/7. Ciclo en curso: 100 + 3 − 40 = 63. Ciclo del 24/8 al 23/9: 30 días con
   10 € (300) y una devolución de 25 → 275. */
const nomina = (d) => e("Nómina " + d, d, -2000, "ingreso", { merchant: "Nómina" });
const ciclo = [
  nomina("2026-07-24"), nomina("2026-08-24"), nomina("2026-09-24"),
  e("Cena", "2026-09-25", 100, "restaurantes"), e("Bizum recibido", "2026-09-25", -40, "ingreso"), e("Café", "2026-09-26", 3, "restaurantes"),
  ...Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 7, 24 + i));
    return e("Compra " + i, d.toISOString().slice(0, 10), 10, i % 2 ? "super" : "compras");
  }),
  e("Devolución", "2026-09-02", -25, "compras"),
  e("Julio", "2026-08-10", 70, "super"),
];

async function abre(page, overrides = {}) {
  await seedLoggedInDashboard(page, { ...base, expenses: ciclo, ...overrides });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
}
const fila = (page) => gastosRoot(page).getByTestId("gastos-meses");
const euros = (txt) => Number(txt.replace(/[^\d,+-]/g, "").replace(",", "."));
/* Baja hasta el final con la lista ya entera (pinta de 12 en 12 y carga al acercarse al final).
   Antes espera a que pare el salto de tocar un ciclo: es suave y luego se AFINA mientras el scroll
   esté quieto (`afinaSalto`, que solo corta un dedo). Un `scrollTop` a mano en mitad del salto se lo
   come el afinado y vuelve arriba. Antes no se veía porque la lista llegaba en tandas y el sondeo
   repetía el scroll después; desde que las tandas se piden por adelantado (26/10) llega entera a
   la primera y el scroll a mano caía justo dentro del salto. */
async function alFinal(page) {
  await page.evaluate(() => new Promise((ok) => {
    const h = document.querySelector(".page-scroll-host");
    let st = -1, quietos = 0;
    const paso = () => { quietos = Math.abs(h.scrollTop - st) < 0.5 ? quietos + 1 : 0; st = h.scrollTop; if (quietos >= 8) ok(); else requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }));
  await expect.poll(async () => {
    await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); h.scrollTop = h.scrollHeight; });
    return gastosRoot(page).locator(".gx-fin").count();
  }).toBe(1);
  await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); h.scrollTop = h.scrollHeight; });
}
/* Un poco de scroll: lo justo para que la cabecera se encoja y salga la fila de ciclos. */
async function bajaUnPoco(page) {
  await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); h.scrollTop = Math.min(120, h.scrollHeight - h.clientHeight); });
  await expect(fila(page)).toHaveAttribute("aria-hidden", "false");
}
/* Suma con signo de los totales de cada día («+» = entra más de lo que sale). */
async function sumaDias(page) {
  const t = await gastosRoot(page).locator('[data-gx-secc="movs"] [data-testid="gastos-dia-total"]').allTextContents();
  return Math.round(t.reduce((a, x) => a + (x.trim().startsWith("+") ? -1 : 1) * Math.abs(euros(x)), 0) * 100) / 100;
}

test("al final de la lista no queda un hueco vacío y el último día llega a la cabecera", async ({ page }) => {
  // Un ciclo en curso largo (cobro el 28/8, un gasto al día): la captura era el final de un ciclo.
  await abre(page, { expenses: [nomina("2026-08-28"), ...Array.from({ length: 30 }, (_, i) =>
    e("Compra " + i, new Date(Date.UTC(2026, 7, 28 + i)).toISOString().slice(0, 10), 10, "compras"))] });
  await alFinal(page);
  await expect(gastosRoot(page).locator(".gx-pie")).toHaveCount(0);
  const m = await page.evaluate(() => {
    const h = document.querySelector(".page-scroll-host"), fin = h.querySelector('[data-gx-secc="movs"] .gx-fin');
    const pad = parseFloat(getComputedStyle(h).paddingBottom) || 0;
    // Lo que queda entre «Hasta aquí» y el final del scroll: solo el margen de la barra de abajo.
    return { hueco: Math.round(h.getBoundingClientRect().bottom - fin.getBoundingClientRect().bottom - pad), alTope: h.scrollTop >= h.scrollHeight - h.clientHeight - 1 };
  });
  expect(m.alTope).toBe(true);
  expect(m.hueco, "sin pantalla vacía debajo de «Hasta aquí»").toBeLessThan(40);
  await expect(gastosRoot(page).locator(".gx-fin")).toHaveText("Hasta aquí: 28 de agosto de 2026");
  // Con todo bajado, la cabecera habla del ÚLTIMO día de la lista.
  await expect(gastosEstado(page)).toHaveText("28 ago – 28 ago");
});

test("Mi ciclo tiene su fila de ciclos, marcada; cambiar de ciclo cambia lista, cifra y días, y cuadran", async ({ page }) => {
  await abre(page);
  await expect(gastosRoot(page)).toHaveAttribute("data-periodo", "cycle");
  /* Arriba del todo la fila NO se ve: sale al bajar, como la de Meses (25/10: fija se veía todo
     el rato). El rango del ciclo bajo la cifra sí se queda. Con el ciclo en curso marcado (se llama
     por el mes en que cae casi entero). */
  await expect(fila(page)).toHaveAttribute("aria-hidden", "true");
  await expect(gastosRoot(page).locator(".gx-head")).not.toHaveClass(/meses-fijos/);
  // El ciclo en curso: lo de siempre, con su margen.
  await expect(gastosCifra(page)).toHaveText("63,00 €");
  await expect(gastosEstado(page)).toHaveText("24 sep – 23 oct · 937 € por debajo");
  expect(await sumaDias(page)).toBe(63);
  await bajaUnPoco(page);
  await expect(fila(page)).toHaveAttribute("aria-label", "Ciclos");
  await expect(fila(page).locator(".gx-mes")).toHaveText(["agosto", "septiembre", "octubre"]);
  await expect(fila(page).locator('.gx-mes[aria-pressed="true"]')).toHaveText("octubre");

  await fila(page).locator(".gx-mes", { hasText: "septiembre" }).click();
  await expect(fila(page).locator('.gx-mes[aria-pressed="true"]')).toHaveText("septiembre");
  // 30 × 10 − 25 de la devolución; la nómina que abre el ciclo no suma. Sin límite: es pasado.
  await expect(gastosCifra(page)).toHaveText("275,00 €");
  await expect(gastosEstado(page)).toHaveText("24 ago – 23 sep");
  await expect(gastosRoot(page).getByTestId("gastos-desglose")).toHaveText("gastos 300,00 € · ingresos 25,00 €");
  await alFinal(page);
  expect(await sumaDias(page), "los días suman la cifra de arriba").toBe(275);
  // Abajo del todo, lo sumado va del inicio del ciclo al último día de la lista.
  await expect(gastosEstado(page)).toHaveText("24 ago – 24 ago");
  // La lista es la de ese ciclo y nada más.
  const fechas = await gastosRoot(page).locator('[data-gx-secc="movs"] [data-gx-day]').evaluateAll((els) => els.map((x) => +x.getAttribute("data-gx-day")));
  expect(Math.max(...fechas)).toBe(20260922);
  expect(Math.min(...fechas)).toBe(20260824);

  // Categorías enseña el mismo ciclo, con la misma fila, y ahí sí fija (a la vista sin bajar).
  await gastosSeccion(page, "cats");
  await expect(fila(page)).toHaveAttribute("aria-hidden", "false");
  await expect(fila(page).locator('.gx-mes[aria-pressed="true"]')).toHaveText("septiembre");
  await expect(gastosCifra(page)).toHaveText("275,00 €");
  await gastosSeccion(page, "movs");

  // Vuelta al ciclo en curso: todo como al entrar.
  await bajaUnPoco(page);
  await fila(page).locator(".gx-mes", { hasText: "octubre" }).click();
  await expect(gastosCifra(page)).toHaveText("63,00 €");
  await expect(gastosEstado(page)).toHaveText("24 sep – 23 oct · 937 € por debajo");
  // Elegir periodo en Filtros (o Restablecer) vuelve al ciclo en curso.
  await bajaUnPoco(page);
  await fila(page).locator(".gx-mes", { hasText: "agosto" }).click();
  await expect(gastosCifra(page)).toHaveText("70,00 €");
  // Debajo de la cifra, siempre el rango del ciclo elegido (decisión suya: «mes + fechas»).
  await expect(gastosEstado(page)).toHaveText("24 jul – 23 ago");
  await gastosAbreFiltros(page);
  await page.locator(".v4-gastos-filter-sheet .gx-fil-reset").click();
  await gastosCierraFiltros(page);
  await expect(gastosCifra(page)).toHaveText("63,00 €");
});

async function tiron(page, { y0, dy = 160, pasos = 10 }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y: y0 + (dy * i) / pasos }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("el tirón de sección vale desde la mitad baja de una sección vacía", async ({ page }) => {
  await abre(page);
  await gastosSeccion(page, "subs");
  await expect(gastosRoot(page).locator('[data-gx-secc="subs"] .gx-vacio-t')).toHaveText("Todo en orden");
  // El carrusel tiene que estar quieto: un dedo de verdad no arrastra a mitad de la transición.
  await page.waitForTimeout(400);
  // El dedo empieza por DEBAJO de todo lo que pinta la sección (y por encima de la barra de abajo).
  const y0 = await page.evaluate(() => {
    const p = document.querySelector('.page-scroll-host [data-gx-secc="subs"]');
    return Math.round(p.getBoundingClientRect().bottom + 40);
  });
  const barra = await page.locator(".botnav").boundingBox();
  expect(y0 + 160, "el arrastre cabe entre la sección y la barra").toBeLessThan(barra.y);
  // Comprueba que el dedo aterriza en la página de Gastos y no en la sección.
  const enPagina = await page.evaluate((y) => { const el = document.elementFromPoint(200, y); return !!el.closest(".page-scroll-host") && !el.closest('[data-gx-secc="subs"]'); }, y0);
  expect(enPagina).toBe(true);
  await tiron(page, { y0 });
  await expect.poll(() => gastosRoot(page).getAttribute("data-secc")).toBe("movs");
});

test("con un filtro de la hoja, la cifra y el total de cada día son los de lo filtrado", async ({ page }) => {
  // El día 25: dos de bares, uno de súper y una devolución de bares. El 26: un bar.
  await abre(page, { expenses: [
    nomina("2026-09-24"),
    e("Barcelona Cooking", "2026-09-25", 27.65, "bares"), e("Telepizza", "2026-09-25", 49.8, "bares"),
    e("Mercadona", "2026-09-25", 30, "super"), e("Devolución bar", "2026-09-25", -10, "bares"),
    e("Café", "2026-09-26", 2.4, "bares"), e("Gasolina", "2026-09-26", 60, "gasolina"),
  ] });
  // Sin filtro: el presupuesto del ciclo (todo lo que cuenta, neto).
  await expect(gastosCifra(page)).toHaveText("159,85 €");
  const dia25 = gastosRoot(page).locator('[data-gx-secc="movs"] [data-gx-day="20260925"]');
  await expect(dia25.getByTestId("gastos-dia-total")).toHaveText("97,45 €");

  await gastosAbreFiltros(page);
  await page.locator('.v4-gastos-filter-sheet [data-fil="c:bares"]').click();
  await gastosCierraFiltros(page);
  // Bares: 27,65 + 49,80 + 2,40 = 79,85 gastado, 10 devuelto → 69,85, y debajo de qué sale.
  await expect(gastosCifra(page)).toHaveText("69,85 €");
  await expect(gastosEstado(page)).toHaveText("4 movimientos");
  await expect(gastosRoot(page).getByTestId("gastos-desglose")).toHaveText("gastos 79,85 € · ingresos 10,00 €");
  // El día 25 cuadra con sus tres tarjetas: 27,65 + 49,80 − 10.
  await expect(dia25.locator("button.v4-mov")).toHaveCount(3);
  await expect(dia25.getByTestId("gastos-dia-total")).toHaveText("67,45 €");
  expect(await sumaDias(page)).toBe(69.85);

  // Quitar el filtro vuelve a la cifra del presupuesto.
  await gastosRoot(page).getByRole("button", { name: "Limpiar" }).click();
  await expect(gastosCifra(page)).toHaveText("159,85 €");
  await expect(dia25.getByTestId("gastos-dia-total")).toHaveText("97,45 €");
});

/* Mantener pulsada una categoría abre su límite con el dedo aún puesto (vídeo suyo del 25/10):
   Android seguía con su gesto y seleccionaba el título de la hoja recién abierta, con su menú
   «Copiar · Seleccionar todo». Mientras el dedo sigue puesto no se puede empezar una selección ni
   abrir el menú en ninguna parte; al soltar, los campos de texto vuelven a ser seleccionables. */
test("la pulsación larga de una categoría no selecciona texto ni abre el menú contextual", async ({ page }) => {
  await abre(page);
  await gastosSeccion(page, "cats");
  const fila = gastosRoot(page).locator('[data-gx-secc="cats"] .gx-cat').first();
  const box = await fila.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await expect(page.getByRole("dialog")).toBeVisible();
  // Con el dedo aún puesto: el título de la hoja no se deja seleccionar ni da menú.
  const durante = await page.evaluate(() => {
    const t = document.querySelector('[role="dialog"]');
    const ev = (tipo) => t.dispatchEvent(new Event(tipo, { bubbles: true, cancelable: true }));
    return { clase: document.documentElement.classList.contains("mc-sin-sel"), seleccion: ev("selectstart"), menu: ev("contextmenu"),
      userSelect: getComputedStyle(t).userSelect, texto: String(getSelection()) };
  });
  expect(durante).toEqual({ clase: true, seleccion: false, menu: false, userSelect: "none", texto: "" });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Al soltar todo vuelve: sin selección hecha, y los campos (el importe del límite) se pueden seleccionar.
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("mc-sin-sel"))).toBe(false);
  expect(await page.evaluate(() => String(getSelection()))).toBe("");
  const campo = page.getByRole("dialog").locator("input").first();
  if (await campo.count()) expect(await campo.evaluate((i) => getComputedStyle(i).userSelect)).not.toBe("none");
});

/* «Modo normal la letra» (captura suya del 25/10 a 393 px): «Bizum / recibido», «Barcelona /
   Cooking» y «Bares y / restaurantes» se partían en dos líneas y el banco se cortaba en «Trad…».
   A 393 px, nombres típicos caben en UNA línea sin recortarse y el banco sale entero; con la letra
   del sistema más grande (se imita como en `gastos-v5`: el WebView escala el texto, no las cajas)
   siguen en una línea, recortados con puntos suspensivos. */
test.describe("filas a 393 px", () => {
  test.use({ viewport: { width: 393, height: 873 } });
  for (const zoom of [1, 1.3]) {
    test(`nombre y categoría en una línea (letra al ${Math.round(zoom * 100)} %)`, async ({ page }) => {
      await abre(page, { settings: { ...base.settings, budgetCycle: false, gTotalMode: "split" }, expenses: [
        e("Bizum recibido", "2026-09-26", -20, "ingreso"), e("Amazon", "2026-09-25", 39.59, "compras"),
        e("Barcelona Cooking", "2026-09-24", 27.65, "bares"), e("Telepizza", "2026-09-24", 49.8, "bares"),
      ] });
      const tarjetas = gastosRoot(page).locator('[data-gx-secc="movs"] button.v4-mov');
      await expect(tarjetas).toHaveCount(4);
      const m = await tarjetas.evaluateAll((els, z) => {
        if (z !== 1) els.forEach((card) => {
          const nodos = [...card.querySelectorAll("*")], tam = nodos.map((n) => parseFloat(getComputedStyle(n).fontSize));
          nodos.forEach((n, i) => { n.style.fontSize = tam[i] * z + "px"; });
        });
        const unaLinea = (el) => { const r = el.getBoundingClientRect(), lh = parseFloat(getComputedStyle(el).fontSize) * 1.6; return r.height < lh; };
        const entero = (el) => el.scrollWidth <= el.clientWidth + 1;
        return els.map((card) => {
          const t = card.querySelector(".nm-title"), c = card.querySelector(".nm-cat"), bk = card.querySelector(".meta > span:last-child");
          return { t: t.textContent, unaLinea: unaLinea(t) && unaLinea(c), entero: entero(t) && entero(c) && entero(bk) };
        });
      }, zoom);
      for (const f of m) {
        expect(f.unaLinea, f.t + ": nombre y categoría en una línea").toBe(true);
        if (zoom === 1) expect(f.entero, f.t + ": sin recortar a tamaño normal").toBe(true);
      }
    });
  }
});
