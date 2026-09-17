import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* ENTRAR EN UNA PESTAÑA NO DEBE CONGELAR LA APP (feedback del móvil, 2026-07-26):
   «en deudas y metas cuando se accede la app se relentiza de manera muy bestia» y «las primeras
   veces que deslizas entre pestañas va a tirones, luego se suaviza».

   Las dos frases eran el mismo problema: la pestaña se montaba EN EL MOMENTO en que la tocabas
   —dentro del gesto— y encima el efecto que resetea los chips de Gastos escribía `scrollLeft`
   con el layout recién ensuciado, forzando un recálculo síncrono de la página entera.

   En un portátil esto NO SE VE (cero tareas largas): hay que estrangular la CPU con CDP para
   parecerse a la WebView de un Android de gama media. Medido así, antes del arreglo entrar en
   Deudas y Metas bloqueaba el hilo 171 ms y Gastos 77 ms; después, 0 ms los dos.

   El umbral es generoso a propósito (el CI es más lento y variable): esto no persigue milisegundos,
   persigue que nadie vuelva a mover el montaje de las pestañas dentro del gesto. */

const RATE = 6;
const TOPE_MS = 80;

function historico(n) {
  const out = [];
  const ahora = Date.now();
  for (let i = 0; i < n; i++) {
    out.push({
      id: "x" + i,
      date: new Date(ahora - i * 3600_000 * 5).toISOString(),
      amount: (i % 7) + 1.5,
      merchant: ["Mercadona", "Bar Paco", "Repsol", "Amazon", "Bizum a Ana"][i % 5],
      category: ["super", "bares", "transporte", "compras", "otros"][i % 5],
      source: "manual",
    });
  }
  return out;
}
const deudas = Array.from({ length: 6 }, (_, i) => ({
  id: "d" + i, name: "Préstamo " + i, value: 6000 + i * 900, monthly: 180 + i * 12,
  apr: 5.5, account: "e2e", start: "2024-01-15", anchor: 8000 + i * 900,
}));
const metas = Array.from({ length: 6 }, (_, i) => ({
  id: "g" + i, name: "Meta " + i, target: 3000 + i * 500, saved: 400 + i * 220, emoji: "🎯", account: "e2e",
}));

