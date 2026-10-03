import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";
import { betaRevision } from "../scripts/beta-revisions.mjs";
import { loadPureLogic, createLogicSandbox, extractPureLogicSource } from "../scripts/load-pure-logic.mjs";

const ref=process.argv.includes("--source-ref") ? process.argv[process.argv.indexOf("--source-ref")+1] : null;
const read=f=>ref ? execFileSync("git",["show",ref+":"+f],{encoding:"utf8",maxBuffer:6*1024*1024}) : fs.readFileSync(f,"utf8");
const ctx=loadPureLogic(read("public/index.html"));
const server=await import("data:text/javascript;base64,"+Buffer.from(transformSync(read("supabase/functions/_shared/ingest_logic.ts"),{loader:"ts",format:"esm"}).code).toString("base64"));
let count=0;
function t(name,fn){ fn(); count++; console.log("  ✓ "+name); }
const cases=[
  ["Multa DGT","multas"],["Multas de tráfico","multas"],["Multa zona azul","multas"],
  ["Sanción de tráfico","multas"],["Sanció de trànsit","multas"],["Traffic fine","multas"],["Parking fine","multas"],
  ["Zona azul","zona_azul"],["Telpark zona azul","zona_azul"],["Zona blava","zona_azul"],
  ["Estacionamiento regulado","zona_azul"],["Aparcament regulat","zona_azul"],
  ["Peaje AP7","peajes"],["Peajes autopista","peajes"],["Peatge C32","peajes"],["Peatges","peajes"],
  ["Toll road payment","peajes"],
  ["Telpark","parking"],["SABA Aparcamientos","parking"],["Zona verde","parking"],
  ["Hacienda impuestos","tasas"],["Ayuntamiento tasa","tasas"],["Sanción administrativa","tasas"],
  ["Autopistas","transporte"],["Toll logistics","otros"],["Fine dining","otros"],
  ["Multalia","tasas"],["Zona Azulada","parking"],["Restaurante Peaje","bares"],
  ["UBER *EATS","bares"],["UberEats","bares"],["Repsol Luz","luz"],["Repsol gas natural","gas"],
  ["Repsol recarga eléctrica","transporte"],["Metro TMB","transporte"],["Repsol","transporte"],
  ["Repsol carburante","gasolina"],["Taxi Barcelona","taxi"]
];
for(const [merchant,category] of cases) t(merchant+" → "+category,()=>{
  assert.equal(ctx.categoryOfNewMerchant(merchant),category,"cliente");
  assert.equal(server.categorizar(merchant),category,"fuente TS sin desplegar");
});
t("MCC no desplaza finalidad específica ni elección personal",()=>{
  for(const [merchant,cat] of cases.filter(([,cat])=>["multas","zona_azul","peajes","bares","luz","gas"].includes(cat))){
    for(const mcc of ["5541","5542","4121","5411","5812","7523","4784"]){
      assert.equal(ctx.categoryOfBankTx({merchant,card:true,mcc}),cat,merchant+" + "+mcc);
    }
  }
  // Ni parking general ni un MCC inventan una zona azul o una multa de tráfico.
  assert.equal(ctx.categoryOfBankTx({merchant:"Movimiento",card:true,mcc:"7523"}),"otros");
  assert.equal(ctx.categoryOfBankTx({merchant:"Movimiento",card:true,mcc:"4784"}),"otros");
  assert.equal(ctx.categoryOfBankTx({merchant:"Movimiento",concept:"Peaje AP7",card:true,mcc:"4784"}),"peajes");
  for(const merchant of ["Multa DGT","Zona azul","Peaje AP7"]){
    for(const cat of ["otros","parking","tasas","multas","zona_azul","peajes"]){
      vm.runInContext("USER_OVERRIDES="+JSON.stringify({[ctx.catKey(merchant)]:cat}),ctx);
      assert.equal(ctx.categoryOfNewMerchant(merchant),cat);
      assert.equal(ctx.categoryOfBankTx({merchant,card:true,mcc:"5542"}),cat);
    }
  }
  vm.runInContext("USER_OVERRIDES={}",ctx);
});
t("migrate y seedFlows conservan histórico y límites anteriores",()=>{
  const s=ctx.buildEmpty();
  s.expenses=[
    {id:"oldfine",merchant:"Multa DGT",category:"tasas",source:"bank",amount:40},
    {id:"oldzone",merchant:"Zona azul",category:"parking",source:"bank",amount:6},
    {id:"oldtoll",merchant:"Peaje AP7",category:"transporte",source:"bank",amount:8},
    {id:"unknown",merchant:"Sanció de trànsit",category:"otros",source:"bank",amount:11}
  ];
  s.categoryBudgets={tasas:60,parking:20,transporte:90};
  const before=JSON.stringify(s.expenses),budgets=JSON.stringify(s.categoryBudgets);
  ctx.seedFlows(s);ctx.migrate(s);
  assert.equal(JSON.stringify(s.expenses),before);
  assert.equal(JSON.stringify(s.categoryBudgets),budgets);
  for(const e of s.expenses) assert.equal(ctx.resolveCategory(e.category,e.merchant),e.category);
});
t("desglose y límites independientes conservan el mismo total diario",()=>{
  const expenses=[...["multas","zona_azul","peajes"].map((category,i)=>({id:category,merchant:"Comercio",category,amount:[40,6,8][i],date:"2026-09-20T12:00:00Z",source:"manual",ent:"trade_republic"})),
    {id:"legacy",merchant:"Peaje antiguo",category:"transporte",amount:7,date:"2026-09-21T12:00:00Z",source:"bank",ent:"trade_republic"}];
  const s={accounts:[{ent:"trade_republic",role:"diario",spendFrom:true}],settings:{expenseBanks:["trade_republic"]},budget:500,categoryBudgets:{multas:100,zona_azul:20,peajes:50,transporte:90},expenses};
  const rows=ctx.categorySpentByMonth(s,Date.parse("2026-09-26T12:00:00Z"));
  for(const [id,spent,limit] of [["multas",40,100],["zona_azul",6,20],["peajes",8,50],["transporte",7,90]]){
    assert.equal(rows.find(r=>r.id===id).spent,spent);assert.equal(rows.find(r=>r.id===id).limit,limit);
  }
  assert.equal(rows.reduce((sum,r)=>sum+r.spent,0),61);
  assert.equal(ctx.monthBudgetStats(s,Date.parse("2026-09-26T12:00:00Z")).spent,61);
});
const baseline=f=>execFileSync("git",["show","b51b095d:"+f],{encoding:"utf8",maxBuffer:6*1024*1024});
const priorBudget=await import("data:text/javascript;base64,"+Buffer.from(transformSync(baseline("supabase/functions/_shared/presupuesto.ts"),{loader:"ts",format:"esm"}).code).toString("base64"));
t("presupuesto TS del baseline cuenta los tres IDs sin desplegar servidor",()=>{
  const rows=["multas","zona_azul","peajes"].map((cat,i)=>({id:cat,fecha:"2026-09-20T12:00:00Z",importe:[40,6,8][i],comercio:"Comercio",cat,source:"manual:trade_republic"}));
  const data={accounts:[{ent:"trade_republic",role:"diario"}],settings:{},budget:500,reservaLog:[]},now=Date.parse("2026-09-26T12:00:00Z");
  assert.equal(priorBudget.statsDelMes(rows,data,priorBudget.inicioDeMesMs(now),now).shown,54);
  assert.equal(ctx.monthBudgetStats({...data,expenses:rows.map(ctx.expenseFromRow)},now).shown,54);
});
const written=[];const db={auth:{getSession:async()=>({data:{session:{user:{id:"synthetic-user"}}}})},from:()=>({upsert:async(row,opts)=>{written.push({...row});assert.equal(opts.ignoreDuplicates,true);return{error:null};}})};
const sandbox=createLogicSandbox();sandbox.window.supabase={createClient:()=>db};const cloudCtx=vm.createContext(sandbox);vm.runInContext(extractPureLogicSource(read("public/index.html")),cloudCtx);
for(const category of ["multas","zona_azul","peajes"]){
  await vm.runInContext('cloud.addExpense('+JSON.stringify({id:"550e8400-e29b-41d4-a716-446655440000",date:"2026-09-20T12:00:00Z",amount:10,merchant:"Comercio ambiguo",category,source:"manual",ent:"trade_republic"})+')',cloudCtx);
  assert.equal(written.at(-1).cat,category);assert.equal(ctx.expenseFromRow(written.at(-1)).category,category);
}
count++;console.log("  ✓ cloud real y lectura de filas conservan IDs elegidos sin inferir del comercio");
t("idiomas y clasificación forman parte de la huella sin tocar referencias históricas",()=>{
  const id="feature-0310-01-movilidad",base=betaRevision(id);
  for(const [cat,labels] of [["multas",["Multas","Fines","Multes"]],["zona_azul",["Zona azul","Blue zone","Zona blava"]],["peajes",["Peajes","Tolls","Peatges"]]])for(const label of labels){
    const from='cat_'+cat+':"'+label+'"';assert.ok(read("src/modules/01-i18n.js").includes(from));
    assert.notEqual(betaRevision(id,f=>read(f).replace(from,from.slice(0,-1)+' cambiada"')).web,base.web,label);
  }
  for(const file of ["supabase/functions/_shared/ingest_logic.ts","supabase/functions/categorize/index.ts"]){
    const from=file.includes("ingest_logic")?'return "multas";':'"multas", "zona_azul", "peajes"';
    assert.ok(read(file).includes(from));
    assert.notEqual(betaRevision(id,f=>f===file?read(f).replace(from,from+' /* cambio servidor */'):read(f)).edge,base.edge);
  }
});
console.log("movilidad-categorias: "+count+" PASS");
