import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const source=fs.readFileSync("src/modules/16-help-assistant.js","utf8");
const ctx=vm.createContext({
  React:{createElement:()=>null,useState:()=>[null,()=>{}],useRef:()=>({current:0}),useEffect:()=>{}},
  useBackClose:()=>{}, useSheetSwipe:()=>({sheetRef:{},sheetTouch:{}}),
  t:(k)=>k, eur0:(n)=>String(Math.round(n))+"€", cloud:{enabled:()=>false}, CURLANG:"es",
});
vm.runInContext(source,ctx);
const local=q=>Array.from(ctx.helpLocalTopics(q));
const catalog=vm.runInContext("HELP_TOPICS.map(x=>x.id)",ctx);
const cues=vm.runInContext("HELP_CUES.slice()",ctx);
for(const [q,id] of [
  ["No sé poner el gasto en efectivo","cash"], ["MAPFRE es comida en la empresa","categories"],
  ["El ahorro para pagar el Audi","goals"], ["Me falta un recibo de la Caixa","receipts"],
  ["Importar histórico Sabadell","history"], ["No llega el pago de tarjeta","banks"],
  ["Com apunto els diners en efectiu?","cash"], ["I need help with a loan","debts"],
]) assert.ok(local(q).includes(id),q);
assert.deepEqual(local("¿Qué tiempo hace?"),[]);
assert.deepEqual(Array.from(ctx.helpValidatedTopics(["cash","cash","delete_all"])),[]);
assert.deepEqual(Array.from(ctx.helpValidatedTopics(["cash","cash"])),["cash"]);
assert.deepEqual(Array.from(ctx.helpValidatedTopics("cash")),[]);
assert.deepEqual(Array.from(ctx.helpValidatedTopics(["cash","banks","goals","debts"])),[]);
assert.equal(ctx.helpLocalIntent("¿Cuánto me queda este mes?"),"budget_left");
assert.equal(ctx.helpLocalIntent("¿Cómo cambio el presupuesto?"),null);
assert.equal(ctx.helpLocalIntent("¿cuántas cuotas me quedan este mes?"),null);
assert.equal(ctx.helpLocalIntent("¿Qué recibos me faltan?"),"next_bills");
assert.equal(ctx.helpLocalIntent("¿Llego a fin de mes?"),"end_of_month");
assert.equal(ctx.helpLocalIntent("¿Cuánto tengo en Sabadell?"),"account_balance");
assert.equal(ctx.helpLocalBank("saldo en caixa"),"caixabank");
assert.equal(ctx.helpLocalBank("bs de prueba"),null);
assert.ok(ctx.helpLooksSecret("ES91 2100 0418 4502"));
assert.ok(ctx.helpLooksSecret("DE89 3704 0044 0532 0130 00"));
assert.ok(ctx.helpLooksSecret("4111-1111-1111-1111"));
assert.ok(ctx.helpLooksSecret("mi PIN es 1234"));
assert.equal(ctx.helpValidatedCue("help_cue_cash"),"help_cue_cash");
assert.equal(ctx.helpValidatedCue("free prose"),null);
assert.equal(ctx.helpCueForTopic("cash","help_cue_debts"),"help_cue_cash");
assert.equal(ctx.helpCueForTopic("delete_all","help_cue_cash"),null);
ctx.t=()=>"Uno/nDos\\nTres";
assert.deepEqual(Array.from(ctx.helpStepLines("cash")),["Uno","Dos","Tres"],"normaliza packs cacheados que traigan /n o \\n");
const i18nSource=fs.readFileSync("src/modules/01-i18n.js","utf8");
const bodies=Array.from(i18nSource.matchAll(/help_(?:cash|goals|debts|banks|history|categories|receipts)_body:"([^"]*)"/g),m=>m[1]);
assert.equal(bodies.length,21,"siete guías por tres idiomas");
for(const raw of bodies){
  assert.equal(raw.includes("\\\\n"),false,"ninguna guía conserva el separador literal");
  const lines=JSON.parse('"'+raw+'"').split("\n");
  assert.equal(lines.length,3,"cada guía tiene tres pasos");
  assert.ok(lines.every(x=>x.length<=95),"cada paso sigue siendo corto");
}
assert.equal(ctx.helpCashWantsAccounts("¿dónde puedo añadir efectivo?"),true);
assert.equal(ctx.helpCashWantsAccounts("¿cómo añado dinero en efectivo?"),true);
assert.equal(ctx.helpCashWantsAccounts("¿dónde meto el efectivo?"),true);
assert.equal(ctx.helpCashWantsAccounts("¿dónde compruebo mi efectivo?"),true);
assert.equal(ctx.helpCashWantsAccounts("on puc afegir efectiu?"),true);
assert.equal(ctx.helpCashWantsAccounts("¿dónde apunto un gasto en efectivo?"),false);
assert.equal(ctx.helpCashWantsAccounts("where do I record a cash purchase"),false);
assert.equal(ctx.helpCashWantsAccounts("how do I add a cash expense"),false);
assert.equal(ctx.helpCashWantsAccounts("where do I add something I bought with cash"),false);
assert.equal(ctx.helpCashWantsAccounts("afegir una despesa en efectiu"),false);
assert.equal(ctx.helpCashWantsAccounts("he comprat amb efectiu, on ho poso?"),false);
assert.equal(ctx.helpCashWantsAccounts("compraste en efectivo, ¿dónde lo pongo?"),false);
assert.equal(ctx.helpCashWantsAccounts("I paid cash, where does it go"),false);
assert.equal(ctx.helpCashWantsAccounts("where do I put cash I paid with"),false);
assert.equal(ctx.helpCashWantsAccounts("where do I add cash I withdrew"),false);
assert.equal(ctx.helpCashWantsAccounts("he tret efectiu, on l'apunto"),false);
assert.equal(ctx.helpCashWantsAccounts("¿dónde saco efectivo?"),false);
assert.equal(ctx.helpCashWantsAccounts("where do I withdraw cash?"),false);
{
  const a=ctx.helpAnswerFromSnap("budget_left",{budget:1000,spent:250,remaining:750});
  assert.equal(a.cue,"help_cue_budget_left");
  const over=ctx.helpAnswerFromSnap("budget_left",{budget:1000,spent:1200,remaining:-200});
  assert.equal(over.cue,"help_cue_budget_over");
  assert.equal(over.vars.x,200);
  const unk=ctx.helpAnswerFromSnap("end_of_month",{mainProjected:null});
  assert.equal(unk.cue,"help_cue_end_unknown");
  const one=ctx.helpAnswerFromSnap("next_bills",{pendingCount:1,pendingTotal:40});
  assert.equal(one.cue,"help_cue_next_bills_one");
  const b=ctx.helpAnswerFromSnap("account_balance",{balances:{sabadell:1234},balanceCounts:{sabadell:1}},"sabadell");
  assert.equal(b.cue,"help_cue_balance");
  assert.equal(b.vars.x,1234);
  const many=ctx.helpAnswerFromSnap("account_balance",{balances:{sabadell:3000},balanceCounts:{sabadell:2}},"sabadell");
  assert.equal(many.cue,"help_cue_balance_many");
}
{
  // P1 re-QA: value (no bal); multi-cuenta → many. Sin saldoCuentaMostrada en vm → a.value.
  const snap=ctx.helpSnap(
    {accounts:[{id:"1",ent:"sabadell",value:2000},{id:"2",ent:"revolut",value:50}],budget:500},
    {pendingThisMonth:80,today:10,curMonth:9,curYear:2026}
  );
  assert.equal(snap.balances.sabadell,2000);
  assert.equal(snap.balanceCounts.sabadell,1);
  const ans=ctx.helpAnswerFromSnap("account_balance",snap,"sabadell");
  assert.equal(ans.cue,"help_cue_balance");
  assert.equal(ans.vars.x,2000);
  assert.equal(snap.pendingTotal,80);
  const manySnap=ctx.helpSnap(
    {accounts:[{id:"1",ent:"sabadell",value:1000},{id:"2",ent:"sabadell",value:500}]},
    {}
  );
  assert.equal(manySnap.balanceCounts.sabadell,2);
  assert.equal(manySnap.balances.sabadell,1500);
  assert.equal(ctx.helpAnswerFromSnap("account_balance",manySnap,"sabadell").cue,"help_cue_balance_many");
}
{
  // La cuota sin día sigue pendiente igual que en Plan: el motor histórico usa día 1 para
  // proyecciones, pero la UI no puede convertir ese fallback en un cobro ya confirmado.
  const app=loadPureLogicFromFile();
  const plain=app.pendingBillsSummary({fixed:[],debts:[{
    id:"sin-dia",name:"Préstamo",monthly:80,value:1000,account:"sabadell"
  }]},9,2026,24);
  assert.equal(plain.count,1);
  assert.equal(plain.total,80);

  const now=new Date(), anchor=now.getFullYear()*12+now.getMonth()-11;
  const finalMonth=app.pendingBillsSummary({fixed:[],debts:[{
    id:"final-sin-dia",name:"Coche",monthly:80,value:2000,balloon:500,
    months:12,asOf:anchor,account:"sabadell"
  }]},now.getMonth()+1,now.getFullYear(),24);
  assert.equal(finalMonth.count,2);
  assert.equal(finalMonth.total,580);
}
console.log("  ✓ guías locales ES/EN/CA, intents y destinos desconocidos rechazados");

