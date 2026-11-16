import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* REMATE DE LA 235 (petición del dueño, 16/11). Render puro y dinero, medidos en el DOM:
   · Apuntar (gasto e ingreso): el banco se elige con LOGOS que entran en la misma fila del pago, con
     fundido; la fila de categorías no se mueve ni un píxel en ningún fotograma, ninguna caja se pisa
     y la hoja cabe entera a 360×740 y 393×851. Lo elegido se guarda en `ent` como antes.
   · Ficha de un movimiento: el mismo selector; sin la tarjeta «Lo trajo una notificación…», con un
     candado junto al importe, y el importe y el banco del banco siguen bloqueados.
   · Recibo, deuda, meta y nota son chips: abren su panel y la nota se guarda igual. */
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
    // El dinero sigue bloqueado: el importe no se teclea y el banco no abre selector.
    const antes = await de(id);
    await hoja.locator(".v4-keys").getByRole("button", { name: "9", exact: true }).click();
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

  // Chips de debajo: la nota se abre en su sitio, se guarda y el chip pasa a enseñarla.
  await expect(hoja.locator(".v4-ficha-adjust-row .chev")).toHaveCount(0);
  await hoja.getByTestId("exp-note").click();
  await expect(hoja.locator(".v4-ficha-fold")).toHaveClass(/open/);
  await hoja.locator(".v4-exp-note-in").fill("Para la cena");
  await hoja.locator(".v4-exp-note-in").press("Tab");
  await expect.poll(async () => (await de(MANO)).note).toBe("Para la cena");
  await expect(hoja.getByTestId("exp-note-value")).toHaveText("Para la cena");
  await hoja.getByTestId("exp-note").click();
  await expect(hoja.locator(".v4-ficha-fold")).toHaveCount(0);
});
