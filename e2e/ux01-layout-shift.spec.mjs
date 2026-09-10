/* UX-01 — el «tironcillo» al pasar de pestaña (medido 10/9 en su OnePlus).
 *
 * NO es frames perdidos ni longtasks: con su dedo, 6.046 frames a 120 Hz y CERO >16,7 ms.
 * Los deltas de rAF NO distinguen el caso malo. El instrumento válido es layout-shift /
 * geometría: al poner/quitar `.page-scroll-host` cambiaban a la vez `position` y
 * `padding-top` (safe-top+10 ↔ 6) → salto de ~44 px en `.v4-screen` (y:94→50).
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

test("page-scroll-host: mismo padding que .page; top = padding de .app", async ({ page }) => {
  /* Fuerza un safe-top grande para que un descuadre (44 px) no quede enmascarado por 0. */
  await page.addInitScript(() => {
    document.documentElement.style.setProperty("--safe-top", "44px");
  });
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);

  await expect(page.locator(".page.page-scroll-host")).toBeVisible({ timeout: 15_000 });

  const geo = await page.evaluate(() => {
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
    /* En reposo: contenido = padding de .app + padding del host (antes: appPad se
       duplicaba dentro del padding del host y al salir saltaba 44 px). */
    return {
      hostPadTop: hs.paddingTop,
      hostTop: hs.top,
      hostPos: hs.position,
      appPadTop: as.paddingTop,
      contentTop,
      expectedTop: appPad + hostPad,
    };
  });

  expect(geo, "hace falta .page-scroll-host en reposo").toBeTruthy();
  expect(geo.hostPos).toBe("fixed");
  expect(geo.hostPadTop).toBe("6px");
  expect(geo.hostTop).toBe(geo.appPadTop);
  expect(
    Math.abs(geo.contentTop - geo.expectedTop),
    `contenido a y=${geo.contentTop}, esperado app+pad=${geo.expectedTop}`
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
     primer bloque de contenido. Antes del arreglo: ~44 px. Con él: <2 px.
     No depende del gesto (el desliz lo cubre swipe-pestanas); mide la geometría CSS. */
  const deltas = await page.evaluate(() => {
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
