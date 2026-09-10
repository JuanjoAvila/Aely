import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* MANTENER PULSADO NO PUEDE DEJAR NADA «MARCADO»
 *
 * Rechazo suyo del 10/9 sobre `4.19.20/pulido-cierre`, con sus palabras: «al mantener pulsado en
 * un gasto, se subraya y la app se vuelve loca, no se puede quitar el que está "marcado"».
 * Lo que se le queda marcado es la selección de texto nativa de Android. La fila de gasto es un
 * `<button>` que además lleva arrastrar-para-ordenar y deslizar: con las asas de selección puestas
 * los tres gestos se pelean por el mismo dedo.
 *
 * ⚠ LÍMITE DE ESTE TEST, DICHO A LA CARA: la selección por pulsación larga la hace la capa NATIVA
 * del WebView y Chromium de escritorio NO la dispara. Se comprobó: con el fallo puesto, emular un
 * touch de 900 ms con CDP deja `getSelection()` vacío igual. O sea que un verde aquí NO demuestra
 * que en su móvil no pase. Lo que sí se puede vigilar —y es lo que decide el comportamiento
 * nativo— es la CONDICIÓN: si la fila permite seleccionar texto, Android lo ofrecerá.
 * El veredicto de verdad es el suyo, en el móvil.
 */
test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 900 } });

async function enGastos(page) {
  const day = new Date().toISOString().slice(0, 10);
  await seedLoggedInDashboard(page, { budget: 1000, __seedOnce: true, expenses: [
    { id: "g1", date: day + "T18:00:00.000Z", amount: 12.5, merchant: "Mercadona", category: "super", source: "manual" },
    { id: "g2", date: day + "T08:00:00.000Z", amount: 2.4, merchant: "Maquina cafe", category: "bares", source: "manual" },
  ] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator('.botnav-tab.active[data-tour="gastos"]')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const s = document.querySelector(".v4-gastos-summary");
    return s ? s.getBoundingClientRect().left : 999;
  })).toBeLessThan(40);
}

test("★ una fila de gasto no deja seleccionar texto (es lo que Android convierte en «marcado»)", async ({ page }) => {
  await enGastos(page);
  const r = await page.evaluate(() => {
    const fila = document.querySelector(".v4-gastos-list button.v4-mov");
    const cs = getComputedStyle(fila);
    const nombre = fila.querySelector(".nm");
    return { fila: cs.webkitUserSelect || cs.userSelect,
             nombre: (getComputedStyle(nombre).webkitUserSelect || getComputedStyle(nombre).userSelect) };
  });
  expect(r.fila).toBe("none");
  // Y el texto de dentro también, que es justo donde ponía el dedo.
  expect(r.nombre).toBe("none");
});

test("mantener pulsado 900 ms sobre un gasto no deja selección", async ({ page }) => {
  await enGastos(page);
  const box = await page.locator(".v4-gastos-list button.v4-mov").first().locator(".nm").first().boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(box.x + 30), y = Math.round(box.y + box.height / 2);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await page.waitForTimeout(900);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => String(window.getSelection() || ""))).toBe("");
});

test("lo que SÍ se escribe sigue siendo seleccionable: los campos de texto", async ({ page }) => {
  await enGastos(page);
  /* La regla va sobre `button`, no sobre todo. Si algún día alguien la sube a `body` o a `*`, esto
     se pone rojo: escribir en la app dejaría de dejarte colocar el cursor ni corregir a mitad de
     palabra, que es peor que el fallo que se estaba arreglando. */
  const r = await page.evaluate(() => {
    const i = document.createElement("input");
    i.className = "v4-exp-note-in";
    document.querySelector(".v4-gastos-list").appendChild(i);
    const cs = getComputedStyle(i);
    const v = cs.webkitUserSelect || cs.userSelect;
    i.remove();
    return v;
  });
  expect(r).not.toBe("none");
});
