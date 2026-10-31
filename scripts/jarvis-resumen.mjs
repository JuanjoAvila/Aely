#!/usr/bin/env node
/**
 * RESUMEN PARA JARVIS: el gasto del mes, los próximos cobros y los saldos, en un JSON local.
 *
 * POR QUÉ EXISTE (OK del dueño, 31/10/2026): su asistente personal (Jarvis, en su PC) quiere
 * contestar «¿cuánto llevo gastado?» o «¿qué me cobran esta semana?» sin abrir el móvil. Jarvis no
 * tiene que saber nada de Supabase ni de las reglas de la app: lee un fichero y ya.
 *
 * LAS CIFRAS SON LAS DE LA APP, NO UNA COPIA. Se carga la lógica del bundle (`public/index.html`,
 * con `load-pure-logic`, como los tests y `diag-mes`) y se calcula con sus funciones:
 *   · gastado del mes  → `monthBudgetStats(…).spent` con la ventana del mes natural de Gastos
 *     (la misma que pinta «Gastado en octubre»); por categoría, `categorySpentByMonth` con esa
 *     misma ventana (su suma cuadra al céntimo con la cabecera: lo vigila el test).
 *   · próximos cobros  → `planChargesMonth` (Plan › Recibos: pausados y pagados fuera) de este mes
 *     y del siguiente, recortado a 30 días. Cuotas de deuda incluidas.
 *   · saldos           → `saldoCuentaMostrada` con `insumosSaldoGasto`, como Cartera › Tus cuentas.
 * Reimplementar una sola de esas reglas aquí es justo el fallo de «la misma regla en seis sitios».
 *
 * Y EL ESTADO SE ARMA COMO EN UN MÓVIL RECIÉN INICIADO: `app_state` (que en la nube va sin gastos,
 * `slimForCloud`) + la tabla `expenses` entera pasada por `expensesFromRows` y la mezcla del pull
 * (`syncCloudExpenses`). Lo que solo vive en el móvil —el extracto del banco (`bankTx`)— aquí no
 * existe: un recibo que la app da por pagado SOLO por ese extracto aquí puede salir pendiente.
 *
 * SOLO LECTURA Y SOLO LOCAL. No hay un solo insert/update/delete: ni en Supabase ni en el repo.
 * La clave sale de `.env.local` (gitignored) de la carpeta donde se ejecuta, y no se imprime nunca.
 * El JSON va a `%LOCALAPPDATA%/Aely/jarvis-resumen.json` (fuera del repo, que es PÚBLICO) y lleva
 * nombres de recibos y cuentas e importes: nada de IBAN, ids, correos ni tokens.
 *
 * Uso:  npm run jarvis-resumen
 * `.env.local` necesita SUPABASE_SERVICE_ROLE_KEY y, como en la nube hay varios usuarios (él, su
 * pareja, su padre), AELY_JARVIS_USER=<su correo o su user_id>. Sin él, con más de un usuario,
 * sale con error en vez de adivinar de quién es la cartera.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { loadPureLogicFromFile } from "./load-pure-logic.mjs";

const PROJECT_REF = "sfyfjagbnhbplrljpbvh";
const BASE = `https://${PROJECT_REF}.supabase.co`;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const ymd = (y, m, d) => y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");

/* ---- El estado, como lo deja un primer inicio de sesión ---- */
// Mismo orden que el login fresco (`syncFromCloud` + `loadState`) y después el pull de gastos
// (`syncCloudExpenses`). Se omite lo que solo sirve para volver a escribir en la nube (Metas y
// Plan en conflicto, backfill, ACKs): este script no escribe.
export function estadoComoApp(ctx, cloudState, rows, userId) {
  const now = new Date();
  const delPrev = ctx.expenseDeletedSet({ deleted: cloudState.deleted || [] });
  const prevMerge = ctx.mergeExpenses([], cloudState.expenses || [], delPrev);
  let s = Object.assign({}, ctx.buildEmpty(), cloudState, { expenses: prevMerge.list, bankTx: [], _historyOwner: userId });
  s = ctx.seedFlows(ctx.fixMovInvasion(ctx.fixRevoDupes(ctx.fixInvAuto(ctx.fixInvSold(ctx.reconcileTR(s))))));
  s = ctx.liberarReservasHuerfanas(ctx.reconcileEarlyIncomeAnchors(s, now.getFullYear(), now.getMonth() + 1, now.getDate()));
  const readStartedAt = Date.now();
  const delSet = ctx.expenseDeletedSet(s);
  const incoming = ctx.expensesFromRows(rows, userId).filter(function (e) { return e.amount !== 0 && !ctx.expenseIsTombstoned(e, delSet); });
  const prev = s.expenses || [];
  const scope = ctx.expenseIdentityScopes(prev, incoming);
  scope.unmatched = incoming;
  const kept = ctx.keepCategoryChoices(prev, incoming, readStartedAt, scope);
  const merged = ctx.mergeExpensesFromCloud(kept.prev, kept.incoming, readStartedAt, ctx.expenseDeletedSet(s), scope);
  const base = Object.assign({}, s, { expenses: merged.list });
  const rec = ctx.reconcileObDupes(ctx.fixMovInvasion(base));
  return ctx.perfilSinDatosBanco(ctx.reconcileGemelosAutomaticos(rec.state, s));
}

