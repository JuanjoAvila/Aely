import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, estadoHeredado, dismissNews } from "./fixtures.mjs";

/* RONDA DE DISEÑO 240 (encargos D y E de la auditoría 237): Plan › Deudas y Metas, Ajustes y Perfil.
   Lo que se comprueba es lo que se VE, abriendo cada pantalla de verdad:
   - Deudas y Metas llevan la tarjeta resumen de Recibos (a la izquierda, cifra en color de texto),
     sin el pie «El saldo baja solo…», sin 💸 y con una persona para lo que se debe a la familia.
   - Metas sin aportaciones: «Ahorro mensual · Añadir» en una fila, sin «0,00 €/mes» ni frases; una
     meta sin ritmo no dice «Empieza a ahorrar…» (ni en Plan ni en Inicio).
   - Ajustes: iconos de trazo (ningún emoji en las filas), lupa de trazo y «?» de 44 al lado,
     sin subtítulos, «Ciclo de cobro» sin valor al lado y nada cortado con letra Enorme.
   - Perfil: «Hogar compartido» en una línea, sin el párrafo de privacidad, «Ir a Ajustes» como
     fila con flecha y la cabecera de Ajustes (44 px, título a su altura).
   - El aviso con Ajustes abierto va abajo del todo, no flotando sobre las filas. */

const ANCHOS = [[360, 740], [393, 851], [412, 915]];
const EMOJI = /\p{Extended_Pictographic}/u;

function estado(extra = {}) {
  const b = estadoHeredado("2026-10-14");
  const month = 2026 * 12 + 9;
  return {
    __seedOnce: true,
    ...b,
    obAccounts: b.obAccounts.map((o) => ({ ...o, key: o.id })),
    debts: [...b.debts, { id: "mama", ent: "familia", name: "Mamá", value: 72.45, original: 300, monthly: 10.35, day: 5, asOf: month, account: "sabadell" }],
    goals: [
      { id: "g1", name: "Viaje", emoji: "✈️", target: 4000, saved: 1500, deadline: null, monthly: null, color: "#5FD08A" },
      { id: "g2", name: "Colchón", emoji: "🛟", target: 6000, saved: 2400, deadline: null, monthly: 150, color: "#5FD08A" },
    ],
    aportaciones: [],
    ...extra,
    settings: { autoPrices: false, theme: "green", budgetCycle: true, lang: "es", reservaRules: [], ...(extra.settings || {}) },
  };
}
async function abre(page, extra) {
  await seedLoggedInDashboard(page, estado(extra));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}
const segmento = (page, seg) => page.locator('.page-live .v4-screen > [data-seg="' + seg + '"]');
async function abrePlan(page, seg) {
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator('.v4-seg-btn[data-seg="' + seg + '"]').click();
  return segmento(page, seg);
}
async function abreAjustes(page) {
  await page.locator(".v4-avatar").click();
  await page.getByRole("button", { name: /Ir a Ajustes/ }).click();
  const aj = page.locator(".settings-push.open");
  await expect(aj).toBeVisible({ timeout: 5_000 });
  return aj;
}
/* Nada se sale ni se corta: ningún texto con más contenido que caja, y nada fuera del ancho. */
const cortes = (loc, sel) => loc.evaluate((root, sel) => {
  const out = [];
  root.querySelectorAll(sel).forEach((el) => {
    if (!el.getClientRects().length || el.closest(".collapsible:not(.open)")) return;
    if (el.scrollWidth > el.clientWidth + 1) out.push(el.textContent.trim());
  });
  if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push("página ancha");
  return out;
}, sel);
/* Palabras partidas en dos renglones («Hipote / ca», «Accesi / bilidad»): se mide cada palabra. */
const partidas = (loc, sel) => loc.evaluate((root, sel) => {
  const out = [], r = document.createRange();
  root.querySelectorAll(sel).forEach((el) => {
    if (!el.getClientRects().length || el.closest(".collapsible:not(.open)")) return;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      for (const m of n.textContent.matchAll(/\S+/g)) {
        r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const filas = new Set([...r.getClientRects()].map((c) => Math.round(c.top)));
        if (filas.size > 1) out.push(m[0]);
      }
    }
  });
  return out;
}, sel);

