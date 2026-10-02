import fs from "node:fs";
import crypto from "node:crypto";
import { betaRevision } from "../scripts/beta-revisions.mjs";
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* «Code review» pero probando la app (petición 2026-07-24).
 *
 * Lo que hay que blindar es la REGLA, no la estética: no se puede aprobar una beta con cosas sin
 * probar o marcadas como que fallan. Si esa puerta se abre, el botón deja de significar nada y
 * acabaría subiendo a producción algo roto — que lo ven el padre y la pareja.
 *
 * La ENTRADA al panel está detrás de `is_admin`, que lo decide el servidor (profiles) y el mock de
 * Supabase de los tests devuelve null → la sección Dev no se pinta. Por eso aquí se monta el panel
 * directamente: lo que hay que probar es la REGLA de aprobación, no el menú que lleva a ella. */

async function abrirRevisionBeta(page, lang) {
  await seedLoggedInDashboard(page, lang?{settings:{autoPrices:false,theme:"green",lang:lang}}:{});
  await page.addInitScript(() => { localStorage.setItem("_mcChannel", "beta"); });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  // NOTAS-BUNDLE: el histórico ya no va en el index; sin esto betaChecklist sale vacío.
  await page.waitForFunction(() => Array.isArray(window.RELEASE_NOTES) && window.RELEASE_NOTES.length > 0, null, { timeout: 10_000 });
}

/* Tras promote a prod con nota única, TODAS las entradas llevan `tandas:[]` → panel a 0
 * (correcto). Los tests de REGLA (aprobar, heredar, progreso…) necesitan puntos: se borra
 * `tandas` de esa versión para recuperar la tanda implícita «todo» (≠ array vacío).
 *
 * ⚠ El bundle de e2e lleva `APP_VERSION:"dev"`. Si el panel llega a leer producción real
 * (Pages), `mcIsNewer(…,"dev")` es NaN y la ronda se llena de notas con `tandas:[]` → vacío.
 * Por eso aquí se sella una versión numérica y se anula prod salvo que el test la fije después. */
async function seedImplicitChecklist(page, opts) {
  const ver = opts && opts.ver;
  const minItems = (opts && opts.minItems) || 3;
  await page.evaluate(({ ver, minItems }) => {
    if (ver) {
      CONFIG.APP_VERSION = ver;
    } else if (!CONFIG.APP_VERSION || CONFIG.APP_VERSION === "dev" || /[^0-9.]/.test(String(CONFIG.APP_VERSION))) {
      CONFIG.APP_VERSION = ((RELEASE_NOTES[0] && RELEASE_NOTES[0].v) || "4.19.106") + ".7";
    }
    const base = mcVerBase(CONFIG.APP_VERSION);
    let notes = (RELEASE_NOTES || []).find((n) => n && n.v === base);
    if (!notes) {
      notes = {
        v: base, d: "e2e",
        t: { es: "e2e", en: "e2e", ca: "e2e" },
        items: { es: [], en: [], ca: [] },
      };
      RELEASE_NOTES.unshift(notes);
    }
    delete notes.tandas;
    if (!notes.items || typeof notes.items !== "object") notes.items = { es: [], en: [], ca: [] };
    ["es", "en", "ca"].forEach(function (lang) {
      const arr = Array.isArray(notes.items[lang]) ? notes.items[lang] : (notes.items[lang] = []);
      while (arr.length < minItems) arr.push("punto sintético e2e " + arr.length);
    });
    window._mcProdVersion = function () { return Promise.resolve(null); };
  }, { ver: ver || null, minItems });
}

test("el panel de revisión saca la checklist de las notas de la versión", async ({ page }) => {
  await abrirRevisionBeta(page);

  // Se abre el panel directamente (la ruta por Ajustes depende del perfil admin del servidor).
  const hayRonda = await page.evaluate(() =>
    (RELEASE_NOTES || []).some((n) => Array.isArray(n.tandas) && n.tandas.length > 0));
  const items = await page.evaluate(() => betaChecklist(CONFIG.APP_VERSION).items.length);
  if (hayRonda) {
    expect(items, "con ronda viva tiene que haber checklist").toBeGreaterThan(0);
  } else {
    // Promote 4.19.106: todo en prod → `tandas:[]` en todas → panel vacío a propósito.
    expect(items, "sin ronda viva el panel tiene que quedar a 0").toBe(0);
  }
});

test("4.26.10 aprobada ya no pide temas ni repite veredictos antiguos", async ({ page }) => {
  await abrirRevisionBeta(page);
  const ronda = await page.evaluate(() => {
    const previas = RELEASE_NOTES.filter(function(n){ return /^4\.26\.(?:[0-9])$/.test(n.v); });
    const pack = betaChecklist("4.26.10.1", "4.25.7");
    return {
      previas: previas.map(function(n){ return {v:n.v, pendientes:(n.tandas||[]).length}; }),
      ids: pack.tandas.map(function(g){ return g.id; }),
      pasos: pack.items.length,
    };
  });
  expect(ronda.previas).toHaveLength(10);
  expect(ronda.previas.every(function(n){ return n.pendientes===0; }),
    "los pasos ya evaluados de la 4.26.9.1 no deben repetirse").toBe(true);
  expect(ronda.ids).toEqual([]);
  expect(ronda.pasos).toBe(0);
});

test("4.26.11 aprobada y publicada ya no vuelve a pedir Ajustes", async ({ page }) => {
  await abrirRevisionBeta(page);
  const ronda = await page.evaluate(() => {
    const pack = betaChecklist("4.26.11.1", "4.25.7");
    return { ids:pack.tandas.map(function(g){ return g.id; }), pasos:pack.items.length };
  });
  expect(ronda.ids).toEqual([]);
  expect(ronda.pasos).toBe(0);
});

test("betaChecklist casa la beta (4.8.0.17) con las notas de su versión base (4.8.0)", async ({ page }) => {
  await abrirRevisionBeta(page);
  const r = await page.evaluate(() => {
    const base = betaChecklist("4.8.0");
    const beta = betaChecklist("4.8.0.17");   // así versiona el workflow beta.yml
    return { base: base.v, beta: beta.v, mismos: base.items.length === beta.items.length };
  });
  expect(r.beta).toBe(r.base);
  expect(r.mismos, "una beta y su versión base deben compartir checklist").toBe(true);
});

test("no se puede aprobar con cosas sin probar ni con fallos marcados", async ({ page }) => {
  await abrirRevisionBeta(page);
  await seedImplicitChecklist(page);

  // Monta el panel a mano: es la unidad que interesa, sin depender del gate de admin del servidor.
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "e2e-beta";
    document.body.appendChild(host);
    ReactDOM.createRoot(host).render(
      React.createElement(BetaReviewPanel, { onClose: () => {}, showToast: () => {} }),
    );
  });
  const panel = page.locator(".beta-review");
  await expect(panel).toBeVisible();

  /* Desde 4.13.0 hay un botón por TANDA, no uno para toda la beta, así que la regla se comprueba
     dentro de una: es la misma puerta, solo que ahora hay varias. Que un fallo en una tanda no
     bloquee a las otras lo prueba el test de más abajo. */
  const tanda = panel.locator(".beta-tanda").first();
  const aprobar = tanda.getByRole("button", { name: /Aprobar esta (beta|tanda)/i });
  const items = tanda.locator(".beta-item");
  const n = await items.count();
  expect(n).toBeGreaterThan(0);

  // 1) Recién abierto: nada probado → aprobar deshabilitado.
  await expect(aprobar).toBeDisabled();
  await expect(tanda).toContainText(/Te quedan .* por probar/i);

  // 2) Todo bien menos uno marcado como que falla → sigue deshabilitado, y sale el aviso.
  for (let i = 0; i < n; i++) await items.nth(i).getByRole("button", { name: /Va bien/i }).click();
  await expect(aprobar).toBeEnabled();                       // todo ok → sí se puede

  /* Desde 2026-09-10 un punto en ✓ se ENCOGE a una línea, así que para cambiarle el veredicto hay
     que volver a abrirlo de un toque. Es un toque de más en el camino raro (rectificar algo que ya
     diste por bueno) a cambio de no bajar media pantalla en el camino normal, que es el que él hace
     cinco veces por tanda. La regla de aprobación no cambia, que es lo que vigila este test. */
  const reabrir = async (i) => {
    if (await items.nth(i).evaluate((el) => el.classList.contains("beta-item-done"))) await items.nth(i).click();
  };
  await reabrir(0);
  await items.nth(0).getByRole("button", { name: /Falla/i }).click();
  await expect(aprobar).toBeDisabled();                      // uno roto → no se puede
  await expect(tanda).toContainText(/arréglalo antes de aprobar/i);

  // Y al marcar que falla aparece el campo para decir QUÉ falla (que es el valor real de esto).
  await expect(items.nth(0).locator("input")).toBeVisible();

  // 3) Desmarcar el fallo lo vuelve a habilitar.
  await items.nth(0).getByRole("button", { name: /Falla/i }).click();
  await items.nth(0).getByRole("button", { name: /Va bien/i }).click();
  await expect(aprobar).toBeEnabled();

  // 4) «No lo puedo probar» NO bloquea (2026-07-26). Hay cosas que no dependen de él —que llegue
  //    la nómina, que el banco mande una notificación, un icono que solo se ve con la APK— y antes
  //    contaban como pendientes: o mentía marcando «va bien» o la beta se quedaba sin veredicto.
  await reabrir(0);
  await items.nth(0).getByRole("button", { name: /No lo puedo probar/i }).click();
  await expect(aprobar).toBeEnabled();
});

/* ¿YA ESTÁ EN PRODUCCIÓN? — y el NaN que casi lo estropea.
 *
 * Petición suya (2026-07-28): «cuando suba algo a prod, la beta no haya nada para aprobar porque
 * lógicamente ya lo hice para que subiera prod». Promocionar ES aprobar.
 *
 * ⚠ ESTE TEST EXISTE POR UN FALLO QUE SOLO SE VIO EN CI. En local, la petición a Pages no sale
 * (no hay red hacia fuera), así que `_mcProdVersion` devolvía `null` y la rama nueva NO se
 * ejecutaba nunca: los 94 tests pasaban en verde sin haberla tocado. En CI sí sale, y allí el
 * bundle todavía va sin sellar (`APP_VERSION:"dev"`, porque los tests corren ANTES de
 * `stamp-version`). `_mcNewerVer` compara con `parseInt`, `parseInt("dev")` es `NaN`, y `NaN`
 * pierde todas las comparaciones → la app se declaraba «ya en producción» y escondía el veredicto
 * entero. La misma trampa del NaN que en la 4.9.2 dejó un móvil sin actualizarse nunca.
 *
 * Por eso aquí se FIJA la versión de producción con un doble, en vez de depender de la red: así
 * el caso se prueba igual en el portátil que en CI. */
