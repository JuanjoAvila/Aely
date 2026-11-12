import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Recibos, suave de punta a punta (peticiones del dueño del 12/11/2026, con su vídeo). Datos inventados.
   - Todo lo que se despliega va como Personas en Tus recibos («ese es el smooth que busco»): la misma
     rejilla, el mismo tiempo, la misma curva, y el hueco de arriba crece con el pliegue en vez de salir
     de golpe. Y nada desplaza la página solo al abrir o plegar («Ver los N», «Ver menos», «Ya pagados»).
   - «¿Te llega?» › «¿Y si gasto…?»: el importe sube en un solo movimiento, sin saltos de un fotograma.
   - Editar › «Más opciones»: un toque no sube la hoja a otra capa (el «flash»: la hoja se veía
     transparente unos fotogramas), la hoja no corre sola cientos de píxeles y «¿Lo pagas con alguien?»
     tiene aire.
   Se mide fotograma a fotograma; con la CPU a ×6 donde el tiempo importa (AGENTS §7 bis). */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const YM = 2026 * 12 + 11;
const recibo = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const conPersona = (id, name, day, pid, n) => recibo(id, name, 10, day, { bankAmount: 20, reparto: [{ id: pid, n, via: "bizum", amt: 10 }] });
const seis = [
  conPersona("r1", "Netflix", 13, "p1", "Ana"), conPersona("r2", "Spotify", 14, "p2", "Bea"), conPersona("r3", "Disney+", 16, "p3", "Carla"),
  conPersona("r4", "HBO Max", 17, "p4", "Dani"), conPersona("r5", "Filmin", 19, "p5", "Eva"), conPersona("r6", "Prime Video", 21, "p6", "Fran")
];

async function abrePlan(page, overrides) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-11-11T12:00:00+01:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  // Espía de todo lo que la app pide para desplazar: el navegador no pasa por aquí, solo nuestro código.
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
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-11-11", bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], settings,
    accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }] }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
const espia = (page, on) => page.evaluate((on) => { window.__espia = on; if (on) window.__scrolls = []; return window.__scrolls; }, on);

// Abre o pliega con un clic crudo y apunta, por fotograma, el alto del pliegue y el relleno de arriba de su contenido.
const graba = (page, boton, pliegue, ms = 700) => page.evaluate(([boton, pliegue, ms]) => new Promise((ok) => {
  const b = document.querySelector(boton), f = document.querySelector(pliegue), fin = f.querySelector(".pr6-fold-in");
  const out = [], t0 = performance.now();
  b.click();
  const paso = () => {
    out.push({ h: f.getBoundingClientRect().height, pad: parseFloat(getComputedStyle(fin).paddingTop) || 0 });
    if (performance.now() - t0 < ms) requestAnimationFrame(paso); else ok(out);
  };
  requestAnimationFrame(paso);
}), [boton, pliegue, ms]);

test("Tus recibos: «Ver los N» despliega como Personas, con el hueco creciendo, y nada mueve la página", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: seis });
  await recibos.getByTestId("plan-todos").click();
  const hub = page.locator('[data-bills-manage] [data-screen="bills-home"]');
  await expect(hub.locator('[data-mg-more="people"]')).toHaveText("Ver los 6");
  // La misma transición en el pliegue y en su contenido, en Recibos que en Personas.
  const trans = await page.evaluate(() => ["serv", "people"].map((id) => {
    const f = document.getElementById("mg-mas-" + id), i = f.querySelector(".pr6-fold-in"), a = getComputedStyle(f), b = getComputedStyle(i);
    return [a.transitionProperty, a.transitionDuration, a.transitionTimingFunction, b.transitionProperty, b.transitionDuration, b.transitionTimingFunction].join(" / ");
  }));
  expect(trans[0]).toBe(trans[1]);
  expect(trans[0]).toContain("grid-template-rows");
  expect(trans[0]).toContain("padding");
  await espia(page, true);
  const abre = await graba(page, '[data-mg-more="serv"]', "#mg-mas-serv");
  const fin = abre[abre.length - 1];
  expect(fin.pad, "Recibos lleva hueco arriba al estar abierto").toBeGreaterThan(6);
  // El hueco no aparece de golpe: en el primer fotograma va por el principio, como el alto.
  expect(abre[0].pad, JSON.stringify(abre.map((x) => x.pad.toFixed(1)))).toBeLessThan(fin.pad * 0.75);
  const pers = await graba(page, '[data-mg-more="people"]', "#mg-mas-people");
  expect(pers[pers.length - 1].h).toBeGreaterThan(100);
  // Y al plegar tampoco se va de golpe.
  const cierra = await graba(page, '[data-mg-more="serv"]', "#mg-mas-serv");
  expect(cierra[0].pad, JSON.stringify(cierra.map((x) => x.pad.toFixed(1)))).toBeGreaterThan(fin.pad * 0.25);
  await graba(page, '[data-mg-more="people"]', "#mg-mas-people");
  await page.waitForTimeout(500);
  expect(await espia(page, false), "la app desplazó la página al desplegar o plegar").toEqual([]);
});