for (const [w, h] of ANCHOS) for (const letra of ["small", "huge"]) {
  test.describe(`${w} px ${letra}`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: true });

    test(`Deudas: resumen como Recibos, sin pie ni 💸, persona para la familia — ${w} ${letra}`, async ({ page }) => {
      await abre(page, { settings: { textSize: letra } });
      const deudas = await abrePlan(page, "deudas");
      const res = deudas.getByTestId("debts-summary");
      await expect(res).toContainText("Este mes pagas");
      const m = await res.evaluate((el) => {
        const r = (s) => el.querySelector(s).getBoundingClientRect();
        const probe = document.createElement("span"); probe.style.color = "var(--text)"; el.appendChild(probe);
        const texto = getComputedStyle(probe).color; probe.remove();
        return { align: getComputedStyle(el).textAlign, etiqueta: r(".rpt-ht").left, cifra: r(".plan-summary-amount").left,
          linea: r(".rpt-hs").left, color: getComputedStyle(el.querySelector(".plan-summary-amount")).color, texto };
      });
      expect(m.align).toMatch(/^(left|start)$/);
      expect(Math.abs(m.etiqueta - m.cifra), "cifra alineada con la etiqueta").toBeLessThan(6);
      expect(Math.abs(m.etiqueta - m.linea)).toBeLessThan(2);
      expect(m.color).toBe(m.texto);
      // Plan A: el icono por palabra vive en la ficha de la deuda, no en la fila.
      await deudas.locator('[data-debt-id="mama"]').click();
      await expect(page.getByTestId("plan-deuda-ficha").locator('svg[data-ico="person"]')).toHaveCount(1);
      await page.getByTestId("plan-deuda-ficha").locator(".rpt-sx").click();
      await deudas.locator('[data-debt-id="hipo"]').click();
      await expect(page.getByTestId("plan-deuda-ficha").locator('svg[data-ico="home"]')).toHaveCount(1);
      await page.getByTestId("plan-deuda-ficha").locator(".rpt-sx").click();
      for (const t of await deudas.locator(".rpt-row").allTextContents()) expect(t).not.toMatch(EMOJI);
      await expect(deudas.getByText(/El saldo baja solo/)).toHaveCount(0);
      expect(await cortes(deudas, ".rpt-nm, .rpt-am, .plan-summary-amount, .rpt-hs, .rpt-sub")).toEqual([]);
      expect(await partidas(deudas, ".rpt-nm, .rpt-am, .plan-summary-amount, .rpt-ht"), "palabras o cifras partidas").toEqual([]);
    });

    test(`Metas: resumen como Recibos, sin la aportación al bróker y sin «Empieza a ahorrar» — ${w} ${letra}`, async ({ page }) => {
      await abre(page, { settings: { textSize: letra } });
      const metas = await abrePlan(page, "metas");
      const res = metas.getByTestId("goals-summary");
      await expect(res).toContainText("Ahorrado en metas");
      expect(await res.evaluate((el) => getComputedStyle(el).textAlign)).toMatch(/^(left|start)$/);
      // La aportación al bróker se mudó a Cartera › Inversiones (19/11): su fila vacía la mira ronda-f-plan.
      await expect(metas.locator("[data-savings-plan]")).toHaveCount(0);
      await expect(metas.locator('[data-goal-id="g1"] .rpt-dot')).toHaveCount(0);
      await expect(metas.locator('[data-goal-id="g2"] .rpt-sub')).toContainText("150");
      await expect(metas.getByText(/Empieza a ahorrar|Añade una para apartar/)).toHaveCount(0);
      expect(await cortes(metas, ".plan-summary-amount, .rpt-hs, .rpt-nm")).toEqual([]);
      expect(await partidas(metas, ".plan-summary-amount, .rpt-nm, .rpt-ht")).toEqual([]);
    });
  });
}

