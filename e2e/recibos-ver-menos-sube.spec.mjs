import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Tus recibos, dos peticiones del dueño del 13/11/2026 (beta 4.26.231). Datos inventados.
   - «Ver menos» de «Ver los 13»: «¿podría subir suave hasta arriba cuando le das "Ver menos" cuando hay
     tantos?». Plegar diez recibos desde abajo le dejaba lejos del principio de la sección. Ahora la vista
     sube CON el pliegue, a la vez y con la misma curva, y deja el título de la sección arriba. Con una
     lista corta, o con el título ya a la vista, no se mueve nada (lo de siempre).
   - La tarjeta «Se te van cada mes» salió en su móvil con el HUECO de la cifra: la cifra entraba fundiéndose
     desde opacidad 0 y ahí se quedó. Ahora no se funde al entrar, y la del ⇆ no puede quedarse a medias.
   Por fotograma y con la CPU a ×6 (AGENTS §7 bis). */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const recibo = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
// Trece recibos (seis compartidos: Personas con «Ver los 6») y diez cuotas: una página larga como la suya.
// Con ocho cuotas, las cinco plegadas (~400 px) son una lista corta.
const trece = Array.from({ length: 13 }, (_, i) => recibo("r" + i, "Recibo " + i, 10 + i, 1 + i,
  i < 6 ? { amount: 10, bankAmount: 15, reparto: [{ id: "p" + i, n: "Persona " + i, via: "bizum", amt: 5 }] } : null));
const cuotas = (n) => Array.from({ length: n }, (_, i) => ({ id: "d" + i, name: "Préstamo " + i, value: 5000, original: 9000, monthly: 100 + i, day: 1 + i, account: "sabadell" }));

async function abreTusRecibos(page, nCuotas = 10) {
  test.info().annotations.push({ type: "own-clock" });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.clock.install({ time: new Date("2026-11-11T12:00:00+01:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await page.addInitScript(() => {
    window.__scrolls = []; window.__espia = false;
    const d = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
    Object.defineProperty(Element.prototype, "scrollTop", { configurable: true, get() { return d.get.call(this); }, set(v) { if (window.__espia) window.__scrolls.push(v); d.set.call(this, v); } });
  });
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-11-11", bankTx: [], debts: cuotas(nCuotas), flows: [], oneoffs: [], expenses: [], settings, fixed: trece,
    accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator('.page-live .v4-screen > [data-seg="recibos"]').getByTestId("plan-todos").click();
  await expect(page.locator('[data-mg-more="serv"]')).toHaveText("Ver los 13");
}
const frena = async (page) => (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 6 });
// Deja el botón de la sección `id` a `y` px del borde de arriba de la pantalla.
const ponBoton = (page, id, y) => page.evaluate(([id, y]) => {
  const p = document.querySelector(".v4-bills-push"), b = document.querySelector('[data-mg-more="' + id + '"]');
  p.scrollTop += b.getBoundingClientRect().top - y;
}, [id, y]);
// Clic crudo en «Ver menos» y, por fotograma: alto del pliegue, scroll y dónde está el título de la sección.
const pliega = (page, id) => page.evaluate((id) => new Promise((ok) => {
  const p = document.querySelector(".v4-bills-push"), b = document.querySelector('[data-mg-more="' + id + '"]');
  const f = document.getElementById("mg-mas-" + id), h = f.closest("section").querySelector(".pr6-sec-h");
  const arriba = p.getBoundingClientRect().top + p.clientTop;
  const out = [], t0 = performance.now();
  window.__espia = true; window.__scrolls = [];
  b.click();
  const paso = () => {
    out.push({ t: performance.now() - t0, h: f.getBoundingClientRect().height, s: p.scrollTop, head: h.getBoundingClientRect().top - arriba });
    if (performance.now() - t0 < 1700) requestAnimationFrame(paso); else { window.__espia = false; ok({ out, escrituras: window.__scrolls.length }); }
  };
  requestAnimationFrame(paso);
}), id);

