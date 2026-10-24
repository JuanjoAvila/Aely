import { expect } from "@playwright/test";
// Las suites de listas relativas necesitan el mismo mes en Node y en la página.
// Las pruebas con reloj explícito omiten este helper mediante la anotación own-clock.
export const FIXTURE_NOW = Date.parse("2026-09-26T12:00:00Z");

/** Cartera como la del incidente de la 4.26.121 (13/10): todo existía antes de esta versión.
 *  Dos bienes heredados sin escalones, hipoteca y préstamo sin plazo con el ancla en el mes en
 *  curso y sin fecha explícita (la app nunca la escribe), dos financiaciones con plazo (una ya
 *  archivada), tres bancos con meses de movimientos, un sobre de efectivo con cierres desde el
 *  17/9, fotos de inversión desde el 30/9 y «Mi ciclo» con nómina. Sin ningún dato personal.
 *  Lo comparten el caso Node y el e2e para que las dos pruebas miren el mismo estado. */
export function estadoHeredado(today = "2026-10-13") {
  const [y, m] = today.split("-").map(Number), month = y * 12 + m - 1;
  const days = (from, to) => { const out = []; for (let ms = Date.parse(from + "T12:00:00Z"); ms <= Date.parse(to + "T12:00:00Z"); ms += 864e5) out.push(new Date(ms).toISOString().slice(0, 10)); return out; };
  const mov = (id, date, amount, ent, category = "super", extra = {}) => ({ id, date: date + "T12:00:00Z", amount, ent, category, merchant: "Movimiento sintético", ...extra });
  const expenses = [];
  days("2026-06-15", today).forEach((day, i) => {
    if (i % 3 === 0) expenses.push(mov("sab-" + i, day, 12.5, "sabadell"));
    if (day >= "2026-07-05" && i % 4 === 0) expenses.push(mov("cx-" + i, day, 20, "caixabank"));
    if (day >= "2026-07-10" && i % 5 === 0) expenses.push(mov("rv-" + i, day, 8, "revolut"));
    if (day.endsWith("-01")) {
      expenses.push(mov("sal-" + day, day, -2400, "sabadell", "ingreso", { merchant: "Nómina sintética" }));
      expenses.push(mov("hipo-" + day, day, 660.85, "sabadell", "deudas", { debtId: "hipo" }));
    }
    if (day.endsWith("-03")) expenses.push(mov("car-" + day, day, 197, "sabadell", "deudas", { debtId: "car-loan" }));
  });
  return {
    budget: 1000, settings: { autoPrices: false, theme: "green", budgetCycle: true },
    accounts: [
      { id: "sab", ent: "sabadell", name: "Cuenta corriente", value: 2500, role: "diario", spendFrom: true, bankIban: "ES-SYNTHETIC-SAB" },
      { id: "cash", ent: "efectivo", name: "Efectivo", value: 120, role: "fijos" }],
    obAccounts: [{ id: "ob-cx", ent: "caixabank", name: "Cuenta sintética", value: 1800, cur: "EUR" }, { id: "ob-rv", ent: "revolut", name: "Revolut sintética", value: 900, cur: "EUR" }],
    accountBalanceHistory: { "acc:cash": days("2026-09-17", today).map(day => ({ day, value: 120 })) },
    investments: [{ id: "fund", ent: "trade_republic", name: "Fondo sintético", value: 5200 }],
    invHistory: days("2026-09-30", today).map((d, i) => ({ d, v: 5000 + i * 15 })),
    assets: [{ id: "home", name: "Piso sintético", kind: "piso", value: 180000 }, { id: "car", name: "Coche sintético", kind: "coche", value: 15000 }],
    debts: [
      { id: "hipo", ent: "familia", name: "Hipoteca sintética", value: 176714.8, original: 180000, monthly: 660.85, day: 1, asOf: month, account: "sabadell" },
      { id: "car-loan", ent: "familia", name: "Préstamo coche sintético", value: 11212, original: 15000, monthly: 197, day: 3, asOf: month, account: "sabadell" },
      { id: "gym", ent: "familia", name: "Financiación sintética", value: 875.95, original: 875.95, monthly: 175.19, amort: 175.19, months: 5, day: 29, asOf: month - 3, account: "sabadell" },
      { id: "old", ent: "familia", name: "Financiación archivada sintética", value: 449.25, original: 449.25, monthly: 149.75, amort: 149.75, months: 3, day: 27, asOf: month - 3, account: "sabadell", archivedAt: "2026-10-02T10:00:00Z" }],
    expenses, fixed: [], flows: [], oneoffs: [], goals: [], shared: [], onboarded: true,
  };
}
export async function installFixtureClock(page) {
  await page.addInitScript((epoch) => {
    const NativeDate = Date, offset = epoch - NativeDate.now();
    function FixtureDate(...args) {
      const values = args.length ? args : [NativeDate.now() + offset];
      return new.target ? Reflect.construct(NativeDate, values, new.target) : new NativeDate(NativeDate.now() + offset).toString();
    }
    Object.setPrototypeOf(FixtureDate, NativeDate);
    FixtureDate.prototype = NativeDate.prototype;
    FixtureDate.now = () => NativeDate.now() + offset;
    window.Date = FixtureDate;
  }, FIXTURE_NOW);
}

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
    // Permite que una prueba simule una notificación recibida mientras la app está cerrada.
    window.__e2eCloudRows = cloudRows;
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
    window.__e2eCloudDelays = cloudDelays;
    const cloudErrors = overrides.__cloudErrors || {};
    delete overrides.__cloudErrors;
    const sessionDelay = overrides.__sessionDelayMs || 0;
    delete overrides.__sessionDelayMs;
    const authEvent = overrides.__authEvent || "INITIAL_SESSION";
    delete overrides.__authEvent;
    const authEventDelay = overrides.__authEventDelayMs || 0;
    delete overrides.__authEventDelayMs;
    const authEventUserId = overrides.__authEventUserId || null;
    delete overrides.__authEventUserId;
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
        const delay = Array.isArray(cloudDelays[t]) ? cloudDelays[t].shift() : cloudDelays[t];
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
          getSession: async () => {
            if(sessionDelay) await new Promise((r) => setTimeout(r,sessionDelay));
            return { data: { session } };
          },
          onAuthStateChange: (cb) => {
            setTimeout(() => cb(authEvent,authEvent==="SIGNED_OUT"?null:
              authEventUserId?{user:{id:authEventUserId,email:"other@test.local"}}:session), authEventDelay);
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
          signOut: async () => {},
        },
        from: (t) => makeChain(t),
        functions: { invoke: async (nombre, opts) => {
          const rec = window.__e2eInvokes || (window.__e2eInvokes = []);
          rec.push({ name: nombre, body: (opts && opts.body) || null });
          return cloudFns[nombre] || { data: {}, error: null };
        } },
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

