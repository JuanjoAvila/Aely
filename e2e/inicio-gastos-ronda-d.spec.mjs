import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, estadoHeredado } from "./fixtures.mjs";

/* Ronda D (18/11/2026), lo que se ve y se toca en Inicio y Gastos:
   · «Para revisar» de Inicio: cada fila lleva a Plan › Recibos (F-07; antes no hacía nada).
   · Deslizar desde el buscador de Gastos cambia de pestaña si no se está escribiendo (R-12): con
     «Mi ciclo» el buscador cae justo a la altura donde se desliza y el gesto se perdía.
   · «Últimos movimientos» no corta el nombre con «…»: baja a una segunda línea (D-03).
   · Dianas de 44 px de PANTALLA con la letra «Normal», que va con `zoom` .92 (D-01).
   · Las cifras de Categorías van en Fraunces, como las de Movimientos (D-04). */
test.use({ serviceWorkers: "block" });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
// Largo de verdad (no cabe en una línea a 360) pero de los que caben en dos, que es el tope: más
// allá la fila se corta a propósito (ver `.v4-section[data-testid="inicio-recent"] .v4-mov .nm`).
const LARGO = "Cafetería Restaurante La Esquina";

// Con letra Enorme a 360: el nombre del gate («Supermerc / ados…»), una palabra larga de verdad.
const ENORME = "Supermercados Masymas Benimaclet";
function estado(letra = "small") {
  const b = estadoHeredado("2026-09-26");
  return {
    ...b,
    obAccounts: b.obAccounts.map((o) => ({ ...o, key: o.id })),
    expenses: [...b.expenses, { id: "lg1", date: "2026-09-26T09:00:00Z", amount: 63.4, ent: "sabadell", category: "super", merchant: LARGO },
      { id: "lg2", date: "2026-09-26T10:00:00Z", amount: 18.75, ent: "sabadell", category: "super", merchant: ENORME }],
    // Recibos de días ya pasados y sin cargo: salen en «Para revisar».
    fixed: [
      { id: "fx-luz", name: "Luz ficticia", amount: 54.3, freq: "mes", day: 4, account: "sabadell" },
      { id: "fx-gym", name: "Gimnasio ficticio", amount: 29.9, freq: "mes", day: 20, account: "sabadell" },
    ],
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
async function deslizaDesde(page, cdp, x, y) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - (x - 20) * i / 12, y }] });
    await delay(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(800);
}

test("«Para revisar» de Inicio: tocar una fila abre Plan › Recibos", async ({ page }) => {
  await abre(page);
  const fila = page.locator('.page-scroll-host [data-testid="inicio-revisar-fila"]').first();
  await expect(fila).toBeVisible();
  await expect(fila).toHaveJSProperty("tagName", "BUTTON");
  await fila.click();
  await expect.poll(() => activa(page)).toBe("plan");
  await expect(page.locator('.page-scroll-host .v4-seg-btn[data-seg="recibos"]').first()).toHaveAttribute("aria-selected", "true");
});

test("Gastos: deslizar desde el buscador cambia de pestaña; escribiendo, no", async ({ page }) => {
  await abre(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect.poll(() => activa(page)).toBe("gastos");
  const caja = await page.locator(".page-scroll-host .gx-root .searchbar").boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(caja.x + caja.width - 40), y = Math.round(caja.y + caja.height / 2);
  // Con el cursor dentro el dedo es del texto: no cambia de pestaña.
  await page.locator(".page-scroll-host .gx-root .searchbar-in").focus();
  await deslizaDesde(page, cdp, x, y);
  expect(await activa(page)).toBe("gastos");
  await page.locator(".page-scroll-host .gx-root .searchbar-in").blur();
  await deslizaDesde(page, cdp, x, y);
  await expect.poll(() => activa(page)).toBe("plan");
});

test("Inicio: un nombre largo en «Últimos movimientos» baja de línea en vez de cortarse", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await abre(page);
  const nm = page.locator('.page-scroll-host [data-testid="inicio-recent"] .v4-mov .nm').filter({ hasText: LARGO });
  await expect(nm).toHaveCount(1);
  const m = await nm.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, alto: el.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(el).lineHeight) }));
  expect(m.sw).toBeLessThanOrEqual(m.cw + 1);
  expect(m.sh).toBeLessThanOrEqual(m.ch + 1);
  expect(m.alto).toBeGreaterThan(m.lh * 1.5);
});

test("Dianas de 44 px de pantalla con letra Normal y cifras de Categorías en Fraunces", async ({ page }) => {
  await abre(page);
  // Un toque a 21 px de PANTALLA del centro de «1M/3M/Todo» y de «Ver todo» sigue cayendo en el botón.
  const cae = (sel) => page.evaluate((sel) => {
    const el = document.querySelector(".page-scroll-host " + sel); el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // Con `zoom` en <body> los rectángulos ya vienen en px de pantalla.
    return [cy - 21, cy + 21].map((y) => { const t = document.elementFromPoint(cx, y); return !!t && (t === el || el.contains(t)); });
  }, sel);
  expect(await cae(".v42-net-ranges button")).toEqual([true, true]);
  expect(await cae('[data-testid="inicio-recent"] .v4-section-h button.link')).toEqual([true, true]);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator('.page-scroll-host .gx-root [role="tab"][data-gx-tab="cats"]').click();
  const fam = await page.locator(".page-scroll-host .gx-cat .v4-gastos-cat-amt").first().evaluate((el) => getComputedStyle(el).fontFamily);
  expect(fam).toContain("Fraunces");
});

/* Gate de la ronda D: con Enorme a 360 «Supermercados» salía partido a mitad («Supermerc / ados…»).
   Ninguna palabra de «Últimos movimientos» ni de Categorías puede quedar en dos renglones: se mira
   con rangos de texto, palabra a palabra (un rango partido da dos rectángulos a distinta altura). */
const partidas = (page, sel) => page.evaluate((sel) => {
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const re = /[\p{L}\p{N}][\p{L}\p{N}.,'’]*/gu; let m;
      while ((m = re.exec(n.textContent))) {
        if (m[0].length < 3) continue;
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const rs = [...r.getClientRects()].filter((x) => x.width > 0);
        if (rs.length > 1 && Math.abs(rs[0].top - rs[rs.length - 1].top) > 3) out.push(m[0]);
      }
    }
  }
  return out;
}, sel);

test("Enorme a 360: ninguna palabra partida en «Últimos movimientos» ni en Categorías", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await abre(page, "huge");
  const filas = '.page-scroll-host [data-testid="inicio-recent"] .v4-mov';
  await expect(page.locator(filas).filter({ hasText: "Masymas" })).toHaveCount(1);
  expect(await partidas(page, filas)).toEqual([]);
  // El nombre largo, entero: sin «…» (cabe en dos renglones con el importe abajo).
  const nm = await page.locator(filas + " .nm").filter({ hasText: "Masymas" }).evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
  expect(nm.sh).toBeLessThanOrEqual(nm.ch + 1);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator('.page-scroll-host .gx-root [role="tab"][data-gx-tab="cats"]').click();
  await expect(page.locator(".page-scroll-host .gx-cat").first()).toBeVisible();
  expect(await partidas(page, ".page-scroll-host .gx-cat .v4-gastos-cat-row")).toEqual([]);
  const cortados = await page.evaluate(() => [...document.querySelectorAll(".page-scroll-host .gx-cat .v4-gastos-cat-name")].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent));
  expect(cortados).toEqual([]);
});
