import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* RENDIMIENTO con histórico grande (feedback 2026-07-24: «cuanto más tiempo la uso, más se
   ralentiza, hasta ir lagueadísima»).
 *
 * La causa no era una sola cosa, sino que TODO el trabajo era proporcional al histórico y se
 * repetía en cada cambio de estado: `totals` dependía del objeto de estado entero (que cambia
 * SIEMPRE, porque `set()` sella `_savedAt`), el filtrado de Gastos recorría la lista cuatro veces
 * creando miles de `Date`, y las filas se repintaban todas aunque no cambiara ninguna.
 *
 * Estos tests no miden milisegundos absolutos (dependen de la máquina y serían flaky): miden que
 * el trabajo NO se dispare con el tamaño del histórico y que no se repita sin motivo. */

/** Histórico sintético de N movimientos repartidos por los últimos meses. */
function historico(n) {
  const out = [];
  const ahora = Date.now();
  for (let i = 0; i < n; i++) {
    const d = new Date(ahora - i * 3600_000 * 5);   // ~5 h entre movimientos → varios meses
    out.push({
      id: "x" + i,
      date: d.toISOString(),
      amount: (i % 7) + 1.5,
      merchant: ["Mercadona", "Bar Paco", "Repsol", "Amazon", "Bizum a Ana"][i % 5],
      category: ["super", "bares", "transporte", "compras", "otros"][i % 5],
      source: "manual",
      note: i % 5 === 4 ? "Concepto " + i : undefined,
    });
  }
  return out;
}

test("Gastos aguanta 3.000 movimientos y sigue respondiendo al escribir", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(3000) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 20_000 });
  await dismissNews(page);

  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator("button.v4-mov").first()).toBeVisible({ timeout: 15_000 });

  // El filtro por defecto es "Este mes": el histórico sintético reparte sus 3.000 movimientos
  // cada ~5h HACIA ATRÁS desde el instante real de la ejecución, así que el día 1 (o las
  // primeras horas de cualquier mes) casi todo el histórico cae en el mes ANTERIOR y "Repsol"
  // puede quedar fuera de "Este mes" — no es que falte el dato, es que el test busca en la
  // ventana equivocada. Se cambia a "Todo" (sin límite de fecha) para probar de verdad lo que
  // el test dice probar: filtrar sobre el histórico COMPLETO, no sobre un mes que puede tener
  // uno o dos movimientos si acaba de empezar (2026-08-01: así se cazó).
  await page.getByRole("button", { name: "Más…" }).click();
  await page.getByRole("button", { name: "Todo", exact: true }).click();

  // Escribir en el buscador es el peor caso: refiltra y reordena el histórico en cada tecla.
  const t0 = Date.now();
  await page.locator(".searchbar-in").fill("Repsol");
  await expect(page.locator("button.v4-mov").first()).toContainText("Repsol", { timeout: 10_000 });
  const ms = Date.now() - t0;

  // Umbral generoso a propósito (el CI es lento y no queremos un test flaky): lo que se persigue
  // es cazar una regresión GORDA — que alguien vuelva a meter trabajo cuadrático en el filtrado.
  expect(ms, `refiltrar 3.000 movimientos tardó ${ms} ms`).toBeLessThan(5000);
});

test("la lista pagina: 3.000 movimientos NO son 3.000 nodos en el DOM", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(3000) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 20_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator("button.v4-mov").first()).toBeVisible({ timeout: 15_000 });

  // Si alguien quita el paginado (CONFIG.PAGE_SIZE + IntersectionObserver), el móvil se muere:
  // son miles de nodos repintándose en cada cambio de estado.
  const filas = await page.locator("button.v4-mov").count();
  expect(filas, `hay ${filas} filas pintadas de golpe`).toBeLessThan(60);
});

test("cambiar de pestaña con histórico grande no bloquea la app", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(3000) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 20_000 });
  await dismissNews(page);

  const t0 = Date.now();
  for (const tab of ["gastos", "plan", "cartera", "inicio"]) {
    await page.locator(`.botnav-tab[data-tour="${tab}"]`).click();
    await page.waitForTimeout(120);
  }
  const ms = Date.now() - t0;
  expect(ms, `recorrer las cuatro pestañas tardó ${ms} ms`).toBeLessThan(12_000);
});

