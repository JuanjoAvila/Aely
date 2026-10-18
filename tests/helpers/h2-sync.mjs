import assert from "node:assert/strict";
import fs from "node:fs";
import { requestBodyPrelude } from "./request-body.mjs";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../../scripts/load-pure-logic.mjs";

// Se ejecuta el handler real con banco y BD simulados: un saldo correcto no demuestra
// que la primera página de movimientos esté lista (contrato Enable Banking, 15/9/2026).
const root = new URL("../../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const shared = transformSync(read("supabase/functions/_shared/enablebanking.ts"), {loader:"ts",format:"esm"}).code;
const E = await import("data:text/javascript;base64," + Buffer.from(shared).toString("base64"));
const demand = transformSync(read("supabase/functions/bank-sync/demand-window.ts"), {loader:"ts"}).code.replace(/^export /gm, "");
const rate = transformSync(read("supabase/functions/_shared/ratelimit.ts"), {loader:"ts"}).code.replace(/^export /gm, "");
export const handlerSource = index => '"use strict";\n' + requestBodyPrelude + rate + "\n" + demand + "\n" + transformSync(index.replace(/^import .*?;\r?\n/gm,""), {loader:"ts"}).code;
const src = handlerSource(process.env.H2_SERVER_FILE ? fs.readFileSync(process.env.H2_SERVER_FILE,'utf8') : read("supabase/functions/bank-sync/index.ts"));
export const movement = (id="tx-1") => ({entry_reference:id, booking_date:"2026-09-15", transaction_amount:{amount:"12.50"},credit_debit_indicator:"DBIT",creditor:{name:"Comercio sintético"}});
export const link = (name="CaixaBank", status="active") => ({id:name,aspsp_name:name,status,accounts:[{uid:name+"-cuenta"}]});

export async function sync(links, reply, body={}, clock=null, timers=null, source=src) {
  const calls=[], writes=[], events=[], budgets=[];
  let handler;
  const api=async (jwt,p,init) => {
    calls.push(p);
    // GET /sessions/{id}: lo que `reply.session` diga del estado de la sesión (o su fallo).
    if(p.startsWith("/sessions/")) return reply.session(p);
    if(p.endsWith("/balances")){
      if(reply.balance) return reply.balance(p,init);
      const balanceError=typeof reply.balanceError==="function"?reply.balanceError(p):reply.balanceError;
      if(balanceError) throw new Error(balanceError);
      return {balances:[{balance_type:"ITAV",balance_amount:{amount:"100",currency:"EUR"}}]};
    }
    return reply(new URL(p,"https://bank.invalid"));
  };
  const db={auth:{getUser:async()=>({data:{user:{id:"synthetic"}}})},rpc:async()=>({data:true,error:null}),from:()=>({
    select:()=>({eq:()=>({in:async()=>({data:links.map(l=>Object.assign({},l))})})}),
    update:x=>{
      const filters=[];
      const q={eq:(col,v)=>{filters.push(l=>l[col]===v);return q;},
        is:(col,v)=>{filters.push(l=>(l[col]==null?null:l[col])===v);return q;},
        select:()=>q,
        lt:(col,v)=>{filters.push(l=>l[col]!=null&&Date.parse(l[col])<Date.parse(v));return q;},
        then:(ok,ko)=>{const matches=reply.rejectWrites?[]:links.filter(l=>filters.every(f=>f(l)));if(matches.length){writes.push(x);matches.forEach(l=>Object.assign(l,x));}return Promise.resolve({data:matches.map(l=>({id:l.id}))}).then(ok,ko);}};
      return q;
    },insert:async x=>{events.push(x);return {};}
  })};
  const names=["Deno","createClient","ebApi","ebConfig","jsonResp","makeJWT","mapTransaction","withCors","fetchBankTransactions","Date","ebFailure","ebSessionVerdict","decryptSessionId","setTimeout","clearTimeout"];
  new Function(...names,source)(
    {serve:f=>{handler=f;},env:{get:()=>"synthetic"}},()=>db,api,()=>({}),
    (x,status=200)=>new Response(JSON.stringify(x),{status}),async()=>"jwt",E.mapTransaction,f=>f,
    (jwt,uid,from,apiFn,timeout,preferLongest,maxPages,dateTo)=>{
      budgets.push({uid,timeout});
      return E.fetchBankTransactions(jwt,uid,from,apiFn,timeout,preferLongest,maxPages,dateTo);
    },clock||Date,E.ebFailure,E.ebSessionVerdict,async x=>x?String(x).replace(/^enc:/,""):x, timers?.setTimeout||setTimeout,timers?.clearTimeout||clearTimeout
  );
  const res=await handler(new Request("https://app.invalid",{method:"POST",body:JSON.stringify(body)}));
  assert.equal(res.status,200);
  return {data:await res.json(),calls,writes,events,budgets};
}
