import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, estadoHeredado } from "./fixtures.mjs";

/* Inicio, 19/11/2026 (dueño):
   · Tocar un recibo de «Próximos cargos» lleva a Plan › Recibos y abre SU ficha; un movimiento de
     «Últimos movimientos», a Gastos con su ficha abierta; una meta, a Plan › Metas con la suya.
   · Mantener pulsado no marca nada: el WebView, al pulsar largo sobre algo no seleccionable,
     seleccionaba el texto seleccionable más cercano (el título de «Últimos movimientos», las metas).
     La pulsación larga nativa no existe en Chromium de escritorio; se comprueba la condición que la
     permite (`user-select`) en TODA la pantalla y que un triple clic no deja selección.
   · «Últimos movimientos» con la misma fila que «Próximos cargos»: letra, relleno y columna. */
test.use({ serviceWorkers: "block" });

function estado(letra = "small") {
  const b = estadoHeredado("2026-09-26");
  return {
    ...b,
    obAccounts: b.obAccounts.map((o) => ({ ...o, key: o.id })),
    expenses: [...b.expenses, { id: "mv-cafe", date: "2026-09-26T09:30:00Z", amount: 3.2, ent: "sabadell", category: "super", merchant: "Cafetería ficticia" }],
    fixed: [
      { id: "fx-agua", name: "Agua ficticia", amount: 21.5, freq: "mes", day: 28, account: "sabadell" },
      { id: "fx-tel", name: "Teléfono ficticio", amount: 15, freq: "mes", day: 29, account: "sabadell" },
    ],
    goals: [{ id: "g-viaje", name: "Viaje ficticio", emoji: "✈️", target: 1000, saved: 250 }, { id: "g-colchon", name: "Colchón ficticio", emoji: "🛟", target: 3000, saved: 900 }],
    settings: { ...b.settings, lang: "es", textSize: letra },
  };
}
async function abre(page, letra) {
  await installFixtureClock(page);
  await seedLoggedInDashboard(page, { __seedOnce: true, ...estado(letra) });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}
const activa = (page) => page.evaluate(() => document.querySelector(".botnav-tab.active")?.dataset.tour);
const inicio = (page) => page.locator(".page-scroll-host .v4-inicio").first();
const hojaCon = (page, texto) => page.locator('[role="dialog"]:visible').filter({ hasText: texto });

test("tocar un recibo abre su ficha en Plan › Recibos", async ({ page }) => {
  await abre(page);
  const fila = inicio(page).locator('[data-testid="inicio-upcoming"] [data-inicio-recibo="fixed_fx-tel"]');
  await expect(fila).toHaveAttribute("role", "button");
  await fila.click();
  await expect.poll(() => activa(page)).toBe("plan");
  await expect(page.locator('.page-scroll-host .v4-seg-btn[data-seg="recibos"]').first()).toHaveAttribute("aria-selected", "true");
  await expect(hojaCon(page, "Teléfono ficticio")).toHaveCount(1);
});

test("tocar un movimiento abre su ficha en Gastos", async ({ page }) => {
  await abre(page);
  const fila = inicio(page).locator('[data-testid="inicio-recent"] [data-inicio-gasto="mv-cafe"]');
  await expect(fila).toHaveAttribute("role", "button");
  await fila.click();
  await expect.poll(() => activa(page)).toBe("gastos");
  const hoja = page.locator(".v4-exp-sheet:visible");
  await expect(hoja).toHaveCount(1);
  // La de ESE movimiento: su importe (el comercio va en un campo editable).
  await expect(hoja).toContainText("3,20");
});

test("tocar una meta la centra y abre su ficha en Plan › Metas", async ({ page }) => {
  await abre(page);
  await inicio(page).locator('.v4-goal[data-inicio-meta="g-colchon"]').click();
  await expect.poll(() => activa(page)).toBe("plan");
  await expect(page.locator('.page-scroll-host .v4-seg-btn[data-seg="metas"]').first()).toHaveAttribute("aria-selected", "true");
  const hoja = page.locator('[role="dialog"]:visible');
  await expect(hoja).toHaveCount(1);
  await expect(hoja.locator("input").first()).toHaveValue("Colchón ficticio");
});

test("mantener pulsado en Inicio no deja nada seleccionable ni seleccionado", async ({ page }) => {
  await abre(page);
  const raiz = inicio(page);
  await expect(raiz.locator('[data-testid="inicio-recent"] .v4-mov')).not.toHaveCount(0);
  const sueltos = await raiz.evaluate((r) => [r, ...r.querySelectorAll("*")]
    .filter((el) => !/^(INPUT|TEXTAREA)$/.test(el.tagName))
    .filter((el) => { const cs = getComputedStyle(el); return cs.userSelect !== "none" || cs.webkitTouchCallout === "default"; })
    .map((el) => el.tagName + "." + el.className).slice(0, 5));
  expect(sueltos).toEqual([]);
  // Lo que antes se seleccionaba: los títulos de sección (no navegan al tocarlos).
  for (const sel of ['[data-testid="inicio-upcoming"] .v4-section-h > span', '[data-testid="inicio-recent"] .v4-section-h > span']) {
    await raiz.locator(sel).first().click({ clickCount: 3 });
    expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
  }
  expect(await activa(page)).toBe("inicio");
});

// Con Enorme a 360 también: los cargos bajan el importe a la línea gris como los movimientos (si no,
// el nombre del recibo se partía en dos o tres líneas y la fila medía 113 px contra 86).
for (const [letra, ancho] of [["small", 360], ["small", 412], ["huge", 360], ["huge", 412]]) {
  test(`«Últimos movimientos» con la misma fila que «Próximos cargos» (${letra}, ${ancho})`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 2000 });
    await abre(page, letra);
    const m = await inicio(page).evaluate((r) => {
      const fila = (sel) => {
        const el = r.querySelector(sel), cs = getComputedStyle(el);
        const f = (s) => { const x = el.querySelector(s), c = getComputedStyle(x); return c.fontSize + "/" + c.fontWeight; };
        return { pad: cs.paddingTop, nm: f(".nm"), lh: getComputedStyle(el.querySelector(".nm")).lineHeight, sub: f(".sub,.meta"), am: f(":scope > .am"),
          card: getComputedStyle(el.parentElement).paddingLeft, lead: Math.round(el.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(el.firstElementChild).marginLeft) * 2),
          // Una fila de una línea de nombre; la de movimientos lleva su raya abajo y la primera de cargos no.
          h: el.getBoundingClientRect().height - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth) };
      };
      return { c: fila('[data-testid="inicio-upcoming"] .v4-charge'), m: fila('[data-testid="inicio-recent"] .v4-mov') };
    });
    const { h: hc, lead: lc, ...c } = m.c, { h: hm, lead: lm, ...mv } = m.m;
    expect(mv).toEqual(c);
    expect(Math.abs(lm - lc)).toBeLessThanOrEqual(6);
    expect(Math.abs(hm - hc)).toBeLessThanOrEqual(2);
  });
}
