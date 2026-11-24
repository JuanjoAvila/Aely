import assert from "node:assert/strict";
import fs from "node:fs";
import { requestBodyPrelude } from "./helpers/request-body.mjs";
import { transformSync } from "esbuild";

// DIN-08 (PR330 R1): el handler REAL de bank-sync con banco y BD simulados. El saldo se lee DESPUÉS del
// extracto en el cliente que entiende las fases, y la respuesta dice si el saldo es de «ahora» (ITAV/ITBD)
// o puede ser el cierre de ayer (CLBD, XPCD...), que el cliente no debe presentar como actual.
const root = new URL("../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const shared = transformSync(read("supabase/functions/_shared/enablebanking.ts"), {loader:"ts",format:"esm"}).code;
const E = await import("data:text/javascript;base64," + Buffer.from(shared).toString("base64"));
const demand = transformSync(read("supabase/functions/bank-sync/demand-window.ts"), {loader:"ts"}).code.replace(/^export /gm, "");
const rate = transformSync(read("supabase/functions/_shared/ratelimit.ts"), {loader:"ts"}).code.replace(/^export /gm, "");
const src = requestBodyPrelude + rate + "\n" + demand + "\n" + transformSync(read("supabase/functions/bank-sync/index.ts").replace(/^import .*?;\r?\n/gm,""), {loader:"ts"}).code;
const movement = (id="tx-1") => ({entry_reference:id, booking_date:"2026-09-15", transaction_amount:{amount:"12.50"},credit_debit_indicator:"DBIT",creditor:{name:"Comercio sintético"}});
const link = (name="CaixaBank") => ({id:name,aspsp_name:name,status:"active",accounts:[{uid:name+"-cuenta"}]});

// `balance(estado)` devuelve los saldos del banco; `estado.extractoServido` pasa a true cuando ya se ha
// servido el extracto: así se simula un cargo que se contabiliza ENTRE las dos llamadas.
async function sync(body, { balance, txFail } = {}) {
  const calls = [], st = { extractoServido: false };
  let handler;
  const api = async (jwt, p) => {
    calls.push(p.includes("/balances") ? "balances" : "transactions");
    if (p.includes("/balances")) return { balances: balance(st) };
    if (txFail) throw new Error(txFail);
    st.extractoServido = true;
    return { transactions: [movement()] };
  };
  const db = { auth:{getUser:async()=>({data:{user:{id:"synthetic"}}})}, rpc:async()=>({data:true,error:null}), from:()=>({
    select:()=>({eq:()=>({in:async()=>({data:[link()]})})}),
    update:()=>{ const q={eq:()=>q,is:()=>q,lt:()=>q,select:()=>q,then:(ok,ko)=>Promise.resolve({data:[{id:"x"}]}).then(ok,ko)}; return q; },
    insert:async()=>({})
  })};
  const names=["Deno","createClient","ebApi","ebConfig","jsonResp","makeJWT","mapTransaction","withCors","fetchBankTransactions","Date","ebFailure","ebSessionVerdict","decryptSessionId"];
  new Function(...names, src)(
    {serve:f=>{handler=f;},env:{get:()=>"synthetic"}},()=>db,api,()=>({}),
    (x,status=200)=>new Response(JSON.stringify(x),{status}),async()=>"jwt",E.mapTransaction,f=>f,
    E.fetchBankTransactions,Date,E.ebFailure,E.ebSessionVerdict,async x=>x
  );
  const res = await handler(new Request("https://app.invalid",{method:"POST",body:JSON.stringify(body)}));
  assert.equal(res.status,200);
  return { data: await res.json(), calls };
}
const saldo = (type, amount) => ({ balance_type: type, balance_amount: { amount, currency: "EUR" } });
let failures = 0;
async function t(name, fn){ try { await fn(); console.log("  ✓ " + name); } catch (e) { failures++; console.error("  ✗ " + name + ": " + e.message); } }

console.log("bank-sync-saldo-hora");

await t("cliente de fases: el saldo se lee DESPUÉS del extracto; el legado conserva el orden de siempre", async () => {
  const b = () => [saldo("ITAV", "500.00")];
  const nuevo = await sync({ accountPhases: 1, recoverGaps: true, acks: {} }, { balance: b });
  assert.deepEqual(nuevo.calls, ["transactions", "balances"]);
  const viejo = await sync({}, { balance: b });
  assert.deepEqual(viejo.calls, ["balances", "transactions"]);
});

await t("un cargo contabilizado entre las dos llamadas queda en el saldo que se entrega (no +42,37 optimista)", async () => {
  // Antes del extracto el banco decía 500,00; cuando el extracto ya salió (con el cargo de 42,37), 457,63.
  const b = (st) => [saldo("ITAV", st.extractoServido ? "457.63" : "500.00")];
  const a = (await sync({ accountPhases: 1, recoverGaps: true, acks: {} }, { balance: b })).data.links[0].accounts[0];
  assert.equal(a.transactions.length, 1);
  assert.equal(a.balances[0].amount, 457.63, "saldo posterior al extracto");
});

await t("la hora del extracto no es posterior a la del saldo, y ambas viajan", async () => {
  const a = (await sync({ accountPhases: 1, recoverGaps: true, acks: {} }, { balance: () => [saldo("ITAV", "1.00")] })).data.links[0].accounts[0];
  assert.ok(Date.parse(a.txReadAt) <= Date.parse(a.balanceAt), "extracto antes que saldo");
});

await t("solo ITAV/ITBD marcan saldo de ahora: CLBD, XPCD, PRCD y OTHR no", async () => {
  const caso = async (tipos) => (await sync({ accountPhases: 1, recoverGaps: true, acks: {} }, { balance: () => tipos.map(x => saldo(x, "10.00")) })).data.links[0].accounts[0].balanceIntraday;
  assert.equal(await caso(["ITAV"]), "ITAV");
  assert.equal(await caso(["CLBD", "ITBD"]), "ITBD");
  assert.equal(await caso(["ITBD", "ITAV"]), "ITAV");
  for (const x of ["CLBD", "XPCD", "PRCD", "OTHR"]) assert.equal(await caso([x]), null, x);
  assert.equal(await caso(["CLBD", "XPCD"]), null);
});

await t("un extracto que falla por red no deja sin saldo al cliente de fases; con sesión cerrada no se pide otro saldo", async () => {
  const transitorio = await sync({ accountPhases: 1, recoverGaps: true, acks: {} }, { balance: () => [saldo("ITAV", "5.00")], txFail: "EB 503: privado" });
  assert.deepEqual(transitorio.calls.slice(-1), ["balances"]);
  assert.equal(transitorio.data.links[0].accounts[0].balanceOk, true);
  const caducada = await sync({ accountPhases: 1, recoverGaps: true, acks: {} }, { balance: () => [saldo("ITAV", "5.00")], txFail: "EB 401 CLOSED_SESSION" });
  assert.equal(caducada.calls.includes("balances"), false, "tras una autorización cerrada no hay otra llamada");
});

if (failures) { console.error(failures + " fallo(s)"); process.exit(1); }
