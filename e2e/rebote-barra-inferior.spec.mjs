/* BUG 6 DE LA SESIÓN DEL 2026-08-03 — «rebote raro»: su descripción textual (rechazo tras probar
 * el intento anterior, commit c40a67f): «No va bien se queda atascado durante un momento y luego
 * sí que hace la animación de la ola pero es muy muy raro».
 *
 * El rebote en sí YA es el rubber-band NATIVO del navegador (ver docs/memoria/mi-cartera-roadmap.md,
 * «EL REBOTE ERA EL NAVEGADOR TODO EL TIEMPO») — `.page` no tiene ni `overscroll-behavior` propio
 * ni JS de rebote desde el 1/8. `c40a67f` (2/8) añadió: esconder la barra inferior al llegar al
 * final de la lista, simétrico al caso de arriba, porque si no la barra (z-index 40) tapaba la
 * zona donde ocurre el rebote — «en Gastos no se reproduce la ola, era la barra».
 *
 * Causa real de "atascado... luego raro" encontrada aquí: la barra usa SIEMPRE la misma transición
 * calmada de 0,55 s (`transition:transform .55s ...,opacity .4s`), puesta a propósito para el caso
 * normal de esconderse al leer una lista hacia abajo («el ocultado de golpe se sentía brusco»,
 * feedback 2026-07-18). Pero el rebote NATIVO tarda solo ~0,2-0,3 s en asentarse — bastante menos
 * que esos 0,55 s. Resultado: al llegar al final, la barra seguía deslizándose/desvaneciéndose
 * TODAVÍA por encima de la ola mientras esta ya estaba en marcha — dos animaciones a ritmos
 * distintos peleando por el mismo trozo de pantalla, justo lo que describía.
 *
 * Arreglo (11-app-main.js + shell.html): un modificador `botnav-hidden-fast`, con una transición
 * mucho más corta, que se aplica SOLO cuando el motivo de esconder es «hemos llegado al final»
 * — el escondido normal al bajar sigue con su calma de siempre, que nunca fue el problema.
 *
 * Se comprueba de forma ESTRUCTURAL (clases + duración de transición vía getComputedStyle), no
 * por tiempos de frame (sería flaky en CI): que llegar al final usa la transición corta, y que un
 * scroll normal hacia abajo (sin llegar al final) sigue con la calmada de siempre. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

function historico(n) {
  const out = [];
  const ahora = Date.now();
  for (let i = 0; i < n; i++) {
    out.push({
      id: "x" + i,
      date: new Date(ahora - i * 3600_000 * 5).toISOString(),
      amount: (i % 7) + 1.5,
      merchant: ["Mercadona", "Bar Paco", "Repsol", "Amazon", "Bizum a Ana"][i % 5],
      category: ["super", "bares", "transporte", "compras", "otros"][i % 5],
      source: "manual",
    });
  }
  return out;
}

async function appLista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

async function estadoBarra(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".botnav");
    const cs = getComputedStyle(el);
    return {
      escondida: el.classList.contains("botnav-hidden"),
      rapida: el.classList.contains("botnav-hidden-fast"),
      transitionDuration: cs.transitionDuration,
    };
  });
}

// `.page-live` la llevan la pestaña activa Y sus vecinas premontadas (para que el swipe no entre
// en blanco) — no sirve para identificar CUÁL es la activa. Como en swipe-pestanas.spec.mjs: la
// página de Gastos por el ÍNDICE de su pestaña, no por clase ni por posición en pantalla.
async function scrollear(page, scrollTop) {
  await page.evaluate((st) => {
    const idx = Array.from(document.querySelectorAll(".botnav-tab")).findIndex((b) => b.classList.contains("active"));
    const live = document.querySelectorAll(".page")[idx];
    live.scrollTop = st;
    live.dispatchEvent(new Event("scroll", { bubbles: true }));
    // La app aplica hide/reveal en scrollend (+ margen en bordes para la ola nativa).
    live.dispatchEvent(new Event("scrollend", { bubbles: true }));
  }, scrollTop);
}

/** Espera a que el botnav asiente tras un scroll a borde (hide diferido ~450 ms / pin tope ~1 s). */
async function esperarBarra(page) {
  await page.waitForTimeout(550);
}

/** Tras estar en el tope la barra queda pineada ~0,7–1 s (anti-parpadeo). Hay que dejar caducar
 *  el pin antes de medir un hide por scroll hacia abajo. */
async function esperarPinTope(page) {
  await page.waitForTimeout(1100);
}

const alturaMax = (page) => page.evaluate(() => {
  const idx = Array.from(document.querySelectorAll(".botnav-tab")).findIndex((b) => b.classList.contains("active"));
  const live = document.querySelectorAll(".page")[idx];
  return live.scrollHeight - live.clientHeight;
});

