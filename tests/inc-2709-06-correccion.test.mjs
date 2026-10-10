#!/usr/bin/env node
/**
 * INC-2709-06, corrección del 10/10. La red día|importe|comercio es la regla.
 * Dos referencias solo se parten si llegan en la MISMA respuesta. Este fichero
 * falla con el bundle de ed09ce1d y pasa con el arreglo. Corre en UTC y en
 * Europe/Madrid. El punto 1 compara, en la misma pasada, el cliente de esta
 * zona con el servidor forzado a UTC. No hay extractos ni cuentas reales.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const here = fileURLToPath(import.meta.url);

if (process.argv.includes("--server-utc")) {
  const day = process.argv[process.argv.length - 1];
  const root = path.dirname(path.dirname(here));
  const srvSrc = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
  const srvJs = transformSync(srvSrc, { loader: "ts", format: "esm" }).code;
  const srv = await import("data:text/javascript;base64," + Buffer.from(srvJs).toString("base64"));
  const iso = srv.mediodiaMadridIso(day);
  const legacy = day + "|12.5|MERCADONA";
  const k = srv.claveComoLaApp({ fecha: iso, importe: 12.5, comercio: "MERCADONA", source: "ob" });
  const vis = srv.filasComoLaApp([
    { fecha: iso, importe: 12.5, comercio: "MERCADONA", source: "ob:caixabank" },
    { fecha: iso.replace("T10:", "T16:").replace("T11:", "T16:"), importe: 12.5, comercio: "MERCADONA", source: "ob:caixabank#x.cargo-B" },
  ], [legacy]);
  process.stdout.write(iso + "\n" + k + "\n" + vis.length + "\n");
  process.exit(0);
}

if (!process.argv.includes("--zone-child")) {
  let status = 0;
  for (const zone of ["UTC", "Europe/Madrid"]) {
    const r = spawnSync(process.execPath, [here, "--zone-child"], {
      env: { ...process.env, TZ: zone },
      stdio: "inherit",
    });
    if (r.status !== 0) status = r.status || 1;
  }
  process.exit(status);
}

const root = path.dirname(path.dirname(here));
const srvSrc = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const srvJs = transformSync(srvSrc, { loader: "ts", format: "esm" }).code;
const { claveComoLaApp, filasComoLaApp, mediodiaMadridIso } =
  await import("data:text/javascript;base64," + Buffer.from(srvJs).toString("base64"));

const ctx = loadPureLogicFromFile();
const zona = process.env.TZ || "UTC";
let fallos = 0;
const t = (nombre, fn) => {
  try { fn(); console.log("  ✓ " + nombre); }
  catch (e) { fallos++; console.error("  ✗ " + nombre + "\n      " + (e && e.message)); }
};

/* Mediodía civil de Madrid, calculado aquí. No usa el código de la app: si el
   bundle vuelve al mediodía local, el assert contra este instante falla. */
function mediodiaPropio(day) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const p = String(day).split("-");
  const y = +p[0], mo = +p[1], d = +p[2];
  const target = day + "T12:00:00";
  const local = (ms) => {
    const parts = fmt.formatToParts(new Date(ms));
    const g = (tipo) => {
      for (let i = 0; i < parts.length; i++) if (parts[i].type === tipo) return parts[i].value;
      return "";
    };
    return g("year") + "-" + g("month") + "-" + g("day") + "T" + g("hour") + ":" + g("minute") + ":" + g("second");
  };
  let lo = Date.UTC(y, mo - 1, d, 12) - 14 * 3600000;
  let hi = Date.UTC(y, mo - 1, d, 12) + 14 * 3600000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (local(mid) < target) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo).toISOString();
}

const ymd = new Date().toISOString().slice(0, 10);
const estado = (ent, expenses, deleted) => ({
  accounts: [{ id: "a", ent: ent || "caixabank", role: "diario", spendFrom: true, value: 100 }],
  expenses: expenses || [],
  deleted: deleted || [],
  fixed: [], debts: [], oneoffs: [],
  settings: { expenseBanks: [ent || "caixabank"] },
});
const cargo = (id, extra) => Object.assign({
  ent: "caixabank", id, date: ymd, amount: 12.5, merchant: "MERCADONA", status: "BOOK", acctUid: "cx",
}, extra || {});

console.log("inc-2709-06-correccion (" + zona + ")");

