import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, gastosAbreGasto } from "./fixtures.mjs";

/* REMATE DE LA 235 (petición del dueño, 16/11). Render puro y dinero, medidos en el DOM:
   · Apuntar (gasto e ingreso): el banco se elige con LOGOS que entran en la misma fila del pago, con
     fundido; la fila de categorías no se mueve ni un píxel en ningún fotograma, ninguna caja se pisa
     y la hoja cabe entera a 360×740 y 393×851. Lo elegido se guarda en `ent` como antes.
   · Ficha de un movimiento: el mismo selector; sin la tarjeta «Lo trajo una notificación…», con un
     candado junto al importe, y el importe y el banco del banco siguen bloqueados.
   · Recibo, deuda, meta, nota y retirada son UNA fila de baldosas como las de categoría: abren su
     panel y la nota se guarda igual. Sin frases de ayuda; ✨ junto a «Todas ›».
   · El teclado del importe no está puesto: en uno del banco nunca sale; en uno a mano sube ABAJO, bajo
     las categorías y encima del pie, al tocar el importe, y se recoge al volver a tocarlo o al tocar
     otra cosa. Ninguna baldosa visible pisa el pie (16/11). */
test.use({ hasTouch: true, isMobile: true });

const HOY = new Date().toISOString().slice(0, 10);
const MANO = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const ESTADO = {
  accounts: [
    { id: "sab", ent: "sabadell", name: "Nómina", value: 1500, role: "diario", spendFrom: true },
    { id: "tr", ent: "trade_republic", name: "Cuenta TR", value: 3000 },
    { id: "myi", ent: "myinvestor", name: "Cuenta", value: 800 },
    { id: "ef", ent: "efectivo", name: "El sobre", value: 60, role: "fijos" },
  ],
  settings: { autoPrices: false, theme: "green", expenseBanks: ["sabadell", "trade_republic", "efectivo"] },
};
const guardados = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]"));

async function arranca(page, w, h, extra) {
  await page.setViewportSize({ width: w, height: h });
  await seedLoggedInDashboard(page, Object.assign({}, ESTADO, extra));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}
async function abreApuntar(page) {
  await page.locator(".botnav-fab").click();
  const hoja = page.locator(".v4-exp-sheet");
  await expect(hoja.locator(".v4-keys button")).toHaveCount(12);
  await page.waitForTimeout(450);
  await page.waitForFunction(() => { const s = document.querySelector(".v4-exp-sheet"); return !!s && s.getAnimations().length === 0; });
  return hoja;
}

/* Abre el selector y, fotograma a fotograma durante la apertura, mide: la fila de categorías (o el
   teclado, si no hay) no se mueve, el selector no pisa nada de debajo y la hoja no gana scroll. */
async function abreYMide(page, hoja, prefijo) {
  await hoja.getByTestId(prefijo + "-bank").click();
  return page.evaluate((prefijo) => new Promise((ok) => {
    const sel = '[data-testid="' + prefijo + '-bank-list"]';
    const ref = () => document.querySelector(".v4-exp-sheet .v4-ficha-cats") || document.querySelector(".v4-exp-sheet .v4-keys");
    const y0 = ref().getBoundingClientRect().top;
    const cuerpo = document.querySelector(".v4-exp-sheet .v4-sheet-body");
    const out = { frames: 0, movida: 0, pisa: 0, scroll: 0, sinLista: 0 };
    const t0 = performance.now();
    const paso = () => {
      const l = document.querySelector(sel);
      if (!l) out.sinLista++;
      else {
        const a = l.getBoundingClientRect(), b = ref().getBoundingClientRect();
        if (a.bottom > b.top + 0.5) out.pisa++;
      }
      out.movida = Math.max(out.movida, Math.abs(ref().getBoundingClientRect().top - y0));
      out.scroll = Math.max(out.scroll, cuerpo.scrollTop);
      out.frames++;
      if (performance.now() - t0 < 450) requestAnimationFrame(paso); else ok(out);
    };
    requestAnimationFrame(paso);
  }), prefijo);
}