test("parseDate cachea: repetir el trabajo del histórico no cuesta lo mismo la 2ª vez", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(2000) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 20_000 });
  await dismissNews(page);

  // Mide dentro de la página: fechas ya vistas (caché caliente) contra fechas nuevas (caché fría).
  // Es la comprobación directa de que la caché de fechas existe y funciona; si alguien la quita,
  // las dos pasadas cuestan lo mismo y esto lo canta.
  //
  // Dos cosas que este test tuvo mal hasta el 2026-08-17 y que hay que respetar al tocarlo:
  //
  // 1) La pasada "fría" NO puede usar las fechas del histórico sembrado: al pintar la pantalla la
  //    app ya las ha parseado todas, así que la caché llegaba aquí LLENA y las dos pasadas medían
  //    lo mismo (aciertos de caché contra aciertos de caché). Pasaba de milagro, por ruido. Las
  //    fechas frías se generan aquí, distintas por construcción y que no ha visto nadie.
  //
  // 2) Chromium redondea `performance.now()` a ~0,1 ms (mitigación Spectre). Una sola pasada de
  //    2.000 fechas cabe entera en un tick, y con la suite completa a varios workers las dos
  //    medidas salían IDÉNTICAS: `caliente < fría` era falso por empate, no porque la caché
  //    fallara. Por eso cada pasada se repite VUELTAS veces dentro de la medición.
  //
  // Ojo al orden y al volumen: la caché se vacía sola al pasar de 5.000 entradas (`_pdCache`, en
  // public/index.html), así que la caliente se mide ANTES —con solo las 2.000 del histórico
  // dentro— y las frías van después, cuando ya da igual que la desborden. Medir la caliente
  // primero deja además el JIT caliente para las dos: lo que quede de diferencia es la caché, no
  // el calentamiento del motor.
  const VUELTAS = 20;
  const { fria, caliente, llamadas } = await page.evaluate((VUELTAS) => {
    // Los gastos viven en su propia clave desde 4.8.0 (guardado partido).
    const fechas = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").map((e) => e.date);
    const pasada = (arr) => { for (const f of arr) dateMs(f); };

    pasada(fechas);                                   // caché llena, medimos a partir de aquí
    const t1 = performance.now();
    for (let i = 0; i < VUELTAS; i++) pasada(fechas);
    const caliente = performance.now() - t1;

    // Fechas nuevas: un minuto de separación desde 1990, así que ni se repiten entre sí ni chocan
    // con las del histórico. Se construyen FUERA de la medición (crear las cadenas cuesta más que
    // parsearlas).
    const lotes = [];
    let k = 0;
    for (let v = 0; v < VUELTAS; v++) {
      const lote = [];
      for (let i = 0; i < fechas.length; i++) lote.push(new Date(Date.UTC(1990, 0, 1) + (k++) * 60_000).toISOString());
      lotes.push(lote);
    }
    const t2 = performance.now();
    for (const lote of lotes) pasada(lote);
    const fria = performance.now() - t2;

    return { fria, caliente, llamadas: fechas.length * VUELTAS };
  }, VUELTAS);

  const detalle = `${llamadas} fechas · fría ${fria.toFixed(1)} ms · caliente ${caliente.toFixed(1)} ms`;
  // Premisa de la medida: con 40.000 llamadas la fría ronda los 13 ms. Si baja de 2 ms es que el
  // volumen se ha quedado corto y estaríamos comparando ruido con ruido otra vez; que cante aquí.
  expect(fria, `la pasada fría no es medible, sube VUELTAS (${detalle})`).toBeGreaterThan(2);
  // Con caché la caliente va ~13x más rápida; sin caché las dos cuestan igual (ratio ~1). El x3
  // deja sitio de sobra para una máquina cargada sin dejarle pasar una caché desaparecida.
  expect(caliente, `la 2ª pasada no sale más barata que la 1ª (${detalle})`).toBeLessThan(fria / 3);
});

