import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, estadoHeredado } from "./fixtures.mjs";

/* RONDA F (19/11/2026): lo que se PINTA de Plan, Cartera, Perfil, Inicio, Apuntar y los diálogos.
   · Metas: la regla de ahorro mensual de cada meta es el interruptor «Restar del presupuesto» de su hoja; la aportación al bróker se va a
     Cartera › Inversiones, y la previsión de una meta ya no sale de lo que se aporta al bróker.
   · Perfil: «Nombre del titular» y sin «@usuario».
   · Inicio: el ojo de ocultar importes también aquí, y esconde TODAS las cifras de la pantalla.
   · Apuntar sin ningún banco: sin «Tarjeta» ni «Bizum»; el CTA con espacio antes del «€».
   · Diálogo con campo a 360, letra Enorme y teclado: el campo, los atajos y los botones a la vista.
   · El aviso (toast) usa el ancho de la pantalla, no la mitad. Datos inventados. */
test.use({ serviceWorkers: "block" });

function estado(extra = {}) {
  const b = estadoHeredado("2026-09-26");
  return {
    ...b,
    obAccounts: b.obAccounts.map((o) => ({ ...o, key: o.id })),
    goals: [
      { id: "g-sin", name: "Meta sin reglas", emoji: "✈️", target: 1000, saved: 250 },
      { id: "g-con", name: "Meta con regla", emoji: "🛟", target: 3000, saved: 900 },
    ],
    aportaciones: [{ id: "ap1", ent: "myinvestor", name: "Fondo sintético", amount: 200 }],
    investments: [{ id: "i1", ent: "myinvestor", name: "Fondo sintético", shares: 3, value: 2000, cost: 1800, cur: "EUR" }],
    debts: [{ id: "d1", name: "Coche sintético", value: 4000, original: 8000, monthly: 200, amort: 200, months: 40, day: 5, apr: 0, account: "sabadell" }],
    settings: { ...b.settings, lang: "es", textSize: "small", profile: { fullName: "Persona Sintética" },
      reservaRules: [{ id: "r1", name: "", kind: "fixed", value: 100, goalId: "g-con", mensual: true }] },
    ...extra,
  };
}
async function abre(page, extra) {
  await installFixtureClock(page);
  await seedLoggedInDashboard(page, { __seedOnce: true, ...estado(extra) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}
const metas = (page) => page.locator('.v4-screen > [data-seg="metas"]').first();
async function abreMetas(page) {
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator(".page-scroll-host .v4-seg-btn").filter({ hasText: "Metas" }).first().click();
  await expect(metas(page).getByTestId("goals-summary")).toBeVisible();
}

test("Metas: la regla de ahorro mensual es el interruptor de la hoja, sin la aportación al bróker, y la previsión sale de cada meta", async ({ page }) => {
  await abre(page);
  await abreMetas(page);
  await expect(metas(page).locator("[data-savings-plan]")).toHaveCount(0);
  // La tarjeta «Ahorro mensual» ya no existe: cada meta lleva su regla como «Restar del presupuesto» en su hoja.
  await expect(metas(page).locator("[data-reserva-rule]")).toHaveCount(0);
  await expect(metas(page)).not.toContainText("Ahorro mensual");
  await expect(metas(page).getByText("Reservar dinero de tus ingresos")).toHaveCount(0);
  // Con 200 € al bróker y sin reglas, la meta no promete fecha; la de la regla, sí y con su ritmo.
  // Plan A: la previsión y el ritmo viven en la ficha de la meta (Estado y Al mes).
  const fichaMeta = page.getByTestId("plan-meta-ficha");
  await metas(page).locator('[data-goal-id="g-sin"]').click();
  await expect(fichaMeta).toContainText("Sin previsión");
  await fichaMeta.locator(".rpt-sx").click();
  await expect(fichaMeta).toHaveCount(0);
  await metas(page).locator('[data-goal-id="g-con"]').click();
  await expect(fichaMeta).toContainText("100");
  await fichaMeta.locator(".rpt-sx").click();
  await expect(fichaMeta).toHaveCount(0);
  // Sin tarjeta de reglas, tampoco su botón «Añadir ahorro»: la regla se enciende en la hoja de cada meta.
  await expect(metas(page).getByRole("button", { name: "Añadir ahorro" })).toHaveCount(0);
  // Plan A: «Aportar» vive en el pie de la ficha de la meta.
  await metas(page).locator('[data-goal-id="g-con"]').click();
  await expect(page.getByTestId("plan-meta-ficha").locator('[data-act="ficha-aportar"]')).toBeVisible();
});

test("Inicio › Tus metas usa el mismo ritmo que Metas", async ({ page }) => {
  await abre(page);
  const ini = page.locator(".page-scroll-host .v4-inicio").first();
  await expect(ini.locator('[data-inicio-meta="g-con"]')).toContainText("100");
  await expect(ini.locator('[data-inicio-meta="g-sin"]')).not.toContainText(/200|€\/mes/);
});

for (const [ancho, letra] of [[360, "huge"], [412, "small"]]) {
  test(`Inversiones lleva la aportación mensual, en una fila cuando está vacía (${ancho} ${letra})`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 });
    await abre(page, { aportaciones: [], settings: { ...estado().settings, textSize: letra } });
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    await page.getByRole("button", { name: /Ver todas tus inversiones/i }).click();
    const card = page.locator("[data-inv-screen] [data-savings-plan]");
    await card.scrollIntoViewIfNeeded();
    await expect(card).toContainText("Aportación mensual");
    await expect(card.locator("[data-savings-edit]")).toHaveText("Añadir");
    const m = await card.evaluate((el) => {
      const a = el.querySelector(".aely-savings-t").getBoundingClientRect(), b = el.querySelector("[data-savings-edit]").getBoundingClientRect();
      const t = el.querySelector(".aely-savings-t");
      return { mismaFila: b.top < a.bottom && a.top < b.bottom, dentro: b.right <= el.getBoundingClientRect().right + 0.5,
        cortado: t.scrollWidth > t.clientWidth + 1 };
    });
    expect(m.mismaFila, "vacía es una fila").toBe(true);
    expect(m.dentro).toBe(true);
    expect(m.cortado).toBe(false);
  });
}

