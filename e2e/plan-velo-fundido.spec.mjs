import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* El velo de las hojas de Plan nacía ya al 28 % en el primer fotograma, con la hoja todavía
   abajo: la pastilla verde de Recibos se apagaba de golpe (1/11/2026). El tinte vive en el
   ::before y lo que se anima es su opacity (el compositor). Este guardián la cuenta fotograma
   a fotograma con requestAnimationFrame. Sin el fundido solo hay un valor y cae. Cerrar a
   mitad de la entrada tiene que fundir desde la opacidad que se ve: si se quita la congelación
   de useSheetSwipe, la animación de entrada sigue y el velo salta. */
const YM = 2026 * 12 + 10;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const cuenta = [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }];
const recibo = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const mama = { id: "mama", name: "Mamá", monthly: 197, amort: 250, value: 5000, account: "sabadell", day: 20, asOf: YM - 1 };
const pepe = recibo("pepe", "Pepephone", 22, 20, { bankAmount: 85, reparto: [
  { id: "pe_pareja", n: "Pareja", via: "bizum", amt: 10 }, { id: "pe_fam", n: "Familia", via: "debt", debtId: "mama", amt: 53 }] });
const luz = recibo("luz", "Luz", 50, 19);

async function abre(page) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-18T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, {
    __seedOnce: true, lastBackup: "2026-10-18", bankTx: [], debts: [mama], flows: [], oneoffs: [], expenses: [],
    settings, accounts: cuenta, fixed: [pepe, luz],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.getByTestId("plan-llega")).toBeVisible();
}

async function frenar(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return cdp;
}

/* Clic en el mismo turno que arma el rAF: el de Playwright sondea el DOM y se come los
   fotogramas del fundido. El primer callback ya ve el velo recién montado. */
async function grabar(page, kind) {
  const budget = kind === "mitad" ? 1400 : 900;
  await page.evaluate(({ kind, budget }) => {
    /* Opacidad del elemento que de verdad funde: el ::before. En el bundle anterior no hay
       ::before y el velo es el alfa del background del padre (sale de golpe a 0,28). */
    const alfaVelo = (bk) => {
      if (!bk) return null;
      const b = getComputedStyle(bk, "::before");
      if (b && b.content !== "none" && b.content !== "normal") {
        const op = parseFloat(b.opacity);
        if (!isNaN(op)) return op;
      }
      const c = getComputedStyle(bk).backgroundColor.match(/[\d.]+/g);
      if (!c) return null;
      const n = c.map(Number);
      return n.length > 3 ? n[3] : 1;
    };
    const frames = window.__velo = [];
    const t0 = performance.now();
    (function frame() {
      const backs = document.querySelectorAll(".v4-sheet-back");
      const bk = backs.length ? backs[backs.length - 1] : null;
      const sh = bk && bk.querySelector(":scope > .v4-sheet");
      const btn = document.querySelector(".v4-screen .v4-seg-btn.on");
      const bs = btn ? getComputedStyle(btn) : null;
      const ps = btn && btn.parentElement ? getComputedStyle(btn.parentElement) : null;
      const a = bk ? alfaVelo(bk) : null;
      frames.push({
        t: performance.now() - t0, a, y: sh ? sh.getBoundingClientRect().top : null,
        filter: bs ? bs.filter : null, z: bs ? bs.zIndex : null,
        pfilter: ps ? ps.filter : null, pz: ps ? ps.zIndex : null,
      });
      if (kind === "mitad" && bk && window.__veloCut == null && a != null) {
        const vivos = frames.filter((f) => f.a != null);
        const primero = vivos[0].a;
        // A mitad de la subida: ya se ha oscurecido un poco y la entrada no ha terminado.
        if (vivos.length >= 3 && a >= 0.15 && a <= 0.62 && a > primero + 0.05) {
          window.__veloCut = frames.length - 1;
          frames[frames.length - 1].cut = true;
          bk.click();
        }
      }
      if (performance.now() - t0 < budget) requestAnimationFrame(frame);
    })();
    if (kind === "llega" || kind === "mitad") document.querySelector('[data-testid="plan-llega"]').click();
    else if (kind === "deben") document.querySelector('[data-testid="plan-deben"]').click();
    else if (kind === "pend") document.querySelector('[data-recibo="fixed_luz"]').click();
    else if (kind === "todos") {
      const b = [...document.querySelectorAll('[data-testid="plan-due"] button')].find((x) => x.textContent.trim() === "Todos");
      b.click();
    } else if (kind === "bill") document.querySelector('[data-bill-id="luz"]').click();
    else if (kind === "close") {
      const backs = document.querySelectorAll(".v4-sheet-back");
      backs[backs.length - 1].click();
    }
  }, { kind, budget });
  // Espera de Playwright, no un timer de la página: el reloj fijo del test no tiene que avanzarlo.
  await page.waitForTimeout(budget + 80);
  return page.evaluate(() => window.__velo);
}

