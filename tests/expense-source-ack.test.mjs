// ACK de source por UUID (FIN-04). Una promesa resuelta sin la fila no es un ACK, y un
// gemelo con el mismo importe no sustituye al id. El viaje A→B→A no se afirma aquí: sin
// revisión de servidor el source no lo distingue.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = fs.readFileSync(join(root, "src/modules/00-core.js"), "utf8");
const ID = "550e8400-e29b-41d4-a716-446655440001";
const TWIN = "550e8400-e29b-41d4-a716-446655440002";
const OWNER = "owner-sintetico";

function sliceFn(src, name) {
  const at = src.indexOf("function " + name + "(");
  assert.ok(at >= 0, name);
  const start = src.slice(0, at).endsWith("async ") ? at - 6 : at;
  let depth = 0;
  for (let p = src.indexOf("{", start); p < src.length; p++) {
    if (src[p] === "{") depth++;
    else if (src[p] === "}") { depth--; if (depth === 0) return src.slice(start, p + 1); }
  }
  throw new Error("fin " + name);
}
function sliceMethod(src, name) {
  const marker = "async " + name + "(";
  const start = src.indexOf(marker);
  assert.ok(start >= 0, name);
  let depth = 0;
  for (let p = src.indexOf("{", start); p < src.length; p++) {
    if (src[p] === "{") depth++;
    else if (src[p] === "}") { depth--; if (depth === 0) return src.slice(start, p + 1); }
  }
  throw new Error("fin " + name);
}

const ctx = { console, Object, String, Error, RegExp, Promise };
vm.createContext(ctx);
vm.runInContext([
  "isExpenseUuid", "deudaSufijo", "partirEntDeuda", "expenseSourceForCloud",
  "expenseCloudKeys", "expenseCloudEq", "cloudSourceParts", "expenseSourceField",
  "expenseSourceToken", "writeExpenseSourceField",
].map((n) => sliceFn(core, n)).join("\n"), ctx);

function bind(name, param) {
  const text = sliceMethod(core, name);
  const body = text.slice(text.indexOf("{") + 1, text.lastIndexOf("}"));
  return new vm.Script(`(async function(sb, e, ${param}){ ${body} })`).runInContext(ctx);
}
const bank = bind("setExpenseBank", "ent");
const dup = bind("setExpenseDup", "isDup");

