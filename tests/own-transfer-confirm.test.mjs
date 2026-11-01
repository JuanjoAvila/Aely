import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx=loadPureLogicFromFile();
const plain=x=>JSON.parse(JSON.stringify(x));
const owner="fixture-owner";
const uuid=n=>"550e8400-e29b-41d4-a716-"+String(n).padStart(12,"0");
function fixture(){
  const outgoing={id:uuid(1),date:"2026-10-20T12:00:00.000Z",merchant:"Transferencia sintética",amount:80,category:"otros",source:"ob",ent:"sabadell",obAcc:"acc-a",extId:"out-ref"};
  const incoming={id:uuid(2),date:"2026-10-21T12:00:00.000Z",merchant:"Transferencia sintética",amount:-80,category:"traspaso",source:"ob",ent:"trade_republic",obAcc:"acc-b",extId:"in-ref"};
  return {_historyOwner:owner,expenses:[outgoing,incoming],accounts:[{ent:"sabadell",bankUid:"acc-a",value:420},{ent:"trade_republic",bankUid:"acc-b",value:580}],obAccounts:[],fixed:[],debts:[],goals:[],flows:[],oneoffs:[],deleted:[],settings:{}};
}
const plan=s=>ctx.ownTransferPlan(s,s.expenses[0]);
const row=e=>({user_id:owner,id:e.id,fecha:e.date,comercio:e.merchant,importe:e.amount,cat:e.category,source:ctx.expenseSourceForCloud(e)});
let count=0;
async function check(name,fn){await fn();count++;console.log("✓ "+name);}

await check("solo ofrece pareja única entre cuentas propias conocidas de bancos distintos",()=>{
  const s=fixture(),before=plain(s),p=plan(s);
  assert.ok(p);assert.equal(p.owner,owner);
  assert.deepEqual(plain(p.outgoing),s.expenses[0]);assert.deepEqual(plain(p.incoming),s.expenses[1]);
  assert.notEqual(p.outgoing,s.expenses[0]);assert.notEqual(p.incoming,s.expenses[1]);
  assert.equal(p.accounts,JSON.stringify(s.accounts));assert.equal(ctx.ownTransferPlanValid(s,p),true);
  assert.deepEqual(plain(s),before,"ofrecer no modifica categorías ni dinero");
});
await check("nombre de tercero idéntico no veta una pregunta; tampoco acredita por sí solo",()=>{
  const s=fixture();s.expenses.forEach(e=>{e.merchant="Persona sintética homónima";});
  assert.ok(plan(s));s.accounts=[];assert.equal(plan(s),null);
});
for(const [label,patch] of [
  ["cero",{amount:0}],["signo de ingreso",{amount:-80}],["no finito",{amount:NaN}],
  ["medio céntimo",{amount:80.005}],["UUID corto",{id:"local-only"}],
  ["manual",{source:"manual"}],["notificación",{source:"macrodroid"}],
  ["sin cuenta",{obAcc:undefined}],["cuenta desconocida",{obAcc:"unknown"}],
  ["posible duplicado",{possibleDup:true}],["pendiente",{obPending:true}],["deuda",{debtId:"debt-a"}],
  ["categoría deuda",{category:"deudas"}],["inversión",{category:"inversion"}],
  ["recibo",{reciboId:"receipt-a"}],["meta",{goalId:"goal-a"}],
  ["rechazo ya confirmado",{ownTransferRejected:true}],["ya traspaso",{category:"traspaso"}],
  ["fecha inválida",{date:"invalid"}]
])await check("saliente no elegible: "+label,()=>{
  const s=fixture();Object.assign(s.expenses[0],patch);assert.equal(plan(s),null);
});
for(const patch of [{amount:-80.01},{amount:80},{category:"otros"},{obAcc:undefined},{obAcc:"unknown"},{source:"manual"},{possibleDup:true},{obPending:true},{debtId:"d"},{reciboId:"r"},{goalId:"g"},{id:"short"}])
  await check("entrante incompatible: "+JSON.stringify(patch),()=>{const s=fixture();Object.assign(s.expenses[1],patch);assert.equal(plan(s),null);});
