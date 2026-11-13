import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Plan › Recibos: prueba gratis, permanencia y gestos sobre las filas (decisión del dueño del
   10/11/2026; docs/design/plan-recibos/SPEC.md §2.3, §2.4, §2.6.2, §7 y §10).
   - Las dos fechas son opcionales: sin fecha no sale nada. La permanencia solo avisa; la prueba gratis,
     como el prototipo, saca el recibo de lo que queda por pagar mientras no cobra (el mes en que
     acaba sí cuenta) y en «Se te van cada mes» sigue sumando.
   - Las filas ya no se deslizan (11/11/2026, el dueño: con una mano deslizaba desde el importe y no le
     dejaba pasar de pestaña): un desliz horizontal sobre cualquier parte de una fila cambia de pestaña,
     como en el resto de la app, y no marca ni pospone nada. Posponer y «¿Cuál es el cargo?» siguen en
     la ficha. El gesto es de verdad (toques por CDP, sin el splash delante y con la pestaña quieta). */
const YM = 2026 * 12 + 10;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const recibo = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra);
const guardado = (page, id) => page.evaluate((rid) => mcLoadRaw(mcStateKey()).fixed.find((x) => x.id === rid) || null, id);
const ficha = (page) => page.locator('.v4-sheet[data-sheet="recibo"]');
const hoja = (page) => page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
const pestana = (page) => page.evaluate(() => { const b = document.querySelector(".botnav-tab.active"); return b && b.getAttribute("data-tour"); });

function datos() {
  return [
    recibo("luz", "Luz", 55, 3),                                              // No ha llegado
    recibo("nfx", "Netflix", 12.99, 25, { pruebaHasta: "2026-10-19" }),       // empieza a cobrar mañana
    recibo("fibra", "Fibra", 30, 22, { permHasta: YM + 1 }),                  // fin de permanencia: nov
    recibo("agua", "Agua", 20, 26),                                           // sin fechas: nada
    recibo("gym", "Gimnasio", 40, 28, { pruebaHasta: "2026-12-01", permHasta: YM + 6 }), // en prueba hasta dic: fuera de octubre
  ];
}

async function abrePlan(page, fixed) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-18T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-10-18", bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], settings,
    accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }], fixed: fixed || datos() });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  // El splash tapa la pantalla: un dedo antes de que se vaya ni llega a la app (AGENTS §7 bis).
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect.poll(() => pestana(page)).toBe("plan");
  // El carrusel sigue deslizándose tras marcar la pestaña: se espera a que el track esté quieto.
  await page.waitForFunction(() => {
    const tr = document.querySelector(".track");
    if (!tr) return false;
    const v = getComputedStyle(tr).transform, q = window.__trQuieto;
    window.__trQuieto = { v, n: q && q.v === v ? q.n + 1 : 0 };
    return window.__trQuieto.n >= 3;
  }, null, { polling: "raf" });
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}