test("entrar por primera vez en cada pestaña no bloquea el hilo principal", async ({ page }) => {
  await page.addInitScript(() => {
    window.__lt = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration));
      }).observe({ entryTypes: ["longtask"] });
    } catch (e) {}
  });
  await seedLoggedInDashboard(page, { expenses: historico(1200), debts: deudas, goals: metas });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });

  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 60_000 });
  await dismissNews(page);

  // La espera es el meollo: la app tiene huecos libres de sobra para adelantar el montaje de las
  // pestañas ANTES de que nadie toque nada. Si alguien vuelve a montarlas al tocar, aquí se ve.
  await page.waitForTimeout(6000);

  // Prueba directa de que el montaje se ha adelantado: las cuatro páginas del carrusel ya tienen
  // contenido sin que nadie haya tocado nada.
  const vivas = await page.locator(".track > .page-live").count();
  expect(vivas, `solo ${vivas} pestañas montadas tras 6 s de reposo`).toBeGreaterThanOrEqual(4);

  // Y montada no basta: lo CARO de cada pestaña también tiene que estar hecho ya. Gastos deja
  // para el final la detección de suscripciones (`heavyOk`), y eso esperaba a que la pestaña
  // estuviera ACTIVA — o sea que se pagaba al llegar, en la cola del gesto. Trazado con la CPU
  // x6: 67 ms de tarea, 59,7 de ellos un Layout completo por las ~50 etiquetas que aparecían de
  // golpe (2026-07-26). Las filas de suscripción SOLO viven en Gastos, así que verlas estando en
  // Inicio es la prueba de que el trabajo se adelantó. Es una comprobación estructural, no de
  // tiempos: no puede quedarse en flaky cuando el CI vaya lento.
  expect(await page.locator('.botnav-tab.active').getAttribute("data-tour")).toBe("inicio");
  const subs = await page.locator(".sub-row").count();
  expect(subs, "la tarjeta cara de Gastos no se ha adelantado: sigue esperando a que entres").toBeGreaterThan(0);

  // Y la comprobación cara, solo en la pestaña que motivó el feedback (Deudas y Metas). Se mide
  // una sola para no acaparar la máquina: con la CPU estrangulada, esta prueba compite con el
  // resto del suite y hace flaquear a las que van con clics encadenados.
  await page.evaluate(() => { window.__lt = []; });
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator(".v4-debt, .v4-goal").first().waitFor({ timeout: 30_000 });
  const lt = await page.evaluate(() => window.__lt.slice());
  const bloqueo = lt.reduce((a, b) => a + b, 0);
  expect(bloqueo, `entrar en Deudas y Metas bloqueó el hilo ${bloqueo} ms (tareas: ${lt.join(",") || "ninguna"})`).toBeLessThan(TOPE_MS);

  // ⚠ LO QUE ESTA PRUEBA NO MIRABA, Y COSTÓ DOS VERSIONES (2026-07-26 noche). Entrar en la
  // pestaña Plan aterriza en RECIBOS. El segmento de Deudas se montaba aparte, al tocarlo
  // (`seg==="deudas" && <Debts/>`), y eso costaba 203 ms de hilo bloqueado con la CPU x6 — el
  // «en deudas y metas se relentiza de manera muy bestia» que él seguía marcando como fallo
  // mientras esta prueba pasaba en verde. La lección es la de siempre: medir LO QUE TOCA EL
  // USUARIO, no lo que es cómodo de medir. Estructural, como el de Gastos: los tres segmentos
  // tienen que estar montados ya, con Recibos siendo el único visible.
  /* data-seg también va en `.v4-seg-btn` (Pregúntame); las capas son hijas directas de `.v4-screen`. */
  for (const seg of ["recibos", "deudas", "metas"]) {
    await expect(page.locator(`.v4-screen > [data-seg="${seg}"]`), `el segmento «${seg}» de Plan no se ha montado por adelantado`).toHaveCount(1);
  }
  expect(await page.locator('.v4-screen > [data-seg="deudas"]').isVisible(), "Deudas debería estar montado pero NO visible").toBe(false);

  // Y montado no basta: los segmentos que NO se ven tienen que estar fuera del pintado. Con
  // `visibility:hidden` seguían participando en estilo, capas y pintado, y eso se pagaba en CADA
  // entrada y salida de Plan — medido el 2026-07-27: entrar en Plan 162 ms con `visibility:hidden`
  // contra 89 con `content-visibility:hidden` (la tabla con los tres candidatos, en 14-v4-screens.js).
  const cv = await page.locator('.v4-screen > [data-seg="deudas"]').evaluate((el) => getComputedStyle(el).contentVisibility);
  expect(cv, "el segmento oculto de Plan tiene que estar fuera del pintado (content-visibility:hidden)").toBe("hidden");
});

/* EL CASO QUE QUEDABA TRAS EL PREMOUNT (rechazo 4.12.0.17): scrollear dentro de Deudas/Metas
 * y deslizar acto seguido. El montaje ya no cuesta; lo que pelea es el momentum del scroll
 * con el translateX del track + setNavHidden re-renderizando App. */
test("scrollear Deudas y deslizar acto seguido no bloquea el hilo", async ({ page }) => {
  await page.addInitScript(() => {
    window.__lt = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration));
      }).observe({ entryTypes: ["longtask"] });
    } catch (e) {}
  });
  await seedLoggedInDashboard(page, { expenses: historico(1200), debts: deudas, goals: metas });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });

  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 60_000 });
  await dismissNews(page);
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await page.waitForTimeout(6000);

  // Click crudo (no locator.click): Playwright sondeando el DOM distorsiona la medida.
  await page.evaluate(() => {
    document.querySelector('.botnav-tab[data-tour="plan"]').click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll(".v4-seg-btn")).find((b) => /deuda|debt|deute/i.test(b.textContent || ""));
    if (btn) btn.click();
  });
  await page.waitForTimeout(300);
  // Los segmentos se montan ocultos: enseñar Deudas si el click del seg no bastó.
  await page.evaluate(() => {
    const seg = document.querySelector('.v4-screen > [data-seg="deudas"]');
    if (seg && getComputedStyle(seg).visibility === "hidden") {
      const btn = Array.from(document.querySelectorAll(".v4-seg-btn")).find((b) => /deuda|debt|deute/i.test(b.textContent || ""));
      if (btn) btn.click();
    }
  });
  await page.waitForTimeout(200);

  // Scroll real de la página activa (por encima del umbral de navHidden = 56).
  await page.evaluate(() => {
    const live = document.querySelector(".track .page-live") || document.querySelector(".track .page");
    if (live) live.scrollTop = 280;
  });
  await page.waitForTimeout(80);

  await page.evaluate(() => { window.__lt = []; });

  // Swipe a Gastos (anterior), CDP touch, y=200 como en swipe-pestanas.
  const W = page.viewportSize().width;
  const y = 200;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 80, y }] });
  for (let i = 1; i <= 16; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 80 + ((W - 40 - 80) * i) / 16, y }],
    });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(300);

  const lt = await page.evaluate(() => window.__lt.slice());
  const bloqueo = lt.reduce((a, b) => a + b, 0);
  expect(
    bloqueo,
    `scroll→swipe bloqueó el hilo ${bloqueo} ms (tareas: ${lt.join(",") || "ninguna"})`,
  ).toBeLessThan(TOPE_MS);
});

