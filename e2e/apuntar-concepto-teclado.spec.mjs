/* APUNTAR ESCRIBIENDO EL CONCEPTO, CON EL TECLADO DEL SISTEMA (su queja del 17/11, OnePlus 13).
 *
 * Al tocar «Toca para escribir el concepto» salía el teclado y: el campo que se estaba escribiendo se
 * iba por arriba de la pantalla, la fila de pago quedaba montada bajo la barra de estado y debajo de
 * las categorías quedaba un hueco vacío enorme hasta «Listo» («está todo como hyper apretado»).
 *
 * La causa: al enfocar se fijaba el alto ENTERO de la hoja (con el numérico) y el tope salía de `dvh`.
 * En su WebView el teclado encoge la ventana pero `dvh` no, así que nada recortaba la hoja: conservaba
 * su alto, se salía por arriba y el sitio del numérico quedaba vacío. Aquí se simulan los dos casos de
 * Android: (1) la ventana se encoge y `dvh` se queda como estaba (se fija el tope de antes, como en su
 * móvil) y (2) el teclado va encima sin encoger nada (`visualViewport` de mentira). Con la barra de
 * estado como zona segura de 40 px, que es como pinta la APK de borde a borde.
 *
 * Con el concepto enfocado: el campo se ve entero dentro de lo visible; nada de la hoja queda por
 * encima de la zona segura; entre lo último que se ve y «Listo» no hay hueco, y «Listo» va pegado al
 * teclado; la cabecera, el pago y el numérico se apartan. Al pulsar «Listo» todo vuelve. Un concepto
 * largo se lee entero en dos renglones, escribiendo y después, sin trozos de letra ni «…» (filtro 239). */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ hasTouch: true, isMobile: true });

const SEGURO_ARRIBA = 40;
const ESTADO = {
  accounts: [
    { id: "sab", ent: "sabadell", name: "Nómina", value: 1500 },
    { id: "ef", ent: "efectivo", name: "El sobre", value: 60, role: "fijos" },
  ],
  settings: { autoPrices: false, theme: "green" },
};

async function abreApuntar(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await seedLoggedInDashboard(page, ESTADO);
  await page.addInitScript((s) => {
    document.addEventListener("DOMContentLoaded", () => {
      const st = document.createElement("style");
      st.textContent = ":root:root:root{--safe-top:" + s + "px!important}";
      document.head.appendChild(st);
    });
  }, SEGURO_ARRIBA);
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
  return hoja;
}

// Lo que se ve de la hoja, en px de pantalla. `abajo` = borde de arriba del teclado del sistema.
const mide = (page, abajo) => page.evaluate(([abajo, arriba]) => {
  const hoja = document.querySelector(".v4-exp-sheet");
  const cuerpo = hoja.querySelector(".v4-sheet-body");
  const concepto = hoja.querySelector(".v4-ficha-concept"), listo = hoja.querySelector(".v4-cta");
  const rc = concepto.getBoundingClientRect(), rl = listo.getBoundingClientRect();
  const h = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
  const visibles = [...cuerpo.children].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.height > 0.5 && getComputedStyle(el).visibility !== "hidden";
  });
  return {
    hojaArriba: hoja.getBoundingClientRect().top,
    conceptoArriba: rc.top, conceptoAbajo: rc.bottom,
    conceptoSeToca: !!h && (h === concepto || concepto.contains(h)),
    hueco: rl.top - Math.max(...visibles.map((el) => el.getBoundingClientRect().bottom)),
    bajoListo: abajo - rl.bottom,
    listoSeVe: rl.top >= arriba && rl.bottom <= abajo,
  };
}, [abajo, SEGURO_ARRIBA]);

// 45 caracteres: a 360 y a 412 no cabe en un renglón (antes: trozo de letra al escribir y «…» al terminar).
const LARGO = "Pan con tomate y café en el bar de la esquina";
const entero = (page) => page.evaluate(() => {
  const el = document.querySelector(".v4-exp-sheet .v4-ficha-concept"), cs = getComputedStyle(el);
  return { ancho: el.scrollWidth <= el.clientWidth + 1, alto: el.scrollHeight <= el.clientHeight + 1,
    elipsis: cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1,
    renglones: Math.round((el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight)) };
});

