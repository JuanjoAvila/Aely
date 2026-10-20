import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {environment,wireRows,plain,cents} from './helpers/fin19-r4-fixture.mjs';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
function reference(c,previous,incoming){
 const scope=c.expenseIdentityScopes(previous,incoming),seen=new Set(),old=new Set(previous.map(e=>c.expenseMergeKey(e,scope)));let n=0;
 for(const e of incoming){const key=c.expenseMergeKey(e,scope);if(!seen.has(key)){seen.add(key);if(!old.has(key))n++;}}return n;
}
function calls(env){let n=0;const original=env.c.expenseMergeKey;env.c.expenseMergeKey=(...args)=>{n++;return original(...args);};return ()=>n;}
test('FIN19 R4 actual counter avoids key construction for3500 unchanged identities',()=>{
 const env=environment(html,wireRows()),previous=env.stateRef.current.expenses,incoming=plain(previous),read=calls(env);
 assert.equal(env.count(env.stateRef,incoming),0);assert.equal(read(),0);
 assert.equal(cents(previous),6126750);assert.deepEqual(plain(previous),incoming);
});
test('FIN19 R4 every identity field invalidates counter shortcut',()=>{
 for(const [key,value] of Object.entries({id:'other-id',date:'2026-10-18T10:00:00.000Z',amount:5,merchant:'Otra compra',source:'manual',ent:'caixabank',obAcc:'other-account',obOrd:2,extId:'other-reference'})){
  const env=environment(html,wireRows(1)),previous=env.stateRef.current.expenses,incoming=[{...previous[0],[key]:value}],expected=reference(env.c,previous,incoming),read=calls(env);
  assert.equal(env.count(env.stateRef,incoming),expected,key);assert.ok(read()>0,key+' uses normal identity calculation');
 }
});
test('FIN19 R4 counter context does not survive row changes',()=>{
 const env=environment(html,wireRows(1)),incoming=plain(env.stateRef.current.expenses);
 assert.equal(env.count(env.stateRef,incoming),0);incoming[0].obAcc='another-account';
 assert.equal(env.count(env.stateRef,incoming),1);env.stateRef.current.expenses=plain(incoming);
 assert.equal(env.count(env.stateRef,incoming),0);
});
test('FIN19 R4 full pull still refreshes category and manual note behind zero count',async()=>{
 const env=environment(html,wireRows(1));env.remote[0].cat='ocio';env.remote[0].nota='Nota nueva';env.remote[0].nota_edit=true;
 const before=plain(env.stateRef.current.expenses),out=await env.pull(),after=env.stateRef.current.expenses[0];
 assert.equal(out.nuevos,0);assert.equal(after.category,'ocio');assert.equal(after.note,'Nota nueva');
 assert.equal(after.id,before[0].id);assert.equal(after.amount,before[0].amount);assert.equal(after.obAcc,before[0].obAcc);
});
test('FIN19 R4 counter permutations and partitions match scoped financial grouping',()=>{
 const env=environment(html,wireRows(2)),a=env.stateRef.current.expenses[0],notice={...a,id:'notice',source:'macrodroid',obAcc:undefined,extId:undefined},same={...a,id:'same'},other={...a,id:'other',ent:'sabadell',obAcc:'another-account'};
 const lists=[[notice,same,other],[other,same,notice],[same,notice,other],[same,{...same,id:'new-manual',source:'manual'},other]];
 for(const list of lists)for(let split=0;split<=list.length;split++){
  const previous=list.slice(0,split),incoming=list.slice(split);env.stateRef.current.expenses=previous;
  assert.equal(env.count(env.stateRef,incoming),reference(env.c,previous,incoming));
 }
});
test('FIN19 R4 unconditional-zero mutant loses new known account in actual counter',()=>{
 const needle='if(!mismasIdentidades){';assert.ok(html.includes(needle));
 const env=environment(html.replace(needle,'if(false){'),wireRows(1)),incoming=plain(env.stateRef.current.expenses);incoming[0].obAcc='other-account';
 assert.equal(reference(env.c,env.stateRef.current.expenses,incoming),1);assert.equal(env.count(env.stateRef,incoming),0);
});
