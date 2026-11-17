import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Auditoría de diseño del 15/11 (lote de menores, 235):
   - DIS-43: había seis botones atrás distintos. Las subpantallas de Ajustes llevan ya el mismo «‹»
     redondo de 44 px a la izquierda, con el título al lado; Pregúntame, que es una hoja, se cierra
     con una X a la derecha.
   - DIS-45: la bienvenida tiene un solo botón principal; entrar y crear cuenta son enlaces de 44 px
     debajo, y los dos siguen llevando a su panel.
   - DIS-47: el candado y el panel de cuenta usan los colores del tema, y «No puedo desbloquear» es
     un botón de texto de 44 px, sin subrayado. */

async function abreAjustes(page, settings = {}) {
  await seedLoggedInDashboard(page, { settings: { autoPrices: false, theme: "green", ...settings } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator(".v4-avatar").click();
  await page.getByRole("button", { name: /Ir a Ajustes/ }).click();
  await expect(page.locator(".settings-push.open")).toBeVisible({ timeout: 5_000 });
}

// Las filas pueden estar dentro de un grupo plegado: se pulsan por JS, como el buscador.
const pulsaFila = (page, texto) => page.locator(".set-row", { hasText: texto }).first().evaluate((el) => el.click());

for (const [fila, titulo] of [["Privacidad y datos", /Privacidad y datos/], ["Enviar sugerencia", /Algo que contar/], ["Conversor", /Conversor|convert/i]]) {
  test(`Subpantalla «${fila}»: «‹» redondo de 44 px a la izquierda, título al lado, y cierra`, async ({ page }) => {
    await abreAjustes(page);
    await pulsaFila(page, fila);
    const head = page.locator(".sub-push-h");
    await expect(head).toHaveCount(1);
    await expect(head.locator("h1")).toHaveText(titulo);
    const back = head.locator(".back");
    const caja = await back.boundingBox();
    expect(caja.width).toBeGreaterThanOrEqual(44);
    expect(caja.height).toBeGreaterThanOrEqual(44);
    expect(caja.x, "el «‹» va a la izquierda").toBeLessThan(40);
    const h1 = await head.locator("h1").boundingBox();
    expect(Math.abs((h1.y + h1.height / 2) - (caja.y + caja.height / 2)), "título en la misma línea").toBeLessThan(8);
    await expect(back).toHaveText("‹");
    // Ningún «‹ Ajustes» / «‹ Volver» de texto queda en pantalla.
    await expect(page.getByRole("button", { name: /^‹ / })).toHaveCount(0);
    await back.click();
    await expect(head).toHaveCount(0);
    await expect(page.locator(".settings-push.open")).toBeVisible();
  });
}

test("Pregúntame es una hoja: se cierra con una X a la derecha, con 44 px de área", async ({ page }) => {
  await abreAjustes(page);
  await page.locator(".aely-help-entry").first().click();
  const dialog = page.getByRole("dialog", { name: /Pregúntame/ });
  await expect(dialog).toBeVisible();
  const x = dialog.locator(".aely-help-x");
  await expect(x).toHaveText("✕");
  await expect(x).toHaveAttribute("aria-label", "Cerrar");
  const caja = await x.boundingBox();
  const hoja = await dialog.boundingBox();
  expect(caja.x + caja.width, "la X va pegada a la derecha").toBeGreaterThan(hoja.x + hoja.width - 60);
  // El dibujo es de 36 px; el ::before lo lleva a 44 (el ancho extra crece hacia la izquierda,
  // porque la hoja recorta su borde derecho): los bordes ampliados siguen siendo la X.
  // La hoja sube animada: se mide cuando deja de moverse.
  await expect.poll(async () => { const a = (await x.boundingBox()).y; await page.waitForTimeout(120); return Math.abs((await x.boundingBox()).y - a); }).toBeLessThan(0.5);
  const borde = await x.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const pts = [[r.left - 8, r.top + r.height / 2], [r.right - 1, r.top + r.height / 2], [r.left + r.width / 2, r.top - 3], [r.left + r.width / 2, r.bottom + 3]];
    return pts.map(([px, py]) => { const hit = document.elementFromPoint(px, py); return !!(hit && hit.closest(".aely-help-x")); });
  });
  expect(borde).toEqual([true, true, true, true]);
  await x.click();
  await expect(dialog).toHaveCount(0);
});

test("Bienvenida: un solo botón principal y entrar/crear cuenta como enlaces de 44 px que funcionan", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".v4-ob-title")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".v4-ob-sub")).toHaveText("Tus cuentas, gastos y deudas en un sitio.");
  await expect(page.locator(".btn-ghost")).toHaveCount(0);
  const empezar = page.getByRole("button", { name: /Empezar/ });
  const entrar = page.locator(".v4-ob-link", { hasText: /Ya tengo cuenta/ });
  const crear = page.locator(".v4-ob-link", { hasText: /Crear cuenta nueva/ });
  await expect(entrar).toBeVisible();
  await expect(crear).toBeVisible();
  const [e, a, c] = [await empezar.boundingBox(), await entrar.boundingBox(), await crear.boundingBox()];
  expect(a.y, "los enlaces van debajo de Empezar").toBeGreaterThan(e.y + e.height - 1);
  expect(a.height).toBeGreaterThanOrEqual(44);
  expect(c.height).toBeGreaterThanOrEqual(44);
  expect(await page.locator(".v4-ob-card-s").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(13);
  // Entrar abre el panel de inicio de sesión (con su campo de correo) y sigue siendo alcanzable.
  await entrar.click();
  await expect(page.locator('input[type="email"], input[autocomplete="email"], input[autocomplete="username"]').first()).toBeVisible();
});

test("Candado: «No puedo desbloquear» es un botón de 44 px, de 14 px y sin subrayado", async ({ page }) => {
  await seedLoggedInDashboard(page, { settings: { autoPrices: false, theme: "light" } });
  await page.addInitScript(() => { localStorage.setItem("bio_cred", JSON.stringify({ id: "x" })); });
  await page.goto("/");
  const cant = page.getByRole("button", { name: "No puedo desbloquear" });
  await expect(cant).toBeVisible({ timeout: 20_000 });
  const estilo = await cant.evaluate((el) => { const cs = getComputedStyle(el); return { h: el.getBoundingClientRect().height, fs: parseFloat(cs.fontSize), deco: cs.textDecorationLine }; });
  expect(estilo.h).toBeGreaterThanOrEqual(44);
  expect(estilo.fs).toBeGreaterThanOrEqual(14);
  expect(estilo.deco).toBe("none");
});

test("Panel de cuenta en tema Claro: tarjeta con la superficie del tema, no el verde oscuro fijo", async ({ page }) => {
  await page.addInitScript(() => { try { document.documentElement.setAttribute("data-theme", "light"); } catch (e) {} });
  await page.goto("/");
  await expect(page.locator(".v4-ob-title")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.locator(".v4-ob-link", { hasText: /Ya tengo cuenta/ }).click();
  const campo = page.locator('input[type="email"], input[autocomplete="email"], input[autocomplete="username"]').first();
  await expect(campo).toBeVisible();
  const r = await campo.evaluate((el) => {
    const card = el.parentElement; const surf = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
    const probe = document.createElement("div"); probe.style.background = surf; document.body.appendChild(probe);
    const want = getComputedStyle(probe).backgroundColor; probe.remove();
    return { got: getComputedStyle(card).backgroundColor, want };
  });
  expect(r.got).toBe(r.want);
});