test("«Ver menos» de «Ver los 13» desde abajo: la vista sube con el pliegue y deja el título arriba", async ({ page }) => {
  await abreTusRecibos(page);
  await page.locator('[data-mg-more="serv"]').click();
  await expect(page.locator('[data-mg-more="serv"]')).toHaveText("Ver menos");
  await page.waitForTimeout(1500);
  await frena(page);
  await ponBoton(page, "serv", 700);
  await page.waitForTimeout(300);
  const { out } = await pliega(page, "serv");
  const a = out[0], z = out[out.length - 1];
  expect(a.head, "el título empezaba fuera por arriba").toBeLessThan(-200);
  // Aterriza exacto: el título a 12 px del borde de arriba.
  expect(Math.abs(z.head - 12), JSON.stringify(out.map((x) => Math.round(x.head)))).toBeLessThanOrEqual(2);
  // Un solo movimiento: el scroll solo baja y nunca da un salto (a ×6, ~16-34 ms por fotograma).
  const pasos = out.slice(1).map((x, i) => out[i].s - x.s);
  expect(Math.min(...pasos), "el scroll vuelve atrás").toBeGreaterThanOrEqual(-1);
  expect(Math.max(...pasos), "salto de scroll: " + pasos.map(Math.round).join(",")).toBeLessThan(60);
  // A la vez y con la misma curva que el pliegue: en cada fotograma, los dos al mismo porcentaje.
  const ds = a.s - z.s;
  const desfase = Math.max(...out.map((x) => Math.abs((a.s - x.s) / ds - (a.h - x.h) / a.h)));
  expect(desfase, "pliegue y scroll desacompasados").toBeLessThan(0.12);
});

test("«Ver menos» de una lista larga con el título a la vista: no se mueve nada", async ({ page }) => {
  await abreTusRecibos(page);
  // Cuotas (siete plegadas, larga) con el botón abajo del todo y su título aún a la vista: no sube.
  await page.locator('[data-mg-more="debt"]').evaluate((b) => b.click());
  await page.waitForTimeout(1500);
  await ponBoton(page, "debt", 880);
  await page.waitForTimeout(300);
  const c = await pliega(page, "debt");
  expect(c.out[0].head, "el título de Cuotas estaba a la vista").toBeGreaterThanOrEqual(0);
  expect(c.out[0].h, "y la lista es larga").toBeGreaterThan(450);
  expect(c.escrituras).toBe(0);
});

test("«Ver menos» de una lista corta con su título fuera: no se mueve nada", async ({ page }) => {
  await abreTusRecibos(page, 8);
  await page.locator('[data-mg-more="debt"]').evaluate((b) => b.click());
  await page.waitForTimeout(1200);
  await ponBoton(page, "debt", 200);
  await page.waitForTimeout(300);
  const r = await pliega(page, "debt");
  expect(r.out[0].head, "el título de Cuotas empezaba fuera").toBeLessThan(0);
  expect(r.out[0].h, "y la lista es corta").toBeLessThan(450);
  expect(r.escrituras).toBe(0);
});

test("«Se te van cada mes»: la cifra se ve al entrar y no se queda apagada tras el ⇆", async ({ page }) => {
  await abreTusRecibos(page);
  const cifra = page.locator("[data-bills-total]");
  // Al entrar, ninguna animación sobre la cifra: no hay fotograma en que valga 0 ni nada que pueda quedarse a medias.
  expect(await cifra.evaluate((el) => [getComputedStyle(el).opacity, el.getAnimations().length])).toEqual(["1", 0]);
  // ⇆: se funde, y aunque la animación se atasque en su primer fotograma (lo que vio en su móvil), se ve.
  await page.locator("[data-bills-hero]").evaluate((b) => b.click());
  const atascada = await page.locator("[data-bills-total]").evaluate((el) => {
    const a = el.getAnimations(); a.forEach((x) => { x.pause(); x.currentTime = 0; });
    return [a.length, getComputedStyle(el).opacity];
  });
  expect(atascada).toEqual([1, "0"]);
  await page.waitForTimeout(800);
  expect(await page.locator("[data-bills-total]").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await expect(page.locator("[data-bills-total]")).not.toHaveText("");
});
