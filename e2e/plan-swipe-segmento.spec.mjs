/* DESLIZAR VERTICAL EN PLAN CAMBIA DE SECCIÓN (petición 2026-08-03).
 *
 * «que cuando estés en Plan, cuando deslices de arriba a abajo se pase a deudas, y en deudas a
 * metas, y de metas otra vez a recibos, para no tener que pulsar arriba porque si es un móvil
 * largo y lo tienes cogido con una mano, ya tienes que depender de la otra».
 *
 * El gesto vive en `14-v4-screens.js` (PlanTab) y SOLO se activa en los extremos del scroll del
 * `.page` de Plan —arriba del todo tirando hacia abajo, o abajo del todo tirando hacia arriba—,
 * igual que el pull-down del perfil en Inicio. A mitad de una lista larga tiene que seguir siendo
 * scroll normal. Y no puede robarle nada al swipe horizontal entre pestañas (Inicio/Gastos/Plan/
 * Cartera), que vive en `11-app-main.js` y escucha los mismos toques desde más arriba en el DOM. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";
import { execFileSync } from "node:child_process";

async function appLista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

const pestanaActiva = (page) =>
  page.evaluate(() => {
    const b = document.querySelector(".botnav-tab.active");
    return b ? b.getAttribute("data-tour") : null;
  });

// El wrapper del segmento visible lleva `data-seg` y `aria-hidden="false"` (los otros dos,
// montados pero escondidos con `content-visibility:hidden`, llevan `aria-hidden="true"`).
const segmentoActivo = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-seg][aria-hidden="false"]');
    return el ? el.getAttribute("data-seg") : null;
  });

/** Marcar la pestaña como activa NO significa haber llegado: el carrusel sigue deslizándose ~420 ms
 *  después. Lanzar el gesto ahí dentro hacía que fallara UNA prueba distinta en cada pasada (1 de 6,
 *  siempre la que pillaba el peor momento) — un dedo de verdad no arrastra a mitad de la transición.
 *  Se espera a que el track esté QUIETO, no a un número de milisegundos. */
async function irAPlan(page) {
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("plan");
  await esperarCarruselQuieto(page);
}

async function esperarCarruselQuieto(page) {
  await page.evaluate(()=>{window.__trQuieto=null;});
  await page.waitForFunction(
    () => {
      const tr = document.querySelector(".track");
      if (!tr) return false;
      const ahora = getComputedStyle(tr).transform;
      const quieto = window.__trQuieto;
      window.__trQuieto = { v: ahora, n: quieto && quieto.v === ahora ? quieto.n + 1 : 0 };
      return window.__trQuieto.n >= 3;
    },
    null,
    { timeout: 10_000, polling: "raf" },
  );
}

/** Arrastre vertical real por CDP (mismo patrón que `swipe-pestanas.spec.mjs`/`profile-anim.spec.mjs`):
 *  un gesto sintético de Playwright siempre acaba en `touchend` limpio, así que esto basta para
 *  probar el camino normal; no hace falta simular `touchcancel` aquí porque eso ya lo cubre
 *  `swipe-pestanas.spec.mjs` para el mecanismo compartido del `.viewport`. */
async function deslizarV(page, cdp, { x = 196, y0, dy, pasos = 10, intervalo = 16 } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + (dy * i) / pasos }] });
    await new Promise((r) => setTimeout(r, intervalo));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Como `deslizarV` pero con una DERIVA lateral (dx) además de la vertical (dy): un pulgar de
 *  verdad casi nunca baja en línea perfectamente recta. Existe para el rechazo real del usuario
 *  (3/8): «al ir hacia abajo se vuelve loco y cambia también de tabs» — el gesto vertical de
 *  `deslizarV` (dx=0 fijo) nunca podría haber cazado ese caso. */
async function deslizarDiag(page, cdp, { x0, y0, dx, dy, pasos = 10 } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (dx * i) / pasos, y: y0 + (dy * i) / pasos }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

const debts = Array.from({ length: 16 }, (_, i) => ({
  id: "d" + i, name: "Préstamo " + i, value: 6000 + i * 900, monthly: 180 + i * 12,
  apr: 5.5, account: "e2e", start: "2024-01-15", anchor: 8000 + i * 900,
}));
const goals = Array.from({ length: 3 }, (_, i) => ({
  id: "g" + i, name: "Meta " + i, target: 3000 + i * 500, saved: 400 + i * 220, emoji: "🎯", account: "e2e",
}));

