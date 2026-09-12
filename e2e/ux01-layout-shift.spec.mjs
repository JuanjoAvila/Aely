/* UX-01 — el «tironcillo» al pasar de pestaña (medido 10/9 en su OnePlus).
 *
 * NO es frames perdidos ni longtasks: con su dedo, 6.046 frames a 120 Hz y CERO >16,7 ms.
 * Los deltas de rAF NO distinguen el caso malo. El instrumento válido es layout-shift /
 * geometría: al poner/quitar `.page-scroll-host` el contenido no puede saltar.
 *
 * 12/9: el arreglo UX-01 movió el safe-top a `top` + `height:auto` y mató la ola nativa
 * (bisección prod/beta, commit 37694684). Se vuelve a la caja a pantalla (`inset:0` +
 * `height:100%`) con el safe-top en el PADDING del host — como prod / Ajustes. El Y del
 * contenido en reposo sigue siendo safe-top+10 (= `.app` safe-top+4 + `.page` 6px).
 *
 * Brief: docs/briefs/ux01-tironcillo-medido-2026-09-10.md
 * Condición de publish: re-medir layout-shift en SU móvil. Este e2e vigila la geometría
 * estable en Chromium; no sustituye esa medida. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function appLista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

test("page-scroll-host: caja a pantalla; padding = safe-top+10 (= .app+.page)", async ({ page }) => {
  /* Fuerza un safe-top grande para que un descuadre (44 px) no quede enmascarado por 0. */
  await page.addInitScript(() => {
    document.documentElement.style.setProperty("--safe-top", "44px");
  });
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);

  await expect(page.locator(".page.page-scroll-host")).toBeVisible({ timeout: 15_000 });

  /* La app pisa --safe-top al arrancar (inset nativo / 0 en Chromium). Lo reponemos
     DESPUÉS del boot para que un descuadre de 44 px no quede enmascarado. */
  const geo = await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-top", "44px");
    const host = document.querySelector(".page.page-scroll-host");
    const app = document.querySelector(".app");
    if (!host || !app) return null;
    const hs = getComputedStyle(host);
    const as = getComputedStyle(app);
    const probe =
      host.querySelector(".v4-screen, .v4-gastos-summary, .serif, h1") || host.firstElementChild;
    const contentTop = probe
      ? probe.getBoundingClientRect().top
      : host.getBoundingClientRect().top + parseFloat(hs.paddingTop);
    const appPad = parseFloat(as.paddingTop);
    const hostPad = parseFloat(hs.paddingTop);
    /* Fuera del host el contenido iría en appPad + 6 (.page). Misma cifra que hostPad. */
    return {
      hostPadTop: hs.paddingTop,
      hostTop: hs.top,
      hostPos: hs.position,
      appPadTop: as.paddingTop,
      contentTop,
      steadyY: appPad + 6,
      hostPad,
    };
  });

  expect(geo, "hace falta .page-scroll-host en reposo").toBeTruthy();
  expect(geo.hostPos).toBe("fixed");
  /* Caja a pantalla completa (condición medida de la ola nativa). */
  expect(geo.hostTop).toBe("0px");
  expect(geo.hostPadTop).toBe("54px"); /* 44 + 10 */
  expect(geo.appPadTop).toBe("48px"); /* 44 + 4 */
  expect(
    Math.abs(geo.contentTop - geo.hostPad),
    `contenido a y=${geo.contentTop}, esperado hostPad=${geo.hostPad}`
  ).toBeLessThan(2);
  expect(
    Math.abs(geo.contentTop - geo.steadyY),
    `contenido a y=${geo.contentTop}, esperado app+page=${geo.steadyY}`
  ).toBeLessThan(2);
});

test("entrar/salir de page-scroll-host: sin salto vertical del contenido", async ({ page }) => {
  await page.addInitScript(() => {
    document.documentElement.style.setProperty("--safe-top", "44px");
  });
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  await expect(page.locator(".page.page-scroll-host")).toBeVisible({ timeout: 15_000 });

  /* Reproduce la transición de leaveScrollHost → enterScrollHost midiendo el Y del
     primer bloque de contenido. Antes del arreglo UX-01: ~44 px. Tras restaurar ola
     con padding (no top): debe seguir <2 px.
     No depende del gesto (el desliz lo cubre swipe-pestanas); mide la geometría CSS. */
  const deltas = await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-top", "44px");
    const track = document.querySelector(".track");
    const host = document.querySelector(".page.page-scroll-host");
    if (!track || !host) return { error: "sin host" };
    const probe =
      host.querySelector(".v4-screen, .v4-gastos-summary, .serif, h1") || host.firstElementChild;
    if (!probe) return { error: "sin probe" };

    const y = () => probe.getBoundingClientRect().top;
    const out = [];
    const y0 = y();

    /* leave: quitar host + aparcar → transform (como leaveScrollHost) */
    const w = track.offsetWidth || window.innerWidth;
    const leftPx = parseFloat(track.style.left);
    const i = !isNaN(leftPx) ? Math.round(-leftPx / w) : 0;
    track.style.left = "";
    track.classList.remove("scroll-host-park");
    track.style.transform = "translate3d(" + -(i * w) + "px,0,0)";
    for (let k = 0; k < track.children.length; k++) {
      if (track.children[k].classList) track.children[k].classList.remove("page-scroll-host");
    }
    out.push(Math.abs(y() - y0));

    /* enter: host de nuevo en la pestaña i */
    track.classList.add("scroll-host-park");
    track.style.transform = "none";
    track.style.left = -(i * w) + "px";
    for (let k = 0; k < track.children.length; k++) {
      if (!track.children[k].classList) continue;
      track.children[k].classList.toggle("page-scroll-host", k === i);
    }
    out.push(Math.abs(y() - y0));

    return { y0, deltas: out, max: Math.max.apply(null, out) };
  });

  expect(deltas.error, JSON.stringify(deltas)).toBeUndefined();
  expect(
    deltas.max,
    `salto vertical al leave/enter host: ${deltas.max}px (y0=${deltas.y0}, deltas=${deltas.deltas})`
  ).toBeLessThan(2);
});