/* ABRIR EL PERFIL NO PUEDE RE-PINTAR LAS CUATRO PESTAÑAS (feedback 2026-07-26: «lo del perfil
 * está arreglado para salir, ahora es inmediato, pero para entrar sigue pasando lo mismo»).
 *
 * Lo que se creía —que el coste era la animación del panel de ~1.680 px creciendo de 0,12 a 1—
 * se midió y NO era: con TODAS las transiciones apagadas costaba lo mismo, y quitando el panel
 * entero del DOM el toque seguía costando ~195 ms. El coste era el re-render de App: las cuatro
 * páginas se construían dentro de su render, así que cualquier estado de App las repintaba todas.
 * A/B intercalado contra la beta anterior, CPU x12 y 1.200 gastos:
 *   abrir el perfil                     339 → 175 ms
 *   esconder la barra al hacer scroll   123 →   0 ms
 *
 * Los dos casos van juntos porque son el MISMO fallo por dos puertas, y el del scroll es el que
 * mejor lo delata: esconder la barra inferior es un `setNavHidden` y nada más — si vuelve a
 * costar decenas de milisegundos, es que algo ha vuelto a colgar las pestañas del render de App.
 * Umbrales generosos y a x6 como el resto del fichero: esto vigila la estructura, no persigue
 * milisegundos (un guardián de tiempos en CI acaba en flaky). */
test("abrir el perfil y esconder la barra no arrastran a las cuatro pestañas", async ({ page }) => {
  await page.addInitScript(() => {
    window.__lt = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration));
      }).observe({ entryTypes: ["longtask"] });
    } catch (e) {}
  });
  await seedLoggedInDashboard(page, { expenses: historico(1200), debts: deudas, goals: metas });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });

  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 60_000 });
  await dismissNews(page);
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  // 9 s: el premontaje de las cuatro pestañas Y del perfil se hace en huecos libres y termina
  // sobre los 7 s. Antes de eso el coste que se mide es el del montaje, no el del re-render.
  await page.waitForTimeout(9000);

  // El perfil tiene que estar montado YA, sin que nadie lo haya abierto: es la mitad estructural
  // de la prueba (montarlo dentro del toque es lo que hacía cara la primera apertura).
  await expect(page.locator(".profile-pull .profile-pull-h"), "el perfil no se ha premontado en reposo").toHaveCount(1);

  // 1) Esconder la barra inferior al hacer scroll: un solo `setNavHidden` y nada más.
  await page.evaluate(() => { window.__lt = []; });
  await page.evaluate(() => {
    const live = document.querySelector(".track .page-live");
    if (live) { live.scrollTop = 0; live.dispatchEvent(new Event("scroll")); live.scrollTop = 300; live.dispatchEvent(new Event("scroll")); }
  });
  await page.waitForTimeout(600);
  const lt = await page.evaluate(() => window.__lt.slice());
  const bloqueo = lt.reduce((a, b) => a + b, 0);
  // Medido en este mismo entorno: con las pestañas colgando del render de App, 62-83 ms; con el
  // useMemo, 0 ms en todas las pasadas. El umbral está a mitad de camino a propósito.
  expect(bloqueo, `esconder la barra bloqueó el hilo ${bloqueo} ms (tareas: ${lt.join(",") || "ninguna"}) — las pestañas se están re-renderizando con App`).toBeLessThan(45);

  // 2) Y abrir el perfil sigue funcionando (que la optimización no se lleve por delante lo que
  //    tiene que hacer). El TIEMPO de abrir no se vigila aquí: son 175 ms contra 339 medidos con
  //    el banco A/B intercalado, pero en el CI la misma medida baila entre 171 y 231 en el mismo
  //    código — un umbral ahí sería un test intermitente, que es peor que no tenerlo. Lo que sí
  //    se vigila es la parte que puede romperse en silencio: el premontaje de arriba.
  await page.evaluate(() => { document.querySelector(".v4-avatar").click(); });
  await expect(page.locator(".profile-pull")).toHaveClass(/open/, { timeout: 10_000 });
  await expect(page.locator(".profile-pull")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)", { timeout: 5_000 });
});
