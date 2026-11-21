/* SEC-01 (4.23.0): al volver del banco con ?bank=error&msg=…, el toast NO pinta el texto
 * inventado de la URL. Quien fabrique el enlace no puede meter un aviso falso. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard } from "./fixtures.mjs";

const INVENTADO = "URGENT: tu cuenta sera bloqueada — llama al 900-FAKE-BANK ahora";

test("★ ?bank=error con msg inventado: toast genérico, el texto NO aparece", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/?bank=error&msg=" + encodeURIComponent(INVENTADO));
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });

  // Antes de dismissNews: el toast solo vive ~2–4 s.
  const toast = page.locator(".toast");
  await expect(toast).toBeVisible({ timeout: 5_000 });
  await expect(toast).toContainText(/No se pudo conectar el banco|Couldn't connect the bank|No s'ha pogut connectar el banc/i);
  await expect(toast).not.toContainText("URGENT");
  await expect(toast).not.toContainText("900-FAKE");
  await expect(toast).not.toContainText("bloqueada");
  await expect(page).not.toHaveURL(/bank=error/);
});

test("código corto caducado: mensaje claro, sin el código crudo", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/?bank=error&msg=caducado");
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });

  const toast = page.locator(".toast");
  await expect(toast).toBeVisible({ timeout: 5_000 });
  await expect(toast).toContainText(/permiso ya se usó|permission was already used|permís ja s'ha usat/i);
  await expect(toast).not.toHaveText(/caducado/i);
});

test("★ nolink con texto inventado: toast con 🏦, el texto NO aparece", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/?bank=error&msg=" + encodeURIComponent("nolink:Tu cuenta está bloqueada, llama al 900-FAKE"));
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });

  const toast = page.locator(".toast");
  await expect(toast).toBeVisible({ timeout: 5_000 });
  await expect(toast).toContainText("🏦");
  await expect(toast).not.toContainText("900-FAKE");
  await expect(toast).not.toContainText("bloqueada");
});

test("nolink:Banco Sabadell → etiqueta Sabadell", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/?bank=error&msg=" + encodeURIComponent("nolink:Banco Sabadell"));
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });

  const toast = page.locator(".toast");
  await expect(toast).toBeVisible({ timeout: 5_000 });
  await expect(toast).toContainText("Sabadell");
  await expect(toast).not.toContainText("Banco Sabadell");
});

test("★ back.html no pinta msg inventado y reenvía solo error", async ({ page }) => {
  // Antes del redirect a micartera:// (400 ms).
  await page.goto("/back.html?msg=" + encodeURIComponent(INVENTADO), { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toContainText("URGENT");
  await expect(page.locator("body")).not.toContainText("900-FAKE");
  await expect(page.locator("#msg")).toHaveText(/Volviendo a Aely/i);
  await expect(page.locator("#btn")).toHaveAttribute("href", "micartera://bank?msg=error");
});

/* SEG-16 y SEG-02 (ronda E2): la vuelta del banco solo cuenta si este móvil salió a conectar, y
 * en modo confirmación el banco no queda conectado hasta que la app canjea el token. */
const TOKEN = "A".repeat(20) + "-_" + "b".repeat(21);
const SYNC_OK = { data: { ok: true, links: [{ aspsp: "CaixaBank", ok: true, accounts: [] }] }, error: null };
const conectado = (page) => expect.poll(() => page.evaluate(() => window.__avisos || [])).toContainEqual(expect.stringMatching(/Banco conectado/));
const invocadas = (page, nombre) => page.evaluate((n) => (window.__e2eInvokes || []).filter((i) => i.name === n), nombre);
const marca = (page) => page.addInitScript(() => {
  if (sessionStorage.getItem("_e2eMarca")) return;
  sessionStorage.setItem("_e2eMarca", "1");
  localStorage.setItem("mc_bk_pend", JSON.stringify({ u: "e2e-user", t: Date.now() }));
});
async function abre(page, url, fns) {
  await seedLoggedInDashboard(page, { hasBankLink: true, __cloudRows: { bank_links: [{ id: "l1", aspsp_name: "CaixaBank", status: "active" }] },
    __cloudFns: Object.assign({ "bank-sync": SYNC_OK }, fns || {}) });
  // Todos los avisos que salen: el de la lectura de después pisa enseguida a «Banco conectado».
  await page.addInitScript(() => {
    window.__avisos = [];
    new MutationObserver(() => document.querySelectorAll(".toast").forEach((e) => {
      if (window.__avisos[window.__avisos.length - 1] !== e.textContent) window.__avisos.push(e.textContent);
    })).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
}

test("★ ?bank=ok sin haber salido a conectar: ni aviso ni lectura del banco", async ({ page }) => {
  await abre(page, "/?bank=ok");
  await expect(page).not.toHaveURL(/bank=ok/);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__avisos)).toEqual([]);
  expect(await invocadas(page, "bank-sync")).toHaveLength(0);
});

