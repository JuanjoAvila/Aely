import { loadPureLogic } from "../scripts/load-pure-logic.mjs";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { E, SYNC, main, day } from "./helpers/banco-sintetico.mjs";
import { ctx, sync, updater, scenario } from "./helpers/bank-download-fixture.mjs";

// La respuesta y el cursor salen del handler real; un resumen de flags no vería un acuse falso.
const tx=(id="new")=>({entry_reference:id,booking_date:day(-1),transaction_amount:{amount:"12.50"},credit_debit_indicator:"DBIT",status:"BOOK"});
let count=0,failed=0;
async function test(name,fn){count++;try{await fn();console.log("  ✓ "+name);}catch(e){failed++;console.error("  ✗ "+name+": "+e.message);}}
for(const [name,api,maxPages,reason]of [
  ["tope de páginas",async()=>({transactions:[tx()],continuation_key:"next"}),1,"page_limit"],
  ["tope de filas",async()=>({transactions:Array.from({length:2001},(_,i)=>tx("id"+i))}),12,"row_limit"],
  ["continuación repetida",async()=>({transactions:[tx()],continuation_key:"loop"}),12,"repeated_cursor"],
  ["corte del proveedor",async(jwt,path)=>{if(path.includes("continuation_key"))throw Error("EB 503 dato-sintetico-privado");return {transactions:[tx()],continuation_key:"next"};},12,"provider_error"],
  ["respuesta incompleta",async(jwt,path)=>path.includes("continuation_key")?{}:{transactions:[tx()],continuation_key:"next"},12,"invalid_response"],
])await test(name+" conserva motivo cerrado",async()=>{
  const r=await E.fetchBankTransactions("synthetic","account",null,api,1000,false,maxPages);
  assert.equal(r.truncated,true);assert.equal(r.readReason,reason);
  assert.ok(!JSON.stringify(r).includes("dato-sintetico-privado"));
});
await test("tiempo propio no se atribuye al proveedor",async()=>{
  const api=async(jwt,path,{signal})=>path.includes("continuation_key")?new Promise((resolve,reject)=>{
    if(signal.aborted)reject(Error("aborted"));else signal.addEventListener("abort",()=>reject(Error("aborted")),{once:true});
  }):{transactions:[tx()],continuation_key:"next"};
  const r=await E.fetchBankTransactions("synthetic","account",null,api,5);
  assert.equal(r.readReason,"time_limit");assert.equal(r.truncated,true);
});
for(const [name,page]of [["100 filas sin continuación",{transactions:Array.from({length:100},(_,i)=>tx("tr"+i))}],["última página vacía",{transactions:[]}]])await test(name+" no inventa corte",async()=>{
  const r=await E.fetchBankTransactions("synthetic","account",null,async()=>page);
  assert.equal(r.truncated,false);assert.equal(r.readReason,undefined);
});
for(const acks of [false,true])for(const kind of ["provider","repeated"])await test(kind+" no adelanta cursor ni acuse (acks="+acks+")",async()=>{
  const r=await sync((url,n)=>{if(kind==="provider"&&n>1)throw Error("EB 503 detalle-privado");return {transactions:[tx("id"+n)],continuation_key:"loop"};},{acks});
  assert.equal(r.row.last_sync,r.before);assert.equal(r.data.links[0].ack,undefined);assert.equal(r.calls,2);
});
await test("lectura completa conserva acuse119 sin adelantar antes de entregar",async()=>{
  const r=await sync(()=>({transactions:[tx()]}));assert.ok(r.data.links[0].ack);assert.equal(r.row.last_sync,r.before);
});
for(const initial of [true,false])await test("registro saneado explica fallo "+(initial?"sin páginas":"a media lectura"),async()=>{
  const secret="IBAN-y-token-no-deben-salir";
  const r=await sync((url,n)=>{if(initial||n>1)throw Error("EB 503 "+secret);return {transactions:[tx()],continuation_key:"next"};});
  const event=r.events.find(e=>e.message.startsWith("OB sync")),detail=JSON.parse(event.detail);
  assert.ok(detail.reasons.includes("provider_error"));assert.ok(detail.failureCodes.includes("eb_503"));
  assert.ok(!JSON.stringify(event).includes(secret));assert.ok(!JSON.stringify(event).includes("cx"));
});
const old={ent:"caixabank",id:"old",date:day(-2),amount:7,merchant:"Antes",status:"BOOK",extra:"conservar"};
const incoming=(id="new",extra={})=>Object.assign({ext_id:id,date:day(-1),amount:12,merchant:"Nuevo",status:"BOOK"},extra);
const link=(reason,transactions)=>({aspsp:"CaixaBank",ok:true,accounts:[{ok:true,truncated:true,readReason:reason,transactions}]});
await test("un corte conserva lo anterior y añade solo identidad nueva segura",()=>{
  const rows=ctx.flattenBankTx([link("provider_error",[incoming()])],[old]);
  assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id==="old").extra,"conservar");assert.equal(old.amount,7);
});
await test("un corte no sobrescribe identidad previa ni añade ambiguas, pendientes o sin id",()=>{
  const rows=ctx.flattenBankTx([link("provider_error",[incoming("old",{amount:99}),incoming("duplicate"),incoming("duplicate",{amount:18}),incoming(null),incoming("pending",{status:"PDNG"})])],[old]);
  assert.equal(rows.length,1);assert.equal(rows[0].amount,7);
});
await test("banco caído conserva su extracto, otro banco completo conserva su lectura",()=>{
  const rows=ctx.flattenBankTx([{aspsp:"CaixaBank",ok:false,accounts:[]},{aspsp:"Revolut",ok:true,accounts:[{ok:true,transactions:[incoming("rv")]}]}],[old]);
  assert.ok(rows.some(r=>r.id==="old"));assert.ok(rows.some(r=>r.id==="rv"));
});
await test("un corte tampoco borra un banco que no vino en la respuesta",()=>{
  const other=Object.assign({},old,{ent:"revolut",id:"other"});
  const rows=ctx.flattenBankTx([link("provider_error",[incoming()])],[old,other]);
  assert.ok(rows.some(r=>r.id==="other"));
});
await test("un error antes de la primera página queda registrado sin datos libres",async()=>{
  const r=await sync(()=>({transactions:[]}),{balanceError:"EB 503 texto-privado"});
  const detail=JSON.parse(r.events.find(e=>e.message.startsWith("OB sync")).detail);
  assert.equal(detail.pages,0);assert.equal(detail.status,"error");
  assert.ok(detail.reasons.includes("provider_error"));assert.ok(detail.failureCodes.includes("eb_503"));
  assert.ok(!JSON.stringify(detail).includes("texto-privado"));assert.equal(r.row.last_sync,r.before);
});
for(const reason of ["provider_error","invalid_response","repeated_cursor","page_limit","row_limit","time_limit"])await test("aviso distingue "+reason,()=>{
  const warnings=ctx.bankReadWarnings([link(reason,[])]);
  assert.equal(warnings[0].key,reason==="time_limit"?"bank_read_timeout":["page_limit","row_limit"].includes(reason)?"bank_read_limited":"bank_read_interrupted");
});
await test("tramo antiguo pendiente no es descarga cortada",()=>{
  const warnings=ctx.bankReadWarnings([{aspsp:"CaixaBank",ok:true,gapPending:true,accounts:[{ok:true,count:1,transactions:[incoming()]}]}]);
  assert.equal(warnings[0].key,"bank_read_pending");
});
const before=execFileSync("git",["show","3625fa7ed5134cfbc5e364adc4f588bfdaf670c0:src/modules/11-app-main.js"],{encoding:"utf8",maxBuffer:6e6});
for(const reason of ["provider_error","repeated_cursor"])await test("updater real: ambos consumidores preservan extracto, lápidas, gemelos y recibo ("+reason+")",()=>{
  const links=[link(reason,[incoming()])],a=updater(before,links),b=updater(main,links);
  assert.ok(!a.proof[0].some(x=>x.id==="old"),"la base123 debe reproducir el rojo en la lectura para pruebas de pago");
  assert.ok(!a.state.bankTx.some(x=>x.id==="old"),"la base123 debe reproducir el rojo en el guardado final");
  assert.ok(b.proof[0].some(x=>x.id==="old"));assert.ok(b.state.bankTx.some(x=>x.id==="old"));
  assert.equal(JSON.stringify(b.state.deleted),JSON.stringify(["lapida-sintetica"]));
  assert.equal(JSON.stringify(b.state.gemelos),JSON.stringify([{id:"gemelo-previo",status:"kept"}]));
  assert.equal(b.state.expenses.find(x=>x.id==="guardado").reciboId,"marca-previa");
});
for(const id of ["old",null])await test("updater real: extracto conservado no resucita lápida (id="+id+")",()=>{
  const cached=Object.assign({},old,{id}),key="caixabank|"+cached.date+"|7|Antes";
  const b=updater(main,[link("provider_error",[])],{bankTx:[cached],expenses:[],deleted:[key],gemelos:[]});
  assert.equal(b.state.bankTx.length,1);assert.equal(b.state.expenses.length,0);
  assert.equal(JSON.stringify(b.state.deleted),JSON.stringify([key]));
});
await test("updater real: conserva ordinales iguales y vínculo resuelto sin lápida",()=>{
  const cache=Array.from({length:3},()=>Object.assign({},old,{id:null,merchant:"Movimiento"}));
  const key="caixabank|"+old.date+"|7|Movimiento";
  const expenses=[{id:"primero",source:"ob",ent:"caixabank",date:old.date,amount:7,merchant:"Movimiento",obName:"Movimiento",category:"otros"},
    {id:"tercero",source:"ob",ent:"caixabank",date:old.date,amount:7,merchant:"Movimiento",obName:"Movimiento",obOrd:3,category:"otros"}];
  const gemelos=[{banco:key+"|#2",aviso:"aviso-resuelto"}];
  const b=updater(main,[link("provider_error",[])],{bankTx:cache,expenses,deleted:[],gemelos});
  assert.equal(b.state.bankTx.length,3);assert.equal(b.state.expenses.length,2);
  assert.equal(JSON.stringify(b.state.gemelos),JSON.stringify(gemelos));
  assert.equal(b.state.expenses.find(x=>x.id==="tercero").obOrd,3);
});
await test("handler y updater reales: trozo antiguo sellado sin id entra antes de su acuse aunque falle el siguiente",async()=>{
  const r=await sync((url,n)=>{
    if(n===1)return {transactions:[tx()]};
    if(n===2)return {transactions:[Object.assign({},tx(),{entry_reference:null,booking_date:url.searchParams.get("date_from")})]};
    throw Error("EB 503 causa-sintetica");
  },{ageDays:45});
  const l=r.data.links[0];assert.equal(l.readReason,"provider_error");assert.ok(l.ack);assert.equal(r.row.last_sync,r.before);
  assert.ok(l.accounts.every(a=>a.ok&&!a.truncated&&!a.transactionError));
  const b=updater(main,[l],{bankTx:[],expenses:[],deleted:[],gemelos:[]});
  assert.equal(b.state.bankTx.length,2);assert.equal(b.state.expenses.length,2);
  assert.ok(b.state.expenses.some(e=>!e.extId&&e.source==="ob"));
});
await test("trozo sellado repetido no suma otra vez filas sin id del extracto anterior",()=>{
  const cache=Array.from({length:2},()=>Object.assign({},old,{id:null,merchant:"Movimiento"}));
  const l={aspsp:"CaixaBank",ok:true,readReason:"page_limit",accounts:[{ok:true,transactions:Array.from({length:3},()=>incoming(null,{date:old.date,amount:7,merchant:"Movimiento"}))}]};
  const first=ctx.flattenBankTx([l],cache),second=ctx.flattenBankTx([l],first);
  assert.equal(first.length,3);assert.equal(second.length,3);
});