// Registro por fotograma (rAF) durante 700 ms al abrir el teclado: borde de la hoja, concepto, hueco antes de
// «Listo» (lo último que se ve, con opacidad, encima de él) y «Listo» frente al borde visible. Una foto al final
// no ve el hueco de ~140 px ni la hoja a −142 px que salían a mitad (filtro de diseño 239, segunda vuelta).
const graba = (page) => page.evaluate(() => new Promise((ok) => {
  const out = [], t0 = performance.now();
  const f = () => {
    const hoja = document.querySelector(".v4-exp-sheet"), c = hoja.querySelector(".v4-ficha-concept"), l = hoja.querySelector(".v4-cta");
    const rl = l.getBoundingClientRect(), abajo = Math.min(innerHeight, window.visualViewport ? window.visualViewport.height : innerHeight);
    const vis = [...hoja.querySelectorAll(".v4-ficha-body > *")].filter((el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return r.height > 0.5 && +cs.opacity > 0.05 && cs.visibility !== "hidden" && r.bottom <= rl.top + 2; });
    out.push({ t: performance.now() - t0, top: hoja.getBoundingClientRect().top, c: c.getBoundingClientRect().top,
      hueco: rl.top - Math.max(0, ...vis.map((el) => el.getBoundingClientRect().bottom)), bajo: abajo - rl.bottom });
    if (performance.now() - t0 < 700) requestAnimationFrame(f); else ok(out);
  };
  requestAnimationFrame(f);
}));
const nCats = (page) => page.locator(".v4-exp-sheet .v4-ficha-cats .v4-ficha-cat:visible").count();

const TAMANOS = [[412, 915, 340], [393, 851, 323], [360, 740, 290]];