async function conProduccionEn(page, version, delayMs = 0) {
  // La app pide versión web y APK estable a la vez. Salvo que el test fije la APK, se da por
  // entregada: si no, las tandas nativas reales se colarían en las rondas sintéticas.
  await page.evaluate(({ v, delayMs }) => {
    window._mcProdVersion = () => delayMs ? new Promise(resolve => setTimeout(() => resolve(v), delayMs)) : Promise.resolve(v);
    if (window._mcProdApk === undefined) window._mcProdApk = 9999;
    if (window._mcProdEntregas === undefined) {
      window._mcProdEntregas = { web:{}, edge:{} };
      window._mcProdApkRevisiones = {};
      RELEASE_NOTES.filter(n => !mcIsNewer(n.v,v)).forEach(n => (n.tandas||[]).forEach(g => {
        window._mcProdEntregas.web[g.id]=g.web;
        if (window._mcProdApk >= g.apk) { window._mcProdApkRevisiones[g.id]=g.native; window._mcProdEntregas.edge[g.id]=g.edge; }
      }));
    }
  }, { v: version, delayMs });
  const host = "e2e-beta-prod-" + Math.random().toString(36).slice(2, 7);
  await page.evaluate((id) => {
    const h = document.createElement("div");
    h.id = id;
    document.body.appendChild(h);
    ReactDOM.createRoot(h).render(
      React.createElement(BetaReviewPanel, { onClose: () => {}, showToast: () => {} }),
    );
  }, host);
  return page.locator(".beta-review");
}

test("con producción por DETRÁS, la beta sigue pidiendo veredicto", async ({ page }) => {
  await abrirRevisionBeta(page);
  await page.evaluate(() => { CONFIG.APP_VERSION = "4.13.0.7"; });   // una beta sellada de verdad
  await seedImplicitChecklist(page, { ver: "4.13.0.7" });
  const panel = await conProduccionEn(page, "0.0.1");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".beta-tanda").first().getByRole("button", { name: /Aprobar esta (beta|tanda)/i })).toBeVisible();
  await expect(panel).not.toContainText(/Ya está en producción/i);
});

test("con producción ya en esta versión, no se pide ningún veredicto", async ({ page }) => {
  await abrirRevisionBeta(page);
  // Sellada, y producción por delante: producción ya pasó por aquí.
  await page.evaluate(() => { CONFIG.APP_VERSION = "4.13.0.7"; });
  const panel = await conProduccionEn(page, "999.0.0");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/Ya está en producción/i);
  await expect(panel.locator(".beta-tanda")).toHaveCount(0);
  await expect(panel).not.toContainText(/\d+\/\d+/);
  await expect(panel.getByRole("button", { name: /Aprobar esta (beta|tanda)/i })).toHaveCount(0);
});

test("una versión sin sellar («dev») NO se da por aprobada sola", async ({ page }) => {
  await abrirRevisionBeta(page);
  // El bundle del repo va con APP_VERSION "dev" hasta que `stamp-version` corre. Con el NaN
  // suelto, esto escondía el veredicto en TODAS las betas que se probaran sin sellar.
  // Tip con tandas implícitas (no `[]`): si no, la ronda > prod sale vacía y el test no mide el NaN.
  await page.evaluate(() => {
    const tip = RELEASE_NOTES[0];
    if (tip) delete tip.tandas;
  });
  await page.evaluate(() => { CONFIG.APP_VERSION = "dev"; });
  const panel = await conProduccionEn(page, "4.12.1");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".beta-tanda").first().getByRole("button", { name: /Aprobar esta (beta|tanda)/i })).toBeVisible();
});

test("el progreso sobrevive a cerrar la app (se prueba durante días)", async ({ page }) => {
  await abrirRevisionBeta(page);
  await seedImplicitChecklist(page);
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "e2e-beta";
    document.body.appendChild(host);
    ReactDOM.createRoot(host).render(React.createElement(BetaReviewPanel, { onClose: () => {}, showToast: () => {} }));
  });
  await page.locator(".beta-item").nth(0).getByRole("button", { name: /Va bien/i }).click();
  await expect(page.locator(".beta-review")).toContainText("1/");

  // Recarga completa: el progreso vive en localStorage por versión.
  // seedImplicitChecklist sella APP_VERSION a X.Y.Z.7 (el bundle es «dev»); tras reload
  // CONFIG vuelve a «dev», así que la clave se lee con la versión que se usó al marcar.
  const verMarcada = await page.evaluate(() => CONFIG.APP_VERSION);
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  // La clave va por COMPILACIÓN (4.12.0.17), no por versión base (4.12.0) — cambiado el
  // 2026-07-26 a petición suya: «cuando me subas una nueva versión con el fix, que se resetee y
  // se ponga vacío». Antes, la beta siguiente heredaba las cruces y los comentarios de la
  // anterior, así que el arreglo llegaba ya marcado como fallo. Dentro de la MISMA beta el
  // progreso se conserva, que es lo que prueba este test.
  const guardado = await page.evaluate((v) => store.get("_betaReview_" + v), verMarcada);
  expect(guardado, "el progreso de la revisión se perdió al recargar").toEqual({ 0: "ok" });
});

test("en modo pruebas el veredicto NO sale del móvil", async ({ page }) => {
  // Coherencia con el blindaje del sandbox: `betaReport` está en CLOUD_WRITES, así que estando en
  // el banco de pruebas no se manda nada (aprobarías con datos falsos).
  await seedLoggedInDashboard(page);
  await page.addInitScript(() => {
    localStorage.setItem("_mcChannel", "beta");
    localStorage.setItem("micartera_sandbox", localStorage.getItem("micartera_v3"));
    localStorage.setItem("_mcSandbox", "1");
  });
  await page.goto("/");
  await expect(page.locator(".sandbox-bar")).toBeVisible({ timeout: 15_000 });

  const r = await page.evaluate(() => cloud.betaReport({ verdict: "approved", summary: "x" }).then(() => "resuelto"));
  expect(r, "betaReport debería estar anulado dentro del modo pruebas").toBe("resuelto");
});

/* Arrancar el canal beta desde una URL. Es lo que rompe la pescadilla que se muerde la cola: el
   interruptor de canal vive en Ajustes → Dev → Pruebas, que solo existe A PARTIR de la versión
   que quieres probar, así que la primera vez hay que poder entrar por fuera. */
test("?canal=beta activa el canal beta y limpia la URL", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/?canal=beta");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });

  await expect.poll(() => page.evaluate(() => localStorage.getItem("_mcChannel"))).toBe("beta");
  await expect.poll(() => page.evaluate(() => mcChannel())).toBe("beta");
  // La URL se limpia para que recargar no lo repita ni deje el parámetro pegado.
  expect(new URL(page.url()).search).toBe("");
});

test("?canal=estable devuelve el móvil al canal de todos", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.addInitScript(() => localStorage.setItem("_mcChannel", "beta"));
  await page.goto("/?canal=estable");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });

  await expect.poll(() => page.evaluate(() => localStorage.getItem("_mcChannel"))).toBeNull();
  await expect.poll(() => page.evaluate(() => mcChannel())).toBe("stable");
});

test("✓, «no lo puedo probar» Y los ✗ con su comentario se heredan entre compilaciones", async ({ page }) => {
  /* Petición 2026-07-26: lo que ya dio por bueno no se vuelve a preguntar si el texto del punto no
     ha cambiado. Y desde el 2026-08-01, los ✗ TAMBIÉN se heredan con su comentario.
     El motivo del cambio, con sus palabras: «ya he repetido los mensajes 3 veces, estoy hasta los
     cojones». La 4.13.0 sacó cinco compilaciones en tres días y cada una le borraba los fallos que
     acababa de escribir a mano — el panel no sabe si la compilación nueva ha tocado ese punto, así
     que resetear la cruz es apostar SU trabajo a que sí. */
  await abrirRevisionBeta(page);
  await seedImplicitChecklist(page,{minItems:3});
  await page.evaluate(() => {
    const items=betaChecklist(CONFIG.APP_VERSION).items;
    store.set("_betaReviewOk",{[items[0]]:"ok",[items[1]]:"na",[items[2]]:"ko"});
    store.set("_betaReviewNotas",{[items[2]]:"sigue pasando igual"});
    CONFIG.APP_VERSION=mcVerBase(CONFIG.APP_VERSION)+".8";
  });

  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "e2e-beta";
    document.body.appendChild(host);
    ReactDOM.createRoot(host).render(
      React.createElement(BetaReviewPanel, { onClose: () => {}, showToast: () => {} }),
    );
  });
  const panel = page.locator(".beta-review");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/vienen ya marcado/i);

  // El estado interno del panel (marks) es la fuente de verdad — el borde CSS depende del tema.
  const marks = await page.evaluate(() => {
    const root = document.querySelector(".beta-review");
    // React no expone marks; se lee lo que el usuario ve: botones con fondo distinto al ghost.
    // Más fiable: la clave de herencia + que esta compilación no tenga store propio aún.
    return {
      okKey: store.get("_betaReviewOk"),
      notas: store.get("_betaReviewNotas"),
      propia: store.get("_betaReview_" + CONFIG.APP_VERSION),
      items: betaChecklist(CONFIG.APP_VERSION).items.slice(0, 3),
    };
  });
  expect(marks.okKey[marks.items[0]]).toBe("ok");
  expect(marks.okKey[marks.items[1]]).toBe("na");
  expect(marks.okKey[marks.items[2]], "el ✗ sobrevive a la compilación").toBe("ko");
  expect(marks.notas[marks.items[2]], "y su comentario también").toBe("sigue pasando igual");
  expect(marks.propia, "esta compilación empieza sin marcas propias").toBeFalsy();

  // Y en la UI, que es lo que él ve: el 3.º punto vuelve con su casilla de comentario RELLENA,
  // avisado de que viene de antes. Lo que le ahorra es no volver a teclearlo.
  const tercero = panel.locator(".beta-item").nth(2);
  await expect(tercero.locator("input")).toHaveValue("sigue pasando igual");
  await expect(tercero).toContainText(/lo marcaste en la compilación anterior/i);
  await expect(panel).toContainText(/fallo que marcaste antes sigue aquí/i);
  // El progreso cuenta los tres heredados (dos buenos + la cruz).
  await expect(panel).toContainText("3/");
});

test("quitar un ✗ heredado se lleva su comentario (no reaparece en la siguiente)", async ({ page }) => {
  await abrirRevisionBeta(page);
  await seedImplicitChecklist(page);
  await page.evaluate(() => {
    const items = betaChecklist(CONFIG.APP_VERSION).items;
    store.set("_betaReviewOk", { [items[0]]: "ko" });
    store.set("_betaReviewNotas", { [items[0]]: "esto fallaba" });
    try { localStorage.removeItem("_betaReview_" + CONFIG.APP_VERSION); } catch (e) {}
    try { localStorage.removeItem("_betaReview_" + CONFIG.APP_VERSION + "_n"); } catch (e) {}
  });
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "e2e-beta2";
    document.body.appendChild(host);
    ReactDOM.createRoot(host).render(
      React.createElement(BetaReviewPanel, { onClose: () => {}, showToast: () => {} }),
    );
  });
  const panel = page.locator(".beta-review");
  await expect(panel).toBeVisible();
  // Esta compilación lo arregla → lo pone en ✓.
  await panel.locator(".beta-item").nth(0).getByRole("button", { name: /Va bien/i }).click();
  const r = await page.evaluate(() => {
    const items = betaChecklist(CONFIG.APP_VERSION).items;
    return { estado: (store.get("_betaReviewOk") || {})[items[0]], nota: (store.get("_betaReviewNotas") || {})[items[0]] };
  });
  expect(r.estado).toBe("ok");
  expect(r.nota, "si ya no falla, la nota no puede seguir viajando al parte").toBeFalsy();
});