test("Recibos: «Ver los N», «Ver menos» y «Ya pagados» no desplazan la página", async ({ page }) => {
  const fixed = [recibo("a", "Agua", 30.5, 19), recibo("b", "Gimnasio", 40, 20), recibo("c", "Internet", 45.25, 22),
    recibo("d", "Seguro hogar", 25, 26), recibo("e", "Comunidad", 60, 28), recibo("p", "Revista", 9, 15, { pausedUntil: YM + 2 })];
  const recibos = await abrePlan(page, { fixed });
  const due = recibos.getByTestId("plan-due");
  await expect(due.getByRole("button", { name: /Ver los 5/ })).toBeVisible();
  await recibos.getByTestId("plan-paid").scrollIntoViewIfNeeded();
  await espia(page, true);
  await due.getByRole("button", { name: /Ver los 5/ }).evaluate((b) => b.click());
  await page.waitForTimeout(600);
  // Con el principio de la sección fuera por arriba, «Ver menos» antes subía la página sola hasta él.
  const antes = await espia(page, false);
  await due.getByRole("button", { name: /Ver menos/ }).evaluate((b) => b.scrollIntoView({ block: "start" }));
  await espia(page, true);
  await due.getByRole("button", { name: /Ver menos/ }).evaluate((b) => b.click());
  await page.waitForTimeout(900);
  await recibos.getByTestId("plan-paid").locator(".pr6-paid-h").evaluate((b) => b.click());
  await expect(recibos.getByTestId("plan-paid").locator(".pr6-paid-h")).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(900);
  await recibos.getByTestId("plan-paid").locator(".pr6-paid-h").evaluate((b) => b.click());
  await page.waitForTimeout(500);
  expect(antes.concat(await espia(page, false)), "la app desplazó la página al desplegar o plegar").toEqual([]);
});

test("Editar › «Más opciones»: sin flash, sin correr sola y con aire en «¿Lo pagas con alguien?»", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 800 });
  // Seis personas conocidas y un recibo compartido con cuatro: lo de su vídeo. Se edita uno sin compartir.
  const reparto = [["pe_pol", "Pol"], ["pe_alex", "Alex"], ["pe_gis", "Gis"], ["pe_iya", "Iyari"], ["pe_car", "Carlos"], ["pe_mam", "Mamá"]]
    .map(([id, n]) => ({ id, n, via: "transfer", amt: 5 }));
  const recibos = await abrePlan(page, { fixed: [recibo("yt", "YouTube Premium", 29.99, 13, { bankAmount: 59.99, reparto: reparto.slice(0, 4) }),
    recibo("luz", "Luz", 55, 15), recibo("otro", "Seguro", 20, 20, { bankAmount: 30, reparto: reparto.slice(4) })] });
  await recibos.getByTestId("plan-due").locator('[data-recibo="fixed_yt"]').click();
  await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
  const H = '.v4-sheet[data-sheet="recibo-pasos"]';
  const btn = page.locator(H + ' [data-rp4-paso="4"] [data-act="mas-opciones"]');
  // Con su reparto, «Más opciones» nace abierto: se pliega y se espera a que todo quede quieto.
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  await btn.tap();
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  await page.waitForTimeout(700);
  // Toque de verdad (eventos táctiles) y, por fotograma: el transform de la hoja, el scroll y dónde está el botón.
  const toca = async () => {
    await page.evaluate((H) => {
      const hoja = document.querySelector(H), body = hoja.querySelector(".rp4-body"), b = hoja.querySelector('[data-rp4-paso="4"] [data-act="mas-opciones"]');
      window.__f = []; const t0 = performance.now();
      const paso = () => { window.__f.push({ tf: hoja.style.transform, st: body.scrollTop, top: b.getBoundingClientRect().top - body.getBoundingClientRect().top });
        if (performance.now() - t0 < 900) requestAnimationFrame(paso); };
      requestAnimationFrame(paso);
    }, H);
    await btn.tap();
    await page.waitForTimeout(1000);
    return page.evaluate(() => window.__f);
  };
  const abre = await toca();
  expect(abre.filter((x) => x.tf), "un toque subió la hoja a otra capa").toEqual([]);
  const viaje = abre[abre.length - 1].st - abre[0].st;
  // Con todo lo que hay no cabe: basta con ver con quién lo pagas. Antes la hoja corría hasta dejar
  // «Más opciones» pegado arriba (352 px a 412×915); ahora lo justo para las caras, y él sigue a la vista.
  expect(abre[abre.length - 1].top, "«Más opciones» se fue arriba del todo").toBeGreaterThan(40);
  const saltos = abre.slice(1).map((x, i) => x.st - abre[i].st);
  expect(Math.max(0, ...saltos), JSON.stringify(abre.map((x) => Math.round(x.st)))).toBeLessThan(Math.max(30, viaje * 0.3));
  const caras = await page.evaluate((H) => {
    const h = document.querySelector(H), body = h.querySelector(".rp4-body").getBoundingClientRect(), cta = h.querySelector(".rp4-cta").getBoundingClientRect();
    const b = h.querySelector('[data-rp4-paso="4"] [data-act="mas-opciones"]').getBoundingClientRect();
    const lbl = h.querySelector(".rp5-in > .pr6-lbl").getBoundingClientRect(), grid = h.querySelector('[data-testid="rp5-grid"]');
    const g = grid.getBoundingClientRect();
    return { aLaVista: g.bottom <= Math.min(body.bottom, cta.top) + 1, bajoBoton: lbl.top - b.bottom, aCaras: g.top - lbl.bottom, entreFilas: parseFloat(getComputedStyle(grid).rowGap) };
  }, H);
  expect(caras.aLaVista, "las caras no quedaron a la vista").toBe(true);
  expect(caras.bajoBoton, "título pegado a «Más opciones»").toBeGreaterThanOrEqual(10);
  expect(caras.aCaras, "caras pegadas al título").toBeGreaterThanOrEqual(10);
  expect(caras.entreFilas, "filas de caras pegadas").toBeGreaterThanOrEqual(10);
  const cierra = await toca();
  expect(cierra.filter((x) => x.tf), "un toque subió la hoja a otra capa").toEqual([]);
});

