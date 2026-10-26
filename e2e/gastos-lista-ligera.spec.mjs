import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, installFixtureClock } from "./fixtures.mjs";

/* «LAGAZO GUAPO» (rechazo de la beta 4.26.172, 25/10): tras bajar mucho en Gastos → Movimientos,
   deslizar entre pestañas iba a tirones y se quedaba así en toda la app. Cada desliz saca la página
   de Gastos del modo fijo y la vuelve a meter, y el navegador recorría y repintaba TODAS las filas
   bajadas (~8.000 nodos con 612 filas): el coste crecía con lo que hubieras bajado.

   Estructural a propósito (sin tiempos, que en CI flaquean): con 300+ filas montadas, solo los
   días cerca de la pantalla se pintan (`content-visibility:auto` por día); los demás siguen en el
   DOM, con sus cifras, pero fuera del pintado. Sin el arreglo, todos los días se pintan.
   Y la paginación tiene que seguir llegando al final: con los días sin pintar, el centinela era el
   ancla del scroll y la lista se quedaba clavada en 132 filas. */
test.use({ serviceWorkers: "block" });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const N = 400;

function fixture(n) {
  const expenses = Array.from({ length: n }, (_, i) => ({
    id: "22222222-2222-4222-8222-" + String(i).padStart(12, "0"),
    date: new Date(Date.parse("2026-09-26T10:00:00Z") - i * 5400000).toISOString(),
    amount: 2 + (i % 9), merchant: "Comercio " + (i % 37), category: "super", source: "manual", ent: "sabadell",
  }));
  return { expenses, accounts: [{ id: "e2e", ent: "sabadell", name: "Cuenta", value: 1000, role: "diario" }] };
}

async function deslizar(page, cdp, sentido) {
  // Lejos del borde derecho: ahí vive el asa de ordenar de cada fila (`data-noswipe`).
  const W = page.viewportSize().width, y = 200;
  const [a, b] = sentido === "siguiente" ? [W - 110, 20] : [80, W - 40];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a, y }] });
  for (let i = 1; i <= 16; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a + ((b - a) * i) / 16, y }] });
    await delay(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(700);
}
const activa = (page) => page.evaluate(() => document.querySelector(".botnav-tab.active")?.dataset.tour);
const filas = (page) => page.evaluate(() => document.querySelectorAll(".page-scroll-host .v4-gastos-list-body button.v4-mov").length);
// Días cuyo contenido se pinta de verdad. El `.gx-dia` en sí nunca se salta: lo que
// `content-visibility:auto` deja fuera es su CONTENIDO, así que se pregunta a su cabecera.
const diasPintados = (page) => page.evaluate(() => {
  const d = [...document.querySelectorAll(".page-scroll-host .gx-dia")];
  return { total: d.length, pintados: d.filter((x) => x.querySelector(".gx-dia-h").checkVisibility({ contentVisibilityAuto: true })).length };
});

test("tras bajar cientos de filas, solo se pintan los días de cerca y la lista llega al final", async ({ page }) => {
  test.setTimeout(120_000);
  await installFixtureClock(page);
  await seedLoggedInDashboard(page, fixture(N));
  await page.goto("/");
  await page.waitForFunction(() => !!document.querySelector(".botnav") && !document.getElementById("mc-load"), null, { timeout: 60_000 });
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Entendido|Got it|D'acord/.test(x.textContent)); if (b) b.click(); });
  await page.evaluate(() => document.querySelector('.botnav-tab[data-tour="gastos"]').click());
  await expect.poll(() => activa(page)).toBe("gastos");
  await page.waitForFunction(() => !!document.querySelector(".page-scroll-host .gx-root"));

  // Bajar hasta el final, tanda a tanda, como él: la paginación no puede quedarse clavada.
  for (let i = 0; i < 20 && !(await page.locator(".page-scroll-host .gx-fin").count()); i++) {
    await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); h.scrollTop = h.scrollHeight; });
    await delay(600);
  }
  await expect(page.locator(".page-scroll-host .gx-fin"), "la lista llega a «Hasta aquí»").toHaveCount(1);
  expect(await filas(page)).toBe(N);

  await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); h.scrollTop = h.scrollHeight * 0.5; });
  await delay(400);
  const cdp = await page.context().newCDPSession(page);
  for (const [sentido, esperada] of [["siguiente", "plan"], ["anterior", "gastos"]]) {
    await deslizar(page, cdp, sentido);
    expect(await activa(page), "el desliz tiene que aterrizar o la medida no vale").toBe(esperada);
  }
  await page.waitForFunction(() => !!document.querySelector(".page-scroll-host .gx-root"));
  await delay(400);

  const d = await diasPintados(page);
  expect(d.total, "la lista tiene que tener muchos días montados para que la prueba diga algo").toBeGreaterThan(20);
  expect(d.pintados, "con cientos de filas bajadas solo se pintan los días cerca de la pantalla").toBeLessThanOrEqual(6);
  // Fuera del pintado no es fuera del DOM: cada día conserva su cabecera y su total.
  expect(await page.locator(".page-scroll-host .gx-dia [data-testid='gastos-dia-total']").count()).toBe(d.total);
});
