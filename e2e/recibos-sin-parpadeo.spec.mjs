import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Vídeo del dueño (beta 4.26.212, 7/11): en «Editar recibo» y en el alta por pasos la hoja y el
   botón «Siguiente» salían EN BLANCO uno o dos fotogramas al tocar «Más opciones», «En varios
   pagos» o «Solo una vez», y al pasar del resumen a «Nombre» la hoja se veía vacía mientras el
   carril deslizaba. En su WebView a 120 Hz una capa de composición que NACE al empezar una
   transición se pinta tarde; lo que se veía en blanco era justo lo que pasaba a capa nueva (el
   botón pegado, el contenido de la hoja al empezar a scrollear, el carril). Aquí se miran las capas
   que crea Chromium (CDP LayerTree) y, fotograma a fotograma, que el carril no quede vacío. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const recibo = (id, name, amount, day, extra = {}) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra);
const fixed = [recibo("ma", "Mantenimiento Agua", 21.99, 1, { freq: "anual", months: [11] }), recibo("ag", "Agua", 81.29, 8, { freq: "bimestral" }),
  recibo("co", "Comunidad", 50, 10), recibo("in", "Internet", 22, 20)];

async function abrePlan(page) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-11-07T12:00:00+01:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-11-07", bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], settings,
    accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }], fixed });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
const hoja = (page) => page.locator('.v4-sheet[data-sheet="recibo-pasos"]');

/* Capas que nacen y que mueren durante `fn` (por clase del nodo que las pide). */
async function capas(page, fn) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable"); await cdp.send("LayerTree.enable");
  const arboles = [];
  cdp.on("LayerTree.layerTreeDidChange", (e) => arboles.push(e.layers || []));
  // El árbol solo se emite cuando cambia: una capa que se pone y se quita da el de partida.
  await page.evaluate(() => new Promise((r) => {
    const d = document.createElement("div"); d.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;will-change:transform";
    document.body.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.remove(); requestAnimationFrame(() => requestAnimationFrame(r)); }));
  }));
  await page.waitForTimeout(300);
  const n0 = arboles.length, base = arboles.at(-1) || [];
  await fn();
  await page.waitForTimeout(900);
  const nacen = new Map(), mueren = new Map();
  let antes = new Map(base.map((l) => [l.layerId, l]));
  for (const ls of arboles.slice(n0)) {
    const ahora = new Map(ls.map((l) => [l.layerId, l]));
    for (const [id, l] of ahora) if (!antes.has(id) && l.backendNodeId) nacen.set(id, l.backendNodeId);
    for (const [id, l] of antes) if (!ahora.has(id) && l.backendNodeId) mueren.set(id, l.backendNodeId);
    antes = ahora;
  }
  const clase = async (id) => {
    try {
      const { node } = await cdp.send("DOM.describeNode", { backendNodeId: id });
      const a = node.attributes || [], i = a.indexOf("class");
      return i >= 0 ? a[i + 1] : node.nodeName;
    } catch (_) { return null; /* nodo ya desmontado */ }
  };
  const out = { nacen: [], mueren: [] };
  for (const id of nacen.values()) { const c = await clase(id); if (c) out.nacen.push(c); }
  for (const id of mueren.values()) { const c = await clase(id); if (c) out.mueren.push(c); }
  await cdp.detach();
  expect(base.length, "sin árbol de capas de partida").toBeGreaterThan(0);
  return out;
}
const capasNuevas = async (page, fn) => (await capas(page, fn)).nacen;
// Lo que estaba a la vista y no puede pasar a capa nueva al tocar (en su móvil se veía en blanco).
// El plegable sí puede: nace transparente y darle capa fija costaba un repintado por fotograma.
const VIGILADAS = /rp4-foot|v4-sheet|rp4-track|rp4-step|pr6-chev/;

test("editar: «Más opciones» y pasar del resumen a «Nombre» no crean capas nuevas", async ({ page }) => {
  const recibos = await abrePlan(page);
  await recibos.getByTestId("plan-review").locator(".v4-charge").first().click();
  await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await page.waitForTimeout(600);
  const mas = hoja(page).locator('[data-act="mas-opciones"]');
  expect((await capasNuevas(page, () => mas.click())).filter((c) => VIGILADAS.test(c))).toEqual([]);
  expect((await capasNuevas(page, () => mas.click())).filter((c) => VIGILADAS.test(c))).toEqual([]);
  const nombre = hoja(page).locator('[data-rp4-paso="4"] button').filter({ hasText: "Nombre" }).first();
  expect((await capasNuevas(page, () => nombre.click())).filter((c) => VIGILADAS.test(c))).toEqual([]);
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
});

