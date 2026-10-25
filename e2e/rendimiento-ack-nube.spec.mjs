import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, installFixtureClock } from "./fixtures.mjs";

/* «CUANDO BAJAS EN GASTOS Y LUEGO DESLIZAS, LAGAZO, Y SE MANTIENE AL MOVERTE POR LA APP» (25/10).
   No era el gesto: tras cada ACK de la nube (`goalSyncAck` sella un `_goalSync` nuevo), el primer
   re-render de App SIN cambio de estado —el `setHostTab` de cada desliz— se tomaba por una edición:
   otro `pushState` 1,2 s después, otro ACK, y las cuatro pestañas repintadas. Gastos con todas las
   filas que hubieras bajado: 612 filas eran ~370 ms de hilo a CPU x6, en CADA desliz y en
   cualquier pestaña, más un envío a la nube por gesto.

   Estructural a propósito (sin tiempos, que en CI flaquean): deslizar sin tocar ningún dato no
   puede mandar el estado a la nube ni reconstruir Gastos. Sin el arreglo, cada desliz deja un envío
   y un render de Expenses. */
test.use({ serviceWorkers: "block" });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function fixture(n) {
  const expenses = Array.from({ length: n }, (_, i) => ({
    id: "11111111-1111-4111-8111-" + String(i).padStart(12, "0"),
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

test("deslizar tras bajar en Gastos no reenvía el estado ni repinta Gastos", async ({ page }) => {
  test.setTimeout(120_000);
  await installFixtureClock(page);
  await seedLoggedInDashboard(page, fixture(1500));
  await page.goto("/");
  await page.waitForFunction(() => !!document.querySelector(".botnav") && !document.getElementById("mc-load"), null, { timeout: 60_000 });
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Entendido|Got it|D'acord/.test(x.textContent)); if (b) b.click(); });
  await page.evaluate(() => document.querySelector('.botnav-tab[data-tour="gastos"]').click());
  await expect.poll(() => activa(page)).toBe("gastos");
  // El host de scroll se coloca al terminar el asentamiento del carrusel, no al cambiar la pestaña.
  await page.waitForFunction(() => !!document.querySelector(".page-scroll-host .gx-root"));

  // Bajar como él: varias tandas de la paginación montadas.
  for (let i = 0; i < 12; i++) {
    if (await page.evaluate(() => document.querySelectorAll(".page-scroll-host .v4-gastos-list-body button.v4-mov").length) >= 300) break;
    await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); h.scrollTop = h.scrollHeight; });
    await delay(700);
  }
  await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); h.scrollTop = h.scrollHeight * 0.5; });
  expect(await page.evaluate(() => document.querySelectorAll(".page-scroll-host .v4-gastos-list-body button.v4-mov").length)).toBeGreaterThanOrEqual(300);

  // Que se asiente cualquier envío pendiente del arranque (debounce de 1,2 s + ACK).
  await delay(3500);
  await page.evaluate(() => {
    window.__push = 0; window.__expRender = 0;
    const ps = cloud.pushState;
    cloud.pushState = function () { window.__push++; return ps.apply(this, arguments); };
    const ce = React.createElement;
    React.createElement = function (tipo) { if (tipo === Expenses) window.__expRender++; return ce.apply(this, arguments); };
  });

  const cdp = await page.context().newCDPSession(page);
  for (const [sentido, esperada] of [["siguiente", "plan"], ["anterior", "gastos"], ["siguiente", "plan"], ["siguiente", "cartera"], ["anterior", "plan"], ["anterior", "gastos"]]) {
    await deslizar(page, cdp, sentido);
    expect(await activa(page), "el desliz tiene que aterrizar o la medida no vale").toBe(esperada);
  }
  await delay(3000);   // más que el debounce: un envío encadenado ya habría salido

  const { push, expRender } = await page.evaluate(() => ({ push: window.__push, expRender: window.__expRender }));
  expect(push, "deslizar sin tocar datos mandó el estado a la nube").toBe(0);
  expect(expRender, "deslizar sin tocar datos reconstruyó Gastos con todas sus filas").toBe(0);
});