test("prueba gratis y permanencia: avisan solo con fecha y por prioridad; la prueba lejos sale del mes", async ({ page }) => {
  const recibos = await abrePlan(page);
  const review = recibos.getByTestId("plan-review");
  await expect(review.locator(".v4-charge")).toHaveCount(3);
  // Prioridad 0 la prueba, 1 lo que no ha llegado, 3 la permanencia (SPEC §2.3).
  await expect(review.locator(".v4-charge").nth(0)).toHaveAttribute("data-review", "trial");
  await expect(review.locator(".v4-charge").nth(1)).toHaveAttribute("data-review", "late");
  await expect(review.locator(".v4-charge").nth(2)).toHaveAttribute("data-review", "perm");
  // En la fila, corto (a 360 px la frase entera partía en dos renglones); entera en la ficha y para el lector.
  await expect(review.locator('[data-review="trial"] .pr6-why')).toHaveText("Cobra mañana");
  await expect(review.locator('[data-review="trial"]')).toHaveAttribute("aria-label", /Mañana empieza a cobrar/);
  await expect(review.locator('[data-review="perm"] .pr6-why')).toHaveText("Permanencia: nov 2026");
  await expect(review.locator('[data-review="perm"]')).toHaveAttribute("aria-label", /Fin de permanencia: nov 2026/);
  // Sin fecha, ningún aviso. La prueba que acaba en diciembre no cobra en octubre: ni aviso ni fila.
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_agua"]')).toHaveCount(1);
  await expect(recibos.locator('[data-recibo="fixed_gym"]')).toHaveCount(0);
  // Lo que queda por pagar: los cuatro que cobran este mes (Netflix empieza mañana, cobra en octubre).
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(55 + 12.99 + 30 + 20)));

  // Prueba: «Me lo quedo» quita la fecha y el recibo vuelve a «Por pagar».
  await review.locator('[data-review="trial"]').click();
  await expect(ficha(page).getByTestId("recibo-nota")).toHaveText("Mañana empieza a cobrar");
  // Recibo del 25 con la prueba hasta el 19: la ficha dice el 19, lo mismo que el aviso (auditoría 222, P1-1;
  // antes «Se cobra el 25» debajo de «Cobra mañana»).
  await expect(ficha(page)).toContainText("Se cobra el 19");
  await expect(ficha(page)).not.toContainText("Se cobra el 25");
  await expect(ficha(page).getByTestId("recibo-par").locator("button")).toHaveText(["Me lo quedo", "Ya no lo tengo"]);
  await expect(ficha(page).locator('[data-act="pagado"]')).toHaveCount(0);
  await expect(ficha(page).getByTestId("recibo-baja")).toHaveText("Cómo darte de baja en Netflix");
  await ficha(page).getByRole("button", { name: "Me lo quedo" }).click();
  await expect(ficha(page)).toHaveCount(0);
  await expect.poll(async () => "pruebaHasta" in (await guardado(page, "nfx"))).toBe(false);
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_nfx"]')).toHaveCount(1);

  // Permanencia: «Ya lo he mirado» calla esa fecha.
  await review.locator('[data-review="perm"]').click();
  await expect(ficha(page).getByTestId("recibo-nota")).toHaveText("Fin de permanencia: nov 2026");
  await expect(ficha(page).getByTestId("recibo-par").locator("button")).toHaveText(["Ya lo he mirado", "Ya no lo tengo"]);
  await ficha(page).getByRole("button", { name: "Ya lo he mirado" }).click();
  await expect(ficha(page)).toHaveCount(0);
  await expect.poll(async () => (await guardado(page, "fibra")).revisado).toEqual({ perm: YM + 1 });
  await expect(review.locator('[data-recibo="fixed_fibra"]')).toHaveCount(0);
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(55 + 12.99 + 30 + 20)));

  // «Tus recibos»: al mes el gimnasio suma entero (es lo que costará, como en el prototipo); al año
  // faltan octubre y noviembre, que no cobra. Cabecera, fila y motor dicen lo mismo.
  await recibos.getByTestId("plan-todos").click();
  const hub = page.locator('[data-bills-manage] [data-screen="bills-home"]');
  await expect(hub).toBeVisible();
  await expect(hub.locator("[data-bills-total]")).toHaveText(await page.evaluate(() => eur(55 + 12.99 + 30 + 20 + 40)));
  await expect(hub.locator('[data-bill-id="gym"] .am')).toHaveText(await page.evaluate(() => eur(40)));
  await hub.locator("[data-bills-hero]").click();
  await expect(hub.locator("[data-bills-hero] .v4-micro")).toHaveText("SE TE VAN AL AÑO");
  await expect(hub.locator('[data-bill-id="gym"] .am')).toHaveText(await page.evaluate(() => eur(400)));
  await expect(hub.locator("[data-bills-total]")).toHaveText(await page.evaluate(() => eur((55 + 12.99 + 30 + 20) * 12 + 400)));
});

