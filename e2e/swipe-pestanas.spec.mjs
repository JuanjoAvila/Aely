/* DESLIZAR ENTRE PESTAÑAS, LO FUNCIONAL — complemento de `rendimiento-tabs.spec.mjs`.
 *
 * Aquel mide que entrar en una pestaña no bloquee el hilo; éste mide que el gesto HAGA lo que
 * tiene que hacer. Son cosas distintas y se rompen por separado: el arreglo del tirón consistió
 * en mover el montaje de las pestañas fuera del gesto, y un montaje que llega tarde (o que no
 * llega) daría una pestaña en blanco sin que ninguna tarea larga se enterase.
 *
 * Aquí NO se miden tiempos (serían flaky en CI): eso es del otro fichero. Esto comprueba que
 * deslizar recorre las cuatro pestañas y que la que entra acaba con contenido REAL, que es
 * render puro y por tanto justo lo que `npm test` no ve (§8 de AGENTS.md). */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/** El splash (#mc-load) es hermano de #root y tapa la pantalla entera: `.botnav` puede estar ya
 *  en el DOM con el splash todavía encima, y entonces el toque no llega ni a `.viewport`. */
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

/** Arrastre lateral real. `y=200`: más abajo hay zonas que se tragan el gesto (`stopSwipe` en
 *  chips de Gastos / gráfico de Inicio). Desde 4.12.1 Ajustes solo abre en Resumen: en el resto
 *  de pestañas da igual arrancar pegado al borde. */
async function deslizar(page, cdp, sentido, { y = 200, pasos = 16, x0 = null } = {}) {
  const W = page.viewportSize().width;
  const [a, b] = sentido === "siguiente" ? [W - 40, 40] : [x0 != null ? x0 : 80, W - 40];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a, y }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a + ((b - a) * i) / pasos, y }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("deslizar recorre las cuatro pestañas, ida y vuelta", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  expect(await pestanaActiva(page)).toBe("inicio");

  for (const esperada of ["gastos", "plan", "cartera"]) {
    await deslizar(page, cdp, "siguiente");
    await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe(esperada);
  }

  // Y en la última, seguir tirando no descarrila: se queda donde está.
  await deslizar(page, cdp, "siguiente");
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("cartera");

  for (const esperada of ["plan", "gastos", "inicio"]) {
    await deslizar(page, cdp, "anterior");
    await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe(esperada);
  }
});

/* AJUSTES SOLO DESDE RESUMEN (4.12.1). El borde en Gastos/Plan/Cartera era un coñazo; y el
 * candado de 450 ms tras cambiar de pestaña era el stopper al llegar a Resumen y querer abrir
 * Ajustes al momento. Ahora: en Gastos el borde NO abre nada; en Resumen el desliz abre YA,
 * sin esperar. */
test("desde Gastos el borde NO abre Ajustes", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  await deslizar(page, cdp, "siguiente");
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("gastos");

  // Pegado al borde izquierdo: antes abría Ajustes; ahora es un cambio de pestaña (o nada).
  await deslizar(page, cdp, "anterior", { x0: 10 });
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("inicio");
  expect(await page.locator(".drawer.open").count(),
    "el borde en Gastos abrió Ajustes").toBe(0);
});

test("en Resumen, Ajustes abre al momento tras llegar de Gastos", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  await deslizar(page, cdp, "siguiente");
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("gastos");
  await deslizar(page, cdp, "anterior");
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("inicio");

  // SIN pausa: el candado de 450 ms era justo lo que bloqueaba este gesto.
  await deslizar(page, cdp, "anterior");
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe(null);
  await expect(page.locator(".settings-push.open")).toHaveCount(1);
});

test("la pestaña que entra se pinta de verdad, no llega en blanco", async ({ page }) => {
  // Con datos, para que lo que se pinta sea una lista derivada del estado y no un hueco vacío.
  await seedLoggedInDashboard(page, {
    expenses: [
      { id: "m1", date: new Date().toISOString(), amount: 12.5, merchant: "Mercadona", category: "super", source: "manual" },
      { id: "m2", date: new Date().toISOString(), amount: 3.2, merchant: "Bar Paco", category: "bares", source: "manual" },
    ],
  });
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  await deslizar(page, cdp, "siguiente");
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("gastos");

  /* El montaje de la pestaña es perezoso: lo que importa es que acabe con contenido REAL.
     No fijamos el orden de la lista (misma marca de tiempo → el sort no es estable entre runs).
     ⚠ Y ACOTADO a la lista de Gastos: las vecinas van premontadas, así que contar
     `button.v4-mov` de toda la página mide también las cuentas de Cartera desde que son botones
     (11/9). Es [[e2e-getbytext-pestanas-premontadas]] otra vez, y en este fichero duele el doble
     porque el premontaje es justo lo que prueba. */
  const filas = page.locator(".v4-gastos-list-body button.v4-mov");
  await expect(filas.first()).toBeVisible({ timeout: 15_000 });
  await expect(filas).toHaveCount(2);
  await expect(page.locator("button.v4-mov", { hasText: "Mercadona" })).toBeVisible();
  await expect(page.locator("button.v4-mov", { hasText: "Bar Paco" })).toBeVisible();

  // Y al volver, Inicio sigue estando pintado (no se desmonta al salir).
  await deslizar(page, cdp, "anterior");
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("inicio");
  await expect(page.locator(".v4-hero")).toBeVisible();
});