await check("céntimos exactos admiten decimal ordinario y rechazan redondeo de fracciones",()=>{
  const s=fixture();s.expenses[0].amount=10.23;s.expenses[1].amount=-10.23;assert.ok(plan(s));
  s.expenses[1].amount=-10.234;assert.equal(plan(s),null);
});
await check("cuentas conocidas del mismo banco no ofrecen traspaso propio",()=>{
  const s=fixture();s.expenses[1].ent="sabadell";s.accounts[1].ent="sabadell";assert.equal(plan(s),null);
});
await check("vínculo durable de recibo bloquea aunque la fila no lleve reciboId ni haya feed",()=>{
  const s=fixture();s.fixed=[{id:"receipt-proof",paymentProofs:{[2026*12+10]:{kind:"expense",expenseId:s.expenses[0].id}}}];
  assert.equal(s.expenses[0].reciboId,undefined);assert.equal(plan(s),null);
});
await check("owner ausente o cuenta conocida duplicada no acreditan pareja",()=>{
  const noOwner=fixture();delete noOwner._historyOwner;assert.equal(plan(noOwner),null);
  for(const side of [0,1]){const s=fixture();s.accounts.push({...s.accounts[side]});assert.equal(plan(s),null);}
});
await check("ambigüedad por dos entrantes o dos salientes impide elegir pareja",()=>{
  for(const side of [0,1]){const s=fixture();s.expenses.push({...s.expenses[side],id:uuid(3),extId:"third-ref"});assert.equal(plan(s),null);}
});
await check("UUID repetido no identifica una fila única",()=>{
  const s=fixture();s.expenses.push({...s.expenses[0]});assert.equal(plan(s),null);
});
await check("lápida del saliente o entrante impide propuesta",()=>{
  for(const side of [0,1]){const s=fixture();s.deleted=[ctx.keyOfExpense(s.expenses[side])];assert.equal(plan(s),null);}
});
for(const [label,a,b,want] of [
  ["Madrid dos días aunque UTC tres", "2026-06-01T22:30:00Z","2026-06-04T21:30:00Z",true],
  ["Madrid tres días aunque UTC dos", "2026-06-01T21:30:00Z","2026-06-03T22:30:00Z",false],
  ["DST otoño dos días y 49 horas", "2026-10-24T10:00:00Z","2026-10-26T11:00:00Z",true],
  ["DST primavera tres días menos de 72 horas", "2026-03-27T23:30:00Z","2026-03-30T22:15:00Z",false],
  ["orden inverso también dos días", "2026-10-26T11:00:00Z","2026-10-24T10:00:00Z",true]
])await check(label,()=>{const s=fixture();s.expenses[0].date=a;s.expenses[1].date=b;assert.equal(!!plan(s),want);});