/* VARIAS BETAS A LA VEZ, APROBABLES POR SEPARADO (petición suya 2026-07-29: «que se pudieran
 * implementar varias betas a la vez y que me des la opción de aprobarlas por separado pero que
 * estén juntas»).
 *
 * Lo que hay que blindar es que las tandas sean INDEPENDIENTES de verdad: un fallo en una no
 * puede bloquear a las otras, porque ese es todo el motivo de que existan. Y que una versión SIN
 * tandas siga comportándose exactamente como antes — hay 69 versiones de histórico detrás. */

test("una versión sin tandas declaradas sigue siendo una sola checklist", async ({ page }) => {
  await abrirRevisionBeta(page);
  const r = await page.evaluate(() => {
    // 4.8.0 ya no viaja en el bundle (tope 20). Se planta una entrada SIN la propiedad `tandas`,
    // que es lo que son las ~70 versiones del histórico.
    RELEASE_NOTES.unshift({
      v: "0.0.8", d: "e2e", t: "sin tandas e2e",
      items: { es: ["A", "B"], en: ["A", "B"], ca: ["A", "B"] },
    });
    const p = betaChecklist("0.0.8");
    return { n: p.tandas.length, id: p.tandas[0].id, items: p.tandas[0].items.length, total: p.items.length };
  });
  expect(r.n).toBe(1);
  expect(r.id).toBe("todo");
  expect(r.items).toBe(r.total);             // la tanda implícita lo lleva todo
});

/* Y el reverso, que es el bug que le reapareció el 8/9: una versión que SÍ declaró tandas y ya no
   tiene ninguna (las aprobó todas) NO puede resucitar como checklist «todo». Ausente y vacío
   dejaron de ser lo mismo a propósito; ver `betaTandas` y tests/beta-tandas-vacias.test.mjs. */
test("una versión con TODAS las tandas aprobadas ya no vuelve a pedir revisión", async ({ page }) => {
  await abrirRevisionBeta(page);
  const r = await page.evaluate(() => {
    RELEASE_NOTES.unshift({
      v: "0.0.9", d: "e2e", t: "todo aprobado e2e",
      items: { es: ["A", "B"], en: ["A", "B"], ca: ["A", "B"] },
      tandas: [],
    });
    /* Con prod: la ronda es solo 0.0.9 (vacía). Sin prod, el tip fontanería salta a la
       más nueva con puntos (4.19.86+) — eso es el panel real, no este contrato. */
    const p = betaChecklist("0.0.9", "0.0.8");
    return { n: p.tandas.length, total: p.items.length };
  });
  expect(r.n).toBe(0);
  expect(r.total).toBe(0);
});

test("la versión en curso: tandas (o la implícita) cubren TODOS los puntos alineados", async ({ page }) => {
  /* Sin la propiedad `tandas` betaTandas inventa una sola «todo» (versiones del histórico).
     Con varias, la lista plana TIENE que ser la concatenación exacta — regresión 2026-08-01. */
  await abrirRevisionBeta(page);
  // Tras promote con `tandas:[]` en todas, se siembra la implícita para comprobar la forma.
  await seedImplicitChecklist(page);
  const r = await page.evaluate(() => {
    const p = betaChecklist(CONFIG.APP_VERSION);
    return {
      n: p.tandas.length,
      ids: p.tandas.map((t) => t.id),
      suma: p.tandas.reduce((a, t) => a + t.items.length, 0),
      total: p.items.length,
      titulos: p.tandas.every((t) => t.id === "todo" || !!t.t),
      alineados: (() => {
        let i = 0;
        return p.tandas.every((g) => g.items.every((it) => p.items[i++] === it));
      })(),
    };
  });
  expect(r.n).toBeGreaterThan(0);
  expect(new Set(r.ids).size, "los ids de tanda no se pueden repetir").toBe(r.n);
  expect(r.suma).toBeGreaterThan(0);
  expect(r.titulos, "cada tanda con id propio necesita título; la implícita «todo» puede ir sin él").toBe(true);
  expect(r.suma, "la lista plana del panel TIENE que ser la concatenación de las tandas").toBe(r.total);
  expect(r.alineados, "cada índice global tiene que caer sobre el texto que enseña su tanda").toBe(true);
});

test("con prod conocida, la checklist junta toda la ronda (no solo la última versión)", async ({ page }) => {
  /* Regresión 2026-09-07: en 4.19.1.2 el panel enseñaba solo «Solo ese movimiento» y dejaba
     fuera 4.19.0. Con una prod vieja tiene que salir la ronda ENTERA, no la última versión.
     Se comprueba por FORMA, no contra una lista de versiones concretas: el 11/9, al vaciar las
     tandas que él ya había juzgado, este test acusó de regresión a una limpieza correcta. Lo que
     de verdad se defiende es que la ronda abarque VARIAS versiones y llegue hasta la más vieja. */
  await abrirRevisionBeta(page);
  const r = await page.evaluate(() => {
    /* Tras un promote limpio todas las notas reales llevan tandas:[]. Se plantan DOS versiones
       sintéticas con tandas vivas por encima de prod, para no depender de la ronda del día. */
    RELEASE_NOTES.unshift(
      { v: "4.99.0", d: "e2e", t: "tip e2e", tandas: [{ id: "nueva", t: "Nueva", items: { es: ["N1"], en: ["N1"], ca: ["N1"] } }], items: { es: ["N1"], en: ["N1"], ca: ["N1"] } },
      { v: "4.98.0", d: "e2e", t: "vieja e2e", tandas: [{ id: "vieja", t: "Vieja", items: { es: ["V1"], en: ["V1"], ca: ["V1"] } }], items: { es: ["V1"], en: ["V1"], ca: ["V1"] } },
    );
    const solo = betaChecklist("4.99.0");
    const ronda = betaChecklist("4.99.0", "4.18.7");
    const planos = [];
    ronda.tandas.forEach((g) => { planos.push.apply(planos, g.items); });
    return {
      soloN: solo.tandas.length,
      rondaN: ronda.tandas.length,
      rondaItems: ronda.items.length,
      ids: ronda.tandas.map((t) => t.id),
      titulos: ronda.tandas.map((t) => t.t),
      planosOk: planos.length === ronda.items.length && planos.every((it, i) => it === ronda.items[i]),
    };
  });
  expect(r.rondaN).toBeGreaterThan(r.soloN);
  /* La ronda tiene que venir de VARIAS versiones distintas (eso es lo que se rompió), y la más
     vieja sembrada tiene que estar dentro. */
  const versiones = r.ids.map((id) => String(id).split("/")[0]);
  expect(new Set(versiones).size).toBeGreaterThan(1);
  expect(versiones[versiones.length - 1]).not.toBe(versiones[0]);
  expect(r.titulos.every((t) => /^v4\./.test(String(t)))).toBe(true);
  expect(r.planosOk, "marks por índice: la lista plana = concat de tandas en el mismo orden").toBe(true);
  expect(r.rondaItems).toBeGreaterThanOrEqual(2);
});

/* PANEL CON TANDAS DE VARIAS VERSIONES (2026-09-07). Lo de arriba solo ejercita betaChecklist
 * en evaluate. Aquí se MONTA el panel: se pintan todas, marks va por índice de la lista plana
 * (marcar en la 2.ª no pisa la 1.ª) y aprobar UNA tanda no deja sent en las demás. */
