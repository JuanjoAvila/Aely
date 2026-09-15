import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const read = file => fs.readFileSync(file, "utf8");
const load = async file => import("data:text/javascript;base64," + Buffer.from(transformSync(read(file), {loader:"ts",format:"esm"}).code).toString("base64"));
const logic = await load("supabase/functions/_shared/ingest_logic.ts");
const preferences = await load("supabase/functions/_shared/category_preferences.ts");
const wallet = await load("supabase/functions/_shared/wallet.ts");
const entry = await load("supabase/functions/_shared/entrada.ts");
const budget = await load("supabase/functions/_shared/presupuesto.ts");

// Handlers reales, con BD y proveedor simulados. Dos titulares en una misma instancia
// detectan cachés de reglas que contaminarían la siguiente notificación.
function environment(options = {}) {
  const queries=[], rows=[], events=[], aiCalls=[];
  const db = {
    from(table) {
      const filters={}; let columns="", mode="select", value;
      const result = () => {
        queries.push({table,columns,filters:{...filters},mode});
        if (mode === "upsert") { rows.push(value); return {data:null,error:null}; }
        if (mode === "insert") { events.push(value); return {data:null,error:null}; }
        if (table === "ingest_tokens") return {data:{user_id:filters.token},error:null};
        if (table === "app_state" && columns === "rules:data->catOverrides") {
          return options.rulesError ? {data:null,error:{message:"synthetic"}} :
            {data:{rules:(options.rules || {})[filters.user_id]},error:null};
        }
        if (table === "app_state") return {data:{data:{budget:100,accounts:[{ent:"trade_republic",role:"diario"}],settings:{expenseBanks:["trade_republic"]}}},error:null};
        if (table === "expenses") return {data:columns === "fecha" ? [] : rows.filter(r=>r.user_id===filters.user_id),error:null};
        return {data:[],error:null};
      };
      const chain = {
        select(v){columns=v;return chain;}, eq(k,v){filters[k]=v;return chain;},
        gte(){return chain;}, lte(){return chain;}, limit(){return chain;},
        upsert(v){mode="upsert";value=v;return chain;}, insert(v){mode="insert";value=v;return chain;},
        maybeSingle:async()=>result(), then:(resolve,reject)=>Promise.resolve(result()).then(resolve,reject),
      };
      return chain;
    },
  };
  const createClient = (url,key,opts) => ({...db,auth:{getUser:async()=>({data:{user:{id:String(opts?.global?.headers?.Authorization || "Bearer user-a").slice(7)}}})}});
  const fetch = async (url,init) => {
    aiCalls.push({url,body:JSON.parse(init.body)});
    if (options.aiThrows) throw new Error("synthetic unavailable");
    return new Response(JSON.stringify(options.aiBody || {choices:[{message:{content:'{"category":"otros"}'}}]}),{status:options.aiStatus || 200});
  };
  function handler(name) {
    let serve;
    const env = {SUPABASE_URL:"https://synthetic.invalid",SUPABASE_SERVICE_ROLE_KEY:"synthetic",SUPABASE_ANON_KEY:"synthetic",OPENAI_API_KEY:options.hasAI?"synthetic":""};
    const deps={...logic,...preferences,...wallet,...entry,...budget,createClient,fetch,
      withCors:f=>f,rateLimit:async()=>({ok:options.limit!==true}),bucketKey:async()=>"synthetic",callerIp:()=>"synthetic",
      Deno:{serve:f=>{serve=f;},env:{get:key=>env[key]}},
    };
    const code=transformSync(read("supabase/functions/"+name+"/index.ts"),{loader:"ts",format:"esm"}).code.replace(/^import[\s\S]*?;\s*$/gm,"");
    new Function(...Object.keys(deps),code)(...Object.values(deps));
    return serve;
  }
  return {handler,queries,rows,events,aiCalls,db};
}
const request = (user,body) => new Request("https://synthetic.invalid?token="+user,{method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+user},body:JSON.stringify(body)});
const purchase = {texto:"Has gastado 12,00 € en MAPFRE",titulo:"Trade Republic",fecha:"2026-09-15T12:00:00Z"};
let failed=0;
async function t(name,fn){try{await fn();console.log("  ✓ "+name);}catch(e){failed++;console.error("  ✗ "+name+": "+e.stack);}}

