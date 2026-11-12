import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra } from "./fixtures.mjs";

/* TOCAR UNA DEUDA LLEVA A SU TARJETA, SUAVE (queja del dueño 28/10/2026: «que vaya más suave y al
   sitio exacto de donde está la deuda, que ahora es muy bestia»). Antes la sección cambiaba en un
   frame, el scroll se quedaba donde estaba y la tarjeta caía fuera de la pantalla. Aquí se mira lo
   que se ve: que la tarjeta acaba entera entre el borde de arriba y la barra inferior (aunque la
   barra esté escondida: al subir reaparece), y que se llega deslizando, no de un salto.
   Reloj de las fixtures: 26/9/2026. */
test.beforeEach(async ({ page }) => {
  await installFixtureClock(page);
  // Espía de `scrollTo`: qué comportamiento pidió la app (no cambia lo que hace).
  await page.addInitScript(() => {
    window.__scrollPedidos = [];
    const orig = Element.prototype.scrollTo;
    // `apply(arguments)` y no `call(this, a, b)`: con un segundo argumento `undefined` el
    // navegador elige la firma (x, y) y el scroll se iba a 0 — el espía rompía lo que espiaba.
    Element.prototype.scrollTo = function (a) {
      if (a && typeof a === "object") window.__scrollPedidos.push({ top: a.top, behavior: a.behavior || "auto" });
      return orig.apply(this, arguments);
    };
  });
});

const YM = 2026 * 12 + 8;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["trade_republic"] };
// Siete deudas: la última queda muy por debajo de la pantalla y hay que bajar a por ella.
const debts = Array.from({ length: 7 }, (_, i) => ({ id: "d" + i, ent: "familia", name: "Deuda " + i, value: 900 + i, original: 1200,
  monthly: 100 + i, amort: 100, months: 12, day: 27 + (i % 3), asOf: YM - 1, account: "trade_republic" }));
const fixed = Array.from({ length: 6 }, (_, i) => ({ id: "f" + i, name: "Recibo " + i, amount: 20 + i, freq: "mes", day: 27 + (i % 3), account: "trade_republic" }));
const accounts = [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 5000, role: "diario", spendFrom: true }];

async function abre(page, extra = {}) {
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, bankTx: [], flows: [], oneoffs: [], settings, accounts, debts, fixed, expenses: [] }, extra));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}

// La tarjeta entera dentro de lo visible: ni bajo el borde de arriba ni bajo la barra inferior.
async function enVista(page, id) {
  await expect.poll(() => page.evaluate((id) => {
    const c = document.querySelector('[data-debt-id="' + id + '"]');
    if (!c) return "sin tarjeta";
    const r = c.getBoundingClientRect(), nav = document.querySelector(".botnav");
    const abajo = innerHeight - (nav ? nav.offsetHeight : 0);
    return r.top >= 0 && r.bottom <= abajo ? "ok" : "fuera " + Math.round(r.top) + "–" + Math.round(r.bottom) + " de 0–" + abajo;
  }, id), { timeout: 5_000 }).toBe("ok");
}