test("panel: ronda multi-versión pinta tandas, marks por índice y aprobar una no pisa las otras", async ({ page }) => {
  await abrirRevisionBeta(page);
  await page.evaluate(() => {
    CONFIG.APP_VERSION = "9.9.2.7";
    // Este escenario aísla marcas y veredictos de dos tandas legado. Las modernas reales
    // no desaparecen por poner producción9.9.0 si su recibo llega nulo (CI351,1/10).
    RELEASE_NOTES = [
      { v: "9.9.2", d: "e2e", t: { es: "Nueva", en: "New", ca: "Nova" },
        tandas: [{ id: "nueva", t: "Tanda nueva e2e", items: { es: ["Punto N1 e2e", "Punto N2 e2e"], en: ["Punto N1 e2e", "Punto N2 e2e"], ca: ["Punto N1 e2e", "Punto N2 e2e"] } }],
        items: { es: ["fam 9.9.2"], en: ["fam 9.9.2"], ca: ["fam 9.9.2"] } },
      { v: "9.9.1", d: "e2e", t: { es: "Vieja", en: "Old", ca: "Vella" },
        tandas: [{ id: "vieja", t: "Tanda vieja e2e", items: { es: ["Punto V1 e2e", "Punto V2 e2e"], en: ["Punto V1 e2e", "Punto V2 e2e"], ca: ["Punto V1 e2e", "Punto V2 e2e"] } }],
        items: { es: ["fam 9.9.1"], en: ["fam 9.9.1"], ca: ["fam 9.9.1"] } },
    ];
    window.__betaReports = [];
    cloud.betaReport = function (p) { window.__betaReports.push(p); return Promise.resolve(); };
    try { localStorage.removeItem("_betaReview_" + CONFIG.APP_VERSION); } catch (e) {}
    try { localStorage.removeItem("_betaReview_" + CONFIG.APP_VERSION + "_v"); } catch (e) {}
    try { localStorage.removeItem("_betaReview_" + CONFIG.APP_VERSION + "_n"); } catch (e) {}
  });
  const panel = await conProduccionEn(page, "9.9.0");
  await expect(panel).toBeVisible();

  const tandas = panel.locator(".beta-tanda");
  await expect(tandas).toHaveCount(2);
  await expect(tandas.nth(0).locator(".beta-tanda-t")).toHaveText(/v9\.9\.2 · Tanda nueva e2e/);
  await expect(tandas.nth(1).locator(".beta-tanda-t")).toHaveText(/v9\.9\.1 · Tanda vieja e2e/);
  await expect(tandas.nth(0)).toContainText("Punto N1 e2e");
  await expect(tandas.nth(0)).toContainText("Punto N2 e2e");
  await expect(tandas.nth(1)).toContainText("Punto V1 e2e");
  await expect(tandas.nth(1)).toContainText("Punto V2 e2e");

  // Marcar N2 (índice global 1) y V1 (índice 2): la lista plana es [N1,N2,V1,V2].
  await tandas.nth(0).locator(".beta-item").nth(1).getByRole("button", { name: /Va bien/i }).click();
  await tandas.nth(1).locator(".beta-item").nth(0).getByRole("button", { name: /Falla/i }).click();
  const marks = await page.evaluate(() => store.get("_betaReview_" + CONFIG.APP_VERSION));
  expect(marks).toEqual({ 1: "ok", 2: "ko" });
  await expect(tandas.nth(0).locator(".beta-tanda-n")).toHaveText("1/2");
  await expect(tandas.nth(1).locator(".beta-tanda-n")).toHaveText("1/2");

  // Completar la tanda nueva y aprobarla: la vieja sigue sin veredicto.
  await tandas.nth(0).locator(".beta-item").nth(0).getByRole("button", { name: /Va bien/i }).click();
  await tandas.nth(0).getByRole("button", { name: /Aprobar esta tanda/i }).click();
  await expect(tandas.nth(0)).toContainText(/✅ aprobada/i);
  await expect(tandas.nth(1).getByRole("button", { name: /Aprobar esta tanda/i })).toBeVisible();
  await expect(tandas.nth(1)).not.toContainText(/✅ aprobada/i);
  const sent = await page.evaluate(() => store.get("_betaReview_" + CONFIG.APP_VERSION + "_v"));
  const reports = await page.evaluate(() => window.__betaReports);
  expect(reports).toHaveLength(1);
  expect(reports[0].tanda).toBe("9.9.2/nueva");
  // Desde 4.26.75 el parte guarda también la huella: es lo que lo casa si la tanda cambia de versión.
  expect(reports[0].huella).toMatch(/^[0-9a-f]{8}$/);
  expect(sent["9.9.2/nueva"]).toBe("approved");
  expect(sent._h).toBe(1);
  expect(sent["h:" + reports[0].huella]).toMatchObject({verdict:"approved",at:expect.any(Number)});
  expect(reports[0].verdict).toBe("approved");
  // Aprobar encoge solo esa tanda; abrir/cerrar no cambia sus marcas ni manda otro parte.
  const toggle = tandas.nth(0).locator(".beta-tanda-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(tandas.nth(0).locator(".beta-item").first()).toBeHidden();
  await toggle.click();
  await expect(tandas.nth(0).locator(".beta-item").first()).toBeVisible();
  await toggle.click();
  expect(await page.evaluate(() => window.__betaReports.length)).toBe(1);
  // Recargar el panel conserva la aprobación y el plegado automático.
  await page.evaluate(() => {
    document.querySelector(".beta-review").remove();
    CONFIG.APP_VERSION = "9.9.2.8";
  });
  const again = await conProduccionEn(page, "9.9.0");
  const first = again.locator(".beta-tanda").first();
  await expect(first.locator(".beta-tanda-toggle")).toHaveAttribute("aria-expanded", "false");
  await first.locator(".beta-tanda-toggle").click();
  await first.getByRole("button", { name:/Cambiar de opinión/ }).click();
  expect(await page.evaluate(() => window.__betaReports.at(-1).verdict)).toBe("revoked");
  await expect(first.getByRole("button", { name:/Aprobar esta tanda/ })).toBeEnabled();
  await expect(again.locator(".beta-tanda").nth(1).getByRole("button", { name:/Aprobar esta tanda/ })).toBeDisabled();
  await page.evaluate(() => { document.querySelector(".beta-review").remove(); CONFIG.APP_VERSION="9.9.2.9"; });
  const changed = await conProduccionEn(page,"9.9.0");
  await expect(changed.locator(".beta-tanda").first().getByRole("button", {name:/Aprobar esta tanda/})).toBeEnabled();
});

/** Los escenarios de marcas aíslan sus dos tandas legado: una producción mayor no acredita
 *  las modernas ajenas y el tiempo de su recibo no puede decidir el resultado de este test.
 *  La versión anterior se calcula antes de aislar, conservando el escenario multiversión. */
async function conTandasDePrueba(page) {
  return page.evaluate(() => {
    const base = typeof mcVerBase === "function"
      ? mcVerBase(CONFIG.APP_VERSION)
      : String(CONFIG.APP_VERSION || "").split(".").slice(0, 3).join(".");
    const n = (RELEASE_NOTES || []).filter(function (x) { return x.v === base; })[0] || RELEASE_NOTES[0];
    if (!n) return "0.0.1";
    n.tandas = [
      { id: "a", t: "Tanda A de prueba", items: { es: ["Punto A1", "Punto A2"] } },
      { id: "b", t: "Tanda B de prueba", items: { es: ["Punto B1", "Punto B2"] } },
    ];
    const prev = (RELEASE_NOTES || []).reduce(function(best, x) {
      if (!x || !x.v || !mcIsNewer(base, x.v)) return best;
      return !best || mcIsNewer(x.v, best) ? x.v : best;
    }, "");
    // Los dos escenarios de marcas tampoco dependen de entregas ajenas ni de su respuesta de red.
    RELEASE_NOTES = [n];
    return prev || "0.0.1";
  });
}

test("un fallo en una tanda NO bloquea aprobar las otras", async ({ page }) => {
  await abrirRevisionBeta(page);
  // Compilación de la ronda VIVA (RELEASE_NOTES[0]), no un número clavado de una ronda ya cerrada.
  await page.evaluate(() => { CONFIG.APP_VERSION = RELEASE_NOTES[0].v + ".7"; });
  const prev = await conTandasDePrueba(page);
  // El primer render aún no conoce prod: CI contaba la ronda real antes del efecto.
  const panel = await conProduccionEn(page, prev, 250);
  await expect(panel).toBeVisible();

  const tandas = panel.locator(".beta-tanda");
  await expect(tandas, "la producción asíncrona deja solo las dos tandas sembradas").toHaveCount(2);

  const primera = tandas.nth(0), segunda = tandas.nth(1);

  // Abrir la tanda si está plegada (cabecera toggle); si no, los .beta-item van con hidden.
  const ensureOpen = async (t) => {
    const body = t.locator("[id^=beta-body-]");
    if (await body.getAttribute("hidden") !== null) {
      await t.locator("button.beta-tanda-toggle").click();
    }
    await expect(body).not.toHaveAttribute("hidden");
  };
  await ensureOpen(primera);
  await ensureOpen(segunda);

  // Solo los abiertos tienen «Va bien». Tras marcarlos se encogen a .beta-item-done (sin ese botón),
  // así que NO se itera por índice fijo — flaky en CI 4.19.55 (mismo patrón que .last() suelto).
  const marcarTodosVaBien = async (t) => {
    for (;;) {
      const btn = t.locator(".beta-item:not(.beta-item-done) button", { hasText: /Va bien/i }).first();
      if (await btn.count() === 0) break;
      await btn.click();
    }
  };
  await marcarTodosVaBien(primera);
  await expect(primera.getByRole("button", { name: /Aprobar esta tanda/i })).toBeEnabled();

  // Y en la SEGUNDA se marca un fallo. Lo que importa: la primera sigue aprobable.
  await segunda.locator(".beta-item:not(.beta-item-done) button", { hasText: /Falla/i }).first().click();
  await expect(segunda.getByRole("button", { name: /Aprobar esta tanda/i })).toBeDisabled();
  await expect(primera.getByRole("button", { name: /Aprobar esta tanda/i })).toBeEnabled();
  await expect(segunda).toContainText(/arréglalo antes de aprobar/i);
});

test("cada tanda lleva su cuenta propia, no la de la beta entera", async ({ page }) => {
  await abrirRevisionBeta(page);
  await page.evaluate(() => { CONFIG.APP_VERSION = RELEASE_NOTES[0].v + ".7"; });
  const prev = await conTandasDePrueba(page);
  const panel = await conProduccionEn(page, prev);
  const primera = panel.locator(".beta-tanda").nth(0);
  const total = await primera.locator(".beta-item").count();

  await expect(primera.locator(".beta-tanda-n")).toHaveText("0/" + total);
  await primera.locator(".beta-item").nth(0).getByRole("button", { name: /Va bien/i }).click();
  await expect(primera.locator(".beta-tanda-n")).toHaveText("1/" + total);

  // Marcar en la primera no puede mover el contador de la segunda.
  const segunda = panel.locator(".beta-tanda").nth(1);
  const total2 = await segunda.locator(".beta-item").count();
  await expect(segunda.locator(".beta-tanda-n")).toHaveText("0/" + total2);
});

/* EL «0/26» DE AJUSTES CUANDO YA HABÍA MARCADO COSAS (bug suyo, 2026-08-01: «me sale revisar
 * esta beta 0/26 cuando ya he aceptado o rechazado cosas, me tendría que salir conforme voy
 * poniendo»). La fila de Ajustes leía `_betaReview_`+versión BASE («4.13.0»), una clave que el
 * panel NUNCA escribe — el panel siempre guarda por COMPILACIÓN exacta («4.13.0.11»). La fila
 * leía aire y enseñaba 0 pasara lo que pasara. `betaMarksCount` es la función que ahora usan LOS
 * DOS sitios (fila y panel), así que blindar la función blinda a ambos a la vez. */
test("betaMarksCount cuenta lo marcado en ESTA compilación (no la versión base)", async ({ page }) => {
  await abrirRevisionBeta(page);
  await seedImplicitChecklist(page, { minItems: 3 });
  // Hace falta una nota con ≥3 puntos que SÍ viaje en el bundle (tope 20).
  await page.evaluate(() => {
    const base = (RELEASE_NOTES || []).find(function (n) {
      return betaChecklist(n.v).items.length >= 3;
    });
    CONFIG.APP_VERSION = (base ? base.v : RELEASE_NOTES[0].v) + ".11";
  });
  const r0 = await page.evaluate(() => betaMarksCount(betaChecklist(CONFIG.APP_VERSION)));
  expect(r0.n, "arranca en 0 sin nada marcado").toBe(0);
  expect(r0.tot).toBeGreaterThanOrEqual(3);

  await page.evaluate(() => {
    const items = betaChecklist(CONFIG.APP_VERSION).items;
    // Esto es EXACTAMENTE lo que escribe `save()` dentro del panel al marcar un punto: por
    // índice, bajo la clave de la COMPILACIÓN completa — la que la fila vieja no leía.
    store.set("_betaReview_" + CONFIG.APP_VERSION, { 0: "ok", 1: "ko", 2: "na" });
    void items;
  });
  const r1 = await page.evaluate(() => betaMarksCount(betaChecklist(CONFIG.APP_VERSION)));
  expect(r1.n, "la fila tiene que contar los 3 marcados, no seguir en 0").toBe(3);
});

test("betaMarksCount hereda lo aprobado de una compilación anterior, aunque cambie el número", async ({ page }) => {
  await abrirRevisionBeta(page);
  await seedImplicitChecklist(page, { minItems: 3 });
  await page.evaluate(() => {
    const base = (RELEASE_NOTES || []).find(function (n) {
      return betaChecklist(n.v).items.length >= 3;
    });
    CONFIG.APP_VERSION = (base ? base.v : RELEASE_NOTES[0].v) + ".10";
  });
  await page.evaluate(() => {
    const items = betaChecklist(CONFIG.APP_VERSION).items;
    store.set("_betaReviewOk", { [items[0]]: "ok", [items[1]]: "ko" });
  });
  // Compilación NUEVA, mismo texto de puntos: la cuenta tiene que seguir viendo esos dos.
  await page.evaluate(() => {
    CONFIG.APP_VERSION = mcVerBase(CONFIG.APP_VERSION) + ".11";
  });
  const r = await page.evaluate(() => betaMarksCount(betaChecklist(CONFIG.APP_VERSION)));
  expect(r.n).toBeGreaterThanOrEqual(2);
});

/* ─────────────────────────────────────────────────────────────────────────────
   PROBAR SIN BUSCAR NADA (petición suya del 2026-09-10)
   Dos quejas suyas, del mismo día y del mismo sitio:
   · «las que se aprueban se encogen, las que se rechazan también se deberían poder encoger»
   · «si estoy haciendo pruebas en 1, no quiero tener que bajar hasta abajo del todo para dar la
      siguiente y así sucesivamente [...] tengo que estar leyendo porque no me lo aprendo todo de
      memoria, te lo juro que me muero»
   No son estética: con 21 tandas esperando veredicto, el panel es lo que le impide dárnoslos.
   ───────────────────────────────────────────────────────────────────────────── */

/** Deja el panel montado con dos tandas de mentira (A y B, dos puntos cada una). */
async function panelConDosTandas(page) {
  await abrirRevisionBeta(page);
  await page.evaluate(() => {
    window.__betaReports = [];
    cloud.betaReport = function (p) { window.__betaReports.push(p); return Promise.resolve(); };
    const k = "_betaReview_" + CONFIG.APP_VERSION;
    try { localStorage.removeItem(k); localStorage.removeItem(k + "_v"); localStorage.removeItem(k + "_n"); } catch (e) {}
    try { localStorage.removeItem("_betaReviewOk"); localStorage.removeItem("_betaReviewNotas"); } catch (e) {}
  });
  const prod = await conTandasDePrueba(page);
  const panel = await conProduccionEn(page, prod);
  await expect(panel).toBeVisible();
  return panel;
}

test("una tanda RECHAZADA se encoge igual que una aprobada", async ({ page }) => {
  const panel = await panelConDosTandas(page);
  const a = panel.locator(".beta-tanda").first();
  await expect(a.locator(".beta-tanda-toggle")).toHaveAttribute("aria-expanded", "true");

  // Un fallo y a reportar: es el camino que antes dejaba la tanda abierta estorbando.
  await a.locator(".beta-item").first().getByRole("button", { name: /Falla/i }).click();
  await a.getByRole("button", { name: /Reportar .* fallo/i }).click();
  await expect(a).toContainText(/⛔ rechazada/i);

  await expect(a.locator(".beta-tanda-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(a.locator(".beta-item").first()).toBeHidden();

  // Y se puede volver a abrir para repasar lo que escribió, sin mandar otro parte.
  await a.locator(".beta-tanda-toggle").click();
  await expect(a.locator(".beta-tanda-toggle")).toHaveAttribute("aria-expanded", "true");
  expect(await page.evaluate(() => window.__betaReports.length)).toBe(1);
  expect(await page.evaluate(() => window.__betaReports[0].verdict)).toBe("rejected");
});

test("el punto que va bien se encoge a una línea y el ✗ NO (lleva su comentario debajo)", async ({ page }) => {
  const panel = await panelConDosTandas(page);
  const a = panel.locator(".beta-tanda").first();

  // Punto 1: ✓ → se encoge. Sigue leyéndose su texto, pero ya no ocupa media pantalla.
  await a.locator(".beta-item").first().getByRole("button", { name: /Va bien/i }).click();
  const p1 = a.locator(".beta-item").first();
  await expect(p1).toHaveClass(/beta-item-done/);
  await expect(p1).toContainText("Punto A1");
  await expect(p1.getByRole("button", { name: /Va bien/i })).toHaveCount(0);

  // Punto 2 sigue entero y es el único con botones: es el que le toca probar.
  const p2 = a.locator(".beta-item").nth(1);
  await expect(p2).not.toHaveClass(/beta-item-done/);
  await expect(p2.getByRole("button", { name: /Va bien/i })).toBeVisible();

  /* Un ✗ NO se encoge: debajo tiene «¿qué pasa exactamente?», y esconderlo sería tragarse lo
     único que hace útil un rechazo. Este es el caso que más caro sale si se hace mal. */
  await p2.getByRole("button", { name: /Falla/i }).click();
  await expect(a.locator(".beta-item").nth(1)).not.toHaveClass(/beta-item-done/);
  await expect(a.locator(".beta-item").nth(1).locator("input[placeholder*='exactamente']")).toBeVisible();
});

test("un punto encogido se vuelve a abrir para repasarlo, y se cierra otra vez", async ({ page }) => {
  const panel = await panelConDosTandas(page);
  const a = panel.locator(".beta-tanda").first();
  await a.locator(".beta-item").first().getByRole("button", { name: /Va bien/i }).click();
  await expect(a.locator(".beta-item").first()).toHaveClass(/beta-item-done/);

  await a.locator(".beta-item").first().click();
  const abierto = a.locator(".beta-item").first();
  await expect(abierto).not.toHaveClass(/beta-item-done/);
  // Repasar no cambia el veredicto del punto: sigue en ✓.
  await expect(abierto.getByRole("button", { name: /Va bien/i })).toBeVisible();
  expect(await page.evaluate(() => store.get("_betaReview_" + CONFIG.APP_VERSION))).toEqual({ 0: "ok" });

  await abierto.getByRole("button", { name: /Volver a encogerlo/i }).click();
  await expect(a.locator(".beta-item").first()).toHaveClass(/beta-item-done/);
});

test("«no lo puedo probar» también encoge; desmarcar vuelve a abrir el punto", async ({ page }) => {
  const panel = await panelConDosTandas(page);
  const a = panel.locator(".beta-tanda").first();
  await a.locator(".beta-item").first().getByRole("button", { name: /No lo puedo probar/i }).click();
  await expect(a.locator(".beta-item").first()).toHaveClass(/beta-item-done/);

  // Desmarcar (segundo toque sobre el mismo botón) devuelve el punto a la cola de pendientes.
  await a.locator(".beta-item").first().click();
  await a.locator(".beta-item").first().getByRole("button", { name: /No lo puedo probar/i }).click();
  expect(await page.evaluate(() => store.get("_betaReview_" + CONFIG.APP_VERSION))).toEqual({});
  await expect(a.locator(".beta-item").first()).not.toHaveClass(/beta-item-done/);
});

/* VOLVER AL MISMO SITIO DESPUÉS DE PROBAR
   La otra mitad de su queja, y la que no se ve leyendo el panel: para probar un punto TIENE que
   salir de la app, y Android le mata la WebView mientras paga o mira el widget. Sin esto, cada
   vuelta aterriza en Inicio y hay que rehacer Ajustes → Revisar la beta → bajar. */

test("salir a probar y volver: el panel se reabre solo y a la misma altura", async ({ page }) => {
  await panelConDosTandas(page);
  /* Estaba leyendo por la mitad cuando Android le mató la app.
     El DEDO va primero a posta (16/9): desde 4.24.4 la marca la pone `pointerdown`, no el scroll
     a secas, porque restaurar la altura dispara `scroll` sin que él toque nada y eso reabría
     Ajustes en bucle. Aquí se simula a una persona leyendo, así que hay dedo. */
  await page.locator(".beta-review").dispatchEvent("pointerdown");
  await page.evaluate(() => {
    const w = document.querySelector(".beta-review");
    w.scrollTop = 240;
    w.dispatchEvent(new Event("scroll"));
  });
  expect(await page.evaluate(() => localStorage.getItem("_betaPanelAbierto"))).not.toBeNull();
  expect(await page.evaluate(() => Number(localStorage.getItem("_betaPanelScroll")))).toBeGreaterThan(0);
  expect(await page.evaluate(() => betaDebeReabrirse())).toBe(true);
});

test("cerrar el panel A PROPÓSITO no lo reabre la próxima vez", async ({ page }) => {
  const panel = await panelConDosTandas(page);
  await panel.getByRole("button", { name: /‹ Ajustes/ }).click();
  expect(await page.evaluate(() => localStorage.getItem("_betaPanelAbierto"))).toBeNull();
  expect(await page.evaluate(() => betaDebeReabrirse())).toBe(false);
});

test("la marca caduca: si vuelve al día siguiente entra en su app, no en el panel", async ({ page }) => {
  await abrirRevisionBeta(page);
  // Salió hace tres horas: eso ya no es «he salido a probar», es otro día de su vida.
  expect(await page.evaluate(() => {
    localStorage.setItem("_betaPanelAbierto", String(Date.now() - 3 * 60 * 60 * 1000));
    return betaDebeReabrirse();
  })).toBe(false);
  expect(await page.evaluate(() => {
    localStorage.setItem("_betaPanelAbierto", String(Date.now() - 5 * 60 * 1000));
    return betaDebeReabrirse();
  })).toBe(true);
});


/* Tras promocionar solo Deudas, las otras pruebas deben seguir visibles en la beta. */
test("producción 4.26.67 conserva las siete tandas pendientes", async ({ page }) => {
  await abrirRevisionBeta(page);
  await page.evaluate(() => { CONFIG.APP_VERSION = "4.26.70.2"; });
  const panel = await conProduccionEn(page, "4.26.67");
  await expect(panel.locator(".beta-tanda")).toHaveCount(7);
  for (const title of ["Arranque con poca conexión", "Ayuda de Mi ciclo", "Widget después de reabrir", "Gasto del widget tras una compra", "Clasificación de gastos bancarios", "Banco del widget", "Widget con la app cerrada"]) {
    await expect(panel.locator(".beta-tanda-t").filter({ hasText: title })).toHaveCount(1);
  }
  await expect(panel).not.toContainText("Deudas terminadas");
  await expect(panel).not.toContainText("Abrir cuotas de deuda");
  await expect(panel).not.toContainText("Diagnósticos más privados");
  await expect(panel).not.toContainText("Inicio, Gastos y nómina");
  await expect(panel).not.toContainText("Saldo con nómina adelantada");
  await expect(panel).not.toContainText("Presupuesto por día de cobro");
  await expect(panel).not.toContainText("Balance de ingresos en Mi ciclo");
  await expect(panel).not.toContainText("Inicio y Mi ciclo");
  await expect(panel).toContainText("En la próxima compra habitual");
});

test("guion de recibos71 retirado en favor de74 conserva las siete pendientes", async ({ page }) => {
  await abrirRevisionBeta(page);
  await page.evaluate(() => { CONFIG.APP_VERSION = "4.26.71.1"; });
  const panel = await conProduccionEn(page, "4.26.67");
  await expect(panel.locator(".beta-tanda")).toHaveCount(7);
  await expect(panel).not.toContainText("Recibos pagados y vencidos");
  for(const title of ["Arranque con poca conexión", "Ayuda de Mi ciclo", "Widget después de reabrir", "Gasto del widget tras una compra", "Clasificación de gastos bancarios", "Banco del widget", "Widget con la app cerrada"]){
    await expect(panel.locator(".beta-tanda-t").filter({hasText:title})).toHaveCount(1);
  }
  await expect(panel).not.toContainText("Deudas terminadas");
});

test("Inicio73 conserva sus pruebas tras trasladar el guion de recibos a74", async ({ page }) => {
  await abrirRevisionBeta(page);
  await page.evaluate(() => { CONFIG.APP_VERSION = "4.26.73.1"; });
  const panel = await conProduccionEn(page, "4.26.67");
  await expect(panel.locator(".beta-tanda")).toHaveCount(8);
  for(const title of ["Presupuesto mensual de Inicio", "Arranque con poca conexión", "Ayuda de Mi ciclo", "Widget después de reabrir", "Gasto del widget tras una compra", "Clasificación de gastos bancarios", "Banco del widget", "Widget con la app cerrada"]){
    await expect(panel.locator(".beta-tanda-t").filter({hasText:title})).toHaveCount(1);
  }
  await expect(panel).not.toContainText("Deudas terminadas");
  await expect(panel).not.toContainText("Inicio y Mi ciclo");
});
test("corrección74 conserva todas las tandas y muestra una sola prueba de recibos", async ({ page }) => {
  await abrirRevisionBeta(page);
  await page.evaluate(() => { CONFIG.APP_VERSION = "4.26.74.1"; });
  const panel=await conProduccionEn(page,"4.26.67");
  await expect(panel.locator(".beta-tanda")).toHaveCount(9);
  const gas=panel.locator(".beta-tanda").filter({has:page.locator(".beta-tanda-t",{hasText:"Recibos pagados y vencidos"})});
  await expect(gas).toHaveCount(1);
  await expect(gas).toContainText("Paga un recibo");
  await expect(panel).toContainText("Presupuesto mensual de Inicio");
  for(const title of ["Arranque con poca conexión","Ayuda de Mi ciclo","Widget después de reabrir","Gasto del widget tras una compra","Clasificación de gastos bancarios","Banco del widget","Widget con la app cerrada"]){
    await expect(panel.locator(".beta-tanda-t").filter({hasText:title})).toHaveCount(1);
  }
});

/* 30/9: aprobó las cinco nativas tres veces porque cada promoción web las movía de versión.
   Su móvil guarda el parte como «4.26.67/id»; en 4.26.68 el panel debe reconocerlo. */
const NATIVAS = ["Widget después de reabrir", "Gasto del widget tras una compra", "Clasificación de gastos bancarios", "Banco del widget", "Widget con la app cerrada"];

async function panelRevisionExacta(page, lang, scenario) {
  await abrirRevisionBeta(page);
  await page.evaluate(async ({lang,scenario}) => {
    await ensureLangPack(lang); CURLANG=lang;
    CONFIG.APP_VERSION="9.9.3.1";
    const g={id:"revision", t:"Revisión sintética", items:{es:["1. Comprobar A","2. Comprobar B"]},
      codigo:"a".repeat(64),web:"b".repeat(64),native:"c".repeat(64),apk:51};
    const old=betaHuella(g.id,g.t,g.items.es,1,g.codigo);
    if(scenario==="changed") { g.codigoDesde=g.codigo; g.revisionesDesde={web:g.web,native:g.native}; g.native="e".repeat(64); g.codigo="d".repeat(64); }
    RELEASE_NOTES=[{v:"9.9.3",t:"Escenario",tandas:[g],items:{es:[]}}];
    window._mcProdApk=9999;
    window._mcProdEntregas={web:{revision:g.web}};
    window._mcProdApkRevisiones={revision:"otra-revision"};
    const verdict=scenario==="rejected"?"rejected":"approved";
    store.set("_betaReview_9.9.2.1_v",{_h:1,["h:"+old]:{verdict,at:100}});
    store.set("_betaReviewOk",{"1. Comprobar A":"ok","2. Comprobar B":"ok"});
    store.set("_betaMarksHuella",{"1. Comprobar A":old,"2. Comprobar B":old});
    window.__betaReports=[];
    cloud.betaReport=p => { window.__betaReports.push(mcBetaLog(p)); return Promise.resolve(); };
  },{lang,scenario});
  return conProduccionEn(page,"9.9.9");
}

for(const lang of ["es","en","ca"]) {
  test(`revisión exacta: dos fuentes idénticas conservan OK y cinco cambios web/nativos piden nueva revisión (${lang})`, async ({page}) => {
    await abrirRevisionBeta(page,lang);
    await sembrarAprobadasEn4267(page);
    await page.evaluate(async lang => { await ensureLangPack(lang); CURLANG=lang; CONFIG.APP_VERSION="4.26.76.1"; window._mcProdApk=48; window._mcProdEntregas=null; window._mcProdApkRevisiones=null; },lang);
    const panel=await conProduccionEn(page,"4.26.67");
    const before=await page.evaluate(()=>store.get("_betaReview_4.26.68.1_v"));
    const copy={es:{approved:"No necesitas aprobarla otra vez",unknown:"Entrega sin confirmar: web",native:"Pendiente de publicar: app Android"},en:{approved:"You do not need to approve it again",unknown:"Delivery unconfirmed: web",native:"Awaiting publication: Android app"},ca:{approved:"No cal que l’aprovis de nou",unknown:"Entrega sense confirmar: web",native:"Pendent de publicar: app Android"}}[lang];
    for(const title of ["Arranque con poca conexión","Ayuda de Mi ciclo"]) {
      const fila=panel.locator(".beta-tanda").filter({has:page.locator(".beta-tanda-t",{hasText:title})});
      await expect(fila.locator(".beta-tanda-n")).toContainText("aprobada");
      await expect(fila.locator(".beta-tanda-estado")).toBeVisible();
      await expect(fila.locator(".beta-tanda-estado")).toContainText(copy.approved);
      await expect(fila.locator(".beta-tanda-entrega")).toBeVisible();
      await expect(fila.locator(".beta-tanda-entrega")).toContainText(copy.unknown);
      await expect(fila.locator(".hint").filter({hasText:/código cambió|code changed|codi ha canviat/})).toHaveCount(0);
    }
    // La guardia de nómina cambia el importador de TR; su OK anterior sigue en el historial.
    for(const title of NATIVAS) {
      const fila=panel.locator(".beta-tanda").filter({has:page.locator(".beta-tanda-t",{hasText:title})});
      await expect(fila.locator(".beta-tanda-n")).toHaveText(/^0\/\d+$/);
      await expect(fila.locator(".hint").filter({hasText:/código cambió|code changed|codi ha canviat/})).toContainText("web");
      await expect(fila.locator(".hint").filter({hasText:/código cambió|code changed|codi ha canviat/})).toContainText("Android");
      await expect(fila.getByRole("button",{name:/Aprobar esta tanda/})).toBeDisabled();
      await expect(fila.locator(".beta-tanda-entrega")).toContainText(copy.native);
      await expect(fila.locator(".beta-tanda-entrega")).toContainText(copy.unknown);
    }
    expect(await page.evaluate(()=>store.get("_betaReview_4.26.68.1_v"))).toEqual(before);
  });
  test(`entrega exacta: producción menor retira las siete tandas reales al llegar sus recibos (${lang})`, async ({page}) => {
    // El recibo sintético no puede competir con una consulta real que arrancó al abrir la app.
    await page.route("https://juanjoavila.github.io/Aely/**",route=>route.abort());
    await abrirRevisionBeta(page,lang);
    await page.evaluate(async()=>{ if(_mcProdVerCache) await _mcProdVerCache; });
    await sembrarAprobadasEn4267(page);
    await page.evaluate(async lang => {
      await ensureLangPack(lang); CURLANG=lang; CONFIG.APP_VERSION=RELEASE_NOTES[0].v+".1";
      window._mcProdApk=48; window._mcProdEntregas=null;window._mcProdApkRevisiones=null;
      window._mcProdVersion=function(){ return new Promise(resolve=>{ window.__resolveDelivery=resolve; }); };
    },lang);
    const before=await page.evaluate(()=>store.get("_betaReview_4.26.68.1_v"));
    await page.evaluate(()=>{
      const h=document.createElement("div");h.id="e2e-beta-entrega";document.body.appendChild(h);
      ReactDOM.createRoot(h).render(React.createElement(BetaReviewPanel,{onClose:function(){},showToast:function(){}}));
    });
    const panel=page.locator("#e2e-beta-entrega .beta-review");
    await page.waitForFunction(()=>typeof window.__resolveDelivery==="function");
    await page.evaluate(()=>{
      window._mcProdEntregas={web:{},edge:{}};window._mcProdApkRevisiones={};
      betaChecklist(CONFIG.APP_VERSION,"4.26.67",48).tandas.filter(g=>["inc-2709-01-arranque-red","inc-2809-02-ayuda-ciclo","fin05-widget-reentrada","fin05-pago-cerrada","tr-descripcion-clasificacion","widget-banco","widget-app-cerrada"].includes(g.id.split("/").pop())).forEach(g=>{
        const id=g.id.split("/").pop();window._mcProdEntregas.web[id]=g.web;
        if(g.native) window._mcProdApkRevisiones[id]=g.native;
        if(g.edge) window._mcProdEntregas.edge[id]=g.edge;
      });
      window._mcProdApk=52;window.__resolveDelivery("4.26.67");
    });
    // Panel76 se trasladó a82; los recibos de las siete antiguas no entregan las once nuevas.
    const remaining=["inc-0210-03-gastos-periodo","inc-0210-01-plan-cuota","beta-panel-veredictos","inc-2909-01-widget-periodo","inc-2909-03-retirada","inc-3009-nomina-anticipada","inc-2709-12-cyber-fab","inc-2709-14-preguntar","inc-2709-10-perfil","inc-3009-01-cargos","inc-2909-02-inicio-natural"];
    await expect(panel.locator(".beta-tanda")).toHaveCount(remaining.length);
    expect(await page.evaluate(()=>betaChecklist(CONFIG.APP_VERSION,"4.26.67",52).tandas.map(g=>g.id.split("/").pop()).sort())).toEqual(remaining.slice().sort());
    for(const title of ["Gastos y categorías del mismo periodo","Las cuotas cobradas dejan de estar pendientes","Las comprobaciones conservan su resultado","Widget: mes o Mi ciclo","Retiradas y presupuesto","Nómina sin adelantar el cobro","Botón + en Cyberpunk","Botón Preguntar","Perfil sin casillas gigantes","Recibos pagados y vencidos","Presupuesto mensual de Inicio"])
      await expect(panel.locator(".beta-tanda-t").filter({hasText:title})).toHaveCount(1);
    for(const title of NATIVAS.concat(["Arranque con poca conexión","Ayuda de Mi ciclo"]))
      await expect(panel.locator(".beta-tanda-t").filter({hasText:title})).toHaveCount(0);
    expect(await page.evaluate(()=>store.get("_betaReview_4.26.68.1_v"))).toEqual(before);
  });
  test(`revisión exacta: rechazo trasladado sigue vetando con producción mayor (${lang})`, async ({page}) => {
    const panel=await panelRevisionExacta(page,lang,"rejected");
    await expect(panel.locator(".beta-tanda")).toHaveCount(1);
    await expect(panel.locator(".beta-tanda-n")).toContainText("rechazada");
    await expect(panel).not.toContainText("ya pasó por aquí");
  });
  test(`revisión exacta: código nuevo exige puntos y veredicto nuevos (${lang})`, async ({page}) => {
    const panel=await panelRevisionExacta(page,lang,"changed");
    await expect(panel.locator(".beta-tanda-n")).toHaveText("0/2");
    await expect(panel.getByRole("button",{name:/Aprobar esta tanda/})).toBeDisabled();
    await expect(panel).not.toContainText("✅ aprobada");
    await expect(panel.locator(".hint").filter({hasText:/código cambió|code changed|codi ha canviat/})).toContainText("Android");
  });
  test(`revisión exacta: retirar se registra en servidor y conserva OK si falla (${lang})`, async ({page}) => {
    const panel=await panelRevisionExacta(page,lang,"approved");
    await panel.locator(".beta-tanda-toggle").click();
    await page.evaluate(() => { cloud.betaReport=() => Promise.reject(new Error("fallo sintético")); });
    await panel.getByRole("button",{name:/Cambiar de opinión/}).click();
    await expect(panel.locator(".beta-tanda-n")).toContainText("aprobada");
    await page.evaluate(() => { cloud.betaReport=p => { window.__betaReports.push(mcBetaLog(p)); return Promise.resolve(); }; });
    await panel.getByRole("button",{name:/Cambiar de opinión/}).click();
    await expect(panel.getByRole("button",{name:/Aprobar esta tanda/})).toBeEnabled();
    const part=await page.evaluate(() => window.__betaReports.at(-1));
    expect(part.verdict).toBe("revoked");
    expect(part.huella).toMatch(/^[0-9a-f]{8}:[0-9a-f]{64}$/);
    await panel.getByRole("button",{name:/Empezar la revisión de cero/}).click();
    expect(await page.evaluate(h => store.get("_betaReview_9.9.3.1_v")["h:"+h].verdict,part.huella)).toBe("revoked");
    expect(await page.evaluate(() => betaVerdictFor(betaChecklist(CONFIG.APP_VERSION,"9.9.9",9999).tandas[0],
      [window.__betaReports.at(-1),{huella:window.__betaReports.at(-1).huella,verdict:"approved"}]))).toBeNull();
  });
}
async function sembrarAprobadasEn4267(page) {
  await page.evaluate(() => {
    CONFIG.APP_VERSION = "4.26.71.1";
    const pack = betaChecklist(CONFIG.APP_VERSION,"4.26.67",48);
    const partes = {}, marcas = {};
    pack.tandas.filter((g) => g.historial.length).forEach((g) => {
      partes[g.historial[0]] = "approved";
      rnItems(g, "es").forEach((it) => { marcas[it] = "ok"; });
    });
    store.set("_betaReview_4.26.68.1_v", partes);
    store.set("_betaReviewOk", marcas);
  });
}

test("las nativas conservan el historial y sus cinco cambios web exigen revisión nueva", async ({ page }) => {
  await abrirRevisionBeta(page);
  await sembrarAprobadasEn4267(page);
  const historial=await page.evaluate(() => store.get("_betaReview_4.26.68.1_v"));
  await page.evaluate(() => { CONFIG.APP_VERSION="4.26.75.1"; window._mcProdApk = 48; window._mcProdEntregas=null; });
  const panel = await conProduccionEn(page, "4.26.67");
  for (const title of NATIVAS) {
    const fila = panel.locator(".beta-tanda").filter({ has: page.locator(".beta-tanda-t", { hasText: title }) });
    await expect(fila.locator(".beta-tanda-n")).toHaveText(/^0\/\d+$/);
    await expect(fila.locator(".hint").filter({hasText:/código cambió|code changed|codi ha canviat/})).toContainText("web");
    await expect(fila.getByRole("button",{name:/Aprobar esta tanda/})).toBeDisabled();
  }
  expect(await page.evaluate(() => store.get("_betaReview_4.26.68.1_v"))).toEqual(historial);
  const recibos = panel.locator(".beta-tanda").filter({ has: page.locator(".beta-tanda-t", { hasText: "Recibos pagados y vencidos" }) });
  await expect(recibos.locator(".beta-tanda-n")).not.toContainText("aprobada");
});

test("producción web por delante no retira las nativas mientras la APK estable no las lleve", async ({ page }) => {
  await abrirRevisionBeta(page);
  await page.evaluate(() => { CONFIG.APP_VERSION = "4.26.71.1"; window._mcProdApk = 48; window._mcProdEntregas=null; });
  const panel = await conProduccionEn(page, "4.26.69");
  for (const title of NATIVAS) await expect(panel.locator(".beta-tanda-t").filter({ hasText: title })).toHaveCount(1);
  await expect(panel.locator(".beta-tanda-t").filter({ hasText: "Ayuda de Mi ciclo" })).toHaveCount(1);
  await expect(panel.locator(".beta-tanda-t").filter({ hasText: "Recibos pagados y vencidos" })).toHaveCount(0);
});

// R1/R2: una publicación completa y un arranque nuevo, conservando localStorage real.
// Los digests proceden de fuentes modificadas, no de un código inventado igual para A.
test.describe("persistencia81 con compilaciones aisladas",()=>{
  test.use({serviceWorkers:"block"});
for(const lang of ["es","en","ca"])for(const mode of ["texto repetido","sin marcas","sin red"]){
  test("persistencia81 "+lang+" · A aprobada, B ajena, actualizar y reiniciar · "+mode,async({page})=>{
    const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
    const unrelated=text=>text.replace("function widgetCoveredEvents(","function betaAjena81(){ return 27; }\nfunction widgetCoveredEvents(")
      .replace("    enabled(){ return !!sb; },","    betaAjena81(){ return 27; },\n    enabled(){ return !!sb; },")
      .replace("name:sp.name, amount:useAmt","name:sp.name, amount:useAmt+1");
    const changed=f=>unrelated(read(f));
    const id="inc-2909-02-inicio-natural",aBefore=betaRevision(id,read),aAfter=betaRevision(id,changed);
    expect(aAfter.codigo,"una entrega ajena mantiene las unidades de A").toBe(aBefore.codigo);
    const aRealChange=betaRevision(id,f=>changed(f).replace("const REC_GRACE=3;","const REC_GRACE=4;"));
    expect(aRealChange.codigo).not.toBe(aBefore.codigo);
    const bCode=betaRevision("ajena81",changed,undefined,{web:[{file:"src/modules/00-core.js",data:"cloud",members:["betaAjena81"]}],unidades:true});
    const shared="Volver a abrir y comprobar el resultado sintético";
    const a={id:id,t:{es:"A · comprobación anterior",en:"A · previous check",ca:"A · comprovació anterior"},items:{es:[shared],en:[shared],ca:[shared]},...aBefore};
    const b={id:"ajena81",t:{es:"B · entrega ajena",en:"B · unrelated delivery",ca:"B · entrega aliena"},items:{es:[shared],en:[shared],ca:[shared]},...bCode};
    const note=(v,tandas)=>({v:v,t:{es:"Ronda sintética",en:"Synthetic round",ca:"Ronda sintètica"},items:{es:[],en:[],ca:[]},tandas:tandas});
    const html=read("public/index.html");let phase=0, notesOffline=false, notesStale=false;
    const catalogFor=stage=>stage===0?[note("9.9.1",[a])]:[note("9.9.2",[b]),note("9.9.1",[{...a,...(stage===2?aRealChange:aAfter)}])];
    const catalogSha=stage=>crypto.createHash("sha256").update(JSON.stringify(catalogFor(stage))).digest("hex");
    await seedLoggedInDashboard(page,{__seedOnce:true,__seenVersion:"99.99.99",settings:{autoPrices:false,theme:"green",lang:lang}});
    await page.addInitScript(()=>{localStorage.setItem("_mcChannel","beta");localStorage.setItem("_seenVersion","99.99.99");});
    await page.addInitScript(()=>{ if(localStorage.getItem("__betaNoCrypto")==="1"){const c=window.crypto;Object.defineProperty(window,"crypto",{value:{getRandomValues:c.getRandomValues.bind(c),randomUUID:c.randomUUID&&c.randomUUID.bind(c)},configurable:true});} });
    await page.route("**/release-notes.json*",route=>notesOffline?route.abort():route.fulfill({contentType:"application/json",body:JSON.stringify(catalogFor(notesStale?1:phase))}));
    await page.route("**/",route=>route.fulfill({contentType:"text/html",body:(phase?unrelated(html):html).replace(/var _rnSha="[0-9a-f]{64}";/,'var _rnSha="'+catalogSha(phase)+'";').replace("const REC_GRACE=3;",phase===2?"const REC_GRACE=4;":"const REC_GRACE=3;").replace('<head>','<head><script>localStorage.setItem("_seenVersion","9.9.'+(phase?"2":"1")+'");window.__e2eNewsSeenVersion="9.9.'+(phase?"2":"1")+'";</script>').replace('APP_VERSION: "dev"','APP_VERSION: "9.9.'+(phase?"2":"1")+'.'+(phase===2?"2":"1")+'"')}));
    const mount=async()=>{
      await expect(page.locator(".botnav")).toBeVisible({timeout:15_000});await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);await expect(page.locator(".wn-panel")).toHaveCount(0);
      const head=await page.evaluate(()=>ensureReleaseNotes().then(arr=>({v:arr[0]&&arr[0].v,url:releaseNotesUrl(),version:CONFIG.APP_VERSION})));
      expect(head).toMatchObject({v:phase?"9.9.2":"9.9.1",version:phase===2?"9.9.2.2":phase?"9.9.2.1":"9.9.1.1"});
      await page.evaluate(()=>{window._mcProdEntregas=null;window._mcProdApkRevisiones=null;window._mcProdApk=0;window.__betaReports=[];cloud.betaReport=p=>{window.__betaReports.push(p);return Promise.resolve();};});
      return conProduccionEn(page,mode==="sin red"?null:"9.9.0");
    };
    await page.goto("/");let panel=await mount();
    let rowA=panel.locator(".beta-tanda").filter({has:page.locator(".beta-tanda-t",{hasText:"A ·"})});
    await rowA.getByRole("button",{name:/Va bien/}).click();await rowA.getByRole("button",{name:/Aprobar esta tanda/}).click();
    await expect(rowA.locator(".beta-tanda-n")).toContainText("aprobada");
    const oldVerdict=await page.evaluate(()=>store.get("_betaReview_"+CONFIG.APP_VERSION+"_v"));
    if(mode==="sin marcas")await page.evaluate(()=>["_betaReviewMarks","_betaReviewOk","_betaMarksHuella"].forEach(k=>store.del(k)));
    phase=1;await page.reload();panel=await mount();
    rowA=panel.locator(".beta-tanda").filter({has:page.locator(".beta-tanda-t",{hasText:"A ·"})});
    const rowB=panel.locator(".beta-tanda").filter({has:page.locator(".beta-tanda-t",{hasText:"B ·"})});
    await expect(panel.locator(".beta-tanda")).toHaveCount(2);
    await expect(rowA.locator(".beta-tanda-toggle")).toHaveAttribute("aria-expanded","false");
    await expect(rowA.locator(".beta-tanda-n")).toContainText("aprobada");
    await expect(rowB.locator(".beta-tanda-toggle")).toHaveAttribute("aria-expanded","true");
    await expect(rowB.getByRole("button",{name:/Aprobar esta tanda/})).toBeDisabled();
    await expect(rowA.locator(".beta-tanda-entrega")).toContainText(/Entrega sin confirmar|Delivery unconfirmed|Entrega sense confirmar/);
    await rowB.getByRole("button",{name:/Falla/}).click();await rowB.locator("input").fill("Fallo sintético exclusivo de B");
    if(mode==="sin red")notesOffline=true;
    await page.reload();panel=await mount();
    rowA=panel.locator(".beta-tanda").filter({has:page.locator(".beta-tanda-t",{hasText:"A ·"})});
    await expect(rowA.locator(".beta-tanda-n")).toContainText("aprobada");
    await expect(rowA.locator(".beta-tanda-toggle")).toHaveAttribute("aria-expanded","false");
    await expect(panel.locator(".beta-tanda").filter({hasText:"B ·"}).locator("input")).toHaveValue("Fallo sintético exclusivo de B");
    expect(await page.evaluate(()=>store.get("_betaReview_9.9.1.1_v"))).toEqual(oldVerdict);
    if(mode==="sin red"){
      // Sin WebCrypto ni siquiera una caché antes válida acredita la compilación.
      await page.evaluate(()=>localStorage.setItem("__betaNoCrypto","1"));await page.reload();
      await expect(page.locator(".botnav")).toBeVisible();await page.waitForFunction(()=>!document.getElementById("mc-load"));
      expect(await page.evaluate(()=>ensureReleaseNotes().then(arr=>arr.length))).toBe(0);
      panel=await conProduccionEn(page,null);
      await expect(panel).toContainText(/Comprobaciones sin confirmar|Checks are unconfirmed|Comprovacions sense confirmar/);
      await expect(panel.locator(".beta-tanda")).toHaveCount(0);
      expect(await page.evaluate(()=>store.get("_betaReview_9.9.1.1_v"))).toEqual(oldVerdict);
      await page.evaluate(()=>localStorage.removeItem("__betaNoCrypto"));await page.reload();panel=await mount();
      rowA=panel.locator(".beta-tanda").filter({hasText:"A ·"});
    }
    await rowA.locator(".beta-tanda-toggle").click();await rowA.getByRole("button",{name:/Cambiar de opinión/}).click();
    await expect(rowA.getByRole("button",{name:/Aprobar esta tanda/})).toBeVisible();
    await page.reload();panel=await mount();
    rowA=panel.locator(".beta-tanda").filter({hasText:"A ·"});await expect(rowA.locator(".beta-tanda-n")).not.toContainText("aprobada");
    // Un rechazo posterior tampoco puede desaparecer al reiniciar.
    const item=rowA.locator(".beta-item").first();if(await item.getByRole("button",{name:/Falla/}).count()===0)await item.click();
    await item.getByRole("button",{name:/Falla/}).click();await rowA.getByRole("button",{name:/Reportar/}).click();
    await page.reload();panel=await mount();rowA=panel.locator(".beta-tanda").filter({hasText:"A ·"});
    await expect(rowA.locator(".beta-tanda-n")).toContainText("rechazada");
    phase=2;
    if(mode==="sin red"){
      notesOffline=true;await page.reload();
      await expect(page.locator(".botnav")).toBeVisible();await page.waitForFunction(()=>!document.getElementById("mc-load"));
      expect(await page.evaluate(()=>ensureReleaseNotes().then(arr=>arr.length))).toBe(0);
      panel=await conProduccionEn(page,null);
      await expect(panel).toContainText(/Comprobaciones sin confirmar|Checks are unconfirmed|Comprovacions sense confirmar/);
      await expect(panel.locator(".beta-tanda")).toHaveCount(0);
      expect(await page.evaluate(()=>store.get("_betaReview_9.9.1.1_v"))).toEqual(oldVerdict);
      // El SW puede responder bien con notas antiguas: la nueva compilación debe rechazarlas.
      notesOffline=false;notesStale=true;await page.reload();
      await expect(page.locator(".botnav")).toBeVisible();await page.waitForFunction(()=>!document.getElementById("mc-load"));
      expect(await page.evaluate(()=>ensureReleaseNotes().then(arr=>arr.length))).toBe(0);
      panel=await conProduccionEn(page,null);
      await expect(panel).toContainText(/Comprobaciones sin confirmar|Checks are unconfirmed|Comprovacions sense confirmar/);
      await expect(panel.locator(".beta-tanda")).toHaveCount(0);
      expect(await page.evaluate(()=>localStorage.getItem("_rnBetaRound_9.9.2.2"))).toBeNull();
      expect(await page.evaluate(()=>store.get("_betaReview_9.9.1.1_v"))).toEqual(oldVerdict);
      // Novedades comparte la verificación y ofrece recuperación sin reiniciar la app.
      await page.evaluate(()=>{const h=document.createElement("div");h.id="e2e-notes-retry";document.body.appendChild(h);const root=ReactDOM.createRoot(h);root.render(React.createElement(WhatsNew,{onClose:function(){ root.unmount();h.remove(); }}));});
      const news=page.locator(".wn-panel");
      await expect(news).toContainText(/No se han podido comprobar|could not be verified|No s’han pogut comprovar/);
      await expect(news).not.toContainText("…");
      notesStale=false;await news.getByRole("button",{name:/Probar otra vez|Try again|Tornar-ho a provar/}).click();
      await expect(news).toContainText("v9.9.2.2");
      await news.getByRole("button",{name:/Entendido|Got it|Entesos/}).click();
      await panel.getByRole("button",{name:/Probar otra vez|Try again|Tornar-ho a provar/}).click();
      await expect(panel.locator(".beta-tanda")).toHaveCount(2);
      expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith("_rnBetaRound_")))).toEqual(["_rnBetaRound_9.9.2.2"]);
    }
    notesOffline=false;await page.reload();panel=await mount();rowA=panel.locator(".beta-tanda").filter({hasText:"A ·"});
    await expect(rowA.locator(".beta-tanda-toggle")).toHaveAttribute("aria-expanded","true");
    await expect(rowA.locator(".beta-tanda-n")).toHaveText("0/1");
    await expect(rowA.getByRole("button",{name:/Aprobar esta tanda/})).toBeDisabled();
    await panel.getByRole("button",{name:/Empezar la revisión de cero/}).click();
    await page.reload();panel=await mount();
    const resetB=panel.locator(".beta-tanda").filter({hasText:"B ·"});
    await resetB.getByRole("button",{name:/Falla/}).click();
    await expect(resetB.locator("input")).toHaveValue("");
    expect(await page.evaluate(h=>store.get("_betaReviewMarks")[h].notes,await page.evaluate(()=>betaChecklist(CONFIG.APP_VERSION,"9.9.0",0).tandas.find(g=>g.id.endsWith("ajena81")).huella))).toEqual({});
  });
}

});

