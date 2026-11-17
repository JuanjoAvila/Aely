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
 *  DIS-06  La hoja tapaba la línea de resumen de Gastos y la cifra del fondo competía con el importe.
 *  DIS-05  Escribiendo el concepto, el teclado numérico (o el del sistema) tapaba el campo. Aquí se
 *          simulan los dos casos de Android —la WebView que se encoge y el teclado que se pone
 *          encima—; la prueba de verdad es en el móvil (la de escritorio no tiene teclado).
 *  DIS-03  «¿Cómo pagaste?» eran tres mandos sueltos (banco, 💶 y «Con tarjeta») y se podía
 *          guardar efectivo + tarjeta + Sabadell. Ahora un segmentado que guarda los MISMOS campos
 *          que antes: esto es dinero, así que se comprueba lo que queda guardado, no lo que se ve. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, gastosAbreGasto } from "./fixtures.mjs";

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
  // Fin de la entrada de la hoja (sheetup, 420 ms): a mitad todo está aún más abajo. Con la máquina
  // cargada 600 ms fijos no bastaban: se espera a que la hoja no tenga animaciones vivas.
  await page.waitForTimeout(450);
  await page.waitForFunction(() => {
    const s = document.querySelector(".v4-exp-sheet");
    return !!s && s.getAnimations().length === 0;
  });
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
    // «Todas ›» al final de la fila (letra Muy grande o Enorme) no es una categoría.
    const cats = [...hoja.querySelectorAll(".v4-ficha-cats .v4-ficha-cat:not(.v4-ficha-todas-tile)")];
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
      // Por el centro: el segmentado mide 44 y la píldora 40, centrados en la misma fila.
      filasPago: new Set([...hoja.querySelectorAll(".v4-ficha-pay > *")].map((c) => { const r = c.getBoundingClientRect(); return Math.round((r.top + r.bottom) / 2); })).size,
      hojaAlto: hoja.getBoundingClientRect().height,
      resumenAbajo: resumen.length ? Math.max(...resumen.map((r) => r.bottom)) : null,
      resumenArriba: resumen.length ? Math.min(...resumen.map((r) => r.top)) : null,
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
      // Tres categorías (a 12 px no caben cuatro en un móvil) y «Todas ›» en la cabecera, como en la
      // ficha: la baldosa «Más» se fue en el remate de la 235.
      // Una fila de tres; dos (seis) donde caben enteras por alto, a 390 y 412 con letra normal
      // (crítico de la v4). Con letra Enorme, una fila que se desliza.
      const filasEsperadas = h >= 800 && letra === "normal" ? 2 : 1;
      expect(m.nCats).toBe(3 * filasEsperadas);
      // (Con letra Muy grande o Enorme va al final de la fila que se desliza, no en la cabecera.)
      await expect(page.locator(".v4-exp-sheet [data-testid=ap-cat-more]")).toHaveCount(1);
      expect(m.filas).toBe(filasEsperadas);
      if (letra === "huge") {
        // Con Enorme las categorías son una fila que se desliza: al menos una se lee entera.
        expect(m.nombresVisibles).toBeGreaterThanOrEqual(1);
      } else {
        // Importe, concepto, pago, categorías con su nombre, teclas y botón, sin deslizar nada.
        expect(m.sobra, "sin scroll en el cuerpo").toBeLessThanOrEqual(1);
        expect(m.nombresVisibles).toBe(3 * filasEsperadas);
        // El segmentado y la píldora del banco caben en una sola fila.
        expect(m.filasPago).toBe(1);
        // Móvil bajo: la hoja ocupa la pantalla entera menos un respiro arriba.
        if (h < 700) expect(m.hojaArriba).toBeLessThanOrEqual(12);
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
      await expect(hoja.locator(".v4-ficha-cats .v4-ficha-cat:not(.v4-ficha-todas-tile)")).toHaveCount(h >= 800 && letra === "normal" ? 6 : 3);
    });
  });
}

// Lo que se ve de un elemento: su centro cae en él y por encima de `limite` (el teclado del sistema).
const seVe = (page, sel, limite) => page.evaluate(([sel, limite]) => {
  const el = document.querySelector(sel), r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (r.top < 0 || r.bottom > (limite == null ? innerHeight : limite)) return false;
  const h = document.elementFromPoint(x, y);
  return !!h && (h === el || el.contains(h));
}, [sel, limite]);

