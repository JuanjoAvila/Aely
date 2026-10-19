/* INC-2709-03 / UX-08 · UN SOLO CANDIDATO A SCROLLER RAÍZ (19/10).
 *
 * En la WebView de Android la ola nativa solo la dibuja el scroller RAÍZ. Un `position:fixed` a
 * pantalla completa que desplaza pasa a ser raíz implícita (así sale en Plan y Gastos con el
 * `.page-scroll-host`), pero Chromium exige que sea el ÚNICO candidato válido:
 * `RootScrollerController::ImplicitRootScrollerFromCandidates` devuelve null con dos o más
 * («Only promote an implicit root scroller if we have a unique match»). Con Gestionar abierto
 * seguía desplazable debajo el host de Plan, y con una categoría también el hub: dos y tres
 * candidatos, ninguno raíz, ninguna ola, por mucho `overscroll-behavior:auto` que llevaran.
 *
 * Chromium no expone qué elemento es la raíz efectiva (ni getLayoutMetrics ni los eventos de
 * scroll lo distinguen en headless), así que el oráculo replica `IsValidImplicit` desde el DOM:
 * desplaza (overflow auto/scroll con recorrido), ocupa el viewport exacto con un rectángulo,
 * opacidad 1, visible y ningún bloque contenedor que recorte. Debe salir UNO y ser lo que se ve. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, installFixtureClock, dismissNews } from "./fixtures.mjs";

const hub = "[data-bills-manage]", child = hub + " > .settings-push", plan = ".page.page-scroll-host";

function candidates(page) {
  return page.evaluate(() => {
    const W = innerWidth, H = innerHeight, out = [];
    // Bloque contenedor de un `fixed`: el viewport salvo ancestro con transform/filter/will-change/contain.
    const cbOf = (el) => {
      const pos = getComputedStyle(el).position;
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a);
        const crea = s.transform !== "none" || s.filter !== "none" || /transform|filter/.test(s.willChange) || /paint|layout|strict|content/.test(s.contain);
        if (pos === "fixed" ? crea : (crea || s.position !== "static")) return a;
      }
      return null;
    };
    for (const el of document.querySelectorAll("body *")) {
      const c = getComputedStyle(el);
      if (!/(auto|scroll)/.test(c.overflowY) || el.scrollHeight <= el.clientHeight) continue;
      const r = el.getBoundingClientRect();
      if (Math.round(r.x) !== 0 || Math.round(r.y) !== 0 || Math.round(r.width) !== W || Math.round(r.height) !== H) continue;
      if (c.opacity !== "1" || c.visibility !== "visible" || c.transform !== "none") continue;
      let recorta = false;
      for (let a = cbOf(el); a; a = cbOf(a)) { const s = getComputedStyle(a); if (s.overflow !== "visible" || s.clipPath !== "none") { recorta = true; break; } }
      if (recorta) continue;
      out.push(el.matches("[data-bills-manage]") ? "hub" : el.matches("[data-bills-manage] > .settings-push") ? "child" : el.matches(".page-scroll-host") ? "plan" : String(el.className));
    }
    return out;
  });
}
// El `mc-page-enter` anima opacidad: hasta que acaba, Chromium tampoco la promociona.
const quieto = (page) => page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === "running" && /mcPageEnter|v4BillsIn/.test(a.animationName || "")));

test("Gestionar plan y su categoría son el ÚNICO candidato a scroller raíz, como Plan", async ({ page }, info) => {
  const origin = new URL(info.project.use.baseURL).origin;
  await page.route("**/*", (r) => (new URL(r.request().url()).origin === origin ? r.continue() : r.abort("blockedbyclient")));
  await installFixtureClock(page);
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "sab", ent: "sabadell", name: "Cuenta sintética", value: 2000, role: "fijos" }],
    fixed: Array.from({ length: 32 }, (_, i) => ({ id: "ola-" + i, name: "Recibo sintético " + (i + 1), amount: (1234 + i) / 100, freq: "mes", account: "sabadell", day: 27 })),
    settings: { autoPrices: false, theme: "green", lang: "es" },
  });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load") && document.querySelector(".botnav"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').tap();
  await expect(page.locator(plan)).toBeVisible();
  await expect.poll(() => candidates(page), { message: "referencia: Plan, donde la ola sí sale" }).toEqual(["plan"]);

  await page.locator('.v4-screen > [data-seg="recibos"] button.link').filter({ hasText: /^Gestionar$/ }).tap();
  await expect(page.locator(hub)).toBeVisible(); await quieto(page);
  // Plan tapado deja de desplazar con el dedo, pero `hidden` guarda su posición para la vuelta.
  const planTop = await page.evaluate((s) => { const p = document.querySelector(s); p.scrollTop = 40; return p.scrollTop; }, plan);
  expect(planTop).toBeGreaterThan(0);
  await expect.poll(() => candidates(page), { message: "Gestionar: Plan debajo no puede seguir compitiendo" }).toEqual(["hub"]);

  await page.locator(hub + ' button[data-group="serv"]').tap();
  await expect(page.locator(child)).toBeVisible(); await quieto(page);
  await expect.poll(() => candidates(page), { message: "categoría: ni Plan ni el hub" }).toEqual(["child"]);

  await page.keyboard.press("Escape");
  await expect(page.locator(child)).toHaveCount(0); await quieto(page);
  await expect.poll(() => candidates(page), { message: "volver al hub le devuelve el scroll" }).toEqual(["hub"]);

  await page.keyboard.press("Escape");
  await expect(page.locator(hub)).toHaveCount(0);
  await expect.poll(() => candidates(page), { message: "al cerrar, Plan vuelve a ser la raíz" }).toEqual(["plan"]);
  expect(await page.evaluate((s) => document.querySelector(s).scrollTop, plan), "Plan conserva su posición").toBe(planTop);
});