test("con aportaciones: el título a lo ancho y «Editar» junto a la cifra, a 360 con Enorme", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await abre(page, { settings: { ...estado().settings, textSize: "huge" } });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button", { name: /Ver todas tus inversiones/i }).click();
  const card = page.locator("[data-inv-screen] [data-savings-plan]");
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator("[data-savings-total]")).toContainText(/200,00\s€\/mes/);
  const m = await card.evaluate((el) => {
    const r = (s) => el.querySelector(s).getBoundingClientRect();
    const t = r(".aely-savings-t"), tot = r("[data-savings-total]"), b = r("[data-savings-edit]");
    return { tituloUnaLinea: t.height < 2 * parseFloat(getComputedStyle(el.querySelector(".aely-savings-t")).lineHeight || "20") - 1,
      botonConCifra: b.top < tot.bottom && tot.top < b.bottom, dentro: b.right <= el.getBoundingClientRect().right + 0.5 };
  });
  expect(m.botonConCifra, "«Editar» en la fila de la cifra").toBe(true);
  expect(m.dentro).toBe(true);
});

// Filtro de diseño (ronda F): con Enorme a 360, «MyInvestor» se montaba encima de su importe.
test("la fila del bróker no monta el nombre sobre el importe, a 360 con Enorme", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await abre(page, { settings: { ...estado().settings, textSize: "huge" } });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const solape = (fila) => fila.evaluate((el) => {
    // El texto, no su caja: una palabra que no cabe se sale del div sin ensancharlo.
    const caja = (n) => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect(); };
    const nm = caja(el.querySelector(".nm > div:first-child")), am = caja(el.querySelector(".am"));
    const corta = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return { solapa: corta(nm, am), dentro: Math.max(nm.right, am.right) <= el.getBoundingClientRect().right + 0.5 };
  });
  const enCartera = page.locator('.page-scroll-host button.v4-mov[data-broker-key="myinvestor"]').first();
  await enCartera.scrollIntoViewIfNeeded();
  expect(await solape(enCartera)).toEqual({ solapa: false, dentro: true });
  await page.getByRole("button", { name: /Ver todas tus inversiones/i }).click();
  const enInv = page.locator('[data-inv-screen] button.v4-mov[data-broker-key="myinvestor"]');
  await enInv.scrollIntoViewIfNeeded();
  await expect(enInv.locator(".nm")).toContainText("MyInvestor");
  expect(await solape(enInv)).toEqual({ solapa: false, dentro: true });
  await enInv.screenshot({ path: "test-results/ronda-f-broker-360-enorme.png" });
});