function vivos(frames) { return frames.filter((f) => f.a != null && f.y != null); }

function barraQuieta(frames, label) {
  for (const f of frames) {
    if (f.filter == null) continue;
    expect(f.filter, label + " la pastilla no gana un filter").toBe("none");
    expect(f.z, label + " la pastilla no cambia de z-index").toBe("auto");
    expect(f.pfilter, label + " la barra no gana un filter").toBe("none");
    expect(f.pz, label + " la barra no cambia de z-index").toBe("auto");
  }
}

function exigeEntrada(frames, label) {
  const live = vivos(frames);
  expect(live.length, label).toBeGreaterThan(6);
  const alphas = live.map((f) => f.a);
  // Opacity 0→1. Sin el arreglo (o en el bundle anterior) el primer valor ya es el único:
  // 0,28 del background, y el máximo no llega a 1.
  expect(alphas[0], label + " el primer fotograma ya está oscuro").toBeLessThan(Math.max(...alphas) * 0.75);
  expect(new Set(alphas.map((a) => a.toFixed(2))).size, label + " el velo entra en varios fotogramas").toBeGreaterThanOrEqual(4);
  expect(Math.max(...alphas), label + " la opacidad del velo llega a cubierto").toBeGreaterThan(0.85);
  for (let i = 1; i < alphas.length; i++) expect(alphas[i], label + " el velo no se aclara al entrar").toBeGreaterThanOrEqual(alphas[i - 1] - 0.03);
  const reposo = Math.min(...live.map((f) => f.y));
  const medio = live.find((f) => f.a >= 0.2 && f.a <= 0.7);
  expect(medio, label + " hay un fotograma a medio fundido").toBeTruthy();
  expect(medio.y, label + " el fundido acompaña a la subida").toBeGreaterThan(reposo + 24);
  barraQuieta(frames, label);
}

function exigeSalida(frames, label) {
  const live = vivos(frames);
  expect(frames[frames.length - 1].a, label + " la hoja se desmonta").toBeNull();
  expect(live.length, label).toBeGreaterThan(6);
  const alphas = live.map((f) => f.a);
  expect(new Set(alphas.map((a) => a.toFixed(2))).size, label + " el velo sale en varios fotogramas").toBeGreaterThanOrEqual(4);
  expect(alphas[alphas.length - 1], label + " el velo ya se ha ido al desmontar").toBeLessThanOrEqual(0.03);
  for (let i = 1; i < alphas.length; i++) expect(alphas[i], label + " el velo no se oscurece al salir").toBeLessThanOrEqual(alphas[i - 1] + 0.03);
  const medio = live.find((f) => f.a <= 0.55 && f.a >= 0.08);
  expect(medio, label + " hay un fotograma a medio fundido").toBeTruthy();
  expect(medio.y, label + " el fundido acompaña a la bajada").toBeGreaterThan(live[0].y + 20);
  barraQuieta(frames, label);
}

async function hojaQuieta(page) {
  await page.waitForFunction(() => {
    const backs = document.querySelectorAll(".v4-sheet-back");
    const sh = backs.length && backs[backs.length - 1].querySelector(":scope > .v4-sheet");
    return !!sh && getComputedStyle(sh).transform === "none";
  }, null, { timeout: 8_000 });
}

