/* LA BARRA DE ABAJO SE ESCONDE AL BAJAR — CON EL DEDO, QUE ES COMO SE ROMPIÓ.
 *
 * Bug suyo del 11/9: «el esconderse la barra de abajo ya no lo hace apenas nunca». Y lo peor:
 * la suite estaba VERDE. Ningún test bajaba con un dedo de verdad — se miraba la barra tras
 * mover `scrollTop` por JS, y por ahí funcionaba perfectamente.
 *
 * La causa, medida antes de tocar nada: `onPageScroll` abría con `if(dragging.current) return;`
 * y `dragging` se pone en el `touchstart` de CUALQUIER gesto, no solo el de cambiar de pestaña.
 * Con el dedo puesto se tiraban TODOS los eventos de scroll, así que la barra solo podía
 * esconderse con el momentum de después de soltar: con manotazo sí, con scroll lento nunca.
 * Números de aquel día: arrastre de 369 px en Inicio → la barra ni se movió; `scrollTop = 200`
 * por JS → escondida al instante.
 *
 * Por eso este fichero usa `Input.dispatchTouchEvent` (CDP) y NO `page.mouse` ni `scrollTop`:
 * un test que mueve el scroll por JS aquí no vale de nada, se queda verde con el fallo puesto.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedLoggedInDashboard } from "./fixtures.mjs";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

/** El splash (`#mc-load`) es `position:fixed` con `z-index:9999` sobre TODA la pantalla: sin
 *  esperar a que se vaya, el dedo no llega a la pestaña y el test mide otra cosa. */
async function appLista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  const news = page.getByRole("button", { name: /Entendido|Got it/i });
  if (await news.count()) await news.first().click();
}

const escondida = (page) =>
  page.evaluate(() => document.querySelector(".botnav").classList.contains("botnav-hidden"));

const alturaScroll = (page) =>
  page.evaluate(() => {
    const h = document.querySelector(".page.page-scroll-host");
    return h ? { y: h.scrollTop, max: h.scrollHeight - h.clientHeight } : { y: 0, max: 0 };
  });

/** Arrastre vertical con el dedo. `paso` pequeño y con pausa = scroll LENTO y controlado, que es
 *  el que fallaba; el rápido siempre funcionó (ver [[feedback-el-ojo-suyo-gana-a-mis-medidas]]). */
async function arrastrar(cdp, page, { desde = 600, paso = 16, pasos = 24, espera = 16 } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 187, y: desde }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 187, y: desde - i * paso }] });
    await page.waitForTimeout(espera);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("bajando DESPACIO con el dedo, la barra se esconde", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  const antes = await alturaScroll(page);
  expect(antes.max, "la pestaña tiene que tener algo que scrollear, si no el test no mide nada").toBeGreaterThan(60);
  expect(await escondida(page), "en reposo la barra está a la vista").toBe(false);

  await arrastrar(cdp, page);

  const despues = await alturaScroll(page);
  expect(despues.y, "el dedo tiene que haber movido la pestaña de verdad").toBeGreaterThan(40);
  await expect.poll(() => escondida(page), { timeout: 2_000 }).toBe(true);
});

test("y se esconde PRONTO, no al segundo siguiente", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  await arrastrar(cdp, page, { pasos: 10 });
  /* Sin espera ninguna tras soltar: «ocúltala antes, en cuanto baje» (suyo, 11/9). Antes había
     550 ms de retraso y el pin de 1 s del cambio de pestaña por encima. */
  expect(await escondida(page)).toBe(true);
});

test("al volver a subir, la barra reaparece", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  await arrastrar(cdp, page);
  await expect.poll(() => escondida(page), { timeout: 2_000 }).toBe(true);

  /* Subir = arrastrar hacia abajo (el dedo va al revés que el contenido). */
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 187, y: 260 }] });
  for (let i = 1; i <= 16; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 187, y: 260 + i * 18 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await expect.poll(() => escondida(page), { timeout: 2_000 }).toBe(false);
});

test("la pantalla recolocándose sola no esconde la barra", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);

  /* Esto me mordió haciendo el arreglo de arriba: al esconderla en el acto, la barra también se
     iba cuando la pantalla se recolocaba sola. El caso real es este — en Cartera, «Editar» y
     tocar un chip de rol estira o encoge la tarjeta, el navegador ajusta el `scrollTop` y
     dispara un `scroll` que nadie ha pedido. La barra desaparecía sin haber bajado nada, y justo
     debajo del dedo que iba a tocar una pestaña.
     Ojo con el criterio: NO vale mirar si hay un dedo puesto, porque tocar el chip TAMBIÉN es un
     dedo. Lo que separa los dos casos es que aquí cambia `scrollHeight` y bajando no. */
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  /* Abrir la ficha y tocar un rol: estira/encoge el sheet y mueve scrollHeight sin bajar con el dedo. */
  await page.locator(".v4-card-list button.v4-mov").first().click();
  await expect(page.locator(".v4-sheet")).toBeVisible();
  expect(await escondida(page), "abrir la ficha no puede esconder la barra").toBe(false);

  await page.locator(".v4-sheet .v4-ficha-op").nth(1).click();
  await page.waitForTimeout(900);
  expect(await escondida(page), "cambiar el rol de una cuenta tampoco").toBe(false);
});

