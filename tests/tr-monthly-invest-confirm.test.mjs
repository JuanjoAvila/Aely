import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { createLogicSandbox } from "../scripts/load-pure-logic.mjs";

const root=new URL("../",import.meta.url), order=JSON.parse(fs.readFileSync(new URL("src/build-order.json",root)));
const base="ea4a04efa82444f8ff3a2588aa3867205e3d772e";
const rematesBase=process.argv.includes("--remates-base"),rematesOnly=process.argv.includes("--remates-only"),rematesFocus=process.argv.find(x=>x.startsWith("--remates-focus="))?.split("=")[1];
const prHead="6a0749c351916e2bc097094817b157beb6be8fe0";
const sourceFile=p=>rematesBase?execFileSync("git",["show",prHead+":"+p],{cwd:new URL(".",root),maxBuffer:8e6}).toString():fs.readFileSync(new URL(p,root),"utf8");
let now=Date.parse("2026-11-04T12:00:00Z"), count=0;
function context(original=false,extra={}){
  const disk=new Map(), storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,String(v)),removeItem:k=>disk.delete(k)};
  const source=order.map(f=>original?execFileSync("git",["show",base+":src/modules/"+f],{cwd:new URL(".",root),maxBuffer:8e6}).toString():sourceFile("src/modules/"+f)).join("\n");
  const c=createLogicSandbox({localStorage:storage,Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}},...extra});
  c.window.localStorage=storage; vm.createContext(c);const end=source.indexOf("\nclass ErrorBoundary");assert.ok(end>0);
  vm.runInContext(source.slice(0,end),c);return {c,disk,storage};
}
const {c,disk,storage}=context();
const id="550e8400-e29b-41d4-a716-446655440000", owner="monthly-synthetic-owner";
const tx=(extra={})=>({ent:"trade_republic",acc:"tr-synthetic",id:"monthly-ref",date:"2026-11-03",amount:50,merchant:"Movimiento",note:"Plan de inversión Vanguard FTSE All-World",card:false,status:"BOOK",...extra});
const expense=(extra={})=>({id,date:"2026-11-03T12:00:00.000Z",amount:50,merchant:"Movimiento",obName:"Movimiento",note:tx().note,category:"otros",source:"ob",ent:"trade_republic",obAcc:"tr-synthetic",extId:"monthly-ref",...extra});
const state=(extra={})=>({user:{id:owner},_historyOwner:owner,accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:950}],settings:{expenseBanks:["trade_republic"]},expenses:[expense()],bankTx:[tx()],investments:[{id:"fund",ent:"trade_republic",name:"Vanguard FTSE All-World",shares:10.5,value:1050,cost:950,cur:"EUR"}],trRewardsTotal:0,fixed:[],debts:[],oneoffs:[],flows:[],deleted:[],...extra});
const remote=(e=expense())=>({id:e.id,user_id:owner,fecha:e.date,importe:e.amount,comercio:e.merchant,source:c.expenseSourceForCloud(e),cat:e.category,nota:e.note??null,ob_name:e.obName??null});
const plain=v=>JSON.parse(JSON.stringify(v));
async function check(name,fn){if(rematesOnly&&!name.startsWith("remate "))return;if(rematesFocus&&!name.startsWith("remate "+rematesFocus))return;if(process.argv.includes("--writer-cancel-only")&&!name.startsWith("writer guardia diferida:"))return;if(process.argv.includes("--writer-only")&&!name.startsWith("writer "))return;await fn();count++;console.log("PASS "+name);}
if(process.argv.some(x=>x.startsWith("--business-ab-"))){
  const original=process.argv.includes("--business-ab-base"),loaded=original?context(true):{c,disk,storage};
  now=Date.parse("2026-12-04T12:00:00Z");
  const s=state({expenses:[expense({category:"inversion"})],bankTx:[]});
  s.settings.trMonthlyInvestRecognition={schema:1,owner,ent:"trade_republic",acc:"tr-synthetic",cents:5000,purpose:{field:"note",value:"plan de inversión vanguard ftse all-world"},confirmedAt:Date.parse("2026-11-04T12:00:00Z"),confirmedRowId:id,enabled:true};s.settings.brokersOn=["trade_republic"];
  loaded.storage.setItem("micartera_v3",JSON.stringify(s));loaded.storage.setItem("micartera_v3_exp",JSON.stringify(s.expenses));
  const t=tx({id:"dec-ref",date:"2026-12-03"});
  const links=[{aspsp:"Trade Republic",ok:true,accounts:[{uid:"tr-synthetic",ok:true,balances:[],transactions:[{...t,ext_id:t.id}]}]}];
  const n=pipeline(loaded.c,original)(plain(s),links,now,[]),e=n.expenses.find(x=>x.extId==="dec-ref");
  console.log(JSON.stringify({source:original?base:"private candidate",observed:{category:e.category,budgetCents:loaded.c.expenseCountsBudget(e,n)?5000:0,investmentValueCents:Math.round(n.investments[0].value*100)},required:{category:"inversion",budgetCents:0,investmentValueCents:105000}}));
  assert.equal(e.category,"inversion","business oracle: accepted semantic monthly contribution is an investment");assert.equal(loaded.c.expenseCountsBudget(e,n),false);assert.deepEqual(plain(n.investments),plain(s.investments));process.exit(0);
}
await check("propuesta no cambia dinero ni configura monthlyInvest",()=>{const s=state(),before=JSON.stringify(s);assert.ok(c.trMonthlyProposal(s,s.expenses[0],now));assert.equal(JSON.stringify(s),before);});
await check("céntimos exactos sin tolerancia ni abs",()=>{for(const [n,v]of [[50,5000],[49.99,4999],[50.01,5001],[49.999,null],[-50,null],[Infinity,null]])assert.equal(c.trMonthlyCents(n),v);});
for(const [label,patch]of [["refund",{amount:-50}],["pendiente",{status:"PDNG"}],["unknown",{status:""}],["tarjeta",{card:true}],["MCC5411",{mcc:"5411"}],["día6",{date:"2026-11-06"}],["futuro",{date:"2026-12-03"}]])await check("no propuesta: "+label,()=>{const t=tx(patch),e=expense({amount:t.amount,date:t.date+"T12:00:00.000Z"});assert.equal(c.trMonthlyProposal(state({expenses:[e],bankTx:[t]}),e,now),null);});
await check("ambiguos y propósito editado se rechazan",()=>{const s=state();s.bankTx.push(tx());assert.equal(c.trMonthlyProposal(s,s.expenses[0],now),null);assert.equal(c.trMonthlyProposal(state(),expense({noteEdited:true}),now),null);});
await check("confirmar solo cambia una categoría, nunca participaciones/cuota/caja",()=>{const s=state(),other=expense({id:"550e8400-e29b-41d4-a716-446655440001",amount:12});s.expenses.push(other);const n=c.trMonthlyConfirmed(s,s.expenses[0],{...remote(),cat:"inversion"},now);assert.equal(n.expenses[0].category,"inversion");assert.equal(n.expenses[1],other);for(const k of ["accounts","investments","fixed","debts","flows","trRewardsTotal"])assert.equal(n[k],s[k]);assert.equal(c.expenseCountsCash(n.expenses[0],n),c.expenseCountsCash(s.expenses[0],s));assert.equal(c.expenseCountsBudget(n.expenses[0],n),false);assert.equal(c.trMonthlyConfirmed(n,s.expenses[0],{...remote(),cat:"inversion"},now),n);assert.equal(n.settings.trMonthlyInvestRecognition.confirmedAt,now);});
await check("genérico acepta una fila pero no aprende regla",()=>{const e=expense({note:""}),s=state({expenses:[e],bankTx:[tx({note:""})]});const n=c.trMonthlyConfirmed(s,e,{...remote(e),cat:"inversion"},now);assert.equal(n.expenses[0].category,"inversion");assert.equal(n.settings.trMonthlyInvestRecognition,undefined);});
let confirmed;
await check("ACK y guardado partido durable antes del automatismo",()=>{const s=state();confirmed=c.trMonthlyConfirmed(s,s.expenses[0],{...remote(),cat:"inversion"},now);assert.equal(c.trMonthlySaveConfirmed(confirmed),true);assert.equal(JSON.parse(storage.getItem("micartera_v3_exp"))[0].category,"inversion");assert.equal(JSON.parse(storage.getItem("micartera_v3")).settings.trMonthlyInvestRecognition.confirmedAt,now);});
function pipeline(ctx,original=false){const text=original?execFileSync("git",["show",base+":src/modules/11-app-main.js"],{cwd:new URL(".",root)}).toString():fs.readFileSync(new URL("src/modules/11-app-main.js",root),"utf8");const normalized=text.replace(/\r\n/g,"\n");const start=normalized.indexOf("        const txs=flattenBankTx(links, prev.bankTx);"),end=normalized.indexOf("      });\n      // sube las importadas",start);assert.ok(start>0&&end>start);return vm.runInContext("(function(prev,links,at,dbLinks){"+normalized.slice(start,end)+"})",ctx);}
const link=t=>[{aspsp:"Trade Republic",ok:true,accounts:[{uid:"tr-synthetic",ok:true,balances:[],transactions:[{ext_id:t.id,...t}]}]}];
await check("A/B negocio: consentimientoNov4, BOOKsemánticoDec3 recibidoDec4",()=>{now=Date.parse("2026-12-04T12:00:00Z");const old=context(true),s=plain(confirmed),t=tx({id:"dec-ref",date:"2026-12-03"});s.bankTx=[];s.expenses=[];s.settings.brokersOn=["trade_republic"];const a=pipeline(old.c,true)(plain(s),link(t),now,[]);const b=pipeline(c)(plain(s),link(t),now,[]);const observed=n=>({category:n.expenses[0].category,budgetCents:c.expenseCountsBudget(n.expenses[0],n)?5000:0,investmentValueCents:Math.round(n.investments[0].value*100)});console.log("AB_BASE_BUSINESS_RED "+JSON.stringify(observed(a)));console.log("AB_CANDIDATE_BUSINESS_GREEN "+JSON.stringify(observed(b)));assert.equal(a.expenses[0].category,"otros");assert.equal(b.expenses[0].category,"inversion");assert.deepEqual(plain(b.investments),plain(s.investments));assert.equal(b.trRewardsTotal,s.trRewardsTotal);});
await check("confirmarNovantiguo enDic4 NO autorizaDic3 recuperado",()=>{const e=expense(),s=state();const late=c.trMonthlyConfirmed(s,e,{...remote(),cat:"inversion"},now);assert.ok(c.trMonthlySaveConfirmed(late));const t=tx({id:"late",date:"2026-12-03"}),n=expense({id:"550e8400-e29b-41d4-a716-446655440002",extId:"late",date:"2026-12-03T12:00:00Z"});assert.equal(c.trMonthlyImportPlan(late,[n],[t],now).changed.size,0);assert.ok(c.trMonthlySaveConfirmed(confirmed));});
await check("genérico igual nunca auto; cuenta/nota editadas tampoco",()=>{for(const patch of [{note:""},{acc:"other"},{note:"Plan de inversión Otro Fondo"},{card:true},{mcc:"5411"}]){const t=tx({id:"future",date:"2026-12-03",...patch}),n=expense({id:"550e8400-e29b-41d4-a716-446655440003",extId:t.id,date:t.date+"T12:00:00Z",note:t.note,obAcc:t.acc});assert.equal(c.trMonthlyImportPlan(confirmed,[n],[t],now).changed.size,0);}});
await check("pull distinto invalida, no mezcla finanzas ni reactiva permiso",()=>{const incoming=plain(confirmed);incoming.settings.trMonthlyInvestRecognition.confirmedAt--;const n=c.trMonthlyInvalidatePull(confirmed,incoming);assert.equal(n.settings.trMonthlyInvestRecognition.enabled,false);assert.equal(n.accounts,incoming.accounts);const again=c.trMonthlyInvalidatePull(n,incoming);assert.equal(again.settings.trMonthlyInvestRecognition.enabled,false);});
await check("días1y5 dentro,6 fuera sin cambiar ventana",()=>{now=Date.parse("2026-12-07T12:00:00Z");assert.ok(c.trMonthlySaveConfirmed(confirmed));for(const [day,allowed]of [["01",true],["05",true],["06",false]]){const t=tx({id:"day"+day,date:"2026-12-"+day}),e=expense({id:"550e8400-e29b-41d4-a716-446655440005",extId:t.id,date:t.date+"T12:00:00Z"});assert.equal(c.trMonthlyImportPlan(confirmed,[e],[t],now).changed.size,allowed?1:0);}});
await check("A=B legacyMCC5411 porimporte: deuda conservada, sin override",()=>{const old=context(true),s=state({expenses:[],bankTx:[]});s.accounts[0].monthlyInvest=50;s.accounts[0].rewardInv="fund";s.settings.brokersOn=["trade_republic"];const t=tx({id:"legacy",date:"2026-12-03",mcc:"5411",card:true,merchant:"Tienda Sintetica"}),a=pipeline(old.c,true)(plain(s),link(t),now,[]),b=pipeline(c)(plain(s),link(t),now,[]);assert.equal(a.expenses[0].category,"inversion");assert.equal(b.expenses[0].category,a.expenses[0].category);assert.deepEqual(plain(b.investments),plain(a.investments));console.log("AB_LEGACY_PRESERVED inversion/inversion; virtual purchase unchanged");});
await check("fallo de disco no acredita guardar",()=>{const save=storage.setItem;storage.setItem=()=>{throw Error("quota");};disk.clear();assert.equal(c.trMonthlySaveConfirmed(confirmed),false);storage.setItem=save;});

