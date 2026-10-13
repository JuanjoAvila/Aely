import assert from "node:assert/strict";
import { E, Entrada, SYNC, CALLBACK, baseDatos, enlace, haceDias, FakeDate, read, ts, handlerSrc } from "./helpers/banco-sintetico.mjs";

// El snapshot SELECT está separado de la fila viva: compartir la referencia ocultaría la carrera.
// El cifrado también es el real; ningún transporte sale de estos dobles.
const key=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
const env={SUPABASE_URL:"https://db.invalid",APP_URL:"https://app.invalid/",TOKEN_ENCRYPTION_KEY:key};
const originalDeno=globalThis.Deno;
globalThis.Deno={env:{get:k=>env[k]}};
const moduleUrl=source=>"data:text/javascript;base64,"+Buffer.from(ts(source)).toString("base64");
const cryptoUrl=moduleUrl(read("supabase/functions/_shared/crypto.ts"));
const token=await import(moduleUrl(read("supabase/functions/_shared/token_store.ts").replace('"./crypto.ts"',JSON.stringify(cryptoUrl))));
const DISCONNECT=handlerSrc(read("supabase/functions/bank-disconnect/index.ts"));
const jsonResp=(x,status=200)=>new Response(JSON.stringify(x),{status});
const runtime=serve=>({serve,env:{get:k=>env[k]||"synthetic"}});
const oldId="synthetic-consent /?%#",freshId="synthetic-new-consent";
const account={uid:"old-account",iban:"ES0000000000000000000000",currency:"EUR",hash:"synthetic-stable"};
async function row(extra={}){return enlace(haceDias(1),[account.uid],Object.assign({session_id:await token.encryptSessionId(oldId),state_issued_at:new FakeDate(FakeDate.now()-2000).toISOString(),accounts:[account]},extra));}
function dbFor(rows,failLog=false){
  const db=baseDatos(rows),from=db.from,events=[];
  db.from=name=>name==="app_events"?{insert:async x=>{if(failLog)throw Error("synthetic-log-unavailable");events.push(x);return {};}}:from(name);
  return {db,events};
}
async function disconnect(rows,{failure=null,failLog=false}={}){
  const {db,events}=dbFor(rows,failLog),calls=[];let handler;
  new Function("Deno","createClient","ebApi","ebConfig","jsonResp","makeJWT","withCors","decryptSessionId","ebFailure",DISCONNECT)(
    runtime(fn=>handler=fn),()=>db,async(jwt,path,init)=>{calls.push({path,method:init.method});if(failure)throw Error(failure);return {};},
    ()=>({}),jsonResp,async()=>"synthetic-jwt",fn=>fn,token.decryptSessionId,E.ebFailure
  );
  const response=await handler(new Request("https://app.invalid",{method:"POST",body:JSON.stringify({aspsp_name:rows.find(x=>x.user_id==="synthetic")?.aspsp_name||"CaixaBank"})}));
  return {status:response.status,data:await response.json(),events,calls};
}
function startSync(rows,{success=false,acks=true}={}){
  const {db,events}=dbFor(rows);let handler,release,entered;
  const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  const api=async(jwt,path)=>{
    if(path.endsWith("/balances")){entered();await gate;if(!success)throw Error("EB 401 EXPIRED_SESSION");return {balances:[{balance_type:"ITAV",balance_amount:{amount:"100",currency:"EUR"}}]};}
    if(path.includes("/transactions?"))return {transactions:[]};
    throw Error("Transporte inesperado: solo banco sintético");
  };
  new Function("Deno","createClient","ebApi","ebConfig","jsonResp","makeJWT","mapTransaction","withCors","fetchBankTransactions","Date","ebFailure","ebSessionVerdict","decryptSessionId",SYNC)(
    runtime(fn=>handler=fn),()=>db,api,()=>({}),jsonResp,async()=>"synthetic-jwt",E.mapTransaction,fn=>fn,E.fetchBankTransactions,FakeDate,E.ebFailure,E.ebSessionVerdict,token.decryptSessionId
  );
  const pending=handler(new Request("https://app.invalid",{method:"POST",body:JSON.stringify(acks?{acks:{}}:{})}));
  return {started,release,pending,events};
}
async function callback(rows){
  const state="synthetic-new-state";Object.assign(rows[0],{state,status:"pending",state_issued_at:new FakeDate(FakeDate.now()-1000).toISOString()});
  const {db}=dbFor(rows);let handler;
  const session={session_id:freshId,accounts:[{uid:"new-account",account_id:{iban:account.iban},currency:"EUR",identification_hash:account.hash}]};
  new Function("Deno","createClient","ebApi","ebConfig","makeJWT","encryptSessionId","CallbackFallo","codigoCallback","codigoNolink","Date","console","setTimeout",CALLBACK)(
    runtime(fn=>handler=fn),()=>db,async()=>session,()=>({}),async()=>"synthetic-jwt",token.encryptSessionId,Entrada.CallbackFallo,Entrada.codigoCallback,Entrada.codigoNolink,FakeDate,{error(){}},fn=>setTimeout(fn,0)
  );
  const response=await handler(new Request("https://app.invalid?code=synthetic&state="+state));
  assert.equal(response.status,302);assert.ok(response.headers.get("location").includes("bank=ok"));
  assert.equal(await token.decryptSessionId(rows[0].session_id),freshId);
  assert.equal(rows[0].status,"active");
}
let count=0,failed=0;
async function test(name,fn){count++;try{await fn();console.log("  ✓ "+name);}catch(e){failed++;console.error("  ✗ "+name+": "+e.message.split("\n")[0]);}}
for(const encrypted of [false,true])await test("revoca id "+(encrypted?"cifrado":"legacy")+" real, URL codificada y borrado aislado",async()=>{
  const mine=await row({session_id:encrypted?await token.encryptSessionId(oldId):oldId});
  const foreign=await row({id:"foreign",user_id:"other"}),other=await row({id:"other-bank",aspsp_name:"Revolut"});
  const rows=[mine,foreign,other],before=JSON.stringify([foreign,other]),r=await disconnect(rows);
  assert.equal(r.status,200);assert.deepEqual(r.data,{ok:true});
  assert.deepEqual(r.calls,[{path:"/sessions/"+encodeURIComponent(oldId),method:"DELETE"}]);
  assert.equal(JSON.stringify(rows),before);assert.ok(!JSON.stringify(r.data).includes(oldId));
});
for(const error of ["EB 503 synthetic-private-token "+oldId,"synthetic-network-private "+oldId])await test("revocación fallida deja registro cerrado, elimina local y no filtra dato",async()=>{
  const mine=await row(),stored=mine.session_id,rows=[mine],r=await disconnect(rows,{failure:error});
  assert.equal(r.status,200);assert.equal(rows.length,0);assert.equal(r.events.length,1);
  const trace=JSON.stringify([r.data,r.events]);for(const secret of [oldId,stored,"synthetic-private-token","synthetic-network-private","synthetic-jwt"])assert.ok(!trace.includes(secret));
  if(error.startsWith("EB 503"))assert.ok(trace.includes("503"));
});
for(const missingKey of [false,true])await test("no revoca ciphertext si falta clave o está corrupto (clave="+!missingKey+")",async()=>{
  const mine=await row(),rows=[mine];if(!missingKey)mine.session_id="enc:v1:malformed";else delete env.TOKEN_ENCRYPTION_KEY;
  try{const r=await disconnect(rows);assert.equal(r.status,200);assert.equal(rows.length,0);assert.equal(r.calls.length,0);assert.equal(r.events.length,1);assert.ok(!JSON.stringify(r.events).includes(mine.session_id));}
  finally{env.TOKEN_ENCRYPTION_KEY=key;}
});
await test("un registro caído no impide desconectar localmente",async()=>{
  const rows=[await row()],r=await disconnect(rows,{failure:"EB 503",failLog:true});assert.equal(r.status,200);assert.equal(rows.length,0);
});
await test("sin enlace no inventa revocación ni registro",async()=>{
  const r=await disconnect([]);assert.equal(r.status,200);assert.equal(r.calls.length,0);assert.equal(r.events.length,0);
});
for(const success of [false,true])await test("callback REAL gana al sync viejo "+(success?"correcto sin acuse":"caducado")+" y conserva cursor119",async()=>{
  const rows=[await row()],cursor=rows[0].last_sync,run=startSync(rows,{success,acks:!success});await run.started;
  try{await callback(rows);assert.equal(rows[0].last_sync,cursor);const after=JSON.stringify(rows[0]);run.release();const res=await run.pending;assert.equal(res.status,200);assert.equal(JSON.stringify(rows[0]),after);}
  finally{run.release();await run.pending;}
});
for(const change of ["session_id","state_issued_at"])await test("cambio independiente de "+change+" frena la escritura vieja",async()=>{
  const rows=[await row()],run=startSync(rows);await run.started;
  try{rows[0][change]=change==="session_id"?await token.encryptSessionId(freshId):new FakeDate(FakeDate.now()-1000).toISOString();rows[0].status="active";const after=JSON.stringify(rows[0]);run.release();await run.pending;assert.equal(JSON.stringify(rows[0]),after);}
  finally{run.release();await run.pending;}
});
for(const legacy of [false,true])await test("fila sin carrera "+(legacy?"NULL legacy":"cifrada")+" sigue recibiendo su estado",async()=>{
  const rows=[await row(legacy?{session_id:null,state_issued_at:null}:{})],run=startSync(rows);await run.started;run.release();assert.equal((await run.pending).status,200);assert.equal(rows[0].status,"expired");
});
if(originalDeno===undefined)delete globalThis.Deno;else globalThis.Deno=originalDeno;
console.log("bank-revoke-callback-race: "+(count-failed)+" PASS / "+failed+" FAIL");if(failed)process.exitCode=1;
