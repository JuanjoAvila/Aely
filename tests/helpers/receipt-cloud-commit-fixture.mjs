import assert from 'node:assert/strict';
import vm from 'node:vm';
import {codeMask} from '../../scripts/beta-source-code.mjs';
import {commitCloudFixture} from './cloud-commit-fixture.mjs';

// Estos casos prueban la adopción de Recibos del bundle servido. R3 entrega ahora
// el updater completo al commit: un recorte anterior a su marcador no reproduce App.
export function receiptCloudCommitFixture(bundle,context,owner){
 const scripts=[...bundle.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
 const app=scripts.find(s=>s.includes('const syncFromCloud=function('));
 assert.ok(app,'no se encuentra syncFromCloud en el bundle servido');
 const mask=codeMask(app),sync=mask.indexOf('const syncFromCloud=function(');
 const start=mask.indexOf('set(function(prev){',sync);
 assert.ok(start>sync,'no se encuentra el updater real de adopción');
 const open=mask.indexOf('{',start);let end=open+1,depth=1;
 for(;depth&&end<mask.length;end++){if(mask[end]==='{')depth++;if(mask[end]==='}')depth--;}
 assert.equal(depth,0,'el updater de adopción debe estar completo');
 const names=['cloudState','cloudPack','u','opts','freshLogin','read','cloudMergeKey','cloudPullRef','sessionRef','readSession'];
 const factory=vm.runInContext('(function('+names.join(',')+'){return function(prev){'+app.slice(open+1,end-1)+'};})',context);
 return function(prev,cloudState,freshLogin=false){
  const cloudPack={data:cloudState,updated_at:'synthetic'},read={owner,ready:false,merging:true,revision:cloudPack.updated_at};
  read.confirmed=context.obConfirmedMerge(prev,cloudState,owner);
  read.pending=context.obAbsorbedMerge(prev._historyOwner===owner?prev.obAbsorbedPending:[],cloudState.obAbsorbedPending,owner);
  assert.ok(read.confirmed&&read.pending,'las colas del banco deben admitir la lectura sintética');
  read.at=vm.runInContext('Date.now()',context);
  let applied=false;read.commit=value=>{applied=value;};
  const refs={cloudMergeKey:{current:Symbol('receipt-cloud-merge')},cloudPullRef:{current:read},cloudReadRef:{current:null},cloudUpdatedAtRef:{current:null},sessionRef:{current:{user:{id:owner}}},stateRef:{current:prev},obAbsorbedWriteBlocked:{current:false}};
  // El updater captura la sesión exacta del GET, además del titular, como App.
  const deps={cloudState,cloudPack,u:owner,opts:null,freshLogin,read,...refs,readSession:refs.sessionRef.current};
  const next=factory(...names.map(k=>deps[k]))(prev);
  refs.stateRef.current=next;
  commitCloudFixture(app,context,refs,next);
  assert.equal(applied,true,'solo el commit real acredita la adopción de la nube');
  assert.strictEqual(refs.cloudReadRef.current,read);
  assert.strictEqual(refs.stateRef.current,next);
  assert.equal(refs.cloudUpdatedAtRef.current,cloudPack.updated_at);
  return next;
 };
}