test("?bank=ok tras salir a conectar: aviso y una lectura", async ({ page }) => {
  await marca(page);
  await abre(page, "/?bank=ok");
  await conectado(page);
  await expect.poll(() => invocadas(page, "bank-sync").then((r) => r.length)).toBe(1);
});

test("★ ?bank=confirm canjea el token con la sesión y solo entonces da el banco por conectado", async ({ page }) => {
  await marca(page);
  await abre(page, "/?bank=confirm&t=" + TOKEN, { "bank-confirm": { data: { ok: true, aspsp_name: "CaixaBank" }, error: null } });
  await conectado(page);
  // El token no se queda en la barra ni en el historial.
  await expect(page).not.toHaveURL(/bank=|t=/);
  expect(await invocadas(page, "bank-confirm")).toEqual([{ name: "bank-confirm", body: { token: TOKEN } }]);
  await expect.poll(() => invocadas(page, "bank-sync").then((r) => r.length)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("mc_bk_pend"))).toBeNull();
});

test("★ un token que no salió de este móvil no llega al servidor", async ({ page }) => {
  await abre(page, "/?bank=confirm&t=" + TOKEN, { "bank-confirm": { data: { ok: true }, error: null } });
  await expect(page.locator(".toast")).toContainText(/no cuadra/, { timeout: 5_000 });
  await page.waitForTimeout(800);
  expect(await invocadas(page, "bank-confirm")).toHaveLength(0);
  expect(await invocadas(page, "bank-sync")).toHaveLength(0);
});

test("si el servidor rechaza el token, no hay «Banco conectado» ni lectura, y se puede reintentar", async ({ page }) => {
  await marca(page);
  await abre(page, "/?bank=confirm&t=" + TOKEN, { "bank-confirm": { data: { ok: false, error: "state" }, error: null } });
  await expect(page.locator(".toast")).toContainText(/No se pudo conectar el banco/, { timeout: 5_000 });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__avisos.join("|"))).not.toMatch(/Banco conectado/);
  expect(await invocadas(page, "bank-confirm")).toHaveLength(1);
  expect(await invocadas(page, "bank-sync")).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem("mc_bk_pend"))).not.toBeNull();
});

test("★ en la APK el token llega dentro del msg (`bank|error|confirm:…`) y se canjea igual", async ({ page }) => {
  await marca(page);
  await page.addInitScript((tk) => {
    let dado = false;
    window.Capacitor = { isNativePlatform: () => false, Plugins: { MiCartera: new Proxy({
      consumeGoto: async () => (dado ? {} : (dado = true, { goto: "bank|error|confirm:" + tk })),
      addListener: async () => ({ remove() {} }),
    }, { get: (t, k) => t[k] || (() => Promise.resolve({})) }) } };
  }, TOKEN);
  await abre(page, "/", { "bank-confirm": { data: { ok: true, aspsp_name: "CaixaBank" }, error: null } });
  await conectado(page);
  expect(await invocadas(page, "bank-confirm")).toEqual([{ name: "bank-confirm", body: { token: TOKEN } }]);
});

test("★ en la APK, `bank|ok` de otra app sin conexión en marcha no hace nada", async ({ page }) => {
  await page.addInitScript(() => {
    let dado = false;
    window.Capacitor = { isNativePlatform: () => false, Plugins: { MiCartera: new Proxy({
      consumeGoto: async () => (dado ? {} : (dado = true, { goto: "bank|ok" })),
      addListener: async () => ({ remove() {} }),
    }, { get: (t, k) => t[k] || (() => Promise.resolve({})) }) } };
  });
  await abre(page, "/");
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__avisos)).toEqual([]);
  expect(await invocadas(page, "bank-sync")).toHaveLength(0);
});

test("★ back.html reenvía el token de confirmar dentro de msg y lo quita de la barra", async ({ page }) => {
  // `/back` y no `/back.html`: el `serve` de las pruebas redirige a la URL limpia y pierde la query.
  await page.goto("/back?confirm=" + TOKEN, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#btn")).toHaveAttribute("href", "micartera://bank?msg=" + encodeURIComponent("confirm:" + TOKEN));
  await expect(page.locator("body")).not.toContainText(TOKEN);
  await expect(page.locator("#ttl")).not.toHaveText(/Banco conectado/);
  expect(page.url()).not.toContain(TOKEN);
});

test("back.html no reenvía un token con otro formato", async ({ page }) => {
  await page.goto("/back?confirm=" + encodeURIComponent(TOKEN + "&x=<b>"), { waitUntil: "domcontentloaded" });
  await expect(page.locator("#btn")).toHaveAttribute("href", "micartera://bank?msg=error");
});