for (const [w, h] of TAMANOS) for (const letra of LETRAS) {
  test(`DIS-05 ${w}×${h}, letra ${letra}: la WebView se encoge y el concepto sigue a la vista; «Listo» no guarda`, async ({ page }) => {
    const hoja = await abreApuntar(page, { w, h, letra });
    const antes = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").length);
    await hoja.getByRole("button", { name: "7", exact: true }).click();
    await hoja.locator(".v4-ficha-concept").click();
    // El teclado del sistema se lleva el 45 % de abajo (adjustResize).
    await page.setViewportSize({ width: w, height: Math.round(h * 0.55) });
    await page.waitForTimeout(400);
    await expect(hoja.locator(".v4-ficha-concept")).toBeFocused();
    await expect(hoja.locator(".v4-keys")).toBeHidden();
    await expect(hoja.locator(".v4-cta")).toHaveText(/^(Listo)$/);
    expect(await seVe(page, ".v4-exp-sheet .v4-ficha-concept")).toBe(true);
    await hoja.locator(".v4-ficha-concept").pressSequentially("Pan");
    await hoja.locator('[data-testid="ap-kb-done"]').click();
    await expect(hoja.locator(".v4-ficha-concept")).not.toBeFocused();
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    await expect(hoja.locator(".v4-cta")).toContainText("7");
    const m = await mideHoja(page);
    expect(m.tapadas).toEqual([]);
    expect(m.boton).toBe(true);
    await expect(hoja.locator(".v4-ficha-concept")).toHaveValue("Pan");
    // «Listo» solo cierra el teclado: el gasto no se ha guardado.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").length)).toBe(antes);
  });
}

for (const letra of LETRAS) {
  test(`DIS-05 390×844, letra ${letra}: con el teclado encima (sin encoger) la hoja se sube sobre él`, async ({ page }) => {
    const hoja = await abreApuntar(page, { w: 390, h: 844, letra });
    // visualViewport de mentira: el teclado ocupa 320 px de abajo y la ventana no cambia.
    await page.evaluate(() => {
      const ev = new EventTarget();
      const vv = { height: innerHeight, offsetTop: 0, scale: 1,
        addEventListener: ev.addEventListener.bind(ev), removeEventListener: ev.removeEventListener.bind(ev) };
      Object.defineProperty(window, "visualViewport", { configurable: true, get: () => vv });
      window.__teclado = (px) => { vv.height = innerHeight - px; ev.dispatchEvent(new Event("resize")); };
    });
    await hoja.locator(".v4-ficha-concept").click();
    await page.evaluate(() => window.__teclado(320));
    await page.waitForTimeout(450);
    const limite = 844 - 320;
    expect(await seVe(page, ".v4-exp-sheet .v4-ficha-concept", limite)).toBe(true);
    expect(await seVe(page, ".v4-exp-sheet .v4-cta", limite)).toBe(true);
    // Y el asa no se sale por arriba al subir.
    expect((await mideHoja(page)).asaArriba).toBeGreaterThanOrEqual(0);
    // Enter = Listo: se cierra el teclado y la hoja vuelve abajo.
    await hoja.locator(".v4-ficha-concept").press("Enter");
    await expect(hoja.locator(".v4-ficha-concept")).not.toBeFocused();
    await page.waitForTimeout(450);
    expect(await hoja.evaluate((el) => getComputedStyle(el).marginBottom)).toBe("0px");
    await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
    expect((await mideHoja(page)).tapadas).toEqual([]);
  });
}