// (a) Deslizar hacia abajo arriba del todo recorre el círculo Recibos → Deudas → Metas → Recibos.
test("deslizar hacia abajo arriba del todo recorre Recibos → Deudas → Metas → Recibos", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  const cdp = await page.context().newCDPSession(page);

  expect(await segmentoActivo(page)).toBe("recibos");

  await deslizarV(page, cdp, { y0: 260, dy: 190 });
  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("deudas");

  await deslizarV(page, cdp, { y0: 260, dy: 190 });
  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("metas");

  // Y de Metas otra vez a Recibos: el círculo se cierra, tal cual lo pidió.
  await deslizarV(page, cdp, { y0: 260, dy: 190 });
  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("recibos");
});

// Abajo del todo: tirar hacia arriba es la OLA, no cambia de sección (feedback 4/8 noche).
test("abajo del todo, tirar hacia arriba no cambia de sección", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  const cdp = await page.context().newCDPSession(page);

  expect(await segmentoActivo(page)).toBe("recibos");
  await page.evaluate(() => {
    const pg = document.querySelectorAll(".page")[2];
    pg.scrollTop = pg.scrollHeight;
  });
  await deslizarV(page, cdp, { y0: 500, dy: -190 });
  await page.waitForTimeout(150);
  expect(await segmentoActivo(page), "abajo del todo no debería cambiar de sección").toBe("recibos");
  expect(await pestanaActiva(page)).toBe("plan");
});

// (b) A mitad de una lista larga de Deudas, tirar hacia abajo sigue siendo scroll normal: NO
// cambia de sección. Es la comprobación que de verdad importa (el umbral está para esto).
test("a mitad de una lista larga de Deudas, tirar no cambia de sección", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);

  // Entra en Deudas tocando el segmentado (gesto ya probado en el otro test).
  await page.locator(".v4-seg-btn", { hasText: /deuda/i }).click();
  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("deudas");

  // 16 deudas exceden de sobra el alto de un Pixel 5: confirma que la lista scrollea de verdad
  // antes de fiarse de la prueba (si no scrollea, el test no comprobaría nada).
  await expect.poll(() => page.evaluate(() => {
    const pg = document.querySelectorAll(".page")[2];
    return pg.scrollHeight > pg.clientHeight + 200;
  }), { timeout: 10_000 }).toBe(true);

  // A mitad de scroll, ni arriba ni abajo del todo.
  await page.evaluate(() => { document.querySelectorAll(".page")[2].scrollTop = 300; });
  const antes = await page.evaluate(() => document.querySelectorAll(".page")[2].scrollTop);
  expect(antes).toBeGreaterThan(0);

  const cdp = await page.context().newCDPSession(page);
  // Mismo gesto que el de arriba (tirón hacia abajo, de sobra para pasar el umbral SI estuviera
  // arriba del todo) pero a mitad de lista: tiene que quedarse como scroll normal.
  await deslizarV(page, cdp, { y0: 260, dy: 190 });
  await page.waitForTimeout(150);

  expect(await segmentoActivo(page), "tirar a mitad de lista cambió de sección: no debería").toBe("deudas");
  const despues = await page.evaluate(() => document.querySelectorAll(".page")[2].scrollTop);
  expect(despues, "el scroll normal de la lista se quedó bloqueado").not.toBe(antes);
  expect(await pestanaActiva(page), "a mitad de lista también cambió de pestaña").toBe("plan");
});

/* Mitad de lista + arco de pulgar: el caso real del rechazo 4/8 noche («si deslizas hacia abajo
 * no debería cambiar»). Antes el viewport bloqueaba el eje en horizontal a los ~12 px y mataba
 * el scroll / cambiaba de tab; ahora exige ventaja clara a mitad de lista. */
test("a mitad de Deudas, un arco de pulgar no cambia de sección ni de pestaña", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  await page.locator(".v4-seg-btn", { hasText: /deuda/i }).click();
  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("deudas");
  await page.evaluate(() => { document.querySelectorAll(".page")[2].scrollTop = 300; });
  const cdp = await page.context().newCDPSession(page);
  await arcoPulgar(page, cdp, { x0: 196, y0: 260, dx: 40, dy: 190 });
  await page.waitForTimeout(150);
  expect(await segmentoActivo(page)).toBe("deudas");
  expect(await pestanaActiva(page)).toBe("plan");
});

