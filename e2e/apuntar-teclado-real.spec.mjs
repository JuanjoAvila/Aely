/* APUNTAR CON EL TECLADO DE ANDROID DE VERDAD (su vídeo del 18/11, 4.26.239 en el OnePlus 13).
 *
 * 1. Ocultar el teclado con su flecha ⌄ o con Atrás NO quita el foco: la hoja se quedaba compacta (concepto,
 *    categorías y «Listo»), sin teclado y sin numérico, hasta pulsar «Listo». Al irse el teclado tiene que
 *    volver sola, como con «Listo».
 * 2. El teclado de verdad sube animándose (~250 ms); el de las pruebas anteriores aparecía de golpe y por eso
 *    no se vio que, mientras sube, asomaba la lista de Gastos y la barra de abajo entre la hoja y el teclado,
 *    ni que al volver a abrirlo tapaba las categorías antes de que la hoja se moviera. Aquí sube por pasos
 *    (el visualViewport encoge en cinco pasos durante 250 ms, con un teclado pintado encima) y se mira cada
 *    fotograma: entre la hoja y el teclado nunca hay fondo, y la segunda vez las categorías no quedan debajo. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ hasTouch: true, isMobile: true });

const W = 412, H = 915, KB = 340;
const ESTADO = {
  accounts: [
    { id: "sab", ent: "sabadell", name: "Nómina", value: 1500 },
    { id: "ef", ent: "efectivo", name: "El sobre", value: 60, role: "fijos" },
  ],
  settings: { autoPrices: false, theme: "green" },
};

async function abreApuntar(page) {
  await page.setViewportSize({ width: W, height: H });
  await seedLoggedInDashboard(page, ESTADO);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator(".botnav-fab").click();
  const hoja = page.locator(".v4-exp-sheet");
  await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
  await page.waitForTimeout(450);
  await page.waitForFunction(() => { const s = document.querySelector(".v4-exp-sheet"); return !!s && s.getAnimations().length === 0; });
  // visualViewport de mentira y un teclado pintado encima que sube o baja por pasos.
  await page.evaluate(() => {
    const ev = new EventTarget();
    const vv = { height: innerHeight, offsetTop: 0, scale: 1,
      addEventListener: ev.addEventListener.bind(ev), removeEventListener: ev.removeEventListener.bind(ev) };
    Object.defineProperty(window, "visualViewport", { configurable: true, get: () => vv });
    const k = document.createElement("div");
    k.id = "__kb";
    k.style.cssText = "position:fixed;left:0;right:0;bottom:0;height:0;z-index:2147483646;pointer-events:none;background:#2b2d36";
    document.body.appendChild(k);
    window.__kbAlto = 0;
    // alFinal: el visualViewport no cambia hasta que el teclado acaba de subir (lo que se ve en su OnePlus).
    window.__teclado = (px, pasos = 5, ms = 250, alFinal = false) => new Promise((ok) => {
      const desde = window.__kbAlto;
      let i = 0;
      const paso = () => {
        i++;
        const h = Math.round(desde + ((px - desde) * i) / pasos);
        window.__kbAlto = h; k.style.height = h + "px";
        if (!alFinal || i === pasos) { vv.height = innerHeight - h; ev.dispatchEvent(new Event("resize")); }
        if (i < pasos) setTimeout(paso, ms / pasos); else ok();
      };
      setTimeout(paso, ms / pasos);
    });
    // Chrome desplaza la pantalla (visualViewport.offsetTop) para enseñar el campo enfocado si el teclado
    // lo tapa: en su vídeo, con la hoja aún abajo al acabar de subir el teclado.
    window.__desplaza = (px, pasos = 6, ms = 150) => new Promise((ok) => {
      const desde = vv.offsetTop;
      let i = 0;
      const paso = () => {
        i++;
        vv.offsetTop = Math.round(desde + ((px - desde) * i) / pasos); ev.dispatchEvent(new Event("scroll"));
        if (i < pasos) setTimeout(paso, ms / pasos); else ok();
      };
      setTimeout(paso, ms / pasos);
    });
  });
  return hoja;
}

/* Por fotograma (rAF), 700 ms: hasta dónde llega la hoja por abajo (con el fondo propio que lleva debajo
   mientras hay teclado), dónde empieza el teclado y dónde acaban las categorías. */