// 719 px con dos filas, +13 cuando el borde sube para no partir la línea de resumen (crítico de la v5): 732.
const TOPE_DIS06_390 = 735;
test.describe("390×844 y 412×915 sobre Gastos", () => {
  for (const [w, h] of [[390, 844], [412, 915]]) {
    test(`DIS-06 ${w}×${h}: la hoja con dos filas de categorías cabe sin deslizar, dentro de su tope, y el velo apaga más el fondo`, async ({ page }) => {
      await abreApuntar(page, { w, h, letra: "normal" });
      const m = await mideHoja(page);
      /* DIS-06 pedía la hoja por debajo de la línea de resumen, ≤ 660 px a 390×844. Con la segunda fila
         de categorías (remate de la 235, crítico de la v4: seis sugerencias donde caben, como la ficha)
         ya no puede: la fila son ~64 px, y se prefirió tener la cuarta categoría a un toque antes que
         ver el resumen detrás. El tope sube lo justo, al alto medido con las dos filas, y lo que no
         cambia: la hoja no pasa de su máximo (88 %) ni se sale por arriba, y el velo. */
      expect(m.resumenAbajo).not.toBeNull();
      expect(m.sobra, "cabe sin deslizar").toBeLessThanOrEqual(1);
      if (w === 390) expect(m.hojaAlto).toBeLessThanOrEqual(TOPE_DIS06_390);
      expect(m.hojaAlto).toBeLessThanOrEqual(h * 0.88 + 0.5);
      expect(m.hojaArriba).toBeGreaterThanOrEqual(h * 0.12 - 0.5);
      // El borde de la hoja no parte la línea de resumen por la mitad (crítico de la v5, a 393): o la
      // deja entera encima, o la tapa entera.
      expect(m.hojaArriba > m.resumenArriba - 2 && m.hojaArriba < m.resumenAbajo + 2, "el borde no corta el resumen").toBe(false);
      const velo = await page.evaluate(() => getComputedStyle(document.querySelector(".v4-exp-sheet").parentElement, "::before").backgroundColor);
      expect(velo).toBe("rgba(8, 28, 20, 0.33)");
    });
  }
});