// Rechazo real del usuario (3/8, 14:03): «al ir hacia abajo se vuelve loco y cambia también de
// tabs». Causa: el gesto vertical de Plan y el swipe horizontal de `.viewport` escuchan el MISMO
// touchmove por separado y cada uno decidía el eje a su aire — un tirón con algo de deriva
// lateral (normal con el pulgar) podía convencer a los dos a la vez. Fix: en cuanto el de Plan
// se declara vertical, `stopPropagation()` dentro del propio `onMove` para que el listener
// horizontal ni se entere de ese touchmove (mismo idioma que `stopSwipe` para los chips de Gastos).
test("un tirón hacia abajo con algo de deriva lateral cambia de sección, no de pestaña", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  const cdp = await page.context().newCDPSession(page);

  expect(await segmentoActivo(page)).toBe("recibos");
  expect(await pestanaActiva(page)).toBe("plan");

  // Mayormente vertical (dy=190) pero con una deriva lateral real (dx=40) — sigue siendo "y" con
  // el margen 1.25× que usan ambos gestos, así que un pulgar normal cae aquí a menudo.
  await deslizarDiag(page, cdp, { x0: 196, y0: 260, dx: 40, dy: 190 });

  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("deudas");
  // Lo que falló de verdad: la pestaña activa NUNCA debería moverse de "plan" con este gesto.
  expect(await pestanaActiva(page), "el tirón vertical también cambió de pestaña").toBe("plan");
});

/** ARCO DE PULGAR: el dedo sale hacia el LADO y baja después, en vez de llevar una deriva
 *  constante como `deslizarDiag`. Es como se mueve una mano que agarra el móvil (el pulgar pivota
 *  sobre su base) y es el caso que se escapó dos veces: con deriva constante, |ddy| ya le saca
 *  ventaja a |ddx| desde el primer píxel y el gesto se clasifica bien de casualidad. */
async function arcoPulgar(page, cdp, { x0, y0, dx, dy, pasos = 14 } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    const u = i / pasos;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x0 + dx * Math.sqrt(u), y: y0 + dy * u * u }],
    });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/* RECHAZO DEL 4/8 («al ir hacia abajo se vuelve loco y cambia también de tabs — SIGUE PASANDO
 * IGUAL»). El `stopPropagation` del arreglo anterior no tocó la causa: los dos gestos decidían el
 * eje POR PROPORCIÓN (|ddx| > |ddy|·1,25) en cuanto el dedo pasaba de 10 px, y en un arco de pulgar
 * a los 10 px se lleva recorrido 11 px de lado y 1 hacia abajo — o sea, HORIZONTAL para siempre,
 * por muy vertical que acabe siendo el tirón. Medido el 4/8: una bajada de 190 px con 40 px de
 * deriva no cambiaba de sección (se la quedaba el swipe de pestañas). Ahora el eje lo decide
 * `gestureAxis` (00-core.js), el MISMO para los dos gestos, y por ventaja en píxeles. */
test("un arco de pulgar hacia abajo cambia de sección, no de pestaña", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  const cdp = await page.context().newCDPSession(page);

  expect(await segmentoActivo(page)).toBe("recibos");
  await arcoPulgar(page, cdp, { x0: 196, y0: 260, dx: 40, dy: 190 });

  await expect.poll(() => segmentoActivo(page), { timeout: 5_000 }).toBe("deudas");
  expect(await pestanaActiva(page), "el arco de pulgar también cambió de pestaña").toBe("plan");
});

// (c) El gesto nuevo no rompe el swipe horizontal entre las 4 pestañas principales.
test("el swipe horizontal entre pestañas sigue funcionando dentro de Plan", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts, goals });
  await page.goto("/");
  await appLista(page);
  await irAPlan(page);
  const cdp = await page.context().newCDPSession(page);

  const W = page.viewportSize().width;
  // Siguiente pestaña (Cartera): arrastre horizontal de derecha a izquierda.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: W - 40, y: 200 }] });
  for (let i = 1; i <= 16; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: W - 40 - ((W - 80) * i) / 16, y: 200 }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("cartera");

  // Y de vuelta a Plan, aterriza en Recibos (el gesto vertical no dejó nada a medias).
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 80, y: 200 }] });
  for (let i = 1; i <= 16; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 80 + ((W - 80) * i) / 16, y: 200 }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("plan");
  expect(await segmentoActivo(page)).toBe("recibos");
});