for(const mutate of [
  s=>{s._historyOwner="other-owner";},s=>{s.expenses.pop();},
  s=>{s.expenses[0].amount=81;},s=>{s.expenses[1].category="otros";},
  s=>{s.expenses[1].obAcc="other";},s=>{s.accounts[0].bankUid="changed";},
  s=>{s.expenses[0].note="edited while dialog open";},
  s=>{s.expenses.push({...s.expenses[1],id:uuid(3),extId:"third"});}
])await check("foto cambiada durante diálogo no permite aplicar respuesta: "+mutate,()=>{
  const s=fixture(),p=plan(s);mutate(s);assert.equal(ctx.ownTransferPlanValid(s,p),false);
  for(const answer of ["yes","no"])assert.equal(ctx.applyOwnTransferDecision(s,p,answer,100),s);
});
await check("SÍ solo recategoriza salida y preserva entrada, saldos y restantes colecciones",()=>{
  const s=fixture(),before=plain(s),p=plan(s),next=ctx.applyOwnTransferDecision(s,p,"yes",100);
  assert.notEqual(next,s);assert.equal(next.expenses[0].category,"traspaso");
  assert.equal(next.expenses[1],s.expenses[1]);assert.equal(next.accounts,s.accounts);
  for(const key of ["fixed","debts","goals","flows","oneoffs","settings"])assert.equal(next[key],s[key]);
  for(const key of Object.keys(s.expenses[0]))if(key!=="category")assert.deepEqual(next.expenses[0][key],s.expenses[0][key]);
  assert.deepEqual(plain(s),before);
});
await check("NO persiste solo rechazo saliente; cancelar no es rechazo",()=>{
  const s=fixture(),p=plan(s),next=ctx.applyOwnTransferDecision(s,p,"no",100);
  assert.equal(next.expenses[0].ownTransferRejected,true);assert.equal(next.expenses[0].category,"otros");
  assert.equal(next.expenses[1],s.expenses[1]);assert.equal(next.accounts,s.accounts);assert.equal(plan(next),null);
  for(const answer of [null,undefined,"cancel",false])assert.equal(ctx.applyOwnTransferDecision(s,p,answer,100),s);
});
await check("NO sobrevive source, pull, recarga y consolidación del mismo UUID",()=>{
  const s=fixture(),e={...s.expenses[0],ownTransferRejected:true,obOrd:2};
  const raw=row(e);assert.match(raw.source,/#ownno(?:#|$)/);assert.match(raw.source,/#n2$/);
  const decoded=ctx.expenseFromRow(raw);assert.equal(decoded.ownTransferRejected,true);
  assert.equal(ctx.expenseSourceForCloud(decoded),raw.source);
  const refreshed=ctx.refreshExpenseFromCloud(s.expenses[0],decoded,200);assert.equal(refreshed.ownTransferRejected,true);
  const stale=ctx.refreshExpenseFromCloud(refreshed,ctx.expenseFromRow(row(s.expenses[0])),99);
  assert.equal(stale.ownTransferRejected,true,"un pull anterior no reabre una negativa");
  const merged=ctx.mergeExpensesFromCloud([e,{...e,ownTransferRejected:undefined}],[ctx.expenseFromRow(raw)],201);
  assert.equal(merged.list.length,1);assert.equal(merged.list[0].ownTransferRejected,true);
  assert.equal(plan({...s,expenses:[plain(refreshed),s.expenses[1]]}),null);
});
await check("row matcher exige owner, UUID y snapshot íntegro",()=>{
  const s=fixture(),e=s.expenses[0],r=row(e);assert.equal(ctx.ownTransferRowMatches(e,r,owner),true);
  for(const patch of [{user_id:"other"},{id:uuid(9)},{source:r.source+"#ownno"},{cat:"super"},{fecha:"2026-10-22T12:00:00Z"},{importe:80.01},{comercio:"Otro"}])
    assert.equal(ctx.ownTransferRowMatches(e,{...r,...patch},owner),false,JSON.stringify(patch));
});
await check("rechazo no se propaga al refrescar UUID diferente",()=>{
  const s=fixture(),local=s.expenses[0],other={...local,id:uuid(9),ownTransferRejected:true};
  const next=ctx.refreshExpenseFromCloud(local,other,200);
  assert.notEqual(next.ownTransferRejected,true);
  assert.equal(next.id,local.id);
});
await check("SÍ protege frente a pull anterior al ACK, admite corrección posterior y no serializa reloj",()=>{
  const s=fixture(),p=plan(s),marked=ctx.applyOwnTransferDecision(s,p,"yes",100),e=marked.expenses[0];
  assert.equal(ctx.refreshExpenseFromCloud(e,s.expenses[0],99).category,"traspaso");
  assert.equal(ctx.refreshExpenseFromCloud(e,{...s.expenses[0],category:"super"},101).category,"super");
  assert.deepEqual(Object.keys(e).sort(),Object.keys(s.expenses[0]).sort(),"la protección WeakMap no viaja en la fila");
  const reloaded=plain(e);
  assert.equal(ctx.refreshExpenseFromCloud(reloaded,{...s.expenses[0],category:"super"},101).category,"super");
});

// El doble ejecuta filtros reales del query builder: cero filas no se convierte en un ACK.
// No simula atomicidad de la pareja: el UPDATE solo protege la foto del saliente.
await check("pull viejo conserva SÍ al soltar catStale y consolidar el mismo UUID",()=>{
  for(const duplicate of [false,true]){
    const s=fixture();Object.assign(s.expenses[0],{catStale:["otros"],catAckAt:50});
    const next=ctx.applyOwnTransferDecision(s,plan(s),"yes",100),old=ctx.expenseFromRow(row(s.expenses[0]));
    const before=duplicate?[next.expenses[0],{...s.expenses[0]}]:next.expenses;
    const kept=ctx.keepCategoryChoices(before,[old],75);
    const merged=ctx.mergeExpensesFromCloud(kept.prev,kept.incoming,75);
    assert.equal(merged.list.find(e=>e.id===s.expenses[0].id).category,"traspaso");
  }
});
const core=fs.readFileSync("src/modules/00-core.js","utf8");
const match=core.match(/async decideOwnTransfer\(plan,\s*decision,\s*readState\)\s*\{([\s\S]*?)\n    \},/);
assert.ok(match,"writer own-transfer presente");
// La autorización de absorciones tiene pruebas propias y consulta almacenamiento ajeno a este
// caso. Solo ese guard se sustituye; auth, owner, snapshots, filtros y ACK ejecutan código real.
const method=vm.runInContext("(async function(plan,decision,readState){const sb=globalThis.__ownTransferSb;const obConfirmedCanUpload=async()=>true;"+match[1]+"\n})",ctx);
function client(s,opts={}){
  const rows=s.expenses.map(row),ops=[];let authCalls=0,reads=0;
  const sb={auth:{getSession:async()=>{
    authCalls++;if(opts.onAuth)opts.onAuth(authCalls,s);
    const uid=opts.ownerAt?opts.ownerAt(authCalls):owner;
    return {data:{session:uid?{user:{id:uid},...(opts.expired?{expires_at:1}:{})}:null},error:opts.authError?new Error("session error"):null};
  }},from(table){
    const filters=[];let patch=null,single=false;
    const execute=async()=>{
      if(patch){
        ops.push({table,patch:plain(patch),filters:plain(filters)});
        if(opts.beforeUpdate)opts.beforeUpdate(rows,s);
        if(opts.writeError)return {data:null,error:new Error("denied")};
        const selected=opts.zero?[]:rows.filter(r=>filters.every(([k,v])=>r[k]===v));
        selected.forEach(r=>Object.assign(r,patch));
        if(opts.afterUpdate)opts.afterUpdate(rows,s);
        return {data:opts.ack===undefined?plain(selected):opts.ack,error:null};
      }
      reads++;if(opts.beforeRead)opts.beforeRead(reads,rows,s);
      if(opts.readError)return {data:null,error:new Error("read denied")};
      const selected=rows.filter(r=>filters.every(([k,v])=>Array.isArray(v)?v.includes(r[k]):r[k]===v));
      const data=plain(selected);if(opts.afterRead)opts.afterRead(reads,rows,s);
      return {data:single?(data[0]||null):data,error:null};
    };
    const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},in(k,v){filters.push([k,v]);return q;},
      update(p){patch=p;return q;},maybeSingle(){single=true;return execute();},single(){single=true;return execute();},
      then(ok,bad){return execute().then(ok,bad);}};
    return q;
  }};
  return {sb,rows,ops};
}
async function run(c,s,p=plan(s),decision="yes"){
  ctx.__ownTransferSb=c.sb;return method(p,decision,()=>s);
}
for(const decision of ["yes","no"])await check("writer "+decision+": patch único, filtros CAS y ACK exacto",async()=>{
  const s=fixture(),p=plan(s),c=client(s),before=plain(c.rows),ack=await run(c,s,p,decision);
  assert.ok(ack);assert.equal(c.ops.length,1);const op=c.ops[0];assert.equal(op.table,"expenses");
  assert.deepEqual(Object.keys(op.patch),[decision==="yes"?"cat":"source"]);
  if(decision==="yes")assert.equal(op.patch.cat,"traspaso");else assert.match(op.patch.source,/#ownno(?:#|$)/);
  assert.deepEqual(c.rows[1],before[1],"entrante no recibe escrituras");
  for(const key of ["user_id","id","source","cat","fecha","importe","comercio"])
    assert.ok(op.filters.some(([k,v])=>k===key&&v===before[0][key]),"CAS "+key);
});
for(const [name,opts] of [
  ["sin sesión",{ownerAt:()=>null}], ["owner cambia antes de update",{ownerAt:n=>n===1?owner:"other"}],
  ["lectura fallida",{readError:true}],
  ["sesión caducada",{expired:true}],["error de sesión con datos residuales",{authError:true}],
  ["foto cambia durante última validación de sesión",{onAuth:(n,s)=>{if(n===2)s.expenses[0].amount=81;}}],
  ["partner cambió categoría",{beforeRead:(_n,rows)=>{rows[1].cat="otros";}}],
  ["saliente cambió importe",{beforeRead:(_n,rows)=>{rows[0].importe=81;}}],
  ["partner desaparecido",{beforeRead:(_n,rows)=>{rows.splice(1);}}],
  ["snapshot local cambia tras lectura",{afterRead:(_n,_rows,s)=>{s.accounts[0].bankUid="changed";}}]
])await check(name+": aborta antes de escribir",async()=>{
  const s=fixture(),p=plan(s),c=client(s,opts);await assert.rejects(()=>run(c,s,p));assert.equal(c.ops.length,0);
});
for(const [name,opts] of [
  ["CAS cero filas",{zero:true}],["error escritura",{writeError:true}],["ACK null",{ack:null}],
  ["ACK vacío",{ack:[]}],["ACK owner incorrecto",{ack:[{...row(fixture().expenses[0]),cat:"traspaso",user_id:"other"}]}],
  ["ACK UUID incorrecto",{ack:[{...row(fixture().expenses[0]),cat:"traspaso",id:uuid(9)}]}],
  ["ACK categoría original",{ack:[row(fixture().expenses[0])]}],
  ["sesión cambia tras envío",{afterUpdate:(_rows,s)=>{s._historyOwner="other";}}],
  ["CAS detecta cambio remoto concurrente",{beforeUpdate:rows=>{rows[0].cat="super";}}]
])await check(name+": no acredita éxito",async()=>{
  const s=fixture(),p=plan(s),c=client(s,opts);await assert.rejects(()=>run(c,s,p));
});
for(const where of ["remoto","local"])for(const phase of ["beforeUpdate","afterUpdate"])await check("partner "+where+" cambia en "+phase+": conserva ACK, no revierte ni reofrece",async()=>{
  const s=fixture(),p=plan(s),c=client(s,{[phase]:(rows,state)=>{
    if(where==="remoto")rows[1].cat="otros";else state.expenses[1].amount=-81;
  }});
  const ack=await run(c,s,p);
  assert.equal(ack.ownTransferPeerChanged,true);assert.equal(ack.cat,"traspaso");
  assert.equal(ack.id,p.outgoing.id);assert.equal(ack.user_id,owner);
  assert.equal(c.ops.length,1);assert.equal(c.rows[0].cat,"traspaso","el UPDATE saliente ya quedó hecho");
  if(where==="remoto")assert.equal(c.rows[1].cat,"otros","sin escritura compensatoria sobre el partner");
  assert.equal(s.expenses[0].category,"otros","antes de conciliar ACK local");
  const next=ctx.applyOwnTransferDecision(s,p,"yes",100,ack);
  assert.equal(next.expenses[0].category,"traspaso");assert.equal(next.expenses[1],s.expenses[1]);
  assert.equal(plan(next),null,"la salida confirmada no vuelve a ofrecerse");
  assert.equal(Object.hasOwn(next.expenses[0],"ownTransferPeerChanged"),false,"la advertencia es transitoria del ACK");
  assert.equal(Object.hasOwn(c.rows[0],"ownTransferPeerChanged"),false,"la advertencia nunca se escribe en la tabla");
});
await check("ACK confirmado permite conciliar pese al partner cambiado, nunca otra salida u owner",()=>{
  const s=fixture(),p=plan(s),ack={...row(s.expenses[0]),cat:"traspaso",ownTransferPeerChanged:true};
  s.expenses[1].category="otros";
  assert.equal(ctx.applyOwnTransferDecision(s,p,"yes",100),s,"sin ACK sigue exigiendo pareja actual");
  assert.equal(ctx.applyOwnTransferDecision(s,p,"yes",100,ack).expenses[0].category,"traspaso");
  for(const patch of [{id:uuid(9)},{user_id:"other"},{importe:81},{cat:"otros"}])
    assert.equal(ctx.applyOwnTransferDecision(s,p,"yes",100,{...ack,...patch}),s);
  s.expenses[0].amount=81;assert.equal(ctx.applyOwnTransferDecision(s,p,"yes",100,ack),s);
});

const sourcePatchMatch=core.match(/async function expenseSourcePatch\(sdk,owner,e,patch,snapshot\)\{([\s\S]*?)\n\}/);
assert.ok(sourcePatchMatch,"helper de source presente");
const sourcePatch=vm.runInContext("(function(){const obConfirmedCanUpload=async()=>true;return "+sourcePatchMatch[0]+";})()",ctx);
ctx.__ownTransferSourcePatch=sourcePatch;
function sourceWriter(name){
  const found=core.match(new RegExp("async "+name+"\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n    \\},"));
  assert.ok(found,"writer real "+name);
  return vm.runInContext("(async function("+found[1]+") {const sb=globalThis.__ownTransferSb;const obConfirmedCanUpload=async()=>true;const expenseSourcePatch=globalThis.__ownTransferSourcePatch;"+found[2]+"\n})",ctx);
}
await check("caller real setCuota recupera NO concurrente y confirma vínculo remoto/local",async()=>{
  const s=fixture();s.debts=[{id:"fixture-debt",name:"Préstamo sintético",monthly:80}];
  let first=true;const c=client(s,{beforeUpdate:rows=>{if(first){first=false;rows[0].source=ctx.expenseSourceForCloud({...s.expenses[0],ownTransferRejected:true});}}});
  ctx.__ownTransferSb=c.sb;ctx.__realDebtWriter=sourceWriter("setExpenseDeuda");ctx.__callerState=s;ctx.__callerPromises=[];ctx.__callerToasts=[];
  const ui=fs.readFileSync("src/modules/04-tab-gastos.js","utf8"),body=ui.match(/const setCuota=function\(ex,debtId\)\{[\s\S]*?\n  \};/)[0];
  const action=ui.match(/const runSourceAction=async function\(ex,write,apply,success\)\{[\s\S]*?\n  \};/)[0];
  const caller=vm.runInContext('(function(){const state=globalThis.__callerState,withdrawalState={current:state},sourceActionPending={current:{}};const setSourceActionStatus=s=>{globalThis.__callerStatus=s;};const set=f=>{globalThis.__callerState=f(globalThis.__callerState);};const showToast=x=>globalThis.__callerToasts.push(x);const cloud={enabled:()=>true,setExpenseDeuda:e=>{const p=globalThis.__realDebtWriter(e);globalThis.__callerPromises.push(p);return p;}};'+action+body+'return setCuota;})()',ctx);
  await caller(s.expenses[0],"fixture-debt");await Promise.all(ctx.__callerPromises);
  const remote=ctx.expenseFromRow(c.rows[0]),local=ctx.__callerState.expenses[0];
  assert.equal(remote.debtId,"fixture-debt");assert.equal(remote.category,local.category);assert.equal(remote.debtManual,local.debtManual);
  assert.equal(remote.ownTransferRejected,true);assert.equal(c.ops.length,2);assert.equal(ctx.__callerToasts.length,1);
});
for(const [name,arg,localPatch,expected] of [
  ["setExpenseBank","caixabank",{}, {ent:"caixabank"}],
  ["setExpenseDup",true,{}, {possibleDup:true}],
  ["setExpenseCat","super",{debtId:"fixture-debt",category:"deudas"}, {category:"super",debtId:undefined}],
  ["setExpenseDeuda",undefined,{debtId:"fixture-debt"}, {category:"deudas",debtId:"fixture-debt"}],
  ["setExpenseRecibo",undefined,{reciboId:"fixture-receipt"}, {reciboId:"fixture-receipt"}]
])await check(name+": writer real conserva NO remoto aunque local aún no lo conoce",async()=>{
  const s=fixture();Object.assign(s.expenses[0],localPatch,{obOrd:2});const e=s.expenses[0],c=client(s);
  c.rows[0].source=ctx.expenseSourceForCloud({...e,ownTransferRejected:true});
  if(name==="setExpenseRecibo")c.rows[0].source=ctx.expenseSourceForCloud({...e,reciboId:undefined,ownTransferRejected:true});
  const initial=plain(c.rows[0]),peer=plain(c.rows[1]);ctx.__ownTransferSb=c.sb;
  await sourceWriter(name)(e,arg);
  assert.equal(c.ops.length,1);assert.equal(c.ops[0].table,"expenses");
  assert.match(c.rows[0].source,/#ownno(?:#|$)/);assert.match(c.rows[0].source,/#n2$/);
  assert.equal((c.rows[0].source.match(/#ownno/g)||[]).length,1);
  const decoded=ctx.expenseFromRow(c.rows[0]);assert.equal(decoded.ownTransferRejected,true);
  for(const [key,value] of Object.entries(expected))assert.equal(decoded[key],value,key);
  for(const key of ["user_id","id","source"])
    assert.ok(c.ops[0].filters.some(([k,v])=>k===key&&v===initial[key]),"CAS source "+key);
  for(const key of ["user_id","id","fecha","importe","comercio"])assert.equal(c.rows[0][key],initial[key]);
  assert.deepEqual(c.rows[1],peer);
});
await check("source helper conserva patch ajeno y marca antes del ordinal sin duplicarla",async()=>{
  const s=fixture(),e={...s.expenses[0],ownTransferRejected:true,obOrd:3},c=client(s);
  c.rows[0].source=ctx.expenseSourceForCloud(e);
  const result=await sourcePatch(c.sb,owner,e,{source:c.rows[0].source,cat:"super",no_card:true});
  assert.equal(result.error,null);assert.equal(result.data.length,1);
  assert.equal(c.rows[0].cat,"super");assert.equal(c.rows[0].no_card,true);
  assert.match(c.rows[0].source,/#ownno#n3$/);assert.equal((c.rows[0].source.match(/#ownno/g)||[]).length,1);
});
await check("NO concurrente antes del CAS: relectura y único retry conserva marca y acción",async()=>{
  const s=fixture(),e=s.expenses[0];
  const c=client(s,{beforeUpdate:rows=>{rows[0].source=ctx.expenseSourceForCloud({...e,ownTransferRejected:true});}});
  const result=await sourcePatch(c.sb,owner,e,{source:ctx.expenseSourceForCloud({...e,possibleDup:true})});
  assert.equal(result.error,null);assert.equal(result.data.length,1);assert.equal(c.ops.length,2);
  assert.equal(c.rows[0].source,ctx.expenseSourceForCloud({...e,possibleDup:true,ownTransferRejected:true}));
  assert.equal(ctx.expenseFromRow(c.rows[0]).possibleDup,true);
});
await check("límite cliente antiguo: escritura sin CAS borra NO y un dispositivo limpio vuelve a ofrecer",async()=>{
  const s=fixture(),e=s.expenses[0],c=client(s);
  c.rows[0].source=ctx.expenseSourceForCloud({...e,ownTransferRejected:true});
  const freshBefore={...s,expenses:c.rows.map(r=>ctx.expenseFromRow(r))};assert.equal(plan(freshBefore),null);
  // Equivalente exacto del writer antiguo: source reconstruido desde la copia local vieja.
  await c.sb.from("expenses").update({source:ctx.expenseSourceForCloud(e)}).eq("user_id",owner).eq("id",e.id).select("id");
  assert.doesNotMatch(c.rows[0].source,/#ownno(?:#|$)/);
  const freshAfter={...s,expenses:c.rows.map(r=>ctx.expenseFromRow(r))};assert.ok(plan(freshAfter));
});
await check("recibo conserva NO concurrente: su CAS no escribe el source antiguo",async()=>{
  const s=fixture(),e={...s.expenses[0],reciboId:"fixture-receipt"};
  const c=client(s,{beforeUpdate:rows=>{rows[0].source=ctx.expenseSourceForCloud({...s.expenses[0],ownTransferRejected:true});}});
  ctx.__ownTransferSb=c.sb;await sourceWriter("setExpenseRecibo")(e);
  assert.equal(c.ops.length,2);assert.match(c.rows[0].source,/#ownno(?:#|$)/);
  assert.equal(ctx.expenseFromRow(c.rows[0]).reciboId,"fixture-receipt");
});
for(const decision of ["yes","no"])await check("eco de nube adelanta ACK "+decision+" sin producir falso error",async()=>{
  const s=fixture(),p=plan(s),c=client(s,{afterUpdate:(_rows,current)=>Object.assign(current.expenses[0],decision==="yes"?{category:"traspaso"}:{ownTransferRejected:true})});
  const ack=await run(c,s,p,decision);assert.ok(ack);
  const reconciled=ctx.applyOwnTransferDecision(s,p,decision,100,ack);
  assert.equal(reconciled.expenses[0].category,decision==="yes"?"traspaso":"otros");
  assert.equal(!!reconciled.expenses[0].ownTransferRejected,decision==="no");assert.equal(plan(reconciled),null);
});
console.log("own-transfer-confirm: "+count+" casos OK");
