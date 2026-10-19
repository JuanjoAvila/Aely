import assert from 'node:assert/strict';import vm from 'node:vm';
export function identityWitness(c){
  const rows=Array.from({length:128},(_,i)=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i).padStart(12,'0'),date:'2026-10-19T10:00:00.000Z',amount:(i+1)/100,merchant:'Sintético '+i,category:'super',source:'manual',ent:'sabadell',note:'Humana',noteEdited:true,noCard:true}));
  vm.runInContext('var __identityJSON=0;var __identityStringify=JSON.stringify;JSON=Object.create(JSON);JSON.stringify=function(){__identityJSON++;return __identityStringify.apply(null,arguments);};',c);
  const r=c.mergeExpensesFromCloud(rows,rows,undefined,{});
  assert.equal(c.__identityJSON,0,'identidad del merge no serializa cada fila');assert.equal(r.changed,false);assert.equal(r.nuevos,0);assert.equal(r.list.length,128);assert.ok(r.list.every((x,i)=>x===rows[i]),'sin cambios conserva objetos y evita nueva escritura');
  const a=rows[0],different=[{...a,amount:-8.97},{...a,extId:'ref-A'},{...a,extId:'ref-B'},{...a,ent:'otro'}];
  assert.equal(c.uniqueExpenseUuids([a,...different],{}).length,5,'firma conserva importe signo banco y referencia');
}
export function emptyTombstoneWitness(c){
  const rows=Array.from({length:128},(_,i)=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i).padStart(12,'0'),date:'2026-10-19T10:00:00.000Z',amount:(i+1)/100,merchant:'Sintético '+i,category:'super',source:'ob',ent:'sabadell',extId:'synthetic-ref-'+i}));
  vm.runInContext('var __tombstoneCalls=0;var __tombstoneOriginal=expenseIsTombstoned;expenseIsTombstoned=function(){__tombstoneCalls++;return __tombstoneOriginal.apply(null,arguments);};',c);
  const r=c.mergeExpensesFromCloud(rows,rows.map(e=>({...e})),undefined,{});
  assert.equal(r.changed,false);assert.equal(r.list.length,128);assert.equal(c.__tombstoneCalls,0,'mapa vacío sin confirmados no calcula claves de borrado');assert.ok(r.list.every((e,i)=>e===rows[i]));
  c.__hiddenDeleted={};vm.runInContext('expenseConfirmedSets.set(__hiddenDeleted,{list:[],owner:"synthetic"});',c);
  c.mergeExpensesFromCloud(rows,rows.map(e=>({...e})),undefined,c.__hiddenDeleted);
  assert.equal(c.__tombstoneCalls,128,'el registro oculto de confirmados mantiene la comprobación real');
}
export function identityIndexWitness(c){
  const rows=Array.from({length:128},(_,i)=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i).padStart(12,'0'),date:'2026-10-19T10:00:00.000Z',amount:(i+1)/100,merchant:'Sintético '+i,category:'super',source:'manual'}));
  vm.runInContext('var __uuidChecks=0;var __uuidOriginal=isExpenseUuid;isExpenseUuid=function(id){__uuidChecks++;return __uuidOriginal(id);};',c);
  const r=c.mergeExpensesFromCloud(rows,rows.map(e=>({...e})),undefined,{});
  assert.equal(r.changed,false);assert.ok(r.list.every((e,i)=>e===rows[i]));assert.equal(c.__uuidChecks,128,'cada UUID se valida una vez por merge, conservando su índice');
}
