import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* TODAS LAS PUERTAS DE AJUSTES ABREN LO SUYO (diseño 233, DIS-40: Ajustes en cuatro grupos).
   Al reordenar una pantalla se quedan puertas huérfanas sin que nada avise: con el rediseño v4
   desaparecieron el rol de cuenta, Hogar, la huella y el cerrar sesión, y el dueño tardó un día en
   notarlo (4.1.0). Esta prueba recorre cada entrada de Ajustes en la web (sesión iniciada, nube
   simulada) y comprueba que hace lo suyo: abrir su pantalla, desplegar sus opciones, cambiar su
   interruptor o pedir confirmación. No depende de en qué grupo esté cada fila: si no está a la
   vista, abre el grupo que la contenía antes o la busca con el buscador, así vale antes y después
   del cambio. Las entradas solo nativas (avisos, widget, actualizaciones) no existen en la web. */

async function abrirAjustes(page) {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".set-card").first()).toBeVisible({ timeout: 10_000 });
}
const tx = (page, key) => page.evaluate((k) => t(k), key);
const exacto = (s) => new RegExp("^\\s*" + s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$");
const filaDe = (page, label) => page.locator("button.set-row").filter({ has: page.locator(".sr-lb", { hasText: exacto(label) }) }).first();
const pila = (page) => page.evaluate(() => _mcBackStack.length);

/* Deja a la vista la fila `label`: si no se ve, se abre la sección `grupo` (su título). */
async function aLaVista(page, grupoKey, label) {
  const f = filaDe(page, label);
  // Una fila dentro de una sección plegada sigue teniendo caja: «visible» no basta.
  const aMano = () => f.evaluate((el) => !el.closest(".collapsible:not(.open)")).catch(() => false);
  if (await f.count() && await aMano()) return f;
  const g = filaDe(page, await tx(page, grupoKey));
  if (await g.count()) { await g.click(); await expect.poll(aMano).toBe(true); return f; }
  throw new Error("sin camino a «" + label + "»");
}
/* Pantalla propia: la pila de «atrás» crece al abrir; se cierra con su propio cierre. */
async function abrePantalla(page, fila) {
  const antes = await pila(page);
  await fila.click();
  await expect.poll(() => pila(page)).toBeGreaterThan(antes);
  await page.evaluate(() => { const e = _mcBackStack[_mcBackStack.length - 1]; e.close(); });
  await expect.poll(() => pila(page)).toBe(antes);
}
async function despliega(page, fila) {
  const antes = await page.locator(".set-exp").count();
  await fila.click();
  await expect(page.locator(".set-exp")).toHaveCount(antes + 1);
  await fila.click();
  await expect(page.locator(".set-exp")).toHaveCount(antes);
}
async function interruptor(page, fila) {
  const sw = fila.locator(".swx");
  const on = await sw.evaluate((e) => e.classList.contains("on"));
  await fila.click();
  await expect(sw).toHaveClass(on ? /^swx$/ : /swx on/);
  await fila.click();
  await expect(sw).toHaveClass(on ? /swx on/ : /^swx$/);
}
async function pideConfirmar(page, fila) {
  await fila.click();
  await expect(page.locator(".ask-btns").last()).toBeVisible();
  await page.locator(".ask-btns .btn-ghost").last().click();
  await expect(page.locator(".ask-btns")).toHaveCount(0);
}

test("cada entrada de Ajustes abre lo suyo", async ({ page }) => {
  test.setTimeout(120_000);
  await abrirAjustes(page);

  // Pregúntame: abre la ayuda.
  await page.evaluate(() => { window.__ayuda = 0; window.addEventListener("mc-open-help", () => { window.__ayuda++; }); });
  await page.locator(".aely-help-entry").click();
  await expect.poll(() => page.evaluate(() => window.__ayuda)).toBe(1);
  await page.evaluate(() => { const e = _mcBackStack[_mcBackStack.length - 1]; if (_mcBackStack.length > 1 && e && e.close) e.close(); });

  // Apariencia: tema, temática e idioma.
  await aLaVista(page, "v4_set_appear", await tx(page, "st_theme_season"));
  await expect(page.locator("[data-theme-id]").first()).toBeVisible();
  await despliega(page, filaDe(page, await tx(page, "st_theme_season")));
  await despliega(page, await aLaVista(page, "v4_set_appear", await tx(page, "language")));

  // Accesibilidad: tamaño de letra, reducir animaciones y más contraste.
  await aLaVista(page, "v4_set_a11y", await tx(page, "st_reduce_motion"));
  await expect(page.locator("[data-ts]")).toHaveCount(4);
  await interruptor(page, filaDe(page, await tx(page, "st_reduce_motion")));
  await interruptor(page, await aLaVista(page, "v4_set_a11y", await tx(page, "st_contrast")));

  // Dinero: moneda, conversor, total de Gastos y ciclo.
  await despliega(page, await aLaVista(page, "v4_set_money", await tx(page, "currency")));
  await abrePantalla(page, await aLaVista(page, "v4_set_money", await tx(page, "st_cur_convert")));
  await despliega(page, await aLaVista(page, "v4_set_money", await tx(page, "st_gview")));
  await interruptor(page, await aLaVista(page, "v4_set_money", await tx(page, "st_budget_cycle")));

  // Conexiones: fila de primer nivel desde R2 (18/11), sin grupo que desplegar.
  await abrePantalla(page, await aLaVista(page, "bp_title", await tx(page, "bp_title")));

  // Para empezar fácil: modo sencillo y el tour.
  await interruptor(page, await aLaVista(page, "v4_set_easy", await tx(page, "st_simple_lbl")));
  await expect(await aLaVista(page, "v4_set_easy", await tx(page, "v4_set_tour"))).toBeVisible();

  // Datos: importaciones, copia, informe del mes, novedades y sugerencias.
  await abrePantalla(page, await aLaVista(page, "st_imports", await tx(page, "ih_title")));
  await abrePantalla(page, await aLaVista(page, "st_imports", await tx(page, "bp_hist_btn")));
  await abrePantalla(page, await aLaVista(page, "backup", await tx(page, "bk_auto_title")));
  const informe = (await tx(page, "rp_btn")).replace(/^[^ ]+ /, "");
  await expect(await aLaVista(page, "v4_set_adv", informe)).toBeVisible();
  await abrePantalla(page, await aLaVista(page, "st_news", await tx(page, "st_news_row")));
  await abrePantalla(page, await aLaVista(page, "st_news", await tx(page, "st_feedback")));

  // Cuenta y privacidad: huella (sin lector en la web, lo dice), ayuda con IA, privacidad,
  // cerrar sesión y borrar la cuenta, que va la ÚLTIMA de su tarjeta (lejos de toques sin querer).
  await aLaVista(page, "st_account", await tx(page, "st_privacy"));
  await expect(page.getByText(await tx(page, "au_nobio"))).toBeVisible();
  await pideConfirmar(page, filaDe(page, await tx(page, "help_remote_setting")));
  await abrePantalla(page, filaDe(page, await tx(page, "st_privacy")));
  await expect(filaDe(page, await tx(page, "au_signout"))).toBeVisible();
  const borrar = filaDe(page, await tx(page, "st_delete_acc"));
  await pideConfirmar(page, borrar);
  expect(await borrar.evaluate((b) => { const rows = b.closest(".set-card").querySelectorAll("button.set-row"); return rows[rows.length - 1] === b; })).toBe(true);
});

test("el buscador encuentra la huella, la copia y el idioma", async ({ page }) => {
  await abrirAjustes(page);
  const buscador = page.getByPlaceholder(await tx(page, "st_search_ph"));
  for (const [q, key] of [["huella", "au_signout"], ["copia", "bk_auto_title"], ["idioma", "language"]]) {
    await buscador.fill(q);
    await expect(filaDe(page, await tx(page, key))).toBeVisible();
  }
  await buscador.fill("idioma");
  await expect(filaDe(page, await tx(page, "st_delete_acc"))).toHaveCount(0);
});

test("Ajustes va en cuatro grupos, cada uno una tarjeta con varias filas", async ({ page }) => {
  await abrirAjustes(page);
  const titulos = await Promise.all(["v4_set_g_look", "v4_set_g_money", "v4_set_g_data", "v4_set_g_account"].map((k) => tx(page, k)));
  await expect(page.locator(".v4-set-sec")).toHaveText(titulos);
  const filas = await page.locator(".v4-set-sec + .set-card").evaluateAll((cs) => cs.map((c) => c.querySelectorAll(":scope > .set-sub").length));
  // «Tu cuenta» sigue plegada en la suya: «Borrar mi cuenta» no queda a un toque al abrir Ajustes.
  expect(filas.length).toBe(4);
  for (const n of filas.slice(0, 3)) expect(n).toBeGreaterThanOrEqual(2);
});