/* «¿Y si gasto…?»: dos bancos y una nómina; la hoja llega a su tope y desplaza. «De una vez» (la hoja
   aún crece) y «A plazos» con una cifra ya puesta: lo de debajo quedaba tapado y en el primer fotograma
   el importe saltaba 116 px de 361. */
for (const conCifra of [false, true]) {
  test("¿Te llega?: el importe sube en un solo movimiento a ×6" + (conCifra ? ", a plazos y con cifra" : ""), async ({ page }) => {
    await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
    await seedLoggedInDashboard(page, { __seedOnce: true, bankTx: [], debts: [], oneoffs: [], expenses: [],
      settings: { ...settings, expenseBanks: ["sabadell", "tr"] },
      accounts: [{ id: "b1", ent: "sabadell", role: "fijos", value: 260.26 }, { id: "b2", ent: "tr", role: "fijos", value: 6771.37 }],
      flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 1800, to: "sabadell", day: 28 }],
      fixed: [recibo("luz", "Luz", 67.58, 25), recibo("gas", "Gas", 5.75, 25), recibo("gym", "Gym", 30, 27, { account: "tr" }), recibo("seg", "Seguro", 145.9, 29, { account: "tr" })] });
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
    await page.waitForFunction(() => !document.getElementById("mc-load"));
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await page.locator('.page-live [data-seg="recibos"] [data-testid="plan-llega"]').click();
    await expect(page.getByTestId("llega-banco")).toHaveCount(2);
    await page.waitForTimeout(900);
    const amt = page.getByTestId("llega-gasto-amt");
    if (conCifra) {
      await amt.click();
      for (const k of ["5", "0", "0"]) await page.locator('[data-testid="llega-sheet"] .v4-keys button[aria-label="' + k + '"]').click();
      await amt.click();
      await page.locator('[data-testid="llega-modo"] [data-modo="plazos"]').click();
      await page.waitForTimeout(900);
    }
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    const f = await page.evaluate(() => new Promise((ok) => {
      const hoja = document.querySelector('[data-testid="llega-sheet"]'), a = hoja.querySelector('[data-testid="llega-gasto-amt"]');
      const out = []; let t0 = 0, prev = 0;
      const foto = (now) => {
        out.push({ t: now - t0, dt: now - prev, y: a.getBoundingClientRect().top }); prev = now;
        if (now - t0 < 800) requestAnimationFrame(foto); else ok({ out, teclas: [...hoja.querySelectorAll(".v4-keys button")].every((b) => b.getBoundingClientRect().bottom <= hoja.getBoundingClientRect().bottom + 1) });
      };
      requestAnimationFrame((now) => { t0 = prev = now; out.push({ t: 0, dt: 0, y: a.getBoundingClientRect().top }); a.click(); requestAnimationFrame(foto); });
    }));
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const o = f.out, pasos = o.slice(1).map((x, i) => o[i].y - x.y), total = o[0].y - o[o.length - 1].y;
    const dbg = JSON.stringify(o.map((x) => Math.round(x.y) + "@" + Math.round(x.dt)));
    expect(total, "el importe ni se movió").toBeGreaterThan(80);
    expect(Math.min(...pasos), "el importe bajó en algún fotograma " + dbg).toBeGreaterThan(-0.5);
    /* Ningún fotograma va más deprisa que la curva del teclado en su arranque (2,8 veces la media en .35 s),
       con margen: un salto de un fotograma (116 px en 17 ms) es el doble. Por milisegundo, para que un
       fotograma largo de la máquina no cuente como salto. */
    const tope = 1.6 * 2.8 * total / 350;
    const rapido = o.slice(1).map((x, i) => pasos[i] / Math.max(1, x.dt));
    expect(Math.max(...rapido), "salto de un fotograma " + dbg).toBeLessThan(tope);
    const ultimo = o.filter((x, i) => i > 0 && Math.abs(pasos[i - 1]) > 0.5).pop();
    expect(ultimo.t, "un segundo empujón cuando ya parecía quieto " + dbg).toBeLessThan(420);
    expect(f.teclas, "el teclado no quedó entero a la vista").toBe(true);
  });
}
