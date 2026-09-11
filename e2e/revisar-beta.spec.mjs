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

async function abrirRevisionBeta(page) {
  await seedLoggedInDashboard(page);
  await page.addInitScript(() => { localStorage.setItem("_mcChannel", "beta"); });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  /* NOTAS-BUNDLE: el histórico ya no viaja en el index, se pide aparte. Sin esperarlo,
     `betaChecklist` sale vacío y estos tests fallarían por una carrera, no por la regla que
     vigilan. Se dispara la carga a mano en vez de confiar en que algún componente la haya
     pedido ya: si el panel cambia de sitio, la espera sigue valiendo. */
  await page.evaluate(() => window.ensureReleaseNotes && window.ensureReleaseNotes());
  await page.waitForFunction(
    () => Array.isArray(window.RELEASE_NOTES) && window.RELEASE_NOTES.length > 0,
    null, { timeout: 10_000 });
}

test("el panel de revisión saca la checklist de las notas de la versión", async ({ page }) => {
  await abrirRevisionBeta(page);

  // Se abre el panel directamente (la ruta por Ajustes depende del perfil admin del servidor).
  const items = await page.evaluate(() => betaChecklist(CONFIG.APP_VERSION).items.length);
  expect(items, "la versión en curso debería traer notas que sirvan de checklist").toBeGreaterThan(0);
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
async function conProduccionEn(page, version) {
  await page.evaluate((v) => { window._mcProdVersion = () => Promise.resolve(v); }, version);
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
  await expect(panel.getByRole("button", { name: /Aprobar esta (beta|tanda)/i })).toHaveCount(0);
});

test("una versión sin sellar («dev») NO se da por aprobada sola", async ({ page }) => {
  await abrirRevisionBeta(page);
  // El bundle del repo va con APP_VERSION "dev" hasta que `stamp-version` corre. Con el NaN
  // suelto, esto escondía el veredicto en TODAS las betas que se probaran sin sellar.
  await page.evaluate(() => { CONFIG.APP_VERSION = "dev"; });
  const panel = await conProduccionEn(page, "4.12.1");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".beta-tanda").first().getByRole("button", { name: /Aprobar esta (beta|tanda)/i })).toBeVisible();
});

test("el progreso sobrevive a cerrar la app (se prueba durante días)", async ({ page }) => {
  await abrirRevisionBeta(page);
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "e2e-beta";
    document.body.appendChild(host);
    ReactDOM.createRoot(host).render(React.createElement(BetaReviewPanel, { onClose: () => {}, showToast: () => {} }));
  });
  await page.locator(".beta-item").nth(0).getByRole("button", { name: /Va bien/i }).click();
  await expect(page.locator(".beta-review")).toContainText("1/");

  // Recarga completa: el progreso vive en localStorage por versión.
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  // La clave va por COMPILACIÓN (4.12.0.17), no por versión base (4.12.0) — cambiado el
  // 2026-07-26 a petición suya: «cuando me subas una nueva versión con el fix, que se resetee y
  // se ponga vacío». Antes, la beta siguiente heredaba las cruces y los comentarios de la
  // anterior, así que el arreglo llegaba ya marcado como fallo. Dentro de la MISMA beta el
  // progreso se conserva, que es lo que prueba este test.
  const guardado = await page.evaluate(() => store.get("_betaReview_" + CONFIG.APP_VERSION));
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
  /* Un hotfix corto (p. ej. 4.16.1 con 2 viñetas) no llega a 3 puntos: el escenario de herencia
     necesita tres. Rellenamos la nota en memoria SOLO para este test — no toca el bundle real. */
  await page.evaluate(() => {
    const base = mcVerBase(CONFIG.APP_VERSION);
    const notes = (RELEASE_NOTES || []).find(function(n){ return n.v === base; }) || RELEASE_NOTES[0];
    // La checklist prioriza tandas sobre items: usar aquí la tanda implícita permite sembrar
    // tres puntos incluso cuando la versión real trae una tanda explícita de solo dos.
    if (notes) notes.tandas = [];
    if (notes && notes.items) {
      ["es", "en", "ca"].forEach(function(lang) {
        const arr = notes.items[lang];
        if (!Array.isArray(arr)) return;
        while (arr.length < 3) arr.push("punto sintético e2e " + arr.length);
      });
    }
    const items = betaChecklist(CONFIG.APP_VERSION).items;
    store.set("_betaReviewOk", { [items[0]]: "ok", [items[1]]: "na", [items[2]]: "ko" });
    store.set("_betaReviewNotas", { [items[2]]: "sigue pasando igual" });
    try { localStorage.removeItem("_betaReview_" + CONFIG.APP_VERSION); } catch (e) {}
    try { localStorage.removeItem("_betaReview_" + CONFIG.APP_VERSION + "_n"); } catch (e) {}
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
    const p = betaChecklist("4.8.0");        // del histórico: no declara tandas
    return { n: p.tandas.length, id: p.tandas[0].id, items: p.tandas[0].items.length, total: p.items.length };
  });
  expect(r.n).toBe(1);
  expect(r.id).toBe("todo");
  expect(r.items).toBe(r.total);             // la tanda implícita lo lleva todo
});

