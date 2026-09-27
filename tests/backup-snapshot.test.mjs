import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const c=loadPureLogicFromFile();
const id="550e8400-e29b-41d4-a716-446655440001";
const expense={id,date:"2026-09-20T12:00:00.000Z",amount:10,merchant:"OPS02 tienda",source:"ob",
  category:"otros",possibleDup:true,possibleDupOf:"550e8400-e29b-41d4-a716-446655440002"};
const snapshot=()=>({accounts:[],investments:[],debts:[],fixed:[],expenses:[{...expense}],deleted:[],settings:{}});
test("valida la copia completa sin tocar campos ni decisiones",()=>{
  const s=snapshot(),before=JSON.stringify(s);
  assert.equal(c.validateBackupSnapshot(s).ok,true);
  assert.equal(JSON.stringify(s),before);
});
for(const [label,change,reason] of [
  ["arrays ausentes",s=>delete s.fixed,"arrays"],
  ["expenses string",s=>s.expenses="corrupta","arrays"],
  ["fila nula",s=>s.accounts=[null],"rows"],
  ["UUID repetido",s=>s.expenses.push({...expense}),"duplicate_id"],
  ["importe string",s=>s.expenses[0].amount="10","amount"],
  ["importe infinito",s=>s.expenses[0].amount=Infinity,"amount"],
  ["fecha imposible",s=>s.expenses[0].date="2026-02-30","date"],
  ["fecha ilegible",s=>s.expenses[0].date="no es fecha","date"],
  ["fecha humana imposible",s=>s.expenses[0].date="30/02/2026","date"],
  ["lápida objeto",s=>s.deleted=[{id}],"deleted"],
  ["ajustes array",s=>s.settings=[],"settings"],
  ["ciclo",s=>s.loop=s,"json"],
  ["campo undefined",s=>s.field=undefined,"json"],
  ["NaN en cuenta",s=>s.accounts=[{value:NaN}],"json"],
])test("rechaza "+label,()=>{const s=snapshot();change(s);assert.equal(c.validateBackupSnapshot(s).reason,reason);});
test("fechas admitidas por la app se inspeccionan sin convertir su valor",()=>{
  for(const date of ["20/09/2026","20-09-26",Date.parse(expense.date),0]){
    const s=snapshot();s.expenses[0].date=date;
    assert.equal(c.validateBackupSnapshot(s).ok,true);assert.equal(s.expenses[0].date,date);
  }
});
test("metadatos legados se conservan crudos; ID ausente o numérico no se empareja",()=>{
  const s=snapshot();s.expenses=[{date:expense.date,amount:10,merchant:7,possibleDup:"false",note:{old:true}},
    {...expense,id:42,category:8,noCard:1},{...expense,id:42}];
  const before=JSON.stringify(s);
  assert.equal(c.validateBackupSnapshot(s).ok,true);
  const result=c.compareBackupExpenses(s.expenses,[]);
  assert.equal(result.counts.legacy,3);assert.equal(result.counts.copyOnly,0);
  assert.equal(JSON.stringify(s),before);
});
test("ID legado se conserva, sin inventar UUID",()=>{
  const s=snapshot();s.expenses[0].id="legado-1";
  assert.equal(c.validateBackupSnapshot(s).ok,true);
  const result=c.compareBackupExpenses(s.expenses,s.expenses);
  assert.equal(result.counts.legacy,2);assert.equal(result.counts.same,0);
});
test("same UUID compara todos los campos y no el orden de propiedades",()=>{
  const copy={...expense,note:"nota antigua",extId:"OPS02-1"};
  const current={extId:"OPS02-1",note:"nota nueva",...expense,possibleDup:false};
  const before=JSON.stringify([copy,current]);
  const r=c.compareBackupExpenses([copy],[current]);
  assert.deepEqual(Array.from(r.list[0].fields),["note","possibleDup"]);
  assert.equal(r.counts.changed,1);assert.equal(JSON.stringify([copy,current]),before);
  assert.equal(c.backupFieldValue({a:1,b:2}),c.backupFieldValue({b:2,a:1}));
});
test("mismos atributos e importe no emparejan UUID distintos",()=>{
  const r=c.compareBackupExpenses([expense],[{...expense,id:"550e8400-e29b-41d4-a716-446655440002"}]);
  assert.equal(r.copySum,r.currentSum);assert.equal(r.counts.copyOnly,1);assert.equal(r.counts.currentOnly,1);
  assert.equal(r.counts.same,0);
});
test("UUID repetido en cartera actual queda ambiguo, sin elegir gemelo",()=>{
  const r=c.compareBackupExpenses([expense],[expense,{...expense,amount:11}]);
  assert.equal(r.counts.legacy,3);assert.equal(r.counts.changed,0);
});
test("separar null de ausencia y conservar claves especiales",()=>{
  assert.deepEqual(Array.from(c.backupChangedFields({}, {note:null})),["note"]);
  assert.notEqual(c.backupFieldValue(JSON.parse('{"__proto__":{"x":1}}')),c.backupFieldValue({}));
});
test("suma desconocida no convierte un importe inválido o desbordado en cero",()=>{
  assert.equal(c.compareBackupExpenses([expense],[{...expense,amount:"10"}]).currentSum,null);
  assert.equal(c.compareBackupExpenses([{...expense,amount:1e308},{...expense,amount:1e308}],[]).copySum,null);
});
