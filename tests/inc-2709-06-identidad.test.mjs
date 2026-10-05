#!/usr/bin/env node
/**
 * INC-2709-06, segunda pasada. Los guardianes de `inc-2709-06-caixa-extid` se paran antes
 * de clasificar, de commitir y de simular `expenses_dedup_idx`. Con datos inventados, en
 * UTC y en Europe/Madrid, aquí se recorre el pipeline real hasta el final:
 *
 *  1. Histórico incremental: A ya está; Edge devuelve A+B. Clasificar y commitir tienen
 *     que crear B, no marcarlo duplicado de A.
 *  2. Dos clientes con vistas parciales. El `onConflict` desplegado ignora la segunda
 *     escritura de la misma terna. Esa escritura no puede quedar en local como guardada,
 *     y al releer A+B la nube no puede acabar en A+A.
 *  3. El salado choca: `0`, `Az` y `BY`. La clave que cuenta es la del índice
 *     (fecha+importe+comercio), no el hash.
 *  4. Ida y vuelta del id: 150 caracteres, y también `ob-hist`. Perder la referencia
 *     del que ocupaba el mediodía no puede casar A y reinsertar B.
 *
 * El widget cuenta el par igual que la app: `claveComoLaApp` alarga la clave de un OB
 * que ya no es el mediodía local. macrodroid sigue en el día (APOLLON).
 * Ese límite se afirma aquí, no se disfraza de total arreglado. `#dup` y `~deuda` siguen
 * ganando su contrato. No hay extractos ni cuentas reales.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

if (!process.argv.includes("--zone-child")) {
  let status = 0;
  for (const zone of ["UTC", "Europe/Madrid"]) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--zone-child"], {
      env: { ...process.env, TZ: zone },
      stdio: "inherit",
    });
    if (r.status !== 0) status = r.status || 1;
  }
  process.exit(status);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srvSrc = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const srvJs = transformSync(srvSrc, { loader: "ts", format: "esm" }).code;
const { claveComoLaApp, filasComoLaApp, statsDelMes, bancoDeSource, esCuotaDeDeuda, esPosibleRepetido, inicioDeMesMs } =
  await import("data:text/javascript;base64," + Buffer.from(srvJs).toString("base64"));

const ctx = loadPureLogicFromFile();
const zona = process.env.TZ || "UTC";
let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
};

const ymd = new Date().toISOString().slice(0, 10);
const estado = (expenses, deleted) => ({
  accounts: [{ id: "a", ent: "caixabank", role: "diario", spendFrom: true, value: 100 }],
  expenses: expenses || [],
  deleted: deleted || [],
  fixed: [], debts: [], oneoffs: [],
  settings: { expenseBanks: ["caixabank"] },
});
const cargo = (id, extra) => Object.assign({
  ent: "caixabank", id, date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK", acctUid: "cx-unica",
}, extra || {});
const linkDe = (ids) => ({ links: [{ aspsp: "CaixaBank", accounts: [{ uid: "cx-unica", transactions: ids.map((id) => ({
  ext_id: id, date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK",
})) }] }] });

/* Índice desplegado: UNIQUE (user_id, fecha, importe, comercio) y upsert
   onConflict + ignoreDuplicates. La fila que choca no vuelve en el RETURNING. */
function indexKey(fecha, importe, comercio) {
  return new Date(fecha).toISOString() + "|" + (Number(importe) || 0) + "|" + (comercio || "");
}
function simularIndice(cloud, incoming) {
  const seen = new Set((cloud || []).map((r) => indexKey(r.fecha, r.importe, r.comercio)));
  const accepted = [], ignored = [];
  (incoming || []).forEach((e) => {
    const k = indexKey(e.date, e.amount, e.merchant);
    if (seen.has(k)) ignored.push(e);
    else { seen.add(k); accepted.push(e); }
  });
  return { accepted, ignored };
}
function filaNube(e) {
  return {
    id: e.id, fecha: e.date, importe: e.amount, comercio: e.merchant,
    source: ctx.expenseSourceForCloud(e), cat: e.category || "super",
  };
}
function desdeFila(r) {
  return ctx.expenseFromRow({
    id: r.id, fecha: r.fecha, importe: r.importe, comercio: r.comercio,
    cat: r.cat || "super", source: r.source, ob_name: r.comercio,
  });
}
/* Lo que el cliente puede dar por guardado. Si el índice ignora la escritura, no se
   conserva: se reubica con el sello libre que calcule el código, o se pierde. Quedarse
   la fila ignorada es el fallo de los dos clientes. */
