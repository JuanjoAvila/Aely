import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Guard DOM de alta, cancelación, borrado, recarga y patrimonio de Bienes
   (LOCAL33 / inc-2709-07). Base 74c5f075: editar ya existe (lo ata
   cartera-bienes-toque) y estas puertas no. El guard sale rojo aquí a
   propósito. No se salta ni se invierte para pintarlo verde.

   Los dos bienes sembrados son los mismos de cartera-bienes-toque. La cuenta
   es la del fixture (id e2e, 1000 €). El nombre que se teclea en el alta no
   es otro inventario: es el gesto del caso.

   Contrato que tiene que cumplir el SHA de Claude para dejar esto en verde,
   en es/en/ca, con la hoja .v4-sheet (la ficha de cuenta) y askConfirm
   (.tabsheet[role=dialog]), no con el .add-form inline:

   · Con assets vacíos, Cartera sigue mostrando el título de Bienes y un botón
     «Añadir bien» / «Add property» / «Afegeix bé».
   · Esa hoja tiene un input de nombre y, para el importe, otro input o el
     NumPad ya existente (.v4-keys). «Guardar» / «Save» / «Desa» escribe y
     cierra. «Cancelar» / «Cancel» / «Cancel·la» cierra sin escribir.
   · Tocar la fila abre la misma hoja. Desde ella, «Quitar bien» /
     «Remove property» / «Treu el bé» abre el diálogo y no borra hasta
     confirmar. Cancelar el diálogo deja el bien. Confirmar quita solo ese.
   · El importe 2500,50 (en: 2500.50) se guarda como 2500.5. El hero enseña
     el patrimonio con céntimos. La cuenta sembrada no cambia. pagehide vuelca
     el debounce, igual que en el spec del toque. */

const VIVIENDA = { id: "goods-touch-home", kind: "piso", name: "Vivienda de prueba", value: 125000, note: "Nota sintética de vivienda" };
const VEHICULO = { id: "goods-touch-car", kind: "coche", name: "Vehículo de prueba", value: 7500, note: "Nota sintética de vehículo" };
const NUEVO = "Trastero de prueba";
const CUENTA = 1000;
const NF = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NF0 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

const textos = {
  es: { bienes: "Bienes", anadir: "Añadir bien", guardar: "Guardar", cancelar: "Cancelar", quitar: "Quitar bien", importe: "2500,50" },
  en: { bienes: "Property", anadir: "Add property", guardar: "Save", cancelar: "Cancel", quitar: "Remove property", importe: "2500.50" },
  ca: { bienes: "Béns", anadir: "Afegeix bé", guardar: "Desa", cancelar: "Cancel·la", quitar: "Treu el bé", importe: "2500,50" },
};

function pantalla(page) { return page.locator(".page-scroll-host"); }
function hoja(page) { return page.locator(".v4-sheet"); }
function dialogo(page) { return page.locator(".tabsheet[role='dialog']"); }
function fila(page, name) { return pantalla(page).locator(".v4-mov").filter({ hasText: name }); }
function leyenda(page, label) { return pantalla(page).locator(".v4-legend-btn").filter({ hasText: label }); }