for (const [w, h] of [[360, 740], [393, 851]]) {
  for (const tipo of ["gasto", "ingreso"]) {
    test(`Apuntar ${tipo} ${w}×${h}: logos en la fila del pago, nada se mueve ni se pisa, y se guarda el banco`, async ({ page }) => {
      await arranca(page, w, h, { expenses: [] });
      const hoja = await abreApuntar(page);
      if (tipo === "ingreso") await hoja.locator(".v4-ficha-head .v4-seg-btn").nth(1).click();
      // La píldora no trunca: en un gasto basta el logo; en un ingreso cabe el nombre entero.
      const pill = hoja.getByTestId("ap-bank");
      await expect(pill.locator("img")).toHaveAttribute("src", /logos\//);
      const nom = await pill.locator(".v4-bank-nom").evaluate((el) => ({ w: el.getBoundingClientRect().width, cortado: el.scrollWidth > el.clientWidth + 1 }));
      if (tipo === "gasto") expect(nom.w, "nombre solo para el lector").toBeLessThanOrEqual(1);
      else expect(nom.cortado, "nombre entero").toBe(false);

      const m = await abreYMide(page, hoja, "ap");
      expect(m.frames).toBeGreaterThan(5);
      expect(m.movida, "la fila de debajo no se mueve al abrir").toBeLessThan(0.5);
      expect(m.pisa, "el selector no pisa la fila de debajo").toBe(0);
      expect(m.scroll, "la hoja no se desliza").toBe(0);
      const lista = hoja.getByTestId("ap-bank-list");
      await expect(lista).toHaveClass(/dentro/);
      // Logos de verdad (los recortes de `npm run logos`), no el 🏦 genérico.
      for (const b of ["Sabadell", "Trade Republic", "MyInvestor"]) await expect(lista.getByRole("button", { name: b }).locator('img[src^="logos/"]')).toHaveCount(1);
      await expect(lista).not.toContainText("🏦");
      await expect(lista.getByRole("button", { name: "Sin banco" })).toBeVisible();
      // Todo dentro de la pantalla y tocable; categorías y teclado, también.
      const tocables = await page.evaluate(() => {
        const toca = (el) => { const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false; const hit = document.elementFromPoint(x, y); return !!hit && (hit === el || el.contains(hit)); };
        const s = document.querySelector(".v4-exp-sheet");
        const ops = [...s.querySelectorAll(".v4-bankpick-op")], cats = [...s.querySelectorAll(".v4-ficha-cat")], keys = [...s.querySelectorAll(".v4-keys button")];
        const cuerpo = s.querySelector(".v4-sheet-body");
        return { ops: ops.every(toca), cats: cats.every(toca), keys: keys.every(toca), cta: toca(s.querySelector(".v4-cta")), sobra: cuerpo.scrollHeight - cuerpo.clientHeight };
      });
      expect(tocables).toEqual({ ops: true, cats: true, keys: true, cta: true, sobra: expect.any(Number) });
      expect(tocables.sobra, "la hoja cabe sin deslizar").toBeLessThanOrEqual(0);

      await lista.getByRole("button", { name: "Trade Republic" }).click();
      await expect(hoja.getByTestId("ap-bank-list")).toHaveCount(0);
      await expect(hoja.getByTestId("ap-bank")).toContainText("Trade Republic");
      for (const d of ["7"]) await hoja.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
      await hoja.locator(".v4-cta").click();
      await expect(hoja).toHaveCount(0, { timeout: 5_000 });
      const e = (await guardados(page)).find((x) => Math.abs(x.amount) === 7);
      expect(e.ent).toBe("trade_republic");
      expect(e.amount).toBe(tipo === "ingreso" ? -7 : 7);
    });
  }
}

test("Apuntar: «Sin banco» guarda sin banco, y tocar el elegido solo cierra", async ({ page }) => {
  await arranca(page, 393, 851, { expenses: [] });
  const hoja = await abreApuntar(page);
  await hoja.getByTestId("ap-bank").click();
  await hoja.getByTestId("ap-bank-list").getByRole("button", { name: "Sabadell" }).click();
  await expect(hoja.getByTestId("ap-bank-list")).toHaveCount(0);
  await expect(hoja.getByTestId("ap-bank")).toContainText("Sabadell");
  await hoja.getByTestId("ap-bank").click();
  await hoja.getByTestId("ap-bank-list").getByRole("button", { name: "Sin banco" }).click();
  await expect(hoja.getByTestId("ap-bank")).toContainText("Sin banco");
  await expect(hoja.getByTestId("ap-bank").locator(".v4-banco-sin")).toHaveCount(1);
  await hoja.locator(".v4-keys").getByRole("button", { name: "4", exact: true }).click();
  await hoja.locator(".v4-cta").click();
  await expect(hoja).toHaveCount(0, { timeout: 5_000 });
  const e = (await guardados(page)).find((x) => x.amount === 4);
  expect(e.ent).toBeUndefined();
});

test("Ficha: del banco sin tarjeta de origen, con candado y bloqueada; a mano, banco con logos que se guarda", async ({ page }) => {
  await arranca(page, 360, 740, {
    __seedOnce: true, _historyOwner: "e2e-user",
    expenses: [
      { id: MANO, date: HOY, amount: 20, merchant: "Compra a mano", category: "super", source: "manual", ent: "sabadell" },
      { id: "del-banco", date: HOY, amount: 30, merchant: "Cargo del banco", category: "super", source: "ob", ent: "trade_republic", obAcc: "ob-tr" },
      { id: "bizum-in", date: HOY, amount: -25, merchant: "Bizum de Ana", category: "ingreso", source: "ob", ent: "sabadell", obAcc: "ob-sab" },
    ],
    __cloudRows: { expenses: [{ user_id: "e2e-user", id: MANO, source: "manual:sabadell", fecha: HOY, importe: 20, comercio: "Compra a mano", cat: "super" }] },
  });
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const abre = async (id) => {
    const fila = page.locator('[data-expense-id="' + id + '"]');
    await expect(fila).toBeVisible();
    await fila.evaluate((el) => el.click());
    const hoja = page.locator(".v4-exp-sheet");
    await expect(hoja.getByTestId("exp-bank")).toBeVisible();
    return hoja;
  };
  const de = async (id) => (await guardados(page)).find((x) => x.id === id);

  for (const id of ["del-banco", "bizum-in"]) {
    const hoja = await abre(id);
    await expect(hoja).not.toContainText("Lo trajo una notificación");
    await expect(hoja.getByTestId("exp-trace")).toHaveCount(0);
    await expect(hoja.getByTestId("exp-locked")).toBeVisible();
    // El dinero sigue bloqueado: no hay teclado, tocar el importe solo avisa y el banco no abre selector.
    const antes = await de(id);
    await expect(hoja.locator(".v4-keys")).toHaveCount(0);
    await expect(hoja).not.toContainText("La categoría se puede corregir");
    await hoja.locator(".v4-ficha-amount").click();
    await expect(page.locator(".toast").filter({ hasText: /El banco fija/ }).first()).toBeVisible();
    await expect(hoja.locator(".v4-keys")).toHaveCount(0);
    // La retirada, una baldosa más de la fila (en el cargo; un ingreso no la tiene).
    await expect(hoja.getByTestId("exp-withdrawal")).toHaveCount(id === "del-banco" ? 1 : 0);
    if (id === "del-banco") {
      await expect(hoja.getByTestId("exp-withdrawal")).toHaveClass(/v4-ficha-cat/);
      await expect(hoja.getByTestId("exp-withdrawal")).toHaveAttribute("aria-label", "Es una retirada de efectivo");
    }
    await hoja.getByTestId("exp-bank").click();
    await expect(page.locator(".toast").filter({ hasText: /El banco fija/ }).first()).toBeVisible();
    await expect(hoja.getByTestId("exp-bank-list")).toHaveCount(0);
    await page.waitForTimeout(500);
    const despues = await de(id);
    expect(despues.amount).toBe(antes.amount);
    expect(despues.ent).toBe(antes.ent);
    await hoja.locator(".v4-ficha-done").click();
    await expect(hoja).toHaveCount(0);
  }

  const hoja = await abre(MANO);
  await expect(hoja.getByTestId("exp-locked")).toHaveCount(0);
  const m = await abreYMide(page, hoja, "exp");
  expect(m.movida, "la ficha no se mueve al abrir el selector").toBeLessThan(0.5);
  expect(m.pisa).toBe(0);
  const lista = hoja.getByTestId("exp-bank-list");
  await expect(lista.getByRole("button", { name: "Sabadell" })).toHaveAttribute("aria-pressed", "true");
  await expect(lista.getByRole("button", { name: "Trade Republic" }).locator('img[src^="logos/"]')).toHaveCount(1);
  await lista.getByRole("button", { name: "Trade Republic" }).click();
  await expect.poll(async () => (await de(MANO)).ent).toBe("trade_republic");
  await expect(hoja.getByTestId("exp-bank")).toContainText("Trade Republic");

  // Teclado: plegado al abrir; al tocar el importe sube abajo del todo, sobre el pie y bajo las categorías.
  const pisaPie = () => hoja.evaluate((s) => {
    const cuerpo = s.querySelector(".v4-sheet-body").getBoundingClientRect(), pie = s.querySelector(".v4-ficha-foot").getBoundingClientRect();
    // Lo visible de cada baldosa es lo que cae dentro del cuerpo con scroll; eso no puede tocar el pie.
    return [...s.querySelectorAll(".v4-ficha-cat")].map((el) => el.getBoundingClientRect())
      .map((r) => ({ top: Math.max(r.top, cuerpo.top), bottom: Math.min(r.bottom, cuerpo.bottom) }))
      .filter((r) => r.bottom > r.top).some((r) => r.bottom > pie.top + 0.5);
  });
  expect(await pisaPie(), "ninguna baldosa visible pisa el pie (cerrado)").toBe(false);
  await expect(hoja.locator(".v4-keys")).toHaveCount(0);
  await hoja.locator(".v4-ficha-amount").click();
  await expect(hoja.locator(".v4-ficha-teclado")).toHaveClass(/open/);
  await page.waitForTimeout(400);
  const sitio = await hoja.evaluate((s) => {
    const k = s.querySelector(".v4-ficha-teclado").getBoundingClientRect(), pie = s.querySelector(".v4-ficha-foot").getBoundingClientRect();
    const cats = s.querySelector(".v4-ficha-cats") || s.querySelector(".v4-ficha-cat-title");
    return { sobrePie: k.bottom <= pie.top + 1, pegado: pie.top - k.bottom < 4, despues: !!(cats.compareDocumentPosition(s.querySelector(".v4-ficha-teclado")) & Node.DOCUMENT_POSITION_FOLLOWING),
      ajustes: s.querySelectorAll(".v4-ficha-adjust").length };
  });
  // Las baldosas de ajustes se apartan mientras se teclea (crítico de la v3).
  expect(sitio, "abajo del todo, pegado encima del pie y detrás de las categorías; sin ajustes").toEqual({ sobrePie: true, pegado: true, despues: true, ajustes: 0 });
  expect(await pisaPie(), "ninguna baldosa visible pisa el pie (abierto)").toBe(false);
  // Desplazando hasta el final, lo último queda entero encima del teclado.
  const fin = await hoja.evaluate((s) => { const b = s.querySelector(".v4-sheet-body"); b.scrollTop = b.scrollHeight;
    const k = s.querySelector(".v4-ficha-teclado").getBoundingClientRect(), aj = [...s.querySelectorAll(".v4-ficha-cat")].map((e) => e.getBoundingClientRect());
    return aj.every((r) => r.bottom <= k.top + 0.5); });
  expect(fin, "con el teclado, lo de arriba se alcanza entero").toBe(true);
  await hoja.locator(".v4-sheet-body").evaluate((b) => { b.scrollTop = 0; });
  await hoja.locator(".v4-ficha-teclado .v4-keys").getByRole("button", { name: "5", exact: true }).click();
  await expect.poll(async () => (await de(MANO)).amount, "lo tecleado se guarda").not.toBe(20);
  await hoja.locator(".v4-ficha-amount").click();
  await expect(hoja.locator(".v4-keys")).toHaveCount(0);
  // Tocar otra cosa (el concepto) también lo recoge.
  await hoja.locator(".v4-ficha-amount").click();
  await expect(hoja.locator(".v4-ficha-teclado")).toHaveClass(/open/);
  await hoja.locator(".v4-ficha-concept").click();
  await expect(hoja.locator(".v4-keys")).toHaveCount(0);
  await hoja.locator(".v4-ficha-concept").blur();

  // Ajustes: UNA fila de baldosas iguales a las de categoría, y ✨ junto a «Todas ›».
  const filas = await hoja.evaluate((s) => {
    const aj = [...s.querySelectorAll(".v4-ficha-ajustes > .v4-ficha-cat")].map((b) => b.getBoundingClientRect());
    const cat = s.querySelector(".v4-ficha-cats:not(.v4-ficha-ajustes) .v4-ficha-cat").getBoundingClientRect();
    const sw = s.getBoundingClientRect().right;
    return { n: aj.length, tops: new Set(aj.map((r) => Math.round(r.top))).size, alto: Math.min(...aj.map((r) => r.height)), altoCat: cat.height,
      dentro: aj.every((r) => r.right <= sw + 0.5), ia: !!s.querySelector(".v4-ficha-cat-title .v4-ficha-ia") };
  });
  expect(filas.n, "a mano y sin recibos ni deudas: solo la nota").toBeGreaterThanOrEqual(1);
  expect(filas.tops, "una sola fila").toBe(1);
  // Varias, del alto de una categoría; una sola (la nota) va en fila entera.
  if (filas.n > 1) expect(Math.abs(filas.alto - filas.altoCat), "mismo alto que una categoría").toBeLessThan(1);
  else await expect(hoja.locator(".v4-ficha-ajustes")).toHaveClass(/\bsolo\b/);
  expect(filas.dentro).toBe(true);
  await expect(hoja.locator(".v4-ficha-adjust-row")).toHaveCount(0);
  await hoja.getByTestId("exp-note").click();
  await expect(hoja.locator(".v4-ficha-fold")).toHaveClass(/open/);
  await hoja.locator(".v4-exp-note-in").fill("Para la cena");
  await hoja.locator(".v4-exp-note-in").press("Tab");
  await expect.poll(async () => (await de(MANO)).note).toBe("Para la cena");
  await expect(hoja.getByTestId("exp-note-value")).toHaveText("Para la cena");
  await expect(hoja.getByTestId("exp-note")).toHaveClass(/\bon\b/);
  await hoja.getByTestId("exp-note").click();
  await expect(hoja.locator(".v4-ficha-fold")).toHaveCount(0);
});

/* Auditoría 237 (P1-2): las etiquetas de las baldosas partían palabras con guion («Supermer-cado»,
   «Trans-porte») o las cortaban con puntos («restauran…»). Ninguna palabra puede partirse ni salirse
   de su baldosa, ni en Apuntar (cinco columnas) ni en la ficha (cuatro), a 360, 393 y 412. */
const palabrasEnteras = (page) => page.evaluate(() => {
  const malas = [];
  for (const tile of document.querySelectorAll(".v4-exp-sheet .v4-ficha-cat")) {
    const sp = tile.querySelector(":scope > span:last-child");
    if (!sp || !sp.firstChild || sp.classList.contains("value")) continue;
    const cs = getComputedStyle(sp), tr = tile.getBoundingClientRect();
    if (cs.hyphens !== "none" || cs.textOverflow === "ellipsis") malas.push(sp.textContent + ": estilo");
    // Un solo tamaño, legible: 12 px en todas (crítico de la v3: había etiquetas a 7 px).
    if (parseFloat(cs.fontSize) !== 12) malas.push(sp.textContent + ": letra " + cs.fontSize);
    if (sp.scrollWidth > sp.clientWidth + 1) malas.push(sp.textContent + ": más ancha que su sitio");
    const txt = sp.firstChild.textContent;
    let i = 0;
    for (const w of txt.split(/(\s+)/)) {
      if (w.trim()) {
        const r = document.createRange(); r.setStart(sp.firstChild, i); r.setEnd(sp.firstChild, i + w.length);
        const rects = [...r.getClientRects()].filter((x) => x.width > 0);
        if (rects.length !== 1) malas.push(txt + ": «" + w + "» partida");
        else if (rects[0].left < tr.left - 0.5 || rects[0].right > tr.right + 0.5) malas.push(txt + ": «" + w + "» se sale");
      }
      i += w.length;
    }
    if (sp.scrollHeight > sp.clientHeight + 1) malas.push(txt + ": cortada por abajo");
  }
  return malas;
});
const LARGAS = ["ia", "bares", "super", "transporte", "tasas"].flatMap((cat, k) => Array.from({ length: 6 - k }, (_, j) => (
  { id: "l" + k + j, date: HOY, amount: 5 + j, merchant: "Gasto " + cat + j, category: cat, source: "manual", ent: "sabadell" })));
for (const [w, h] of [[360, 740], [393, 851], [412, 915]]) {
  test(`etiquetas de baldosa sin palabras partidas ni cortadas, Apuntar y ficha, ${w}×${h}`, async ({ page }) => {
    await arranca(page, w, h, { expenses: LARGAS });
    const hoja = await abreApuntar(page);
    await expect(hoja.getByTestId("ap-cat-ia")).toBeVisible();
    expect(await palabrasEnteras(page), "Apuntar").toEqual([]);
    await page.goBack().catch(() => {});
    await expect(hoja).toHaveCount(0);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await page.locator('[data-expense-id="l00"]').evaluate((el) => el.click());
    const ficha = page.locator(".v4-exp-sheet");
    await expect(ficha.getByTestId("exp-cat-ia")).toBeVisible();
    for (const id of ["ia", "bares", "super", "transporte", "tasas"]) await expect(ficha.getByTestId("exp-cat-" + id)).toHaveCount(1);
    expect(await palabrasEnteras(page), "ficha").toEqual([]);
  });
}


/* CUARTA VUELTA (crítico de la v3). A: con el teclado abierto, solo filas ENTERAS de categorías entre la
   cabecera y el teclado (o ninguna y la elegida en la cabecera), sin ajustes; en 360, 393 y 412.
   C/D: el pie dice «Guardado ✓» en una línea y «Borrar ingreso» en un ingreso. E: en un ingreso se ve
   siempre a qué cuenta entra, y lo que se toca es lo que se guarda (dinero). */
for (const [w, h] of [[360, 740], [393, 851], [412, 915]]) {
  test(`teclado abierto: solo filas enteras y ningún ajuste, ${w}×${h}`, async ({ page }) => {
    await arranca(page, w, h, { expenses: [{ id: MANO, date: HOY, amount: 20, merchant: "Compra a mano", category: "bares", source: "manual", ent: "sabadell" }] });
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await gastosAbreGasto(page, "Compra a mano");
    const hoja = page.locator(".v4-exp-sheet");
    await expect(hoja.getByTestId("exp-cat-more")).toBeVisible();
    await hoja.locator(".v4-ficha-amount").click();
    await expect(hoja.locator(".v4-ficha-teclado")).toHaveClass(/open/);
    await page.waitForTimeout(500);
    const m = await hoja.evaluate((s) => {
      const k = s.querySelector(".v4-ficha-teclado").getBoundingClientRect(), t = s.querySelector(".v4-ficha-cat-title").getBoundingClientRect();
      const tiles = [...s.querySelectorAll(".v4-ficha-cat")].map((e) => e.getBoundingClientRect());
            return { n: tiles.length, enteras: tiles.every((r) => r.bottom <= k.top + 0.5 && r.top >= t.bottom - 0.5),
        // Lo que hay justo encima del teclado (la fila de baldosas, la cabecera o el pago) y su separación.
        hueco: k.top - s.querySelector(".v4-ficha-teclado").previousElementSibling.getBoundingClientRect().bottom,
        ajustes: s.querySelectorAll(".v4-ficha-adjust").length, scroll: s.querySelector(".v4-sheet-body").scrollTop,
        elegida: (s.querySelector('[data-testid="exp-cat-elegida"]') || {}).textContent || "", bares: !!s.querySelector('[data-testid="exp-cat-bares"]') };
    });
    expect(m.enteras, "ninguna baldosa visible por debajo del borde del teclado ni encima de la cabecera").toBe(true);
    expect(m.ajustes).toBe(0);
    expect(m.scroll).toBe(0);
    // Sin huecos vacíos encima del teclado (crítico de la v5: la hoja fija a su alto máximo dejaba hasta 215 px).
    expect(m.hueco, "separación entre el contenido y el teclado").toBeLessThanOrEqual(24);
    // A 393 y 412 cabe una fila entera de tres; solo a 360 no cabe ninguna.
    if (w >= 390) expect(m.n, "al menos una fila entera de tres").toBeGreaterThanOrEqual(3);
    // La elegida se ve siempre: o en su baldosa, o en la cabecera si no cabe ninguna fila.
    if (m.n === 0) {
      expect(m.elegida).toContain("Bares y restaurantes");
      // Toda la línea abre el selector.
      await hoja.getByTestId("exp-cat-elegida").click();
      await expect(page.locator(".v4-ficha-cat-sheet")).toBeVisible();
      await page.goBack();
      await expect(page.locator(".v4-ficha-cat-sheet")).toHaveCount(0);
      // Abrir el selector desde la cabecera no recoge el teclado: se sigue tecleando al volver.
      await expect(hoja.locator(".v4-ficha-teclado")).toHaveClass(/open/);
    } else expect(m.bares).toBe(true);
    // Al cerrar vuelven las filas y los ajustes.
    await hoja.locator(".v4-ficha-amount").click();
    await expect(hoja.locator(".v4-ficha-adjust")).toHaveCount(1);
    await expect(hoja.getByTestId("exp-cat-elegida")).toHaveCount(0);
  });
}

test("ingreso: se ve siempre a qué cuenta entra, el pie dice «Borrar ingreso» y «Guardado ✓» en una línea", async ({ page }) => {
  await arranca(page, 360, 740, {
    __seedOnce: true, _historyOwner: "e2e-user",
    expenses: [
      { id: MANO, date: HOY, amount: -40, merchant: "Venta a mano", category: "ingreso", source: "manual", ent: "trade_republic" },
      { id: "bizum-in", date: HOY, amount: -25, merchant: "Bizum de Ana", category: "ingreso", source: "ob", ent: "sabadell", obAcc: "ob-sab" },
    ],
    __cloudRows: { expenses: [{ user_id: "e2e-user", id: MANO, source: "manual:trade_republic", fecha: HOY, importe: -40, comercio: "Venta a mano", cat: "ingreso" }] },
  });
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const de = async (id) => (await guardados(page)).find((x) => x.id === id);
  const abre = async (id) => { await page.locator('[data-expense-id="' + id + '"]').evaluate((el) => el.click()); const h = page.locator(".v4-exp-sheet"); await expect(h.getByTestId("exp-bank")).toBeVisible(); return h; };
  let hoja = await abre(MANO);
  await expect(hoja.locator(".v4-ficha-del")).toHaveText("🗑 Borrar ingreso");
  await expect(hoja.locator(".v4-ficha-saved")).toHaveText("Guardado ✓");
  expect(await hoja.locator(".v4-ficha-saved").evaluate((e) => e.getClientRects().length === 1 && e.getBoundingClientRect().height < 20), "en una línea").toBe(true);
  // La cuenta del ingreso, marcada y rellena; la otra, no.
  await expect(hoja.getByTestId("exp-bank")).toHaveAttribute("aria-pressed", "true");
  await expect(hoja.getByTestId("exp-bank")).toHaveClass(/\bsel\b/);
  await expect(hoja.getByTestId("exp-efectivo")).toHaveAttribute("aria-pressed", "false");
  const fondo = await hoja.getByTestId("exp-bank").evaluate((e) => { const p = document.createElement("i"); p.style.color = "var(--mint)"; document.body.appendChild(p); const m = getComputedStyle(p).color; p.remove(); return getComputedStyle(e).backgroundColor === m; });
  expect(fondo, "relleno en menta, como «Tarjeta» en un gasto").toBe(true);
  // A efectivo: lo marcado y lo guardado son lo mismo.
  await hoja.getByTestId("exp-efectivo").click();
  await expect.poll(async () => (await de(MANO)).ent).toBe("efectivo");
  await expect(hoja.getByTestId("exp-efectivo")).toHaveAttribute("aria-pressed", "true");
  await expect(hoja.getByTestId("exp-bank")).toHaveAttribute("aria-pressed", "false");
  // Y la nota sola, en fila entera.
  const nota = await hoja.getByTestId("exp-note").evaluate((e) => ({ w: e.getBoundingClientRect().width, p: e.parentElement.getBoundingClientRect().width }));
  expect(Math.abs(nota.w - nota.p), "la nota sola ocupa la fila").toBeLessThan(1);
  await hoja.locator(".v4-ficha-done").click();
  await expect(hoja).toHaveCount(0);
  // Del banco: su cuenta marcada y el efectivo apagado; no cambia.
  hoja = await abre("bizum-in");
  await expect(hoja.getByTestId("exp-bank")).toHaveAttribute("aria-pressed", "true");
  await expect(hoja.getByTestId("exp-efectivo")).toHaveClass(/bloqueada/);
  await hoja.getByTestId("exp-efectivo").click();
  await page.waitForTimeout(400);
  expect((await de("bizum-in")).ent).toBe("sabadell");
});


/* Crítico de la v4 (N2): sin teclado, ninguna baldosa ni chip visible queda partido bajo el pie, en los
   tres tamaños, con la ficha del banco más cargada (cinco ajustes). Y la cabecera con la elegida más
   larga, «Inteligencia artificial», cabe entera a 360 con el teclado. */
const CARGADA = {
  fixed: [{ id: "luz", name: "Luz", amount: 48, day: 20, ent: "sabadell" }],
  debts: [{ id: "coche", name: "Préstamo coche", balance: 4000, payment: 180 }],
  goals: [{ id: "viaje", name: "Viaje", target: 1000, saved: 100, emoji: "✈️" }],
};
for (const [w, h] of [[360, 740], [393, 851], [412, 915]]) {
  test(`sin teclado, nada partido bajo el pie en la ficha del banco, ${w}×${h}`, async ({ page }) => {
    await arranca(page, w, h, Object.assign({}, CARGADA, { expenses: LARGAS.slice(0, 8).concat([
      { id: "del-banco", date: HOY, amount: 23.4, merchant: "Cargo del banco", category: "super", source: "ob", ent: "trade_republic", obAcc: "ob-tr" }]) }));
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await gastosAbreGasto(page, "Cargo del banco");
    const hoja = page.locator(".v4-exp-sheet");
    await expect(hoja.getByTestId("exp-withdrawal")).toBeVisible();
    await page.waitForTimeout(500);
    const partidas = await hoja.evaluate((s) => {
      const cuerpo = s.querySelector(".v4-sheet-body").getBoundingClientRect(), pie = s.querySelector(".v4-ficha-foot").getBoundingClientRect();
      const borde = Math.min(cuerpo.bottom, pie.top);
      return [...s.querySelectorAll(".v4-ficha-cat")].map((e) => ({ t: e.textContent, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.top < borde - 0.5 && r.bottom > borde + 0.5).map(({ t }) => t);
    });
    expect(partidas, "o entera encima del pie, o entera fuera de la vista").toEqual([]);
    // Los ajustes son chips compactos de una línea.
    const altos = await hoja.locator(".v4-ficha-ajustes > .v4-ficha-cat").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(Math.max(...altos)).toBeLessThan(48);
  });
}
test("cabecera con «Inteligencia artificial» elegida, a 360 con el teclado: entera y abre el selector", async ({ page }) => {
  await arranca(page, 360, 740, { expenses: [{ id: MANO, date: HOY, amount: 20, merchant: "Suscripción", category: "ia", source: "manual", ent: "sabadell" }] });
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await gastosAbreGasto(page, "Suscripción");
  const hoja = page.locator(".v4-exp-sheet");
  await hoja.locator(".v4-ficha-amount").click();
  await expect(hoja.locator(".v4-ficha-teclado")).toHaveClass(/open/);
  const cab = hoja.getByTestId("exp-cat-elegida");
  await expect(cab).toContainText("Inteligencia artificial");
  const m = await cab.evaluate((b) => { const n = b.querySelector(".v4-ficha-cat-elegida"), r = b.getBoundingClientRect(), rn = n.getBoundingClientRect();
    return { cabe: n.scrollWidth <= n.clientWidth + 1, dentro: rn.right <= r.right + 0.5, una: n.getClientRects().length === 1, alto: r.height }; });
  expect(m).toEqual({ cabe: true, dentro: true, una: true, alto: expect.any(Number) });
  expect(m.alto, "toda la línea se toca").toBeGreaterThanOrEqual(44);
  await cab.click();
  await expect(page.locator(".v4-ficha-cat-sheet")).toBeVisible();
});

// Crítico de la v5 (V1): en un ingreso (sin categorías) el teclado quedaba a ~215 px del pago a 412.
for (const [w, h] of [[393, 851], [412, 915]]) {
  test(`ingreso a mano con el teclado: sin hueco entre el pago y el teclado, ${w}×${h}`, async ({ page }) => {
    await arranca(page, w, h, { expenses: [{ id: MANO, date: HOY, amount: -40, merchant: "Venta a mano", category: "ingreso", source: "manual", ent: "trade_republic" }] });
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await gastosAbreGasto(page, "Venta a mano");
    const hoja = page.locator(".v4-exp-sheet");
    await hoja.locator(".v4-ficha-amount").click();
    await expect(hoja.locator(".v4-ficha-teclado")).toHaveClass(/open/);
    await page.waitForTimeout(500);
    const m = await hoja.evaluate((s) => { const k = s.querySelector(".v4-ficha-teclado").getBoundingClientRect(), pie = s.querySelector(".v4-ficha-foot").getBoundingClientRect();
      return { hueco: k.top - s.querySelector(".v4-ficha-teclado").previousElementSibling.getBoundingClientRect().bottom, pegado: pie.top - k.bottom }; });
    expect(m.hueco, "separación entre el pago y el teclado").toBeLessThanOrEqual(24);
    expect(m.pegado, "el teclado, justo encima del pie").toBeLessThan(4);
  });
}
