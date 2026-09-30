import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx=loadPureLogicFromFile();
const expense={id:"550e8400-e29b-41d4-a716-446655440000",date:"2026-09-28T12:00:00.000Z",merchant:"Disposición ficticia",amount:80,category:"otros",source:"ob",ent:"caixabank"};
const row={id:expense.id,fecha:expense.date,comercio:expense.merchant,importe:80,cat:"otros",source:"ob:caixabank"};
const core=fs.readFileSync("src/modules/00-core.js","utf8");
const body=core.match(/async confirmExpenseWithdrawal\(e\)\{([\s\S]*?)\n    \},/)[1];
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const method=new AsyncFunction("sb","isExpenseUuid","canRecognizeWithdrawal","withdrawalRowMatches","e",body);
function client(opts={}){
  const data=structuredClone(opts.row||row), ops=[];
  let updates=0;
  return {data,ops,get updates(){return updates;},sb:{
    auth:{getSession:async()=>({data:{session:opts.noSession?null:{user:{id:"fixture-owner"}}}})},
    from(table){
      const filters=[]; let patch=null;
      const q={select(cols){ops.push(["select",cols]);return q;},eq(k,v){filters.push([k,v]);return q;},
        update(p){patch=p;updates++;return q;},
        async maybeSingle(){ops.push(["read",table,filters]);return {data:opts.missing?null:structuredClone(data),error:opts.readError||null};},
        then(resolve){
          ops.push(["update",table,patch,filters]);
          if(opts.zero) return resolve({data:[],error:null});
          if(opts.error) return resolve({data:null,error:new Error("denied")});
          Object.assign(data,patch);
          return resolve({data:opts.ack===undefined?[structuredClone(data)]:opts.ack,error:null});
        }};
      return q;
    }}};
}
const run=(c,e=expense)=>method(c.sb,ctx.isExpenseUuid,ctx.canRecognizeWithdrawal,ctx.withdrawalRowMatches,e);
let cases=0;
async function check(name,fn){await fn();cases++;console.log("✓ "+name);}

await check("ACK solo cambia cat; UUID, banco, importe y saldo intactos",async()=>{
  const c=client();const ack=await run(c);
  assert.equal(ack.cat,"traspaso");
  assert.deepEqual(c.data,{...row,cat:"traspaso"});
  const update=c.ops.find(op=>op[0]==="update");
  assert.deepEqual(update[2],{cat:"traspaso"});
  for(const kv of [["user_id","fixture-owner"],["id",expense.id],["source",row.source],["cat","otros"],["fecha",row.fecha],["importe",80],["comercio",row.comercio]])
    assert.ok(update[3].some(v=>v[0]===kv[0]&&v[1]===kv[1]),JSON.stringify(kv));
});
for(const [name,opts] of [["sesión ausente",{noSession:true}],["UUID no existe",{missing:true}],
  ["UUID remoto divergente",{row:{...row,id:"550e8400-e29b-41d4-a716-446655440001"}}],
  ["origen cambiado",{row:{...row,source:"ob:sabadell"}}],["importe cambiado",{row:{...row,importe:81}}],
  ["fecha cambiada",{row:{...row,fecha:"2026-09-27"}}],["comercio cambiado",{row:{...row,comercio:"Otro"}}],
  ["categoría de otro móvil",{row:{...row,cat:"super"}}],["error lectura",{readError:new Error("denied")}]] )
  await check(name+": no UPDATE",async()=>{const c=client(opts);await assert.rejects(()=>run(c));assert.equal(c.updates,0);});
await check("identidad corta y nube ausente no fingen guardar",async()=>{
  const c=client();await assert.rejects(()=>run(c,{...expense,id:"short"}));assert.equal(c.updates,0);
  await assert.rejects(()=>run({sb:null}));
});
for(const [name,opts] of [["UPDATE cero filas",{zero:true}],["RLS denegada",{error:true}],
  ["ACK vacío",{ack:null}],["ACK de otra fila",{ack:[{...row,cat:"traspaso",id:"other"}]}],
  ["ACK no neutro",{ack:[row]}],["ACK cambia importe",{ack:[{...row,cat:"traspaso",importe:1}]}]])
  await check(name+": rechazo",async()=>{await assert.rejects(()=>run(client(opts)));});
