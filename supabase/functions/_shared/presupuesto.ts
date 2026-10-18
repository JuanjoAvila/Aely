/**
 * EL PRESUPUESTO DEL MES, TAL Y COMO LO CUENTA LA APP — espejo servidor de `monthBudgetStats()`
 * (`src/modules/08-motor-bank.js`).
 *
 * Bug real 2026-08-06: le saltó «¡95% del presupuesto! 965 € de 1.000 €» en la noti y en el widget,
 * y al abrir la app no llegaba al 30%. Las dos cifras salían de la MISMA nube, pero de dos cuentas
 * distintas: `ingest` sumaba **todas** las filas del mes sin filtrar nada, mientras que la app
 * descarta tres cosas. Con sus datos reales de agosto: servidor 964,58 € contra app 234,30 €.
 *
 * Lo que se colaba, medido:
 *   · Sabadell, 448,39 € — es su banco de recibos, no de gasto diario. La app enseña sus
 *     movimientos en la lista, pero NO los cuenta contra el presupuesto («que entre todo, pero que
 *     solo reste el de gasto diario», 2026-08-05).
 *   · Categoría Inversión, 281,89 € — las neutras (inversión/traspaso) son dinero suyo que cambia
 *     de sitio, no dinero gastado.
 *   · Y el presupuesto de referencia iba en bruto, sin restarle lo que él ya haya RESERVADO para
 *     sus metas ese mes.
 *
 * Un aviso que miente es peor que no avisar: enseña a ignorar los avisos. Por eso esto vive en un
 * módulo propio y con tests, y no suelto dentro del handler.
 *
 * ⚠ SI CAMBIA `monthBudgetStats()` EN EL CLIENTE, HAY QUE CAMBIAR ESTO. Son la misma regla escrita
 * dos veces porque corren en dos sitios (el widget se pinta con la app cerrada, sin JS del bundle).
 */

/** Zona de la casa. Cliente e ingest deben usar LA MISMA (B09-B, 2026-09-07). */
export const MC_TZ = "Europe/Madrid";

/**
 * Epoch ms del día 1 del mes calendario que contiene `when`, a las 00:00:00 en `timeZone`.
 * B09-B: ingest usaba `Date.UTC(y,m,1)` y el cliente `new Date(y,m,1)` local; una compra el
 * día 1 a las 00:30 en España caía en meses distintos → widget ≠ app.
 */
/* Formatters + ym→ms cacheados (espejo cliente 01-i18n.js). Misma semántica; evita
   recrear Intl en cada llamada cuando ingest/widget reevalúan el mes. */
let _inicioMesYmFmt: Intl.DateTimeFormat | null = null;
let _inicioMesDiaFmt: Intl.DateTimeFormat | null = null;
let _inicioMesTz: string | null = null;
let _inicioMesByYm: Record<string, number> = {};

export function inicioDeMesMs(when: number | Date = Date.now(), timeZone: string = MC_TZ): number {
  const t0 = when instanceof Date ? when.getTime() : Number(when);
  if (_inicioMesTz !== timeZone || !_inicioMesYmFmt) {
    _inicioMesTz = timeZone;
    _inicioMesYmFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit",
    });
    _inicioMesDiaFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    });
    _inicioMesByYm = {};
  }
  const ym = _inicioMesYmFmt.format(new Date(t0)); // "2026-09"
  if (_inicioMesByYm[ym] != null) return _inicioMesByYm[ym];
  const [y, m] = ym.split("-").map(Number);
  const target = y + "-" + String(m).padStart(2, "0") + "-01";
  const localYmd = (ms: number) => _inicioMesDiaFmt!.format(new Date(ms));
  // Primer ms UTC cuya fecha local en la zona es el día 1 (DST-safe).
  let lo = Date.UTC(y, m - 1, 1) - 14 * 3600_000;
  let hi = Date.UTC(y, m - 1, 1) + 14 * 3600_000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (localYmd(mid) < target) lo = mid + 1;
    else hi = mid;
  }
  _inicioMesByYm[ym] = lo;
  return lo;
}

/** Igual que `CAT_NEUTRAS` en el cliente: ni suman gasto ni suman ingreso. */
const CAT_NEUTRAS: Record<string, number> = { inversion: 1, traspaso: 1, deudas: 1 };

