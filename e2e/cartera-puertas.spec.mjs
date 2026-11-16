import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* PUERTAS DE CARTERA TRAS QUITAR «EDITAR» (16/11/2026, petición suya).
 * Se quitaron «⇅ Ordenar secciones», «✎ Editar a mano» con su pista gris y el «Editar» de Tus
 * cuentas. AGENTS §7: al quitar una puerta, lo que solo se hacía desde ella tiene que seguir
 * teniendo camino. Aquí se blinda que SE LLEGA, no que el botón esté:
 *   - el valor de una posición sin cotización (fondo, oro…) se pone tocando su fila;
 *   - la de con cotización NO se toca (lo tecleado lo pisaría el precio);
 *   - una cuenta se renombra y cambia de rol desde su ficha, también la EXTRA del banco. */

const estado = {
  accounts: [{ id: "rv", ent: "revolut", name: "Del día a día", value: 640.2, spendFrom: true }],
  obAccounts: [{ key: "ob1", ent: "sabadell", name: "Ahorro", value: 50, cur: "EUR" }],
  investments: [
    { id: "oro", ent: "revolut", name: "Oro físico", value: 1200, cost: 1000, cur: "EUR" },
    { id: "etf", ent: "revolut", name: "MSCI World", ticker: "IWDA", shares: 10, value: 900, cost: 800, cur: "EUR" },
  ],
  settings: { autoPrices: false, theme: "green", lang: "es" },
};

async function abrirCartera(page) {
  await page.route("**/api.frankfurter.dev/**", (r) => r.abort());
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator('.page-live [data-account-id="rv"]')).toBeVisible();
}

const leeEstado = (page) => page.evaluate(() => (typeof loadState === "function" ? loadState() : null));

test("el valor de una posición sin precio automático se pone tocando su fila", async ({ page }) => {
  await abrirCartera(page);
  const sec = page.locator('.page-live [data-cartera-sec="inversiones"]');
  await sec.locator('button.v4-mov[data-broker-key="revolut"]').click();
  // Con cotización no es un botón: su valor lo pone el precio.
  await expect(sec.locator('[data-inv-position="etf"]')).not.toHaveJSProperty("tagName", "BUTTON");
  const oro = sec.locator('button[data-inv-position="oro"]');
  await expect(oro).toBeVisible();
  await oro.click();

  const dlg = page.locator(".askback .tabsheet");
  await expect(dlg).toContainText("Oro físico");
  const input = dlg.locator("input.ask-in");
  await expect(input).toHaveValue("1200");
  await input.fill("1.350,5");   // con punto de miles, como lo escribe
  await dlg.getByRole("button", { name: "Guardar" }).click();
  await expect(dlg).toHaveCount(0);

  await expect(oro).toContainText("1.350,50");
  await expect.poll(async () => (await leeEstado(page)).investments.find((i) => i.id === "oro").value).toBe(1350.5);
  const it = (await leeEstado(page)).investments.find((i) => i.id === "oro");
  expect(it.manualUpdatedAt).toBeTruthy();
  // El coste no se toca: el dinero puesto sigue siendo el mismo.
  expect(it.cost).toBe(1000);
});

test("cancelar o teclear basura no cambia el valor", async ({ page }) => {
  await abrirCartera(page);
  const sec = page.locator('.page-live [data-cartera-sec="inversiones"]');
  await sec.locator('button.v4-mov[data-broker-key="revolut"]').click();
  const oro = sec.locator('button[data-inv-position="oro"]');
  const dlg = page.locator(".askback .tabsheet");

  await oro.click();
  await dlg.locator("input.ask-in").fill("999");
  await dlg.getByRole("button", { name: "Cancelar" }).click();
  await expect(dlg).toHaveCount(0);

  await oro.click();
  await dlg.locator("input.ask-in").fill("abc");
  await dlg.getByRole("button", { name: "Guardar" }).click();
  await expect(dlg).toHaveCount(0);

  await page.waitForTimeout(600);
  expect((await leeEstado(page)).investments.find((i) => i.id === "oro").value).toBe(1200);
});

test("una cuenta se renombra y cambia de rol desde su ficha, también la extra del banco", async ({ page }) => {
  await abrirCartera(page);
  await expect(page.locator('.page-live [data-act="acc-edit"]')).toHaveCount(0);

  // Cuenta propia: nombre y rol.
  await page.locator('.page-live [data-account-id="rv"]').click();
  let ficha = page.locator(".v4-sheet").filter({ has: page.locator(".v4-account-head") });
  await expect(ficha).toBeVisible();
  await ficha.locator(".v4-account-rename").click();
  await ficha.locator("input.v4-account-name").fill("Nómina");
  await ficha.locator(".v4-ficha-op").filter({ hasText: "Recibos" }).first().click();
  await expect.poll(async () => (await leeEstado(page)).accounts.find((a) => a.id === "rv").name).toBe("Nómina");
  // Se cierra tocando fuera, como cualquier hoja.
  await page.locator(".v4-sheet-back").click({ position: { x: 10, y: 10 } });
  await expect(ficha).toHaveCount(0);
  await expect(page.locator('.page-live [data-account-id="rv"]')).toContainText("Nómina");

  // Cuenta EXTRA del banco: darle rol la promociona a cuenta propia (antes solo desde «Editar»).
  await page.locator('.page-live [data-ob-key="ob1"]').click();
  ficha = page.locator(".v4-sheet").filter({ has: page.locator(".v4-account-head") });
  await expect(ficha).toBeVisible();
  await ficha.locator(".v4-ficha-op").filter({ hasText: "Recibos" }).first().click();
  await expect.poll(async () => {
    const s = await leeEstado(page);
    return (s.accounts || []).some((a) => a.ent === "sabadell");
  }).toBe(true);
});
