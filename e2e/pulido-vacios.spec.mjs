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

test("con presupuesto e histórico, el hero vuelve a ser el de siempre", async ({ page }) => {
  await inicio(page, { history: [100, 200], budget: 500 });

  await expect(page.locator("svg.spark")).toHaveCount(1);
  await expect(page.locator(".v4-empty").filter({ hasText: /presupuesto|budget|pressupost/i })).toHaveCount(0);
});