/* INC-0710-01: medir el mismo dedo en el DOM, antes y después de usar Plan. El informe no
 * convierte un síntoma del móvil en una causa: registra entrega del toque, ownership y scroll
 * por frame, también si Chromium cancela el gesto. No modifica handlers ni touch-action. */
async function iniciarPerfilGesto(page) {
  await page.evaluate(() => {
    const rows=[], frames=[], tasks=[];
    const snapshot=(phase,e) => {
      const pg=document.querySelector(".page.page-scroll-host") || document.querySelector(".page.page-live");
      const seg=document.querySelector('[data-seg][aria-hidden="false"]');
      const active=document.querySelector(".botnav-tab.active");
      return {phase,t:performance.now(),event:e?.type||null,cancelable:e?.cancelable||false,
        prevented:e?.defaultPrevented||false,target:e?.target?.closest?.(".v4-screen")?"screen":"other",
        tab:active?.dataset.tour||null,seg:seg?.dataset.seg||null,y:pg?.scrollTop??null,
        own:pg?.classList.contains("mc-touch-own")||false};
    };
    const handlers=[];
    for(const type of ["touchstart","touchmove","touchend","touchcancel","scroll"]){
      const fn=e=>{rows.push(snapshot("capture",e));queueMicrotask(()=>rows.push(snapshot("microtask-not-final",e)));};
      document.addEventListener(type,fn,{capture:true,passive:true});handlers.push([type,fn]);
    }
    const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));
    observer.observe({type:"longtask",buffered:false});
    let active=true,raf;
    const tick=()=>{if(!active)return;frames.push(snapshot("raf"));raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);
    window.__planGestureProfile={stop:()=>{
      active=false;cancelAnimationFrame(raf);observer.disconnect();
      handlers.forEach(([type,fn])=>document.removeEventListener(type,fn,true));
      return {rows,frames,tasks,instrumentation:"event/microtask/rAF scrollTop+class reads; no style or size read per frame"};
    }};
  });
}
async function terminarPerfilGesto(page, label, sourceSHA) {
  const report=await page.evaluate(()=>window.__planGestureProfile.stop());
  const intervals=report.frames.slice(1).map((r,i)=>r.t-report.frames[i].t);
  report.label=label;report.sourceSHA=sourceSHA;report.maxFrame=intervals.length?Math.max(...intervals):null;
  report.framesOver32=intervals.filter(n=>n>32).length;
  console.log("PLAN_GESTURE_PROFILE "+JSON.stringify(report));
  return report;
}
// Traza separada: no acumula lecturas por rAF mientras atribuye trabajo al renderer.
async function trazarGestoPlan(page, cdp, label, sourceSHA) {
  await cdp.send("Tracing.start", { categories: "devtools.timeline", transferMode: "ReturnAsStream" });
  try {
    await deslizarV(page, cdp, { y0: 430, dy: -190, pasos: 38, intervalo: 32 });
    await page.waitForTimeout(350);
  } finally {
    let timer;
    let onComplete;
    const completed = new Promise((resolve, reject) => {
      timer=setTimeout(()=>reject(new Error("Tracing.tracingComplete no llegó")),30000);
      onComplete=resolve;cdp.once("Tracing.tracingComplete", onComplete);
    });
    let event;
    try {
      // Esperar ambos juntos consume también el rechazo si Tracing.end falla.
      [,event]=await Promise.all([cdp.send("Tracing.end"),completed]);
    } finally { clearTimeout(timer);cdp.removeListener("Tracing.tracingComplete",onComplete); }
    expect(event.stream, "la traza debe ofrecer un stream completo").toBeTruthy();
    const chunks=[];let bytes=0;
    try {
      for(let i=0;i<1000;i++) {
        const chunk=await cdp.send("IO.read",{handle:event.stream,size:65536});
        const data=Buffer.from(chunk.data,chunk.base64Encoded?"base64":"utf8");
        chunks.push(data);bytes+=data.length;
        if(bytes>30*1024*1024)throw new Error("traza mayor que el límite diagnóstico");
        if(chunk.eof)break;
        if(i===999)throw new Error("stream de traza incompleto");
      }
    } finally { await cdp.send("IO.close",{handle:event.stream}); }
    const events=JSON.parse(Buffer.concat(chunks).toString("utf8")).traceEvents;
    const renderer=new Set(events.filter(e=>e.ph==="M"&&e.name==="thread_name"&&e.args?.name==="CrRendererMain")
      .map(e=>e.pid+"/"+e.tid));
    expect(renderer.size,"identidad del hilo renderer no encontrada").toBeGreaterThan(0);
    const totals={};
    for(const e of events) {
      if(e.ph!=="X"||!renderer.has(e.pid+"/"+e.tid)||
        !["EventDispatch","Layout","UpdateLayoutTree","Paint","RunTask"].includes(e.name))continue;
      const row=totals[e.name]||(totals[e.name]={count:0,totalUs:0,maxUs:0});
      row.count++;row.totalUs+=e.dur||0;row.maxUs=Math.max(row.maxUs,e.dur||0);
    }
    expect(totals.EventDispatch?.count||0,"la traza debe incluir eventos del gesto").toBeGreaterThan(0);
    // Nunca emitir args, URLs, documentos ni el stream de la traza a logs públicos.
    console.log("PLAN_LAYOUT_TRACE "+JSON.stringify({label,sourceSHA,totals,
      scope:"complete X events on CrRendererMain; nested durations overlap; separate uninstrumented gesture"}));
  }
}