export type FilaGasto = {
  id?: string | null;
  importe: number | string;
  cat?: string | null;
  source?: string | null;
  fecha?: string | null;
  comercio?: string | null;
};

/**
 * La misma clave que usa la app al bajar gastos (`keyOfExpense` / `mergeExpenses`).
 * SIN la hora, a propósito (APOLLON Wallet+TR a 97 min = un solo cargo).
 *
 * 2026-09-11 Paso 0: si es MANUAL, la clave lleva el `id`. Él apuntó Bizums de 14,90 € a mano
 * tras perderlos en OB y la fusión se los comía otra vez. Comercio específico sigue sin id.
 */
export function esSourceManual(source?: string | null): boolean {
  const s = String(source || "");
  return !s || s === "manual" || s.indexOf("manual:") === 0 || s === "supabase";
}

export function claveComoLaApp(f: {
  fecha?: string | null;
  importe?: number | string;
  comercio?: string | null;
  source?: string | null;
  id?: string | null;
}): string {
  const base = String(f.fecha || "").slice(0, 10) + "|" + (Number(f.importe) || 0) + "|" + (f.comercio || "");
  if (esSourceManual(f.source)) return base + "|" + String(f.id || "");
  const ord = ordinalDeSource(f.source);
  return ord > 1 ? base + "|#" + ord : base;
}

/**
 * El SEGUNDO apunte igual del mismo día es otro apunte (12/10/2026: «5 bizums iguales se apuntaban
 * como uno»). El cliente lo marca con `obOrd` y viaja como último tramo del `source`: «ob:tr#n2».
 * Sin esto, `filasComoLaApp` fundía las k filas iguales en una y el widget restaba de menos.
 * Espejo de `obOrdinalOf()` + `ordinalDeTramos()` del cliente. Un servidor sin esta función lee el
 * banco igual (`split("#")[0]`) y solo pierde la separación: degrada a lo de siempre, no inventa.
 */
export function ordinalDeSource(source?: string | null): number {
  const s = String(source || "");
  if (s.indexOf("ob:") !== 0 && s.indexOf("ob-hist:") !== 0) return 1;
  const tramos = s.split("#").slice(1);
  for (const t of tramos) {
    const m = /^n(\d{1,6})$/.exec(t);
    if (m) { const n = parseInt(m[1], 10); if (n > 1) return n; }
  }
  return 1;
}

function claveLegacySinId(f: { fecha?: string | null; importe?: number | string; comercio?: string | null }): string {
  return String(f.fecha || "").slice(0, 10) + "|" + (Number(f.importe) || 0) + "|" + (f.comercio || "");
}

// Espejo de obBookedPreferenceKey: decidir BOOK no amplía la identidad ni los borrados.
function clavePreferenciaBook(f: FilaGasto): string {
  const ref = referenciaOb(f), day = String(f.fecha || "").slice(0, 10), cents = Math.round(Number(f.importe) * 100);
  if (!ref || !JSON.parse(ref)[1].trim() || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isSafeInteger(cents) || !f.comercio) return "";
  const marks = String(f.source || "").split("#").filter(t => !/^(?:pdng|n\d{1,6})$/.test(t) && !/^ref|^acc/.test(t)).join("#");
  return JSON.stringify([...JSON.parse(ref), day, ordinalDeSource(f.source), cuentaDeSource(f.source), cents, f.comercio, f.cat || "", marks]);
}

/**
 * Lo que la app ve de la tabla: sin lápidas y una fila por identidad bancaria o clave legacy.
 * `ingest` tiene que pasar ESTO a `statsDelMes`, no el volcado crudo: si no, el widget suma
 * gastos que él ya borró y notis gemelas que la lista ya fusionó.
 * Lápidas viejas (sin id) siguen ocultando manuales borrados antes del Paso 0.
 */
