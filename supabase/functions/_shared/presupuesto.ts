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

/** Igual que `CAT_NEUTRAS` en el cliente: ni suman gasto ni suman ingreso. */
const CAT_NEUTRAS: Record<string, number> = { inversion: 1, traspaso: 1 };

export type FilaGasto = {
  importe: number | string;
  cat?: string | null;
  source?: string | null;
  fecha?: string | null;
  comercio?: string | null;
};

/**
 * La misma clave que usa la app al bajar gastos (`keyOf` en `syncCloudExpenses` /
 * `pushDeleted`): día UTC | importe | comercio. SIN la hora, a propósito.
 *
 * 2026-08-17: una compra en APOLLON GALLERY disparó DOS notis (Wallet 11:31 y TR 13:08,
 * 97 min — fuera de la ventana de 10 min de ingest). El banco solo tiene UN cargo de 230 €
 * y otro de 115 €. La nube guardó los dos 230 porque la clave única lleva la fecha completa.
 * La app los junta. Si el widget cuenta las dos, miente. Meter la hora en esta clave haría
 * que la app también mintiera: mostraría dos compras que el banco no tiene.
 */
export function claveComoLaApp(f: {
  fecha?: string | null;
  importe?: number | string;
  comercio?: string | null;
}): string {
  return String(f.fecha || "").slice(0, 10) + "|" + (Number(f.importe) || 0) + "|" + (f.comercio || "");
}

/**
 * Lo que la app ve de la tabla: sin las lápidas de `state.deleted` y una sola fila por clave.
 * `ingest` tiene que pasar ESTO a `statsDelMes`, no el volcado crudo: si no, el widget suma
 * gastos que él ya borró y notis gemelas que la lista ya fusionó.
 */
export function filasComoLaApp<T extends FilaGasto>(filas: T[] | null | undefined, deleted: string[] | null | undefined): T[] {
  const lap = new Set(deleted || []);
  const vistas = new Set<string>();
  const out: T[] = [];
  for (const f of filas || []) {
    const k = claveComoLaApp(f);
    if (lap.has(k)) continue;
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
  /* ⚠ EL `#dup` NO ES PARTE DEL NOMBRE DEL BANCO. Antes esto devolvía «trade_republic#dup», que no
     casa con ninguna cuenta, y por eso los posibles repetidos quedaban fuera del presupuesto: por
     ACCIDENTE, no por la regla. El día que alguien limpiara este parseo —que parece un despiste,
     porque lo es— los repetidos se habrían puesto a contar en el widget en silencio, y el cliente
     habría seguido sin contarlos. Se arregla el parseo Y se pone la regla de verdad abajo. */
  if (s.indexOf("ob:") === 0) return s.slice(3).split("#")[0] || null;
  if (s.indexOf("ob-hist:") === 0) return s.slice(8) || null;
  if (s.indexOf("manual:") === 0) return s.slice(7) || null;
  return null;
}

/** Rol de una cuenta. Espejo de `accRole()`: sin `role` explícito manda `spendFrom`. */
// deno-lint-ignore no-explicit-any
function rolDeCuenta(a: any): string {
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

/** ¿Este movimiento mueve la cifra del presupuesto? Espejo de `expenseCountsBudget()`. */
/** ¿Open Banking lo marcó como POSIBLE REPETIDO? El importador le pega `#dup` al `source`.
 *  Espejo exacto de `isPossibleDup()` del cliente. */
export function esPosibleRepetido(source?: string | null): boolean {
  const s = String(source || "");
  return s.indexOf("ob:") === 0 && s.slice(3).split("#")[1] === "dup";
}


export function cuentaParaPresupuesto(fila: FilaGasto, ents: string[]): boolean {
  if (!fila) return false;
  /* ⚠ EL POSIBLE REPETIDO NO CUENTA, IGUAL QUE EN EL CLIENTE (11/9).
     Esto faltaba SOLO en el servidor: el cliente ya lo excluía desde la tanda `posible-repetido`
     que él aprobó, pero el porte a producción se llevó la mitad de cliente y dejó esta fuera.

     ⚠⚠ Y CUADRABA IGUAL, POR ACCIDENTE — esto es lo que hay que entender antes de tocar nada:
     `bancoDeSource` devolvía «trade_republic#dup», con el marcador pegado al nombre del banco, y
     eso no casa con ninguna cuenta, así que la fila se caía por el FILTRO DE BANCOS y no por esta
     regla. Al arreglar el parseo (que era un despiste de verdad) la fila habría empezado a contar
     en el widget sin que nadie lo pidiera. Por eso van juntas las dos mitades.

     ⚠ NO es la causa de su 460 vs 475 del 10/9. Con el parseo viejo los dos lados coincidían, así
     que ese descuadre sigue SIN explicación conocida. Que nadie lo dé por cerrado leyendo esto.
     (Lo señaló Cursor revisando: yo había escrito aquí lo contrario que en el commit.) */
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
