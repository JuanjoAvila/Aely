import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {environment,wireRows,plain,cents} from './helpers/fin19-r4-fixture.mjs';
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