t("1. mediodía de Madrid: el cliente y el servidor en UTC tapan la misma lápida", () => {
  const verano = "2026-07-15";
  const invierno = "2026-01-15";
  assert.equal(mediodiaPropio(verano), "2026-07-15T10:00:00.000Z");
  assert.equal(mediodiaPropio(invierno), "2026-01-15T11:00:00.000Z");
  assert.equal(ctx.madridNoonIso(verano), mediodiaPropio(verano));
  assert.equal(ctx.madridNoonIso(invierno), mediodiaPropio(invierno));
  assert.equal(mediodiaMadridIso(verano), mediodiaPropio(verano));
  assert.equal(mediodiaMadridIso(invierno), mediodiaPropio(invierno));
  const noon = mediodiaPropio(verano);
  const legacy = verano + "|12.5|MERCADONA";
  const row = { source: "ob", ent: "caixabank", date: noon, amount: 12.5, merchant: "MERCADONA" };
  assert.equal(ctx.keyOfExpense(row), legacy);
  assert.equal(ctx.expenseIsTombstoned(row, { [legacy]: 1 }), true);
  const salt = ctx.histDate(verano, "ob-ext|caixabank|cargo-B");
  const hermana = Object.assign({}, row, { date: salt, extId: "cargo-B" });
  assert.notEqual(ctx.keyOfExpense(hermana), legacy, "la hermana volvió a la red de día");
  assert.notEqual(claveComoLaApp({ fecha: salt, importe: 12.5, comercio: "MERCADONA", source: "ob" }), legacy);
  assert.equal(ctx.expenseIsTombstoned(hermana, { [legacy]: 1 }), false);
  assert.equal(claveComoLaApp({ fecha: noon.replace(".000Z", "Z"), importe: 12.5, comercio: "MERCADONA", source: "ob" }), legacy);
  const vis = filasComoLaApp([
    { fecha: noon, importe: 12.5, comercio: "MERCADONA", source: "ob:caixabank" },
    { fecha: salt, importe: 12.5, comercio: "MERCADONA", source: "ob:caixabank#x.cargo-B" },
  ], [legacy]);
  assert.equal(vis.length, 1, "el widget dejó " + vis.length);
  assert.equal(vis[0].fecha, salt);
  const r = spawnSync(process.execPath, [here, "--server-utc", verano], {
    env: { ...process.env, TZ: "UTC" },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const lines = String(r.stdout || "").trim().split("\n");
  assert.equal(lines[0], mediodiaPropio(verano), "servidor UTC");
  assert.equal(lines[1], legacy, "la lápida casa en el servidor UTC");
  assert.equal(lines[2], "1", "el servidor UTC esconde el mediodía y deja la hermana");
});

t("2. pendiente con referencia X y luego contabilizado con Y: una fila", () => {
  const primero = ctx.importObExpenses(estado("caixabank"), [cargo("ref-X", { status: "PDNG" })]);
  assert.ok(primero && primero.length === 1);
  const segundo = ctx.importObExpenses(estado("caixabank", primero), [cargo("ref-Y", { status: "BOOK" })]);
  assert.equal(segundo, null, "el segundo sync creó otra fila");
  assert.equal(primero.length, 1);
  assert.equal(primero[0].extId, "ref-X");
});

t("3. filas de la nube sin referencia: el par da 2 y el cargo suelto da 1", () => {
  const noon = mediodiaPropio(ymd);
  const slot = ctx.histDate(ymd, "ob-slot|caixabank|1");
  const fila = (id, date) => ({
    id, date, amount: 12.5, merchant: "MERCADONA", obName: "MERCADONA", source: "ob", ent: "caixabank",
  });
  const dos = [fila("noon", noon), fila("slot", slot)];
  const par = ctx.importObExpenses(estado("caixabank", dos), [cargo("cargo-A"), cargo("cargo-B")]);
  assert.equal(par, null, "el par creó " + (par ? par.length : 0));
  assert.equal(dos.length, 2);
  const una = [fila("slot", slot)];
  const uno = ctx.importObExpenses(estado("caixabank", una), [cargo("cargo-A")]);
  assert.equal(uno, null, "el cargo suelto creó " + (uno ? uno.length : 0));
  assert.equal(una.length, 1);
});

t("4. borradas las dos hermanas, el sync no devuelve ninguna", () => {
  const legacy = ymd + "|12.5|MERCADONA";
  const deleted = [legacy, "obid|caixabank|cargo-B"];
  const add = ctx.importObExpenses(estado("caixabank", [], deleted), [cargo("cargo-A"), cargo("cargo-B")]);
  assert.equal(add, null, "volvieron " + (add ? add.map((e) => e.extId).join(",") : 0));
});

t("5. la clave del mediodía de Madrid no depende de la zona del dispositivo", () => {
  const noon = mediodiaPropio(ymd);
  const row = { source: "ob", ent: "caixabank", date: noon, amount: 12.5, merchant: "MERCADONA" };
  assert.equal(ctx.keyOfExpense(row), ymd + "|12.5|MERCADONA");
  /* Servidor: el cliente viejo sella el mediodía de SU zona. Península cae en
     Madrid; Canarias es T11Z en verano y T12Z en invierno; UTC es T12Z. Esas
     tres horas siguen siendo la lápida de día, o al desplegar reaparece el cargo. */
  ["10", "11", "12"].forEach((hh) => {
    assert.equal(
      claveComoLaApp({ fecha: ymd + "T" + hh + ":00:00.000Z", importe: 12.5, comercio: "MERCADONA", source: "ob" }),
      ymd + "|12.5|MERCADONA",
      "servidor T" + hh + "Z",
    );
  });
  const add = ctx.importObExpenses(estado("caixabank"), [cargo("solo")]);
  assert.ok(add && add.length === 1);
  assert.equal(add[0].date, noon, "el cargo suelto no se sala");
  assert.equal(ctx.keyOfExpense(add[0]), ymd + "|12.5|MERCADONA");
  const canarias = {
    id: "c1", source: "ob", ent: "caixabank", extId: "viejo",
    date: ymd + "T12:00:00.000Z", amount: 12.5, merchant: "MERCADONA",
  };
  const solas = ctx.expenseTombKeys(canarias, [canarias]);
  assert.ok(solas.indexOf(ymd + "|12.5|MERCADONA") >= 0, "el sello viejo de Canarias deja la lápida de día");
  assert.equal(ctx.importObExpenses(estado("caixabank", [], solas), [cargo("otra-ref")]), null);
  const hermana = {
    id: "h", source: "ob", ent: "caixabank", extId: "cargo-B",
    date: ctx.histDate(ymd, "ob-ext|caixabank|cargo-B"), amount: 12.5, merchant: "MERCADONA",
  };
  const duena = Object.assign({}, canarias, { id: "d", extId: "cargo-A", date: noon });
  const deHermana = ctx.expenseTombKeys(hermana, [duena, hermana]);
  assert.equal(deHermana.indexOf(ymd + "|12.5|MERCADONA"), -1, "borrar la hermana no deja la lápida de día");
});

t("6. apunte manual o noti del mismo banco, día, importe y nombre: una fila", () => {
  const manual = {
    id: "m1", date: mediodiaPropio(ymd), amount: 12.5, merchant: "MERCADONA",
    source: "manual", ent: "caixabank", category: "super",
  };
  const noti = {
    id: "n1", date: ymd + "T09:15:00.000Z", amount: 4, merchant: "FARMACIA",
    source: "macrodroid", ent: "caixabank", category: "salud",
  };
  const conManual = ctx.importObExpenses(estado("caixabank", [manual]), [cargo("cargo-A")]);
  assert.equal(conManual, null, "el cargo se sumó al manual");
  const far = cargo("far-1", { amount: 4, merchant: "FARMACIA" });
  const conNoti = ctx.importObExpenses(estado("caixabank", [noti]), [far]);
  assert.equal(conNoti, null, "el cargo se sumó a la noti");
});

t("otro banco sin hermanas sigue en la red de día", () => {
  const sb = (id) => ({ ent: "sabadell", id, date: ymd, amount: 8, merchant: "PAN", status: "BOOK", acctUid: "sb" });
  const base = {
    accounts: [
      { id: "cx", ent: "caixabank", role: "diario", spendFrom: true, value: 100 },
      { id: "sb", ent: "sabadell", role: "fijos", value: 50 },
    ],
    expenses: [],
    deleted: [], fixed: [], debts: [], oneoffs: [],
    settings: { expenseBanks: ["caixabank"] },
  };
  const uno = ctx.importObExpenses(base, [sb("sb-1")]);
  assert.ok(uno && uno.length === 1);
  assert.equal(uno[0].date, mediodiaPropio(ymd));
  assert.equal(ctx.keyOfExpense(uno[0]), ymd + "|8|PAN");
  const despues = Object.assign({}, base, { expenses: uno });
  const otro = ctx.importObExpenses(despues, [sb("sb-2")]);
  assert.equal(otro, null, "Sabadell partió un cargo que llegó en otro sync");
  const par = ctx.importObExpenses(despues, [cargo("cargo-A"), cargo("cargo-B")]);
  assert.ok(par && par.length === 2, "Caixa en la misma respuesta sigue siendo dos");
  assert.equal(uno.length, 1);
  assert.equal(uno[0].extId, "sb-1");
});

t("7. 20000 filas no construyen un Date en keyOfExpense", () => {
  const noon = mediodiaPropio("2026-10-10");
  ctx.keyOfExpense({ source: "ob", date: noon, amount: 1, merchant: "X" });
  const Native = ctx.Date;
  let n = 0;
  function ContarDate(...args) {
    n++;
    return new Native(...args);
  }
  ContarDate.now = Native.now.bind(Native);
  ContarDate.parse = Native.parse.bind(Native);
  ContarDate.UTC = Native.UTC.bind(Native);
  ContarDate.prototype = Native.prototype;
  ctx.Date = ContarDate;
  try {
    const t0 = Native.now();
    for (let i = 0; i < 20000; i++) {
      ctx.keyOfExpense({
        source: "ob",
        date: i % 2 ? noon : "2026-10-10T15:04:05.123Z",
        amount: 1,
        merchant: "X",
      });
    }
    console.log("      20k keyOfExpense " + (Native.now() - t0) + " ms, Date=" + n + " (" + zona + ")");
    assert.equal(n, 0, "keyOfExpense construyó " + n + " Date");
  } finally {
    ctx.Date = Native;
  }
});

t("8. el histórico con referencia no viaja como movimiento normal", () => {
  const e = { source: "ob-hist", ent: "caixabank", extId: "cargo-A", date: mediodiaPropio(ymd), amount: 12.5, merchant: "MERCADONA" };
  assert.equal(ctx.expenseSourceForCloud(e), "ob-hist:caixabank");
  const back = ctx.expenseFromRow({
    id: "h1", fecha: e.date, importe: 12.5, comercio: "MERCADONA", cat: "super", source: "ob-hist:caixabank",
  });
  assert.equal(back.source, "ob-hist");
  assert.equal(back.extId, undefined);
  const rec = ctx.reconcileObDupes({ expenses: [back], accounts: estado().accounts });
  assert.equal(rec.recat.length, 0);
});

t("9. obReassignSkipped y obExtIdFromCloudSource no están", () => {
  assert.equal(typeof ctx.obReassignSkipped, "undefined");
  assert.equal(typeof ctx.obExtIdFromCloudSource, "undefined");
});

t("10. el re-sello no muta el estado y la hermana se publica", () => {
  const src = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
  const core = fs.readFileSync(new URL("../src/modules/00-core.js", import.meta.url), "utf8");
  assert.ok(src.includes("publicarResello("));
  assert.ok(src.includes("obResealOldNoon(prev.expenses)"));
  assert.ok(core.includes("_moveFecha"), "la hermana re-sellada tiene que poder cambiar la fecha en la nube");
  const stamp = ctx.histDate(ymd);
  const a = { id: "a", date: stamp, amount: 12.5, merchant: "MERCADONA", obName: "MERCADONA", source: "ob", ent: "caixabank", extId: "cargo-A" };
  const b = { id: "b", date: stamp, amount: 12.5, merchant: "MERCADONA", obName: "MERCADONA", source: "ob", ent: "caixabank", extId: "cargo-B" };
  const reseal = ctx.obResealOldNoon([a, b]);
  assert.equal(a.date, stamp);
  assert.equal(b.date, stamp);
  assert.ok(reseal && reseal.moved && reseal.moved.length === 1);
  assert.notStrictEqual(reseal.moved[0].expense, b);
  assert.equal(reseal.moved[0].prevDate, stamp);
  assert.notEqual(reseal.moved[0].expense.date, stamp);
});

console.log(fallos ? "inc-2709-06-correccion: " + fallos + " fallo(s) (" + zona + ")" : "inc-2709-06-correccion: OK (" + zona + ")");
process.exit(fallos ? 1 : 0);
