/* APUNTAR, REDISEÑO APROBADO (auditoría de diseño 15/11, bloque A). Se mide en el sitio donde se ve
 * —`getBoundingClientRect` y `elementFromPoint`, como `apuntar-teclado-visible`— en un móvil bajo
 * (360×640), en uno normal (390×844) y en el del dueño (412×915), con la letra por defecto y con la
 * Enorme (zoom 1,26 en el body: los rect llegan en px de pantalla).
 *
 *  DIS-02  El importe se veía a 34 px, menos que la cifra de Gastos que queda detrás: una regla
 *          posterior con la misma especificidad le pisaba el clamp. Y su alto no puede saltar al
 *          teclear la primera cifra (arreglo D1), ni cortarse un importe largo a 360.
 *  DIS-01  El cuerpo medía 683 px y había 621 a la vista (441 a 640): las categorías quedaban bajo el
 *          teclado. Se gana quitando filas, no encogiendo teclas (56 px, las pidió él): una fila de
 *          cuatro categorías con «Más», sin la cabecera «Categoría · Las 32», y en móviles bajos la
 *          hoja a pantalla completa.
 *  DIS-07  Con la letra Enorme el zoom multiplicaba el 88dvh y la hoja se salía por arriba: sin asa,
 *          sin Gasto/Ingreso y sin ninguna categoría a la vista.
 *  DIS-06  La hoja tapaba la línea de resumen de Gastos y la cifra del fondo competía con el importe. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ hasTouch: true, isMobile: true });

const TAMANOS = [[360, 640], [390, 844], [412, 915]];
const LETRAS = ["normal", "huge"];

async function abreApuntar(page, { w, h, letra }) {
  await page.setViewportSize({ width: w, height: h });
  await seedLoggedInDashboard(page, { settings: { autoPrices: false, theme: "green", budgetCycle: true, textSize: letra } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator(".botnav-fab").click();
  const hoja = page.locator(".v4-exp-sheet");
  await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
  // Fin de la entrada de la hoja (sheetup, 420 ms): a mitad todo está aún más abajo.
  await page.waitForTimeout(600);
  return hoja;
}

// Todo en px de pantalla. «Se toca» = `elementFromPoint` del centro cae en el propio elemento.
async function mideHoja(page) {
  return page.evaluate(() => {
    const toca = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return false;
      const h = document.elementFromPoint(x, y);
      return !!h && (h === el || el.contains(h));
    };
    const hoja = document.querySelector(".v4-exp-sheet");
    const cuerpo = hoja.querySelector(".v4-sheet-body");
    const teclas = [...hoja.querySelectorAll(".v4-keys button")];
    const cats = [...hoja.querySelectorAll(".v4-ficha-cats .v4-ficha-cat")];
    const resumen = [...document.querySelectorAll('.page-scroll-host [data-testid="gastos-estado"],.page-scroll-host [data-testid="gastos-desglose"]')]
      .map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0);
    return {
      hojaArriba: hoja.getBoundingClientRect().top,
      asaArriba: hoja.querySelector(".v4-sheet-handle").getBoundingClientRect().top,
      tipoArriba: Math.min(...[...hoja.querySelectorAll(".v4-ficha-head .v4-seg-btn")].map((b) => b.getBoundingClientRect().top)),
      tipoSeToca: [...hoja.querySelectorAll(".v4-ficha-head .v4-seg-btn")].every(toca),
      tapadas: teclas.filter((k) => !toca(k)).map((k) => k.getAttribute("aria-label")),
      teclaAlto: Math.min(...teclas.map((k) => k.getBoundingClientRect().height)),
      boton: toca(hoja.querySelector(".v4-cta")),
      desplazado: cuerpo.scrollTop,
      sobra: cuerpo.scrollHeight - cuerpo.clientHeight,
      nCats: cats.length,
      ultimaCat: cats.length ? cats[cats.length - 1].getAttribute("data-testid") : null,
      filas: new Set(cats.map((c) => Math.round(c.getBoundingClientRect().top))).size,
      // El NOMBRE de cada baldosa, no solo la baldosa: es lo que se lee para elegir.
      nombresVisibles: cats.filter((c) => toca(c.lastElementChild)).length,
      resumenAbajo: resumen.length ? Math.max(...resumen.map((r) => r.bottom)) : null,
    };
  });
}

for (const [w, h] of TAMANOS) for (const letra of LETRAS) {
  test.describe(`${w}×${h}, letra ${letra}`, () => {
    test("DIS-02: el importe va grande, no salta al teclear y un importe largo no se corta", async ({ page }) => {
      const hoja = await abreApuntar(page, { w, h, letra });
      const importe = hoja.locator(".v4-ficha-amount");
      const mide = () => importe.evaluate((el) => ({
        // En px de pantalla: con la letra Enorme el body lleva zoom y el CSS se encoge para caber.
        px: parseFloat(getComputedStyle(el).fontSize) * (parseFloat(getComputedStyle(document.body).zoom) || 1),
        alto: el.getBoundingClientRect().height,
        cabe: el.scrollWidth <= el.clientWidth + 1,
      }));
      const vacio = await mide();
      // El clamp de la ficha (40-56 px, 13vw): unos 47 px a 360 y 51 a 390; la cifra de Gastos, 46.
      expect(vacio.px).toBeGreaterThanOrEqual(46);
      for (const k of ["1", "2", "5"]) await hoja.getByRole("button", { name: k, exact: true }).click();
      await expect(importe).toHaveText("125");
      const lleno = await mide();
      expect(Math.abs(lleno.alto - vacio.alto)).toBeLessThan(0.5);
      // El más largo que deja escribir el teclado: siete cifras con decimales.
      for (let i = 0; i < 3; i++) await hoja.getByRole("button", { name: "Borrar", exact: true }).click();
      for (const k of ["1", "2", "3", "4", "5", ",", "6", "7"]) await hoja.getByRole("button", { name: k, exact: true }).click();
      await expect(importe).toHaveText("12345,67");
      expect((await mide()).cabe).toBe(true);
    });

    test("DIS-01/07: asa, teclado y botón a la vista, teclas de 56 px y una sola fila de categorías", async ({ page }) => {
      await abreApuntar(page, { w, h, letra });
      const m = await mideHoja(page);
      expect(m.asaArriba).toBeGreaterThanOrEqual(0);
      expect(m.tipoArriba).toBeGreaterThanOrEqual(0);
      expect(m.tipoSeToca).toBe(true);
      expect(m.tapadas).toEqual([]);
      expect(m.boton).toBe(true);
      expect(m.desplazado).toBe(0);
      // Las teclas no se encogen: 56 px en pantalla también con la letra Enorme (no 56 × zoom).
      expect(m.teclaAlto).toBeGreaterThanOrEqual(55.5);
      expect(m.teclaAlto).toBeLessThan(57);
      expect(m.nCats).toBe(5);
      expect(m.ultimaCat).toBe("ap-cat-more");
      expect(m.filas).toBe(1);
      if (letra === "huge") {
        // Con Enorme las categorías son una fila que se desliza: al menos una se lee entera.
        expect(m.nombresVisibles).toBeGreaterThanOrEqual(1);
      } else if (h >= 780) {
        expect(m.sobra, "sin scroll en el cuerpo").toBeLessThanOrEqual(1);
        expect(m.nombresVisibles).toBe(5);
      } else {
        // Móvil bajo: la hoja ocupa la pantalla entera menos un respiro arriba.
        expect(m.hojaArriba).toBeLessThanOrEqual(12);
      }
    });

    test("DIS-01: «Más» abre todas las categorías y la elegida entra en la fila", async ({ page }) => {
      const hoja = await abreApuntar(page, { w, h, letra });
      await hoja.locator('[data-testid="ap-cat-more"]').click();
      const todas = page.locator(".v4-ficha-cat-sheet");
      await expect(todas).toBeVisible();
      await page.waitForTimeout(500);
      // La hoja hija tampoco se sale por arriba con el zoom.
      expect(await todas.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
      await todas.locator('[data-testid="expense-all-cat-mascotas"]').click();
      await expect(todas).toHaveCount(0);
      await expect(hoja.locator('[data-testid="ap-cat-mascotas"]')).toHaveAttribute("aria-pressed", "true");
      await expect(hoja.locator(".v4-ficha-cats .v4-ficha-cat")).toHaveCount(5);
    });
  });
}

test.describe("390×844 y 412×915 sobre Gastos", () => {
  for (const [w, h] of [[390, 844], [412, 915]]) {
    test(`DIS-06 ${w}×${h}: la hoja empieza por debajo de la línea de resumen y el velo apaga más el fondo`, async ({ page }) => {
      await abreApuntar(page, { w, h, letra: "normal" });
      const m = await mideHoja(page);
      expect(m.resumenAbajo).not.toBeNull();
      expect(m.hojaArriba).toBeGreaterThan(m.resumenAbajo);
      const velo = await page.evaluate(() => getComputedStyle(document.querySelector(".v4-exp-sheet").parentElement, "::before").backgroundColor);
      expect(velo).toBe("rgba(8, 28, 20, 0.33)");
    });
  }
});