/* VOLVER A PRIMER PLANO CON LA NUBE IGUAL NO REHACE NADA (diagnóstico de lag, 19/10/2026).
   Cada vuelta baja el histórico entero; con 3.500 gastos congelaba la pantalla 400 ms a CPU×6
   porque se reconvertía cada fila, se adivinaba otra vez cada categoría y el estado se rehacía
   entero solo por cambiar `lastSync`. Aquí no se cronometra nada: se cuenta el trabajo, que es lo
   que no depende de la máquina. Con la nube trayendo lo mismo, la vuelta tiene que leerla (la
   prueba de lectura del widget y «Última sincronización» la necesitan) y no hacer nada más. */
test("volver a primer plano con la nube igual: ni filas reconvertidas, ni categorías, ni escrituras", async ({ page }) => {
  const exp = historico(3000).map((e, i) => (i % 4 === 0 ? { ...e, category: "otros" } : e));
  const rows = exp.map((e) => ({ id: e.id, fecha: e.date, importe: e.amount, comercio: e.merchant, cat: e.category, source: "manual", nota: e.note || null, nota_edit: false, no_card: false }));
  await seedLoggedInDashboard(page, { expenses: exp, __cloudRows: { expenses: rows } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 20_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".sync-note")).toContainText(/\d/, { timeout: 15_000 });

  // Funciones globales del bundle: envolverlas cuenta las llamadas que hace la propia app.
  await page.evaluate(() => {
    const n = (window.__vuelta = { lecturas: 0, filas: 0, kw: 0, escrituras: [] });
    const envuelve = (name, k) => { const f = window[name]; window[name] = function () { n[k]++; return f.apply(this, arguments); }; };
    envuelve("expensesFromRows", "lecturas");
    envuelve("expenseFromRow", "filas");
    envuelve("autoCategoryKw", "kw");
    const put = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (/^micartera_v3/.test(k)) n.escrituras.push(k); return put.apply(this, arguments); };
    let vis = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => vis });
    window.__vuelve = () => { vis = "hidden"; document.dispatchEvent(new Event("visibilitychange")); vis = "visible"; document.dispatchEvent(new Event("visibilitychange")); };
  });
  const vuelta = async () => {
    const antes = await page.evaluate(() => window.__vuelta.lecturas);
    await page.evaluate(() => window.__vuelve());
    await page.waitForFunction((a) => window.__vuelta.lecturas > a, antes, { timeout: 15_000 });
    await page.waitForTimeout(1000);   // el set(), el debounce de 400 ms del guardado y los efectos
  };
  // La primera vuelta puede coincidir con la lectura del arranque; la segunda ya es pura repetición.
  await vuelta();
  const sync0 = await page.locator(".sync-note").textContent();
  await page.evaluate(() => { const n = window.__vuelta; n.filas = 0; n.kw = 0; n.escrituras = []; });
  await vuelta();
  const n = await page.evaluate(() => window.__vuelta);
  expect(n.filas, "filas reconvertidas en una vuelta sin cambios").toBe(0);
  expect(n.kw, "barridos de palabras clave en una vuelta sin cambios").toBe(0);
  expect(n.escrituras, "la cartera no se reescribe si la nube trae lo mismo").toEqual([]);
  // «Última sincronización» sigue con hora aunque el estado no haya cambiado (la da la lectura).
  expect(sync0).toMatch(/\d/);
  await expect(page.locator(".sync-note")).toContainText(/\d/);

  // Y si cambia UNA fila, esa sí entra (y solo esa se reconvierte).
  await page.evaluate(() => { const r = window.__e2eCloudRows.expenses; r[1] = { ...r[1], importe: 777.77 }; window.__vuelta.filas = 0; });
  await vuelta();
  expect(await page.evaluate(() => window.__vuelta.filas)).toBe(1);
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").filter((e) => e.amount === 777.77).length);
  expect(guardado, "el importe nuevo llega al histórico guardado").toBe(1);
});
