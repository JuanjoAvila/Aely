import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* MIS BANCOS: ENTRAR, SALIR Y VOLVER A DONDE ESTABAS (ronda R2 del rediseño de bancos, 18/11).
 *
 * Antes «Mis bancos» era un `div` fijo que salía de golpe y que al cerrar dejaba SIEMPRE en
 * Ajustes aunque vinieras de Cartera. La R2 la hizo pantalla hija y cambió también la entrada de
 * Ajustes por una fila «Conexiones»; esa entrada él la quiso como antes (19/11): el grupo «Bancos»
 * con «Gestionar mis bancos» dentro, pero entrando y saliendo deslizando. Lo que aquí se blinda es
 * lo que se ve y se toca: la entrada de siempre sin saltos, que desde Cartera no haya Ajustes
 * debajo, que atrás vaya por pasos, que el borde la cierre, que el selector no abra el teclado y
 * que solo una vuelta con acción resalte la fila y avise. */

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

/* Muestrea en cada fotograma el borde izquierdo de la pantalla de bancos hasta que se asienta o
   desaparece. Un salto es un fotograma que va hacia atrás o que la quita antes de haber salido.
   Guarda también la opacidad: con fundido, al salir se leía Ajustes a través (filtro 19/11). */
async function muestrea(page, hasta) {
  return page.evaluate((fin) => new Promise((ok) => {
    const xs = []; const t0 = performance.now(); window.__opBancos = [];
    const paso = () => {
      const el = document.querySelector(".v4-banks-push");
      xs.push(el ? Math.round(el.getBoundingClientRect().left) : null);
      if (el) window.__opBancos.push(parseFloat(getComputedStyle(el).opacity));
      const quieto = el && xs.length > 4 && xs.slice(-4).every((x) => x === 0);
      if ((fin === "dentro" && quieto) || (fin === "fuera" && !el) || performance.now() - t0 > 3000) ok(xs); else requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }), hasta);
}

test("Ajustes: el grupo «Bancos» de siempre con «Gestionar mis bancos»; entra y sale deslizando, sin saltos", async ({ page }) => {
  await arranca(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(ajustesAbierto(page)).toBeVisible({ timeout: 10_000 });
  // La entrada de antes (19/11): nada de fila «Conexiones», un grupo «Bancos» con su resumen.
  await expect(page.locator("[data-cx-row]")).toHaveCount(0);
  const grupo = page.locator("[data-bank-grp]");
  const cabecera = grupo.locator("> .set-row");
  await expect(cabecera.locator(".sr-lb")).toHaveText("Bancos");
  await expect(cabecera.locator(".sr-val")).toHaveText("1 conectado · 1 caducado");
  await cabecera.click();
  const gestionar = page.locator("[data-bank-manage]");
  await expect(gestionar).toBeVisible();
  await expect(gestionar).toHaveText(/Gestionar mis bancos/);
  expect(await alto(gestionar)).toBeGreaterThanOrEqual(44);
  await page.waitForTimeout(400);   // que termine de desplegarse antes de medir dónde está
  const antes = await gestionar.evaluate((el) => Math.round(el.getBoundingClientRect().top));

  await gestionar.click();
  const entrada = await muestrea(page, "dentro");
  await expect(push(page)).toHaveClass(/open/);
  await expect(push(page).locator(".settings-push-h h1")).toHaveText("Mis bancos");
  await expect(push(page).locator("[data-aspsp]")).toHaveCount(2);
  // Entra desde la derecha y avanza siempre hacia la izquierda: ni aparece de golpe ni rebota.
  const e = entrada.filter((x) => x != null);
  expect(e.some((x) => x > 40), "entra deslizando: " + e.join(",")).toBe(true);
  for (let i = 1; i < e.length; i++) expect(e[i], "fotograma " + i + ": " + e.join(",")).toBeLessThanOrEqual(e[i - 1]);

  const atras = push(page).locator(".settings-push-h .back");
  expect(await alto(atras)).toBeGreaterThanOrEqual(44);
  await atras.click();
  const salida = await muestrea(page, "fuera");
  // Opaca en TODOS los fotogramas de la salida: lo de debajo no se transparenta.
  const ops = await page.evaluate(() => window.__opBancos);
  expect(ops.length, "fotogramas de salida").toBeGreaterThan(3);
  expect(ops.filter((o) => o < 1), "opacidad por fotograma: " + ops.join(",")).toEqual([]);
  const s2 = salida.filter((x) => x != null);
  // Sale hacia la derecha antes de desmontarse, sin volver atrás en ningún fotograma.
  expect(s2.some((x) => x > 40), "sale deslizando: " + s2.join(",")).toBe(true);
  for (let i = 1; i < s2.length; i++) expect(s2[i], "fotograma " + i + ": " + s2.join(",")).toBeGreaterThanOrEqual(s2[i - 1]);
  await expect(push(page)).toHaveCount(0);
  // Se aterriza donde se estaba: Ajustes, el grupo aún abierto y la fila en el mismo sitio.
  await expect(ajustesAbierto(page)).toBeVisible();
  await expect(gestionar).toBeVisible();
  expect(await gestionar.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(antes);
  // Y callado: no ha pasado nada que contar.
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

// Lo que deja `connect` antes de salir hacia el banco, y la vuelta de la web con ?bank=ok.
// `lectura` es la respuesta de `bank-sync`, que corre sola nada más volver.
const LECTURA_OK = { data: { ok: true, links: [{ aspsp: "Banco de Sabadell", ok: true, accounts: [] }, { aspsp: "CaixaBank", ok: true, accounts: [] }] }, error: null };
async function vuelveDeRenovar(page, banco, origen, lectura) {
  await page.addInitScript(([n, o]) => {
    if (sessionStorage.getItem("_e2eVuelta")) return;
    sessionStorage.setItem("_e2eVuelta", "1");
    sessionStorage.setItem("mc_bk_vuelta", JSON.stringify({ n, k: "r", o }));
  }, [banco, origen]);
  await arranca(page, { __url: "/?bank=ok", __cloudFns: lectura ? { "bank-sync": lectura } : {} });
  await expect(push(page)).toHaveClass(/open/, { timeout: 10_000 });
}

test("volver de renovar un banco aterriza en el origen con la fila resaltada y el aviso", async ({ page }) => {
  await vuelveDeRenovar(page, "Banco de Sabadell", "cartera", LECTURA_OK);
  await expect(page.locator('.botnav-tab[data-tour="cartera"]')).toHaveClass(/active/);
  await page.waitForTimeout(800);   // que la lectura de después de volver termine
  await push(page).locator(".settings-push-h .back").click();
  await expect(push(page)).toHaveCount(0);

  const marcada = page.locator(".page.page-live .cx-vuelta");
  await expect(marcada).toHaveCount(1);
  await expect(marcada).toHaveAttribute("data-account-id", /.+/);
  await expect(page.locator(".toast")).toContainText(/Sabadell renovado/);
  // El resalte se apaga solo.
  await expect(page.locator(".cx-vuelta")).toHaveCount(0, { timeout: 4_000 });
});

test("si leer el banco falla tras renovar, ese aviso no queda tapado por «renovado»", async ({ page }) => {
  // Sin `bank-sync` simulado la lectura falla: es el caso real de un banco que tarda o se cae.
  await vuelveDeRenovar(page, "Banco de Sabadell", "cartera", null);
  await expect(page.locator(".toast")).toContainText(/⚠/, { timeout: 10_000 });
  await push(page).locator(".settings-push-h .back").click();
  await expect(push(page)).toHaveCount(0);
  await expect(page.locator(".page.page-live .cx-vuelta")).toHaveCount(1);
  // Ni en el momento ni un poco después: gana el error y no se suceden dos mensajes contrarios.
  await expect(page.locator(".toast")).toContainText(/⚠/);
  await page.waitForTimeout(600);
  await expect(page.locator(".toast")).not.toContainText(/renovado/);
});

test("volviendo a Ajustes, el resumen de «Bancos» deja de contar el caducado", async ({ page }) => {
  await vuelveDeRenovar(page, "CaixaBank", "settings", LECTURA_OK);
  // El banco ya confirmó el permiso nuevo: la tabla de enlaces lo da por activo.
  await page.evaluate(() => { window.__e2eCloudRows.bank_links.forEach((l) => { l.status = "active"; l.valid_until = "2027-02-15T00:00:00Z"; }); });
  await page.waitForTimeout(800);
  await push(page).locator(".settings-push-h .back").click();
  await expect(push(page)).toHaveCount(0);
  const fila = page.locator("[data-bank-grp] > .set-row");
  await expect(fila).toHaveClass(/cx-vuelta/);
  await expect(page.locator(".toast")).toContainText(/CaixaBank renovado/);
  await expect(fila).toContainText(/2 conectados/);
  await expect(fila).not.toContainText(/caducado/);
  // Y con Conexiones ya cerrada: una lectura que acaba después (`runBankSync` avisa al terminar)
  // también llega a la fila, sin tener que salir y volver a entrar en Ajustes.
  await page.evaluate(() => {
    window.__e2eCloudRows.bank_links.find((l) => l.aspsp_name === "Banco de Sabadell").status = "expired";
    window.dispatchEvent(new CustomEvent("mc-bank-links-changed"));
  });
  // Al momento: sin escuchar el aviso, la fila tardaba en enterarse por caminos ajenos.
  await expect(fila).toContainText("1 conectado · 1 caducado", { timeout: 1_500 });
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
