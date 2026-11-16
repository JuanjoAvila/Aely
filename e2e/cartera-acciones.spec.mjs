import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* CARTERA CON UN SOLO PATRÓN DE ACCIONES (auditoría de diseño 233, lote de menores).
 * DIS-32: había cinco estilos de botón secundario en la misma pantalla. Ahora la acción de cada
 *   bloque es un enlace a la derecha de su título y el efectivo se mueve desde su ficha.
 *   (16/11/2026: fuera «Editar» de cuentas, «Editar a mano» de inversiones y «Ordenar secciones»;
 *   sus caminos nuevos los vigila `cartera-puertas`.)
 * DIS-33: unas filas ponían el banco de título y otras la cuenta; ahora siempre la cuenta, con
 *   banco y uso debajo en una línea.
 * DIS-48: el icono de «Conectar cuentas» dibuja 31 px pero tiene 44 de dedo.
 * DIS-38: la cifra grande de Cartera mide lo mismo que la de Inicio (--fs-hero). */

const estado = {
  hasBankLink: true,
  accounts: [
    { id: "sab", ent: "sabadell", name: "Cuenta Online con nombre largo de verdad", value: 2310.45, role: "fijos", bankUid: "u1", lastSync: "2026-09-26T08:00:00Z" },
    { id: "rv", ent: "revolut", name: "Del día a día", value: 640.2, spendFrom: true },
    { id: "ef", ent: "efectivo", name: "Efectivo", value: 80 },
  ],
  assets: [{ id: "piso", kind: "piso", name: "Piso", value: 180000 }],
  investments: [{ id: "i1", ent: "trade_republic", name: "MSCI World", ticker: "IWDA", shares: 10, value: 1500, cost: 1200, cur: "EUR" }],
  settings: { autoPrices: false, theme: "green", lang: "es" },
};

async function abrirCartera(page, extra = {}) {
  await seedLoggedInDashboard(page, Object.assign({}, estado, extra));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator('.page [data-account-id="sab"]')).toBeVisible();
  // El carrusel de pestañas sigue deslizándose un rato: medir antes compara cajas de dos frames.
  await expect.poll(() => page.evaluate(() => document.querySelector('.page [data-account-id="sab"]').getBoundingClientRect().left)).toBeLessThan(40);
}

// El enlace se pinta en la MISMA fila que el título del bloque, y con 44 px de dedo.
async function enlaceEnCabecera(page, titulo, enlace) {
  const cab = page.locator(".page .v4-screen .v4-sec-h").filter({ hasText: titulo }).first();
  const btn = cab.locator("button.link").filter({ hasText: enlace });
  await expect(btn).toBeVisible();
  const [c, b] = [await cab.locator("span").first().boundingBox(), await btn.boundingBox()];
  expect(Math.abs((c.y + c.height / 2) - (b.y + b.height / 2))).toBeLessThan(4);
  expect(b.x).toBeGreaterThan(c.x + c.width);
  expect(b.height).toBeGreaterThanOrEqual(44);
  return btn;
}

