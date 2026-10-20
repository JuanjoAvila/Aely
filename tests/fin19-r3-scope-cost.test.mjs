import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {loadPureLogic} from '../scripts/load-pure-logic.mjs';
import {identityWitness,emptyTombstoneWitness,identityIndexWitness} from './fin04-identity-witnesses.mjs';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const rows=()=>Array.from({length:3500},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),date:'2026-10-19T10:00:00.000Z',amount:(i+1)/100,merchant:'Compra '+i,category:'otros',source:'ob',ent:i%2?'sabadell':'trade_republic',obAcc:'account-'+(i%2),extId:'ref-'+i}));
function pull(c,prev,incoming){
 const begin=html.indexOf('      // "nuevo" ='),end=html.indexOf('        const next=merged.list;',begin);
 assert.ok(begin>0&&end>begin);
 const run=vm.runInContext('(function(stateRef,incoming,readStartedAt){let result;const set=function(fn){result=fn(stateRef.current);};'+html.slice(begin,end)+'return merged;});return {count,result};})',c);
 return run({current:{expenses:prev,deleted:[]}},incoming,Date.now());
}
test('FIN19 R3 category early exit builds no scope or content index for3500',()=>{
 const c=loadPureLogic(html),a=rows(),b=structuredClone(a);
 c.expenseIdentityScopes=()=>{throw Error('unnecessary scope');};
 const out=c.keepCategoryChoices(a,b,Date.now());
 assert.equal(out.prev,a);assert.equal(out.incoming,b);assert.equal(out.recat.length,0);
});
test('FIN19 R3 complete identities avoid content scan and serialize each bank/account once',()=>{
 const c=loadPureLogic(html),a=rows(),originalKey=c.keyOfExpense,originalKnown=c.expenseKnownIdentity;
 let keys=0,known=0;c.keyOfExpense=e=>{keys++;return originalKey(e);};c.expenseKnownIdentity=e=>{known++;return originalKnown(e);};
 const scope=c.expenseIdentityScopes(a);
 assert.equal(keys,0);assert.equal(known,0);
 for(const e of a)assert.ok(scope(e));
 assert.equal(keys,0);assert.equal(known,2);
 const notice={...a[0],id:'notice',obAcc:undefined};assert.equal(scope(notice),scope(a[0]));
 assert.equal(keys,3501);scope(notice);assert.equal(keys,3501);
 const next=c.expenseIdentityScopes([{...a[0],obAcc:'new-account'}]);
 assert.notEqual(next(notice),scope(notice),'no stale identity cache across states');
});
test('FIN19 R3 actual pull count/category/merge shares one context with unchanged3500',()=>{
 const c=loadPureLogic(html),a=rows(),b=structuredClone(a),original=c.expenseIdentityScopes;
 let contexts=0;c.expenseIdentityScopes=(...args)=>{contexts++;return original(...args);};
 const out=pull(c,a,b);assert.equal(contexts,1);assert.equal(out.count,0);
 assert.equal(out.result.changed,false,'caller retains previous expenses when changed is false');
 assert.ok(out.result.list.every((e,i)=>e===a[i]),'preserves every unchanged row');
 assert.equal(out.result.list.reduce((n,e)=>n+Math.round(e.amount*100),0),6126750);
 assert.deepEqual(JSON.parse(JSON.stringify(out.result.list)),b);
});
test('FIN19 R3 changed input references invalidate passed scope',()=>{
 const c=loadPureLogic(html),a=rows().slice(0,2),b=structuredClone(a),scope=c.expenseIdentityScopes(a,b),original=c.expenseIdentityScopes;
 let contexts=0;c.expenseIdentityScopes=(...args)=>{contexts++;return original(...args);};
 const changed=[...b,{...b[0],id:'00000000-0000-4000-8000-999999999999',obAcc:'other-account'}];
 const out=c.mergeExpensesFromCloud(a,changed,Date.now(),{},scope);
 assert.equal(contexts,1);assert.equal(out.list.length,3);
});
test('FIN19 R3 eager category scope mutant is rejected by cost witness',()=>{
 const needle='let scope=identityScope&&identityScope.rows===prevList&&identityScope.other===incoming?identityScope:null;';
 assert.ok(html.includes(needle));
 const c=loadPureLogic(html.replace(needle,'let scope=expenseIdentityScopes(prevList,incoming);'));
 c.expenseIdentityScopes=()=>{throw Error('unnecessary scope');};
 assert.throws(()=>c.keepCategoryChoices(rows(),[],Date.now()),/unnecessary scope/);
});
test('FIN19 R3 PR286 guards and3000-row exact-cent full-row oracle',()=>{
 for(const witness of [identityWitness,emptyTombstoneWitness,identityIndexWitness])witness(loadPureLogic(html));
 const c=loadPureLogic(html),a=rows().slice(0,3000),b=structuredClone(a),out=c.mergeExpensesFromCloud(a,b,Date.now(),{});
 assert.equal(out.changed,false);assert.equal(out.nuevos,0);
 assert.equal(out.list.reduce((n,e)=>n+Math.round(e.amount*100),0),4501500);
 assert.deepEqual(JSON.parse(JSON.stringify(out.list)),b);
 assert.ok(out.list.every((e,i)=>e===a[i]));
});