for(const mode of ["page_limit","row_limit"])await test("handler+cliente reales: "+mode+" con acuse importa sin id y conserva bankTx entre pulsaciones",async()=>{
  const first=await scenario(mode);const expected=mode==="page_limit"?60:2000;
  assert.ok(first.data.links[0].ack);assert.ok(first.data.links[0].accounts[0].truncated);
  let state={bankTx:[],expenses:[],deleted:[],gemelos:[]};
  for(let pulse=0;pulse<3;pulse++){
    const r=pulse?await sync(first.reply,{rows:first.rows,acksValue:{CaixaBank:first.data.links[0].ack}}):first;
    state=updater(main,r.data.links,state).state;
    assert.equal(state.bankTx.length,expected);assert.equal(state.expenses.length,expected);
    assert.equal(new Set(state.expenses.map(e=>e.id)).size,expected);
  }
});
await test("fecha futura nunca entra en parcial, con id o sin id sellado",()=>{
  for(const id of ["future",null]){
    const l=link("provider_error",[incoming(id,{date:day(2)})]);
    if(!id)Object.assign(l,{readReason:"provider_error",accounts:[{ok:true,transactions:l.accounts[0].transactions}]});
    assert.equal(ctx.flattenBankTx([l],[]).length,0);
  }
});
await test("enlace o cuenta truncados no acreditan multiplicidad sin id",()=>{
  for(const surface of ["link","account"]){
    const l={aspsp:"CaixaBank",ok:true,readReason:"provider_error",accounts:[{ok:true,transactions:[incoming(null)]}]};
    if(surface==="link")l.truncated=true;else l.accounts[0].truncated=true;
    assert.equal(ctx.flattenBankTx([l],[]).length,0);
  }
});
await test("previous omitido y vacío tienen las mismas garantías en parcial",()=>{
  const l=link("provider_error",[incoming(null),incoming("pending",{status:"PDNG"}),incoming("safe")]);
  assert.equal(JSON.stringify(ctx.flattenBankTx([l])),JSON.stringify(ctx.flattenBankTx([l],[])));
});
await test("caducado retira solo snapshot bankTx y conserva su libro de Gastos",()=>{
  const cached=Object.assign({},old),b=updater(main,[{aspsp:"CaixaBank",ok:false,expired:true,accounts:[]}],{bankTx:[cached]});
  assert.equal(b.state.bankTx.length,0);assert.ok(b.state.expenses.some(e=>e.id==="guardado"));
});