test("Inicio › Tus metas: sin ritmo no se pinta la previsión", async ({ page }) => {
  await abre(page);
  const tarjetas = page.locator(".page-live .v4-goals .v4-goal");
  await expect(tarjetas).toHaveCount(2);
  await expect(page.locator(".page-live .v4-goals")).not.toContainText(/Empieza a ahorrar/);
  await expect(tarjetas.nth(1)).toContainText("150");
  // Sin previsión la tarjeta acaba en su barra: nada de hueco vacío para igualar a la de al lado.
  const hueco = await tarjetas.nth(0).evaluate((el) => el.getBoundingClientRect().bottom - el.querySelector(".bar").getBoundingClientRect().bottom);
  expect(hueco, "hueco bajo la barra (margen + relleno de la tarjeta)").toBeLessThan(30);
});

for (const [w, h] of ANCHOS) for (const letra of ["small", "huge"]) {
  test.describe(`Ajustes ${w} ${letra}`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: true });
    test(`Ajustes: iconos de trazo, buscador con «?», sin subtítulos y nada cortado — ${w} ${letra}`, async ({ page }) => {
      await abre(page, { settings: { textSize: letra } });
      const aj = await abreAjustes(page);
      const buscador = aj.locator(".set-search-in");
      await expect(buscador).toHaveAttribute("placeholder", "Buscar en ajustes…");
      await expect(aj.locator(".set-search-ic")).toHaveCount(1);
      const ayuda = aj.locator(".aely-help-entry-set");
      await expect(ayuda).toHaveAttribute("aria-label", "Pregúntame");
      const caja = await ayuda.boundingBox();
      const zoom = await page.evaluate(() => parseFloat(getComputedStyle(document.body).zoom) || 1);
      expect(caja.width / zoom).toBeGreaterThanOrEqual(43.5);
      expect(caja.height / zoom).toBeGreaterThanOrEqual(43.5);
      // Se abren los grupos de los cuatro bloques para ver todas sus filas.
      for (const t of ["Apariencia", "Accesibilidad", "Dinero", "Bancos", "Para empezar fácil", "Importaciones", "Copia de seguridad", "Novedades", "Tu cuenta"]) {
        const fila = aj.locator(".set-sub > .set-row", { has: page.locator(".sr-lb", { hasText: new RegExp("^" + t + "$") }) }).first();
        if (await fila.count()) await fila.evaluate((b) => b.click());
      }
      await page.waitForTimeout(500);
      const iconos = await aj.locator(".v4-set-sec + .set-card .set-row .sr-ic").evaluateAll((els) => els.map((e) => ({ svg: !!e.querySelector("svg, .mono"), txt: e.textContent.trim() })));
      expect(iconos.length).toBeGreaterThan(15);
      for (const i of iconos) { expect(i.svg, "fila con icono de trazo: " + i.txt).toBe(true); expect(i.txt).not.toMatch(EMOJI); }
      // Cada fila su dibujo, todos de trazo: ni la misma chispa en tres sitios ni el del grupo repetido dentro.
      const dibujos = await aj.locator(".v4-set-sec + .set-card .set-row .sr-ic svg[data-set-ico]").evaluateAll((els) => els.map((e) => ({ k: e.dataset.setIco, d: e.innerHTML, relleno: [...e.querySelectorAll("*")].some((n) => { const f = n.getAttribute("fill"); return f && f !== "none"; }) })));
      const porDibujo = {};
      for (const x of dibujos) { (porDibujo[x.d] ||= new Set()).add(x.k); expect(x.relleno, "icono relleno: " + x.k).toBe(false); }
      for (const ks of Object.values(porDibujo)) expect([...ks], "el mismo dibujo para filas distintas").toHaveLength(1);
      // «Total de Gastos» nunca va una palabra por renglón (Enorme a 360 la partía en tres).
      const total = aj.locator(".set-row > .sr-lb", { hasText: /^Total de Gastos$/ });
      const renglones = await total.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].map((c) => Math.round(c.top))).size; });
      expect(renglones).toBeLessThanOrEqual(2);
      await expect(aj.getByText(/Quita deslizamientos|Sube el contraste|Con nómina reconocida/)).toHaveCount(0);
      const ciclo = aj.locator(".set-row", { has: page.locator(".sr-lb", { hasText: /^Ciclo de cobro$/ }) });
      await expect(ciclo).toHaveCount(1);
      await expect(ciclo.locator(".sr-val")).toHaveCount(0);
      // Dinero abierto no repite la moneda: solo la dice su fila de dentro.
      const dinero = aj.locator(".set-sub > .set-row", { has: page.locator(".sr-lb", { hasText: /^Dinero$/ }) });
      await expect(dinero.locator(".sr-val")).toHaveCount(0);
      await expect(aj.locator(".set-row", { hasText: "Moneda en pantalla" }).locator(".sr-val")).toHaveText("€ Euro");
      await expect(aj.locator(".set-row", { has: page.locator(".sr-lb", { hasText: /^Bancos$/ }) }).locator(".sr-val")).toHaveText("Ninguno");
      // Nada cortado: ni etiquetas (a media palabra) ni valores con «…».
      expect(await cortes(aj, ".set-row .sr-lb, .set-row .sr-val, .v4-set-sec")).toEqual([]);
      expect(await partidas(aj, ".set-row .sr-lb, .set-row .sr-val"), "palabras partidas en dos renglones").toEqual([]);
    });
  });
}

