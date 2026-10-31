import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { test } from "node:test";
import { environment, section, plain, owner, uuid, now } from "./helpers/fin19-r4-fixture.mjs";

const html=fs.readFileSync(process.env.EXPENSE_RENAME_HTML||new URL("../public/index.html",import.meta.url),"utf8");
const callback=section(html,
  "  const saveEdit=function(orig, extra){","  const todayKey=");
function setup({source="ob",amount=-123.45,category="traspaso",obName="Nombre bancario",mode="offline",merchant="Traspaso sintético"}={}){
  const env=environment(html,[{id:uuid(1),user_id:owner,fecha:"2026-10-19T10:00:00.001Z",
    importe:amount,comercio:merchant,cat:category,ob_name:obName,
    nota:"Nota intacta",source:source+":sabadell#refsynthetic#accsynthetic#n2"}]);
  const queues=[];
  const factory=vm.runInContext("(function(api,editExp,mode){const state=api.stateRef.current,set=api.set,cloud=Object.assign({},api.cloud,{enabled:()=>mode!=='offline'}),mcSandbox=()=>mode==='sandbox',mcSandboxTransition=()=>false,editCola={current:{pend:[]}},subeEdicionesDeGasto=q=>api.queues.push(q.pend),renameSequence={current:0},retryRenames=()=>{throw Error('unexpected retry');},separarGemelo=()=>{throw Error('unexpected split');},setEditExp=()=>{},showToast=()=>{};"+callback+"return saveEdit;})",env.c);
  const save=(merchant,extra={})=>{
    const orig=env.stateRef.current.expenses[0];
    factory({...env,queues},{id:orig.id,merchant:orig.merchant,amount:String(Math.abs(orig.amount)),
      income:orig.amount<0,date:String(orig.date).slice(0,10)},mode)(orig,{merchant,...extra});
  };
  return Object.assign(env,{save,queues});
}
for(const source of ["ob","ob-hist","manual"])test("renombrar traspaso negativo offline conserva categoría y céntimos: "+source,()=>{
  const env=setup({source}),original=plain(env.stateRef.current.expenses[0]);
  const stats=()=>{const s=env.c.monthBudgetStats(env.stateRef.current,now);return [s.spent,s.income].map(n=>Math.round(n*100));};
  const initialStats=stats();
  for(const merchant of ["Nombre elegido","Segundo nombre",original.merchant]){
    env.save(merchant);
    for(const phase of ["guardado","reinicio"]){
      if(phase==="reinicio")env.persist();
      const state=env.stateRef.current,row=plain(state.expenses[0]);
      assert.equal(row.merchant,merchant,phase);
      assert.equal(row.category,"traspaso",phase+" no transforma el traspaso en ingreso");
      assert.equal(Math.round(row.amount*100),-12345,phase+" importe firmado exacto");
      assert.equal(row.obName,original.obName,phase+" nombre bancario");
      assert.equal(row.note,original.note,phase+" nota");
      assert.equal(env.c.expenseIsTombstoned(row,env.c.expenseDeletedSet(state)),false,phase+" fila visible");
      assert.deepEqual(stats(),initialStats,phase+" presupuesto sin ingreso nuevo");
    }
  }
  assert.equal(env.deletes,0);assert.deepEqual(env.writes,[]);
});
test("un salario negativo y un traspaso positivo conservan su categoría",()=>{
  for(const fixture of [{amount:-1500,category:"ingreso"},{amount:123.45,category:"traspaso"}]){
    const env=setup(fixture);env.save("Nombre elegido");env.persist();
    assert.equal(env.stateRef.current.expenses[0].category,fixture.category);
    assert.equal(env.stateRef.current.expenses[0].amount,fixture.amount);
  }
});
test("cambiar expresamente el sentido de un manual sigue clasificando ingreso y gasto",()=>{
  const env=setup({source:"manual",amount:123.45,category:"otros"});
  env.save("Abono sintético",{income:true});
  assert.equal(env.stateRef.current.expenses[0].category,"ingreso");
  assert.equal(env.stateRef.current.expenses[0].amount,-123.45);
  env.save("Compra sintética",{income:false});
  assert.equal(env.stateRef.current.expenses[0].amount,123.45);
  assert.notEqual(env.stateRef.current.expenses[0].category,"ingreso");
});

for(const source of ["ob","ob-hist"])for(const category of ["traspaso","inversion","deudas","bizum"])for(const amount of [-200,-200.01])test("writer real conserva negativo renombrado y fila remota: "+source+" "+category+" "+amount,async()=>{
  const env=setup({source,category,amount,mode:"sandbox",merchant:category==="bizum"?"BIZUM SINTÉTICO":"Movimiento sintético"});
  const original=plain(env.stateRef.current.expenses[0]);
  assert.equal(original.category,category,"la fixture entra con la categoría declarada");
  const stats=()=>{const s=env.c.monthBudgetStats(env.stateRef.current,now);return [s.spent,s.income,s.balance].map(n=>Math.round(n*100));};
  const before=stats();
  env.save("Nombre elegido");
  const chosen={...original,merchant:"Nombre elegido",noCard:true,expenseEditPending:{noCard:true}};
  const saved=plain(env.stateRef.current.expenses);
  env.persist();const reloaded=plain(env.stateRef.current.expenses);
  const jobs=env.queues.at(-1);assert.equal(jobs.length,1);
  const queue={pend:jobs.slice(),fin:Promise.resolve()};await env.c.subeEdicionesDeGasto(queue);
  assert.equal(queue.pend.length,0);assert.equal(env.deletes,1);assert.equal(env.inserts.length,1);
  assert.equal(env.uploadResults.at(-1),false,"promesa sin select no es ACK");
  const wire={user_id:owner,fecha:original.date,importe:amount,comercio:"Nombre elegido",cat:category,
    source:source+":sabadell#refsynthetic#accsynthetic#n2",no_card:true,id:uuid(1),nota:"Nota intacta",
    nota_edit:false,importe_orig:null,divisa:null,ob_name:"Nombre bancario"};
  assert.deepEqual(plain(env.remote),[wire],"fila completa subida por el writer real, sin ingreso falso");
  assert.deepEqual(saved,[chosen],"guardado completo sin categoría pendiente falsa");
  assert.deepEqual(reloaded,[chosen],"reinicio previo al writer");
  assert.deepEqual(plain(env.stateRef.current.expenses),[chosen],"writer cumplido sin ACK mantiene pendiente");
  await env.pull();
  const confirmed={...original,merchant:"Nombre elegido",noCard:true};
  assert.deepEqual(plain(env.stateRef.current.expenses),[confirmed],"eco UUID real confirma solo noCard");
  env.persist();assert.deepEqual(plain(env.stateRef.current.expenses),[confirmed],"fila confirmada persiste");
  assert.deepEqual(stats(),before,"céntimos y presupuesto sin ingreso nuevo");
  assert.equal(env.c.expenseIsTombstoned(env.stateRef.current.expenses[0],env.c.expenseDeletedSet(env.stateRef.current)),false);
});
