import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {environment,wireRows,plain,cents,uuid,owner} from './helpers/fin19-r4-fixture.mjs';
const html=fs.readFileSync(process.env.FIN19_R5_HTML||new URL('../public/index.html',import.meta.url),'utf8');
function reference(c,previous,incoming){const scope=c.expenseIdentityScopes(previous,incoming),old=new Set(previous.map(e=>c.expenseMergeKey(e,scope))),seen=new Set();for(const e of incoming){const k=c.expenseMergeKey(e,scope);if(!old.has(k))seen.add(k);}return seen.size;}
test('FIN19 R5 orden real ID DESC y avisos sin fundir no construyen claves de identidad',()=>{
 for(const notices of [false,true]){
  const env=environment(html,wireRows()),incoming=plain(env.stateRef.current.expenses).sort((a,b)=>b.id.localeCompare(a.id));
  if(notices)env.stateRef.current.expenses.push({...incoming[0],id:'notice',obAcc:undefined,extId:undefined,source:'macrodroid'});
  let calls=0;const original=env.c.expenseMergeKey;env.c.expenseMergeKey=(...args)=>{calls++;return original(...args);};
  assert.equal(env.count(env.stateRef,incoming),0);assert.equal(calls,0,'no scoped key pass for already-present identities in remote order');
  assert.equal(cents(incoming),6126750);
 }
});
test('FIN19 R5 nuevas filas en ambos extremos, colisiones y snapshots distintos usan identidad completa',()=>{
 const env=environment(html,wireRows(4)),old=plain(env.stateRef.current.expenses);
 const added={...old[0],id:'new',obAcc:'new-account'};
 for(const incoming of [[added,...old].reverse(),[...old,added],[...old].reverse(),[added,added,...old]]){
  assert.equal(env.count(env.stateRef,incoming),reference(env.c,old,incoming));
 }
 env.stateRef.current.expenses=[old[0],{...old[0],obAcc:'other-account'}];
 for(const incoming of [[{...old[0],obAcc:'third-account'}],[old[0]],[{...old[0],source:'manual'}]]){
  assert.equal(env.count(env.stateRef,incoming),reference(env.c,env.stateRef.current.expenses,incoming));
 }
});
test('FIN19 R5 índice incompleto solo calcula referencias consultadas y admite consultas posteriores',()=>{
 const env=environment(html,wireRows()),rows=env.stateRef.current.expenses;
 let references=0;const real=env.c.obReferenceKey;env.c.obReferenceKey=(...args)=>{references++;return real(...args);};
 const scope=env.c.expenseIdentityScopes(rows),notice={...rows[0],id:'notice-a',source:'macrodroid',extId:undefined,obAcc:undefined};
 assert.equal(scope(notice),scope(rows[0]));assert.equal(references,0);
 const byRef={...rows[1],id:'external',merchant:'Concepto diferente',obAcc:undefined};
 assert.equal(scope(byRef),scope(rows[1]));assert.ok(references<=2,'only requested bank reference is indexed and queried');
 const byId={...rows[2],merchant:'Otro nombre',extId:undefined,obAcc:undefined};
 assert.equal(scope(byId),scope(rows[2]));assert.equal(scope(notice),scope(rows[0]));
});
test('FIN19 R6 nube conserva UUID de aviso absorbido y 300 altas reales; no pierde refrescos ni dinero',async()=>{
 const remote=wireRows(3800),env=environment(html,remote),initial=plain(env.stateRef.current.expenses.slice(0,3500));
 env.stateRef.current.expenses=initial;
 for(let i=0;i<100;i++)env.remote.push({...remote[i*2],id:uuid(9000+i),source:'macrodroid'});
 env.remote.reverse();
 const incoming=plain(env.c.expensesFromRows(env.remote,owner));
 assert.equal(env.count(env.stateRef,incoming),300);
 const result=await env.pull();await env.flush();
 assert.equal(result.nuevos,300);assert.equal(env.stateRef.current.expenses.length,3800);assert.equal(cents(env.stateRef.current.expenses),7221900);
 assert.equal((await env.pull()).nuevos,0);
 env.remote.find(e=>e.id===uuid(1)).nota='Nota remota';env.remote.find(e=>e.id===uuid(1)).nota_edit=true;
 await env.pull();assert.equal(env.stateRef.current.expenses.find(e=>e.id===uuid(1)).note,'Nota remota');
});
test('FIN19 R6 UUID ausente no acredita absorción de otra cuenta, ordinal, referencia o manual',async()=>{
 const env=environment(html,wireRows(4)),old=plain(env.stateRef.current.expenses);
 const changes=[{id:uuid(90),obAcc:'other'},{id:uuid(90),ent:'caixabank'},{id:uuid(90),obOrd:2,extId:'ordinal-ref'},{id:uuid(90),source:'manual'},{id:uuid(90),extId:'new-ref'}];
 for(const change of changes){
  const added={...old[0],...change},incoming=[added,...old];
  const count=env.count(env.stateRef,incoming);
  assert.equal(count,change.extId==='new-ref'?0:1,'counter retains content contract; reference is separated by real merge');
  const merged=env.c.mergeExpensesFromCloud(old,incoming,0,{});
  assert.equal(merged.list.length,5);assert.equal(cents(merged.list),11);
 }
});
test('FIN19 R6 el UUID absorbido no obliga a indexar dos veces los 3500 cargos conocidos',()=>{
 const remote=wireRows(),env=environment(html,remote);
 for(let i=0;i<100;i++)remote.push({...remote[i*2],id:uuid(9000+i),source:'macrodroid'});
 const incoming=plain(env.c.expensesFromRows(remote,owner)).reverse();
 let calls=0;const original=env.c.keyOfExpense;env.c.keyOfExpense=e=>{calls++;return original(e);};
 assert.equal(env.count(env.stateRef,incoming),0);
 assert.ok(calls<=3600,'one key per local row or missing notice, no second index of identical bank rows: '+calls);
});
test('FIN19 R6 aviso superviviente local y ambos UUID remotos conservan dinero y refresco',async()=>{
 const wire=wireRows(8),notices=wire.filter((_,i)=>i%2===0).map((r,i)=>({...r,id:uuid(9000+i),source:'macrodroid'}));
 const env=environment(html,[...wire,...notices]);
 const local=plain(env.c.expensesFromRows(wire,owner));
 for(let i=0;i<notices.length;i++)local[i*2]=plain(env.c.expenseFromRow(notices[i]));
 env.stateRef.current.expenses=local;
 assert.equal((await env.pull()).nuevos,0);assert.equal(cents(env.stateRef.current.expenses),36);assert.equal(env.stateRef.current.expenses.length,8);
 assert.deepEqual(plain(env.stateRef.current.expenses),local);
 env.remote.find(e=>e.id===uuid(9000)).nota='Nota del aviso';env.remote.find(e=>e.id===uuid(9000)).nota_edit=true;
 assert.equal((await env.pull()).nuevos,0);assert.equal(env.stateRef.current.expenses.find(e=>e.id===uuid(9000)).note,'Nota del aviso');
 assert.equal(cents(env.stateRef.current.expenses),36);
});