/* EL DESENFOQUE DE LA BARRA SE APAGA MIENTRAS EL CARRUSEL SE MUEVE (2026-07-27).
 *
 * Su repro fue el que lo destapó: «en Gastos ARRIBA DEL TODO vas a Deudas, te mueves y vuelves:
 * hay lag; si en Gastos estabas abajo, va ultra fluido». Lo que cambia entre los dos casos es que
 * al bajar en una lista la barra inferior SE ESCONDE — y una barra escondida no desenfoca nada.
 * `.botnav` lleva `backdrop-filter`, que el navegador recalcula en cada frame en que cambia lo que
 * hay detrás; deslizando, detrás se mueve la app entera (medido: 47 repintados de la barra en un
 * solo gesto). Acotado: 181 ms con desenfoque, 145 sin él, 141 con la barra fuera del pintado —
 * o sea que el coste de la barra es CASI TODO el desenfoque.
 *
 * Se comprueba estructuralmente, no por tiempo: que la clase esté puesta MIENTRAS se arrastra y
 * que se quite sola después (si se quedara puesta, el diseño cambiaría de verdad, que es justo lo
 * que él pidió no tocar). */
test("al deslizar, la barra deja de desenfocar; al parar, vuelve", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);
  const shell = page.locator(".app-shell");

  await expect(shell, "en reposo la barra tiene que desenfocar (el diseño no se toca)").not.toHaveClass(/nav-sin-blur/);

  // Arrastre a medias: se dispara el gesto y se comprueba SIN soltar.
  const W = page.viewportSize().width;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: W - 40, y: 200 }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: W - 40 - i * 30, y: 200 }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await expect(shell, "con el dedo puesto, el desenfoque tiene que estar apagado").toHaveClass(/nav-sin-blur/);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  // Y vuelve solo cuando el carrusel ha parado (la transición dura 0,42 s).
  await expect(shell, "el desenfoque tiene que volver al terminar la transición").not.toHaveClass(/nav-sin-blur/, { timeout: 5_000 });
});

/* EL GESTO QUE EL NAVEGADOR SE LLEVA — el «tirón» de verdad (2026-07-27, medido en su móvil).
 *
 * Cuando el navegador decide que un arrastre es suyo (lo normal en cuanto acaba scrolleando la
 * lista) manda `touchcancel` y NO manda `touchend`. `.viewport` no escuchaba `touchcancel`, así
 * que en ese camino no se soltaba nada: la página se quedaba con el candado de scroll puesto y el
 * carrusel plantado a medio camino. Traducido a lo que él veía: deslizas y no se mueve nada, y
 * cuando por fin un gesto termina bien, se suelta todo de golpe y la pantalla pega el salto.
 *
 * En su móvil, 174 de 185 gestos reales terminaron cancelados. En un banco de pruebas no salía
 * NUNCA, porque un gesto sintético siempre acaba con un `touchend` limpio — por eso hay que
 * mandar el `touchCancel` a mano, que es justo lo que hace esta prueba.
 *
 * Se comprueba lo que le dolía: que después de un gesto cancelado la lista SIGUE moviéndose. */