const perfilSourceSHA=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();

// Una barra ocultada por scroll no es un destino táctil. El diagnóstico sale por el swipe
// horizontal real, que también debe aterrizar; no se fuerza un click a través del contenido.
async function navegarPerfil(page, cdp, tab) {
  const order=["inicio","gastos","plan","cartera"];
  const current=await pestanaActiva(page),from=order.indexOf(current),to=order.indexOf(tab);
  expect(from,"pestaña inicial identificable").toBeGreaterThanOrEqual(0);
  expect(to,"pestaña destino identificable").toBeGreaterThanOrEqual(0);
  for(let i=from;i!==to;i+=Math.sign(to-from)) {
    await esperarHostPerfil(page);
    if(order[i]!=="inicio") expect(await page.locator(".page.page-scroll-host").evaluate(el=>el.classList.contains("mc-touch-own")),"ownership vertical liberado antes de salir").toBe(false);
    const forward=to>from,W=page.viewportSize().width,x0=forward?W-40:80;
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:x0,y:200}]});
    for(let step=1;step<=16;step++) {
      await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x0+(forward?-1:1)*(W-120)*step/16,y:200}]});
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await expect.poll(()=>pestanaActiva(page),{timeout:10_000}).toBe(order[i+Math.sign(to-from)]);
    await esperarHostPerfil(page);
  }
  await esperarHostPerfil(page);
  expect(await pestanaActiva(page)).toBe(tab);
  if(tab!=="inicio") expect(await page.locator(".page.page-scroll-host").evaluate(el=>el.classList.contains("mc-touch-own")),"ownership liberado al aterrizar").toBe(false);
}

async function esperarHostPerfil(page) {
  await esperarCarruselQuieto(page);
  // Un transform constante puede ser una pausa anterior al movimiento. El host fixed sólo
  // vuelve tras el asentamiento real; el punto del siguiente gesto debe pertenecer a ese host.
  await page.waitForFunction(()=>{
    const tr=document.querySelector(".track.scroll-host-park:not(.dragging)");
    const hosts=document.querySelectorAll(".page.page-scroll-host");
    return !!tr&&hosts.length===1&&hosts[0].classList.contains("page-live")&&
      hosts[0].contains(document.elementFromPoint(196,200));
  },null,{timeout:10_000,polling:"raf"});
}

async function prepararRecibosPerfil(page) {
  const visible=page.locator('[data-seg="recibos"][aria-hidden="false"]');
  // La portada resume tres pendientes aunque existan cuarenta: sembrar más no la alarga.
  // Expandir por su botón real conserva el host de Plan y la prueba de scroll exigida.
  await visible.locator("button.v4-link-mini").first().click();
  await expect(visible.locator(".v4-charge")).toHaveCount(40);
}