const core=sourceFile("src/modules/00-core.js"), body=core.match(/async confirmTrMonthlyInvestment\(e, readState\)\{([\s\S]*?)\n    \},/)[1];
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const method=new AsyncFunction("Date","sb","isExpenseUuid","trMonthlyProposal","trMonthlyRowMatches","obConfirmedCanUpload","e","readState",body);
function client(opts={}){const data=plain(opts.row||remote()),ops=[];let sessions=0;return {ops,sb:{auth:{getSession:async()=>{sessions++;if(opts.onSession)await opts.onSession(sessions);return {data:{session:opts.noSession?null:{user:{id:opts.switchSession&&sessions>1?"other":owner}}}};}},from(table){let patch=null;const filters=[];const q={select(v){ops.push(["select",v]);return q;},eq(k,v){assert.notEqual(v,null,"eq null forbidden");filters.push(["eq",k,v]);return q;},is(k,v){filters.push(["is",k,v]);return q;},update(v){ops.push(["update-call",table,v]);patch=v;return q;},async maybeSingle(){return {data:opts.missing?null:plain(data),error:opts.readError?Error("read"):null};},then(resolve){ops.push(["update",table,patch,filters]);return resolve({data:opts.zero?[]:opts.multi?[{...data,...patch},{...data,...patch}]:opts.ack||[{...data,...patch}],error:opts.error?Error("write"):null});}};return q;}}};}
const run=(cl,e=expense(),read=()=>state(),canUpload=async()=>true)=>method(c.Date,cl.sb,c.isExpenseUuid,c.trMonthlyProposal,c.trMonthlyRowMatches,canUpload,e,read);
now=Date.parse("2026-11-04T12:00:00Z");
await check("writer UUID+titular y CAS completo; solo cat",async()=>{const cl=client(),ack=await run(cl);assert.equal(ack.cat,"inversion");const op=cl.ops.find(x=>x[0]==="update");assert.deepEqual(op[2],{cat:"inversion"});for(const k of ["user_id","id","fecha","importe","comercio","source","cat","nota","ob_name","no_card","nota_edit","ingest_event_id"])assert.ok(op[3].some(x=>x[1]===k),k);});
await check("writer usa is(null)",async()=>{const e=expense({note:undefined,obName:undefined}),s=state({expenses:[e],bankTx:[tx({note:""})]}),cl=client({row:remote(e)});await run(cl,e,()=>s);const op=cl.ops.find(x=>x[0]==="update");assert.ok(op[3].some(x=>x[0]==="is"&&x[1]==="nota"));});
for(const [name,opts]of [["zero",{zero:true}],["multi",{multi:true}],["write error",{error:true}],["read error",{readError:true}],["missing",{missing:true}],["logout",{noSession:true}],["session changed",{switchSession:true}],["amount stale",{row:{...remote(),importe:51}}],["purpose stale",{row:{...remote(),nota:"Otro"}}],["other owner",{row:{...remote(),user_id:"other"}}],["card flag stale",{row:{...remote(),no_card:true}}],["note flag stale",{row:{...remote(),nota_edit:true}}],["native identity stale",{row:{...remote(),ingest_event_id:"other"}}],["other ACK",{ack:[{...remote(),id:"other",cat:"inversion"}]}]])await check("writer failclosed: "+name,async()=>{await assert.rejects(()=>run(client(opts)));});
await check("writer cancela antes de UPDATE al cambiar fila",async()=>{let n=0;const cl=client();await assert.rejects(()=>run(cl,expense(),()=>++n>1?state({expenses:[]}):state()));assert.ok(!cl.ops.some(x=>x[0]==="update"));});
function deferred(){let resolve;const promise=new Promise(function(done){resolve=done;});return {promise,resolve};}
for(const scenario of ["timeout10s","fila cambiada","titular cambiado","vigente"])await check("writer guardia diferida: "+scenario,async()=>{
  const entered=deferred(),gate=deferred(),token={active:true};let current=state();
  // Se detiene el getSession real de obConfirmedCanUpload, después de las dos lecturas del writer.
  const cl=client({onSession:async function(n){if(n===3){entered.resolve();await gate.promise;}}});
  const pending=run(cl,expense(),function(){return token.active?current:null;},c.obConfirmedCanUpload);
  await entered.promise;
  assert.equal(cl.ops.filter(x=>x[0]==="update-call").length,0,"no construir UPDATE con la guardia pendiente");
  if(scenario==="timeout10s"){now+=10000;token.active=false;}
  if(scenario==="fila cambiada")current=state({expenses:[expense({amount:51})]});
  if(scenario==="titular cambiado")current=state({user:{id:"other"}});
  gate.resolve();
  if(scenario==="vigente")assert.equal((await pending).cat,"inversion");else await assert.rejects(()=>pending);
  const constructed=cl.ops.filter(x=>x[0]==="update-call").length,sent=cl.ops.filter(x=>x[0]==="update").length,expected=scenario==="vigente"?1:0;
  console.log("DEFERRED_GUARD "+JSON.stringify({scenario,expectedUpdates:expected,constructed,sent,realQueries:0}));
  assert.equal(constructed,expected,"la confirmación invalidada durante la guardia no construye UPDATE");assert.equal(sent,expected);
});
await check("sandbox corta el writer nuevo antes de consultas",async()=>{const list=vm.runInContext("CLOUD_WRITES",c);assert.ok(list.includes("confirmTrMonthlyInvestment"));vm.runInContext("mcSandbox=function(){return true;}",c);assert.equal(await vm.runInContext("cloud.confirmTrMonthlyInvestment(null,function(){throw Error('must not call');})",c),null);});
await check("test y predicados legacy permanecen exactos",()=>{const old=execFileSync("git",["show",base+":tests/bank-merchant-category.test.mjs"],{cwd:new URL(".",root)});assert.equal(fs.readFileSync(new URL("tests/bank-merchant-category.test.mjs",root),"utf8").replace(/\r\n/g,"\n"),old.toString());const text=fs.readFileSync(new URL("src/modules/08-motor-bank.js",root),"utf8"),prior=execFileSync("git",["show",base+":src/modules/08-motor-bank.js"],{cwd:new URL(".",root)}).toString();for(const token of ["const esAporteInv =","const esAporte=!!(daily"]){const line=s=>s.split("\n").find(x=>x.includes(token)).trim();assert.equal(line(text),line(prior));}});
// Remates de PR339: --remates-base ejecuta los mismos oráculos contra su HEAD previo inmutable.
const reordered=v=>Array.isArray(v)?v.map(reordered):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).reverse().map(k=>[k,reordered(v[k])])):v;
function consent(ctx,amount=50){
  now=Date.parse("2026-11-04T12:00:00Z");
  const e=expense({amount}),s=state({expenses:[e],bankTx:[tx({amount})]}),n=ctx.c.trMonthlyConfirmed(s,e,{...remote(e),cat:"inversion"},now);
  assert.equal(n.expenses[0].category,"inversion");assert.ok(ctx.c.trMonthlySaveConfirmed(n));return n;
}
function future(amount=50,patch={}){
  now=Date.parse("2026-12-04T12:00:00Z");const t=tx({id:"future-remate",date:"2026-12-03",amount,...patch});
  return {t,e:expense({id:"550e8400-e29b-41d4-a716-446655440099",extId:t.id,date:t.date+"T12:00:00.000Z",amount,note:t.note,obAcc:t.acc})};
}
await check("remate canonical pull jsonb reordenado conserva permiso y reconocimiento",()=>{
  const ctx=context(),s=consent(ctx),incoming=reordered(plain(s)),n=ctx.c.trMonthlyInvalidatePull(s,incoming);
  assert.equal(n.settings.trMonthlyInvestRecognition.enabled,true,"reordenar claves anidadas no revoca consentimiento");
  const {e,t}=future();assert.equal(ctx.c.trMonthlyImportPlan(n,[e],[t],now).changed.size,1);
});
await check("remate canonical guardado y propósito durable reordenados",()=>{
  const ctx=context(),s=consent(ctx),write=ctx.storage.setItem;
  ctx.storage.setItem=(k,v)=>write(k,k==="micartera_v3"?JSON.stringify(reordered(JSON.parse(v))):v);
  assert.equal(ctx.c.trMonthlySaveConfirmed(s),true,"el readback durable admite orden jsonb");
  const {e,t}=future();assert.equal(ctx.c.trMonthlyImportPlan(s,[e],[t],now).changed.size,1,"regla y purpose se comparan canónicamente");
});
await check("remate canonical diferencias reales no reactivan permiso",()=>{
  const ctx=context(),s=consent(ctx);
  for(const patch of [{owner:"other"},{cents:4999},{confirmedAt:now-1},{enabled:false},{purpose:{field:"note",value:"otro destino"}}]){
    const n=plain(s);Object.assign(n.settings.trMonthlyInvestRecognition,patch);
    assert.equal(ctx.c.trMonthlyInvalidatePull(s,n).settings.trMonthlyInvestRecognition.enabled,false);
    const {e,t}=future();assert.equal(ctx.c.trMonthlyImportPlan(n,[e],[t],now).changed.size,0);
  }
});
await check("remate amount confirmado7327 y recurrencia exacta sin compra",()=>{
  const ctx=context(),s=consent(ctx,73.27);assert.equal(s.settings.trMonthlyInvestRecognition.cents,7327);
  const before=plain(s.investments),balances=plain(s.accounts),{e,t}=future(73.27),n=ctx.c.trMonthlyImportPlan(s,[e],[t],now);
  assert.equal(n.changed.size,1);assert.equal(n.rows[0].category,"inversion");assert.deepEqual(plain(s.investments),before);assert.deepEqual(plain(s.accounts),balances);
  for(const amount of [73.26,73.28,50]){const f=future(amount);assert.equal(ctx.c.trMonthlyImportPlan(s,[f.e],[f.t],now).changed.size,0,"importe distinto al confirmado");}
});
await check("remate amount fila y transacción discrepantes por1cent no proponen",()=>{
  now=Date.parse("2026-11-04T12:00:00Z");for(const amount of [73.26,73.28]){
    const e=expense({amount:73.27}),s=state({expenses:[e],bankTx:[tx({amount})]});assert.equal(c.trMonthlyProposal(s,e,now),null);
  }
});
await check("remate pipeline importe7327 clasifica sin compra virtual duplicada",()=>{
  const ctx=context(),s=consent(ctx,73.27),{t}=future(73.27);s.bankTx=[];s.expenses=[];s.settings.brokersOn=["trade_republic"];
  const before=plain(s),n=pipeline(ctx.c)(s,link(t),now,[]);
  assert.equal(n.expenses.find(e=>e.extId===t.id).category,"inversion");
  assert.deepEqual(plain(n.investments),before.investments);assert.equal(n.trRewardsTotal,before.trRewardsTotal);
});
await check("remate amount writer CAS y ACK usan7327 sin importe fijo",async()=>{
  now=Date.parse("2026-11-04T12:00:00Z");const e=expense({amount:73.27}),s=state({expenses:[e],bankTx:[tx({amount:73.27})]}),cl=client({row:remote(e)});
  assert.equal((await run(cl,e,()=>s)).importe,73.27);
  assert.ok(cl.ops.find(x=>x[0]==="update")[3].some(x=>x[1]==="importe"&&x[2]===73.27));
  await assert.rejects(()=>run(client({row:remote(e),ack:[{...remote(e),importe:73.28,cat:"inversion"}]}),e,()=>s));
});
await check("remate isin aislado exige formato y control sin fallback semántico",()=>{
  const s=state({investments:[]});assert.ok(c.trMonthlyPurpose(s,tx({note:"IE00B3RBWM25"})),"ISIN válido");
  for(const value of ["IE00B3RBWM24","IE00B3RBWM2X","I000B3RBWM25","IE00B3RBWM255","XX0000000001"]){assert.equal(c.trMonthlyPurpose(s,tx({note:value})),null,value);}
});
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function controlledClock(){
  let seq=0;const timers=new Map();
  return {setTimeout(fn,ms){const id=++seq;timers.set(id,{fn,at:now+ms});return id;},clearTimeout(id){timers.delete(id);},async advance(ms){now+=ms;for(const[id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn();}await flush();}};
}
function timeoutHarness(){
  now=Date.parse("2026-11-04T12:00:00Z");const clock=controlledClock(),ctx=context(false,clock),cc=ctx.c,network=deferred(),sent=deferred();
  const api={stateRef:{current:state({_fixMovInvasion2:true,gemelos:[],obAbsorbedPending:[],obAbsorbedConfirmed:[],lastSync:1})},sessionRef:{current:{user:{id:owner}}},server:remote(),updateCalls:0,updates:0,exactAcks:0,acceptedAcks:0,genericUpserts:0,upsertConflicts:0,reads:0,writes:[],backfills:[],failRead:false,readGate:null};
  const sdk={auth:{getSession:async()=>({data:{session:api.sessionRef.current},error:null})},from(table){
    assert.equal(table,"expenses");let patch=null,upsert=null;const filters=[];
    const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},is(k,v){filters.push([k,v]);return q;},update(v){api.updateCalls++;patch=v;return q;},upsert(row,options){assert.deepEqual(options,{onConflict:'user_id,fecha,importe,comercio',ignoreDuplicates:true});upsert=row;return q;},async maybeSingle(){return {data:plain(api.server),error:null};},then(resolve,reject){
      if(upsert){api.genericUpserts++;assert.equal(upsert.id,api.server.id,"backfill conserva UUID");api.upsertConflicts++;return Promise.resolve({data:null,error:{code:"23505",message:"synthetic existing primary key"}}).then(resolve,reject);}
      api.updates++;sent.resolve();return network.promise.then(function(){const matches=filters.every(([k,v])=>(api.server[k]??null)===(v??null));if(matches){Object.assign(api.server,patch);api.exactAcks++;}return {data:matches?[plain(api.server)]:[],error:null};}).then(resolve,reject);
    }};return q;
  }};
  const cloud=vm.runInContext("cloud",cc);
  cloud.confirmTrMonthlyInvestment=(e,read)=>method(cc.Date,sdk,cc.isExpenseUuid,cc.trMonthlyProposal,cc.trMonthlyRowMatches,cc.obConfirmedCanUpload,e,read).then(ack=>{api.acceptedAcks++;return ack;});
  const addBody=core.match(/async addExpense\(e\)\{([\s\S]*?)\n    \},/)[1],add=new AsyncFunction("sb","obConfirmedCanUpload","expenseSourceForCloud","isExpenseUuid","withNotaFallback","e",addBody);
  cloud.enabled=()=>true;cloud.addExpense=e=>add(sdk,cc.obConfirmedCanUpload,cc.expenseSourceForCloud,cc.isExpenseUuid,cc.withNotaFallback,e);cloud.logEvent=()=>Promise.resolve();
  cloud.pullExpenses=async proof=>{api.reads++;const rows=api.server.user_id===api.sessionRef.current?.user?.id?[plain(api.server)]:[];if(api.readGate)await api.readGate.promise;if(api.failRead)throw Error("synthetic offline");proof.valid=true;proof.userId=api.sessionRef.current.user.id;return rows;};
  cloud.pullState=async()=>null;
  for(const name of ["setExpenseCat","setExpenseRecibo","setExpenseDup"])cloud[name]=async(...args)=>{api.writes.push([name,...args]);return 0;};
  const realBackfill=cc.subirGasto;cc.subirGasto=(...args)=>{api.writes.push(["backfill",...args]);const p=realBackfill(...args);api.backfills.push(p);return p;};
  vm.runInContext("mcSandbox=function(){return false;};natPlugin=function(){return null;};",cc);
  const refs=[];const set=fn=>{api.stateRef.current=fn(api.stateRef.current);if(refs[1])refs[1].current=api.stateRef.current;};
  const gast=sourceFile("src/modules/04-tab-gastos.js"),a=gast.indexOf("  const monthlyPending=useRef({})"),z=gast.indexOf("  const withdrawalPending=useRef({});",a);assert.ok(a>0&&z>a);
  const deps={state:api.stateRef.current,useRef:v=>{const ref={current:v};refs.push(ref);return ref;},useState:()=>[null,v=>{api.status=v;}],trMonthlyProposal:cc.trMonthlyProposal,trMonthlyConfirmed:cc.trMonthlyConfirmed,trMonthlySaveConfirmed:cc.trMonthlySaveConfirmed,Date:cc.Date,askConfirm:async()=>true,t:x=>x,cloud,set,ReactDOM:{flushSync:fn=>fn()},showToast:()=>{},setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout};
  api.confirm=new Function(...Object.keys(deps),gast.slice(a,z)+"return confirmMonthlyInvestment;")(...Object.values(deps));
  const main=sourceFile("src/modules/11-app-main.js"),start=main.indexOf("  const syncCloudExpenses=function(){"),end=main.indexOf("\n  // Al iniciar sesión:",start);assert.ok(start>0&&end>start);
  const factory=vm.runInContext("(function(api,set){const stateRef=api.stateRef,sessionRef=api.sessionRef;const wR={current:false},wS={current:0},wP={current:null},wC={current:[]},wRead={current:null},wOwner={current:null};const retryObAbsorbedCloud=()=>Promise.resolve();"+main.slice(start,end)+"return syncCloudExpenses;})",cc);
  api.sync=factory(api,set);api.clock=clock;api.ctx=ctx;api.network=network;api.sent=sent;api.set=set;return api;
}
for(const scenario of ["lectura fallida luego válida","fila cambió antes de CAS","titular cambiado","respuesta vieja tras lectura nueva"])await check("remate timeout UPDATE enviado: "+scenario,async()=>{
  const h=timeoutHarness(),before=plain(h.stateRef.current);h.confirm(h.stateRef.current.expenses[0]);await h.sent.promise;
  assert.equal(h.updates,1,"UPDATE ya enviado antes del plazo");await h.clock.advance(10000);
  assert.equal(h.status.status,"error","Promise.race real de Gastos vence a10s");assert.equal(h.stateRef.current.expenses[0].category,"otros");
  assert.equal(h.stateRef.current.settings.trMonthlyInvestRecognition,undefined);
  if(scenario==="fila cambió antes de CAS")h.server.importe=51;
  h.network.resolve();await flush();
  assert.equal(h.server.cat,scenario==="fila cambió antes de CAS"?"otros":"inversion");
  if(scenario==="titular cambiado"){
    h.sessionRef.current={user:{id:"other"}};h.set(s=>({...s,user:{id:"other"},_historyOwner:"other",expenses:[]}));await h.sync();
    assert.equal(h.stateRef.current.expenses.length,0,"no importar la respuesta del titular anterior");
  }else if(scenario==="respuesta vieja tras lectura nueva"){
    // El GET viejo capturó la categoría anterior; el vuelo nuevo ve el UPDATE ya confirmado.
    const current=plain(h.server);h.server.cat="otros";h.readGate=deferred();const gate=h.readGate,old=h.sync();await flush();h.server=current;h.readGate=null;
    await h.clock.advance(25001);await h.sync();gate.resolve();await old;await flush();
    assert.equal(h.stateRef.current.expenses[0].category,"inversion","respuesta antigua no revierte convergencia");
  }else{
    h.failRead=true;await assert.rejects(h.sync(),/synthetic offline/);assert.equal(h.stateRef.current.expenses[0].category,"otros");
    h.failRead=false;await h.sync();assert.equal(h.stateRef.current.expenses[0].category,h.server.cat);assert.equal(h.stateRef.current.expenses[0].amount,h.server.importe);
  }
  const serverAfterCas=plain(h.server);await h.clock.advance(0);await Promise.all(h.backfills);assert.equal(h.updates,1,"siguiente lectura no repite UPDATE");assert.equal(h.updateCalls,1);assert.deepEqual(h.writes.filter(x=>x[0]!=="backfill"),[],"sin UPDATE genérico ciego");
  // El sync existente intenta backfill si cambió el importe remoto; conserva el MISMO UUID,
  // no compra participaciones ni emite un UPDATE de categoría para salvar el CAS perdido.
  assert.equal(h.writes.filter(x=>x[0]==="backfill").length,scenario==="fila cambió antes de CAS"?1:0);
  for(const w of h.writes)assert.equal(w[1].id,h.server.id);
  assert.deepEqual(h.server,serverAfterCas,"backfill existente no pisa importe ni categoría remotos");assert.equal(h.genericUpserts,h.writes.length);assert.equal(h.upsertConflicts,h.genericUpserts);
  assert.equal(h.acceptedAcks,0,"respuesta exacta tardía no equivale a ACK aceptado por el writer");
  assert.equal(h.stateRef.current.settings.trMonthlyInvestRecognition,undefined,"el timeout no acredita consentimiento durable");
  assert.deepEqual(plain(h.stateRef.current.investments),before.investments);assert.deepEqual(plain(h.stateRef.current.accounts),before.accounts);
  console.log("TIMEOUT_READ_CONVERGENCE "+JSON.stringify({scenario,updateCalls:h.updateCalls,updatesSent:h.updates,exactRowsReturned:h.exactAcks,acceptedAcks:h.acceptedAcks,reads:h.reads,backfillCalls:h.writes.length,genericUpserts:h.genericUpserts,primaryKeyConflicts:h.upsertConflicts,serverCategory:h.server.cat,serverAmount:h.server.importe,localCategory:h.stateRef.current.expenses[0]?.category,permission:false,realQueries:0}));
});
console.log("TOTAL "+count+" targeted checks; no real database queries");
