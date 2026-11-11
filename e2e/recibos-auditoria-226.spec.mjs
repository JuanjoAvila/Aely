import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Auditoría de Recibos 4.26.226 (10/11/2026). Datos inventados.
   - P1-1: en Editar › «Más opciones», «Prueba gratis» y «Permanencia» se abrían bajo «Guardar».
   - P1-2: lo marcado «Lo pagué de otra forma» seguía en Inicio como «Cargos vencidos».
   - Buscar en Tus recibos por lo que cobra el banco en un compartido («29,94»). */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const YM = 2026 * 12 + 11;
const r = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra);
const fixed = [
  r("alq", "Alquiler", 850, 1),
  r("gym", "Gimnasio", 39.9, 2, { pagadoAMano: { [YM]: 2 } }),
  r("spo", "Spotify", 10.99, 2, { account: "revolut" }),
  r("bas", "Basuras", 90, 14),
  r("pepe", "Pepephone", 22, 20, { bankAmount: 32, reparto: [{ id: "pe_pareja", n: "Pareja", via: "bizum", amt: 10 }] }),
  r("yt", "YouTube Premium", 4.99, 22, { bankAmount: 29.94, reparto: [{ id: "pe_pareja", n: "Pareja", via: "bizum", amt: 4.99 },
    { id: "pe_dani", n: "Dani", via: "transfer", amt: 4.99 }, { id: "pe_lu", n: "Lucía", via: "transfer", amt: 4.99 },
    { id: "pe_pa", n: "Papá", via: "transfer", amt: 4.99 }, { id: "pe_ma", n: "Mamá", via: "transfer", amt: 4.99 }] }),
];

async function abre(page, vp) {
  test.info().annotations.push({ type: "own-clock" });
  if (vp) await page.setViewportSize(vp);
  await page.clock.install({ time: new Date("2026-11-10T12:00:00+01:00") });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-11-10", settings, fixed, debts: [], flows: [], oneoffs: [], expenses: [], bankTx: [],
    accounts: [{ id: "s", ent: "sabadell", role: "fijos", value: 1800 }, { id: "rv", ent: "revolut", role: "fijos", value: 200 }] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}
const aPlan = async (page) => {
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
};

const H = '.v4-sheet[data-sheet="recibo-pasos"]';
// Que se vea entero por encima de «Guardar» y que un toque en su centro le caiga a él.
const aLaVista = (page, sel) => page.evaluate(([H, sel]) => {
  const x = document.querySelector(H + " " + sel), cta = document.querySelector(H + " .rp4-cta");
  if (!x || !cta) return "falta";
  const b = x.getBoundingClientRect(), c = cta.getBoundingClientRect(), body = document.querySelector(H + " .rp4-body").getBoundingClientRect();
  const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  return b.bottom <= c.top && b.top >= body.top && (el === x || x.contains(el)) ? "ok" : { top: b.top, bottom: b.bottom, cta: c.top };
}, [H, sel]);

for (const vp of [{ width: 412, height: 915 }, { width: 412, height: 800 }, { width: 360, height: 700 }]) {
  test(`Más opciones: Prueba gratis y Permanencia abren a la vista, sobre «Guardar» (${vp.width}×${vp.height})`, async ({ page }) => {
    await abre(page, vp);
    const recibos = await aPlan(page);
    await recibos.getByTestId("plan-due").locator('[data-recibo="fixed_bas"]').click();
    await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
    const hoja = page.locator(H);
    await expect(hoja).toHaveAttribute("data-modo", "edit");
    await hoja.locator('[data-rp4-paso="4"] [data-act="mas-opciones"]').click();
    await expect.poll(() => aLaVista(page, '[data-rp7="prueba"] .rp7-row')).toBe("ok");
    // Un clic del propio navegador, sin que Playwright desplace nada antes de tocar.
    await page.evaluate((H) => document.querySelector(H + ' [data-rp7="prueba"] .rp7-row').click(), H);
    await expect.poll(() => aLaVista(page, '[data-rp7="prueba"] [data-rp7-chip="mes"]')).toBe("ok");
    await expect.poll(() => aLaVista(page, '[data-rp7="prueba"] [data-rp7-fecha="prueba"]')).toBe("ok");
    await page.evaluate((H) => document.querySelector(H + ' [data-rp7="perm"] .rp7-row').click(), H);
    await expect.poll(() => aLaVista(page, '[data-rp7="perm"] [data-rp7-chip="ano"]')).toBe("ok");
    await expect.poll(() => aLaVista(page, '[data-rp7="perm"] [data-rp7-fecha="perm"]')).toBe("ok");
  });
}

