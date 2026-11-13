import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Los despliegues de Recibos, fotograma a fotograma contra Personas (dueño, 12/11/2026, tras la 230:
   «el desplegar en recibos, como las personas… que es la ostia la animación»). Datos inventados.
   Lo que se veía en sus vídeos y aquí se mide, con la CPU a ×6 (AGENTS §7 bis):
   - El HUECO. La rejilla 0fr→1fr da a la caja f·alto y a la fila de dentro f²·alto; recortando el
     contenido por la fila, entre las filas y «Ver menos» se abría un vacío de hasta un cuarto del
     alto (205 px con diez recibos). En Personas caía dentro de su tarjeta y no se notaba.
   - La VELOCIDAD. Con el mismo .35 s, diez recibos (~820 px) iban a ~7 px/ms y tres personas a ~1,5.
   - La OPACIDAD. Personas enciende el texto con la tarjeta ya puesta; Recibos apagaba la tarjeta
     entera, así que lo que crecía era fondo.
   Y nada de esto desplaza la página por su cuenta. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const YM = 2026 * 12 + 11;
const recibo = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const gente = [["p1", "Pol"], ["p2", "Alex"], ["p3", "Gis"], ["p4", "Iyari"], ["p5", "Carlos"], ["p6", "Mamá"]];
// Trece recibos (diez plegados, como los suyos), seis compartidos con una persona cada uno (tres plegadas).
const trece = Array.from({ length: 13 }, (_, i) => recibo("r" + i, "Recibo " + i, 10 + i, 12 + i,
  i < 6 ? { bankAmount: 15 + i, reparto: [{ id: gente[i][0], n: gente[i][1], via: "bizum", amt: 5 }] } : null));
const pausados = Array.from({ length: 5 }, (_, i) => recibo("z" + i, "Pausado " + i, 9 + i, 3 + i, { pausedUntil: YM + 2 }));