await test("presupuesto propio no se atribuye al proveedor en el diagnóstico real",()=>{
  const classify=new Function("Deno","withCors",SYNC+";return obReadLogDetails;")({serve(){}},fn=>fn);
  const detail=classify([{ok:false,error:"transactions_budget"}]);
  assert.deepEqual(detail.reasons,["page_limit"]);assert.deepEqual(detail.failureCodes,["page_limit"]);
});
for(const [mode,key]of [["page_limit","bank_read_limited"],["row_limit","bank_read_limited"],["time_limit","bank_read_timeout"],["pending","bank_read_pending"],["sealed_prefix","bank_read_interrupted"]])await test("respuesta handler real ata motivo, clave y texto en es/en/ca: "+mode,async()=>{
  const r=await scenario(mode),l=r.data.links[0],w=ctx.bankReadWarnings(r.data.links)[0];
  assert.equal(w.key,key);if(mode==="pending"){assert.equal(l.readReason,"page_limit");assert.equal(l.gapPending,true);assert.ok(l.ack);}
  for(const lang of ["es","en","ca"]){
    if(lang!=="es")vm.runInContext("LANG."+lang+"="+fs.readFileSync("public/i18n/"+lang+".json","utf8"),ctx);
    vm.runInContext("CURLANG="+JSON.stringify(lang),ctx);
    const text=ctx.tf(w.key,{bank:w.bank});
    assert.ok(text.includes("CaixaBank"));assert.ok(!text.includes("{bank}"));
    const tokens=key==="bank_read_limited"?["Importar histórico","Import history","Importar històric"]:key==="bank_read_timeout"?["tardado demasiado","took too long","trigat massa"]:key==="bank_read_pending"?["movimientos antiguos","older transactions","moviments antics"]:["el banco o la conexión","the bank or connection","el banc o la connexió"];
    assert.ok(text.includes(tokens[["es","en","ca"].indexOf(lang)]),text);
    if(key==="bank_read_limited")assert.doesNotMatch(text,/Puedes volver|You can sync|Pots tornar/);
  }
  vm.runInContext('CURLANG="es"',ctx);
});