for(const reducedMotion of ["no-preference","reduce"]){
  test("perfil controles Inicio/Gastos y cancelación/inversión Plan "+reducedMotion,async({page})=>{
    test.setTimeout(120_000);
    await page.emulateMedia({reducedMotion});
    await page.route("**/*",route=>{
      const url=new URL(route.request().url());
      return ["127.0.0.1","localhost"].includes(url.hostname)?route.continue():route.abort();
    });
    await installFixtureClock(page);
    await seedLoggedInDashboard(page,{debts,goals,
      expenses:Array.from({length:80},(_,i)=>({id:"profile-exp-"+i,date:"2026-09-26",amount:2,
        merchant:"Sintético "+i,category:"Otros",account:"e2e"}))});
    await page.goto("/");await appLista(page);
    const cdp=await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate",{rate:6});
    for(const tab of ["inicio","gastos"]){
      await navegarPerfil(page,cdp,tab);
      await iniciarPerfilGesto(page);
      await deslizarV(page,cdp,{y0:430,dy:-190,pasos:12});await page.waitForTimeout(400);
      const report=await terminarPerfilGesto(page,tab+"/control/"+reducedMotion,perfilSourceSHA);
      expect(report.rows.some(r=>r.event==="touchstart"&&r.tab===tab)).toBe(true);
      expect(await pestanaActiva(page)).toBe(tab);
    }
    await navegarPerfil(page,cdp,"plan");
    for(const endType of ["touchCancel","touchEnd"]){
      await page.locator(".page.page-scroll-host").evaluate(el=>{el.scrollTop=0;});
      await page.waitForTimeout(300);
      const before=await segmentoActivo(page);
      await iniciarPerfilGesto(page);
      await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:196,y:430}]});
      for(const y of [420,400,370,340,365,395,425]){
        await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:196,y}]});
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent",{type:endType,touchPoints:[]});await page.waitForTimeout(400);
      const report=await terminarPerfilGesto(page,"plan/inversion/"+endType+"/"+reducedMotion,perfilSourceSHA);
      expect(report.rows.some(r=>r.event==="touchstart"&&r.tab==="plan"&&r.seg===before)).toBe(true);
      expect(report.rows.some(r=>r.event==="touchcancel"||r.event==="touchend"),"el navegador no entregó cierre del gesto").toBe(true);
      expect(await segmentoActivo(page)).toBe(before);
      expect(await pestanaActiva(page)).toBe("plan");
      expect(await page.locator(".page.page-scroll-host").evaluate(el=>el.classList.contains("mc-touch-own"))).toBe(false);
    }
    await cdp.send("Emulation.setCPUThrottlingRate",{rate:1});await cdp.detach();
  });
}