test("la versión en curso: tandas (o la implícita) cubren TODOS los puntos alineados", async ({ page }) => {
  /* Con tandas[] vacías (ronda ya promocionada) betaTandas inventa una sola «todo».
     Con varias, la lista plana TIENE que ser la concatenación exacta — regresión 2026-08-01. */
  await abrirRevisionBeta(page);
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

/** Siembra dos tandas de mentira en la entrada de RELEASE_NOTES que resuelve la versión en curso.
 *  Antes mutaba siempre RELEASE_NOTES[0]: valía mientras la ronda viva era esa. Con 4.14.0 delante
 *  y el test clavando APP_VERSION a un .7 de otra base, el panel leía la entrada real (vacía o con
 *  una sola tanda) y la siembra no llegaba. */
async function conTandasDePrueba(page) {
  await page.evaluate(() => {
    const base = typeof mcVerBase === "function"
      ? mcVerBase(CONFIG.APP_VERSION)
      : String(CONFIG.APP_VERSION || "").split(".").slice(0, 3).join(".");
    const n = (RELEASE_NOTES || []).filter(function (x) { return x.v === base; })[0] || RELEASE_NOTES[0];
    if (!n) return;
    n.tandas = [
      { id: "a", t: "Tanda A de prueba", items: { es: ["Punto A1", "Punto A2"] } },
      { id: "b", t: "Tanda B de prueba", items: { es: ["Punto B1", "Punto B2"] } },
    ];
  });
}

test("un fallo en una tanda NO bloquea aprobar las otras", async ({ page }) => {
  await abrirRevisionBeta(page);
  // Compilación de la ronda VIVA (RELEASE_NOTES[0]), no un número clavado de una ronda ya cerrada.
  await page.evaluate(() => { CONFIG.APP_VERSION = RELEASE_NOTES[0].v + ".7"; });
  await conTandasDePrueba(page);
  const panel = await conProduccionEn(page, "0.0.1");
  await expect(panel).toBeVisible();

  const tandas = panel.locator(".beta-tanda");
  const n = await tandas.count();
  expect(n, "esta prueba siembra 2 tandas").toBe(2);

  const primera = tandas.nth(0), segunda = tandas.nth(1);
  const aprobar = (t) => t.getByRole("button", { name: /Aprobar esta tanda/i });

  // La PRIMERA se marca entera como que va bien → su botón se habilita.
  const it1 = primera.locator(".beta-item");
  for (let i = 0; i < (await it1.count()); i++) {
    await it1.nth(i).getByRole("button", { name: /Va bien/i }).click();
  }
  await expect(aprobar(primera)).toBeEnabled();

  // Y en la SEGUNDA se marca un fallo. Lo que importa: la primera sigue aprobable.
  await segunda.locator(".beta-item").nth(0).getByRole("button", { name: /Falla/i }).click();
  await expect(aprobar(segunda)).toBeDisabled();
  await expect(aprobar(primera)).toBeEnabled();
  await expect(segunda).toContainText(/arréglalo antes de aprobar/i);
});

test("cada tanda lleva su cuenta propia, no la de la beta entera", async ({ page }) => {
  await abrirRevisionBeta(page);
  await page.evaluate(() => { CONFIG.APP_VERSION = RELEASE_NOTES[0].v + ".7"; });
  await conTandasDePrueba(page);
  const panel = await conProduccionEn(page, "0.0.1");
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
  await page.evaluate(() => { CONFIG.APP_VERSION = "4.13.0.11"; });
  const r0 = await page.evaluate(() => betaMarksCount(betaChecklist(CONFIG.APP_VERSION)));
  expect(r0.n, "arranca en 0 sin nada marcado").toBe(0);
  expect(r0.tot).toBeGreaterThan(0);

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
  await page.evaluate(() => { CONFIG.APP_VERSION = "4.13.0.10"; });
  await page.evaluate(() => {
    const items = betaChecklist(CONFIG.APP_VERSION).items;
    store.set("_betaReviewOk", { [items[0]]: "ok", [items[1]]: "ko" });
  });
  // Compilación NUEVA, mismo texto de puntos (import/bancos no se reescribieron esta ronda):
  // la cuenta tiene que seguir viendo esos dos marcados, heredados por TEXTO.
  await page.evaluate(() => { CONFIG.APP_VERSION = "4.13.0.11"; });
  const r = await page.evaluate(() => betaMarksCount(betaChecklist(CONFIG.APP_VERSION)));
  expect(r.n).toBeGreaterThanOrEqual(2);
});
