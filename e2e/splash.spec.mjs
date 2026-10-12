import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard } from "./fixtures.mjs";

/* SPLASH DE ENTRADA — que exista NO es que se vea.
 *
 * En la 4.10.0 el splash estaba dentro de `#root`, y `ReactDOM.createRoot()` VACÍA su contenedor
 * en el primer render: React se lo llevaba por delante en cuanto montaba. Encima, React, ReactDOM
 * y supabase-js iban en el `<head>`, así que el navegador ni siquiera llegaba al `<body>` —no
 * tenía nada que pintar— hasta haberlos ejecutado enteros. Resultado en el móvil del usuario:
 * pantalla negra y ningún splash (vídeo 2026-07-25). Y nada fallaba: el elemento existía en el
 * HTML, así que un grep lo habría dado por bueno.
 *
 * Esto comprueba las tres cosas que tienen que cumplirse para que se VEA.
 */
test("el splash es hermano de #root (React no puede llevárselo)", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  const dentro = await page.evaluate(() => {
    const l = document.getElementById("mc-load");
    return { existe: !!l, dentroDeRoot: !!(l && l.closest("#root")) };
  });
  expect(dentro.existe).toBe(true);
  expect(dentro.dentroDeRoot).toBe(false);
});

test("los scripts pesados van DESPUÉS del splash, no en el <head>", async ({ page }) => {
  const html = await (await page.request.get("/index.html")).text();
  const splash = html.indexOf('id="mc-load"');
  const cabeza = html.indexOf("</head>");
  expect(splash, "el splash tiene que existir").toBeGreaterThan(0);
  // Si React vuelve a la cabecera, el navegador no pinta nada hasta ejecutarlo entero.
  for (const marca of ["/* React */", "/* ReactDOM */", "vendor/supabase.min.js"]) {
    const pos = html.indexOf(marca);
    expect(pos, `${marca} tiene que ir después del splash`).toBeGreaterThan(splash);
    expect(pos, `${marca} no puede estar en el <head>`).toBeGreaterThan(cabeza);
  }
});

test("se ve de verdad: sigue en pantalla después de que React monte, y luego se va", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/", { waitUntil: "commit" });

  const splash = page.locator("#mc-load");
  // Montado React (#root con contenido) y el splash TODAVÍA encima: eso es lo que fallaba.
  await expect(page.locator("#root > *").first()).toBeAttached({ timeout: 15_000 });
  await expect(splash).toBeVisible();
  await expect(splash.locator(".mcl-mark svg")).toBeVisible();

  // Y no se queda para siempre.
  await expect(splash).toHaveCount(0, { timeout: 10_000 });
});

/* LA ENTRADA ANIMADA (2026-10-11). Petición suya: aprovechar la pantalla de carga con una
 * animación cuidada y que lo que tenga que cargar ocurra DETRÁS de ella, para que al entrar nada
 * vaya a tirones. Tres cosas que no se ven leyendo el diff:
 *   · que la animación se pinte sin una sola línea de JS (es lo que hay mientras el bundle carga),
 *   · que solo mueva lo que anima el compositor (el hilo principal está ocupado justo entonces),
 *   · y que al levantarse la cortina las cuatro pestañas estén ya montadas.
 */
test("la marca y su halo se pintan SIN JavaScript, y solo animan transform y opacity", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator("#mc-load .mcl-mark svg")).toBeVisible();
  const visto = await page.evaluate(() => {
    const marca = document.querySelector("#mc-load .mcl-mark");
    const dentro = (a) => { const t = a.effect && a.effect.target; return !!(t && t.closest && t.closest("#mc-load")); };
    const anims = document.getAnimations().filter(dentro);
    const props = new Set();
    for (const a of anims) for (const k of a.effect.getKeyframes()) {
      for (const p of Object.keys(k)) if (!["offset", "easing", "composite", "computedOffset"].includes(p)) props.add(p);
    }
    return {
      nombres: anims.map((a) => a.animationName),
      props: [...props].sort(),
      tarjeta: getComputedStyle(marca, "::after").backgroundColor,
      halo: getComputedStyle(marca, "::before").backgroundImage,
      caja: marca.offsetWidth,   // no `getBoundingClientRect`: a media entrada vendría escalada
    };
  });
  expect(visto.caja, "la tarjeta de la marca mide 94 px").toBe(94);
  expect(visto.tarjeta, "la tarjeta tiene que tener su fondo sin JS").not.toBe("rgba(0, 0, 0, 0)");
  expect(visto.halo, "el halo es un degradado, no una imagen ni nada cargado").toContain("radial-gradient");
  expect(visto.nombres, "el halo respira mientras se espera").toContain("mclhalo");
  // Un `stroke-dashoffset`, un `box-shadow` o un `background` animados se quedan clavados
  // mientras se evalúa el bundle: justo cuando se está mirando esta pantalla.
  expect(visto.props, "el splash solo puede animar lo que mueve el compositor").toEqual(["opacity", "transform"]);
  await ctx.close();
});

