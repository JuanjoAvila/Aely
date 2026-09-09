import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* PULIDO v4 — EL PRIMER MINUTO DE ALGUIEN QUE ACABA DE INSTALAR (P1, P2, P3).
 *
 * Los tres se ven solo con la app vacía, que es justo el estado que ningún test cubría:
 *  P1 — con 0 o 1 puntos el sparkline pintaba una recta con puntito: un gráfico que miente.
 *  P2 — «+0 € este mes» ocupaba sitio sin decir nada.
 *  P3 — sin presupuesto, Inicio ESCONDÍA su tarjeta estrella y te quedabas sin media app
 *       sin saber por qué. Ahora la enseña vacía y con salida.
 */

async function inicio(page, estado) {
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
}

test("★ app recién instalada: ni gráfico plano ni pastilla de cero, y el hueco no salta", async ({ page }) => {
  await inicio(page, { history: [], budget: 0, expenses: [], accounts: [] });

  // P1: sin dos puntos no hay svg de sparkline, pero el hueco está reservado.
  await expect(page.locator("svg.spark")).toHaveCount(0);
  await expect(page.getByText(/Tu histórico empieza hoy/i)).toBeVisible();

  // P2: la pastilla del mes no sale con delta 0 y sin histórico.
  await expect(page.getByText(/\+0\s*€\s*este mes/i)).toHaveCount(0);
});

test("★ sin presupuesto, Inicio ofrece ponerlo en vez de esconder la tarjeta", async ({ page }) => {
  await inicio(page, { history: [], budget: 0, expenses: [], accounts: [] });

  const vacia = page.locator(".v4-empty").filter({ hasText: /presupuesto|budget|pressupost/i });
  await expect(vacia).toBeVisible();

  // Y tiene salida de verdad: abre el mismo panel de presupuesto que ya existía.
  await vacia.getByRole("button").click();
  await expect(page.getByText(/presupuesto|budget|pressupost/i).first()).toBeVisible({ timeout: 10_000 });
});

test("★ P4: Inicio recién instalado ofrece recibos y metas en vez de quedarse desnudo", async ({ page }) => {
  await inicio(page, { history: [], budget: 500, expenses: [], accounts: [], fixed: [], goals: [] });

  const recibos = page.locator(".v4-empty").filter({ hasText: /recibos|bills|rebuts/i });
  const metas = page.locator(".v4-empty").filter({ hasText: /meta|goal|objectiu/i });
  await expect(recibos).toBeVisible();
  await expect(metas).toBeVisible();
  // No son adornos: las dos llevan a algún sitio.
  await expect(recibos.getByRole("button")).toBeEnabled();
  await expect(metas.getByRole("button")).toBeEnabled();
});

test("con recibos y metas de verdad, las tarjetas fantasma desaparecen", async ({ page }) => {
  await inicio(page, {
    history: [100, 200], budget: 500,
    fixed: [{ id: "f1", name: "Luz", amount: 40, freq: "mes", day: 28, account: "sabadell" }],
    goals: [{ id: "g1", name: "Viaje", target: 1000, saved: 100, emoji: "✈️" }],
  });
  await expect(page.locator(".v4-empty")).toHaveCount(0);
});

test("★ P5: la racha a cero se dice en positivo, no «0 meses sin pasarte»", async ({ page }) => {
  await inicio(page, { history: [], budget: 500, streak: 0 });
  await expect(page.getByText(/0 meses sin pasarte/i)).toHaveCount(0);
  await expect(page.getByText(/Tu primer mes empieza hoy/i)).toBeVisible();
});

test("con racha de verdad vuelve el fuego", async ({ page }) => {
  await inicio(page, { history: [100, 200], budget: 500, streak: 3 });
  await expect(page.getByText(/3 meses sin pasarte/i)).toBeVisible();
});

test("con presupuesto e histórico, el hero vuelve a ser el de siempre", async ({ page }) => {
  await inicio(page, { history: [100, 200], budget: 500 });

  await expect(page.locator("svg.spark")).toHaveCount(1);
  await expect(page.locator(".v4-empty").filter({ hasText: /presupuesto|budget|pressupost/i })).toHaveCount(0);
});

/* P6 — el anillo del presupuesto se DIBUJA. La transición no animaba el primer pintado, así que
 * salía ya lleno y la animación de 1 s del spec §10 no se veía nunca. Se monta vacío y pasa al
 * valor real en el frame siguiente, enganchado al mismo `mc-splash-gone` que el count-up del hero
 * (si no, se gasta detrás de la cortina de entrada — ya pasó una vez con el número). */
test("★ P6: el anillo arranca vacío y se llena, no aparece relleno", async ({ page }) => {
  await inicio(page, { history: [100, 200], budget: 500, expenses: [{ id: "e1", date: "2026-09-09T12:00:00.000Z", amount: 100, merchant: "Super", category: "super" }] });
  const anillo = page.locator("svg circle").last();
  await expect(anillo).toHaveAttribute("stroke-dasharray", /\d/);
  // Ya con el splash fuera, el trazo tiene que haber llegado a su valor final (offset < circunferencia).
  await expect.poll(async () => {
    const d = await anillo.getAttribute("stroke-dasharray");
    const o = await anillo.getAttribute("stroke-dashoffset");
    return Number(o) < Number(d) - 0.01;
  }, { timeout: 10_000 }).toBe(true);
});

test("P6 con reduced-motion: el valor final, directo y sin animar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await inicio(page, { history: [100, 200], budget: 500, expenses: [{ id: "e1", date: "2026-09-09T12:00:00.000Z", amount: 100, merchant: "Super", category: "super" }] });
  const anillo = page.locator("svg circle").last();
  const d = Number(await anillo.getAttribute("stroke-dasharray"));
  const o = Number(await anillo.getAttribute("stroke-dashoffset"));
  expect(o).toBeLessThan(d - 0.01);
});

/* P14 — NO SE APLICA, y aquí queda por qué, medido (9/9).
 * El brief acierta en el hecho: `.v4-hero-amt` va a 56px fijo y sin `nowrap/overflow`, mientras
 * el de Gastos usa `clamp` y sí se protege. Pero la consecuencia que describe no se reproduce:
 * a 360×667, con el splash ya fuera, «192.148,45 €» mide 248 px de los 324 disponibles, y con
 * siete cifras («9.876.543,21 €») 294. No se aprieta contra los bordes. Y «Letra grande» no lo
 * cambia, porque el tamaño va en px y no escala con el root.
 * Aplicar el `clamp(38px,13.5vw,56px)` en su móvil de 360 px bajaría el hero de 56 a 48,6: haría
 * MÁS PEQUEÑO el número insignia de la app para arreglar algo que no pasa. Por eso se deja sin
 * hacer y se le pregunta, que es la norma que él puso para las tareas que no cuadran. */
