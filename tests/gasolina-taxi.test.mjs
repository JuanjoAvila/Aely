import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";
import { betaRevision } from "../scripts/beta-revisions.mjs";
import { loadPureLogic, loadPureLogicFromFile, createLogicSandbox, extractPureLogicSource } from "../scripts/load-pure-logic.mjs";

const ref=process.argv.includes("--source-ref") ? process.argv[process.argv.indexOf("--source-ref")+1] : null;
const read=f=>ref ? execFileSync("git",["show",ref+":"+f],{encoding:"utf8",maxBuffer:6*1024*1024}) : fs.readFileSync(f,"utf8");
const ctx=ref ? loadPureLogic(read("public/index.html")) : loadPureLogicFromFile();
const server=await import("data:text/javascript;base64,"+Buffer.from(transformSync(read("supabase/functions/_shared/ingest_logic.ts"),{loader:"ts",format:"esm"}).code).toString("base64"));
let count=0;
function t(name,fn){ fn(); count++; console.log("  ✓ "+name); }

const cases=[
  ["Gasolinera Norte","gasolina"], ["Repsol carburante","gasolina"], ["CEPSA diesel","gasolina"],
  ["Ballenoil","gasolina"], ["Plenergy","gasolina"], ["Carrefour Gas","gasolina"],
  ["Taxi Barcelona","taxi"], ["Cabify","taxi"], ["Uber trip","taxi"], ["Free Now","taxi"],
  ["Uber Eats","bares"], ["UBER *EATS","bares"], ["Uber-Eats","bares"], ["UberEats","bares"],
  ["Repsol recarga electrica","transporte"], ["Repsol carga electrica","transporte"],
  ["Repsol recàrrega elèctrica","transporte"], ["Repsol EV charging","transporte"], ["Restaurante Repsol","bares"], ["Repsol Luz","luz"],
  ["Repsol factura gas natural","gas"], ["Repsol","transporte"], ["Shell","transporte"],
  ["BP","otros"], ["Metro TMB","transporte"], ["Recarga electrica","transporte"],
  ["Mapfre Seguros","recibos"], ["Boltwood","transporte"], ["Gasolinerama","otros"],
  ["Diesel jeans","transporte"], ["Petrol station","gasolina"], ["Benzina","gasolina"],
];
for(const [merchant,category] of cases) t(merchant+" → "+category,()=>{
  assert.equal(ctx.categoryOfNewMerchant(merchant),category,"cliente");
  assert.equal(server.categorizar(merchant),category,"fuente servidor sin desplegar");
});
t("MCC de tarjeta reconoce combustible/taxi sin inferirlo del nombre",()=>{
  for(const [mcc,category] of [["5541","gasolina"],["5542","gasolina"],["4121","taxi"]]){
    assert.equal(ctx.categoryOfBankTx({merchant:"Repsol",mcc,card:true}),category);
    assert.equal(ctx.categoryOfBankTx({merchant:"Comercio sin detalle",mcc,card:true}),category);
    assert.equal(ctx.categoryOfBankTx({merchant:"Comercio sin detalle",mcc,card:false}),"otros");
  }
  assert.equal(ctx.categoryOfBankTx({merchant:"Repsol Luz",mcc:"5541",card:true}),"luz");
  assert.equal(ctx.categoryOfBankTx({merchant:"Uber Eats",mcc:"4121",card:true}),"bares");
  assert.equal(ctx.categoryOfBankTx({merchant:"Movimiento",concept:"Uber Eats",mcc:"4121",card:true}),"bares");
});
t("MCC combinado conserva finalidad reconocida y comportamiento anterior",()=>{
 const strong=[["Metro TMB","transporte"],["Recarga electrica","transporte"],["Repsol recarga electrica","transporte"],["Diesel jeans","transporte"],["UBER *EATS","bares"],["Repsol Luz","luz"],["Repsol factura gas natural","gas"]];
 for(const [merchant,cat] of strong)for(const mcc of ["5541","5542","4121","5411","5812"]){
  assert.equal(ctx.categoryOfBankTx({merchant,mcc,card:true}),cat,merchant+" + "+mcc);
 }
 for(const merchant of ["Repsol","CEPSA","Shell"]){
  assert.equal(ctx.categoryOfBankTx({merchant,mcc:"5411",card:true}),"transporte");
  assert.equal(ctx.categoryOfBankTx({merchant,mcc:"5812",card:true}),"transporte");
  assert.equal(ctx.categoryOfBankTx({merchant,mcc:"5542",card:true}),"gasolina");
 }
 for(const [merchant,concept,cat] of [["Repsol","Repsol recarga electrica","transporte"],["Repsol","Metro TMB","transporte"],["Repsol","UBER *EATS","bares"],["Repsol","Repsol","gasolina"],["Comercio sin detalle","Recarga electrica","transporte"]]){
  assert.equal(ctx.categoryOfBankTx({merchant,concept,mcc:"5542",card:true}),cat,merchant+" / "+concept);
 }
 vm.runInContext('USER_OVERRIDES={"metro tmb":"compras","repsol":"otros","repsol recarga electrica":"gasolina","uber *eats":"taxi"}',ctx);
 for(const [merchant,cat] of [["Metro TMB","compras"],["Repsol","otros"],["Repsol recarga electrica","gasolina"],["UBER *EATS","taxi"]])for(const mcc of ["5541","5542","4121","5411"]){
  assert.equal(ctx.categoryOfBankTx({merchant,mcc,card:true}),cat,merchant+" manual + "+mcc);
 }
 vm.runInContext("USER_OVERRIDES={}",ctx);
});
t("la elección personal gana a keywords y MCC incluso si es Otros",()=>{
  vm.runInContext('USER_OVERRIDES={"repsol":"otros","taxi barcelona":"transporte","gasolinera norte":"compras"}',ctx);
  assert.equal(ctx.categoryOfBankTx({merchant:"Repsol",mcc:"5541",card:true}),"otros");
  assert.equal(ctx.categoryOfNewMerchant("Taxi Barcelona"),"transporte");
  assert.equal(ctx.categoryOfNewMerchant("Gasolinera Norte"),"compras");
  vm.runInContext("USER_OVERRIDES={}",ctx);
});
t("migrate y seedFlows no reclasifican transporte ni Otros antiguos",()=>{
  const s=ctx.buildEmpty();
  s.expenses=[
    {id:"old1",merchant:"Taxi Barcelona",category:"transporte",source:"bank",amount:7},
    {id:"old2",merchant:"Repsol carburante",category:"transporte",source:"bank",amount:11},
    {id:"old3",merchant:"Gasolinera Norte",category:"otros",source:"bank",amount:13},
  ];
  s.categoryBudgets={transporte:90};
  const before=JSON.stringify(s.expenses);
  ctx.seedFlows(s); ctx.migrate(s);
  assert.equal(JSON.stringify(s.expenses),before);
  assert.equal(JSON.stringify(s.categoryBudgets),'{"transporte":90}');
  assert.equal(ctx.resolveCategory("transporte","Taxi Barcelona"),"transporte");
  assert.equal(ctx.resolveCategory("gasolina","Repsol"),"gasolina");
  assert.equal(ctx.resolveCategory("taxi","Uber"),"taxi");
});
t("desglose y límites independientes cuadran con el presupuesto",()=>{
  const s={accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true}],settings:{expenseBanks:["trade_republic"]},
    budget:500,categoryBudgets:{transporte:90,gasolina:100,taxi:50},expenses:[
      {date:"2026-09-20",merchant:"Gasolinera Norte",amount:30,category:"gasolina",ent:"trade_republic"},
      {date:"2026-09-21",merchant:"Taxi Barcelona",amount:10,category:"taxi",ent:"trade_republic"},
      {date:"2026-09-22",merchant:"Metro",amount:5,category:"transporte",ent:"trade_republic"}]};
  const rows=ctx.categorySpentByMonth(s,Date.parse("2026-09-26T12:00:00Z"));
  for(const [id,spent,limit] of [["transporte",5,90],["gasolina",30,100],["taxi",10,50]]){
    assert.equal(rows.find(r=>r.id===id).spent,spent); assert.equal(rows.find(r=>r.id===id).limit,limit);
  }
  assert.equal(rows.reduce((sum,r)=>sum+r.spent,0),ctx.monthBudgetStats(s,Date.parse("2026-09-26T12:00:00Z")).spent);
});

