/* APUNTAR: TODO EL TECLADO A LA VISTA, Y LOS GRISES QUE SE LEEN (auditoría de diseño 14/11).
 *
 *  1. A 412×915 la fila «, 0 Borrar» quedaba debajo del botón «Apuntar»: el toque en el «0» caía
 *     en el botón y para escribir 10, 20 o 50 había que deslizar la hoja primero. Se comprueba en
 *     el sitio donde falla de verdad —`elementFromPoint` del centro de cada tecla— en un móvil
 *     pequeño, en el del dueño y con la barra de gestos (zona segura abajo y arriba).
 *  2. `--muted-2` es texto en casi todos sus usos y no llegaba a 4,5:1 en ningún tema; el menta del
 *     tema Claro tampoco, ni como texto ni con el blanco de los botones encima. Se mide contra los
 *     colores que la app calcula en ese tema, no contra lo escrito en el CSS. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ hasTouch: true, isMobile: true });

async function appLista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

const TAMANOS = [
  { nombre: "360×740", viewport: { width: 360, height: 740 } },
  { nombre: "412×915", viewport: { width: 412, height: 915 } },
  // La APK pinta de borde a borde: la barra de gestos y la de estado llegan como zona segura.
  { nombre: "412×915 con barra de gestos", viewport: { width: 412, height: 915 }, seguro: { abajo: 34, arriba: 40 } },
];

for (const tam of TAMANOS) {
  test.describe(tam.nombre, () => {
    test.use({ viewport: tam.viewport });
    test("las doce teclas y «Apuntar» se tocan sin deslizar la hoja", async ({ page }) => {
      await seedLoggedInDashboard(page);
      if (tam.seguro) {
        await page.addInitScript((s) => {
          document.addEventListener("DOMContentLoaded", () => {
            const st = document.createElement("style");
            st.textContent = ":root:root:root{--safe-bottom:" + s.abajo + "px!important;--safe-top:" + s.arriba + "px!important}";
            document.head.appendChild(st);
          });
        }, tam.seguro);
      }
      await page.goto("/");
      await appLista(page);
      await page.locator(".botnav-fab").click();
      const hoja = page.locator(".v4-exp-sheet");
      await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
      // Fin de la entrada de la hoja (sheetup, 420 ms): a mitad las teclas aún están por debajo.
      await page.waitForTimeout(600);
      const medida = await page.evaluate(() => {
        const toca = (el) => {
          const r = el.getBoundingClientRect();
          const x = r.left + r.width / 2, y = r.top + r.height / 2;
          if (y < 0 || y > innerHeight) return false;
          const h = document.elementFromPoint(x, y);
          return !!h && (h === el || el.contains(h));
        };
        const teclas = [...document.querySelectorAll(".v4-exp-sheet .v4-keys button")];
        const cuerpo = document.querySelector(".v4-exp-sheet .v4-sheet-body");
        return {
          tapadas: teclas.filter((k) => !toca(k)).map((k) => k.getAttribute("aria-label") || k.textContent),
          boton: toca(document.querySelector(".v4-exp-sheet .v4-cta")),
          desplazado: cuerpo ? cuerpo.scrollTop : 0,
        };
      });
      expect(medida.desplazado).toBe(0);
      expect(medida.tapadas).toEqual([]);
      expect(medida.boton).toBe(true);
      // Y tocarlas escribe: el «0» de la última fila era justo el que caía en el botón.
      await hoja.getByRole("button", { name: "1", exact: true }).click();
      await hoja.getByRole("button", { name: "0", exact: true }).click();
      await expect(hoja.locator(".v4-cta")).toContainText("10");
    });
  });
}

test("--muted-2 y el menta de Claro se leen (≥4,5:1) en Verde, Oscuro y Claro", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  const medidas = await page.evaluate(() => {
    const rgb = (css) => {
      const c = document.createElement("canvas").getContext("2d");
      c.fillStyle = css; const h = c.fillStyle.slice(1);
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    };
    const lum = (c) => { const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const out = {};
    for (const tema of ["green", "dark", "light"]) {
      document.documentElement.setAttribute("data-theme", tema);
      const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
      out[tema] = {
        muted2Fondo: ratio(v("--muted-2"), v("--bg")),
        muted2Tarjeta: ratio(v("--muted-2"), v("--surface")),
        // Que siga por debajo de --muted: es el gris de segundo nivel, no otro --muted.
        muted2MenosQueMuted: ratio(v("--muted"), v("--bg")) > ratio(v("--muted-2"), v("--bg")),
        mintFondo: ratio(v("--mint"), v("--bg")),
        sobreMenta: ratio(v("--on-mint"), v("--mint")),
        sobreMentaHi: ratio(v("--on-mint"), v("--mint-hi")),
      };
    }
    return out;
  });
  for (const [tema, m] of Object.entries(medidas)) {
    expect.soft(m.muted2Fondo, tema + " --muted-2 sobre --bg").toBeGreaterThanOrEqual(4.5);
    expect.soft(m.muted2Tarjeta, tema + " --muted-2 sobre --surface").toBeGreaterThanOrEqual(4.5);
    expect.soft(m.muted2MenosQueMuted, tema + " --muted-2 sigue siendo el gris suave").toBe(true);
    expect.soft(m.mintFondo, tema + " --mint como texto").toBeGreaterThanOrEqual(4.5);
    expect.soft(m.sobreMenta, tema + " texto sobre --mint").toBeGreaterThanOrEqual(4.5);
    expect.soft(m.sobreMentaHi, tema + " texto sobre --mint-hi").toBeGreaterThanOrEqual(4.5);
  }
});