test("alta: «En varios pagos» y «Solo una vez» no crean capas nuevas y Atrás sigue a la vista", async ({ page }) => {
  const recibos = await abrePlan(page);
  await recibos.getByTestId("plan-due").getByRole("button", { name: "Gestionar" }).click();
  await page.locator('[data-bills-manage] [data-act="bill-add"]').first().click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  await hoja(page).locator('[data-rp4-paso="0"] [data-rp4="name"]').fill("Internet");
  await hoja(page).locator(".rp4-cta").click();
  for (const d of "22") await hoja(page).locator('[data-rp4-paso="1"] .v4-keys button[aria-label="' + d + '"]').click();
  await hoja(page).locator(".rp4-cta").click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "2");
  await page.waitForTimeout(500);
  // Lo que scrollea (el padre del carril) scrollea SIEMPRE, también con poco contenido: así su capa
  // no nace al crecer el paso. Y el botón no va dentro de ese scroll.
  const scroll = () => hoja(page).locator(".rp4-track").evaluate((tr) => { const sc = tr.parentElement, foot = sc.parentElement.querySelector(".rp4-foot");
    return { sobra: sc.scrollHeight - sc.clientHeight, botonDentro: sc.contains(foot) }; });
  const antes = await scroll();
  expect(antes.botonDentro).toBe(false);
  expect(antes.sobra).toBeGreaterThan(0);
  const split = hoja(page).locator('[data-rp4-modo="split"]'), once = hoja(page).locator('[data-rp4-modo="once"]');
  expect((await capasNuevas(page, () => split.click())).filter((c) => VIGILADAS.test(c))).toEqual([]);
  // Con los pagos a la vista, Atrás y el progreso no se van por arriba (antes scrolleaban con todo).
  const sh = await hoja(page).boundingBox(), back = await hoja(page).locator('[data-act="back"]').boundingBox();
  expect(back.y).toBeGreaterThanOrEqual(sh.y);
  // «¿Cuándo se cobra?» queda ENTERO dentro del cuerpo que scrollea, no cortado contra su borde (revisión 7/11).
  await page.waitForTimeout(900);
  const caja = await hoja(page).locator('[data-rp4-paso="2"] .rp4-h').boundingBox(), cuerpo = await hoja(page).locator(".rp4-body").boundingBox();
  expect(caja.y, JSON.stringify({caja,cuerpo})).toBeGreaterThanOrEqual(cuerpo.y - 0.5);
  expect(caja.y + caja.height).toBeLessThanOrEqual(cuerpo.y + cuerpo.height + 0.5);
  expect((await scroll()).sobra).toBeGreaterThan(0);
  expect((await capasNuevas(page, () => once.click())).filter((c) => VIGILADAS.test(c))).toEqual([]);
});