test("si Android CANCELA el scroll vertical, la barra sigue oculta y el estado queda coherente", async ({ page }) => {
  /* Android entrega el scroll al WebView con `touchcancel` (174 de 185 gestos medidos). En el
     fondo, ese cancel debe conservar la barra como estaba: revelarla aquí era exactamente el
     segundo paso del rechazo 4.25.1.1. El estado de React se reconcilia después del stretch, pero
     cualquier render intermedio también debe respetar la ref visual. */
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  const y0 = 600;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 187, y: y0 }] });
  for (let i = 1; i <= 30; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 187, y: y0 - i * 16 }] });
    await page.waitForTimeout(16);
  }
  // El navegador se lleva el gesto: nada de touchEnd.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect.poll(async () => {
    const s = await alturaScroll(page);
    return s.max - s.y;
  }, { message: "el caso solo vale si el dedo llegó al borde inferior" }).toBeLessThanOrEqual(4);
  await page.waitForTimeout(800);

  const tras = await page.evaluate(() => {
    const n = document.querySelector(".botnav");
    const p = document.querySelector(".page.page-scroll-host");
    return {
      clase: n.className,
      oculta: n.classList.contains("botnav-hidden"),
      t: getComputedStyle(n).transform,
      bottom: parseFloat(getComputedStyle(n).bottom),
      host: !!(p && p.classList.contains("page-scroll-host"))
    };
  });
  expect(tras.oculta, "touchcancel vertical no equivale a subir contenido").toBe(true);
  expect(tras.host, "el cancel vertical no desmonta el host que permite la ola nativa").toBe(true);
  expect(tras.t, "la barra transformada encima del borde corta el stretch del WebView").toBe("none");
  expect(tras.bottom, "oculta en host se desplaza por bottom, no por transform").toBeLessThan(-50);

  /* Éste era el agujero real que los gestos anteriores no tocaban: un setState cualquiera hacía
     que React reescribiera `className` y borrara las clases añadidas a mano por enterScrollHost. */
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect.poll(() => page.evaluate(() => ({
    shell:document.querySelector(".app-shell")?.classList.contains("scroll-host-on"),
    viewport:document.querySelector(".viewport")?.classList.contains("scroll-host-open"),
    transform:getComputedStyle(document.querySelector(".botnav")).transform
  })), { message:"un re-render no puede desmontar el host de la ola" }).toEqual({shell:true,viewport:true,transform:"none"});

  // La app sigue viva y un cambio de pestaña sí la revela, como siempre.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".botnav-tab")].find((x) => x.getAttribute("data-tour") === "gastos");
    if (b) b.click();
  });
  await page.waitForTimeout(500);
  expect(await escondida(page), "cambiar de pestaña devuelve la barra").toBe(false);
});

test("★ al soltar se reconcilia; en el borde no se agenda un render tardío", () => {
  /* Esto NO se puede probar con un gesto sintético, y por eso va como guardián de fuente: en
     Playwright el gesto siempre acaba limpio, así que los cinco casos de arriba pasaban con el
     agujero puesto. Lo cazó Cursor leyendo el código, con el dato que lo cierra: **en su móvil
     174 de 185 gestos acaban en `touchcancel`**, no en `touchend`. Mi primera versión (4.19.69)
     solo volcaba en `onEnd`, así que en su mano casi nunca habría corrido — y lo que quedaba era
     PEOR que no aplazar nada: DOM con la clase, refs en `true`, React creyendo que la barra está
     a la vista, y el siguiente re-render quitándole la clase. */
  const src = readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
  expect(src.includes("navFlushTimer"), "no puede quedar el timer que repintaba a mitad de ola").toBe(false);
  expect(src.includes("deferNavHideFlush"), "no puede quedar el diferido de 700 ms").toBe(false);
  const end=src.slice(src.indexOf("const onEnd="),src.indexOf("const onCancel=function()"));
  expect(end.includes("discardNavHideFlush()"), "onEnd en el borde debe dejar al navegador pintar la ola").toBe(true);
  expect(end.includes("flushNavHide()"), "onEnd fuera del borde debe reconciliar React").toBe(true);
  const cancel=src.slice(src.indexOf("const cancelSwipe=function("),src.indexOf("useEffect(function(){",src.indexOf("const cancelSwipe=function(")));
  expect(cancel.includes("discardNavHideFlush()"), "touchcancel en el borde no debe programar un render").toBe(true);
  expect(cancel.includes("flushNavHide()"), "touchcancel normal sí debe reconciliar React").toBe(true);
});

test("la animación sigue siendo suave: la barra se va con transición, no de golpe", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);

  /* Él pidió las dos cosas juntas: «ocúltala antes… SIN quitarme la animación suave». Lo que da
     la suavidad es la transición CSS, no el retraso que se ha quitado. */
  const t = await page.evaluate(() => {
    const n = document.querySelector(".botnav");
    const cs = getComputedStyle(n);
    return { dur: cs.transitionDuration, prop: cs.transitionProperty };
  });
  const segundos = String(t.dur).split(",").map((s) => parseFloat(s)).filter((n) => !isNaN(n));
  expect(Math.max(...segundos), "la barra tiene que tener transición (si no, desaparece de golpe)").toBeGreaterThan(0.2);
});