async function abrePlan(page, fixed) {
  test.info().annotations.push({ type: "own-clock" });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.clock.install({ time: new Date("2026-11-11T12:00:00+01:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await page.addInitScript(() => {
    window.__scrolls = []; window.__espia = false;
    const apunta = (que) => { if (window.__espia) window.__scrolls.push(que); };
    for (const k of ["scrollIntoView", "scrollTo", "scrollBy"]) {
      const o = Element.prototype[k];
      Element.prototype[k] = function () { apunta(k); return o.apply(this, arguments); };
    }
    const d = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
    Object.defineProperty(Element.prototype, "scrollTop", { configurable: true, get() { return d.get.call(this); }, set(v) { apunta("scrollTop"); d.set.call(this, v); } });
  });
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-11-11", bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], settings, fixed,
    accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
const frena = async (page) => (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 6 });
const espia = (page, on) => page.evaluate((on) => { window.__scrolls = on ? [] : window.__scrolls; window.__espia = on; return window.__scrolls; }, on);

/* Clic crudo y, por fotograma: cuánto de la caja del pliegue (lo que empuja a lo de debajo) queda
   sin contenido a la vista porque lo recorta la fila de dentro, su alto y la opacidad de la caja. */
const graba = (page, boton, pliegue) => page.evaluate(([boton, pliegue]) => new Promise((ok) => {
  const b = document.querySelector(boton), f = document.querySelector(pliegue), fin = f.querySelector(".pr6-fold-in");
  const out = [], t0 = performance.now();
  b.click();
  const paso = () => {
    const r = f.getBoundingClientRect(), ri = fin.getBoundingClientRect();
    const recorta = getComputedStyle(fin).overflowY !== "visible";
    const visto = recorta ? Math.min(r.bottom, ri.bottom) : r.bottom;
    out.push({ t: performance.now() - t0, h: r.height, hueco: r.bottom - visto, op: +getComputedStyle(f).opacity });
    if (performance.now() - t0 < 1500) requestAnimationFrame(paso); else ok(out);
  };
  requestAnimationFrame(paso);
}), [boton, pliegue]);
/* Pico de velocidad del borde (px/ms) en ventanas de ≥48 ms (tres fotogramas): con la máquina cargada
   un fotograma largo seguido de uno corto daba picos que el ojo no ve. Y el hueco más grande. */
const pico = (fr) => Math.max(...fr.map((x, i) => {
  const j = fr.findIndex((y) => y.t - x.t >= 48);
  return j > i ? Math.abs(fr[j].h - x.h) / (fr[j].t - x.t) : 0;
}));
const huecoMax = (fr) => Math.max(...fr.map((x) => x.hueco));
const txt = (fr) => fr.map((x) => Math.round(x.h) + "/" + Math.round(x.hueco)).join(" ");

test("Tus recibos: «Ver los 13» se abre y se pliega como Personas (sin hueco y a su velocidad)", async ({ page }) => {
  const recibos = await abrePlan(page, trece);
  await recibos.getByTestId("plan-todos").click();
  const hub = page.locator('[data-bills-manage] [data-screen="bills-home"]');
  await expect(hub.locator('[data-mg-more="serv"]')).toHaveText("Ver los 13");
  await expect(hub.locator('[data-mg-more="people"]')).toHaveText("Ver los 6");
  await page.waitForTimeout(500);
  await frena(page);
  await espia(page, true);
  const medir = async (id) => {
    await page.evaluate((id) => { const p = document.querySelector(".v4-bills-push"); const b = document.querySelector('[data-mg-more="' + id + '"]');
      p.scrollTop += b.getBoundingClientRect().top - 300; }, id);
    await espia(page, true);
    await page.waitForTimeout(200);
    const abre = await graba(page, '[data-mg-more="' + id + '"]', "#mg-mas-" + id);
    const cierra = await graba(page, '[data-mg-more="' + id + '"]', "#mg-mas-" + id);
    return { abre, cierra, scrolls: await espia(page, false) };
  };
  const serv = await medir("serv"), pers = await medir("people");
  for (const [n, m] of [["Recibos", serv], ["Personas", pers]]) {
    // Lo de debajo va pegado a lo que se ve: ni un fotograma con vacío en medio, abriendo ni plegando.
    expect(huecoMax(m.abre), n + " abre: " + txt(m.abre)).toBeLessThanOrEqual(2);
    expect(huecoMax(m.cierra), n + " pliega: " + txt(m.cierra)).toBeLessThanOrEqual(2);
    // La app no desplaza la página para enseñar lo abierto.
    expect(m.scrolls, n).toEqual([]);
  }
  // Las tarjetas llegan con el borde: la caja de la lista no se apaga (se enciende lo de dentro).
  expect(Math.min(...serv.abre.map((x) => x.op)), "Recibos: la caja del pliegue a opacidad 1").toBe(1);
  // Diez recibos son 4,4 veces Personas: el borde no puede ir 4 veces más rápido. Antes ~7 vs ~1,5 px/ms.
  expect(serv.abre[serv.abre.length - 1].h).toBeGreaterThan(pers.abre[pers.abre.length - 1].h * 3);
  const [ps, pp] = [pico(serv.abre), pico(pers.abre)];
  expect(ps, `pico Recibos ${ps.toFixed(2)} vs Personas ${pp.toFixed(2)} px/ms`).toBeLessThan(pp * 1.8);
  const [cs, cp] = [pico(serv.cierra), pico(pers.cierra)];
  expect(cs, `pico al plegar Recibos ${cs.toFixed(2)} vs Personas ${cp.toFixed(2)} px/ms`).toBeLessThan(cp * 1.8);
});

test("Portada de Recibos: «Ver los N» y «Ya pagados» sin hueco y sin mover la página", async ({ page }) => {
  const recibos = await abrePlan(page, trece.concat(pausados));
  const due = recibos.getByTestId("plan-due");
  await expect(due.locator("#pr6-due-more")).toHaveCount(1);
  await expect(recibos.getByTestId("plan-paid")).toBeVisible();
  await page.waitForTimeout(500);
  await frena(page);
  await espia(page, true);
  const abre = await graba(page, '[aria-controls="pr6-due-more"]', "#pr6-due-more");
  const cierra = await graba(page, '[aria-controls="pr6-due-more"]', "#pr6-due-more");
  expect(huecoMax(abre), "Por pagar abre: " + txt(abre)).toBeLessThanOrEqual(2);
  expect(huecoMax(cierra), "Por pagar pliega: " + txt(cierra)).toBeLessThanOrEqual(2);
  expect(abre[abre.length - 1].h).toBeGreaterThan(500);
  expect(pico(abre), "Por pagar no sale disparado").toBeLessThan(3.5);
  await recibos.getByTestId("plan-paid").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await espia(page, true);
  const pa = await graba(page, '[data-testid="plan-paid"] .pr6-paid-h', "#pr6-paid-list");
  const pc = await graba(page, '[data-testid="plan-paid"] .pr6-paid-h', "#pr6-paid-list");
  expect(huecoMax(pa), "Ya pagados abre: " + txt(pa)).toBeLessThanOrEqual(2);
  expect(huecoMax(pc), "Ya pagados pliega: " + txt(pc)).toBeLessThanOrEqual(2);
  expect(await espia(page, false), "la app desplazó la página al desplegar o plegar").toEqual([]);
});