const priorRead=f=>execFileSync("git",["show","3467bbd4fddcd213f862bedddac971c827099f3d:"+f],{encoding:"utf8",maxBuffer:6*1024*1024});
const priorBudget=await import("data:text/javascript;base64,"+Buffer.from(transformSync(priorRead("supabase/functions/_shared/presupuesto.ts"),{loader:"ts",format:"esm"}).code).toString("base64"));
t("presupuesto servidor anterior cuenta ambos IDs diarios sin nuevo despliegue",()=>{
 const rows=[{id:"fuel",fecha:"2026-09-20T12:00:00Z",importe:30,comercio:"Repsol",cat:"gasolina",source:"manual:trade_republic"},{id:"taxi",fecha:"2026-09-21T12:00:00Z",importe:10,comercio:"Uber",cat:"taxi",source:"manual:trade_republic"}];
 const data={accounts:[{ent:"trade_republic",role:"diario"}],settings:{},budget:500,reservaLog:[]},now=Date.parse("2026-09-26T12:00:00Z");
 const stats=priorBudget.statsDelMes(rows,data,priorBudget.inicioDeMesMs(now),now);
 assert.equal(stats.shown,40);assert.equal(stats.shown,ctx.monthBudgetStats({...data,expenses:rows.map(ctx.expenseFromRow)},now).shown);
});
// La BD de prueba intercepta el cliente real: el contrato se ejecuta sin acceder a una cartera.
const written=[];const db={auth:{getSession:async()=>({data:{session:{user:{id:"synthetic-user"}}}})},from:()=>({upsert:async(row,opts)=>{written.push({...row});assert.equal(opts.ignoreDuplicates,true);return{error:null};}})};
const sandbox=createLogicSandbox();sandbox.window.supabase={createClient:()=>db};const cloudCtx=vm.createContext(sandbox);vm.runInContext(extractPureLogicSource(read("public/index.html")),cloudCtx);
for(const category of ["gasolina","taxi"]){
 await vm.runInContext('cloud.addExpense('+JSON.stringify({id:"550e8400-e29b-41d4-a716-446655440000",date:"2026-09-20T12:00:00.000Z",amount:10,merchant:"Repsol",category,source:"manual",ent:"trade_republic"})+')',cloudCtx);
 assert.equal(written.at(-1).cat,category);assert.equal(ctx.expenseFromRow(written.at(-1)).category,category);
}
count++;console.log("  ✓ alta cloud real y pull conservan IDs explícitos aunque el comercio sea ambiguo");
t("las tres traducciones participan en la huella funcional sin repinar referencias",()=>{
 const id="feature-0210-01-gasolina-taxi",base=betaRevision(id);
 for(const label of ["Gasolina","Fuel","Benzina"]){
  const changed=betaRevision(id,f=>read(f).replace('cat_gasolina:"'+label+'"','cat_gasolina:"'+label+' cambiada"'));
  assert.notEqual(changed.web,base.web,label);
 }
});
console.log("gasolina-taxi: "+count+" PASS");