test("más opciones: se ponen, se guardan y se quitan la prueba gratis y la permanencia", async ({ page }) => {
  const recibos = await abrePlan(page);
  const editarAgua = async () => {
    await recibos.getByTestId("plan-due").locator('[data-recibo="fixed_agua"]').click();
    await ficha(page).locator('[data-act="editar"]').click();
    await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
  };
  await editarAgua();
  const p4 = hoja(page).locator('[data-rp4-paso="4"]');
  await p4.locator('[data-act="mas-opciones"]').click();
  await expect(p4.locator('[data-rp7-valor="prueba"]')).toHaveText("No");
  await expect(p4.locator('[data-rp7-valor="perm"]')).toHaveText("No");
  // Prueba: «Un mes» (18 oct + 30 días) y un día más con «+».
  await p4.locator('[data-rp7="prueba"] .rp7-row').click();
  await p4.locator('[data-rp7="prueba"] [data-rp7-chip="mes"]').click();
  await expect(p4.locator('[data-rp7-fecha="prueba"]')).toHaveText("empieza a cobrar el 17 nov");
  await p4.locator('[data-rp7="prueba"]').getByRole("button", { name: "Un día después" }).click();
  await expect(p4.locator('[data-rp7-valor="prueba"]')).toHaveText("hasta el 18 nov");
  // Permanencia: «Un año» y un mes antes.
  await p4.locator('[data-rp7="perm"] .rp7-row').click();
  await p4.locator('[data-rp7="perm"] [data-rp7-chip="ano"]').click();
  await p4.locator('[data-rp7="perm"]').getByRole("button", { name: "Un mes antes" }).click();
  await expect(p4.locator('[data-rp7-valor="perm"]')).toHaveText("hasta sep 2027");
  await hoja(page).locator(".rp4-cta").click();
  await expect(hoja(page)).toHaveCount(0);
  await expect.poll(async () => { const f = await guardado(page, "agua"); return [f.pruebaHasta, f.permHasta, f.amount, f.day]; })
    .toEqual(["2026-11-18", 2027 * 12 + 9, 20, 26]);
  // Empieza a cobrar en noviembre: en octubre no se cobra, sale de «Por pagar» y de la cifra, sin aviso.
  await expect(recibos.locator('[data-recibo="fixed_agua"]')).toHaveCount(0);
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(55 + 12.99 + 30)));

  // Al volver a editar (desde «Tus recibos»: este mes ya no está en la portada), Más opciones ya está
  // abierto con lo que tiene; «Sin prueba» la quita y vuelve a «Por pagar».
  await recibos.getByTestId("plan-todos").click();
  // Tus recibos enseña tres por sección (11/11/2026): el agua está en «Ver los N».
  await page.locator('[data-bills-manage] [data-mg-more="serv"]').click();
  await page.locator('[data-bills-manage] [data-screen="bills-home"] [data-bill-id="agua"]').click();
  await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
  await expect(p4.locator('[data-act="mas-opciones"]')).toHaveAttribute("aria-expanded", "true");
  await expect(p4.locator('[data-rp7-valor="prueba"]')).toHaveText("hasta el 18 nov");
  await p4.locator('[data-rp7="prueba"] .rp7-row').click();
  await p4.locator('[data-rp7="prueba"] [data-rp7-chip="sin"]').click();
  await hoja(page).locator(".rp4-cta").click();
  await expect(hoja(page)).toHaveCount(0);
  await expect.poll(async () => { const f = await guardado(page, "agua"); return ["pruebaHasta" in f, f.permHasta]; }).toEqual([false, 2027 * 12 + 9]);
  await page.goBack();
  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_agua"]')).toHaveCount(1);
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText(await page.evaluate(() => eur(55 + 12.99 + 30 + 20)));
});

