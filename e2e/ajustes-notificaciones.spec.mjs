import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* AJUSTES → NOTIFICACIONES, REHECHA (16/11, «hiper cutre»). El rediseño cambia cómo se pinta el
   grupo (permiso arriba, filas con una línea, logos de banco) y NO lo que hace: cada interruptor
   tiene que seguir cambiando la MISMA clave de `settings` de siempre, el lector nativo tiene que
   seguir recibiendo sus preferencias y la fila del permiso tiene que seguir abriendo el acceso a
   notificaciones de Android. El grupo solo existe con el puente nativo: aquí se simula. */

async function abrir(page, { granted }) {
  await seedLoggedInDashboard(page, { settings: { autoPrices: false, theme: "dark" },
    __cloudRows: { bank_links: [{ id: "l1", aspsp_name: "CaixaBank", status: "active" }, { id: "l2", aspsp_name: "Banco de Sabadell", status: "active" }] } });
  await page.addInitScript((g) => {
    window.__nat = { prefs: [], ingest: [], openAccess: 0, ensurePerm: 0 };
    window.Capacitor = { isNativePlatform: () => false, Plugins: {
      MiCartera: new Proxy({
        notifAccess: async () => ({ granted: g }),
        openNotifAccess: async () => { window.__nat.openAccess++; return {}; },
        ensureNotifPerm: async () => { window.__nat.ensurePerm++; return {}; },
        setNotifPrefs: async (p) => { window.__nat.prefs.push(p); return {}; },
        setIngestUrl: async (p) => { window.__nat.ingest.push(p.url); return {}; },
        addListener: async () => ({ remove() {} }),
      }, { get: (t, k) => t[k] || (() => Promise.resolve({})) }) } };
  }, granted);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  const cab = page.locator("button.set-row").filter({ has: page.locator(".sr-lb", { hasText: /^Notificaciones$/ }) });
  await expect(cab).toBeVisible({ timeout: 10_000 });
  return cab;
}
const ajuste = (page, k) => page.evaluate((k) => (JSON.parse(localStorage.getItem("micartera_v3")).settings || {})[k], k);
const fila = (page, k) => page.locator('button.nt-row[data-nt="' + k + '"]');

test("cada interruptor de Notificaciones cambia su ajuste de siempre", async ({ page }) => {
  const cab = await abrir(page, { granted: true });
  // El estado del permiso se lee sin abrir el grupo.
  await expect(cab.locator(".nt-st.ok")).toHaveText("Activo");
  await cab.click();
  await expect(fila(page, "access")).toBeVisible();
  await expect(page.locator('button.set-row').filter({ hasText: "¿Android no te deja?" })).toHaveCount(0);
  // Los bancos conectados se ven con su logo real, no con un emoji.
  await expect(fila(page, "banksync").locator(".nt-logos img")).toHaveCount(2);
  await expect(fila(page, "tring").locator(".mono-logo img")).toHaveAttribute("src", "logos/trade_republic.png");

  const casos = [
    { k: "banksync", clave: "bankSyncOnNotif", antes: undefined, despues: true },
    { k: "trnotif", clave: "trNotifyConfirm", antes: undefined, despues: false },
  ];
  // «Sugerir categoría con IA» ya no existe (19/11): la Edge nunca tuvo clave y no hacía nada.
  await expect(fila(page, "aicat")).toHaveCount(0);
  await expect(page.locator(".nt-row").filter({ hasText: /IA/ })).toHaveCount(0);
  for (const c of casos) {
    const sw = fila(page, c.k).locator(".swx");
    const on = await sw.evaluate((e) => e.classList.contains("on"));
    expect(await ajuste(page, c.clave)).toBe(c.antes);
    await fila(page, c.k).click();
    await expect(sw).toHaveClass(on ? /^swx$/ : /swx on/);
    await expect.poll(() => ajuste(page, c.clave)).toBe(c.despues);
    await fila(page, c.k).click();
    await expect(sw).toHaveClass(on ? /swx on/ : /^swx$/);
    await expect.poll(() => ajuste(page, c.clave)).toBe(!c.despues);
  }
  // Las dos del lector nativo le llegan al móvil, como antes.
  await expect.poll(() => page.evaluate(() => window.__nat.prefs.some((p) => p.expenseConfirm === false && p.bankSyncOnNotif === false))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__nat.prefs.some((p) => p.bankSyncOnNotif === true))).toBe(true);

  // Apuntar solo: activa token + URL de ingest y lo guarda; apagar lo deshace.
  const sw = fila(page, "tring").locator(".swx");
  await expect(sw).toHaveClass(/^swx$/);
  await fila(page, "tring").click();
  await expect.poll(() => ajuste(page, "trIngest")).toBe(true);
  await expect(sw).toHaveClass(/swx on/);
  expect(await ajuste(page, "ingestToken")).toBeTruthy();
  await expect.poll(() => page.evaluate(() => window.__nat.ingest.some((u) => /\/functions\/v1\/ingest\?token=/.test(u)))).toBe(true);
  expect(await page.evaluate(() => window.__nat.ensurePerm)).toBeGreaterThan(0);
  await fila(page, "tring").click();
  await expect.poll(() => ajuste(page, "trIngest")).toBe(false);
  await expect(sw).toHaveClass(/^swx$/);
  await expect.poll(() => page.evaluate(() => window.__nat.ingest.at(-1))).toBe("");
});

test("sin permiso: se ve en la cabecera, la fila lo abre y explica el ajuste restringido", async ({ page }) => {
  const cab = await abrir(page, { granted: false });
  await expect(cab.locator(".nt-st.ko")).toHaveText("Sin permiso");
  // La caja roja suelta entre secciones ya no existe: el aviso vive en su grupo.
  await expect(page.locator(".settings-push .alarmbox")).toHaveCount(0);
  await cab.click();
  await expect(fila(page, "access").locator(".nt-fix")).toHaveText("Activar");
  await fila(page, "access").click();
  await expect.poll(() => page.evaluate(() => window.__nat.openAccess)).toBe(1);
  const q = page.locator("button.set-row").filter({ hasText: "¿Android no te deja?" });
  await q.click();
  await expect(page.locator(".set-exp").filter({ hasText: "Permitir ajustes restringidos" })).toBeVisible();
  await q.click();
  await expect(page.locator(".set-exp").filter({ hasText: "Permitir ajustes restringidos" })).toHaveCount(0);
});

test("el buscador encuentra Notificaciones por el permiso", async ({ page }) => {
  await abrir(page, { granted: true });
  await page.getByPlaceholder(/Buscar en ajustes/).fill("permiso");
  await expect(fila(page, "access")).toBeVisible();
});