/* DIS-03, el dinero. Revolut de gasto diario y un sobre de efectivo, como en efectivo-apuntar. */
const CUENTAS = {
  accounts: [
    { id: "rv", ent: "revolut", name: "Del día", value: 200, role: "diario", spendFrom: true },
    { id: "ef", ent: "efectivo", name: "El sobre", value: 80, role: "fijos" },
  ],
  settings: { autoPrices: false, theme: "green", expenseBanks: ["revolut", "efectivo"], dailyOnlyBanks: ["efectivo"] },
};
const guardados = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]"));
async function arranca(page, extra) {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLoggedInDashboard(page, Object.assign({}, CUENTAS, extra));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

// Lo que se guardaba antes con cada combinación de mandos, y lo que tiene que seguir guardándose.
const MODOS = [
  { modo: "Tarjeta", id: "ap-pay-card", ent: "revolut", noCard: undefined, banco: true },
  { modo: "Efectivo", id: "ap-efectivo", ent: "efectivo", noCard: undefined, banco: false },
  { modo: "Bizum/transf.", id: "ap-pay-transfer", ent: "revolut", noCard: true, banco: true },
];
for (const m of MODOS) {
  test(`DIS-03 Apuntar con ${m.modo} guarda ent=${m.ent} y noCard=${m.noCard}`, async ({ page }) => {
    await arranca(page, { expenses: [] });
    await page.locator(".botnav-fab").click();
    const hoja = page.locator(".v4-exp-sheet");
    await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
    // Se pasa por los otros dos antes: lo que manda es la última elección, sin restos de las otras.
    for (const otro of MODOS.filter((x) => x !== m)) await hoja.getByTestId(otro.id).click();
    await hoja.getByTestId(m.id).click();
    await expect(hoja.getByTestId(m.id)).toHaveAttribute("aria-pressed", "true");
    await expect(hoja.locator(".v4-ficha-pay .v4-seg-btn.on")).toHaveCount(1);
    if (m.banco) await expect(hoja.getByTestId("ap-bank")).toContainText("Revolut");
    else await expect(hoja.getByTestId("ap-bank"), "con Efectivo no se pinta ningún banco").toBeHidden();
    for (const d of ["1", "2"]) await hoja.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
    await hoja.locator(".v4-ficha-concept").fill("Pago " + m.modo);
    await hoja.locator(".v4-ficha-concept").press("Enter");
    await hoja.locator(".v4-cta").click();
    await expect(hoja).toHaveCount(0, { timeout: 5_000 });
    const e = (await guardados(page)).find((x) => x.merchant === "Pago " + m.modo);
    expect(e).toBeTruthy();
    expect(e.amount).toBe(12);
    expect(e.ent).toBe(m.ent);
    expect(e.noCard).toBe(m.noCard);
  });
}

test("DIS-03 Ingreso: sin segmentado de pago, con su banco y su efectivo de siempre", async ({ page }) => {
  await arranca(page, { expenses: [] });
  await page.locator(".botnav-fab").click();
  const hoja = page.locator(".v4-exp-sheet");
  await hoja.locator(".v4-ficha-head .v4-seg-btn").nth(1).click();
  await expect(hoja.locator(".v4-ficha-pay .v4-seg")).toHaveCount(0);
  await expect(hoja.getByTestId("ap-pay-transfer")).toHaveCount(0);
  await expect(hoja.getByTestId("ap-bank")).toBeVisible();
  await hoja.getByTestId("ap-efectivo").click();
  await expect(hoja.getByTestId("ap-efectivo")).toHaveClass(/\bon\b/);
  for (const d of ["5", "0"]) await hoja.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  await hoja.locator(".v4-cta").click();
  await expect(hoja).toHaveCount(0, { timeout: 5_000 });
  const e = (await guardados(page)).find((x) => x.amount === -50);
  expect(e && e.ent).toBe("efectivo");
  expect(e.category).toBe("ingreso");
});

test("DIS-03 Modificar: cada toque escribe por el camino de siempre, y en uno del banco el efectivo sigue bloqueado", async ({ page }) => {
  const hoy = new Date().toISOString().slice(0, 10);
  // El cambio de banco solo se aplica cuando la nube confirma su fila (`runSourceAction`): el gasto a
  // mano tiene id de nube y su fila, como uno de verdad, y el histórico tiene dueño.
  const MANO = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
  await arranca(page, {
    __seedOnce: true, _historyOwner: "e2e-user",
    expenses: [
      { id: MANO, date: hoy, amount: 20, merchant: "Compra a mano", category: "super", source: "manual", ent: "revolut" },
      { id: "del-banco", date: hoy, amount: 30, merchant: "Cargo del banco", category: "super", source: "ob", ent: "revolut", obAcc: "ob-rv" },
    ],
    __cloudRows: { expenses: [{ user_id: "e2e-user", id: MANO, source: "manual:revolut", fecha: hoy, importe: 20, comercio: "Compra a mano", cat: "super" }] },
  });
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const abre = async (id) => {
    const fila = page.locator('[data-expense-id="' + id + '"]');
    await expect(fila).toBeVisible();
    await fila.evaluate((el) => el.click());
    const hoja = page.locator(".v4-exp-sheet");
    await expect(hoja.getByTestId("exp-pay-card")).toBeVisible();
    return hoja;
  };
  const de = async (id) => (await guardados(page)).find((x) => x.id === id);
  let hoja = await abre(MANO);
  await expect(hoja.getByTestId("exp-pay-card")).toHaveAttribute("aria-pressed", "true");
  await hoja.getByTestId("exp-pay-transfer").click();
  await expect.poll(async () => (await de(MANO)).noCard).toBe(true);
  expect((await de(MANO)).ent).toBe("revolut");
  // A Efectivo: cambia el banco y, confirmado, se va la marca de Bizum (en Efectivo no se vería; D3).
  await hoja.getByTestId("exp-efectivo").click();
  await expect.poll(async () => (await de(MANO)).ent).toBe("efectivo");
  await expect.poll(async () => (await de(MANO)).noCard).toBeUndefined();
  await expect(hoja.getByTestId("exp-bank")).toBeHidden();
  // De vuelta a Bizum: al mismo banco que en Apuntar (el de gasto diario), no a «Sin banco».
  await hoja.getByTestId("exp-pay-transfer").click();
  await expect.poll(async () => (await de(MANO)).ent).toBe("revolut");
  await expect.poll(async () => (await de(MANO)).noCard).toBe(true);
  await expect(hoja.getByTestId("exp-bank")).toContainText("Revolut");
  // Y por la lista de bancos al sobre: también pierde la marca (si no, efectivo + Bizum escondido).
  await hoja.getByTestId("exp-bank").click();
  await hoja.getByTestId("exp-bank-list").getByRole("button", { name: /Efectivo|sobre/i }).click();
  await expect.poll(async () => (await de(MANO)).ent).toBe("efectivo");
  await expect.poll(async () => (await de(MANO)).noCard).toBeUndefined();
  await hoja.getByTestId("exp-pay-card").click();
  await expect.poll(async () => (await de(MANO)).ent).toBe("revolut");
  expect((await de(MANO)).noCard).toBeUndefined();
  await hoja.locator(".v4-ficha-done").click();
  await expect(hoja).toHaveCount(0);

  hoja = await abre("del-banco");
  await hoja.getByTestId("exp-efectivo").click();
  await expect(page.locator(".toast").filter({ hasText: /El banco fija/ })).toBeVisible();
  expect((await de("del-banco")).ent).toBe("revolut");
  // Marcar un Bizum del banco sigue siendo posible: decide su redondeo.
  await hoja.getByTestId("exp-pay-transfer").click();
  await expect.poll(async () => (await de("del-banco")).noCard).toBe(true);
  expect((await de("del-banco")).ent).toBe("revolut");
});

/* Revisión de dinero D1 (15/11): con el sobre como ÚNICA cuenta de gasto diario, salir de Efectivo
   volvía a poner el sobre (el «diario») con la píldora del banco escondida: Tarjeta guardaba
   efectivo y Bizum efectivo + noCard. Tiene que volver a un banco de verdad y enseñarlo. */
for (const m of MODOS.filter((x) => x.id !== "ap-efectivo")) {
  test(`DIS-03 con el sobre como diario, ${m.modo} sale de Efectivo a un banco`, async ({ page }) => {
    await arranca(page, {
      expenses: [],
      accounts: [
        { id: "rv", ent: "revolut", name: "Cuenta", value: 200, role: "fijos" },
        { id: "ef", ent: "efectivo", name: "El sobre", value: 80, role: "diario", spendFrom: true },
      ],
    });
    await page.locator(".botnav-fab").click();
    const hoja = page.locator(".v4-exp-sheet");
    await expect(hoja.getByTestId("ap-efectivo")).toHaveAttribute("aria-pressed", "true");
    await hoja.getByTestId(m.id).click();
    await expect(hoja.getByTestId(m.id)).toHaveAttribute("aria-pressed", "true");
    await expect(hoja.getByTestId("ap-bank")).toBeVisible();
    await expect(hoja.getByTestId("ap-bank")).toContainText("Revolut");
    for (const d of ["9"]) await hoja.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
    await hoja.locator(".v4-cta").click();
    await expect(hoja).toHaveCount(0, { timeout: 5_000 });
    const e = (await guardados(page)).find((x) => x.amount === 9);
    expect(e.ent).toBe("revolut");
    expect(e.noCard).toBe(m.noCard);
  });
}

// Modificar comparte `.v4-exp-sheet` con Apuntar, pero no sube con el teclado del sistema: la
// transición del margen es solo de Apuntar (observación del revisor sobre DIS-05).
const transicion = (page) => page.evaluate(() => getComputedStyle(document.querySelector(".v4-exp-sheet")).transitionProperty);
// Desde el 239 (filtro de diseño), solo mientras sube con el teclado: al irse, el margen baja de golpe para
// que la hoja no se salga por arriba mientras vuelven el pago y el numérico.
test("DIS-05: Apuntar lleva la transición del margen", async ({ page }) => {
  const hoja = await abreApuntar(page, { w: 390, h: 844, letra: "normal" });
  await hoja.locator(".v4-ficha-concept").click();
  await expect(hoja.locator('.v4-ficha-body[data-kb="1"]')).toHaveCount(1);
  expect(await transicion(page)).toContain("margin-bottom");
});
test("DIS-05: Modificar no la lleva", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLoggedInDashboard(page, { expenses: [{ id: "m1", date: new Date().toISOString(), amount: 12.5, merchant: "Mercadona", category: "super", source: "manual" }] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await gastosAbreGasto(page, "Mercadona");
  await expect(page.getByTestId("exp", { exact: true })).toBeVisible();
  expect(await transicion(page)).not.toContain("margin-bottom");
});
