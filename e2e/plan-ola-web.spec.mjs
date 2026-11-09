/* INC-2709-03 / UX-08: precondiciones WEB de la ola. Chromium de escritorio no demuestra
   el stretch nativo Android. Sí demuestra que una hija fixed se desplace con el scroll del
   padre si éste conserva una capa: la cabecera quedaba 21 px fuera de pantalla. Toques reales,
   también al abrir categoría; click de ratón no recorre el reset táctil del cierre lateral. */
import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { seedLoggedInDashboard, installFixtureClock, dismissNews } from "./fixtures.mjs";

test.use({ viewport: { width: 393, height: 740 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
const root = page => page.locator("[data-bills-manage]");
const child = page => page.locator("[data-bills-manage] > .settings-push");
const financial = page => page.evaluate(() => ({ main: localStorage.getItem("micartera_v3"), expenses: localStorage.getItem("micartera_v3_exp") }));
const geometry = page => root(page).evaluate(el => {
  const metric = n => { const c = getComputedStyle(n), r = n.getBoundingClientRect(); return {
    y: r.y, h: r.height, scrollTop: n.scrollTop, max: n.scrollHeight - n.clientHeight,
    transform: c.transform, willChange: c.willChange, overscrollY: c.overscrollBehaviorY,
    touchAction: c.touchAction, inlineTransform: n.style.transform, cls: n.className,
  }; };
  return { parent: metric(el), child: el.querySelector(":scope > .settings-push") ? metric(el.querySelector(":scope > .settings-push")) : null };
});
async function begin(page, info) {
  const origin = new URL(info.project.use.baseURL).origin;
  await page.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort("blockedbyclient"));
  await installFixtureClock(page);
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "sab", ent: "sabadell", name: "Cuenta sintética", value: 2000, role: "fijos" }],
    fixed: Array.from({ length: 24 }, (_, i) => ({ id: "ola-" + i, name: "Recibo sintético " + (i + 1), amount: 12.34 + i / 100, freq: "mes", account: "sabadell", day: 1 + i % 26 })),
    debts: [{ id: "debt", name: "Cuota sintética", monthly: 50, value: 1000, anchor: 1000, account: "sabadell", day: 10 }],
    flows: [{ id: "income", name: "Ingreso sintético", amount: 1800, kind: "income", to: "sabadell", when: "last" }],
    oneoffs: [{ id: "once", name: "Puntual sintético", amount: 25, month: 9, year: 2026, account: "sabadell" }],
    settings: { autoPrices: false, theme: "green", lang: "es" },
  });
  const response = await page.goto("/");
  const htmlSHA = crypto.createHash("sha256").update(await response.body()).digest("hex");
  if (process.env.WAVE_EXPECTED_HTML) expect(htmlSHA).toBe(process.env.WAVE_EXPECTED_HTML);
  await page.waitForFunction(() => !document.getElementById("mc-load") && document.querySelector(".botnav"));
  await dismissNews(page);
  // La copia local automática del arranque sella lastBackup a los ~4 s. No atribuir esa
  // escritura natural de metadatos a la navegación ni rebajar el oracle de persistencia.
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("micartera_v3") || "{}").lastBackup === "2026-09-26", null, { timeout: 15000 });
  await page.locator('.botnav-tab[data-tour="plan"]').tap();
  await page.locator('.v4-screen > [data-seg="recibos"] button.link').filter({ hasText: /^(Gestionar|Todos)\b/ }).tap();
  await expect(root(page)).toBeVisible(); await page.waitForTimeout(650);
  await info.attach("served-html-sha.json", { body: JSON.stringify({ htmlSHA, CPUThrottlingCalls: 0 }), contentType: "application/json" });
}
async function guard(page, info, run) {
  const before = await financial(page);
  try { await run(); } finally {
    const after = await financial(page);
    await info.attach("financial-raw.json", { body: JSON.stringify({ before, after, exact: JSON.stringify(before) === JSON.stringify(after) }), contentType: "application/json" });
    expect(after, "abrir/desplazar/cerrar no debe reescribir la cartera").toEqual(before);
  }
}
async function scrollHub(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 220, y: 570 }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 220, y: 570 - i * 50 }] });
    await page.waitForTimeout(24);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1600); await cdp.detach();
  expect((await geometry(page)).parent.scrollTop, "el caso necesita el padre desplazado con el dedo").toBeGreaterThan(10);
  // Un fling puede seguir activo aunque ya esté contra el borde. Detenerlo con un toque
  // neutro real antes de pedir navegación: el primer toque de Android/Chromium lo consume.
  // Desde la v6 las filas de Tus recibos ocupan todo el ancho: el punto neutro se busca (el margen
  // izquierdo del hub suele serlo) en vez de fijarlo.
  const neutral = await page.evaluate(() => { for (const y of [180, 220, 260, 140]) for (const x of [330, 8, 200]) {
    const el = document.elementFromPoint(x, y); if (el && !el.closest("button,input,select,textarea,a,label")) return { x, y }; } return null; });
  expect(neutral).not.toBeNull(); await page.touchscreen.tap(neutral.x, neutral.y); await page.waitForTimeout(180);
}
async function category(page, info) {
  await root(page).evaluate(el => {
    window.__olaTap = [];
    for (const type of ["touchstart", "touchend", "click"]) el.addEventListener(type, e => {
      window.__olaTap.push({ type, target: e.target.className, group: e.target.closest("[data-group]")?.dataset.group });
    }, { capture: true, passive: true });
  });
  // Desde la v6 (SPEC §3) la única pantalla hija de Tus recibos es «¿Me lo puedo permitir?».
  await root(page).locator('button.v4-bills-afford').tap();
  try { await expect(child(page)).toBeVisible(); } finally {
    await info.attach("category-touch-events.json", { body: JSON.stringify(await page.evaluate(() => window.__olaTap)), contentType: "application/json" });
  }
  await page.waitForTimeout(500);
  const g = await geometry(page);
  await info.attach("category-geometry.json", { body: JSON.stringify(g), contentType: "application/json" });
  await info.attach("category.png", { body: await page.screenshot(), contentType: "image/png" });
  expect(g.parent.transform).toBe("none"); expect(g.parent.willChange).toBe("auto");
  expect(Math.abs(g.child.y), "la hija fixed no debe desplazarse con el scroll del padre").toBeLessThan(1);
  expect(g.child.transform).toBe("none"); expect(g.child.willChange).toBe("auto");
  await child(page).locator(".settings-push-h .back").tap();
  await expect(child(page)).toHaveCount(0);
  await root(page).locator(":scope > .v4-bills-hub > .settings-push-h .back").tap();
  await expect(root(page)).toHaveCount(0);
}

