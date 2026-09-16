import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* VISOR DEL HISTÓRICO — filas invisibles a mitad + «Ver N más» muerto (10/9).
 *
 * Sus palabras: «cuando bajo mas o menos por la mitad esta todo negro… llegar al final que te
 * dice ver 35 mas, le doy y no pasa nada». Causa: `.hist-fila` arranca en opacity:0 y solo la
 * clase `dentro` la enseña; la animación paraba en 24 y NUNCA marcaba el resto. Las filas 25…60
 * ocupaban sitio pero eran transparentes (negro del fondo), y «Ver más» subía el tope de DOM
 * dejando las nuevas igual de invisibles porque `revelado` seguía topeado a 24.
 */

const bankLinks = [
  { aspsp_name: "Revolut", aspsp_country: "ES", status: "active",
    valid_until: "2026-10-01T00:00:00Z", last_sync: "2026-07-25T09:00:00Z", accounts: [{ uid: "a1" }] },
];

function loteGrande(n) {
  const txs = [];
  for (let i = 0; i < n; i++) {
    const day = String(20 - (i % 15)).padStart(2, "0");
    txs.push({
      date: "2026-07-" + day,
      amount: 10 + (i % 7),
      merchant: "Mov" + String(i).padStart(3, "0"),
      card: true,
      ext_id: "hx" + i,
    });
  }
  return [{ aspsp: "Revolut", accounts: [{ transactions: txs }] }];
}

async function abrirConLote(page, n) {
  await seedLoggedInDashboard(page, {
    hasBankLink: true,
    settings:{autoPrices:false,theme:"green",expenseBanks:["revolut"]},
    __cloudRows: { bank_links: bankLinks },
    __cloudFns: { "bank-sync": { data: { ok: true, links: loteGrande(n) }, error: null } },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".set-card").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Importaciones/i }).click();
  await page.locator("button.set-row").filter({ hasText: /Importar histórico/i }).click();
  const overlay = page.locator(".hist-import");
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: /Buscar movimientos/i }).click();
  await expect(overlay.locator(".hist-fila").first()).toBeVisible({ timeout: 10_000 });
  return overlay;
}

test("★ pasado el tope de animación, las filas del medio NO se quedan transparentes", async ({ page }) => {
  const overlay = await abrirConLote(page, 95);
  // 24×~34 ms + margen: la animación tiene que haber llegado al tope.
  await expect.poll(async () => overlay.locator(".hist-fila.dentro").count(), { timeout: 8_000 }).toBeGreaterThanOrEqual(60);
  const mid = await overlay.locator(".hist-fila").nth(30).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { op: cs.opacity, dentro: el.classList.contains("dentro"), text: el.textContent.slice(0, 40) };
  });
  expect(mid.dentro, "la fila 30 tiene que llevar dentro o es el negro de mitad de scroll").toBe(true);
  expect(Number(mid.op)).toBeGreaterThan(0.9);
});

test("★ «Ver N más» enseña filas NUEVAS visibles, no más huecos negros", async ({ page }) => {
  const overlay = await abrirConLote(page, 95);
  await expect.poll(async () => overlay.locator(".hist-fila.dentro").count(), { timeout: 8_000 }).toBe(60);
  const more = overlay.locator("[data-hist-more]");
  await expect(more).toBeVisible();
  await expect(more).toContainText(/35/);
  await more.click();
  await expect.poll(async () => overlay.locator(".hist-fila").count()).toBe(95);
  // Las nuevas nacen con `dentro` → arranca hojaentra (~0.34s). Esperar a que deje de ser 0.
  await expect.poll(async () => overlay.locator(".hist-fila").last().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  const last = await overlay.locator(".hist-fila").last().evaluate((el) => ({
    op: getComputedStyle(el).opacity,
    dentro: el.classList.contains("dentro"),
  }));
  expect(last.dentro).toBe(true);
  expect(Number(last.op)).toBeGreaterThan(0.9);
  await expect(more).toHaveCount(0);
});
