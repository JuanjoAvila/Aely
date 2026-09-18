/* APARIENCIA (UX-07 / feedback 18/9, punto 20).
 *
 * Tres cosas que `npm test` no ve porque son render puro:
 *  1. Cyberpunk es un TEMA de color de verdad: cambia las variables (fondo, superficie, texto),
 *     conserva la semántica del dinero (`--mint` verde, `--coral` rojo) y SOBREVIVE a recargar.
 *  2. Otoño y Primavera son TEMÁTICAS: ponen `data-season`, su tinte y su ambientación, y
 *     también sobreviven a recargar. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function appLista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

async function abrirAjustes(page) {
  await page.locator(".v4-avatar").click();
  await page.getByRole("button", { name: /Ir a Ajustes|Go to Settings|Ves a Ajustos/i }).click();
  const ajustes = page.locator(".settings-push.open");
  await expect(ajustes).toHaveCount(1);
  return ajustes;
}

async function abrirApariencia(ajustes) {
  // El grupo arranca plegado; su cabecera es la primera `.set-card` de Apariencia.
  const cab = ajustes.locator(".set-card > .set-row").first();
  await cab.click();
  await expect(ajustes.locator(".set-card .collapsible.open").first()).toBeVisible();
}

const vars = (page) =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim().toUpperCase();
    return {
      theme: document.documentElement.getAttribute("data-theme"),
      season: document.documentElement.getAttribute("data-season"),
      bg: v("--bg"), surface: v("--surface"), text: v("--text"), mint: v("--mint"), coral: v("--coral"),
      tinte: v("--season-tinte"),
      meta: (document.querySelector('meta[name="theme-color"]') || {}).content || "",
    };
  });

test("★ Cyberpunk: tema completo, dinero legible y persiste al recargar", async ({ page }) => {
  await seedLoggedInDashboard(page, { __seedOnce: true });
  await page.goto("/");
  await appLista(page);
  const ajustes = await abrirAjustes(page);
  await abrirApariencia(ajustes);

  const sw = ajustes.locator('button[data-theme-id="cyber"]');
  await expect(sw).toHaveAttribute("aria-label", /Cyberpunk/);
  await sw.click();
  await expect(sw).toHaveAttribute("aria-pressed", "true");

  const a = await vars(page);
  expect(a.theme).toBe("cyber");
  expect(a.bg).toBe("#0A0612");
  expect(a.surface).toBe("#150D26");
  expect(a.text).toBe("#F4F0FF");
  // El dinero sigue siendo verde/rojo: nada de pintar importes de magenta.
  expect(a.mint).toBe("#39F5A0");
  expect(a.coral).toBe("#FF4D7D");
  // La barra de estado del móvil acompaña al fondo.
  expect(a.meta.toUpperCase()).toBe("#0A0612");

  // Identidad propia, sin partículas: sin `data-season` no hay capa de ambientación.
  await expect(page.locator(".season-amb span")).toHaveCount(0);
  const fab = await page.evaluate(() => getComputedStyle(document.querySelector(".botnav-fab")).backgroundImage);
  expect(fab).toContain("linear-gradient");

  await page.reload();
  await appLista(page);
  const b = await vars(page);
  expect(b.theme, "el tema no sobrevivió a recargar").toBe("cyber");
  expect(b.bg).toBe("#0A0612");
});

test("Cyberpunk respeta «Reducir animaciones»: nada se mueve", async ({ page }) => {
  await seedLoggedInDashboard(page, { __seedOnce: true });
  await page.goto("/");
  await appLista(page);
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "cyber");
    document.documentElement.classList.add("reduce-motion");
  });
  const anims = await page.evaluate(() => {
    const nav = getComputedStyle(document.querySelector(".botnav"), "::after").animationName;
    const fab = getComputedStyle(document.querySelector(".botnav-fab"), "::after").animationName;
    return { nav, fab };
  });
  expect(anims.nav).toBe("none");
  expect(anims.fab).toBe("none");
});

for (const [id, nombre, tinte] of [["otono", /Otoño/, "#E3A04F"], ["primavera", /Primavera/, "#C9A0F5"]]) {
  test(`temática ${id}: tinte, ambientación y persistencia`, async ({ page }) => {
    await seedLoggedInDashboard(page, { __seedOnce: true });
    await page.goto("/");
    await appLista(page);
    const ajustes = await abrirAjustes(page);
    await abrirApariencia(ajustes);
    await ajustes.getByRole("button", { name: /Temática|Theme|Temàtica/ }).first().click();
    await ajustes.getByRole("button", { name: nombre }).click();

    const a = await vars(page);
    expect(a.season).toBe(id);
    expect(a.tinte).toBe(tinte);
    // No toca el dinero: el tema de color base sigue mandando en `--mint`/`--coral`.
    expect(a.mint).toBe("#6CC688");
    expect(a.coral).toBe("#E85D4C");

    await page.reload();
    await appLista(page);
    const b = await vars(page);
    expect(b.season, "la temática no sobrevivió a recargar").toBe(id);
    await expect(page.locator(".season-amb span").first()).toBeAttached();
  });
}