await t("ingest respeta reglas distintas por titular en TR y Wallet sin tocar el importe",async()=>{
  const e=environment({rules:{"user-a":{mapfre:"bares"},"user-b":{mapfre:"recibos"}}});
  const h=e.handler("ingest");
  for(const user of ["user-a","user-b"]){
    const res=await h(request(user,purchase)); const data=await res.json();
    assert.equal(res.status,200);assert.equal(data.cat,user==="user-a"?"bares":"recibos");assert.equal(data.importe,12);
  }
  const data=await (await h(request("user-a",{...purchase,fuente:"wallet",titulo:"MAPFRE",texto:"12,00 € con Visa"}))).json();
  assert.equal(data.cat,"bares");assert.equal(data.importe,12);
  assert.equal(e.rows.length,3);
  const reads=e.queries.filter(q=>q.columns==="rules:data->catOverrides");
  assert.deepEqual(reads.map(q=>q.filters.user_id),["user-a","user-b","user-a"]);
});

await t("si fallan las preferencias se guarda el gasto y el aviso no contiene reglas",async()=>{
  const e=environment({rulesError:true});
  const data=await (await e.handler("ingest")(request("user-a",purchase))).json();
  assert.equal(data.ok,true);assert.equal(data.cat,"recibos");assert.equal(e.rows.length,1);
  assert.ok(e.events.some(x=>/categorías personales no disponibles/.test(x.message)));
  assert.ok(!JSON.stringify(e.events).includes("catOverrides"));
});

await t("un Bizum recibido sigue siendo ingreso aunque exista una regla de restaurante",async()=>{
  const e=environment({rules:{"user-a":{"bizum de comercio":"bares"}}});
  const data=await (await e.handler("ingest")(request("user-a",{...purchase,texto:"Has recibido 12,00 € de Comercio por Bizum"}))).json();
  assert.equal(data.cat,"ingreso",JSON.stringify(data));assert.equal(data.importe,-12);
  assert.equal(e.queries.filter(q=>q.columns==="rules:data->catOverrides").length,0);
});

await t("categorize aplica la regla del autenticado antes de keywords y no llama al modelo",async()=>{
  const e=environment({rules:{"user-a":{mapfre:"bares"},"user-b":{mapfre:"otros"}},hasAI:true});
  const h=e.handler("categorize");
  for(const user of ["user-a","user-b"]){
    const data=await (await h(request(user,{merchant:"  Mápfre  "}))).json();
    assert.equal(data.category,user==="user-a"?"bares":"otros");assert.equal(data.source,"personal");
  }
  assert.equal(e.aiCalls.length,0);
});

await t("sin servicio, límite, respuesta rota y duda de categoría se distinguen",async()=>{
  for(const [options,reason] of [
    [{},"unavailable"],[{hasAI:true,limit:true},"limited"],[{hasAI:true,aiStatus:503},"unavailable"],
    [{hasAI:true,aiThrows:true},"unavailable"],[{hasAI:true,aiBody:{choices:[]}},"unavailable"],[{hasAI:true},"uncertain"],
  ]){
    const e=environment(options);
    const data=await (await e.handler("categorize")(request("user-a",{merchant:"QZXV"}))).json();
    assert.equal(data.category,"otros");assert.equal(data.reason,reason);
  }
});

await t("preferencias dañadas o demasiado grandes se rechazan con lectura mínima",async()=>{
  for(const rules of [[],"bad",Object.fromEntries(Array.from({length:2001},(_,i)=>["synthetic"+i,"bares"])),{x:"a".repeat(131073)},{x:"€".repeat(45000)}]){
    const e=environment({rules:{"user-a":rules}});
    const data=await preferences.readCategoryOverrides(e.db,"user-a");
    assert.equal(data.unavailable,true);assert.equal(data.rules,undefined);
    assert.equal(e.queries[0].columns,"rules:data->catOverrides");assert.equal(e.queries[0].filters.user_id,"user-a");
  }
});

await t("una regla personal mantiene el mismo presupuesto en servidor, widget y cliente",async()=>{
  const cli=loadPureLogicFromFile();
  const state={budget:100,accounts:[{ent:"trade_republic",role:"diario"}],settings:{expenseBanks:["trade_republic"]},reservaLog:[]};
  for(const rule of ["bares","recibos","traspaso"]){
    const cat=logic.categorizar("MAPFRE",{mapfre:rule});
    const row={id:"synthetic",fecha:new Date().toISOString(),importe:12,comercio:"MAPFRE",cat,source:"macrodroid"};
    const original=JSON.stringify(row);
    const app=cli.monthBudgetStats({...state,expenses:[cli.expenseFromRow(row)]});
    const server=budget.statsDelMes([row],state,budget.inicioDeMesMs());
    assert.equal(app.shown,12);assert.equal(app.shown,server.shown);assert.equal(app.against,server.against);
    assert.equal(JSON.stringify(row),original);
  }
});

if(failed) process.exitCode=1;