function guardarCliente(cloud, adds) {
  const r = simularIndice(cloud, adds || []);
  const kept = [];
  r.accepted.forEach((e) => { cloud.push(filaNube(e)); kept.push(e); });
  if (!r.ignored.length) return { kept, ignored: [] };
  if (typeof ctx.obReassignSkipped === "function") {
    const retry = ctx.obReassignSkipped(r.ignored, cloud);
    const r2 = simularIndice(cloud, retry);
    if (r2.ignored.length) {
      throw new Error("el reintento sigue chocando: " + r2.ignored.map((e) => e.extId).join(","));
    }
    r2.accepted.forEach((e) => { cloud.push(filaNube(e)); kept.push(e); });
    return { kept, ignored: [] };
  }
  r.ignored.forEach((e) => kept.push(e));
  return { kept, ignored: r.ignored };
}
function extIdsNube(cloud) {
  return cloud.map((r) => desdeFila(r).extId);
}
/* `dayKey` es un const del bundle: el sandbox no lo publica. Misma cuenta, aquí. */
function diaCivil(stamp) {
  const d = new Date(stamp);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function mismoDiaCivil(stamp) {
  assert.equal(String(stamp).slice(0, 10), ymd);
  assert.equal(diaCivil(stamp), diaCivil(ctx.histDate(ymd)));
}

console.log("inc-2709-06-identidad (" + zona + ")");

t("1. histórico incremental: A ya está, Edge manda A+B, el commit crea B", () => {
  const ya = ctx.importObExpenses(estado(), [cargo("cargo-A")]);
  assert.equal(ya.length, 1);
  const flat = ctx.histFlattenHistoryLinks(linkDe(["cargo-A", "cargo-B"]), ya, {});
  assert.equal(flat.out.length, 1, "flatten se queda B");
  assert.equal(flat.out[0].id, "cargo-B");
  const cl = ctx.histClassifyCandidates(flat.out, estado(ya));
  assert.equal(cl.rows[0] && cl.rows[0].status, "new", "B no es el duplicado de A");
  const cm = ctx.histBuildCommit(flat.out, cl.rows, estado(ya), { batchId: "hist-inc" });
  assert.equal(cm.expAdds.length, 1);
  assert.equal(cm.expAdds[0].extId, "cargo-B");
  const cloud = [filaNube(ya[0])];
  const ix = simularIndice(cloud, cm.expAdds);
  assert.equal(ix.accepted.length, 1, "el índice admite B al lado de A");
  assert.equal(ix.ignored.length, 0);
  mismoDiaCivil(cm.expAdds[0].date);
  assert.notEqual(cm.expAdds[0].date, ya[0].date);
});

t("2. dos clientes parciales: la escritura ignorada no se queda y la nube no acaba A+A", () => {
  const cloud = [];
  const c1 = guardarCliente(cloud, ctx.importObExpenses(estado(), [cargo("cargo-A")]));
  const c2 = guardarCliente(cloud, ctx.importObExpenses(estado(), [cargo("cargo-B")]));
  assert.equal(c1.kept.length, 1);
  const pull2 = cloud.map(desdeFila);
  const mezclado = ctx.mergeExpensesFromCloud(c2.kept, pull2).list;
  const otra = ctx.importObExpenses(estado(mezclado), [cargo("cargo-A"), cargo("cargo-B")]);
  if (otra) guardarCliente(cloud, otra);
  const ids = extIdsNube(cloud).slice().sort();
  assert.deepEqual(ids, ["cargo-A", "cargo-B"], "nube=" + ids.join(",") + " ignoredB=" + c2.ignored.length);
  assert.equal(cloud.length, 2);
  assert.equal(new Set(cloud.map((r) => indexKey(r.fecha, r.importe, r.comercio))).size, 2);
  assert.equal(c2.ignored.length, 0, "B no puede darse por guardado si el índice lo ignoró");
});

t("3a. salado 0/Az/BY en el sync diario: tres filas, tres fechas, el índice no tira ninguna", () => {
  const tres = [cargo("BY"), cargo("0"), cargo("Az")];
  const add = ctx.importObExpenses(estado(), tres);
  assert.equal(add && add.length, 3, "diario conservó " + (add ? add.length : 0));
  const fechas = new Set(add.map((e) => new Date(e.date).toISOString()));
  assert.equal(fechas.size, 3, "fechas diarias=" + [...fechas].join(" "));
  add.forEach((e) => mismoDiaCivil(e.date));
  const ix = simularIndice([], add);
  assert.equal(ix.ignored.length, 0, "el índice tira " + ix.ignored.map((e) => e.extId).join(","));
  assert.equal(ix.accepted.length, 3);
});

t("3b. salado 0/Az/BY en el histórico: commit e índice conservan los tres", () => {
  const flat = ctx.histFlattenHistoryLinks(linkDe(["0", "Az", "BY"]), [], {});
  assert.equal(flat.out.length, 3);
  const cl = ctx.histClassifyCandidates(flat.out, estado());
  assert.ok(cl.rows.every((r) => r && r.status === "new"));
  const cm = ctx.histBuildCommit(flat.out, cl.rows, estado(), { batchId: "hist-col" });
  assert.equal(cm.expAdds.length, 3);
  const stamps = new Set(cm.expAdds.map((e) => new Date(e.date).toISOString()));
  assert.equal(stamps.size, 3, "sellos históricos=" + [...stamps].join(" "));
  cm.expAdds.forEach((e) => mismoDiaCivil(e.date));
  const ixH = simularIndice([], cm.expAdds);
  assert.equal(ixH.ignored.length, 0, "el índice tira " + ixH.ignored.map((e) => e.extId).join(","));
  assert.equal(ixH.accepted.length, 3);
});

t("3c. tres clientes, cada uno con una referencia que colisiona: la nube se queda las tres", () => {
  const cloud = [];
  guardarCliente(cloud, ctx.importObExpenses(estado(), [cargo("0")]));
  guardarCliente(cloud, ctx.importObExpenses(estado(), [cargo("Az")]));
  guardarCliente(cloud, ctx.importObExpenses(estado(), [cargo("BY")]));
  const pull = cloud.map(desdeFila);
  const full = ctx.importObExpenses(estado(pull), [cargo("BY"), cargo("0"), cargo("Az")]);
  if (full) guardarCliente(cloud, full);
  assert.deepEqual(extIdsNube(cloud).slice().sort(), ["0", "Az", "BY"], "nube=" + extIdsNube(cloud).join(","));
  assert.equal(cloud.length, 3);
  assert.equal(full, null, "resync no añade otra tanda");
});

t("4. extId de 150 caracteres sobrevive al pull y el segundo sync no duplica", () => {
  const id = "L".repeat(150);
  const add = ctx.importObExpenses(estado(), [cargo(id)]);
  assert.equal(add.length, 1);
  const back = desdeFila(filaNube(add[0]));
  assert.equal(back.extId, id, "volvió " + (back.extId || "").length + " caracteres");
  assert.equal(ctx.expenseBankOf(back), "caixabank");
  assert.equal(ctx.importObExpenses(estado([back]), [cargo(id)]), null);
  const cloud = [filaNube(add[0])];
  assert.equal(simularIndice(cloud, [add[0]]).ignored.length, 1);
  assert.equal(cloud.length, 1);
});

t("4b. ob-hist conserva el extId: el mediodía de B no casa con A ni reinserta B", () => {
  const soloB = ctx.histFlattenHistoryLinks(linkDe(["cargo-B"]), [], {});
  const clB = ctx.histClassifyCandidates(soloB.out, estado());
  const cmB = ctx.histBuildCommit(soloB.out, clB.rows, estado(), { batchId: "hist-b" });
  assert.equal(cmB.expAdds.length, 1);
  const back = desdeFila(filaNube(cmB.expAdds[0]));
  assert.equal(back.extId, "cargo-B", "el pull de ob-hist perdió la referencia");
  assert.equal(back.ent, "caixabank");
  const mas = ctx.importObExpenses(estado([back]), [cargo("cargo-A"), cargo("cargo-B")]);
  assert.ok(mas && mas.length === 1, "entraron " + (mas ? mas.length : 0));
  assert.equal(mas[0].extId, "cargo-A");
  assert.notEqual(mas[0].date, back.date);
  const ids = [back.extId, mas[0].extId].slice().sort();
  assert.deepEqual(ids, ["cargo-A", "cargo-B"]);
  const cloud = [filaNube(back)];
  const ix = simularIndice(cloud, mas);
  assert.equal(ix.accepted.length, 1);
  assert.equal(ix.ignored.length, 0);

  const par = ctx.histFlattenHistoryLinks(linkDe(["cargo-B", "cargo-A"]), [], {});
  const cl = ctx.histClassifyCandidates(par.out, estado());
  const cm = ctx.histBuildCommit(par.out, cl.rows, estado(), { batchId: "hist-par" });
  const pulled = cm.expAdds.map((e) => desdeFila(filaNube(e)));
  assert.deepEqual(Array.from(pulled, (e) => e.extId).sort(), ["cargo-A", "cargo-B"]);
  const flat2 = ctx.histFlattenHistoryLinks(linkDe(["cargo-A", "cargo-B"]), pulled, {});
  const cl2 = ctx.histClassifyCandidates(flat2.out, estado(pulled));
  const cm2 = ctx.histBuildCommit(flat2.out, cl2.rows, estado(pulled), { batchId: "hist-par-2" });
  assert.equal(cm2.expAdds.length, 0, "la segunda pasada creó " + cm2.expAdds.length);
  assert.equal(ctx.importObExpenses(estado(pulled), [cargo("cargo-A"), cargo("cargo-B")]), null);
});

t("el id con separadores raros vuelve entero; #dup gana y ~deuda se queda", () => {
  const raro = "a b#c/ñ";
  const add = ctx.importObExpenses(estado(), [cargo(raro)]);
  assert.equal(desdeFila(filaNube(add[0])).extId, raro);
  assert.equal(ctx.expenseSourceForCloud({ source: "ob", ent: "caixabank", extId: "cargo-A", possibleDup: true }), "ob:caixabank#dup");
  assert.equal(ctx.expenseSourceForCloud({ source: "ob-hist", ent: "caixabank", extId: "cargo-A", possibleDup: true }), "ob-hist:caixabank#dup");
  const deuda = ctx.expenseSourceForCloud({ source: "ob", ent: "caixabank", extId: "cargo-A", debtId: "cuota1" });
  assert.equal(deuda, "ob:caixabank~deuda.cuota1#x.cargo-A");
  const vuelta = ctx.expenseFromRow({ id: "d1", fecha: ctx.histDate(ymd), importe: 12.5, comercio: "CUOTA", cat: "deudas", source: deuda });
  assert.equal(vuelta.debtId, "cuota1");
  assert.equal(vuelta.extId, "cargo-A");
  assert.equal(vuelta.ent, "caixabank");
  assert.equal(esCuotaDeDeuda(deuda), true);
  assert.equal(esPosibleRepetido("ob:caixabank#dup"), true);
  assert.equal(esPosibleRepetido(deuda), false);
  assert.equal(bancoDeSource(deuda), "caixabank");
  assert.equal(bancoDeSource(deuda), ctx.expenseBankOf({ source: deuda }));
  assert.equal(bancoDeSource("ob-hist:caixabank"), "caixabank");
});

t("app y widget cuentan los dos; #dup y ~deuda siguen fuera", () => {
  const a = ctx.importObExpenses(estado(), [cargo("cargo-A"), cargo("cargo-B")]);
  assert.equal(a.length, 2);
  const cafeStamp = ctx.histDate(ymd, "ob-ext|caixabank|cafe-1");
  const filas = [
    { fecha: a[0].date, importe: 12.5, comercio: "MERCADONA", cat: "super", source: ctx.expenseSourceForCloud(a[0]) },
    { fecha: a[1].date, importe: 12.5, comercio: "MERCADONA", cat: "super", source: ctx.expenseSourceForCloud(a[1]) },
    { fecha: cafeStamp, importe: 3, comercio: "CAFE", cat: "bares", source: "ob:caixabank" },
    { fecha: ctx.histDate(ymd), importe: 9, comercio: "DUP", cat: "otros", source: "ob:caixabank#dup" },
    { fecha: ctx.histDate(ymd), importe: 40, comercio: "CUOTA", cat: "deudas", source: "ob:caixabank~deuda.cuota1" },
  ];
  assert.notEqual(claveComoLaApp(filas[0]), claveComoLaApp(filas[1]));
  const vis = filasComoLaApp(filas, []);
  assert.equal(vis.filter((f) => f.comercio === "MERCADONA").length, 2);
  const ahora = Date.parse(ymd + "T22:00:00Z");
  const srv = statsDelMes(vis, {
    budget: 1000,
    accounts: [{ ent: "caixabank", role: "diario" }],
    settings: { expenseBanks: ["caixabank"], gTotalMode: "split" },
  }, inicioDeMesMs(ahora));
  const app = ctx.monthBudgetStats(estado(a.concat([
    { id: "cafe", date: cafeStamp, amount: 3, merchant: "CAFE", category: "bares", source: "ob", ent: "caixabank" },
  ])), ahora);
  assert.equal(app.spent, 28, "la app cuenta los dos MERCADONA y el café");
  assert.equal(srv.spent, 28, "widget " + srv.spent);
  assert.equal(srv.spent, app.spent);
});

console.log(fallos ? "inc-2709-06-identidad: " + fallos + " fallo(s) (" + zona + ")" : "inc-2709-06-identidad: OK (" + zona + ")");
process.exit(fallos ? 1 : 0);