test("lo marcado «Lo pagué de otra forma» no sale en Inicio como vencido, igual que en Recibos", async ({ page }) => {
  await abre(page, { width: 412, height: 915 });
  const vencidos = page.locator(".page-scroll-host .v4-section").filter({ hasText: "Cargos vencidos" });
  // Spotify (día 2, sin cargo) está vencido; el Gimnasio está marcado a mano: no.
  await expect(vencidos).toContainText("Spotify");
  await expect(vencidos).not.toContainText("Gimnasio");
  const recibos = await aPlan(page);
  await recibos.getByTestId("plan-review").locator('[data-recibo="fixed_spo"]').click();
  const ficha = page.locator('.v4-sheet[data-sheet="recibo"]');
  await ficha.locator('[data-act="pagado"]').click();
  await ficha.locator('[data-act="a-mano"]').click();
  await expect(ficha).toHaveCount(0);
  const pagados = recibos.getByTestId("plan-paid");
  await pagados.locator(".pr6-paid-h").click();
  await expect(pagados.locator('[data-recibo="fixed_spo"]')).toContainText("marcado a mano");
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  // Sin ningún otro vencido, la sección desaparece.
  await expect(page.locator(".page-scroll-host .v4-section").filter({ hasText: "Cargos vencidos" })).toHaveCount(0);
});

test("Tus recibos encuentra un compartido por lo que cobra el banco («29,94»)", async ({ page }) => {
  await abre(page, { width: 412, height: 915 });
  const recibos = await aPlan(page);
  await recibos.getByTestId("plan-todos").click();
  const q = page.locator("input[data-bills-search]");
  for (const s of ["29,94", "29.94"]) {
    await q.fill(s);
    await expect(page.locator("[data-bills-manage]")).toContainText("YouTube Premium");
  }
  await q.fill("4,99");
  await expect(page.locator("[data-bills-manage]")).toContainText("YouTube Premium");
});

/* Vídeo del 11/11: al tocar «Más opciones» el pliegue se abría, la hoja se quedaba quieta y ~0,4 s después
   daba un segundo empujón hacia arriba; al cerrarlo caía de golpe en dos o tres fotogramas. La hoja tiene
   que acompañar al pliegue: un solo movimiento al abrir y una bajada repartida al cerrar. */
test("Más opciones: la hoja acompaña al pliegue al abrir y al cerrar, sin pausa ni caída de golpe", async ({ page }) => {
  test.info().annotations.push({ type: "own-clock" });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.route("**/*", (x) => new URL(x.request().url()).hostname === "127.0.0.1" ? x.continue() : x.abort());
  const reparto = [["pe_pol", "Pol"], ["pe_alex", "Alex"], ["pe_gis", "Gis"], ["pe_iya", "Iyari"], ["pe_car", "Carlos"], ["pe_mam", "Mamá"]]
    .map(([id, n]) => ({ id, n, via: "bizum", amt: 1 }));
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-11-10", settings, debts: [], flows: [], oneoffs: [], expenses: [], bankTx: [],
    fixed: [r("bas", "Basuras", 90, 14), r("pepe", "Pepephone", 22, 20, { bankAmount: 28, reparto })],
    accounts: [{ id: "s", ent: "sabadell", role: "fijos", value: 1800 }] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  const recibos = await aPlan(page);
  await recibos.locator('[data-recibo="fixed_bas"]').first().click();
  await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
  await expect(page.locator(H)).toHaveAttribute("data-modo", "edit");
  await expect(page.locator(H + ' [data-rp4-paso="4"] [data-act="mas-opciones"]')).toHaveAttribute("aria-expanded", "false");
  await page.waitForTimeout(600);
  // Clic crudo y una muestra por fotograma: scroll del cuerpo y alto de lo que se puede desplazar.
  const graba = () => page.evaluate((H) => new Promise((ok) => {
    const body = document.querySelector(H + " .rp4-body"), btn = document.querySelector(H + ' [data-rp4-paso="4"] [data-act="mas-opciones"]');
    const out = [], t0 = performance.now();
    btn.click();
    const f = () => { out.push({ st: body.scrollTop, sh: body.scrollHeight });
      if (performance.now() - t0 < 1100) requestAnimationFrame(f); else ok(out); };
    requestAnimationFrame(f);
  }), H);
  const abrir = await graba();
  const fin = abrir[abrir.length - 1];
  expect(fin.st).toBeGreaterThan(20);
  // Cuando el pliegue ya ha crecido del todo, la hoja ya ha llegado: nada de empujón posterior.
  const crecido = abrir.findIndex((x) => x.sh >= fin.sh - 1);
  expect(abrir[crecido].st, JSON.stringify(abrir.map((x) => Math.round(x.st)))).toBeGreaterThan(fin.st * 0.8);
  const cerrar = await graba();
  expect(cerrar[cerrar.length - 1].st).toBeLessThan(1);
  // Ningún fotograma se lleva más de la mitad de la bajada.
  const saltos = cerrar.slice(1).map((x, i) => cerrar[i].st - x.st);
  expect(Math.max(...saltos), JSON.stringify(cerrar.map((x) => Math.round(x.st)))).toBeLessThan(fin.st * 0.5);
});
