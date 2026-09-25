/* LA RAYITA (indicador de pestaña activa) TIENE QUE ARQUEAR SOBRE EL + — y si le cortas el
 * salto a mitad, NO atravesarlo en diagonal (feedback 2026-08-05: «si lo hago muy rápido se
 * corta y atraviesa»).
 *
 * Historia: en 2026-08-03 el fallo a velocidad alta era `rodea` colgada (cleanup del efecto
 * cancelaba el timer sin quitar la clase). Eso se arregló. Luego, al reiniciar `rodea` en cada
 * cruce encadenado, el span seguía a medias (Y subida) mientras el X saltaba → diagonal por el +.
 * Ahora un cruce LIMPIO arquea; uno INTERRUMPIDO hace snap al destino (sin arco ni diagonal).
 *
 * Se comprueba MIDIENDO EL translateY REAL del span. Un arco de verdad baja de -14 px; un snap
 * limpio se queda ~0; lo que no queremos es un «ni fu ni fa» a medias atravesando el vano. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Umbral del arco: el keyframe llega a -26 px; el muestreo por rAF a veces pilla -14,7.
   -14 sigue distinguiendo un arco real de una línea recta (~0). */
const ARCO_UMBRAL = -14;
/* Snap limpio: casi sin brinco vertical. Chromium puede entregar -3,5 px en el único frame que
   separa dos commits; -4 sigue muy lejos del arco visible, que empieza por debajo de -14. */
const SNAP_TECHO = -4;

async function appLista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

async function deslizar(page, cdp, sentido, { y = 200, pasos = 2 } = {}) {
  const W = page.viewportSize().width;
  const [a, b] = sentido === "siguiente" ? [W - 40, 40] : [80, W - 40];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a, y }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a + ((b - a) * i) / pasos, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function arrancarMuestreo(page) {
  await page.evaluate(() => {
    window.__samples = [];
    window.__t0 = performance.now();
    window.__sampling = true;
    (function tick() {
      const span = document.querySelector(".botnav-ind span");
      const cont = document.querySelector(".botnav-ind");
      const tf = getComputedStyle(span).transform;
      const m = tf.match(/matrix\(([^)]+)\)/);
      const ty = m ? Number(m[1].split(",")[5]) : 0;
      window.__samples.push({ t: Math.round(performance.now() - window.__t0), ty, objetivo: cont.style.transform });
      if (window.__sampling) requestAnimationFrame(tick);
    })();
  });
}

function posATab(objetivo) {
  const m = objetivo && objetivo.match(/translateX\((-?[\d.]+)%\)/);
  if (!m) return null;
  const pct = Number(m[1]);
  return pct <= 100 ? pct / 100 : pct / 100 - 1;
}

async function pararMuestreoYagrupar(page) {
  await page.evaluate(() => { window.__sampling = false; });
  const samples = await page.evaluate(() => window.__samples);
  const tramos = [];
  let cur = null;
  for (const s of samples) {
    if (!cur || cur.objetivo !== s.objetivo) {
      if (cur) tramos.push(cur);
      cur = { objetivo: s.objetivo, minTy: s.ty };
    }
    cur.minTy = Math.min(cur.minTy, s.ty);
  }
  if (cur) tramos.push(cur);
  return tramos;
}

async function estadoIndicador(page) {
  return page.evaluate(() => {
    const cont = document.querySelector(".botnav-ind");
    const span = cont.firstElementChild;
    return { objetivo: cont.style.transform, arco: cont.classList.contains("rodea"),
      ty: new DOMMatrix(getComputedStyle(span).transform).m42 };
  });
}

async function despuesDelCruce(page, anterior) {
  await expect.poll(async () => (await estadoIndicador(page)).objetivo, { timeout: 1500 }).not.toBe(anterior);
  return estadoIndicador(page);
}

function esperaArcoOSnap(estado, etiqueta) {
  // El arco completo ya se mide en el test anterior. En una ráfaga puede seguir activo o haber
  // sido interrumpido; si se interrumpió, la línea debe estar prácticamente en reposo.
  if (!estado.arco) expect(estado.ty, `${etiqueta}: snap a ${estado.ty}px`).toBeGreaterThan(SNAP_TECHO);
}

test("un cruce limpio (sin interrumpir) arquea por encima del +", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  await deslizar(page, cdp, "siguiente"); // inicio->gastos
  await page.waitForTimeout(500);
  await arrancarMuestreo(page);
  await deslizar(page, cdp, "siguiente"); // gastos->plan (cruza)
  await page.waitForTimeout(500);
  const tramos = await pararMuestreoYagrupar(page);

  let visto = false;
  for (let i = 1; i < tramos.length; i++) {
    const antes = posATab(tramos[i - 1].objetivo), ahora = posATab(tramos[i].objetivo);
    if (antes == null || ahora == null || antes === ahora) continue;
    if ((antes <= 1) !== (ahora <= 1)) {
      visto = true;
      expect(tramos[i].minTy, `cruce limpio ${tramos[i - 1].objetivo}→${tramos[i].objetivo} no arqueó (${tramos[i].minTy})`).toBeLessThan(ARCO_UMBRAL);
    }
  }
  expect(visto, "tiene que haber un cruce gastos→plan").toBe(true);
});

test("a velocidad alta, cada cruce o arquea o snapea limpio (nunca atraviesa a medias)", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  await deslizar(page, cdp, "siguiente"); // inicio->gastos
  await page.waitForTimeout(400);
  let anterior=(await estadoIndicador(page)).objetivo;
  let comprobados=0;

  for (let i = 0; i < 6; i++) {
    await deslizar(page, cdp, "siguiente"); // gastos->plan (cruza)
    let estado=await despuesDelCruce(page,anterior);
    esperaArcoOSnap(estado,`${anterior}→${estado.objetivo}`);
    anterior=estado.objetivo; comprobados++;
    await deslizar(page, cdp, "anterior");  // plan->gastos (cruza)
    estado=await despuesDelCruce(page,anterior);
    esperaArcoOSnap(estado,`${anterior}→${estado.objetivo}`);
    anterior=estado.objetivo; comprobados++;
  }
  expect(comprobados, "la ráfaga tiene que haber generado varios cruces reales").toBeGreaterThan(5);
});

test("un salto que NO cruza el + no hereda el arco de un cruce reciente (bleed-through)", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  await deslizar(page, cdp, "siguiente"); // inicio->gastos
  await page.waitForTimeout(400);
  let anterior=(await estadoIndicador(page)).objetivo;
  let cruces=0, noCruces=0;
  const pasos=["siguiente","siguiente","anterior","anterior","anterior","siguiente"];

  for (let i = 0; i < 4; i++) {
    for(const sentido of pasos){
      await deslizar(page,cdp,sentido);
      const estado=await despuesDelCruce(page,anterior);
      const a=posATab(anterior), b=posATab(estado.objetivo), cruza=(a<=1)!==(b<=1);
      if(cruza){ cruces++; esperaArcoOSnap(estado,`${anterior}→${estado.objetivo}`); }
      else {
        noCruces++;
        expect(estado.arco,`${anterior}→${estado.objetivo} heredó el arco`).toBe(false);
        expect(estado.ty,`${anterior}→${estado.objetivo} quedó a ${estado.ty}px`).toBeGreaterThan(SNAP_TECHO);
      }
      anterior=estado.objetivo;
    }
  }
  expect(cruces, "la ráfaga tiene que haber generado cruces reales").toBeGreaterThan(2);
  expect(noCruces, "la ráfaga tiene que haber generado saltos SIN cruce").toBeGreaterThan(2);
});
