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
  return base;
}

function claveLegacySinId(f: { fecha?: string | null; importe?: number | string; comercio?: string | null }): string {
  return String(f.fecha || "").slice(0, 10) + "|" + (Number(f.importe) || 0) + "|" + (f.comercio || "");
}

/**
 * Lo que la app ve de la tabla: sin las lápidas de `state.deleted` y una sola fila por clave.
 * `ingest` tiene que pasar ESTO a `statsDelMes`, no el volcado crudo: si no, el widget suma
 * gastos que él ya borró y notis gemelas que la lista ya fusionó.
 * Lápidas viejas (sin id) siguen ocultando manuales borrados antes del Paso 0.
 */
export function filasComoLaApp<T extends FilaGasto>(filas: T[] | null | undefined, deleted: string[] | null | undefined): T[] {
  const lap = new Set(deleted || []);
  const vistas = new Set<string>();
  const out: T[] = [];
  for (const f of filas || []) {
    const k = claveComoLaApp(f);
    if (lap.has(k)) continue;
    if (esSourceManual(f.source) && lap.has(claveLegacySinId(f))) continue;
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push(f);
  }
  return out;
}

/**
 * El banco (`ent`) de un gasto a partir de su `source`. Espejo de `expenseBankOf()`.
 * `source` lleva el banco embebido (`ob:caixa`, `manual:caixabank`…) porque no hay columna propia.
 * `null` = apuntado a mano sin banco → cuenta siempre, igual que en el cliente.
 */
export function bancoDeSource(source?: string | null): string | null {
  const s = String(source || "");
  if (s === "macrodroid" || s === "tr") return "trade_republic";
  if (s.indexOf("ob:") === 0) return s.slice(3).split("#")[0].split("~deuda.")[0] || null;   // «#dup» → B09-D; «~deuda.» → cuota
  if (s.indexOf("ob-hist:") === 0) return s.slice(8) || null;
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

/** ¿Este movimiento mueve la cifra del presupuesto? Espejo de `expenseCountsBudget()`. */
export function cuentaParaPresupuesto(fila: FilaGasto, ents: string[]): boolean {
  if (!fila) return false;
  if (esCuotaDeDeuda(fila.source)) return false;
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
