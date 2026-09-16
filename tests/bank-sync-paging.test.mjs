import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

// Se ejecuta el handler real con banco y BD simulados: un saldo correcto no demuestra
// que la primera página de movimientos esté lista (contrato Enable Banking, 15/9/2026).
const root = new URL("../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const shared = transformSync(read("supabase/functions/_shared/enablebanking.ts"), {loader:"ts",format:"esm"}).code;
const E = await import("data:text/javascript;base64," + Buffer.from(shared).toString("base64"));
const src = transformSync(read("supabase/functions/bank-sync/index.ts").replace(/^import .*?;\r?\n/gm,""), {loader:"ts"}).code;
const movement = (id="tx-1") => ({entry_reference:id, booking_date:"2026-09-15", transaction_amount:{amount:"12.50"},credit_debit_indicator:"DBIT",creditor:{name:"Comercio sintético"}});
const link = (name="CaixaBank", status="active") => ({id:name,aspsp_name:name,status,accounts:[{uid:name+"-cuenta"}]});

async function sync(links, reply, body={}, clock=null) {
  const calls=[], writes=[], events=[];
  let handler;
  const api=async (jwt,p) => { calls.push(p); return p.endsWith("/balances")?{balances:[{balance_type:"ITAV",balance_amount:{amount:"100",currency:"EUR"}}]}:reply(new URL(p,"https://bank.invalid")); };
  const db={auth:{getUser:async()=>({data:{user:{id:"synthetic"}}})},from:()=>({
    select:()=>({eq:()=>({in:async()=>({data:links})})}),
    update:x=>({eq:async()=>{writes.push(x);return {};}}),insert:async x=>{events.push(x);return {};}
  })};
  const names=["Deno","createClient","ebApi","ebConfig","jsonResp","makeJWT","mapTransaction","withCors","fetchBankTransactions","Date"];
  new Function(...names,src)(
    {serve:f=>{handler=f;},env:{get:()=>"synthetic"}},()=>db,api,()=>({}),
    (x,status=200)=>new Response(JSON.stringify(x),{status}),async()=>"jwt",E.mapTransaction,f=>f,
    (jwt,uid,from,ignored,timeout,preferLongest)=>E.fetchBankTransactions(jwt,uid,from,api,timeout,preferLongest),clock||Date
  );
  const res=await handler(new Request("https://app.invalid",{method:"POST",body:JSON.stringify(body)}));
  assert.equal(res.status,200);
  return {data:await res.json(),calls,writes,events};
}
let failures=0;
async function t(name,fn){try{await fn();console.log("  ✓ "+name);}catch(e){failures++;console.error("  ✗ "+name+": "+e.message);}}

await t("sync diario continúa tras primera página vacía y entrega el gasto",async()=>{
  const r=await sync([link()],u=>u.searchParams.has("continuation_key")?{transactions:[movement()]}:{transactions:[],continuation_key:"next +/="});
  assert.equal(r.data.links[0].accounts[0].transactions.length,1);
  assert.equal(new URL(r.calls.find(p=>p.includes("/transactions?")),"https://bank.invalid").searchParams.has("strategy"),false,"el sync reciente no pide el tramo histórico más largo");
  assert.equal(new URL(r.calls.at(-1),"https://bank.invalid").searchParams.get("continuation_key"),"next +/=");
});
await t("histórico recupera un periodo no disponible con strategy longest",async()=>{
  const r=await sync([link("Banco de Sabadell")],u=>{
    if(u.searchParams.get("strategy")!=="longest") throw new Error('EB 400: {"error":"WRONG_TRANSACTIONS_PERIOD"}');
    return {transactions:[movement()]};
  },{dateFrom:"2026-06-15"});
  assert.equal(r.data.links[0].accounts[0].transactions.length,1);
  assert.equal(new URL(r.calls[0],"https://bank.invalid").searchParams.get("strategy"),"longest","Caixa no siempre devuelve WRONG_PERIOD: la primera llamada ya debe pedir el tramo largo");
  assert.equal(r.writes.length,0,"el histórico es solo lectura");
});
await t("un fallo posterior conserva las páginas ya leídas y avisa de parcial",async()=>{
  const r=await sync([link()],u=>{
    if(u.searchParams.has("continuation_key")) throw new Error("EB 503: privado");
    return {transactions:[movement()],continuation_key:"next"};
  },{dateFrom:"2026-06-15"});
  const a=r.data.links[0].accounts[0];
  assert.equal(a.transactions.length,1);assert.equal(a.truncated,true);
  assert.equal(JSON.stringify(r.data).includes("privado"),false);
});
await t("un cursor que se repite se corta y se declara incompleto",async()=>{
  const r=await sync([link()],()=>({transactions:[movement()],continuation_key:"loop"}),{dateFrom:"2026-06-15"});
  assert.ok(r.calls.length<=2);assert.equal(r.data.links[0].accounts[0].truncated,true);
});
await t("el histórico incluye bancos pendientes y caducados sin consultar al banco",async()=>{
  const r=await sync([link("CaixaBank","pending"),link("Sabadell","expired")],()=>{throw Error("no debe llamar");},{dateFrom:"2026-06-15"});
  assert.equal(r.data.links.length,2);assert.equal(r.data.links[0].pending,true);assert.equal(r.calls.length,0);assert.equal(r.writes.length,0);
});
await t("el fallo de CaixaBank no oculta los movimientos de Sabadell",async()=>{
  const r=await sync([link(),link("Sabadell")],u=>{
    if(u.pathname.includes("CaixaBank")) throw new Error("EB 503: privado");
    return {transactions:[movement()]};
  },{dateFrom:"2026-06-15"});
  assert.equal(r.data.links[0].accounts[0].ok,false);
  assert.equal(r.data.links[1].accounts[0].transactions.length,1);
  assert.equal(r.events.length,1,"el fallo queda diagnosticado sin cambiar datos bancarios");
  assert.equal(JSON.parse(r.events[0].detail).code,"eb_503");
  assert.equal(JSON.stringify(r.events).includes("privado"),false,"el mensaje crudo del proveedor no sale a app_events");
});
await t("límite de tiempo cancela la petición y conserva la primera página",async()=>{
  let calls=0;
  const r=await E.fetchBankTransactions("jwt","test","2026-06-15",async(jwt,p,init)=>{
    if(!calls++) return {transactions:[movement()],continuation_key:"slow"};
    return new Promise((resolve,reject)=>init.signal.addEventListener("abort",()=>reject(new Error("abort")),{once:true}));
  },10);
  assert.equal(r.transactions.length,1);assert.equal(r.truncated,true);assert.equal(r.transactionError,"timeout");
});
await t("paginación mantiene parámetros y se detiene sin cursor",async()=>{
  const urls=[];
  const r=await E.fetchBankTransactions("jwt","test","2026-06-15",async(jwt,p)=>{
    urls.push(new URL(p,"https://bank.invalid"));
    return urls.length===1?{transactions:[movement("one")],continuation_key:"two"}:{transactions:[movement("two")]};
  },15000,true);
  assert.equal(r.transactions.length,2);assert.equal(r.truncated,false);
  assert.ok(urls.every(u=>u.searchParams.get("date_from")==="2026-06-15"));
  assert.ok(urls.every(u=>u.searchParams.get("strategy")==="longest"));
});
await t("una respuesta inválida nunca se acepta como extracto vacío",async()=>{
  await assert.rejects(()=>E.fetchBankTransactions("jwt","test",null,async()=>({})),/transactions_invalid/);
});
await t("el sync diario conserva el deadline global",async()=>{
  let now=Date.now();
  class FakeDate extends Date { static now(){return now;} }
  const r=await sync(Array.from({length:6},(_,i)=>link("Banco "+i)),()=>{
    now+=15000;
    return {transactions:[movement()]};
  },{},FakeDate);
  assert.equal(r.calls.filter(p=>p.includes("/transactions?")).length,4);
  assert.equal(r.data.links[5].accounts[0].transactionError,"timeout");
});
await t("un banco lento no consume el turno de Caixa en el histórico",async()=>{
  let soltarLento;
  const lento=new Promise((resolve,reject)=>{ soltarLento=()=>reject(new Error("EB 429: rate limit")); });
  const r=await sync([link("Banco de Sabadell"),link("CaixaBank")],u=>{
    if(u.pathname.includes("Banco%20de%20Sabadell")) return lento;
    soltarLento();
    return {transactions:[movement("caixa-ok")]};
  },{dateFrom:"2026-06-15"});
  assert.equal(r.data.links[0].accounts[0].ok,false);
  assert.equal(r.data.links[1].accounts[0].transactions.length,1,"Caixa recibe su llamada aunque el primer banco siga pendiente");
  assert.equal(r.events.length,1);
});
await t("la ventana diaria del servidor cubre som del cliente, también al cambiar de mes",async()=>{
  for(const instant of ["2026-08-31T22:30:00Z","2026-09-01T12:00:00Z","2026-10-31T23:30:00Z"]){
    const ms=Date.parse(instant);
    class FakeDate extends Date { constructor(...args){super(...(args.length?args:[ms]));} static now(){return ms;} }
    const c=loadPureLogicFromFile();c.Date=FakeDate;
    const r=await sync([link()],()=>({transactions:[]}),{},FakeDate);
    const asked=new URL(r.calls.at(-1),"https://bank.invalid").searchParams.get("date_from");
    const state={accounts:[{id:"cx",ent:"caixabank",role:"diario"}],expenses:[],fixed:[],debts:[],oneoffs:[],flows:[],settings:{}};
    // Ejecutar el importador evita copiar su constante: si amplía la ventana y el servidor
    // se queda atrás, un movimiento aceptado por el cliente quedaría fuera de la consulta.
    for(let days=0;days<50;days++){
      const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid"}).format(ms-days*86400000);
      const accepted=c.importObExpenses(state,[{ent:"caixabank",id:"test",date:day,amount:12,merchant:"Compra sintética"}]);
      if(accepted&&accepted.length) assert.ok(asked<=day,asked+" no cubre el gasto aceptado "+day);
    }
  }
});
await t("tope de filas y de páginas siempre declara parcial",async()=>{
  const large=await E.fetchBankTransactions("jwt","test",null,async()=>({transactions:Array.from({length:2001},(_,i)=>movement(String(i)))}));
  assert.equal(large.transactions.length,2000);assert.equal(large.truncated,true);
  let n=0;
  const empty=await E.fetchBankTransactions("jwt","test",null,async()=>({transactions:[],continuation_key:String(++n)}));
  assert.equal(n,12);assert.equal(empty.truncated,true);
});
if(failures) process.exitCode=1;