function store(source, options = {}) {
  const rows = [{ id: ID, user_id: OWNER, source, fecha: "2026-10-01", importe: 12.5, comercio: "Cafe", cat: "bares" }];
  if (options.twin) rows.push({ id: TWIN, user_id: OWNER, source, fecha: "2026-10-01", importe: 12.5, comercio: "Cafe", cat: "bares" });
  const calls = [];
  let sessions = 0;
  const sb = {
    auth: { async getSession() {
      sessions++;
      if (options.noSession) return { data: { session: null } };
      if (options.switchUser && sessions > 1) return { data: { session: { user: { id: "otro" } } } };
      return { data: { session: { user: { id: OWNER } } } };
    } },
    from(table) {
      assert.equal(table, "expenses");
      const filters = [];
      let patch = null;
      const q = {
        select() { return this; }, update(p) { patch = p; return this; },
        eq(k, v) { filters.push(["eq", k, v]); return this; },
        is(k, v) { filters.push(["is", k, v]); return this; },
        maybeSingle() { return this; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            calls.push({ patch: patch && Object.assign({}, patch), filters: filters.slice() });
            const match = (row) => filters.every(([kind, k, v]) => kind === "is" ? row[k] == null : row[k] === v);
            const hit = rows.filter(match);
            if (!patch) {
              if (hit.length !== 1) return { data: null, error: null };
              return { data: { id: hit[0].id, source: hit[0].source }, error: null };
            }
            if (options.beforeUpdate) options.beforeUpdate(rows, calls.filter((c) => c.patch).length);
            const still = rows.filter(match);
            if (options.rejectAfter && still.length) {
              still.forEach((row) => Object.assign(row, patch));
              throw new Error("timeout after commit");
            }
            if (options.error) return { data: null, error: new Error("transport failed") };
            if (!still.length || options.zeroAck) return { data: null, error: null };
            still.forEach((row) => Object.assign(row, patch));
            if (options.emptyAfter) {
              if (options.afterEmpty) options.afterEmpty(rows[0]);
              return { data: null, error: null };
            }
            const row = still[0];
            if (options.partial) return { data: { id: row.id, source: String(row.source).replace(/#dup$/, "") }, error: null };
            if (options.badId) return { data: { id: TWIN, source: row.source }, error: null };
            return { data: { id: row.id, source: row.source }, error: null };
          }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  return { sb, rows, calls };
}

let failed = 0;
async function t(name, fn) {
  try { await fn(); console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name); console.error("    " + e.stack); }
}

const ob = { id: ID, source: "ob", ent: "trade_republic", possibleDup: true };

await t("el guardián está en run-tests y en relevant-tests", () => {
  const steps = fs.readFileSync(join(root, "scripts/run-tests.mjs"), "utf8");
  const rel = fs.readFileSync(join(root, "scripts/relevant-tests.mjs"), "utf8");
  assert.match(steps, /tests\/expense-source-ack\.test\.mjs/);
  assert.match(rel, /expense-source-ack/);
});

await t("decisión UUID conserva el banco remoto, no el de la copia local", async () => {
  const d = store("ob:revolut#dup");
  const ack = await dup(d.sb, ob, false);
  assert.equal(d.rows[0].source, "ob:revolut");
  assert.equal(ack.id, ID);
  assert.equal(ack.source, "ob:revolut");
  assert.equal(d.rows[0].cat, "bares");
  assert.equal(d.calls.some((c) => c.filters.some((f) => f[1] === "fecha")), false);
});

await t("UPDATE de cero filas no es ACK", async () => {
  const d = store("ob:revolut#dup", { zeroAck: true });
  await assert.rejects(() => dup(d.sb, ob, false), /conflict/);
  assert.equal(d.rows[0].source, "ob:revolut#dup");
  assert.equal(d.calls.filter((c) => c.patch).length, 3);
});

await t("sesión ausente no es ACK y no consulta", async () => {
  const d = store("ob:revolut#dup", { noSession: true });
  await assert.rejects(() => dup(d.sb, ob, false), /session unavailable/);
  assert.equal(d.calls.length, 0);
});

await t("timeout después del commit no devuelve ACK ni reescribe", async () => {
  const d = store("ob:revolut#dup", { rejectAfter: true });
  await assert.rejects(() => dup(d.sb, ob, false), /timeout after commit/);
  assert.equal(d.rows[0].source, "ob:revolut");
  assert.equal(d.calls.filter((c) => c.patch).length, 1);
});

await t("cuerpo vacío tras commit no pisa el banco que escribió el otro", async () => {
  const d = store("manual:alpha", { emptyAfter: true, afterEmpty(row) { row.source = "manual:beta"; } });
  await assert.rejects(() => bank(d.sb, { id: ID, source: "manual" }, "zeta"), /conflict/);
  assert.equal(d.rows[0].source, "manual:beta");
});

await t("RETURNING con source a medias o con otro id no es ACK", async () => {
  const partial = store("ob:trade_republic#dup", { partial: true });
  await assert.rejects(() => bank(partial.sb, ob, "revolut"), /unconfirmed/);
  assert.equal(partial.rows[0].source, "ob:revolut#dup");
  const wrong = store("ob:trade_republic#dup", { badId: true });
  await assert.rejects(() => dup(wrong.sb, ob, false), /unconfirmed/);
});

await t("no busca un gemelo por importe y comercio", async () => {
  const d = store("ob:trade_republic#dup", { twin: true });
  const ack = await dup(d.sb, ob, false);
  assert.equal(ack.id, ID);
  assert.equal(d.rows[0].source, "ob:trade_republic");
  assert.equal(d.rows[1].source, "ob:trade_republic#dup");
  assert.equal(d.calls.some((c) => c.filters.some((f) => f[2] === TWIN)), false);
});

await t("UUID que no está en la nube no se sustituye", async () => {
  const d = store("ob:trade_republic#dup");
  d.rows[0].id = TWIN;
  await assert.rejects(() => dup(d.sb, ob, false), /unconfirmed/);
  assert.equal(d.calls.filter((c) => c.patch).length, 0);
  assert.equal(d.rows[0].source, "ob:trade_republic#dup");
});

await t("cambiar el banco conserva ~deuda y #dup", async () => {
  const d = store("ob:sabadell~deuda.cuota1#dup");
  const ack = await bank(d.sb, { id: ID, source: "ob", ent: "sabadell" }, "revolut");
  assert.equal(ack.source, "ob:revolut~deuda.cuota1#dup");
  assert.equal(d.rows[0].source, ack.source);
});

await t("quitar #dup conserva ~deuda", async () => {
  const d = store("ob:sabadell~deuda.cuota1#dup");
  const ack = await dup(d.sb, { id: ID, source: "ob" }, false);
  assert.equal(ack.source, "ob:sabadell~deuda.cuota1");
});

await t("ob-hist puede quitar #dup", async () => {
  const d = store("ob-hist:caixa#dup");
  const ack = await dup(d.sb, { id: ID, source: "ob-hist", ent: "caixa" }, false);
  assert.equal(ack.source, "ob-hist:caixa");
});

await t("la noti TR vuelve a macrodroid al decidir, no se queda en ob:", async () => {
  const d = store("ob:trade_republic#dup");
  const ack = await dup(d.sb, { id: ID, source: "macrodroid", ent: "trade_republic" }, false);
  assert.equal(ack.source, "macrodroid");
  assert.equal(d.rows[0].source, "macrodroid");
});

await t("si el otro móvil cambió el banco, la noti no fuerza trade_republic", async () => {
  const d = store("ob:revolut#dup");
  const ack = await dup(d.sb, { id: ID, source: "macrodroid", ent: "trade_republic" }, false);
  assert.equal(ack.source, "ob:revolut");
});

await t("banco inválido no escribe", async () => {
  const d = store("manual");
  await assert.rejects(() => bank(d.sb, { id: ID, source: "manual" }, "revolut#dup"), /invalid/);
  assert.equal(d.rows[0].source, "manual");
  assert.equal(d.calls.filter((c) => c.patch).length, 0);
});

await t("source desconocido no se reconstruye", async () => {
  const d = store("provider-future:opaque");
  await assert.rejects(() => bank(d.sb, { id: ID, source: "manual" }, "revolut"), /unsupported/);
  assert.equal(d.rows[0].source, "provider-future:opaque");
});

await t("cambio de sesión antes de escribir cancela", async () => {
  const d = store("manual:trade_republic", { switchUser: true });
  await assert.rejects(() => bank(d.sb, { id: ID, source: "manual" }, "revolut"), /session changed/);
  assert.equal(d.calls.filter((c) => c.patch).length, 0);
});

await t("error de transporte antes del commit no es éxito", async () => {
  const d = store("manual:trade_republic", { error: true });
  await assert.rejects(() => bank(d.sb, { id: ID, source: "manual" }, "revolut"), /transport failed/);
  assert.equal(d.rows[0].source, "manual:trade_republic");
});

await t("el mismo banco ya guardado no hace UPDATE", async () => {
  const d = store("manual:revolut");
  const ack = await bank(d.sb, { id: ID, source: "manual" }, "revolut");
  assert.equal(ack.source, "manual:revolut");
  assert.equal(d.calls.filter((c) => c.patch).length, 0);
});

await t("id corto sigue el camino legado y no exige UUID", async () => {
  const d = store("manual:trade_republic");
  const ack = await bank(d.sb, { id: "k7x9m2ab", source: "manual", date: "2026-10-01", amount: 12.5, merchant: "Cafe" }, "revolut");
  assert.equal(ack, undefined);
  assert.equal(d.rows[0].source, "manual:revolut");
  assert.equal(d.calls.some((c) => c.filters.some((f) => f[1] === "fecha")), true);
});

console.log("expense-source-ack: " + (failed ? failed + " FAIL" : "OK"));
process.exitCode = failed ? 1 : 0;