const code=transformSync(fs.readFileSync("supabase/functions/help-assistant/index.ts","utf8"),{loader:"ts",format:"esm"}).code.replace(/^import[\s\S]*?;\s*$/gm,"");
function environment(options={}){
  let handler; const calls=[]; const gates=[];
  const deps={
    Deno:{env:{get:k=>k==="AELY_HELP_AI_ENABLED"?(options.disabled?"":"true"):k==="OPENAI_API_KEY"?(options.noKey?"":"synthetic"):k==="OPENAI_HELP_MODEL"?(options.helpModel||""):"synthetic"},serve:f=>{handler=f;}},
    createClient:()=>({auth:{getUser:async()=>({data:{user:options.unauthorized?null:{id:"synthetic-user"}},error:null})},from:()=>{throw Error("No debe leer datos financieros");}}),
    withCors:f=>f,rateLimit:async(...args)=>{gates.push(args);return {ok:!options.limited&&!(options.dailyLimited&&gates.length===2)&&!(options.globalLimited&&gates.length===3),checked:!options.unchecked};},
    fetch:async(url,init)=>{
      calls.push({url,body:JSON.parse(init.body),signal:init.signal});
      if(options.throws)throw Error("synthetic");
      const payload=options.payload||{status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(options.model||{topics:options.topics||["cash"],cue:"help_cue_cash",intent:null,bank:null,clarify:null,confidence:"high"})}]}]};
      return new Response(JSON.stringify(payload),{status:options.httpError?503:200});
    },
  };
  new Function(...Object.keys(deps),code)(...Object.values(deps));
  return {handler,calls,gates};
}
const request=(body={question:"Ayúdame con mis billetes",language:"es"},auth="Bearer synthetic")=>new Request("https://synthetic.invalid",{method:"POST",headers:{Authorization:auth},body:JSON.stringify(body)});
for(const options of [{noKey:true},{disabled:true},{limited:true},{dailyLimited:true},{globalLimited:true},{unchecked:true},{unauthorized:true}]){
  const e=environment(options);const r=await e.handler(request());assert.notEqual(r.status,200);assert.equal(e.calls.length,0);
}
console.log("  ✓ sin sesión, clave o límite comprobado no hay llamada de pago");
{
  const e=environment();
  for(const req of [request({},""),request({question:5}),request({question:"x".repeat(601)}),request({question:"x",extra:"y".repeat(4096)})]) assert.notEqual((await e.handler(req)).status,200);
  assert.equal(e.calls.length,0);
  const r=await e.handler(request({question:"Ayúdame con efectivo",language:"es",expenses:[{amount:987654}],userId:"another"}));
  const body=await r.json();
  assert.equal(body.ok,true);
  assert.deepEqual(body.topics,["cash"]);
  assert.equal(body.cue,"help_cue_cash");
  assert.equal(body.confidence,"high");
  assert.equal(body.intent,null);
  const c=e.calls[0];assert.equal(c.body.store,false);assert.equal(c.body.input,"Ayúdame con efectivo");
  assert.equal(c.body.model,"gpt-5.6-sol");assert.equal(c.body.reasoning.effort,"low");assert.equal(c.body.max_output_tokens,180);
  assert.equal(c.body.text.format.strict,true);
  assert.deepEqual(c.body.text.format.schema.properties.topics.items.enum,Array.from(catalog));
  assert.ok(c.body.text.format.schema.properties.cue);
  assert.ok(c.body.text.format.schema.properties.intent);
  assert.ok(c.body.text.format.schema.properties.confidence);
  assert.ok(!JSON.stringify(c.body).includes("987654"));assert.equal(e.gates[0][1],"help-assistant:synthetic-user");
}
console.log("  ✓ solo duda explícita al proveedor, schema cue/intent y catálogo sincronizado");
{
  const e=environment({helpModel:"modelo-autorizado"});
  await e.handler(request());
  assert.equal(e.calls[0].body.model,"modelo-autorizado");
}
{
  const e=environment();
  for(const secret of ["DE89 3704 0044 0532 0130 00","4111-1111-1111-1111","mi PIN es 1234"]){
    const r=await e.handler(request({question:secret,language:"es"}));
    assert.equal(r.status,400);
    assert.equal((await r.json()).error,"secret");
  }
  assert.equal(e.calls.length,0);
}
console.log("  ✓ modelo configurable y secretos frenados de nuevo en la Edge");
for(const options of [
  {throws:true},{httpError:true},
  {model:{topics:["delete_all"],cue:null,intent:null,bank:null,clarify:null,confidence:"high"}},
  {model:{topics:["cash","cash","cash","cash"],cue:null,intent:null,bank:null,clarify:null,confidence:"high"}},
  {payload:{status:"incomplete",output:[]}},{payload:{status:"completed",output:[{type:"message",content:[{type:"refusal",refusal:"no"}]}]}},
  {payload:{status:"completed",output:[{type:"message",content:[{type:"output_text",text:"invalid"}]}]}},
]){
  const e=environment(options);const r=await e.handler(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false,error:"unavailable"});
}
assert.deepEqual(await (await environment({model:{topics:[],cue:null,intent:null,bank:null,clarify:null,confidence:"low"}}).handler(request())).json(),{ok:true,topics:[],cue:null,intent:null,bank:null,clarify:null,confidence:"low"});
{
  const badCue=await (await environment({model:{topics:["cash"],cue:"help_cue_debts",intent:null,bank:null,clarify:null,confidence:"high"}}).handler(request())).json();
  assert.equal(badCue.ok,true); assert.equal(badCue.cue,"help_cue_cash");
}
console.log("  ✓ errores, rechazo y cue incompatible no abren prosa ni acciones inventadas");
assert.ok(Array.from(cues).every(c=>typeof c==="string"&&c.startsWith("help_cue_")));
console.log("  ✓ catálogo de cues cerrado");