// Muestrea el scroll de la página de la tarjeta frame a frame durante un segundo.
async function grabaScroll(page, id) {
  await page.evaluate((id) => {
    window.__muestras = [];
    const t0 = performance.now();
    const loop = () => {
      const c = document.querySelector('[data-debt-id="' + id + '"]'), pg = c && c.closest(".page");
      if (pg) window.__muestras.push(Math.round(pg.scrollTop));
      if (performance.now() - t0 < 1200) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, id);
}

test("desde Plan › Recibos: la cuota lleva a su deuda deslizando, y queda entera a la vista", async ({ page }) => {
  await abre(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const due = page.locator('.page-live .v4-screen > [data-seg="recibos"]').getByTestId("plan-due");
  await due.getByRole("button", { name: /Ver los/ }).click();
  const fila = due.locator(".v4-charge").filter({ hasText: "Deuda 6" });
  await fila.scrollIntoViewIfNeeded();
  // Desde la 4.26.200 la cuota abre su ficha (con el cargo enlazado en Gastos) y «Ver en Deudas» lleva a ella.
  await fila.click();
  await page.locator('.v4-sheet[data-sheet="deuda"] [data-act="ver-deuda"]').click();
  await grabaScroll(page, "d6");
  await expect(page.locator('.v4-seg-btn[data-seg="deudas"]')).toHaveAttribute("aria-selected", "true");
  await enVista(page, "d6");
  // Entra con la animación de las secciones y se resalta, sin inventar otra transición.
  await expect(page.locator('[data-seg="deudas"]').first()).not.toHaveClass(/v4-seg-enter-down/, { timeout: 2_000 });
  expect(await page.evaluate(() => window.__scrollPedidos.map((p) => p.behavior))).toContain("smooth");
  await page.waitForTimeout(1300);
  const m = await page.evaluate(() => window.__muestras);
  const ini = m[0], fin = m[m.length - 1];
  expect(fin, "la página tenía que bajar hasta la tarjeta").toBeGreaterThan(ini + 200);
  // Deslizando: varios frames con el scroll a medio camino. Un salto da cero.
  const intermedios = new Set(m.filter((v) => v > ini + 2 && v < fin - 2));
  expect(intermedios.size, "frames a medio camino: " + JSON.stringify(m)).toBeGreaterThanOrEqual(4);
});

/* Desde Tus recibos (dueño, 12/11: «va hacia la deuda de forma muy violenta, rapidísimo pero no suave»).
   Antes: Tus recibos salía, a los 320 ms Deudas entraba deslizando y la página se desplazaba a la vez.
   Ahora Deudas se coloca debajo, quieta y ya en la tarjeta, y el único movimiento es el de «Atrás»: Tus
   recibos se va de lado y la descubre. Se mira por fotograma dónde está la página y por dónde va Tus recibos. */
test("desde Tus recibos: la cuota descubre su deuda ya en su sitio, en un solo movimiento", async ({ page }) => {
  await abre(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator('.page-live .v4-screen > [data-seg="recibos"]').getByTestId("plan-todos").click();
  const hub = page.locator('[data-bills-manage] [data-screen="bills-home"]');
  await hub.locator('[data-mg-more="debt"]').click();
  const fila = hub.locator('[data-mg-sec="debt"] [data-bill-id="d6"]');
  await fila.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const f = await page.evaluate(() => new Promise((ok) => {
    const push = document.querySelector("[data-bills-manage]"), out = [], t0 = performance.now();
    document.querySelector('[data-mg-sec="debt"] [data-bill-id="d6"]').click();
    const paso = () => {
      const c = document.querySelector('[data-debt-id="d6"]'), pg = c && c.closest(".page"), capa = document.querySelector('.page-live .v4-screen > [data-seg="deudas"]');
      const p = document.querySelector("[data-bills-manage]");
      out.push({ t: performance.now() - t0, x: p ? p.getBoundingClientRect().left : null, st: pg ? Math.round(pg.scrollTop) : null,
        entra: !!(capa && /v4-seg-enter/.test(capa.className)), foco: !!(c && c.classList.contains("v4-foco")) });
      if (performance.now() - t0 < 1400) requestAnimationFrame(paso); else ok(out);
    };
    requestAnimationFrame(paso);
  }));
  const dbg = JSON.stringify(f.map((x) => Math.round(x.t) + ":" + (x.x == null ? "-" : Math.round(x.x)) + "/" + x.st));
  await expect(page.locator('.v4-seg-btn[data-seg="deudas"]')).toHaveAttribute("aria-selected", "true");
  await enVista(page, "d6");
  const fin = f[f.length - 1].st;
  // Mientras Tus recibos se va, la página de debajo ya está quieta en la tarjeta: nada se mueve a la vez.
  const saliendo = f.filter((x) => x.x != null && x.x > 2);
  expect(saliendo.length, "Tus recibos no salió deslizando " + dbg).toBeGreaterThanOrEqual(4);
  expect(saliendo.every((x) => x.st === fin), "la página se movía mientras Tus recibos salía " + dbg).toBe(true);
  expect(saliendo.every((x, i) => i === 0 || x.x >= saliendo[i - 1].x - 0.5), "Tus recibos no salió en un solo sentido " + dbg).toBe(true);
  // Sin entrada de sección ni scroll suave por encima: el movimiento es solo el de salir.
  expect(f.some((x) => x.entra), "Deudas entró deslizando además").toBe(false);
  expect(await page.evaluate(() => window.__scrollPedidos.map((p) => p.behavior))).not.toContain("smooth");
  // El resalte se ve cuando ya se ha descubierto, no a medias por debajo.
  const primerFoco = f.find((x) => x.foco);
  expect(primerFoco, "sin resalte " + dbg).toBeTruthy();
  expect(primerFoco.x == null || primerFoco.x > 300, "el resalte empezó tapado " + dbg).toBe(true);
});

test("desde Gastos: «Abrir en Plan · Deudas» con cuotas de una sola deuda aterriza en su tarjeta", async ({ page }) => {
  await abre(page, { expenses: [{ id: "c6", merchant: "CUOTA D6", date: "2026-09-20T12:00:00Z", amount: 106, category: "deudas", debtId: "d6", source: "ob", ent: "trade_republic" }] });
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
  const gris = gastosRoot(page).locator('[data-gx-day="20260920"] .gx-gris[data-gris="deuda"]');
  await gris.locator(".gx-gris-h").click();
  await gris.locator(".gx-gris-plan").click();
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
  await expect(page.locator('.page-scroll-host .v4-seg-btn.on')).toContainText("Deudas");
  await enVista(page, "d6");
});

test("con movimiento reducido llega igual de exacto, sin deslizar ni resaltar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await abre(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const due = page.locator('.page-live .v4-screen > [data-seg="recibos"]').getByTestId("plan-due");
  await due.getByRole("button", { name: /Ver los/ }).click();
  const fila = due.locator(".v4-charge").filter({ hasText: "Deuda 6" });
  await fila.scrollIntoViewIfNeeded();
  await fila.click();
  await page.locator('.v4-sheet[data-sheet="deuda"] [data-act="ver-deuda"]').click();
  await enVista(page, "d6");
  expect(await page.evaluate(() => window.__scrollPedidos.map((p) => p.behavior))).not.toContain("smooth");
});