/* Arrastre horizontal real por CDP, con el dedo naciendo en la cifra (`.am`) o en el nombre de la fila. */
async function desliza(page, cdp, loc, dx, { pasos = 14, desde = "cifra" } = {}) {
  await loc.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(250);
  const b = await loc.locator(desde === "nombre" ? ".pr6-nm" : ".am").boundingBox();
  const x0 = Math.round(desde === "nombre" ? b.x + 12 : b.x + b.width / 2), y0 = Math.round(b.y + b.height / 2);
  let movida = 0;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (dx * i) / pasos, y: y0 }] });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    movida = Math.max(movida, Math.abs(await loc.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  return movida;
}

/* Petición del dueño (11/11/2026): «con una mano deslizo desde el precio y no me deja pasar de pestaña».
   En las dos listas, empezando sobre el importe o sobre el nombre: la fila no se mueve, la pestaña pasa
   a Cartera y no se pospone, no se abre la ficha ni cambia nada guardado. */
for (const caso of [{ lista: "plan-due", id: "fixed_agua" }, { lista: "plan-review", id: "fixed_luz" }]) for (const desde of ["cifra", "nombre"]) {
  test(`${caso.lista}: un desliz horizontal desde ${desde === "cifra" ? "el importe" : "el nombre"} cambia de pestaña y no marca nada`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "El gesto táctil real usa CDP");
    const recibos = await abrePlan(page);
    const cdp = await page.context().newCDPSession(page);
    const antes = await page.evaluate(() => JSON.stringify(mcLoadRaw(mcStateKey()).fixed));
    const fila = recibos.getByTestId(caso.lista).locator(`[data-recibo="${caso.id}"]`);
    expect(await desliza(page, cdp, fila, -220, { desde })).toBe(0);
    await expect.poll(() => pestana(page)).toBe("cartera");
    await expect(ficha(page)).toHaveCount(0);
    await expect(page.getByTestId("plan-deshacer")).toHaveCount(0);
    await expect(recibos.getByTestId(caso.lista).locator(`[data-recibo="${caso.id}"]`)).toHaveCount(1);
    expect(await page.evaluate(() => JSON.stringify(mcLoadRaw(mcStateKey()).fixed))).toBe(antes);
    await cdp.detach();
  });
}

test("sobre una fila, hacia la derecha cambia de pestaña y en vertical es scroll", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "El gesto táctil real usa CDP");
  const fixed = datos();
  for (let i = 0; i < 10; i++) fixed.push(recibo("r" + i, "Recibo " + (i + 1), 10 + i, 20 + (i % 8)));
  const recibos = await abrePlan(page, fixed);
  const cdp = await page.context().newCDPSession(page);
  const agua = recibos.getByTestId("plan-due").locator(".v4-charge").first();
  // Con todo desplegado la página es más alta que la pantalla: hay sitio para hacer scroll.
  await recibos.getByTestId("plan-due").getByRole("button", { name: /Ver los/ }).click();
  await page.waitForTimeout(500);
  await agua.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(200);

  // Vertical sobre una fila: es scroll, la tarjeta no se mueve.
  const antes = await agua.evaluate((el) => el.closest(".page").scrollTop);
  const b = await agua.boundingBox();
  const x = Math.round(b.x + b.width / 2), y0 = Math.round(b.y + b.height / 2);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  let movida = 0;
  // Un dedo de verdad: pasos cortos (como `plan-scroll-lento`), con algo de deriva lateral.
  for (let i = 1; i <= 90; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - Math.round(i / 6), y: y0 - i * 2 }] });
    await new Promise((r) => setTimeout(r, 8));
    if (i % 15 === 0) movida = Math.max(movida, Math.abs(await agua.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(movida).toBe(0);
  await expect.poll(() => agua.evaluate((el) => el.closest(".page").scrollTop)).toBeGreaterThan(antes + 40);
  await expect(ficha(page)).toHaveCount(0);

  // Hacia la derecha desde una fila: sigue siendo cambiar de pestaña (a Gastos).
  const fila = recibos.getByTestId("plan-due").locator(".v4-charge").first();
  await fila.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const c = await fila.boundingBox();
  const fx = Math.round(c.x + 60), fy = Math.round(c.y + c.height / 2);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fx, y: fy }] });
  for (let i = 1; i <= 14; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: fx + i * 16, y: fy }] });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  }
  expect(await fila.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)).toBe(0);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => pestana(page)).toBe("gastos");
  await expect(ficha(page)).toHaveCount(0);
  await cdp.detach();
});

/* Revisión de la 224, P2-C: lo que nace en la cifra es un toque o un scroll como en el resto de la fila: el
   toque abre la ficha y el vertical hace scroll sin mover la fila. */
