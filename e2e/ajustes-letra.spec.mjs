import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* TAMAÑOS DE LETRA RENOMBRADOS (suyo, 26/10/2026): «la actual pequeña pasa a llamarse normal y es
   la opción por defecto; la actual normal pasa a grande; la actual grande pasa a muy grande». Solo
   cambian los rótulos: los valores guardados son los de siempre y quien no eligió nunca sigue en
   «normal» (hoy «Grande»); el «Normal» de salida lo guarda el onboarding en instalaciones nuevas. */

async function abreAjustes(page, settings) {
  await seedLoggedInDashboard(page, { settings: { autoPrices: false, theme: "green", ...settings } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator(".v4-avatar").click();
  await page.getByRole("button", { name: /Ir a Ajustes|Go to Settings|Ves a Ajustos/i }).click();
  const ajustes = page.locator(".settings-push.open");
  await expect(ajustes).toBeVisible({ timeout: 5_000 });
  const boton = (v) => ajustes.locator(`button[data-ts="${v}"]`);
  // El grupo de accesibilidad sale plegado (montado, pero con alto 0): se abre por su fila.
  await ajustes.locator(".set-row", { hasText: /Accesibilidad|Accessibility|Accessibilitat/ }).first().click();
  await expect(boton("small")).toBeVisible();
  return { ajustes, boton };
}
const zoom = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.body).zoom) || 1);

const ROTULOS = {
  es: ["Normal", "Grande", "Muy grande", "Enorme"],
  en: ["Normal", "Large", "Extra large", "Huge"],
  ca: ["Normal", "Gran", "Molt gran", "Enorme"],
};

for (const [lang, rot] of Object.entries(ROTULOS)) {
  test(`Letra: rótulos nuevos, y quien nunca eligió conserva su tamaño de siempre (ahora «Grande») — ${lang}`, async ({ page }) => {
    const { boton } = await abreAjustes(page, { lang });
    for (const [i, v] of ["small", "normal", "big", "huge"].entries()) await expect(boton(v)).toHaveText(rot[i]);
    // Sin textSize guardado cae en el valor «normal» (hoy «Grande»): las instalaciones viejas no encogen.
    await expect(boton("normal")).toHaveAttribute("aria-pressed", "true");
    await expect(boton("small")).toHaveAttribute("aria-pressed", "false");
    expect(await zoom(page)).toBe(1);
    const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).settings.textSize);
    expect(guardado).toBeUndefined();
  });
}

test("Letra: quien tenía «small» guardado (instalación nueva) ve marcado «Normal»", async ({ page }) => {
  const { boton } = await abreAjustes(page, { lang: "es", textSize: "small" });
  await expect(boton("small")).toHaveText("Normal");
  await expect(boton("small")).toHaveAttribute("aria-pressed", "true");
  await expect(boton("normal")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).toHaveClass(/\bsmalltext\b/);
  expect(await zoom(page)).toBeCloseTo(0.92, 2);
});

test("Letra: quien tenía «normal» guardado conserva su tamaño, que ahora se llama «Grande»", async ({ page }) => {
  const { boton } = await abreAjustes(page, { lang: "es", textSize: "normal" });
  await expect(boton("normal")).toHaveText("Grande");
  await expect(boton("normal")).toHaveAttribute("aria-pressed", "true");
  await expect(boton("small")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).not.toHaveClass(/\b(smalltext|bigtext|hugetext)\b/);
  expect(await zoom(page)).toBe(1);
});

test("Letra: quien tenía «grande» guardado conserva su tamaño, que ahora se llama «Muy grande»; elegir guarda", async ({ page }) => {
  const { boton } = await abreAjustes(page, { lang: "es", textSize: "big" });
  await expect(boton("big")).toHaveText("Muy grande");
  await expect(boton("big")).toHaveAttribute("aria-pressed", "true");
  expect(await zoom(page)).toBeCloseTo(1.12, 2);
  // Elegir «Normal» sí es una elección: se guarda el valor de siempre. Que se pueda tocar se mira a
  // mano (con zoom en el body, el clic de Playwright apunta a otro sitio): lo que hay en el centro
  // del botón, ya terminado el despliegue del grupo, tiene que ser el botón.
  await expect.poll(() => boton("small").evaluate((b) => { b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b; }), { message: "el botón se puede tocar" }).toBe(true);
  await boton("small").dispatchEvent("click");
  await expect(boton("small")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveClass(/\bsmalltext\b/);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).settings.textSize)).toBe("small");
});