/** Entra en Gastos y pone el filtro de fecha en "Todo": el filtro por defecto es "Este mes", y con
 *  la fecha real de hoy (día 3) la mayoría del histórico sembrado (fechas repartidas en el pasado)
 *  cae fuera — la lista se queda corta y nunca hay nada que scrollear (no es el bug, es el propio
 *  filtro hurtando datos a la prueba). */
async function irAGastosConTodo(page) {
  await page.evaluate(() => document.querySelector('.botnav-tab[data-tour="gastos"]').click());
  await expect.poll(() => page.evaluate(() => document.querySelector(".botnav-tab.active")?.getAttribute("data-tour"))).toBe("gastos");
  await page.evaluate(() => {
    const mas = Array.from(document.querySelectorAll(".v4-period-btn")).find((b) => /más|more|més/i.test(b.textContent || ""));
    if (mas) mas.click();
  });
  await page.evaluate(() => {
    const todo = Array.from(document.querySelectorAll(".v4-sheet-row")).find((b) => /^todo$|^all$|^tot$/i.test((b.textContent || "").trim()));
    if (todo) todo.click();
  });
  await expect(page.locator("button.v4-mov").first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => alturaMax(page), { timeout: 15_000, message: "la lista de Gastos tiene que poder scrollear para que la prueba valga" }).toBeGreaterThan(300);
}

test("llegar al final esconde la barra con una transición RÁPIDA, no con la calmada de siempre", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(200) });
  await page.goto("/");
  await appLista(page);
  await irAGastosConTodo(page);
  await page.waitForTimeout(400); // deja asentar el premontaje/carga antes de medir
  const max = await alturaMax(page);

  // Primer scroll tras cambiar de pestaña: solo sincroniza (scrollTab.current!==tab), no actúa.
  await scrollear(page, 0);
  await page.waitForTimeout(60);
  await esperarPinTope(page);

  // Scroll normal hacia abajo, SIN llegar al final: tiene que esconder con la curva calmada.
  await scrollear(page, Math.round(max * 0.4));
  await expect.poll(async () => (await estadoBarra(page)).escondida, {
    timeout: 3_000,
    message: "un scroll normal hacia abajo tiene que esconder la barra",
  }).toBe(true);
  const normal = await estadoBarra(page);
  expect(normal.rapida, "un scroll normal (sin llegar al final) NO debe usar la transición rápida").toBe(false);
  expect(normal.transitionDuration, "el escondido normal tiene que conservar su curva calmada de 0,55 s").toContain("0.55s");

  // Vuelve a enseñar la barra (sube) antes de medir el caso del final, para partir de "visible".
  await scrollear(page, 0);
  await esperarBarra(page);
  await esperarPinTope(page);
  const trasSubir = await estadoBarra(page);
  expect(trasSubir.escondida, "subir tiene que volver a enseñar la barra").toBe(false);

  // Llega al final de golpe (el caso real: una lista corta, o un fling que aterriza ya al fondo).
  await scrollear(page, max);
  await esperarBarra(page); // hide en borde tras ~450 ms (no matar la ola del fling)
  const final = await estadoBarra(page);
  expect(final.escondida, "llegar al final tiene que esconder la barra (si no, tapa el rebote)").toBe(true);
  expect(final.rapida, "llegar al final tiene que usar la transición RÁPIDA (botnav-hidden-fast)").toBe(true);
  expect(final.transitionDuration, "el escondido al llegar al final tiene que ser corto, para no competir con el rebote nativo (~0,2-0,3 s)").not.toContain("0.55s");
});

test("al alejarse del final y volver a bajar hasta abajo, la transición sigue siendo rápida", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(200) });
  await page.goto("/");
  await appLista(page);
  await irAGastosConTodo(page);
  await page.waitForTimeout(400); // deja asentar el premontaje/carga antes de medir
  const max = await alturaMax(page);

  await scrollear(page, 0); // sincroniza
  await page.waitForTimeout(60);
  await esperarPinTope(page);
  await scrollear(page, max); // llega al final
  await esperarBarra(page);
  let estado = await estadoBarra(page);
  expect(estado.rapida).toBe(true);

  // Sube (revela) y vuelve a bajar hasta el final: sigue siendo la transición rápida cada vez.
  // `max` se recalcula: la lista pagina con IntersectionObserver y puede haber crecido, y un
  // valor viejo aterrizaría por DEBAJO del nuevo final — dando el escondido "normal", no el rápido.
  await scrollear(page, 0);
  await esperarBarra(page);
  await esperarPinTope(page);
  await scrollear(page, await alturaMax(page));
  await esperarBarra(page);
  estado = await estadoBarra(page);
  expect(estado.escondida, "el segundo viaje al final también tiene que esconder la barra").toBe(true);
  expect(estado.rapida, "el segundo viaje al final también tiene que ser con la transición rápida").toBe(true);
});