for (const [w, h, teclado] of TAMANOS) {
  for (const modo of ["encoge", "encima"]) {
    test(`${w}×${h}, teclado ${modo === "encoge" ? "que encoge la ventana (dvh quieto)" : "encima de la ventana"}: el concepto se ve, nada bajo la barra de estado y «Listo» sin hueco`, async ({ page }) => {
      const hoja = await abreApuntar(page, w, h);
      if (modo === "encoge") {
        // Como en su móvil: el tope de la hoja en `dvh` no se entera del teclado.
        await page.evaluate(() => {
          const tope = getComputedStyle(document.querySelector(".v4-exp-sheet")).maxHeight;
          const st = document.createElement("style");
          st.textContent = 'html body .v4-sheet.v4-exp-sheet:has(>.v4-ficha-body[data-testid="ap"]){max-height:' + tope + "}";
          document.head.appendChild(st);
        });
      } else {
        await page.evaluate(() => {
          const ev = new EventTarget();
          const vv = { height: innerHeight, offsetTop: 0, scale: 1,
            addEventListener: ev.addEventListener.bind(ev), removeEventListener: ev.removeEventListener.bind(ev) };
          Object.defineProperty(window, "visualViewport", { configurable: true, get: () => vv });
          window.__teclado = (px) => { vv.height = innerHeight - px; ev.dispatchEvent(new Event("resize")); };
        });
      }
      const catsAntes = await nCats(page);
      await hoja.locator(".v4-ficha-concept").click();
      const registro = graba(page);
      if (modo === "encoge") await page.setViewportSize({ width: w, height: h - teclado });
      else await page.evaluate((px) => window.__teclado(px), teclado);
      const fr = await registro;
      expect(fr.length).toBeGreaterThan(10);
      // Con «Listo» ya a la vista: mientras sigue bajo el teclado, lo que haya encima tampoco se ve.
      const peorHueco = fr.filter((x) => x.bajo >= -1).reduce((a, x) => (x.hueco > a.hueco ? x : a), { hueco: 0, t: 0 });
      expect(peorHueco.hueco, "sin hueco antes de «Listo» en ningún fotograma (a los " + Math.round(peorHueco.t) + " ms)").toBeLessThanOrEqual(24);
      expect(Math.min(...fr.map((x) => x.top)), "la hoja nunca sube bajo la barra de estado").toBeGreaterThanOrEqual(SEGURO_ARRIBA - 0.5);
      // Ya subida (el teclado de verdad entra en ~250 ms; aquí aparece de golpe), «Listo» no queda bajo él.
      expect(fr.filter((x) => x.t > 320 && x.bajo < -1).length, "«Listo» a la vista tras la subida").toBe(0);
      // El concepto va hacia su sitio sin ir y volver.
      const c0 = fr[0].c, c1 = fr[fr.length - 1].c, contra = c1 >= c0 ? c0 - Math.min(...fr.map((x) => x.c)) : Math.max(...fr.map((x) => x.c)) - c0;
      expect(contra, "el concepto no se mueve en contra de su llegada").toBeLessThanOrEqual(40);
      await hoja.locator(".v4-ficha-concept").pressSequentially(LARGO);
      await expect(hoja.locator(".v4-cta")).toHaveText("Listo");
      // Fin de los pliegues (300 ms) y del margen que sube la hoja (250 ms).
      await page.waitForTimeout(650);
      await expect(hoja.locator(".v4-ficha-concept")).toBeFocused();
      const m = await mide(page, h - teclado);
      expect(m.conceptoArriba, "el concepto no se va por arriba").toBeGreaterThanOrEqual(SEGURO_ARRIBA);
      expect(m.conceptoAbajo, "ni queda bajo el teclado").toBeLessThanOrEqual(h - teclado);
      expect(m.conceptoSeToca, "el concepto se ve, nada lo tapa").toBe(true);
      expect(m.hojaArriba, "nada de la hoja bajo la barra de estado").toBeGreaterThanOrEqual(SEGURO_ARRIBA - 0.5);
      expect(m.hueco, "sin hueco muerto entre lo último y «Listo»").toBeLessThanOrEqual(24);
      expect(m.listoSeVe).toBe(true);
      expect(m.bajoListo, "«Listo» pegado al teclado").toBeLessThanOrEqual(24);
      // Mientras se escribe se apartan la cabecera, el pago y el numérico.
      await expect(hoja.locator('[data-testid="ap-pay-card"]')).toBeHidden();
      await expect(hoja.locator(".v4-ficha-head")).toBeHidden();
      await expect(hoja.locator(".v4-keys")).toBeHidden();
      await expect(hoja.locator(".v4-ficha-cats .v4-ficha-cat").first()).toBeVisible();
      // Un concepto largo se lee entero mientras se escribe: dos renglones partidos entre palabras.
      expect(await entero(page), "el concepto largo entero, sin cortes").toEqual({ ancho: true, alto: true, elipsis: false, renglones: 2 });
      const catsTeclado = await nCats(page);
      expect(catsTeclado, "escribiendo, las mismas categorías que al abrir").toBe(catsAntes);

      // «Listo» cierra el teclado y todo vuelve, sin guardar nada.
      await hoja.locator('[data-testid="ap-kb-done"]').click();
      if (modo === "encoge") await page.setViewportSize({ width: w, height: h });
      else await page.evaluate(() => window.__teclado(0));
      await page.waitForTimeout(650);
      await expect(hoja.locator(".v4-ficha-concept")).toHaveValue(LARGO);
      expect(await entero(page), "tras «Listo», el concepto largo entero, sin «…»").toEqual({ ancho: true, alto: true, elipsis: false, renglones: 2 });
      await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
      await expect(hoja.locator(".v4-keys")).toBeVisible();
      await expect(hoja.locator('[data-testid="ap-pay-card"]')).toBeVisible();
      await expect(hoja.locator(".v4-ficha-head")).toBeVisible();
      await expect(hoja.locator(".v4-cta")).toContainText("Apuntar");
      // Con el concepto en dos renglones no se pierde ninguna fila (a 393 encima, de 6 pasaba a 3).
      expect(await nCats(page), "tras «Listo», las mismas categorías que antes").toBe(catsTeclado);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").length)).toBe(0);
    });
  }
}

/* La baldosa del banco salía vacía cuando no hay banco de gasto diario: ahora es un hueco con «+»
   que abre los logos; y si no hay ningún banco que elegir, no sale. */
test("Apuntar: sin banco elegido la baldosa lleva «+» y abre los logos", async ({ page }) => {
  const hoja = await abreApuntar(page, 393, 851);
  const pill = hoja.getByTestId("ap-bank");
  await expect(pill.locator(".v4-banco-sin")).toHaveText("+");
  await pill.click();
  await expect(hoja.getByTestId("ap-bank-list").getByRole("button", { name: "Sabadell" })).toBeVisible();
});

test("Apuntar: sin ningún banco que elegir la baldosa no sale", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await seedLoggedInDashboard(page, { accounts: [{ id: "ef", ent: "efectivo", name: "El sobre", value: 60, role: "fijos" }], settings: { autoPrices: false } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator(".botnav-fab").click();
  const hoja = page.locator(".v4-exp-sheet");
  await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
  await expect(hoja.getByTestId("ap-pay-card")).toBeVisible();
  await expect(hoja.getByTestId("ap-bank")).toHaveCount(0);
});
