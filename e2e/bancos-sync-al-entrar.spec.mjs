import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard } from "./fixtures.mjs";

/* LOS BANCOS SE LEEN SOLOS AL ENTRAR, PERO CON TOPE (orden del dueño, 16/11/2026: «que
 * sincronice las cuentas al entrar en la app… si entras seguido, que no se pueda»).
 *
 * Desde la 4.1.0 el banco solo se leía a demanda: leerlo en cada apertura hizo que Caixa y
 * Sabadell tumbaran el consentimiento por «uso robótico». Ahora vuelve a leerse solo, una vez
 * cada 6 h como mucho y tres al día contando las manuales (`bankAutoToca`, 08). Aquí se abre la
 * app con la última lectura de hace 7 h: tiene que salir UNA lectura sola, y ni volver a primer
 * plano ni reabrir enseguida pueden lanzar otra.
 */

const H = 3600 * 1000;
const respuesta = () => ({
  "bank-sync": {
    data: { ok: true, links: [{ aspsp: "Sabadell", ok: true, accounts: [] }] },
    error: null,
  },
});
const base = (lastBankSync) => ({
  accounts: [{ id: "sab", ent: "sabadell", name: "Sabadell", role: "diario", value: 900 }],
  hasBankLink: true,
  lastBankSync,
  __seedOnce: true,
  __cloudFns: respuesta(),
});
const lecturas = (page) => page.evaluate(() => (window.__e2eInvokes || []).filter((x) => x.name === "bank-sync" && !(x.body && x.body.dateFrom)).length);

test("★ con la última lectura de hace 7 h se lee sola UNA vez; volver o reabrir enseguida no repite", async ({ page }) => {
  await seedLoggedInDashboard(page, base(Date.now() - 7 * H));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });

  await expect.poll(() => lecturas(page), { timeout: 15_000, message: "la lectura sola tiene que salir" }).toBe(1);
  const reg = await page.evaluate(() => JSON.parse(localStorage.getItem("_bankAutoSync") || "{}"));
  expect(reg.n).toBe(1);
  // La lectura llegó al estado: es la que sella `lastBankSync`.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3") || "{}").lastBankSync)).toBeGreaterThan(Date.now() - 60_000);

  // Volver a primer plano enseguida: el efecto lo mira y no toca.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(6000);
  expect(await lecturas(page), "volver enseguida no repite").toBe(1);

  // Reabrir enseguida (arranque en frío): tampoco.
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(6000);
  expect(await lecturas(page), "reabrir enseguida no repite").toBe(0);
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("_bankAutoSync") || "{}"))).n).toBe(1);
});

test("con la última lectura de hace 1 h no se lee sola", async ({ page }) => {
  await seedLoggedInDashboard(page, base(Date.now() - 1 * H));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(6000);
  expect(await lecturas(page)).toBe(0);
});

test("tras un 429 de hoy no se lee sola aunque hayan pasado horas", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("_e2ePausa")) return;
    sessionStorage.setItem("_e2ePausa", "1");
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    localStorage.setItem("_bankAutoSync", JSON.stringify({ dia: p, n: 1, at: Date.now() - 8 * 3600 * 1000, pausa: p }));
  });
  await seedLoggedInDashboard(page, base(Date.now() - 8 * H));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(6000);
  expect(await lecturas(page)).toBe(0);
});
