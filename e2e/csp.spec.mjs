import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";
import { sellarCsp } from "../scripts/csp-sellar.mjs";

/* La CSP (shell.html) es una red de seguridad, pero si se pasa de estricta rompe la app EN
   SILENCIO: el navegador bloquea el recurso, no salta ninguna excepción y simplemente deja de
   funcionar algo (los precios, el login, las actualizaciones…). Y como la app va a los móviles de
   la familia por OTA, eso se descubriría tarde y mal.

   Este test abre la app de verdad y falla si el navegador bloquea CUALQUIER cosa. Si añades una
   llamada a un dominio nuevo y se te olvida ponerlo en la CSP, este test te lo dice aquí. */
function collectCspViolations(page) {
  const violations = [];
  page.on("console", (msg) => {
    const txt = msg.text();
    if (/Content Security Policy|Refused to (load|connect|execute|apply)/i.test(txt)) violations.push(txt);
  });
  // securitypolicyviolation es la señal fiable (console puede filtrarse según el navegador).
  page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations.push(`${e.violatedDirective} → ${e.blockedURI}`);
    });
  });
  return violations;
}

test("arranque: la CSP no bloquea nada de la propia app", async ({ page }) => {
  const consoleViolations = collectCspViolations(page);
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await dismissNews(page);
  await page.waitForTimeout(2500);   // deja correr el trabajo diferido (FX, Sentry, OTA)

  const fromEvent = await page.evaluate(() => window.__cspViolations || []);
  expect(
    [...consoleViolations, ...fromEvent],
    "La CSP de src/shell.html está bloqueando algo que la app necesita",
  ).toEqual([]);
});

test("la CSP está puesta y cierra lo que tiene que cerrar", async ({ page }) => {
  await page.goto("/");
  const csp = await page.evaluate(() => {
    const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return m ? m.getAttribute("content").replace(/\s+/g, " ") : null;
  });
  expect(csp, "falta la <meta> de CSP en shell.html").toBeTruthy();
  // Lo que de verdad frena una exfiltración: nada de plugins, nada de <base> inyectado y una
  // lista cerrada de destinos de red (nunca un comodín).
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'none'");
  expect(csp).toContain("form-action 'self'");
  expect(csp).toMatch(/connect-src [^;]*sfyfjagbnhbplrljpbvh\.supabase\.co/);
  expect(csp, "connect-src con comodín = la CSP no sirve de nada").not.toMatch(/connect-src [^;]*\*/);
});

/* ---------- La CSP SELLADA, la que de verdad sale a los móviles (SEG-07, 18/11/2026) ----------
   `deploy.yml` y `beta.yml` cambian `'unsafe-inline'` por la huella de cada script inline
   (`scripts/csp-sellar.mjs`) como último paso. El resto de e2e corre con la CSP sin sellar porque
   reescriben el HTML al servirlo; aquí se sella el index de verdad y se arranca, para que una
   huella mal calculada (saltos de línea, un script que el recorrido no ve…) se vea aquí y no en
   el móvil de nadie. Sin service worker: con él delante `page.route` no ve la navegación. */
test.describe("CSP sellada", () => {
  test.use({ serviceWorkers: "block" });

  const servirSellado = async (page) => {
    const html = sellarCsp(readFileSync(new URL("../public/index.html", import.meta.url), "utf8")).html;
    await page.route((url) => url.pathname === "/" || url.pathname === "/index.html",
      (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
  };

  test("la app arranca entera sin 'unsafe-inline' y el navegador no bloquea nada", async ({ page }) => {
    const consoleViolations = collectCspViolations(page);
    const errores = [];
    page.on("pageerror", (e) => errores.push(e.message));
    await servirSellado(page);
    await seedLoggedInDashboard(page);
    await page.goto("/");
    await dismissNews(page);
    await expect(page.locator(".botnav")).toBeVisible();

    // Las huellas que puso el sellado son EXACTAMENTE las de los scripts que ve el navegador.
    const cuadre = await page.evaluate(async () => {
      const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
      const src = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src "));
      const puestas = src.split(/\s+/).filter((p) => p.startsWith("'sha256-")).sort();
      const reales = [];
      for (const s of document.querySelectorAll("script:not([src])")) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s.textContent));
        reales.push("'sha256-" + btoa(String.fromCharCode(...new Uint8Array(buf))) + "'");
      }
      return { inline: src.includes("'unsafe-inline'"), puestas, reales: [...new Set(reales)].sort() };
    });
    expect(cuadre.inline, "la CSP sellada no puede llevar 'unsafe-inline'").toBe(false);
    expect(cuadre.puestas).toEqual(cuadre.reales);

    // Las cuatro pestañas montan y pintan: si un script se hubiera quedado fuera, no habría app.
    for (const tab of ["gastos", "plan", "cartera", "inicio"]) {
      await page.locator(`.botnav-tab[data-tour="${tab}"]`).click();
      await expect(page.locator(`.botnav-tab[data-tour="${tab}"]`)).toHaveClass(/active/);
    }
    await page.waitForTimeout(2500);   // trabajo diferido: FX, Sentry, OTA

    const fromEvent = await page.evaluate(() => window.__cspViolations || []);
    expect([...consoleViolations, ...fromEvent], "la CSP sellada bloquea algo de la app").toEqual([]);
    expect(errores, "la app lanzó errores con la CSP sellada").toEqual([]);
  });

  test("un script inline que no viene del build NO se ejecuta", async ({ page }) => {
    // Es para lo que sirve todo esto: si alguien consiguiera meter un <script> en la página, el
    // navegador no lo ejecutaría. Se inyecta como lo haría un HTML colado, por innerHTML no vale
    // (nunca ejecuta), así que va como elemento nuevo.
    await servirSellado(page);
    await seedLoggedInDashboard(page);
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible();
    const ejecutado = await page.evaluate(() => new Promise((resolve) => {
      window.__colado = false;
      const s = document.createElement("script");
      s.textContent = "window.__colado = true;";
      document.body.appendChild(s);
      setTimeout(() => resolve(window.__colado), 300);
    }));
    expect(ejecutado).toBe(false);
  });
});

/* ---------- Dentro de un marco no se monta (SEG-21, 18/11/2026) ----------
   Una web ajena podría cargar la app en un <iframe> invisible y hacer que se pulse aquí creyendo
   pulsar allí. GitHub Pages no manda X-Frame-Options y `frame-ancestors` no vale en <meta>, así
   que lo corta `12-boot.js`: en un marco, página en blanco y la app sin montar. */
test("dentro de un iframe la app no se monta", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.route((url) => url.pathname === "/marco-ajeno.html",
    (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8",
      body: '<!doctype html><title>marco</title><iframe id="f" src="/" style="width:400px;height:700px"></iframe>' }));
  await page.goto("/marco-ajeno.html");
  const marco = page.frameLocator("#f");
  await expect(marco.locator("#root")).toBeAttached({ timeout: 15_000 });
  await page.waitForTimeout(2500);
  await expect(marco.locator(".botnav")).toHaveCount(0);
  const oculto = await page.frames().find((f) => f !== page.mainFrame())
    .evaluate(() => getComputedStyle(document.documentElement).display);
  expect(oculto).toBe("none");

  // Y fuera de un marco, la misma página arranca normal (que el guardián no se pase de celoso).
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
});