test("Perfil: «Nombre del titular» y sin «@usuario»", async ({ page }) => {
  await abre(page);
  await page.locator(".v4-avatar").click();
  const perfil = page.locator(".profile-pull.open");
  await expect(perfil).toBeVisible();
  await expect(perfil.locator(".profile-handle")).toHaveCount(0);
  await expect(perfil.locator(".profile-pull-h")).not.toContainText("@");
  await expect(perfil).not.toContainText("Información básica");
  const fila = perfil.locator(".profile-row").filter({ hasText: "Nombre del titular" });
  await expect(fila).toContainText("Persona Sintética");
  await fila.click();
  await expect(page.locator(".askback .ts-title")).toHaveText("Nombre del titular");
});

test("Inicio: el ojo está en la cabecera y esconde todas las cifras, también la grande", async ({ page }) => {
  await abre(page);
  const ini = page.locator(".page-scroll-host .v4-inicio").first();
  const ojo = ini.locator(".v4-inicio-head [data-testid=ojo-importes]");
  await expect(ojo).toHaveAttribute("aria-pressed", "false");
  await expect(ini).toContainText(/\d\s€/);
  await ojo.click();
  await expect(ojo).toHaveAttribute("aria-pressed", "true");
  // Ninguna cifra con «€» a la vista: ni el patrimonio (con su contador), ni el ciclo, ni las filas.
  await expect.poll(() => ini.evaluate((el) => (el.innerText.match(/\d[\d.,]*\s?€/g) || []))).toEqual([]);
  // Plan ya no lleva ojo (24/11) pero respeta el ajuste: sin icono y con las cifras escondidas.
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('.page-live .v4-plan-cab')).toBeVisible();
  await expect(page.locator('.page-live .v4-plan-cab [data-testid=ojo-importes]')).toHaveCount(0);
  await expect(page.locator('.page-live [data-testid="plan-summary"] .pr6-big')).toHaveText(/••••/);
});

test("Apuntar sin ningún banco: sin «Tarjeta» ni «Bizum», y el importe con su espacio", async ({ page }) => {
  await abre(page, { obAccounts: [], accounts: [{ id: "c1", ent: "efectivo", name: "Efectivo", value: 100 }] });
  await page.locator(".botnav-fab").click();
  const hoja = page.locator(".v4-exp-sheet:visible");
  await expect(hoja).toBeVisible();
  await expect(hoja.getByTestId("ap-pay-card")).toHaveCount(0);
  await expect(hoja.getByTestId("ap-pay-transfer")).toHaveCount(0);
  const efectivo = hoja.getByTestId("ap-efectivo");
  await expect(efectivo).toHaveAttribute("aria-pressed", "false");
  await efectivo.click();
  await expect(efectivo).toHaveAttribute("aria-pressed", "true");
  await expect(hoja.locator(".v4-cta")).toHaveText(/Apuntar 0,00 €/);
});

test("Apuntar sin bancos ni efectivo: no hay fila de pago", async ({ page }) => {
  await abre(page, { obAccounts: [], accounts: [] });
  await page.locator(".botnav-fab").click();
  const hoja = page.locator(".v4-exp-sheet:visible");
  await expect(hoja).toBeVisible();
  await expect(hoja.locator(".v4-ficha-pay")).toHaveCount(0);
});

test("Apuntar con bancos sigue ofreciendo las tres formas de pago", async ({ page }) => {
  await abre(page);
  await page.locator(".botnav-fab").click();
  const hoja = page.locator(".v4-exp-sheet:visible");
  await expect(hoja.getByTestId("ap-pay-card")).toBeVisible();
  await expect(hoja.getByTestId("ap-pay-transfer")).toBeVisible();
});

