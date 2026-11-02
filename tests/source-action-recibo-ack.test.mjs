import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

/** Oráculo M4: `setExpenseRecibo` no puede devolver ACK acreditado sin UPDATE real (salvo
 *  alreadyApplied). `runSourceAction` confía en ese contrato — un ACK inventado aplicaría la
 *  marca local sin nube (cuarta revisión recibos). */
const ctx = loadPureLogicFromFile();
const core = fs.readFileSync("src/modules/00-core.js", "utf8");
const owner = "fixture-owner";
const uuid = (n) => "550e8400-e29b-41d4-a716-" + String(n).padStart(12, "0");
const plain = (x) => JSON.parse(JSON.stringify(x));
const row = (e) => ({
  user_id: owner, id: e.id, fecha: e.date, comercio: e.merchant, importe: e.amount,
  cat: e.category, source: ctx.expenseSourceForCloud(e),
});

function fixture() {
  const e = {
    id: uuid(1), date: "2026-10-12T12:00:00.000Z", merchant: "COMUNIDAD SINTETICA", amount: 50,
    category: "recibos", source: "ob", ent: "sabadell", reciboId: "rec-fixture",
  };
  return { _historyOwner: owner, expenses: [e], accounts: [{ ent: "sabadell", value: 1000 }], fixed: [], deleted: [] };
}

function client(s, opts = {}) {
  const rows = s.expenses.map(row), ops = [];
  const sb = {
    auth: {
      getSession: async () => {
        const uid = opts.ownerAt ? opts.ownerAt() : owner;
        return { data: { session: uid ? { user: { id: uid } } : null }, error: null };
      },
    },
    from(table) {
      const filters = [];
      let patch = null, columns = "*";
      const project = (list) => plain(list.map((r) => (columns === "*"
        ? r
        : Object.fromEntries(columns.split(",").filter((k) => Object.hasOwn(r, k)).map((k) => [k, r[k]])))));
      const execute = async () => {
        if (patch) {
          ops.push({ table, patch: plain(patch), filters: plain(filters) });
          if (opts.beforeUpdate) opts.beforeUpdate(rows);
          const selected = opts.zero ? [] : rows.filter((r) => filters.every(([k, v]) => r[k] === v));
          selected.forEach((r) => Object.assign(r, patch));
          return { data: project(selected), error: null };
        }
        const selected = rows.filter((r) => filters.every(([k, v]) => r[k] === v));
        return { data: project(selected), error: null };
      };
      const q = {
        select(cols = "*") { columns = cols; return q; },
        eq(k, v) { filters.push([k, v]); return q; },
        update(p) { patch = p; return q; },
        then(ok, bad) { return execute().then(ok, bad); },
      };
      return q;
    },
  };
  return { sb, rows, ops };
}

const sourcePatchMatch = core.match(/async function expenseSourcePatch\(sdk,owner,e,patch,snapshot\)\{([\s\S]*?)\n\}/);
assert.ok(sourcePatchMatch, "expenseSourcePatch presente");
const uploadGuard = core.match(/async function obConfirmedCanUpload\(e,owner,sdk\)\{[\s\S]*?\n\}/)[0];
ctx.__sourceUploadGuard = vm.runInContext(
  "(function(){const obConfirmedRead=()=>[],obConfirmedBlocked=new Set(),obAbsorbedWarn=()=>{},obConfirmedMatches=()=>false;return "
  + uploadGuard + ";})()",
  ctx,
);
const sourcePatch = vm.runInContext(
  "(function(){const obConfirmedCanUpload=globalThis.__sourceUploadGuard;return " + sourcePatchMatch[0] + ";})()",
  ctx,
);
ctx.__ownTransferSourcePatch = sourcePatch;

function sourceWriter(sourceText) {
  const found = sourceText.match(/async setExpenseRecibo\(([^)]*)\)\s*\{([\s\S]*?)\n    \},/);
  assert.ok(found, "setExpenseRecibo presente");
  return vm.runInContext(
    "(async function(" + found[1] + ") {const sb=globalThis.__ownTransferSb;const obConfirmedCanUpload=globalThis.__sourceUploadGuard;"
    + "const expenseSourcePatch=globalThis.__ownTransferSourcePatch;" + found[2] + "\n})",
    ctx,
  );
}

const setExpenseRecibo = sourceWriter(core);

async function oracleReciboAck(name, writer) {
  const s = fixture(), e = s.expenses[0], c = client(s);
  c.rows[0].source = ctx.expenseSourceForCloud({ ...e, reciboId: undefined });
  ctx.__ownTransferSb = c.sb;
  const before = plain(c.rows[0].source);
  const ack = await writer(e);
  assert.equal(ack.acknowledged, true, name + ": debe acreditar");
  if (!ack.alreadyApplied) {
    assert.ok(c.ops.length >= 1, name + ": M4 — ACK sin UPDATE en la tabla");
    assert.notEqual(c.rows[0].source, before, name + ": la nube debe reflejar la marca");
  } else {
    assert.equal(c.ops.length, 0, name + ": alreadyApplied no reescribe");
  }
}

await oracleReciboAck("writer real", setExpenseRecibo);

const m4Needle = "const w=await expenseSourcePatch(sb,session.user.id,e,{source:src},r);";
assert.equal(core.split(m4Needle).length, 2, "ancla M4 única");
const mutantCore = core.replace(
  m4Needle,
  "return {acknowledged:true,rows:[{id:e.id}],alreadyApplied:false}; " + m4Needle,
);
const setExpenseReciboMutant = sourceWriter(mutantCore);
await assert.rejects(
  () => oracleReciboAck("mutante M4", setExpenseReciboMutant),
  (err) => err?.code === "ERR_ASSERTION",
  "mutante M4 debe morir por el oráculo",
);

const ui = fs.readFileSync("src/modules/04-tab-gastos.js", "utf8");
const bankSource = fs.readFileSync("src/modules/08-motor-bank.js", "utf8");
const action = ui.match(/const runSourceAction=async function\(ex,write,apply,success\)\{[\s\S]*?\n  \};/)[0];
const snap = bankSource.match(/function expenseSourceActionSnapshot\(s,id\)\{[\s\S]*?\n\}/)[0];
vm.runInContext(snap, ctx);
const runEmptyAck = vm.runInContext(
  "(async function(){let state=globalThis.__ackState,withdrawalState={current:state},sourceActionPending={current:{}},"
  + "sourceActionMounted={current:true},withdrawalPending={current:{}};const sourceActionBusy=()=>false;"
  + "const mcSandbox=()=>false;const ReactDOM={flushSync:f=>f()};const setSourceActionStatus=()=>{};"
  + "const showToast=()=>{};const t=k=>k;"
  + "const set=f=>{state=globalThis.__ackState=f(state);withdrawalState.current=state;};"
  + "const cloud={enabled:()=>true,session:async()=>({user:{id:state._historyOwner}})};" + action
  + "const ex=state.expenses[0];return runSourceAction(ex,async()=>({acknowledged:true,rows:[]}),s=>s);})",
  ctx,
);
ctx.__ackState = fixture();
assert.equal(await runEmptyAck(), false, "runSourceAction rechaza ACK sin filas");

console.log("source-action-recibo-ack: M4 oráculo OK");
