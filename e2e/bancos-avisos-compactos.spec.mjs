import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* AVISOS DE BANCO CAÍDO, COMPACTOS (auditoría de diseño 233, DIS-23 y DIS-24, aprobada 15/11).
   · Inicio no decía nada con un banco caducado y su patrimonio podía estar desfasado: ahora una
     franja de una línea lo dice y lleva a los avisos de Cartera.
   · En Cartera cada banco era una tarjeta de ~105 px con párrafo y botón a todo el ancho; con dos,
     las cuentas salían de la primera pantalla. Ahora una tarjeta con una fila por banco y la
     explicación plegada, que se abre tocando la fila. Reconectar sigue llamando a lo mismo. */

const dos = [{ aspsp: "CaixaBank", ent: "caixabank", kind: "expired" }, { aspsp: "Revolut", ent: "revolut", kind: "pending" }];

async function app(page, overrides) {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLoggedInDashboard(page, { hasBankLink: true, accounts: [{ id: "cx", ent: "caixabank", name: "Caixa", value: 100 }], ...overrides });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}
const franja = (page) => page.getByTestId("inicio-aviso-banco");

test("Inicio: sin bancos caídos no hay franja", async ({ page }) => {
  await app(page, { bankIssues: [] });
  await expect(page.locator(".v4-inicio-head")).toBeVisible();
  await expect(franja(page)).toHaveCount(0);
});

test("Inicio: un banco caído dice cuál y lleva a sus avisos en Cartera", async ({ page }) => {
  await app(page, { bankIssues: [dos[0]] });
  await expect(franja(page)).toHaveCount(1);
  await expect(franja(page)).toContainText("CaixaBank necesita tu permiso");
  await expect(franja(page)).toContainText("Revisar");
  const alto = (await franja(page).boundingBox()).height;
  expect(alto).toBeGreaterThanOrEqual(44);
  expect(alto).toBeLessThan(60);
  await franja(page).click();
  await expect(page.locator(".botnav-tab.active")).toHaveAttribute("data-tour", "cartera");
  // Aterriza en los avisos: a la vista, arriba de la página.
  await expect.poll(() => page.evaluate(() => {
    const el = [...document.querySelectorAll(".v4-bank-issues")].find((x) => { const r = x.getBoundingClientRect(); return r.left >= 0 && r.left < innerWidth; });
    return el ? Math.round(el.getBoundingClientRect().top) : -1;
  })).toBeGreaterThanOrEqual(0);
  const top = await page.evaluate(() => [...document.querySelectorAll(".v4-bank-issues")].map((x) => x.getBoundingClientRect()).find((r) => r.left >= 0 && r.left < innerWidth).top);
  expect(top).toBeLessThan(200);
});

test("Inicio: con dos bancos caídos los cuenta", async ({ page }) => {
  await app(page, { bankIssues: dos });
  await expect(franja(page)).toContainText("2 bancos necesitan atención");
});

test("Cartera: dos bancos caídos en UNA tarjeta compacta; la explicación se abre tocando la fila", async ({ page }) => {
  await app(page, { bankIssues: dos });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const tarjeta = page.locator(".page-scroll-host .v4-bank-issues, .v4-bank-issues").first();
  await expect(tarjeta).toBeVisible();
  await expect(page.locator(".v4-bank-issues")).toHaveCount(1);
  const filas = tarjeta.locator(".v4-bank-issue");
  await expect(filas).toHaveCount(2);
  await expect(filas.nth(0)).toContainText("CaixaBank necesita tu permiso");
  await expect(filas.nth(1)).toContainText("Revolut se quedó a medio conectar");
  // Con dos avisos, la tarjeta entera mide menos que UNA de las de antes con su hermana (~210 px).
  expect((await tarjeta.boundingBox()).height).toBeLessThan(130);
  const cta = filas.nth(0).locator(".v4-bank-issue-cta");
  await expect(cta).toHaveText("Reconectar");
  expect(Math.round((await cta.boundingBox()).height)).toBe(36);
  // En reposo, la explicación no ocupa nada; tocando la fila se despliega y se vuelve a plegar.
  const sub = filas.nth(0).locator(".v4-bank-issue-sub");
  expect(Math.round((await sub.boundingBox()).height)).toBe(0);
  await filas.nth(0).locator(".v4-bank-issue-info").click();
  await expect(filas.nth(0).locator(".v4-bank-issue-info")).toHaveAttribute("aria-expanded", "true");
  await expect.poll(async () => Math.round((await sub.boundingBox()).height)).toBeGreaterThan(20);
  await expect(sub).toContainText("caducó");
  await filas.nth(0).locator(".v4-bank-issue-info").click();
  await expect.poll(async () => Math.round((await sub.boundingBox()).height)).toBe(0);
});