test("¿Te llega?: el velo entra y sale con la hoja, y la pastilla no cambia de capa", async ({ page }) => {
  await abre(page);
  const cdp = await frenar(page);
  try {
    const entra = await grabar(page, "llega");
    exigeEntrada(entra, "Te llega");
    await hojaQuieta(page);
    // La pastilla verde se ve a través del velo: quien recibe el toque es el velo, no la barra.
    const tapa = await page.evaluate(() => {
      const b = document.querySelector(".v4-screen .v4-seg-btn.on");
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!(hit && hit.closest && hit.closest(".v4-sheet-back"));
    });
    expect(tapa, "el velo cubre la pastilla de Recibos").toBe(true);
    const sale = await grabar(page, "close");
    exigeSalida(sale, "Te llega");
  } finally {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
});

test("Te deben: el velo entra y sale con la hoja", async ({ page }) => {
  await abre(page);
  const cdp = await frenar(page);
  try {
    exigeEntrada(await grabar(page, "deben"), "Te deben");
    await hojaQuieta(page);
    exigeSalida(await grabar(page, "close"), "Te deben");
  } finally {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
});

test("Pendiente: la ficha del recibo funde el velo al abrir y al cerrar", async ({ page }) => {
  await abre(page);
  const cdp = await frenar(page);
  try {
    exigeEntrada(await grabar(page, "pend"), "Pendiente");
    await hojaQuieta(page);
    exigeSalida(await grabar(page, "close"), "Pendiente");
  } finally {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
});

test("Todos: la ficha de un recibo funde el velo al abrir y al cerrar", async ({ page }) => {
  await abre(page);
  await page.locator('[data-testid="plan-due"]').getByRole("button", { name: "Todos" }).click();
  await expect(page.locator("[data-bills-manage]")).toBeVisible();
  await page.locator('[data-group="serv"]').click();
  await expect(page.locator('[data-bill-id="luz"]')).toBeVisible();
  const cdp = await frenar(page);
  try {
    exigeEntrada(await grabar(page, "bill"), "Todos");
    await hojaQuieta(page);
    exigeSalida(await grabar(page, "close"), "Todos");
  } finally {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
});

function exigeMitad(frames, label) {
  const cut = frames.findIndex((f) => f.cut);
  expect(cut, label + " se cerró con la entrada a medias").toBeGreaterThan(0);
  const before = frames.slice(0, cut + 1).filter((f) => f.a != null && f.y != null);
  const after = frames.slice(cut + 1).filter((f) => f.a != null && f.y != null);
  expect(before.length, label).toBeGreaterThan(2);
  const sube = before.map((f) => f.a);
  // En la base el alfa nace en 0,28 y no se mueve: no hay rampa antes del cierre.
  expect(sube[0], label + " la entrada ya iba cubierta").toBeLessThan(0.5);
  expect(new Set(sube.map((a) => a.toFixed(2))).size, label + " la entrada no tiene varios fotogramas").toBeGreaterThanOrEqual(3);
  expect(sube[sube.length - 1], label + " se cerró demasiado tarde").toBeLessThan(0.7);
  expect(sube[sube.length - 1], label + " el velo no había empezado a entrar").toBeGreaterThan(sube[0] + 0.05);
  // El mínimo de toda la toma es el punto de corte: a partir de ahí la hoja baja, así que
  // no sirve de reposo. Se mira cuánto había subido ya respecto al primer fotograma.
  const y0 = before[0].y, yC = before[before.length - 1].y;
  expect(y0 - yC, label + " la hoja no había empezado a subir").toBeGreaterThan(20);
  expect(yC, label + " la hoja ya estaba arriba").toBeGreaterThan(y0 * 0.55);
  expect(after.length, label + " no hubo fotogramas de salida").toBeGreaterThan(6);
  const baja = after.map((f) => f.a);
  const enElCorte = sube[sube.length - 1];
  // Sin congelar, la animación sigue hacia 1 o el valor cae de golpe a 0.
  expect(baja[0], label + " al cerrar la opacidad salta").toBeGreaterThan(enElCorte - 0.12);
  expect(baja[0], label + " al cerrar la opacidad sube del tirón").toBeLessThan(enElCorte + 0.08);
  expect(new Set(baja.map((a) => a.toFixed(2))).size, label + " la salida no tiene varios fotogramas").toBeGreaterThanOrEqual(4);
  for (let i = 1; i < baja.length; i++) {
    expect(baja[i], label + " el velo se oscurece al salir").toBeLessThanOrEqual(baja[i - 1] + 0.03);
    expect(baja[i - 1] - baja[i], label + " el velo salta de opacidad en un fotograma").toBeLessThan(0.22);
  }
  expect(baja[baja.length - 1], label + " el velo no llega a irse").toBeLessThanOrEqual(0.05);
  expect(frames[frames.length - 1].a, label + " la hoja se desmonta").toBeNull();
  const medio = after.find((f) => f.a <= enElCorte * 0.7 && f.a >= 0.04);
  expect(medio, label + " no hay un fotograma a medio fundido").toBeTruthy();
  expect(medio.y, label + " el fundido no acompaña a la bajada").toBeGreaterThan(after[0].y + 16);
}

test("cerrar a mitad de la entrada funde desde la opacidad que se ve", async ({ page }) => {
  await abre(page);
  const frames = await grabar(page, "mitad");
  exigeMitad(frames, "A mitad");
});

test("con prefers-reduced-motion el velo no se funde: aparece y se va en el acto", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await abre(page);
  const entra = await grabar(page, "llega");
  const vivosEntra = entra.filter((f) => f.a != null);
  expect(vivosEntra.length).toBeGreaterThan(0);
  expect(vivosEntra[0].a).toBeGreaterThan(0.2);
  expect(new Set(vivosEntra.map((f) => f.a.toFixed(2))).size).toBeLessThan(3);
  await hojaQuieta(page);
  const sale = await grabar(page, "close");
  const vivosSale = sale.filter((f) => f.a != null);
  // Sin fundido, el cierre desmonta antes del fotograma siguiente o en un par de ellos.
  expect(vivosSale.length).toBeLessThan(4);
  if (vivosSale.length >= 2) expect(vivosSale[vivosSale.length - 1].t - vivosSale[0].t).toBeLessThan(80);
});
