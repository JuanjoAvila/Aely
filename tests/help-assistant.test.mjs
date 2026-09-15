import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";

const source=fs.readFileSync("src/modules/16-help-assistant.js","utf8");
const ctx=vm.createContext({});
vm.runInContext(source,ctx);
const local=q=>Array.from(ctx.helpLocalTopics(q));
const catalog=vm.runInContext("HELP_TOPICS.map(x=>x.id)",ctx);
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
console.log("  ✓ guías locales ES/EN/CA y destinos desconocidos rechazados");

const code=transformSync(fs.readFileSync("supabase/functions/help-assistant/index.ts","utf8"),{loader:"ts",format:"esm"}).code.replace(/^import[\s\S]*?;\s*$/gm,"");
function environment(options={}){
  let handler; const calls=[]; const gates=[];
  const deps={
    Deno:{env:{get:k=>k==="AELY_HELP_AI_ENABLED"?(options.disabled?"":"true"):k==="OPENAI_API_KEY"?(options.noKey?"":"synthetic"):"synthetic"},serve:f=>{handler=f;}},
    createClient:()=>({auth:{getUser:async()=>({data:{user:options.unauthorized?null:{id:"synthetic-user"}},error:null})},from:()=>{throw Error("No debe leer datos financieros");}}),
    withCors:f=>f,rateLimit:async(...args)=>{gates.push(args);return {ok:!options.limited&&!(options.dailyLimited&&gates.length===2)&&!(options.globalLimited&&gates.length===3),checked:!options.unchecked};},
    fetch:async(url,init)=>{
      calls.push({url,body:JSON.parse(init.body),signal:init.signal});
      if(options.throws)throw Error("synthetic");
      const payload=options.payload||{status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({topics:options.topics||["cash"]})}]}]};
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
  assert.deepEqual(await r.json(),{ok:true,topics:["cash"]});
  const c=e.calls[0];assert.equal(c.body.store,false);assert.equal(c.body.input,"Ayúdame con efectivo");
  assert.equal(c.body.text.format.strict,true);assert.deepEqual(c.body.text.format.schema.properties.topics.items.enum,Array.from(catalog));
  assert.ok(c.signal);assert.ok(!JSON.stringify(c.body).includes("987654"));assert.equal(e.gates[0][1],"help-assistant:synthetic-user");
}
console.log("  ✓ solo duda explícita al proveedor, identidad autenticada y catálogo sincronizado");
for(const options of [
  {throws:true},{httpError:true},{topics:["delete_all"]},{topics:["cash","cash","cash","cash"]},
  {payload:{status:"incomplete",output:[]}},{payload:{status:"completed",output:[{type:"message",content:[{type:"refusal",refusal:"no"}]}]}},
  {payload:{status:"completed",output:[{type:"message",content:[{type:"output_text",text:"invalid"}]}]}},
]){
  const e=environment(options);const r=await e.handler(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false,error:"unavailable"});
}
assert.deepEqual(await (await environment({topics:[]}).handler(request())).json(),{ok:true,topics:[]});
console.log("  ✓ errores, rechazo y respuesta truncada conservan guías locales; ninguna acción inventada");
