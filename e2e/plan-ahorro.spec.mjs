/* AHORRO MENSUAL EN PLAN → METAS (feedback 18/9, punto 6).
 *
 * El rediseño v4 dejó `state.aportaciones` sin pantalla: seguía moviendo `totals.ahorroMensual`
 * (fechas de las metas, proyección de Inversiones) pero no había dónde cambiarlo. Aquí se prueba
 * la puerta REAL: Plan → Metas → Editar → Guardar, lo que se ve, que Cancelar no escribe nada y
 * que sobrevive a recargar. Y que un importe largo no se corta. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const aportaciones = [
  { id: "ap1", ent: "myinvestor", name: "MSCI World", amount: 200 },
  { id: "ap2", ent: "trade_republic", name: "Plan TR", amount: 50 },
];

async function abrirMetas(page, extra = {}) {
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, aportaciones, goals: [] }, extra));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  const ajustes=page.locator(".settings-push.open").filter({has:page.getByRole("heading",{name:/Ajustes|Settings|Ajustos/i})});
  if(await ajustes.count()) await ajustes.locator(".settings-push-h .back").click();
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.getByRole("tab",{name:/Metas|Goals/i}).click();
  const card = page.locator('.v4-screen > [data-seg="metas"] [data-savings-plan]');
  await expect(card).toBeVisible();
  return card;
}

test("★ Metas enseña el ahorro mensual y se edita, guarda y persiste", async ({ page }) => {
  const card = await abrirMetas(page);
  await expect(card).toContainText("Ahorro mensual");
  await expect(card.locator("[data-savings-total]")).toContainText(/250,00\s*€\/mes/);
  // Honesto: planifica, no mueve dinero.
  await expect(card).toContainText(/No mueve dinero real/);
  await expect(card.locator('[data-savings-row="ap1"]')).toContainText("MSCI World");

  await card.locator("[data-savings-edit]").click();
  await card.locator('[data-savings-draft="ap1"]').getByLabel("Importe al mes").fill("300");
  await card.locator('[data-savings-draft="ap2"]').getByLabel("Quitar esta aportación").click();
  await card.getByRole("button", { name: /Añadir aportación/ }).click();
  const nueva = card.locator("[data-savings-draft]").last();
  await nueva.getByLabel("Concepto de la aportación").fill("Hucha");
  await nueva.getByLabel("Importe al mes").fill("25,5");
  await card.locator("[data-savings-save]").click();

  await expect(card.locator("[data-savings-total]")).toContainText(/325,50\s*€\/mes/);
  await expect(card.locator("[data-savings-row]")).toHaveCount(2);
  await expect(card).not.toContainText("Plan TR");
  await expect(card).toContainText("Hucha");

  // Nada de movimientos inventados: el ahorro es plan, no un gasto ni un ingreso.
  // El guardado a disco va diferido: se espera a que llegue, no se da por hecho.
  const leer = () => page.evaluate(() => {
    const k = localStorage.getItem("_mcSandbox") === "1" ? "micartera_sandbox" : "micartera_v3";
    const s = JSON.parse(localStorage.getItem(k));
    return { aps: s.aportaciones.map((a) => [a.name, a.amount]), exp: (s.expenses || []).length, goals: (s.goals || []).length };
  });
  await expect.poll(async () => (await leer()).aps, { timeout: 5_000 }).toEqual([["MSCI World", 300], ["Hucha", 25.5]]);
  const antes = await leer();
  expect(antes.goals).toBe(0);

  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  const ajustes=page.locator(".settings-push.open").filter({has:page.getByRole("heading",{name:/Ajustes|Settings|Ajustos/i})});
  if(await ajustes.count()) await ajustes.locator(".settings-push-h .back").click();
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.getByRole("tab",{name:/Metas|Goals/i}).click();
  const tras = page.locator('.v4-screen > [data-seg="metas"] [data-savings-plan]');
  await expect(tras.locator("[data-savings-total]")).toContainText(/325,50\s*€\/mes/);
  const exp = await page.evaluate(() => {
    const k = localStorage.getItem("_mcSandbox") === "1" ? "micartera_sandbox" : "micartera_v3";
    return (JSON.parse(localStorage.getItem(k)).expenses || []).length;
  });
  expect(exp, "guardar el ahorro no puede crear movimientos").toBe(antes.exp);
});

test("Cancelar no escribe nada, ni altas ni bajas", async ({ page }) => {
  const card = await abrirMetas(page);
  await card.locator("[data-savings-edit]").click();
  await card.locator('[data-savings-draft="ap1"]').getByLabel("Quitar esta aportación").click();
  await card.getByRole("button", { name: /Añadir aportación/ }).click();
  await card.locator("[data-savings-draft]").last().getByLabel("Importe al mes").fill("999");
  await card.locator("[data-savings-edit]").click();   // ahora dice «Cancelar»
  await expect(card.locator("[data-savings-total]")).toContainText(/250,00\s*€\/mes/);
  await expect(card.locator("[data-savings-row]")).toHaveCount(2);
});

test("los separadores europeos no convierten miles en uno o dos euros", async ({ page }) => {
  const card = await abrirMetas(page);
  await card.locator("[data-savings-edit]").click();
  await card.locator('[data-savings-draft="ap1"]').getByLabel("Importe al mes").fill("1.000");
  await card.locator('[data-savings-draft="ap2"]').getByLabel("Importe al mes").fill("1.200,50");
  await card.locator("[data-savings-save]").click();

  await expect(card.locator("[data-savings-total]")).toContainText(/2\.?200,50\s*€\/mes/);
  await expect.poll(() => page.evaluate(() => {
    const k = localStorage.getItem("_mcSandbox") === "1" ? "micartera_sandbox" : "micartera_v3";
    return JSON.parse(localStorage.getItem(k)).aportaciones.map((a) => a.amount);
  }), { timeout: 5_000 }).toEqual([1000, 1200.5]);
});

test("un importe largo no se corta en móvil estrecho", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const card = await abrirMetas(page, {
    aportaciones: [{ id: "big", ent: "myinvestor", name: "Aportación con un nombre larguísimo para el fondo indexado", amount: 1234567.89 }],
  });
  const medidas = await card.evaluate((el) => {
    const tot = el.querySelector("[data-savings-total]");
    const amt = el.querySelector(".aely-savings-amt");
    const cr = el.getBoundingClientRect();
    const fuera = (x) => { const r = x.getBoundingClientRect(); return r.right > cr.right + 0.5 || r.left < cr.left - 0.5; };
    return {
      totTxt: tot.textContent, totFuera: fuera(tot), totCortado: tot.scrollWidth > tot.clientWidth + 1,
      amtTxt: amt.textContent, amtFuera: fuera(amt), amtCortado: amt.scrollWidth > amt.clientWidth + 1,
      paginaAncha: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(medidas.totTxt).toMatch(/1\.?234\.?567,89/);
  expect(medidas.totFuera, "el total se sale de la tarjeta").toBe(false);
  expect(medidas.totCortado, "el total se corta").toBe(false);
  expect(medidas.amtFuera, "el importe de la fila se sale").toBe(false);
  expect(medidas.amtCortado, "el importe de la fila se corta").toBe(false);
  expect(medidas.paginaAncha).toBe(false);
});