test("del resumen a «Nombre» y vuelta: el carril nunca se queda vacío mientras desliza", async ({ page }) => {
  const recibos = await abrePlan(page);
  await recibos.getByTestId("plan-review").locator(".v4-charge").first().click();
  await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await page.waitForTimeout(600);
  // Por fotograma: cuánto de la hoja tapa contenido de paso (área visible × opacidad).
  const graba = () => page.evaluate(() => {
    window.__carril = []; window.__carrilOn = true;
    const body = document.querySelector('[data-sheet="recibo-pasos"] .rp4-track').parentElement;
    const tick = () => {
      if (!window.__carrilOn) return;
      const b = body.getBoundingClientRect();
      let v = 0;
      for (const st of body.querySelectorAll(".rp4-step")) {
        const r = st.getBoundingClientRect(), w = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)), h = Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
        v += +getComputedStyle(st).opacity * (w / b.width) * Math.min(1, h / 200);
      }
      window.__carril.push(+v.toFixed(2));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const para = () => page.evaluate(() => { window.__carrilOn = false; return window.__carril; });
  await graba();
  await hoja(page).locator('[data-rp4-paso="4"] button').filter({ hasText: "Nombre" }).first().click();
  await page.waitForTimeout(700);
  const ida = await para();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  await graba();
  await hoja(page).locator(".rp4-cta").click();
  await page.waitForTimeout(700);
  const vuelta = await para();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  expect(Math.min(...ida), "ida: " + ida.join(" ")).toBeGreaterThan(0.3);
  expect(Math.min(...vuelta), "vuelta: " + vuelta.join(" ")).toBeGreaterThan(0.3);
});

test("abrir una ficha o «¿Te llega?» no rehace las capas de la página ni la del velo", async ({ page }) => {
  // Antes, `html.sheet-open .page{overflow:hidden}` dejaba de scrollear la página al abrir una hoja:
  // su capa y la de la barra de abajo se rehacían y en su móvil la barra desaparecía un instante.
  const recibos = await abrePlan(page);
  await page.waitForTimeout(600);
  const ficha = await capas(page, () => recibos.getByTestId("plan-review").locator(".v4-charge").first().click());
  expect(ficha.mueren).toEqual([]);
  expect(ficha.nacen.filter((c) => !/v4-sheet|pr6-track|pr6-step|pr6-fold/.test(c) && c !== "::before")).toEqual([]);
  await page.goBack();
  await expect(page.locator('.v4-sheet[data-sheet="recibo"]')).toHaveCount(0);
  await page.waitForTimeout(500);
  const llega = await capas(page, () => recibos.getByTestId("plan-llega").click());
  expect(llega.mueren).toEqual([]);
});

test("al bajar en Plan, nada pasa por debajo de la barra de estado", async ({ page }) => {
  // En su móvil la barra de estado es transparente: el título, Recibos/Deudas/Metas y la tarjeta
  // se veían bajo la hora y los iconos (vídeo del 7/11, 0:19-0:27).
  const recibos = await abrePlan(page);
  await page.addStyleTag({ content: ":root{--safe-top:40px !important}" });
  await page.waitForTimeout(300);
  await recibos.evaluate((el) => { el.closest(".page").scrollTop = 160; });
  await page.waitForTimeout(300);
  const arriba = await page.evaluate(() => {
    const st = document.createElement("style"); st.textContent = ".v4-plan-techo,.v4-plan-techo::before{pointer-events:auto!important}"; document.head.appendChild(st);
    const out = [10, 25, 38].map((y) => { const el = document.elementFromPoint(200, y); return el && el.closest(".v4-plan-techo") ? "techo" : (el && el.className) || "nada"; });
    st.remove(); return out;
  });
  expect(arriba).toEqual(["techo", "techo", "techo"]);
  await expect(recibos.getByTestId("plan-summary")).toBeVisible();
});

test("«Dic ›» y Deudas/Metas: la página no deja de scrollear y la vista no se apaga al entrar", async ({ page }) => {
  // Con una vista corta la página dejaba de scrollear: su capa se deshacía (pantalla en blanco un
  // instante en su móvil). Y la vista se remontaba desde opacidad 0: desaparecía un fotograma.
  const recibos = await abrePlan(page);
  await page.waitForTimeout(600);
  const nav = recibos.getByTestId("plan-mes-nav");
  const op = await page.evaluate(() => {
    window.__op = []; window.__opOn = true;
    const tick = () => { if (!window.__opOn) return; const v = document.querySelector('.page-live [data-seg="recibos"] .pr6-vistas');
      window.__op.push(v ? +getComputedStyle(v).opacity : -1); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const ida = await capas(page, () => nav.click());
  const opacidades = await page.evaluate(() => { window.__opOn = false; return window.__op; });
  expect(ida.mueren.filter((c) => /page-scroll-host|pr6-vistas/.test(c))).toEqual([]);
  expect(ida.nacen.filter((c) => /page-scroll-host|pr6-vistas/.test(c))).toEqual([]);
  expect(Math.min(...opacidades), opacidades.join(" ")).toBeGreaterThanOrEqual(0.35);
  for (const seg of ["deudas", "metas", "recibos"]) {
    const r = await capas(page, () => page.locator('.v4-seg-btn[data-seg="' + seg + '"]').click());
    expect(r.mueren.filter((c) => /page-scroll-host/.test(c)), seg).toEqual([]);
  }
});

test("tema claro: el cajón cerrado no deja su sombra en el borde izquierdo", async ({ page }) => {
  const recibos = await abrePlan(page);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await expect(recibos.getByTestId("plan-summary")).toBeVisible();
  const sombras = await page.evaluate(() => [...document.querySelectorAll(".settings-push:not(.open),.settings-slide:not(.open)")].map((el) => getComputedStyle(el).boxShadow));
  expect(sombras.length).toBeGreaterThan(0);
  expect(sombras.filter((x) => x !== "none")).toEqual([]);
});