test("un gesto que el navegador cancela no deja la app bloqueada", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    expenses: Array.from({ length: 40 }, (_, i) => ({
      id: "m" + i, date: new Date(Date.now() - i * 36e5).toISOString(),
      amount: 5 + i, merchant: "Comercio " + i, category: "super", source: "manual",
    })),
  });
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  await deslizar(page, cdp, "siguiente");
  await expect.poll(() => pestanaActiva(page), { timeout: 10_000 }).toBe("gastos");

  // Mirando TODAS las páginas, no solo la que se ve: con el carrusel a medio arrastrar, la
  // congelada y la que asoma no son la misma, y el candado se quedaba en la de detrás.
  // La página de Gastos por ÍNDICE, no por posición en pantalla: con el carrusel a mitad de
  // transición el rect engaña y se acababa midiendo la página de al lado.
  const pagina = () => page.evaluate(() => {
    const ps = [...document.querySelectorAll(".page")];
    const p = ps[1];
    return {
      top: Math.round(p.scrollTop), alto: p.scrollHeight,
      bloqueo: ps.map((el) => el.style.touchAction || "").filter(Boolean).join(","),
      overflow: ps.map((el) => el.style.overflow || "").filter(Boolean).join(","),
    };
  });

  // Su repro: entrar, MOVERSE dentro (el candado caro solo se pone si hubo scroll hace nada).
  // Se espera a que la lista sea de verdad más alta que la pantalla: en el CI las filas tardan
  // más en pintarse y scrollear antes de tiempo no movía nada (fallo del 27/7).
  await expect(page.locator("button.v4-mov").first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => {
    const p = document.querySelectorAll(".page")[1];
    return p.scrollHeight > p.clientHeight + 100;
  }), { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => { document.querySelectorAll(".page")[1].scrollTop = 300; });
  await page.waitForTimeout(60);
  expect((await pagina()).top, "la lista tiene que poder scrollear para que la prueba valga").toBeGreaterThan(0);

  // …y deslizar. Pero el navegador se lleva el gesto a mitad: llega `touchcancel`, no `touchend`.
  const W = page.viewportSize().width;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: W - 40, y: 200 }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: W - 40 - i * 24, y: 200 }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await page.waitForTimeout(200);

  const tras = await pagina();
  expect(tras.bloqueo, "la página se quedó con touch-action puesto: el dedo ya no la mueve").toBe("");
  expect(tras.overflow, "la página se quedó con overflow:hidden: el scroll está muerto").toBe("");
  await expect(page.locator(".track"), "el carrusel se quedó en modo arrastre").not.toHaveClass(/dragging/);
  await expect(page.locator(".app-shell"), "el desenfoque de la barra no volvió").not.toHaveClass(/nav-sin-blur/, { timeout: 5_000 });

  // Y lo que de verdad importa: la lista se sigue moviendo con el dedo.
  const antes = (await pagina()).top;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 180, y: 500 }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 180, y: 500 - i * 30 }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => pagina().then((p) => p.top), { timeout: 5_000 })
    .not.toBe(antes);
});

/* ── EL TIRONCILLO DEL ARRANQUE, MEDIDO ─────────────────────────────────────────────────────
 *
 * Su queja desde el 10/9, y la que más veces di por arreglada sin estarlo: «al scrollear de una
 * tab a otra… si desplazas fluido no se nota apenas, es ir LENTO y ahí se nota el tirón».
 *
 * Medido el 11/9 en su OnePlus 13 con toques REALES (`adb shell input swipe`, no sintéticos):
 * el carrusel no se movía hasta que el dedo pasaba de los ~30 px —la guarda que impide que robe
 * el scroll vertical— y entonces pintaba los **36 px de golpe**. El hueco es el mismo yendo
 * rápido, pero dura 173 ms en vez de 721: por eso solo se ve yendo lento.
 *
 * La guarda se queda (quitarla devuelve el bug de la deriva lateral). Lo que no puede volver es
 * el SALTO. Tras el ancla, medido en el mismo móvil: 36,1 → 0,7 px (lento) y 37,1 → 1,5 (rápido).
 */
test("★ al reclamar el gesto, el carrusel arranca donde está y no pega un salto", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);

  const leerX = () =>
    page.evaluate(() => {
      const t = document.querySelector(".track");
      if (!t) return null;
      return new DOMMatrixReadOnly(getComputedStyle(t).transform).m41;
    });

  const y = 200, x0 = page.viewportSize().width - 40;
  const base = await leerX();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });

  // Pasos pequeños, como un dedo yendo despacio: así se cruza el umbral sin saltárselo.
  let primerMovimiento = null;
  for (let d = 3; d <= 72 && primerMovimiento === null; d += 3) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 - d, y }] });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const ahora = await leerX();
    if (ahora !== null && base !== null && Math.abs(ahora - base) > 0.5) primerMovimiento = Math.abs(ahora - base);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  expect(primerMovimiento, "el carrusel no llegó a moverse en 72 px de arrastre").not.toBeNull();
  expect(primerMovimiento, "el primer fotograma pintado pega un salto: eso es el tironcillo que él ve al ir lento")
    .toBeLessThan(12);
});

/* El cajón de Ajustes reutiliza la misma guarda de eje del carrusel. Sin restar el ancla, el
 * primer fotograma saltaba los ~36 px retenidos aunque el resto del arrastre siguiera al dedo. */
test("★ Ajustes empieza a moverse sin salto y termina abriéndose", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const cdp = await page.context().newCDPSession(page);
  await page.waitForFunction(() => !!document.querySelector(".settings-push"), null, { timeout: 10_000 });

  const leerX = () => page.evaluate(() => {
    const d = document.querySelector(".settings-push");
    return d ? new DOMMatrixReadOnly(getComputedStyle(d).transform).m41 : null;
  });
  const y = 200, x0 = 60, base = await leerX();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  let primero = null;
  for (let d = 3; d <= 90 && primero === null; d += 3) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + d, y }] });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const ahora = await leerX();
    if (ahora !== null && base !== null && Math.abs(ahora - base) > 0.5) primero = Math.abs(ahora - base);
  }
  for (let d = 100; d <= 260; d += 20) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + d, y }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  expect(primero, "Ajustes no se movió con el arrastre").not.toBeNull();
  expect(primero, "el primer fotograma del cajón debe seguir al dedo").toBeLessThan(12);
  await expect(page.locator(".settings-push.open")).toHaveCount(1);
});