/* ---- El resumen, con las funciones de la app ---- */
export function resumenDeEstado(ctx, state) {
  const lex = (code) => vm.runInContext(code, ctx);   // `const` del bundle (CAT, catName…) no cuelgan del sandbox
  const catName = lex("catName"), entOf = lex("entOf");
  const now = new Date();

  // La ventana de Gastos › Meses (`selectedPeriod` de 04-tab-gastos): día 1 de Madrid → día 1 siguiente.
  const ini = ctx.inicioDeMesMs(Date.now());
  const period = { startMs: ini, todayEndMs: ctx.inicioDeMesMs(ini + 35 * 864e5), cycle: null };
  const bs = ctx.monthBudgetStats(state, null, null, null, period);
  const porCategoria = ctx.categorySpentByMonth(state, null, null, period)
    .filter(function (c) { return c.spent > 0; })
    .map(function (c) { return { cat: catName(c.id), importe: r2(c.spent) }; });

  // Próximos 30 días: lo pendiente de Plan › Recibos de este mes desde hoy y lo del mes que viene.
  // Lo vencido sin pagar no es «próximo»; un recibo sin día de este mes sí sale, con fecha null.
  const y0 = now.getFullYear(), m0 = now.getMonth() + 1, d0 = now.getDate();
  const y1 = m0 === 12 ? y0 + 1 : y0, m1 = m0 === 12 ? 1 : m0 + 1;
  const limite = new Date(y0, m0 - 1, d0 + 30);
  const tipo = (x) => (x.kind === "debt" || x.kind === "balloon") ? "deuda" : "recibo";
  const cobros = [];
  const pon = (x, y, m, enEsteMes) => {
    if (x.day == null) { if (enEsteMes) cobros.push({ nombre: x.name || null, importe: r2(Math.abs(x.amount)), fecha: null, tipo: tipo(x) }); return; }
    // Un día 31 en un mes de 30 es el último día (así lo recorre `minWalk`: el recibo se cobra ese mes).
    const d = Math.min(Number(x.day), new Date(y, m, 0).getDate());
    const f = new Date(y, m - 1, d);
    if (enEsteMes ? d < d0 : f > limite) return;
    cobros.push({ nombre: x.name || null, importe: r2(Math.abs(x.amount)), fecha: ymd(y, m, d), tipo: tipo(x) });
  };
  ctx.planChargesMonth(state, m0, y0, d0).pendingBills.forEach((x) => pon(x, y0, m0, true));
  ctx.planChargesMonth(state, m1, y1, 0).pendingBills.forEach((x) => pon(x, y1, m1, false));
  cobros.sort(function (a, b) {
    if (a.fecha !== b.fecha) return a.fecha == null ? 1 : b.fecha == null ? -1 : a.fecha < b.fecha ? -1 : 1;
    return b.importe - a.importe;
  });

  // Saldos de Cartera › Tus cuentas, en su orden. Una cuenta sin saldo numérico sale null.
  const ins = ctx.insumosSaldoGasto(state);
  const opts = { injTR: ins.injTR, spentByBank: ins.spentByBank, paidNetByBank: ins.paidNetByBank, roundup: ins.roundup, monthlyInvest: ins.monthlyInvest };
  const iso = (ms) => (ms > 0 ? new Date(ms).toISOString() : null);
  const cuentas = ctx.accountRowsInOrder(state).map(function (r) {
    const a = r.item;
    const num = typeof a.value === "number" && Number.isFinite(a.value);
    if (r.kind === "ob") {
      const v = num ? ctx.toEurAmt(a.value, a.cur || "EUR", state) : null;
      const at = Date.parse(a.balanceAt);
      return { nombre: ((state.obLabels || {})[a.key]) || ctx.niceObName(a), saldo: v == null || !Number.isFinite(v) ? null : r2(v), leidoEn: iso(at) };
    }
    return { nombre: a.name || entOf(a.ent).label, saldo: num ? r2(ctx.saldoCuentaMostrada(a, opts)) : null, leidoEn: iso(ctx.saldoLeidoDelBanco(state, a.ent)) };
  });

  return {
    version: 1,
    generadoEn: new Date().toISOString(),
    mes: { gastado: r2(bs.spent), porCategoria: porCategoria },
    proximosCobros: cobros,
    cuentas: cuentas,
  };
}