const graba = (page) => page.evaluate(() => new Promise((ok) => {
  const out = [], t0 = performance.now();
  const f = () => {
    const hoja = document.querySelector(".v4-exp-sheet"), r = hoja.getBoundingClientRect();
    // Las copias del fondo de la hoja que van debajo (sombras sin desenfoque del color de la hoja).
    const fondo = getComputedStyle(hoja).backgroundColor;
    const sombras = getComputedStyle(hoja).boxShadow.split(/,(?![^(]*\))/).map((s) => s.trim());
    let cubre = r.bottom;
    for (const s of sombras) {
      const m = s.match(/^(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/);
      if (m && m[1].replace(/\s/g, "") === fondo.replace(/\s/g, "") && +m[4] === 0 && +m[2] === 0) cubre = Math.max(cubre, r.bottom + +m[3]);
    }
    const cats = [...hoja.querySelectorAll(".v4-ficha-cats .v4-ficha-cat")].map((c) => c.getBoundingClientRect().bottom);
    // Borde de arriba del teclado en coordenadas de la página: con la pantalla desplazada, más abajo.
    const vv = window.visualViewport;
    out.push({ t: performance.now() - t0, kbTop: vv.offsetTop > 0 ? vv.offsetTop + vv.height : innerHeight - window.__kbAlto, cubre, abajo: r.bottom, cats: Math.max(0, ...cats) });
    if (performance.now() - t0 < 700) requestAnimationFrame(f); else ok(out);
  };
  requestAnimationFrame(f);
}));

const vuelveNormal = async (hoja) => {
  await expect(hoja.locator(".v4-ficha-concept")).not.toBeFocused();
  await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
  await expect(hoja.locator(".v4-keys")).toBeVisible();
  await expect(hoja.getByTestId("ap-pay-card")).toBeVisible();
  await expect(hoja.locator(".v4-ficha-head")).toBeVisible();
  await expect(hoja.locator(".v4-cta")).toContainText("Apuntar");
};

test("ocultar el teclado sin «Listo» (⌄ o Atrás) devuelve la hoja entera", async ({ page }) => {
  const hoja = await abreApuntar(page);
  await hoja.locator(".v4-ficha-concept").click();
  await page.evaluate((px) => window.__teclado(px), KB);
  await hoja.locator(".v4-ficha-concept").pressSequentially("Pan");
  await page.waitForTimeout(400);
  await expect(hoja.locator(".v4-keys")).toBeHidden();
  // El teclado se va sin tocar nada de la hoja: el campo seguiría enfocado.
  await page.evaluate(() => window.__teclado(0));
  await page.waitForTimeout(450);
  await vuelveNormal(hoja);
  await expect(hoja.locator(".v4-ficha-concept")).toHaveValue("Pan");
  // Y se puede volver a escribir: el teclado vuelve a sacar la hoja compacta.
  await hoja.locator(".v4-ficha-concept").click();
  await page.evaluate((px) => window.__teclado(px), KB);
  await page.waitForTimeout(450);
  await expect(hoja.locator(".v4-keys")).toBeHidden();
  await expect(hoja.locator(".v4-cta")).toHaveText("Listo");
});

test("con la ventana que encoge, ocultar el teclado sin «Listo» también la devuelve", async ({ page }) => {
  const hoja = await abreApuntar(page);
  await hoja.locator(".v4-ficha-concept").click();
  // Sin el visualViewport de mentira: la ventana entera encoge y vuelve.
  await page.evaluate(() => { delete window.visualViewport; });
  await page.setViewportSize({ width: W, height: H - KB });
  await page.waitForTimeout(450);
  await expect(hoja.locator(".v4-keys")).toBeHidden();
  await page.setViewportSize({ width: W, height: H });
  await page.waitForTimeout(450);
  await vuelveNormal(hoja);
});

test("Chrome desplaza la pantalla al acabar de subir el teclado: la hoja va pegada a él en cada fotograma", async ({ page }) => {
  const hoja = await abreApuntar(page);
  await hoja.locator(".v4-ficha-concept").click();
  await page.evaluate((px) => window.__teclado(px), KB);
  const registro = graba(page);
  await page.evaluate(() => window.__desplaza(120));
  const fr = await registro;
  const fondo = fr.filter((x) => x.cubre < x.kbTop - 1);
  expect(fondo.map((x) => Math.round(x.t) + "ms:" + Math.round(x.kbTop - x.cubre) + "px"), "fondo entre la hoja y el teclado").toEqual([]);
  const encima = fr.filter((x) => x.abajo > x.kbTop + 1);
  expect(encima.map((x) => Math.round(x.t) + "ms"), "la hoja no se mete bajo el teclado").toEqual([]);
});

for (const alFinal of [false, true]) test("el teclado sube animándose (" + (alFinal ? "la ventana se entera al final" : "la ventana encoge a la vez") + "): nunca asoma el fondo entre la hoja y el teclado, y la segunda vez no tapa las categorías", async ({ page }) => {
  const hoja = await abreApuntar(page);
  for (const vez of [1, 2]) {
    await hoja.locator(".v4-ficha-concept").click();
    const registro = graba(page);
    await page.evaluate(([px, alFinal]) => window.__teclado(px, 5, 250, alFinal), [KB, alFinal]);
    const fr = await registro;
    expect(fr.length).toBeGreaterThan(10);
    const fondo = fr.filter((x) => x.cubre < x.kbTop - 1);
    expect(fondo.map((x) => Math.round(x.t) + "ms:" + Math.round(x.kbTop - x.cubre) + "px"), "vez " + vez + ": fondo entre la hoja y el teclado").toEqual([]);
    const ultimo = fr[fr.length - 1];
    expect(Math.abs(ultimo.abajo - ultimo.kbTop), "vez " + vez + ": la hoja acaba pegada al teclado").toBeLessThanOrEqual(1);
    if (vez === 2) {
      // Con el alto del teclado de la primera vez, la hoja sube a la vez que él.
      const tapadas = fr.filter((x) => x.cats > x.kbTop + 1);
      expect(tapadas.map((x) => Math.round(x.t) + "ms"), "las categorías no quedan bajo el teclado mientras sube").toEqual([]);
    }
    await hoja.locator('[data-testid="ap-kb-done"]').click();
    await page.evaluate(() => window.__teclado(0));
    await page.waitForTimeout(450);
    await vuelveNormal(hoja);
  }
});