test("con «reducir movimiento» la marca está puesta y nada se mueve", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator("#mc-load .mcl-mark svg")).toBeVisible();
  const visto = await page.evaluate(() => ({
    anims: document.getAnimations().filter((a) => { const t = a.effect && a.effect.target; return !!(t && t.closest && t.closest("#mc-load")); }).length,
    opacidad: getComputedStyle(document.querySelector("#mc-load .mcl-mark")).opacity,
  }));
  expect(visto.anims, "ninguna animación del splash puede correr").toBe(0);
  expect(visto.opacidad, "y la marca tiene que verse igualmente").toBe("1");
  await ctx.close();
});

test("al levantarse la cortina las cuatro pestañas ya están montadas, y el logo se va antes que el fondo", async ({ page }) => {
  await page.addInitScript(() => {
    window.__splash = { vivas: null, muestras: [] };
    window.addEventListener("mc-splash-gone", () => {
      window.__splash.vivas = document.querySelectorAll(".track > .page-live").length;
    });
    // La salida empieza cuando el vigilante le quita los toques a la cortina; desde ahí se
    // muestrea, frame a frame, la opacidad REAL de la marca y la del fondo.
    new MutationObserver(() => {
      const l = document.getElementById("mc-load");
      if (!l || l.style.pointerEvents !== "none" || window.__splash.saliendo) return;
      window.__splash.saliendo = true;
      const mira = () => {
        const c = document.getElementById("mc-load"); if (!c) return;
        window.__splash.muestras.push([+getComputedStyle(c.querySelector(".mcl-mark")).opacity, +getComputedStyle(c).opacity]);
        requestAnimationFrame(mira);
      };
      requestAnimationFrame(mira);
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["style"] });
  });
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator("#mc-load")).toHaveCount(0, { timeout: 15_000 });
  const visto = await page.evaluate(() => window.__splash);
  // Si las pestañas se montan después, el primer deslizamiento paga el montaje dentro del gesto.
  expect(visto.vivas, "pestañas montadas en el momento de levantarse la cortina").toBe(4);
  // Con el logo todavía opaco sobre un fondo ya medio transparente se ven las dos pantallas a
  // la vez (su vídeo del 1/8). Tiene que haber un momento con el logo casi ido y el fondo entero.
  const logoAntes = visto.muestras.some(([marca, fondo]) => marca < 0.5 && fondo > 0.95);
  expect(logoAntes, "el logo no se desvanece antes que el fondo: " + JSON.stringify(visto.muestras.slice(0, 12))).toBe(true);
});

test("el tope retira la cortina aunque la nube no conteste", async ({ page }) => {
  await page.addInitScript(() => {
    window.addEventListener("mc-splash-gone", () => { window.__alLevantar = { nube: window.__mcBootReady === true, vencida: window.__mcSplashTimedOut === true }; });
  });
  // Un pull que tarda un minuto: `__mcBootReady` no llega, y aun así hay que entrar.
  await seedLoggedInDashboard(page, { __cloudDelays: { app_state: 60_000 } });
  await page.goto("/");
  await expect(page.locator("#mc-load")).toHaveCount(0, { timeout: 12_000 });
  const visto = await page.evaluate(() => window.__alLevantar);
  expect(visto, "la cortina se levantó por el tope, no porque la nube contestara").toEqual({ nube: false, vencida: true });
  await expect(page.locator(".botnav")).toBeVisible();
});

test("dentro de la APK el primer frame web arranca con el color del splash nativo", async ({ page }) => {
  // Solo se mira el primer frame: el primer script externo se retiene para que la app no llegue
  // a arrancar con un `Capacitor` de mentira.
  await page.route("**/vendor/supabase.min.js", () => {});
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true };
    localStorage.setItem("micartera_v3", JSON.stringify({ settings: { theme: "light" } }));
  });
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator("#mc-load .mcl-mark svg")).toBeVisible();
  const visto = await page.evaluate(() => {
    const velo = getComputedStyle(document.getElementById("mc-load"), "::before");
    return { nativo: document.documentElement.getAttribute("data-mc-nativo"), color: velo.backgroundColor, anim: velo.animationName };
  });
  // #0A1310 = `colorPrimary` de android/app/src/main/res/values/colors.xml.
  expect(visto).toEqual({ nativo: "1", color: "rgb(10, 19, 16)", anim: "mclnativo" });
});

test("fuera de la APK no hay velo oscuro: en tema claro el splash nace claro", async ({ page }) => {
  await page.route("**/vendor/supabase.min.js", () => {});
  await page.addInitScript(() => { localStorage.setItem("micartera_v3", JSON.stringify({ settings: { theme: "light" } })); });
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator("#mc-load .mcl-mark svg")).toBeVisible();
  const visto = await page.evaluate(() => ({
    velo: getComputedStyle(document.getElementById("mc-load"), "::before").content,
    fondo: getComputedStyle(document.getElementById("mc-load")).backgroundColor,
  }));
  expect(visto).toEqual({ velo: "none", fondo: "rgb(242, 246, 242)" });
});