test("diálogo con campo a 360, Enorme y teclado: campo, atajos y botones a la vista", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await abre(page, { settings: { ...estado().settings, textSize: "huge" } });
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator(".page-scroll-host .v4-seg-btn").filter({ hasText: "Deudas" }).first().click();
  await page.locator('[data-debt-id="d1"]').click();
  await page.locator('[data-act="ficha-editar"]').click();
  await page.getByRole("button", { name: "Amortizar ahora" }).click();
  const hoja = page.locator(".askback .tabsheet");
  await expect(hoja.locator(".ask-in")).toBeVisible();
  // El teclado: la ventana encoge como en la WebView que encoge.
  await page.setViewportSize({ width: 360, height: 430 });
  await page.waitForTimeout(400);
  const m = await hoja.evaluate((el) => {
    const vh = window.innerHeight, r = (x) => x.getBoundingClientRect();
    const btns = r(el.querySelector(".ask-btns"));
    const chips = [...el.querySelectorAll(".ask-chips .chip")].map(r);
    const inp = r(el.querySelector(".ask-in")), sub = el.querySelector(".ts-hint:not(.ask-live)");
    return { chips: chips.length, chipsBajoBotones: chips.filter((c) => c.bottom > btns.top + 0.5).length,
      chipsFuera: chips.filter((c) => c.bottom > vh + 0.5 || c.top < 0).length,
      campo: inp.top >= 0 && inp.bottom <= btns.top + 0.5, botones: btns.bottom <= vh + 0.5,
      hojaSeDesplaza: el.scrollHeight > el.clientHeight + 1, subSeDesplaza: sub.scrollHeight > sub.clientHeight + 1 };
  });
  expect(m.chips).toBeGreaterThanOrEqual(4);
  expect(m.chipsBajoBotones, "ningún atajo debajo de los botones").toBe(0);
  expect(m.chipsFuera).toBe(0);
  expect(m.campo).toBe(true);
  expect(m.botones).toBe(true);
  expect(m.hojaSeDesplaza, "lo que se desplaza es la explicación, no la hoja").toBe(false);
  // «Todo» se puede tocar sin desplazar nada.
  await hoja.locator(".ask-chips .chip").last().click();
  await expect(hoja.locator(".ask-in")).not.toHaveValue("");
});

test("el aviso usa el ancho de la pantalla y no se sale", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await abre(page);
  const m = await page.evaluate(() => {
    const el = document.createElement("div"); el.className = "toast";
    el.textContent = "Informe del mes guardado en Descargas. Tócalo en la notificación para abrirlo.";
    document.body.appendChild(el);
    const r = el.getBoundingClientRect(); el.remove();
    return { w: r.width, left: r.left, right: r.right, vw: window.innerWidth };
  });
  expect(m.w, "más de la mitad de la pantalla").toBeGreaterThan(m.vw * 0.6);
  expect(m.left).toBeGreaterThanOrEqual(0);
  expect(m.right).toBeLessThanOrEqual(m.vw);
  expect(Math.abs(m.left - (m.vw - m.right))).toBeLessThan(2);
});

test("Apuntar en un móvil bajo con Enorme: el concepto vacío se lee entero", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await abre(page, { settings: { ...estado().settings, textSize: "huge" } });
  await page.locator(".botnav-fab").click();
  const campo = page.locator(".v4-exp-sheet:visible .v4-ficha-concept");
  await expect(campo).toBeVisible();
  const m = await campo.evaluate((el) => {
    const cs = getComputedStyle(el), s = document.createElement("span");
    s.textContent = el.placeholder; s.style.font = cs.font; s.style.letterSpacing = cs.letterSpacing; s.style.whiteSpace = "nowrap";
    s.style.position = "absolute"; s.style.visibility = "hidden"; el.parentNode.appendChild(s);
    const w = s.getBoundingClientRect().width; s.remove();
    return { texto: w, hueco: el.getBoundingClientRect().width - (parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)) * (el.getBoundingClientRect().width / el.offsetWidth) };
  });
  expect(m.texto, "el texto de ayuda cabe en el campo").toBeLessThanOrEqual(m.hueco + 0.5);
});