/* ===== Gastos v5 (20/10/2026) =====
   La tarjeta resumen y los botones de periodo se fueron: la cifra viva vive en la cabecera fija
   (`gastos-cifra`, texto entero en un nodo oculto a la vista) con su línea (`gastos-estado`), y el
   periodo (Meses · Mi ciclo · Rango · Todo) se elige en Filtros. Estas ayudas existen para que
   cada spec no reinvente el camino. */
/** La pantalla de Gastos ACTIVA (Gastos se premonta escondida; acotar evita leer la copia). */
export const gastosRoot = (page) => page.locator(".page-scroll-host .gx-root");
export const gastosCifra = (page) => gastosRoot(page).getByTestId("gastos-cifra");
export const gastosEstado = (page) => gastosRoot(page).getByTestId("gastos-estado");
/** Elige periodo en la hoja de Filtros: "months" | "cycle" | "custom" | "all". */
export async function gastosPeriodo(page, id) {
  await gastosRoot(page).locator("button.v4-chip").filter({ hasText: "🎛️" }).first().click();
  await page.locator(`.v4-gastos-filter-sheet [data-periodo="${id}"]`).click();
  await page.locator(".v4-sheet-back").click({ position: { x: 5, y: 5 } });
  await page.locator(".v4-sheet-back").waitFor({ state: "detached" });
  await expect(gastosRoot(page)).toHaveAttribute("data-periodo", id);
}
/** Baja la lista hasta dejar el día `ymd` (aaaa-mm-dd) justo bajo la cabecera ya encogida.
 *  `ym` (mes de Madrid) distingue las dos mitades de un día local que cae en dos meses (fuera de España). */
export async function gastosBajaAlDia(page, ymd, ym) {
  const k = ymd.replaceAll("-", "");
  await page.evaluate(([k, ym]) => {
    const host = document.querySelector(".page-scroll-host"), el = host.querySelector(`[data-gx-day="${k}"]` + (ym ? `[data-gx-ym="${ym}"]` : ""));
    const head = host.querySelector(".gx-head"), pad = parseFloat(getComputedStyle(host).paddingTop) || 0;
    host.scrollTo(0, host.scrollTop + el.getBoundingClientRect().top - host.getBoundingClientRect().top - (pad + head.offsetHeight + 36) + 2);
  }, [k, ym]);
}
/** Un cargo de una fila gris (recibos/cuotas agrupados por día, SPEC §4.4): abre su fila si está
 *  plegada y devuelve el cargo. Antes eran tarjetas sueltas (`button.v4-mov`). */
export async function gastosGrisFila(page, nombre) {
  // `has` va relativo a la fila gris: un localizador que empieza en la raíz no casaría nunca.
  const grupo = gastosRoot(page).locator(".gx-gris").filter({ has: page.locator(".gx-gris-it", { hasText: nombre }) }).first();
  const item = grupo.locator(".gx-gris-it").filter({ hasText: nombre }).first();
  const cab = grupo.locator(".gx-gris-h");
  if ((await cab.getAttribute("aria-expanded")) !== "true") await cab.click();
  await expect(item).toBeVisible();
  return item;
}
/** Baja hasta el primer día pintado del mes `ym` (aaaa-mm, mes de Madrid) en la lista. */
export async function gastosBajaAlMes(page, ym) {
  const k = await gastosRoot(page).locator(`.gx-dia[data-gx-ym="${ym}"]`).first().getAttribute("data-gx-day");
  const ymd = k.slice(0, 4) + "-" + k.slice(4, 6) + "-" + k.slice(6, 8);
  await gastosBajaAlDia(page, ymd, ym);
}
