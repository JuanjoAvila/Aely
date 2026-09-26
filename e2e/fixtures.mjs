/** Estado mínimo onboarded + sesión Supabase simulada (sin red).
 *  `overrides` se mezcla sobre el estado base (p.ej. {investments:[...]}) para que cada test
 *  no tenga que repetir el objeto entero. */
export async function seedLoggedInDashboard(page, overrides = {}) {
  await page.addInitScript((overrides) => {
    const seedOnce = !!overrides.__seedOnce;
    delete overrides.__seedOnce;
    const seenVersion = overrides.__seenVersion ?? "dev";
    delete overrides.__seenVersion;
    const session = { user: { id: "e2e-user", email: "e2e@test.local" } };
    // Filas por tabla para los tests que necesitan datos de la nube (p.ej. `bank_links` para
    // «Mis bancos»). Viaja dentro de `overrides` con un nombre que no choca con el estado real,
    // y se saca antes de mezclarlo para no sembrarlo como si fuera un campo de la cartera.
    const cloudRows = overrides.__cloudRows || {};
    delete overrides.__cloudRows;
    // Respuestas de `supabase.functions.invoke(nombre, …)` por nombre de función Edge (p.ej.
    // "bank-sync", que sirve tanto el sync diario como el histórico). Solo datos JSON —nada de
    // funciones— porque `overrides` viaja serializado a `page.addInitScript`. Sin entrada para
    // ese nombre, se mantiene la respuesta genérica de siempre (compatibilidad con los tests que
    // ya había, que no miran el resultado de ninguna función).
    const cloudFns = overrides.__cloudFns || {};
    delete overrides.__cloudFns;
    // Retardo (ms) y error por tabla, para ver el ORDEN entre la nube y el banco (15/9): una nube
    // que tarda o que falla es justo cuando un móvil con el estado viejo repetía movimientos.
    const cloudDelays = overrides.__cloudDelays || {};
    delete overrides.__cloudDelays;
    const cloudErrors = overrides.__cloudErrors || {};
    delete overrides.__cloudErrors;
    const mockClient = () => {
      /* Una cadena POR consulta (15/9): con una sola compartida, un `from("bank_links")` que
         arrancaba entre el `from("expenses")` y su `await` le cambiaba la tabla a la otra. */
      const makeChain = (tabla) => {
      let rowLimit=Infinity, beforeId=null, rowOrders=[], read=true;
      const chain = {
        select: () => chain,
        order: (key,opts) => { rowOrders.push([key,opts]); return chain; },
        limit: (n) => { rowLimit=n; return chain; },
        eq: () => chain,
        lt: (key,value) => { if(key==="id") beforeId=value; return chain; },
        update: () => { read=false; return chain; },
        upsert: () => { read=false; return chain; },
        delete: () => { read=false; return chain; },
        /* Antes devolvía SIEMPRE null, así que `cloud.pullState()` nunca traía nada y NINGÚN test
           podía ver lo que pasa cuando la nube SÍ tiene cartera. Ese agujero escondió el fallo del
           modo inicial: en el navegador la cartera vacía se quedaba vacía porque no había nube que
           la rellenara, y en su móvil —con sesión de verdad— se rellenaba sola. Ahora el doble
           puede traer estado, poniéndolo en `__cloudRows.app_state`. */
        maybeSingle: async () => {
          if (cloudDelays[tabla]) await new Promise((r) => setTimeout(r, cloudDelays[tabla]));
          if (cloudErrors[tabla]) return { data: null, error: { message: cloudErrors[tabla] } };
          return { data: (cloudRows[tabla] || [])[0] || null, error: null };
        },
        single: async () => ({ data: null, error: null }),
      };
      chain.then = (resolve) => {
        const t = tabla;
        const delay = cloudDelays[t];
        let data=Array.isArray(cloudRows[t]) ? cloudRows[t].slice() : [];
        if(t==="expenses" && read){
          // FIN-07: el doble debe respetar la consulta o repetiría la primera página sin fin.
          rowOrders.slice().reverse().forEach(([key,opts]) => data.sort((a,b) =>
            (a[key]<b[key]?-1:a[key]>b[key]?1:0)*(opts?.ascending===false?-1:1)));
          if(beforeId) data=data.filter(r => r.id<beforeId);
          data=data.slice(0,rowLimit);
        }
        const out = cloudErrors[t]
          ? { data: null, error: { message: cloudErrors[t] } }
          : { data, error: null };
        if (delay) setTimeout(() => resolve(out), delay);
        else resolve(out);
      };
      return chain;
      };
      return {
        auth: {
          getSession: async () => ({ data: { session } }),
          onAuthStateChange: (cb) => {
            setTimeout(() => cb("INITIAL_SESSION", session), 0);
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
          signOut: async () => {},
        },
        from: (t) => makeChain(t),
        functions: { invoke: async (nombre) => cloudFns[nombre] || { data: {}, error: null } },
      };
    };

    // Intercepta la asignación de supabase.min.js para devolver cliente mock.
    let _sb = null;
    Object.defineProperty(window, "supabase", {
      configurable: true,
      enumerable: true,
      get() {
        return _sb;
      },
      set(lib) {
        if (lib && typeof lib.createClient === "function") {
          _sb = { createClient: () => mockClient() };
        } else {
          _sb = lib;
        }
      },
    });

    const base = {
      fx: 0.92,
      budget: 500,
      monthStartNet: 1000,
      history: [],
      accounts: [{ id: "e2e", ent: "sabadell", name: "Cuenta", value: 1000 }],
      investments: [],
      assets: [],
      debts: [],
      fixed: [],
      flows: [],
      oneoffs: [],
      aportaciones: [],
      expenses: [],
      goals: [],
      shared: [],
      catOverrides: {},
      obAccounts: [],
      obLabels: {},
      verNotes: [],
      streak: 0,
      tourSeen: true,
      setupHint: false,
      settings: { autoPrices: false, theme: "green" },
      lastSync: null,
      lastPriceSync: null,
      onboarded: true,
      _dataVer: 6,
      trAnchor: new Date().toISOString().slice(0, 7),
    };
    if (!seedOnce || !sessionStorage.getItem("_e2eSeeded")) {
      localStorage.setItem("micartera_v3", JSON.stringify(Object.assign(base, overrides)));
      if (seedOnce) sessionStorage.setItem("_e2eSeeded", "1");
    }
    localStorage.setItem("_seenVersion", seenVersion);
    // Guardamos lo sembrado, no lo que lea el helper después: al abrir el popup la app ya
    // sella _seenVersion, y confundir ese sello tardío con el inicial escondería la carrera.
    window.__e2eNewsSeenVersion = seenVersion;
    try {
      ["dash", "metas", "gastos", "fijos", "inv"].forEach((id) =>
        localStorage.setItem("_coach_" + id, "1")
      );
    } catch (e) {}
    // Informe mensual automático (11-app-main.js): sale solo a los 3s si el DÍA REAL es 1, y sin
    // esto se cuela por encima de cualquier test que tarde >=3s en interactuar — exactamente el
    // día 1 de cada mes, que es cuando nadie lo está mirando hasta que CI lo pilla (2026-08-01:
    // rendimiento-tabs, swipe-pestanas y la búsqueda de Gastos fallaron los tres a la vez, todos
    // con el mismo "tabsheet-back"/"Ahora no" tapando la pantalla — no es un bug del código, es
    // que ningún fixture lo silenciaba). Se marca como "ya visto este mes" con la MISMA clave que
    // usa la app (`_mr<año>-<mes>`), así el popup no vuelve a colarse en ningún test futuro.
    try {
      const d = new Date();
      localStorage.setItem(
        "_mr" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"),
        "1"
      );
    } catch (e) {}
  }, overrides);
}

/** Cierra el popup de Novedades si sale (cambia de versión en cada release). Llamar tras el
 *  primer goto("/") en cualquier test que necesite interactuar con la pantalla.
 *  ⚠ Esperar de verdad: con varias betas el mismo día el popup a veces monta DESPUÉS del
 *  primer tick y un `count()` a pelo lo dejaba abierto — luego interceptaba los clics del
 *  panel de revisión (CI 4.19.89). */
export async function dismissNews(page) {
  // La mayoría de pruebas siembran esta versión como vista. Esperar cuatro segundos por
  // un popup que la app no debe abrir añadía minutos a cada pasada (feedback 15/9).
  // Se consulta la versión DEL NAVEGADOR con la regla real, también para sufijos de beta.
  // Una versión vieja, un panel ya montado o cualquier duda conservan la espera de siempre.
  const alreadySeen = await page.evaluate(() => {
    if (typeof CONFIG === "undefined" || typeof mcVerBase !== "function") return false;
    const version = mcVerBase(CONFIG.APP_VERSION);
    return window.__e2eNewsSeenVersion === version &&
      localStorage.getItem("_seenVersion") === version && !document.querySelector(".wn-panel");
  }).catch(() => false);
  if (alreadySeen) return;
  const btn = page.getByRole("button", { name: /Entendido|Got it|D'acord/i });
  try {
    await btn.first().waitFor({ state: "visible", timeout: 4_000 });
  } catch (_) {
    return;
  }
  await btn.first().click();
  await page.locator(".wn-panel").waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});
}