/* ---- Escritura atómica: Jarvis nunca lee un JSON a medias ---- */
export function escribirResumen(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

export function rutaResumen(env = process.env) {
  const base = env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(base, "Aely", "jarvis-resumen.json");
}

/* ---- Lectura de la nube (SOLO GET) ---- */
function loadEnvLocal(dir) {
  const f = path.join(dir, ".env.local");
  if (!fs.existsSync(f)) return null;
  const out = {};
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

// Se lanza y se sale con `exitCode`, no con `process.exit`: en Windows, cortar con una petición
// todavía abierta tumba Node con un assert de libuv (salía 127 en vez de 1).
class Fallo extends Error {}
function fallo(msg) { throw new Fallo(msg); }

async function main() {
  const t0 = Date.now();
  const local = loadEnvLocal(process.cwd());
  if (!local) fallo("falta .env.local en " + process.cwd() + " (ejecútalo desde la raíz del repo).");
  const env = Object.assign({}, local, process.env);
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!KEY) fallo("falta SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const get = async (p) => {
    let r;
    try { r = await fetch(`${BASE}${p}`, { headers, signal: AbortSignal.timeout(20000) }); }
    catch { fallo("sin conexión con Supabase."); }
    // Ni el cuerpo ni la URL se vuelcan: solo el código.
    if (!r.ok) fallo(`Supabase respondió ${r.status} al leer ${p.split("?")[0]}.`);
    return r.json();
  };

  // De quién es la cartera: AELY_JARVIS_USER (correo o user_id) o, si solo hay una, esa.
  const estados = await get("/rest/v1/app_state?select=user_id,data");
  const quien = (env.AELY_JARVIS_USER || "").trim();
  let uid = null;
  if (quien.includes("@")) {
    const u = await get("/auth/v1/admin/users?per_page=1000");
    const hit = (u.users || []).find((x) => String(x.email || "").toLowerCase() === quien.toLowerCase());
    if (!hit) fallo("AELY_JARVIS_USER no corresponde a ningún usuario.");
    uid = hit.id;
  } else if (quien) {
    // Va a la URL de la consulta: solo un uuid, nunca texto libre.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quien)) fallo("AELY_JARVIS_USER debe ser un correo o un user_id.");
    uid = quien;
  }
  else if (estados.length === 1) uid = estados[0].user_id;
  else fallo(`hay ${estados.length} usuarios: pon AELY_JARVIS_USER=<tu correo> en .env.local.`);
  const fila = estados.find((e) => e.user_id === uid);
  if (!fila || !fila.data) fallo("ese usuario no tiene cartera en la nube.");

  // Todo el histórico, por páginas, como `cloud.pullExpenses` (id descendente).
  const rows = [];
  let cursor = null;
  for (;;) {
    const q = `/rest/v1/expenses?select=*&user_id=eq.${uid}&order=id.desc&limit=1000` + (cursor ? `&id=lt.${cursor}` : "");
    const page = await get(q);
    rows.push(...page);
    if (page.length < 1000) break;
    cursor = page[page.length - 1].id;
  }
  const t1 = Date.now();

  const ctx = loadPureLogicFromFile();
  const state = estadoComoApp(ctx, fila.data, rows, uid);
  const resumen = resumenDeEstado(ctx, state);
  const out = rutaResumen(env);
  escribirResumen(out, resumen);
  console.log(`jarvis-resumen: ${out} · ${rows.length} movimientos · ${resumen.proximosCobros.length} cobros · ${resumen.cuentas.length} cuentas · red ${t1 - t0} ms · total ${Date.now() - t0} ms`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((e) => {
    // Un fallo inesperado se resume en una línea: su mensaje podría arrastrar datos de la cartera.
    console.error("jarvis-resumen: " + (e instanceof Fallo ? e.message : "error inesperado (" + String(e && e.name || "Error") + ")."));
    process.exitCode = 1;
  });
}