type ConfirmacionOb = { owner?: string; id?: string; key?: string; keepKey?: string; keepId?: string; ackAt?: unknown };
/** El hash agrupa colisiones; solo el testigo completo puede excluir un movimiento. */
export function confirmadasOb(value: unknown, owner?: string | null): ConfirmacionOb[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const p = value as { v?: number; o?: string; d?: unknown[]; r?: Record<string, unknown> };
  if (p.v !== 1 || p.o !== owner || !Array.isArray(p.d) || !p.d.every(s => typeof s === "string") || !p.r || typeof p.r !== "object" || Array.isArray(p.r)) return [];
  const out: ConfirmacionOb[] = [], d = p.d as string[];
  for (const bucket of Object.values(p.r)) {
    if (!Array.isArray(bucket)) return [];
    for (const row of bucket) {
      if (!Array.isArray(row) || row.length !== 5 || !row.slice(0,4).every(n => Number.isInteger(n) && n >= 0 && n < d.length)) return [];
      out.push({owner:owner!,id:d[row[0]],key:d[row[1]],keepId:d[row[2]],keepKey:d[row[3]],ackAt:row[4]});
    }
  }
  return out;
}
export function filasComoLaApp<T extends FilaGasto>(filas: T[] | null | undefined, deleted: string[] | null | undefined,
  pending?: { owner?: string; key?: string }[] | null, owner?: string | null,
  confirmed?: unknown): T[] {
  const lap = new Set(deleted || []);
  const validKey = (k?: string) => /^ob-absorbed2\|[^|]+\|[^|]+\|[1-9]\d{0,5}\|[^|]*\|\d{4}-\d{2}-\d{2}$/.test(k || "");
  const uuid = (id?: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || "");
  const own = confirmadasOb(confirmed,owner).filter(p => owner && p?.owner === owner && uuid(p.id) && uuid(p.keepId) && p.id !== p.keepId && validKey(p.key) && validKey(p.keepKey) && Object.prototype.hasOwnProperty.call(p,"ackAt"));
  const gone = new Set(own.map(p => p.key!)), kept = new Set(own.map(p => p.keepKey!)), keepIds = new Set(own.map(p => p.keepId));
  const index = (keys: Set<string>) => {
    const any = new Set<string>(), missing = new Set<string>();
    for (const key of keys) { const p = key.split("|"), base = p.slice(0,4).join("|") + "|" + p[5]; any.add(base); if (!p[4]) missing.add(base); }
    return { any, missing };
  };
  const goneIndex = index(gone), keptIndex = index(kept);
  const matches = (f: T, keys: Set<string>, ix: ReturnType<typeof index>) => {
    const key = claveAbsorcionOb(f); if (!key) return false;
    if (keys.has(key)) return true;
    const p = key.split("|"), base = p.slice(0,4).join("|") + "|" + p[5];
    return cuentaDeSource(f.source) ? ix.missing.has(base) : ix.any.has(base);
  };
  // Las no confirmadas tienen su propio tope y no caducan con las 500 lápidas normales.
  for (const p of Array.isArray(pending) ? pending : []) {
    if (owner && p?.owner === owner && /^ob-absorbed2\|[^|]+\|[^|]+\|[1-9]\d{0,5}\|[^|]*\|\d{4}-\d{2}-\d{2}$/.test(p.key || "")) lap.add(p.key!);
  }
  // La ausencia de cuenta en cualquiera de los lados es el mismo comodín que usa
  // el escritor para proteger a la superviviente; ambos índices se calculan una vez.
  const sinCuenta = new Set<string>();
  const cuentaAusente = new Set<string>();
  for (const k of lap) {
    const p = k.split("|");
    if ((p.length === 6 && p[0] === "ob-absorbed2") || (p.length === 7 && p[0] === "ob-absorbed3")) {
      const base = p.slice(0, 4).join("|") + "||" + p[5] + (p.length === 7 ? "|" + p[6] : "");
      sinCuenta.add(base); if (!p[4]) cuentaAusente.add(base);
    }
  }
  const live: T[] = [], books = new Map<string, T>();
  for (const f of filas || []) {
    if (Number(f.importe) === 0) continue; // Preautorización sin importe: no reserva identidad.
    // Igual que FIN10 cliente: primero superviviente, cuenta/día/ordinal completos;
    // una fila confirmada no puede consumir la referencia antes de quedar oculta.
    if (!keepIds.has(String(f.id)) && !matches(f,kept,keptIndex) && matches(f,gone,goneIndex)) continue;
    const k = claveComoLaApp(f);
    if (lap.has(k)) continue;
    const absorbed = claveAbsorcionOb(f);
    if (absorbed && lap.has(absorbed)) continue;
    // Reutilizar la base evita decodificar y codificar la referencia tres veces por fila.
    const p = absorbed ? absorbed.split("|") : null, base = p ? p.slice(1, 4).join("|") : "";
    const legacy = p ? "ob-absorbed|" + base : null;
    if (legacy && lap.has(legacy)) continue;
    const old = p ? "ob-absorbed2|" + base + "|" + p[4] + "|" + p[5] : null;
    if (old && lap.has(old)) continue;
    const lookup = p && p[4] ? cuentaAusente : sinCuenta;
    const omitida = p && (lookup.has("ob-absorbed3|" + base + "||" + p[5] + "|" + p[6]) || lookup.has("ob-absorbed2|" + base + "||" + p[5]));
    if (omitida) continue;
    if (esSourceManual(f.source) && lap.has(claveLegacySinId(f))) continue;
    live.push(f);
    const bookKey = clavePreferenciaBook(f);
    if (bookKey && !books.has(bookKey) && !/#pdng(?:#|$)/.test(String(f.source))) books.set(bookKey, f);
  }
  const vistas = new Map<string, Set<string>>(), referencias = new Set<string>();
  const out: T[] = [];
  for (const original of live) {
    const book = /#pdng(?:#|$)/.test(String(original.source)) && books.get(clavePreferenciaBook(original));
    const f = book || original, k = claveComoLaApp(f);
    // La fecha contable puede cambiar al pasar de PDNG a BOOK. El cliente identifica
    // banco+referencia antes de mirar el día; sin este espejo el widget suma ambos.
    // Las lápidas se aplican antes: una fila retirada no puede consumir la identidad.
    const ref = referenciaOb(f), anteriores = vistas.get(k);
    if (ref && referencias.has(ref)) continue;
    if (ref) referencias.add(ref);
    // Dos referencias conocidas distintas son compras distintas, incluso si todavía
    // no tienen ordinal. Las filas antiguas sin referencia conservan su dedup por clave.
    if (anteriores && (!ref || anteriores.has(""))) continue;
    if (!anteriores) vistas.set(k, new Set([ref]));
    else anteriores.add(ref);
    out.push(f);
  }
  return out;
}

function referenciaOb(f: FilaGasto): string {
  const source = String(f.source || ""), bank = bancoDeSource(source);
  if (!bank || (!source.startsWith("ob:") && !source.startsWith("ob-hist:"))) return "";
  const ref = /#ref([^#]+)/.exec(source);
  if (!ref) return "";
  try { return JSON.stringify([bank, decodeURIComponent(ref[1]), Number(f.importe)>0?1:Number(f.importe)<0?-1:0]); }
  catch (_) { return ""; }
}

function cuentaDeSource(source?: string | null): string {
  const m = /#acc([^#]*)/.exec(String(source || ""));
  try { return m ? decodeURIComponent(m[1]) : ""; } catch (_) { return ""; }
}
// El día es el de la fila almacenada, igual que en el escritor: sin convertir zonas.
function claveAbsorcionOb(f: FilaGasto, legacy: boolean | 2 = false): string | null {
  const source = String(f.source || "");
  if (!source.startsWith("ob:") && !source.startsWith("ob-hist:")) return null;
  const ref = /#ref([^#]*)/.exec(source), bank = bancoDeSource(source);
  if (!ref || !bank) return null;
  try {
    const base = encodeURIComponent(bank) + "|" + encodeURIComponent(decodeURIComponent(ref[1])) + "|" + ordinalDeSource(source);
    return legacy === true ? "ob-absorbed|" + base : (legacy === 2 ? "ob-absorbed2|" : "ob-absorbed3|") + base + "|" + encodeURIComponent(cuentaDeSource(source)) + "|" + String(f.fecha || "").slice(0, 10) + (legacy === 2 ? "" : "|" + (Number(f.importe)>0?1:Number(f.importe)<0?-1:0));
  }
  catch (_) { return null; }
}

/**
 * El banco (`ent`) de un gasto a partir de su `source`. Espejo de `expenseBankOf()`.
 * `source` lleva el banco embebido (`ob:caixa`, `manual:caixabank`…) porque no hay columna propia.
 * `null` = apuntado a mano sin banco → cuenta siempre, igual que en el cliente.
 */
export function bancoDeSource(source?: string | null): string | null {
  const s = String(source || "");
  if (s === "macrodroid" || s === "tr") return "trade_republic";
  // «#dup» → B09-D; «#n2» → ordinal; «~deuda.» → cuota; «~recibo.» → cargo de un recibo (otra
  // entrega lo escribe; aquí ya se lee). El histórico (`ob-hist:`) lleva las mismas marcas: hasta
  // el 12/10/2026 devolvía «trade_republic#n2» y esa fila se caía del presupuesto del widget.
  if (s.indexOf("ob:") === 0) return s.slice(3).split("#")[0].split("~")[0] || null;
  if (s.indexOf("ob-hist:") === 0) return s.slice(8).split("#")[0].split("~")[0] || null;
  if (s.indexOf("manual:") === 0) return s.slice(7) || null;
  return null;
}

/** Rol de una cuenta. Espejo de `accRole()`: sin `role` explícito manda `spendFrom`.
 *  Exportada para que el test pueda compararla DE FRENTE con la del cliente, no de rebote. */
// deno-lint-ignore no-explicit-any
export function rolDeCuenta(a: any): string {
  return (a && a.role) || (a && a.spendFrom ? "diario" : "fijos");
}

/**
 * Bancos cuyas compras cuentan para el presupuesto. Espejo de `expenseBankEnts()`: los marcados a
 * mano en `settings.expenseBanks` MÁS la cuenta de gasto diario, que entra siempre aunque la lista
 * ya tenga otros (si no, cambiar de banco diario dejaba el nuevo fuera para siempre).
 */
// deno-lint-ignore no-explicit-any
export function bancosDeGastoDiario(data: any): string[] {
  const out: string[] = [];
  const raw = data?.settings?.expenseBanks;
  if (Array.isArray(raw)) raw.forEach((e: string) => { if (e && out.indexOf(e) < 0) out.push(e); });
  // deno-lint-ignore no-explicit-any
  const diaria = (data?.accounts || []).find((a: any) => {
    const r = rolDeCuenta(a);
    return r === "diario" || r === "ambos";
  });
  if (diaria?.ent && out.indexOf(diaria.ent) < 0) out.push(diaria.ent);
  return out;
}

/**
 * ¿Es un Open Banking marcado como POSIBLE REPETIDO y todavía sin decidir? (B09-D, 2026-09-08).
 * La marca viaja DENTRO de `source` («ob:trade_republic#dup») porque no hay columna propia —
 * mismo truco que el banco. Espejo de `e.possibleDup` en el cliente.
 *
 * El sufijo, y no un prefijo nuevo, para que un servidor SIN esta línea siga leyendo un banco
 * («trade_republic#dup») que no está en su lista y lo excluya, en vez de leer «sin banco» y
 * sumarlo. Así el arreglo no depende de que este Supabase compartido se despliegue.
 */
export function esPosibleRepetido(source?: string | null): boolean {
  const s = String(source || "");
  return s.indexOf("ob:") === 0 && s.slice(3).split("#")[1] === "dup";
}

/**
 * ¿Es la cuota de una deuda que mandó el banco? (4.21.0). Viaja como `ob:<ent>~deuda.<id>`.
 * `~` y no `#` a propósito: un servidor sin esta función hace `split("#")[0]`, lee el banco
 * «sabadell~deuda.x», no lo encuentra en la lista y la deja FUERA. Espejo de `e.debtId` en el
 * cliente, que la saca del gastado y del saldo (ya resta en el Plan).
 */
export function esCuotaDeDeuda(source?: string | null): boolean {
  const s = String(source || "");
  return s.indexOf("ob:") === 0 && s.slice(3).split("#")[0].indexOf("~deuda.") > 0;
}

/**
 * ¿Es el cargo de un recibo o un puntual del Plan? (13/10/2026). Viaja como
 * `ob:<ent>~recibo.<id>` u `ob-hist:<ent>~recibo.<id>`: se ve en Gastos y no cuenta, porque el
 * recibo ya resta por su lado. Hasta que `bancoDeSource` empezó a devolver el banco limpio, estas
 * filas se quedaban fuera por llevar un banco «raro»; ahora hay que decirlo. El servidor no sabe
 * si el recibo sigue existiendo: por eso el cliente quita la marca de la fila al borrarlo o al
 * decir «no es este recibo». Espejo de `cargoDeRecibo()`.
 */
export function esCargoDeRecibo(source?: string | null): boolean {
  const s = String(source || "");
  if (s.indexOf("ob:") !== 0 && s.indexOf("ob-hist:") !== 0) return false;
  return s.slice(s.indexOf(":") + 1).split("#")[0].indexOf("~recibo.") > 0;
}

/** ¿Este movimiento mueve la cifra del presupuesto? Espejo de `expenseCountsBudget()`. */
export function cuentaParaPresupuesto(fila: FilaGasto, ents: string[]): boolean {
  if (!fila) return false;
  if (esCuotaDeDeuda(fila.source) || esCargoDeRecibo(fila.source)) return false;
  // Pendiente de que él diga «es el mismo» o «son distintos»: no mueve saldo ni presupuesto,
  // igual que en `expenseCountsCash()`. Sin esta línea el servidor sumaba lo que la app restaba
  // y el widget decía más que Inicio.
  if (esPosibleRepetido(fila.source)) return false;
  if (CAT_NEUTRAS[String(fila.cat || "")]) return false;
  const ent = bancoDeSource(fila.source);
  if (!ent) return true;                                   // a mano, sin banco → cuenta
  return ents.indexOf(ent) >= 0;
}

/** Lo apartado para metas desde `desdeMs`. Espejo de `reservedSince()`: se resta del presupuesto. */
// deno-lint-ignore no-explicit-any
export function reservadoDesde(data: any, desdeMs: number): number {
  // deno-lint-ignore no-explicit-any
  return (data?.reservaLog || []).reduce((a: number, x: any) => {
    const ms = new Date(x?.date).getTime();
    return isFinite(ms) && ms >= desdeMs ? a + (Number(x?.amount) || 0) : a;
  }, 0);
}

export type StatsMes = {
  spent: number;      // gasto bruto que cuenta
  income: number;     // ingresos que cuentan (en positivo)
  against: number;    // la cifra que se compara con el presupuesto (según gTotalMode)
  shown: number;      // la que PINTA la cabecera de Gastos → la misma que debe ir al widget
  budget: number;     // el presupuesto YA con lo reservado descontado
  reserved: number;
};

/**
 * La cuenta entera. `filas` son las del mes que ya vienen filtradas por fecha desde la consulta.
 *
 * `gTotalMode` decide qué se compara contra el presupuesto, igual que en el cliente:
 *   · "net"   → gasto MENOS ingresos (es como lo tiene él: por eso ve 234 € y no 413 €)
 *   · resto   → gasto bruto
 */
// deno-lint-ignore no-explicit-any
export function statsDelMes(filas: FilaGasto[], data: any, desdeMs: number): StatsMes {
  const ents = bancosDeGastoDiario(data);
  let spent = 0, income = 0;
  for (const f of filas || []) {
    if (!cuentaParaPresupuesto(f, ents)) continue;
    const n = Number(f.importe) || 0;
    if (n > 0) spent += n; else if (n < 0) income += Math.abs(n);
  }
  const reserved = reservadoDesde(data, desdeMs);
  const bruto = Number(data?.budget) || 0;
  const budget = bruto > 0 ? Math.max(0, +(bruto - reserved).toFixed(2)) : 0;
  const modo = data?.settings?.gTotalMode || "split";
  const against = modo === "net" ? spent - income : spent;
  // `shown` es lo que el widget debe enseñar: la MISMA cifra que la cabecera de Gastos. Solo se
  // separa de `against` cuando en modo neto los ingresos superan al gasto (ahí la app pinta el
  // saldo en positivo y el presupuesto se compara con un número negativo).
  const shown = modo === "net" ? Math.abs(income - spent) : spent;
  return {
    spent: +spent.toFixed(2),
    income: +income.toFixed(2),
    against: +against.toFixed(2),
    shown: +shown.toFixed(2),
    budget,
    reserved: +reserved.toFixed(2),
  };
}