test("INC270903: Gestionar es un scroller sin capa en reposo", async ({ page }, info) => {
  await begin(page, info); await guard(page, info, async () => {
    const g = await geometry(page); await info.attach("manage-geometry.json", { body: JSON.stringify(g), contentType: "application/json" });
    expect(g.parent.transform).toBe("none"); expect(g.parent.willChange).toBe("auto");
    expect(g.parent.overscrollY).toBe("auto"); expect(g.parent.touchAction).toBe("auto");
  });
});
for (const reduced of [false, true]) test("INC270903: categoría anclada al viewport, " + (reduced ? "movimiento reducido" : "normal"), async ({ page }, info) => {
  if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  await begin(page, info); await guard(page, info, async () => { await scrollHub(page); await category(page, info); });
});
test("INC270903: cancelar y reanudar no deja capa ni limpia un arrastre vivo", async ({ page }, info) => {
  await begin(page, info); await guard(page, info, async () => {
    const cdp = await page.context().newCDPSession(page);
    const send = (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchCancel" ? [] : [{ x, y: 420 }] });
    await send("touchStart", 160); await send("touchMove", 220); await page.waitForTimeout(70); await send("touchCancel");
    await page.waitForTimeout(60);
    await send("touchStart", 160); await send("touchMove", 240); await page.waitForTimeout(350);
    const during = await root(page).evaluate(el => ({ x: new DOMMatrixReadOnly(getComputedStyle(el).transform).m41, dragging: el.classList.contains("mc-page-dragging") }));
    await info.attach("during-restarted-drag.json", { body: JSON.stringify(during), contentType: "application/json" });
    expect(during.dragging).toBe(true); expect(during.x).toBeGreaterThan(60);
    await send("touchCancel"); await page.waitForTimeout(400); await cdp.detach();
    const after = await geometry(page); await info.attach("after-cancel.json", { body: JSON.stringify(after), contentType: "application/json" });
    expect(after.parent.inlineTransform).toBe(""); expect(after.parent.transform).toBe("none"); expect(after.parent.willChange).toBe("auto");
    await scrollHub(page); await category(page, info);
  });
});