await test("readChunk al agotar llamadas antes del siguiente trozo conserva page_limit",async()=>{
  const r=await scenario("pending_saturated");
  assert.equal(r.calls,12);assert.equal(r.data.links[0].readReason,"page_limit");assert.equal(r.data.links[0].gapPending,true);
});

await test("base2d53 importa60 de84 sin id; revisión conserva los mismos60 con acuse",async()=>{
  const r=await scenario("page_limit");
  const baseLogic=loadPureLogic(execFileSync("git",["show","2d53ab24dc32a83faf17ce08c3b2d50b304d8e55:public/index.html"],{encoding:"utf8",maxBuffer:6e6}));
  const baseApp=execFileSync("git",["show","2d53ab24dc32a83faf17ce08c3b2d50b304d8e55:src/modules/11-app-main.js"],{encoding:"utf8",maxBuffer:6e6});
  const state={bankTx:[],expenses:[],deleted:[],gemelos:[]};
  assert.equal(updater(baseApp,r.data.links,state,baseLogic).state.expenses.length,60);
  assert.equal(updater(main,r.data.links,state).state.expenses.length,60);
});
await test("aviso de tramo pendiente conserva el actualizado; corte del proveedor no lo inventa",async()=>{
  const a=main.indexOf("      const bankLabelOf=function(l)"),b=main.indexOf("      // ── BANCO SIN CONECTAR",a);assert.ok(a>=0&&b>a);
  for(const mode of ["pending","provider_error"]){
    const r=await scenario(mode),messages=[];
    new Function("links","dbLinks","opts","preview","obAdded","avisaSync","bankIssuesOf","bankReadWarnings","bankRateRemember","tf","t","eur","entOf","entFromAspsp",main.slice(a,b))(
      r.data.links,[],{manual:true},{synced:[{ent:"caixabank",bal:100}]},[],(_opts,text)=>messages.push(text),...["bankIssuesOf","bankReadWarnings","bankRateRemember","tf","t","eur","entOf","entFromAspsp"].map(name=>vm.runInContext(name,ctx))
    );
    assert.equal(messages.some(text=>text.startsWith("✓ ")),mode==="pending");
    assert.ok(messages.some(text=>text.includes(ctx.tf(mode==="pending"?"bank_read_pending":"bank_read_interrupted",{bank:"CaixaBank"}))));
  }
});

await test("un desborde SIN acuse no acredita filas nuevas sin id",()=>{
  for(const reason of ["page_limit","row_limit"]){
    const l=link(reason,[incoming(null)]);
    assert.equal(ctx.flattenBankTx([l],[]).length,0);
  }
});
await test("transactions_budget antes de la primera página sale como page_limit del handler",async()=>{
  const r=await sync(()=>{throw Error("transactions_budget");});
  assert.equal(r.data.links[0].accounts[0].readReason,"page_limit");
  const detail=JSON.parse(r.events.find(e=>e.message.startsWith("OB sync")).detail);
  assert.ok(detail.reasons.includes("page_limit"));assert.ok(!detail.reasons.includes("provider_error"));
});
console.log("bank-download-incomplete: "+(count-failed)+" PASS / "+failed+" FAIL");
if(failed)process.exit(1);
