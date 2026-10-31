import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, installFixtureClock, dismissNews } from "./fixtures.mjs";

/* «AL BAJAR RÁPIDO HAY PARADAS; REVOLUT NO LAS TIENE» (vídeo suyo del 26/10, Gastos → Movimientos
   en modo Meses, OnePlus 13 a 120 Hz). Mirado fotograma a fotograma, cada fling acababa igual: la
   lista a toda velocidad y, de golpe, quieta en «Cargando más…». No era un frame caro: era el
   final de lo pintado. El fling lo mueve el compositor y, si llega al borde antes que la tanda,
   se acaba ahí y no vuelve.

   Cómo se reproduce aquí sin dedo de verdad (los toques sintéticos de CDP no dejan inercia en
   Chromium de escritorio): ruedas a ritmo de reloj con velocidad que decae, como un fling. La
   rueda también la mueve el compositor, así que si la lista se acaba lo que sobra SE PIERDE.
   Con CPU a 6× (AGENTS §7 bis), medido el 26/10 contra la 4.26.182:
     antes  → se perdían 550-1.200 px de 32.000 y 7 frames de más de 60 ms (peor 117-150 ms)
     ahora  → 0 px perdidos y 0-1 frames de más de 60 ms (peor 50-67 ms)
   Lo que se vigila es el recorrido perdido (el tope): no depende de lo cargada que vaya la
   máquina. Los frames salen en el log para comparar, pero no se asertan: con otra suite
   corriendo a la vez en el mismo PC (26/10) el arreglo dio 8 frames de más de 60 ms, los mismos
   que la base en frío, y un umbral así fallaría por la máquina y no por el código. */
test.use({ serviceWorkers: "block" });
const N = 2000;

function fixture(n) {
  // ~8 movimientos al día durante ocho meses hacia atrás: el modo Meses va cambiando de mes al bajar.
  const expenses = Array.from({ length: n }, (_, i) => ({
    id: "44444444-4444-4444-8444-" + String(i).padStart(12, "0"),
    date: new Date(Date.parse("2026-09-26T21:00:00Z") - i * 3 * 3600000 - (i % 5) * 600000).toISOString(),
    amount: i % 23 === 0 ? -(50 + (i % 300)) : 2 + (i % 41) * 1.37, merchant: "Comercio " + (i % 57), note: i % 3 ? "" : "Nota " + i,
    category: ["super", "bares", "transporte", "ocio", "hogar"][i % 5], source: i % 2 ? "bank" : "manual", ent: i % 4 ? "sabadell" : "revolut",
  }));
  return { expenses, accounts: [
    { id: "e2e", ent: "sabadell", name: "Cuenta", value: 1000, role: "diario", spendFrom: true },
    { id: "e2r", ent: "revolut", name: "Rev", value: 500, role: "diario", spendFrom: true }] };
}

test("un fling largo hacia abajo en Movimientos no se estrella en «Cargando más…»", async ({ page }) => {
  test.setTimeout(150_000);
  await installFixtureClock(page);
  await seedLoggedInDashboard(page, fixture(N));
  await page.goto("/");
  await page.waitForFunction(() => !!document.querySelector(".botnav") && !document.getElementById("mc-load"), null, { timeout: 60_000 });
  await dismissNews(page);
  // Click crudo: el `locator.click()` sondea el DOM y ensucia la medida (§7 bis).
  await page.evaluate(() => document.querySelector('.botnav-tab[data-tour="gastos"]').click());
  await page.waitForFunction(() => !!document.querySelector(".page-scroll-host .gx-root .gx-dia"));
  await page.waitForTimeout(1500);
  expect(await page.locator(".page-scroll-host .gx-list .sentinel").count(), "con 2.000 gastos tiene que quedar lista por pintar").toBe(1);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.evaluate(() => {
    window.__f = []; window.__on = true; let last = 0;
    const loop = (t) => { if (!window.__on) return; if (last) window.__f.push(t - last); last = t; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  // Seis flings seguidos, como él: v0 = 12 px/ms que decae con τ = 500 ms (~6.000 px cada uno).
  const V0 = 12, TAU = 500, DUR = 1100;
  let pedido = 0;
  for (let i = 0; i < 6; i++) {
    const t0 = Date.now(); let prev = 0;
    while (Date.now() - t0 < DUR) {
      await new Promise((r) => setTimeout(r, 8));
      const pos = V0 * TAU * (1 - Math.exp(-(Date.now() - t0) / TAU)), d = pos - prev;
      if (d >= 1) { prev = pos; pedido += d; cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 200, y: 500, deltaX: 0, deltaY: d }).catch(() => {}); }
    }
  }
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { window.__on = false; return { f: window.__f, st: document.querySelector(".page-scroll-host").scrollTop }; });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  // El gesto tiene que aterrizar: si la lista ni se movió, la medida no vale.
  expect(r.st, "las ruedas no movieron la lista: la muestra no vale").toBeGreaterThan(5000);
  const perdido = Math.round(pedido - r.st), enormes = r.f.filter((x) => x > 60).length;
  console.log(`[fling] pedido ${Math.round(pedido)} px · recorrido ${Math.round(r.st)} px · perdido ${perdido} px · frames >32 ms ${r.f.filter((x) => x > 32).length} · >60 ms ${enormes} · peor ${Math.round(Math.max(...r.f))} ms`);
  expect(perdido, "el fling se ha estrellado en el final de lo pintado (antes: 550-1.200 px perdidos)").toBeLessThanOrEqual(200);
});
