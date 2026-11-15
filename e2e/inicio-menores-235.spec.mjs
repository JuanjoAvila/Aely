import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Lote de menores del diseño de la 235 en Inicio (auditoría de diseño 15/11/2026):
 *  DIS-22 el «?» dibuja 36 px pero el dedo tiene 44.     DIS-21 los enlaces de sección: 44 px y un solo texto.
 *  DIS-19 «Últimos movimientos» sin tarjeta dentro de tarjeta.   DIS-20 sin metas, una fila tocable.
 *  DIS-25 las mismas iniciales en Inicio, Perfil y Ajustes.      DIS-44 «Pregúntame» con la letra de la app.
 *  DIS-46 sin nada, ni «0,00 €» en grande ni deudas de cero en coral.
 * Se mide el DOM de verdad: lo que se ve no lo prueba ningún test unitario (AGENTS §7). */
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

async function lista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}
const hoy = new Date().toISOString().slice(0, 10) + "T12:00:00Z";
const gastos = [
  { id: "g1", date: hoy, amount: 12.5, category: "super", ent: "sabadell", merchant: "Mercadona" },
  { id: "g2", date: hoy, amount: 30, category: "ocio", ent: "sabadell", merchant: "Cine" },
];
const inicio = (page) => page.locator(".page-scroll-host .v4-screen").first();

test("Inicio: «?» y enlaces con 44 px de dedo, un solo «Ver todo ›» y movimientos sin tarjeta dentro de tarjeta", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: gastos });
  await page.goto("/");
  await lista(page);

  // DIS-22: el dibujo sigue en 36 px y los cuatro bordes del área de 44 caen en el botón.
  const ayuda = page.locator(".aely-help-entry-mini");
  const toque = await ayuda.evaluate((el) => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const cae = (x, y) => !!(document.elementFromPoint(x, y) || { closest: () => null }).closest(".aely-help-entry-mini");
    return { dibujo: Math.round(r.width), bordes: [cae(cx - 21.5, cy), cae(cx + 21.5, cy), cae(cx, cy - 21.5), cae(cx, cy + 21.5)] };
  });
  expect(toque.dibujo).toBe(36);
  expect(toque.bordes).toEqual([true, true, true, true]);

  // DIS-21: todos los enlaces de sección de Inicio dicen lo mismo y miden 44 de alto.
  const enlaces = inicio(page).locator(".v42-cycle-head .link, .v4-section-h .link");
  expect(await enlaces.count()).toBeGreaterThanOrEqual(2);
  for (const l of await enlaces.all()) {
    await expect(l).toHaveText("Ver todo ›");
    expect((await l.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  // Y el del ciclo no hace crecer su cabecera (margen negativo).
  const cabecera = await inicio(page).locator(".v42-cycle-head").boundingBox();
  expect(cabecera.height).toBeLessThan(30);

  // DIS-19: las filas de «Últimos movimientos» son planas, con raya entre ellas y sin la última.
  const filas = page.getByTestId("inicio-recent").locator(".v4-mov");
  await expect(filas).toHaveCount(2);
  const estilos = await filas.evaluateAll((els) => els.map((el) => {
    const cs = getComputedStyle(el);
    return { fondo: cs.backgroundColor, radio: cs.borderTopLeftRadius, abajo: cs.borderBottomWidth, arriba: cs.borderTopWidth };
  }));
  expect(estilos[0]).toEqual({ fondo: "rgba(0, 0, 0, 0)", radio: "0px", abajo: "1px", arriba: "0px" });
  expect(estilos[1].abajo).toBe("0px");
});

test("Inicio sin metas: una fila de 56 px que lleva a Plan › Metas", async ({ page }) => {
  await seedLoggedInDashboard(page, { goals: [] });
  await page.goto("/");
  await lista(page);
  const fila = page.getByTestId("inicio-nogoal");
  await expect(fila).toHaveText(/Ponte una meta de ahorro/);
  const caja = await fila.boundingBox();
  expect(caja.height).toBeGreaterThanOrEqual(56);
  expect(caja.height).toBeLessThan(64);
  await expect(inicio(page).locator(".v4-empty").filter({ hasText: /meta/i })).toHaveCount(0);
  await fila.click();
  await expect(page.locator('.botnav-tab.active[data-tour="plan"]')).toHaveCount(1);
  await expect(page.locator(".page-scroll-host .v4-seg-btn.on")).toHaveText(/Metas/);
});

test("las iniciales del avatar son las mismas en Inicio, Perfil y Ajustes", async ({ page }) => {
  for (const [estado, esperado] of [[{}, "E"], [{ settings: { autoPrices: false, theme: "green", profile: { fullName: "Juanjo Avila" } } }, "JA"]]) {
    await seedLoggedInDashboard(page, estado);
    await page.goto("/");
    await lista(page);
    await expect(page.locator(".v4-avatar")).toHaveText(esperado);
    await page.locator(".v4-avatar").click();
    await expect(page.locator(".profile-av")).toHaveText(esperado);
    await page.getByRole("button", { name: /Ir a Ajustes|Go to Settings|Ves a Configuració/i }).click();
    await expect(page.locator(".settings-push.open .v4-set-av")).toHaveText(esperado);
  }
});

test("Pregúntame escribe con la letra de la app, no en monoespaciada", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await lista(page);
  await page.locator(".aely-help-entry-mini").click();
  const campo = page.locator("#help-question");
  await expect(campo).toBeVisible();
  const [suya, app] = await campo.evaluate((el) => [getComputedStyle(el).fontFamily, getComputedStyle(document.body).fontFamily]);
  expect(suya).toBe(app);
});

test("sin cuentas ni movimientos: Inicio y Cartera ofrecen la primera cuenta en vez de «0,00 €»", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts: [], expenses: [], obAccounts: [], investments: [], assets: [], debts: [], budget: 0, history: [] });
  await page.goto("/");
  await lista(page);
  const hero = page.getByTestId("inicio-net-current");
  await expect(hero.getByTestId("hero-first-acc")).toContainText("Añade tu primera cuenta");
  await expect(hero.getByRole("button", { name: "Conecta tu banco" })).toBeVisible();
  await expect(hero.locator(".v4-hero-amt")).toHaveCount(0);

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const tarjeta = page.locator(".page-scroll-host .v4-card-hero");
  await expect(tarjeta.getByTestId("hero-first-acc")).toBeVisible();
  await expect(tarjeta.locator(".cartera-hero-amt")).toHaveCount(0);
  // Sin nada que sumar no hay barra ni «Deudas 0 €» en coral.
  await expect(tarjeta.locator(".v4-stackbar")).toHaveCount(0);
  await expect(tarjeta).not.toContainText(/Deudas/);
});

test("con cuentas y sin deudas, «Deudas 0 €» no sale en coral", async ({ page }) => {
  await seedLoggedInDashboard(page, { debts: [] });
  await page.goto("/");
  await lista(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const tarjeta = page.locator(".page-scroll-host .v4-card-hero");
  await expect(tarjeta.locator(".cartera-hero-amt")).toBeVisible();
  const cero = tarjeta.locator("span", { hasText: /^\s*-?0\s*€\s*$/ });
  await expect(cero).toHaveCount(1);
  const [color, coral] = await cero.evaluate((el) => {
    const p = document.createElement("i"); p.style.color = "var(--coral)"; document.body.appendChild(p);
    const c = getComputedStyle(p).color; p.remove(); return [getComputedStyle(el).color, c];
  });
  expect(color).not.toBe(coral);
});