for(const lang of ["es","en","ca"]) {
  test(`ronda mixta: conserva la checklist actual, modernas y comentarios con producción desconocida (${lang})`,async({page})=>{
    await abrirRevisionBeta(page,lang);
    const expected=await page.evaluate(async lang=>{
      await ensureLangPack(lang);CURLANG=lang;
      const ids=betaChecklist(RELEASE_NOTES[0].v+".1",null,48).tandas.map(g=>g.id.split("/").pop()).sort();
      RELEASE_NOTES.unshift({v:"4.26.99",t:{es:"Actual implícita",en:"Current implicit",ca:"Actual implícita"},items:{es:["1. A","2. B","3. C"],en:["1. A","2. B","3. C"],ca:["1. A","2. B","3. C"]}});
      CONFIG.APP_VERSION="4.26.99.1";window._mcProdApk=48;window._mcProdEntregas=null;window._mcProdApkRevisiones=null;
      window._mcProdVersion=()=>new Promise(resolve=>{window.__resolveMixed=resolve;});
      const host=document.createElement("div");host.id="e2e-mixed";document.body.appendChild(host);
      window.__mixedRoot=ReactDOM.createRoot(host);window.__mixedRoot.render(React.createElement(BetaReviewPanel,{onClose:function(){},showToast:function(){}}));
      return ids;
    },lang);
    expect(expected).toEqual(["beta-panel-veredictos","fin05-pago-cerrada","fin05-widget-reentrada","inc-0210-01-plan-cuota","inc-0210-03-gastos-periodo","inc-2709-01-arranque-red","inc-2709-10-perfil","inc-2709-12-cyber-fab","inc-2709-14-preguntar","inc-2809-02-ayuda-ciclo","inc-2909-01-widget-periodo","inc-2909-02-inicio-natural","inc-2909-03-retirada","inc-3009-01-cargos","inc-3009-nomina-anticipada","tr-descripcion-clasificacion","widget-app-cerrada","widget-banco"].sort());
    const panel=page.locator("#e2e-mixed .beta-review"),row=panel.locator(".beta-tanda").filter({has:page.getByText("1. A",{exact:true})});
    await expect(panel.locator(".beta-tanda")).toHaveCount(expected.length+1);await expect(row).toHaveCount(1);
    await expect(row.locator(".beta-item")).toHaveCount(3);await expect(row.locator(".beta-tanda-n")).toHaveText("0/3");
    expect(await page.evaluate(()=>betaChecklist(CONFIG.APP_VERSION,null,48).tandas.map(g=>g.id.split("/").pop()).sort())).toEqual(expected.concat(["todo"]).sort());
    await row.locator(".beta-item").nth(0).getByRole("button",{name:/Va bien/}).click();
    await row.locator(".beta-item").nth(1).getByRole("button",{name:/No lo puedo probar/}).click();
    await row.locator(".beta-item").nth(2).getByRole("button",{name:/Falla/}).click();
    await row.locator("input").fill("Comentario sintético de la ronda mixta");
    await expect(row.locator(".beta-tanda-n")).toHaveText("3/3");
    await expect(row.getByRole("button",{name:/Reportar/})).toBeEnabled();await expect(row.getByRole("button",{name:/Aprobar esta/})).toBeDisabled();
    await page.waitForFunction(()=>typeof window.__resolveMixed==="function");await page.evaluate(()=>window.__resolveMixed("4.26.67"));
    await expect(panel.locator(".beta-tanda")).toHaveCount(expected.length+1);await expect(row).toHaveCount(1);
    await expect(row.locator(".beta-tanda-n")).toHaveText("3/3");await expect(row.locator("input")).toHaveValue("Comentario sintético de la ronda mixta");
    expect(await page.evaluate(()=>betaChecklist(CONFIG.APP_VERSION,"4.26.67",48).tandas.map(g=>g.id.split("/").pop()).sort())).toEqual(expected.concat(["todo"]).sort());
    // Una nota familiar sin puntos explícitos no vuelve a crear la revisión que acabamos de marcar.
    await page.evaluate(()=>{window.__mixedRoot.unmount();RELEASE_NOTES[0].tandas=[];window._mcProdVersion=()=>Promise.resolve(null);window.__mixedRoot=ReactDOM.createRoot(document.getElementById("e2e-mixed"));window.__mixedRoot.render(React.createElement(BetaReviewPanel,{onClose:function(){},showToast:function(){}}));});
    await expect(panel.locator(".beta-tanda")).toHaveCount(expected.length);await expect(row).toHaveCount(0);
    expect(await page.evaluate(()=>betaChecklist(CONFIG.APP_VERSION,null,48).tandas.map(g=>g.id.split("/").pop()).sort())).toEqual(expected);
  });
}