test("Perfil: Hogar en una línea, sin párrafo, «Ir a Ajustes» con flecha y la cabecera de Ajustes", async ({ page }) => {
  await abre(page);
  await page.locator(".v4-avatar").click();
  const perfil = page.locator(".profile-pull.open");
  await expect(perfil).toBeVisible({ timeout: 5_000 });
  // Se mide con el panel ya abierto del todo: mientras crece desde el avatar va escalado.
  await expect(perfil).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)", { timeout: 3_000 });
  await expect(perfil.locator(".profile-row", { hasText: "Hogar compartido" })).toHaveCount(1);
  await expect(perfil.getByText(/Hogar, pareja|Estos datos viven/)).toHaveCount(0);
  const ir = perfil.locator('.profile-row[data-act="perfil-ajustes"]');
  await expect(ir).toHaveText(/Ir a Ajustes/);
  await expect(ir.locator(".pr-chev")).toHaveCount(1);
  const m = await perfil.locator(".profile-pull-h").evaluate((el) => {
    const b = el.querySelector(".back").getBoundingClientRect(), h = el.querySelector("h1").getBoundingClientRect(), a = el.querySelector(".profile-av").getBoundingClientRect();
    const cs = getComputedStyle(el.querySelector(".back"));
    return { w: b.width, h: b.height, radio: cs.borderRadius, back: b.top + b.height / 2, av: a.top + a.height / 2, avH: a.height,
      fuente: getComputedStyle(el.querySelector("h1")).fontFamily, h1: h.top };
  });
  expect(m.w).toBeGreaterThanOrEqual(44);
  expect(m.h).toBeGreaterThanOrEqual(44);
  expect(m.radio).toBe("50%");
  expect(m.fuente).toMatch(/Fraunces/);
  expect(Math.abs(m.av - m.back), "avatar a la altura del botón").toBeLessThan(2);
  expect(m.avH).toBeLessThanOrEqual(44);
  await ir.click();
  await expect(page.locator(".settings-push.open")).toBeVisible({ timeout: 5_000 });
  expect(await page.locator(".settings-push-h .back").evaluate((b) => getComputedStyle(b).borderRadius)).toBe("50%");
});

test("Con Ajustes abierto el aviso va abajo, no encima de las filas", async ({ page }) => {
  await abre(page);
  const aj = await abreAjustes(page);
  await aj.locator(".set-sub > .set-row", { has: page.locator(".sr-lb", { hasText: /^Dinero$/ }) }).click();
  await aj.locator(".set-row", { hasText: "Moneda en pantalla" }).click();
  await aj.locator(".set-exp button", { hasText: "Euro" }).first().click();
  const aviso = page.locator(".toast");
  await expect(aviso).toBeVisible();
  await expect(aviso).toHaveClass(/toast-low/);
  const r = await aviso.boundingBox();
  const alto = page.viewportSize().height;
  expect(alto - (r.y + r.height), "pegado abajo").toBeLessThan(40);
});
