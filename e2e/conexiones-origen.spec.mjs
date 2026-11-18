import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* CONEXIONES: ENTRAR, SALIR Y VOLVER A DONDE ESTABAS (ronda R2 del rediseño de bancos, 18/11).
 *
 * Antes «Mis bancos» era un `div` fijo que salía de golpe, al que se llegaba desplegando un grupo
 * de Ajustes, y que al cerrar dejaba SIEMPRE en Ajustes aunque vinieras de Cartera. Lo que aquí se
 * blinda es lo que se ve y se toca, no el código: la fila de un toque, que desde Cartera no haya
 * Ajustes debajo, que atrás vaya por pasos, que el borde la cierre, que el selector no abra el
 * teclado y que solo una vuelta con acción resalte la fila y avise. */

const LINKS = [
  { aspsp_name: "Banco de Sabadell", aspsp_country: "ES", iban: "ES11", status: "active",
    valid_until: "2027-01-01T00:00:00Z", last_sync: "2026-11-18T09:00:00Z", accounts: [{ uid: "a1" }] },
  { aspsp_name: "CaixaBank", aspsp_country: "ES", iban: "ES22", status: "expired",
    valid_until: "2026-11-01T00:00:00Z", last_sync: "2026-11-01T09:00:00Z", accounts: [{ uid: "a2" }] },
];
const ASPSPS = [{ name: "Banco de Sabadell", country: "ES" }, { name: "CaixaBank", country: "ES" }, { name: "Revolut", country: "ES" }];

async function arranca(page, extra = {}) {
  await seedLoggedInDashboard(page, Object.assign({ __cloudRows: { bank_links: LINKS }, __cloudFns: { "bank-aspsps": { data: { ok: true, aspsps: ASPSPS }, error: null } }, hasBankLink: true }, extra));
  await page.goto(extra.__url || "/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}
const push = (page) => page.locator(".v4-banks-push");
const ajustesAbierto = (page) => page.locator(".settings-push.open:not(.v4-banks-push)");
const alto = (loc) => loc.evaluate((el) => el.getBoundingClientRect().height);
async function aCartera(page) {
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator('.botnav-tab[data-tour="cartera"]')).toHaveClass(/active/);
}

test("Ajustes: «Conexiones» es una fila de un toque, con su icono y los logos; ‹ vuelve a Ajustes", async ({ page }) => {
  await arranca(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  const fila = page.locator("[data-cx-row]");
  // A la vista sin desplegar ningún grupo: era la queja de los tres niveles.
  await expect(fila).toBeVisible({ timeout: 10_000 });
  await expect(fila.locator('[data-set-ico="banks"]')).toHaveCount(1);
  await expect(fila.locator(".mono")).toHaveCount(2);
  await expect(fila).toContainText(/1 de 2 al día · CaixaBank pide renovar/);
  expect(await alto(fila)).toBeGreaterThanOrEqual(44);

  await fila.click();
  await expect(push(page)).toHaveClass(/open/);
  await expect(push(page).locator("[data-aspsp]")).toHaveCount(2);
  const atras = push(page).locator(".settings-push-h .back");
  expect(await alto(atras)).toBeGreaterThanOrEqual(44);
  await atras.click();
  await expect(push(page)).toHaveCount(0);
  // Se aterriza donde se estaba, y callado: no ha pasado nada que contar.
  await expect(ajustesAbierto(page)).toBeVisible();
  await expect(page.locator(".cx-vuelta")).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveCount(0);
});

test("desde Cartera se abre sin Ajustes debajo y el gesto desde el borde vuelve a Cartera", async ({ page }) => {
  await arranca(page);
  await aCartera(page);
  // La misma puerta que el aviso de Cartera y el vacío de Gastos.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(push(page)).toHaveClass(/open/, { timeout: 10_000 });
  await expect(ajustesAbierto(page)).toHaveCount(0);
  // Entra deslizando: hasta que no termina, el borde izquierdo aún es Cartera.
  await expect.poll(() => push(page).evaluate((el) => el.getBoundingClientRect().left)).toBeLessThan(1);

  // Arrastre desde el borde izquierdo hacia la derecha, como el dedo.
  const cdp = await page.context().newCDPSession(page);
  const y = 420;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 6, y }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 6 + i * 26, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(push(page)).toHaveCount(0);
  await expect(page.locator('.botnav-tab[data-tour="cartera"]')).toHaveClass(/active/);
  await expect(ajustesAbierto(page)).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveCount(0);
});

test("el selector sube en hoja sin teclado, y atrás va por pasos: hoja, pantalla, origen", async ({ page }) => {
  await arranca(page);
  await aCartera(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(push(page)).toHaveClass(/open/, { timeout: 10_000 });

  await push(page).getByRole("button", { name: /Conectar un banco/ }).click();
  const hoja = page.locator(".bk-pick");
  await expect(hoja).toBeVisible();
  await expect(hoja.locator("button.v4-mov")).toHaveCount(3);
  // Nada enfocado al entrar: el teclado no tapa la lista hasta que se toca el buscador.
  expect(await page.evaluate(() => document.activeElement && document.activeElement.tagName)).not.toBe("INPUT");
  const cerrar = hoja.locator(".sub-push-h .back");
  expect(await alto(cerrar)).toBeGreaterThanOrEqual(44);
  expect(await alto(hoja.locator("button.v4-mov").first())).toBeGreaterThanOrEqual(44);

  await page.goBack();
  await expect(hoja).toHaveCount(0);
  await expect(push(page)).toHaveClass(/open/);
  await page.goBack();
  await expect(push(page)).toHaveCount(0);
  await expect(page.locator('.botnav-tab[data-tour="cartera"]')).toHaveClass(/active/);
});

test("volver de renovar un banco aterriza en el origen con la fila resaltada y el aviso", async ({ page }) => {
  // Lo que deja `connect` antes de salir hacia el banco, y la vuelta de la web con ?bank=ok.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("_e2eVuelta")) return;
    sessionStorage.setItem("_e2eVuelta", "1");
    sessionStorage.setItem("mc_bk_vuelta", JSON.stringify({ n: "Banco de Sabadell", k: "r", o: "cartera" }));
  });
  await arranca(page, { __url: "/?bank=ok" });
  await expect(push(page)).toHaveClass(/open/, { timeout: 10_000 });
  await expect(page.locator('.botnav-tab[data-tour="cartera"]')).toHaveClass(/active/);
  await push(page).locator(".settings-push-h .back").click();
  await expect(push(page)).toHaveCount(0);

  const marcada = page.locator(".page.page-live .cx-vuelta");
  await expect(marcada).toHaveCount(1);
  await expect(marcada).toHaveAttribute("data-account-id", /.+/);
  await expect(page.locator(".toast")).toContainText(/Sabadell renovado/);
  // El resalte se apaga solo.
  await expect(page.locator(".cx-vuelta")).toHaveCount(0, { timeout: 4_000 });
});

test("con «reducir animaciones» la pantalla entra y sale sin deslizar", async ({ page }) => {
  await arranca(page, { settings: { autoPrices: false, theme: "green", reduceMotion: true } });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(push(page)).toHaveClass(/open/, { timeout: 10_000 });
  const dur = await push(page).evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
  expect(dur).toBeLessThan(0.01);
  await push(page).locator(".settings-push-h .back").click();
  // Sin los 420 ms de salida: se desmonta en el acto.
  await expect(push(page)).toHaveCount(0, { timeout: 150 });
});