test("desde la cifra: un toque abre la ficha y un arrastre vertical hace scroll", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "El gesto táctil real usa CDP");
  const fixed = datos();
  // Con filas de dos renglones (11/11/2026) hacen falta más para que, centrada el agua, quede lista que bajar.
  for (let i = 0; i < 16; i++) fixed.push(recibo("r" + i, "Recibo " + (i + 1), 10 + i, 20 + (i % 8)));
  const recibos = await abrePlan(page, fixed);
  const cdp = await page.context().newCDPSession(page);
  await recibos.getByTestId("plan-due").getByRole("button", { name: /Ver los/ }).click();
  await page.waitForTimeout(500);
  const fila = recibos.getByTestId("plan-due").locator('[data-recibo="fixed_agua"]');
  await fila.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(250);

  // Un toque en la cifra: abre su ficha, no el paso del cargo. Con la página quieta: un toque sobre una
  // lista aún deslizándose solo la frena, en un móvil de verdad también.
  const quieta = () => page.waitForFunction(() => {
    const pg = document.querySelector(".page-live .page") || document.querySelector(".page"), v = pg && pg.scrollTop, q = window.__pgQuieta;
    window.__pgQuieta = { v, n: q && q.v === v ? q.n + 1 : 0 };
    return window.__pgQuieta.n >= 10;
  }, null, { polling: "raf" });
  await quieta();
  await fila.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await quieta();
  // Y con la barra de abajo ya en su sitio, que mueve la lista: la caja, quieta.
  await page.waitForTimeout(500);
  const c = await fila.locator(".am").boundingBox();
  const tx = Math.round(c.x + c.width / 2), ty = Math.round(c.y + c.height / 2);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tx, y: ty }] });
  await page.waitForTimeout(60);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(ficha(page)).toBeVisible();
  await expect(ficha(page).locator(".pr6-track")).not.toHaveClass(/\bpick\b/);
  expect(await fila.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  await page.goBack();
  await expect(ficha(page)).toHaveCount(0);
  await page.waitForTimeout(400);

  // Vertical desde la cifra: scroll, la tarjeta quieta, ni ficha ni cambio de pestaña.
  await fila.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(250);
  const antes = await fila.evaluate((el) => el.closest(".page").scrollTop);
  const b = await fila.locator(".am").boundingBox();
  const x = Math.round(b.x + b.width / 2), y0 = Math.round(b.y + b.height / 2);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  let movida = 0;
  for (let i = 1; i <= 90; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - Math.round(i / 6), y: y0 - i * 2 }] });
    await new Promise((r) => setTimeout(r, 8));
    if (i % 15 === 0) movida = Math.max(movida, Math.abs(await fila.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(movida).toBe(0);
  await expect.poll(() => fila.evaluate((el) => el.closest(".page").scrollTop)).toBeGreaterThan(antes + 40);
  await expect(ficha(page)).toHaveCount(0);
  expect(await pestana(page)).toBe("plan");

  await cdp.detach();
});

// A 360 px, con un importe de cuatro cifras, el aviso de la prueba cabe en un renglón (antes partía en dos).
test("a 360 px el aviso de la prueba gratis cabe en un renglón", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const recibos = await abrePlan(page, [recibo("yt", "YouTube Premium", 1112.99, 25, { pruebaHasta: "2026-10-19" })]);
  const why = recibos.getByTestId("plan-review").locator('[data-review="trial"] .pr6-why');
  await expect(why).toHaveText("Cobra mañana");
  const [alto, linea] = await why.evaluate((el) => [el.getBoundingClientRect().height, parseFloat(getComputedStyle(el).lineHeight)]);
  expect(alto).toBeLessThan(linea * 1.5);
});

test("a 360 px: la permanencia en una línea y las dos píldoras del mismo ancho (auditoría 222, P2-7 y P2-8)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  // Con alguien que te debe, para que salgan las dos píldoras («Te llega» y «Te deben»).
  const fixed = datos().map((r) => r.id !== "agua" ? r : Object.assign({}, r, { bankAmount: 34.95, reparto: [{ id: "pe_pareja", n: "Pareja", via: "bizum", amt: 14.95 }] }));
  const recibos = await abrePlan(page, fixed);
  const why = recibos.getByTestId("plan-review").locator('[data-review="perm"] .pr6-why');
  await expect(why).toHaveText("Permanencia: nov 2026");
  const alto = await why.evaluate((e) => [e.getBoundingClientRect().height, parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.4]);
  expect(alto[0]).toBeLessThan(alto[1] * 1.5);
  const anchos = await recibos.locator(".pr6-pills .pr6-pill").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(anchos.length).toBe(2);
  expect(Math.abs(anchos[0] - anchos[1])).toBeLessThanOrEqual(1);
});