await check("reintento tras commit o móvil B ya neutro: no segundo UPDATE",async()=>{
  const c=client();await run(c);await run(c);assert.equal(c.updates,1);
  const b=client({row:c.data});await run(b);assert.equal(b.updates,0);
});
const state=()=>({accounts:[{id:"cb",ent:"caixabank",value:920,bankIban:"fixture"},{id:"cash",ent:"efectivo",value:30}],expenses:[structuredClone(expense)],settings:{expenseBanks:["caixabank"]}});
await check("idempotencia, recarga y doble importación no suman efectivo ni recrean fila",()=>{
  const s=state(), next=ctx.applyRecognizedWithdrawal(s,expense,100);
  assert.equal(next.accounts,s.accounts);
  assert.equal(next.expenses.length,1);assert.equal(next.expenses[0].id,expense.id);
  assert.equal(next.expenses[0].category,"traspaso");
  assert.equal(ctx.expenseCountsBudget(next.expenses[0],next),false);
  assert.equal(ctx.expenseCountsCash(next.expenses[0],next),ctx.expenseCountsCash(expense,s));
  assert.equal(ctx.applyRecognizedWithdrawal(next,expense,101),next);
  const reload=structuredClone(next);
  assert.equal(ctx.applyRecognizedWithdrawal(reload,expense,102),reload);
  const merged=ctx.mergeExpensesFromCloud(reload.expenses,[{...expense,category:"traspaso"},{...expense,category:"traspaso"}],103);
  assert.equal(merged.list.length,1);assert.equal(merged.list[0].id,expense.id);
  assert.equal(reload.accounts[1].value,30);
});
await check("pull anterior al ACK no deshace; pull posterior de B se admite",()=>{
  const next=ctx.applyRecognizedWithdrawal(state(),expense,100);
  const old=ctx.mergeExpensesFromCloud(next.expenses,[expense],99);
  assert.equal(old.list[0].category,"traspaso");
  const b=ctx.mergeExpensesFromCloud([expense],[{...expense,category:"traspaso"}],101);
  assert.equal(b.list[0].category,"traspaso");
  const later=ctx.mergeExpensesFromCloud(next.expenses,[{...expense,category:"super"}],101);
  assert.equal(later.list[0].category,"super");
});
await check("fila eliminada, cambiada o duplicada no se reescribe tras respuesta tardía",()=>{
  for(const expenses of [[],[{...expense,amount:81}],[{...expense,category:"super"}],[expense,{...expense}]]){
    const s={...state(),expenses};assert.equal(ctx.applyRecognizedWithdrawal(s,expense,100),s);
  }
});
await check("dups, ingresos, deudas e inversión no ofrecen este camino",()=>{
  for(const patch of [{possibleDup:true},{amount:-80},{amount:0},{category:"deudas"},{debtId:"d"},{category:"inversion"},{source:"manual"}])
    assert.equal(ctx.canRecognizeWithdrawal({...expense,...patch}),false);
});
await check("doble importación bancaria conserva la retirada corregida y sus saldos",()=>{
  const s={...state(),fixed:[],debts:[],flows:[],oneoffs:[]};
  const tx={ent:"caixabank",id:"fixture-bank-transaction",date:new Date().toISOString().slice(0,10),amount:80,
    merchant:"Disposición ficticia",note:"",card:false,status:"BOOK"};
  const first=ctx.importObExpenses({...s,expenses:[]},[tx]);
  assert.equal(first.length,1);
  const imported={...s,expenses:first}, e=first[0];
  const marked=ctx.applyRecognizedWithdrawal(imported,e,100);
  assert.equal(marked.expenses[0].category,"traspaso");
  assert.equal(ctx.importObExpenses(marked,[tx,tx]),null);
  assert.equal(marked.accounts,imported.accounts);
});
console.log(`retirada-bancaria: ${cases} casos OK`);
