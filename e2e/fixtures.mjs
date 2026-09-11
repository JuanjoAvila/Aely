/** Estado mínimo onboarded + sesión Supabase simulada (sin red).
 *  `overrides` se mezcla sobre el estado base (p.ej. {investments:[...]}) para que cada test
 *  no tenga que repetir el objeto entero. */
export async function seedLoggedInDashboard(page, overrides = {}) {
  await page.addInitScript((overrides) => {
    // Sin esto, cada reload vuelve a pisar localStorage y tests como el orden de Gastos
    // «persiste tras recargar» nunca pueden ver lo que la app acaba de guardar.
    const seedOnce = !!overrides.__seedOnce;
    delete overrides.__seedOnce;
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
    const mockClient = () => {
      let tabla = "";
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        eq: () => chain,
        lt: () => chain,
        update: () => chain,
        upsert: () => chain,
        delete: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
      };
      chain.then = (resolve) => resolve({ data: cloudRows[tabla] || [], error: null });
      return {
        auth: {
          getSession: async () => ({ data: { session } }),
          onAuthStateChange: (cb) => {
            setTimeout(() => cb("INITIAL_SESSION", session), 0);
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
          signOut: async () => {},
        },
        from: (t) => { tabla = t; return chain; },
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
    localStorage.setItem("_seenVersion", "dev");
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
 *  primer goto("/") en cualquier test que necesite interactuar con la pantalla. */
export async function dismissNews(page) {
  const btn = page.getByRole("button", { name: /Entendido|Got it|D'acord/i });
  if (await btn.count()) await btn.first().click();
}