async function abrir(page, lang, assets) {
  await seedLoggedInDashboard(page, {
    __seedOnce: true,
    assets,
    investments: [],
    debts: [],
    expenses: [],
    settings: { autoPrices: false, theme: "green", lang },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(pantalla(page).locator(".cartera-hero-amt")).toBeVisible();
}

async function volcar(page) {
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
}

async function disco(page) {
  await volcar(page);
  return page.evaluate(() => {
    const s = mcLoadRaw(mcStateKey());
    const cuenta = (s.accounts || []).find((a) => a.id === "e2e");
    return {
      assets: (s.assets || []).map((a) => ({ id: a.id, name: a.name, value: a.value, kind: a.kind, note: a.note || "" })),
      cuenta: cuenta ? cuenta.value : null,
    };
  });
}

async function esperarHero(page, neto) {
  await expect(pantalla(page).locator(".cartera-hero-amt")).toContainText(NF.format(neto));
}

async function esperarLeyenda(page, label, valor) {
  const chip = label + "\\s+" + NF0.format(Math.round(valor)).replace(/\./g, "\\.") + "\\s*€";
  await expect(leyenda(page, label)).toHaveText(new RegExp("^\\s*" + chip + "\\s*$"));
}

async function escribirNombre(sheet, nombre) {
  if (!(await sheet.locator("input:visible").count())) {
    const renombrar = sheet.getByRole("button", { name: /^(Renombrar|Rename|Reanomenar)$/ });
    if (await renombrar.count()) await renombrar.click();
  }
  const texto = sheet.locator("input:visible:not([inputmode='decimal'])");
  const campo = (await texto.count()) ? texto.first() : sheet.locator("input:visible").first();
  await expect(campo).toBeVisible();
  await campo.fill(nombre);
}

async function escribirImporte(sheet, importe) {
  const numerico = sheet.locator("input:visible[inputmode='decimal'], input:visible.num");
  if (await numerico.count()) {
    await numerico.first().fill(importe);
    return;
  }
  const inputs = sheet.locator("input:visible");
  if (await inputs.count() >= 2) {
    await inputs.nth(1).fill(importe);
    return;
  }
  const keys = sheet.locator(".v4-keys");
  await expect(keys).toBeVisible();
  const borrar = keys.getByRole("button", { name: "Borrar", exact: true });
  if (await borrar.count()) {
    for (let i = 0; i < 12; i++) await borrar.click();
  }
  for (const ch of importe) await keys.getByRole("button", { name: ch, exact: true }).click();
}

async function abrirAlta(page, t) {
  await expect(pantalla(page).locator(".v4-sec-h").filter({ hasText: new RegExp("^\\s*" + t.bienes + "\\s*$") })).toBeVisible();
  const boton = pantalla(page).getByRole("button", { name: t.anadir, exact: true });
  await expect(boton).toBeVisible();
  await boton.click();
  await expect(hoja(page)).toBeVisible();
}

async function abrirFicha(page, nombre) {
  await fila(page, nombre).click();
  const sheet = hoja(page);
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(nombre);
  return sheet;
}

async function pedirBorrado(page, t, nombre) {
  // Tras cancelar el diálogo la ficha puede seguir abierta (como la de una cuenta).
  let sheet = hoja(page);
  if (!(await sheet.isVisible())) sheet = await abrirFicha(page, nombre);
  await sheet.getByRole("button", { name: t.quitar, exact: true }).click();
  const dialog = dialogo(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(nombre);
  await expect(fila(page, nombre)).toBeVisible();
  return dialog;
}

for (const lang of Object.keys(textos)) {
  const t = textos[lang];

  test(`alta: con la lista vacía se crea un bien (${lang})`, async ({ page }) => {
    await abrir(page, lang, []);
    await esperarHero(page, CUENTA);
    await abrirAlta(page, t);
    await escribirNombre(hoja(page), NUEVO);
    await escribirImporte(hoja(page), t.importe);
    await hoja(page).getByRole("button", { name: t.guardar, exact: true }).click();
    await expect(hoja(page)).toBeHidden();
    await expect(fila(page, NUEVO)).toBeVisible();
    const d = await disco(page);
    expect(d.cuenta).toBe(CUENTA);
    expect(d.assets).toEqual([expect.objectContaining({ name: NUEVO, value: 2500.5 })]);
    await esperarHero(page, CUENTA + 2500.5);
  });

  test(`cancelar el alta no escribe el bien (${lang})`, async ({ page }) => {
    await abrir(page, lang, []);
    await abrirAlta(page, t);
    await escribirNombre(hoja(page), NUEVO);
    await escribirImporte(hoja(page), t.importe);
    await hoja(page).getByRole("button", { name: t.cancelar, exact: true }).click();
    await expect(hoja(page)).toBeHidden();
    await expect(fila(page, NUEVO)).toHaveCount(0);
    const d = await disco(page);
    expect(d.assets).toEqual([]);
    expect(d.cuenta).toBe(CUENTA);
    await esperarHero(page, CUENTA);
    await esperarLeyenda(page, t.bienes, 0);
  });

  test(`borrar pide confirmación y solo quita el bien confirmado (${lang})`, async ({ page }) => {
    await abrir(page, lang, [VIVIENDA, VEHICULO]);
    await esperarHero(page, CUENTA + VIVIENDA.value + VEHICULO.value);
    let dialog = await pedirBorrado(page, t, VEHICULO.name);
    await dialog.getByRole("button", { name: t.cancelar, exact: true }).click();
    await expect(dialogo(page)).toHaveCount(0);
    await expect(fila(page, VEHICULO.name)).toBeVisible();
    let d = await disco(page);
    expect(d.assets.map((a) => a.id).sort()).toEqual([VIVIENDA.id, VEHICULO.id].sort());
    expect(d.cuenta).toBe(CUENTA);
    dialog = await pedirBorrado(page, t, VEHICULO.name);
    await dialog.getByRole("button", { name: t.quitar, exact: true }).click();
    await expect(dialogo(page)).toHaveCount(0);
    await expect(fila(page, VEHICULO.name)).toHaveCount(0);
    await expect(fila(page, VIVIENDA.name)).toBeVisible();
    d = await disco(page);
    expect(d.assets).toEqual([{ id: VIVIENDA.id, name: VIVIENDA.name, value: VIVIENDA.value, kind: VIVIENDA.kind, note: VIVIENDA.note }]);
    expect(d.cuenta).toBe(CUENTA);
    await esperarHero(page, CUENTA + VIVIENDA.value);
    await esperarLeyenda(page, t.bienes, VIVIENDA.value);
  });

  test(`alta y borrado siguen tras recargar (${lang})`, async ({ page }) => {
    await abrir(page, lang, []);
    await abrirAlta(page, t);
    await escribirNombre(hoja(page), NUEVO);
    await escribirImporte(hoja(page), t.importe);
    await hoja(page).getByRole("button", { name: t.guardar, exact: true }).click();
    await expect(hoja(page)).toBeHidden();
    expect((await disco(page)).assets.map((a) => a.name)).toEqual([NUEVO]);
    await page.reload();
    await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() => !document.getElementById("mc-load"));
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    await expect(fila(page, NUEVO)).toBeVisible();
    expect((await disco(page)).assets).toEqual([expect.objectContaining({ name: NUEVO, value: 2500.5 })]);
    await esperarHero(page, CUENTA + 2500.5);
    const dialog = await pedirBorrado(page, t, NUEVO);
    await dialog.getByRole("button", { name: t.quitar, exact: true }).click();
    await expect(fila(page, NUEVO)).toHaveCount(0);
    expect((await disco(page)).assets).toEqual([]);
    await page.reload();
    await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() => !document.getElementById("mc-load"));
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    await expect(fila(page, NUEVO)).toHaveCount(0);
    expect((await disco(page)).assets).toEqual([]);
    expect((await disco(page)).cuenta).toBe(CUENTA);
    await esperarHero(page, CUENTA);
    await esperarLeyenda(page, t.bienes, 0);
  });

  test(`el patrimonio refleja el alta y la baja (${lang})`, async ({ page }) => {
    await abrir(page, lang, []);
    await esperarHero(page, CUENTA);
    await esperarLeyenda(page, t.bienes, 0);
    await abrirAlta(page, t);
    await escribirNombre(hoja(page), NUEVO);
    await escribirImporte(hoja(page), t.importe);
    await hoja(page).getByRole("button", { name: t.guardar, exact: true }).click();
    await expect(hoja(page)).toBeHidden();
    expect((await disco(page)).assets[0].value).toBe(2500.5);
    await esperarHero(page, CUENTA + 2500.5);
    await expect(leyenda(page, t.bienes)).not.toHaveText(/\s0 €\s*$/);
    const dialog = await pedirBorrado(page, t, NUEVO);
    await dialog.getByRole("button", { name: t.quitar, exact: true }).click();
    await expect(fila(page, NUEVO)).toHaveCount(0);
    expect((await disco(page)).assets).toEqual([]);
    expect((await disco(page)).cuenta).toBe(CUENTA);
    await esperarHero(page, CUENTA);
    await esperarLeyenda(page, t.bienes, 0);
  });

  test(`editar abre la hoja actual y guarda nombre e importe (${lang})`, async ({ page }) => {
    await abrir(page, lang, [VIVIENDA, VEHICULO]);
    const sheet = await abrirFicha(page, VEHICULO.name);
    await escribirNombre(sheet, "Vehículo retocado");
    await escribirImporte(sheet, "8000");
    const guardar = sheet.getByRole("button", { name: t.guardar, exact: true });
    if (await guardar.isVisible()) await guardar.click();
    else await page.locator(".v4-sheet-back").click({ position: { x: 12, y: 12 } });
    await expect(hoja(page)).toBeHidden();
    await expect(fila(page, "Vehículo retocado")).toBeVisible();
    const d = await disco(page);
    expect(d.cuenta).toBe(CUENTA);
    expect(d.assets).toHaveLength(2);
    expect(d.assets.find((a) => a.id === VIVIENDA.id)).toEqual({ id: VIVIENDA.id, name: VIVIENDA.name, value: VIVIENDA.value, kind: VIVIENDA.kind, note: VIVIENDA.note });
    expect(d.assets.find((a) => a.id === VEHICULO.id)).toEqual({ id: VEHICULO.id, name: "Vehículo retocado", value: 8000, kind: VEHICULO.kind, note: VEHICULO.note });
    await esperarHero(page, CUENTA + VIVIENDA.value + 8000);
    await esperarLeyenda(page, t.bienes, VIVIENDA.value + 8000);
  });
}