for(const reducedMotion of ["no-preference","reduce"]){
  for(const segment of ["recibos","deudas","metas"]){
    test("perfil diagnóstico desde tope "+segment+" "+reducedMotion,async({page})=>{
      test.setTimeout(180_000);
      await page.emulateMedia({reducedMotion});
      await page.route("**/*",route=>{
        const url=new URL(route.request().url());
        return ["127.0.0.1","localhost"].includes(url.hostname)?route.continue():route.abort();
      });
      await installFixtureClock(page);
      await seedLoggedInDashboard(page,{
        debts,goals:Array.from({length:16},(_,i)=>({...goals[i%3],id:"profile-goal-"+i})),
        fixed:Array.from({length:24},(_,i)=>({id:"profile-fixed-"+i,name:"Recibo sintético "+i,
          amount:10+i,freq:"mes",day:28,account:"sabadell"}))
      });
      await page.goto("/");await appLista(page);await irAPlan(page);
      if(segment!=="recibos"){
        await page.locator(".v4-seg-btn",{hasText:segment==="deudas"?/deuda/i:/meta/i}).click();
        await expect.poll(()=>segmentoActivo(page)).toBe(segment);
      }
      const cdp=await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate",{rate:6});
      await esperarHostPerfil(page);
      if(segment==="recibos") await prepararRecibosPerfil(page);
      const pg=page.locator(".page.page-scroll-host");
      await expect(pg).toHaveCount(1);
      await expect.poll(()=>pg.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeGreaterThan(200);
      const baseline=await page.evaluate(()=>localStorage.getItem("micartera_v3_exp"));
      for(const phase of ["first", "after-12-use-cycles"]){
        if(phase!=="first") {
          for(let cycle=0;cycle<12;cycle++) {
            await navegarPerfil(page,cdp,"gastos");
            await navegarPerfil(page,cdp,"plan");
            if(await segmentoActivo(page)!==segment) {
              await page.locator(".v4-seg-btn",{hasText:segment==="deudas"?/deuda/i:segment==="metas"?/meta/i:/recibo/i}).click();
              await expect.poll(()=>segmentoActivo(page)).toBe(segment);
            }
            if(segment==="recibos") await expect(page.locator('[data-seg="recibos"][aria-hidden="false"] .v4-charge')).toHaveCount(40);
            await pg.evaluate(el=>{el.scrollTop=0;});
            await deslizarV(page,cdp,{y0:430,dy:-190,pasos:12});
            await page.waitForTimeout(100);
            expect(await pg.evaluate(el=>el.scrollTop),"el ciclo de uso debe entregar scroll real").toBeGreaterThan(2);
            expect(await segmentoActivo(page)).toBe(segment);
            await deslizarV(page,cdp,{y0:220,dy:100,pasos:10});
            await page.waitForTimeout(100);
          }
        }
        // Colocar el caso inicial no sustituye al gesto: las muestras posteriores son CDP.
        await pg.evaluate(el=>{el.scrollTop=0;});
        await page.waitForTimeout(300);
        await iniciarPerfilGesto(page);
        await deslizarV(page,cdp,{y0:430,dy:-190,pasos:38,intervalo:32});
        await page.waitForTimeout(450);
        const report=await terminarPerfilGesto(page,segment+"/"+phase+"/"+reducedMotion,perfilSourceSHA);
        expect(report.rows.some(r=>r.event==="touchstart"&&r.tab==="plan")).toBe(true);
        expect(report.frames.some(r=>r.y>2),"el dedo real no produjo scroll desde el tope").toBe(true);
        expect(await segmentoActivo(page)).toBe(segment);
        expect(await pestanaActiva(page)).toBe("plan");
        expect(await pg.evaluate(el=>el.classList.contains("mc-touch-own"))).toBe(false);
        // Control fuera de tope: mismo dedo, la lista ya tiene recorrido y debe seguir bajando.
        const outsideBefore=await pg.evaluate(el=>el.scrollTop);
        expect(outsideBefore,"el control debe empezar fuera del tope").toBeGreaterThan(2);
        await iniciarPerfilGesto(page);
        await deslizarV(page,cdp,{y0:430,dy:-190,pasos:38,intervalo:32});
        await page.waitForTimeout(350);
        const outside=await terminarPerfilGesto(page,segment+"/outside-top/"+phase+"/"+reducedMotion,perfilSourceSHA);
        expect(outside.rows.some(r=>r.event==="touchstart"&&r.tab==="plan"&&r.seg===segment)).toBe(true);
        expect(await pg.evaluate(el=>el.scrollTop),"el mismo dedo fuera del tope debe continuar el scroll").toBeGreaterThan(outsideBefore);
      }
      if(reducedMotion==="no-preference") {
        await pg.evaluate(el=>{el.scrollTop=0;});await page.waitForTimeout(300);
        await trazarGestoPlan(page,cdp,segment+"/top/after-use",perfilSourceSHA);
        const traceOutsideBefore=await pg.evaluate(el=>el.scrollTop);
        expect(traceOutsideBefore).toBeGreaterThan(2);
        await trazarGestoPlan(page,cdp,segment+"/outside-top/after-use",perfilSourceSHA);
        expect(await pg.evaluate(el=>el.scrollTop)).toBeGreaterThan(traceOutsideBefore);
        expect(await segmentoActivo(page)).toBe(segment);
        expect(await pestanaActiva(page)).toBe("plan");
        expect(await pg.evaluate(el=>el.classList.contains("mc-touch-own"))).toBe(false);
      }
      expect(await page.evaluate(()=>localStorage.getItem("micartera_v3_exp"))).toBe(baseline);
      await cdp.send("Emulation.setCPUThrottlingRate",{rate:1});await cdp.detach();
    });
  }
}