test("cada bloque lleva su acción como enlace junto al título, y el efectivo se mueve desde su ficha", async ({ page }) => {
  await abrirCartera(page, { obAccounts: [{ key: "ob1", ent: "sabadell", name: "Ahorro", value: 50, cur: "EUR" }] });
  const pantalla = page.locator(".page .v4-screen");

  // Sin «Editar» en Tus cuentas aunque haya cuentas EXTRA del banco: la ficha de cada fila lo cubre.
  await expect(page.locator('.page [data-act="acc-edit"]')).toHaveCount(0);
  await enlaceEnCabecera(page, "Bienes", "Añadir");
  const verTodo = await enlaceEnCabecera(page, "Tus inversiones", "Ver todo");
  await expect(verTodo).toHaveAccessibleName("Ver todas tus inversiones");
  // Ni píldoras sueltas de efectivo bajo las cuentas, ni el botón ancho de «Añadir bien».
  await expect(pantalla.getByText("Saqué del cajero", { exact: true })).toHaveCount(0);
  await expect(pantalla.getByText("Entró efectivo", { exact: true })).toHaveCount(0);
  await expect(pantalla.locator(".btn-ghost").filter({ hasText: "Añadir bien" })).toHaveCount(0);
  // Ni «Editar a mano» ni su pista gris al pie de las inversiones.
  await expect(pantalla.locator('[data-act="inv-manual"]')).toHaveCount(0);
  await expect(pantalla.getByText(/Sin precio automático/)).toHaveCount(0);

  // «Añadir» abre la misma hoja de alta de bienes.
  await page.getByRole("button", { name: "Añadir bien", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Añadir bien", exact: true })).toBeVisible();
  await page.getByRole("dialog", { name: "Añadir bien", exact: true }).getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Añadir bien", exact: true })).toHaveCount(0);

  // El efectivo: sus dos acciones viven en su ficha y siguen abriendo su pregunta de siempre.
  await page.locator('.page [data-account-id="ef"]').click();
  const ficha = page.locator(".v4-sheet").filter({ has: page.locator(".v4-account-head") });
  await expect(ficha.locator('[data-act="ef-cajero"]')).toHaveText("Saqué del cajero");
  await expect(ficha.locator('[data-act="ef-entrada"]')).toHaveText("Entró efectivo");
  await ficha.locator('[data-act="ef-entrada"]').click();
  await expect(page.getByRole("dialog", { name: "¿Cuánto ha entrado?" })).toBeVisible();
});

test("la fila de cuenta pone la cuenta de título y banco y uso en una sola línea", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await abrirCartera(page);
  const fila = page.locator('.page [data-account-id="sab"]');
  await expect(fila.locator(".nm > div").first()).toContainText("Cuenta Online con nombre largo");
  const meta = fila.locator(".meta");
  await expect(meta).toContainText(/^Sabadell · .*Recibos/);
  const m = await meta.evaluate((el) => ({ h: el.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(el).fontSize) }));
  expect(m.h).toBeLessThan(m.lh * 2);
  // El nombre largo se recorta en una línea y la marca «del banco» sigue a su lado.
  const titulo = fila.locator(".nm > div").first();
  await expect(titulo).toContainText("del banco");
  const t1 = await titulo.evaluate((el) => ({ h: el.getBoundingClientRect().height, fs: parseFloat(getComputedStyle(el).fontSize) }));
  expect(t1.h).toBeLessThan(t1.fs * 2);
  // Una cuenta cuyo nombre es el banco no lo repite debajo.
  await expect(page.locator('.page [data-account-id="ef"] .meta')).not.toContainText("Efectivo");
});

test("el icono de Conectar cuentas tiene 44 px de dedo y la cifra grande mide lo de Inicio", async ({ page }) => {
  await abrirCartera(page);
  const icono = page.locator('.page .v4-ic-mini[aria-label="Conectar cuentas"]');
  expect((await icono.boundingBox()).width).toBeLessThan(40);   // el dibujo no cambia
  // Medido dentro de la página y repetido hasta que el carrusel de pestañas se asienta: un
  // rectángulo tomado a media transición ya no está donde cae el punto.
  const toques = () => page.evaluate(() => {
    const dentro = (el, px, py) => { const hit = document.elementFromPoint(px, py); return !!hit && (hit === el || el.contains(hit)); };
    const con = document.querySelector('.page .v4-ic-mini[aria-label="Conectar cuentas"]');
    const syn = document.querySelector('.page .v4-ic-mini[aria-label="Sincronizar bancos"]');
    const r = con.getBoundingClientRect(), s = syn.getBoundingClientRect();
    return [dentro(con, r.left - 6, r.top + r.height / 2), dentro(con, r.right + 6, r.top + r.height / 2),
      dentro(con, r.left + r.width / 2, r.top - 6), dentro(con, r.left + r.width / 2, r.bottom + 6),
      // El de sincronizar, a su lado, conserva también su borde derecho.
      dentro(syn, s.right + 5, s.top + s.height / 2)];
  });
  await expect.poll(toques).toEqual([true, true, true, true, true]);

  const fs = await page.locator(".page .cartera-hero-amt").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fs).toBe(46);
});
