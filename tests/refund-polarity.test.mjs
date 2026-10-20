import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,clientSource,serverSource} from './helpers/refund-polarity-fixture.mjs';
const {c,server,state,purchase,refund,toRow,net,view,tx,paths,ingest}=fixture();
const now=Date.parse('2026-10-18T10:00:00Z');
function run(name,fn){test('C signo: '+name,fn);}
 const scenarios={full:refund,partial:{...refund,amount:-2.34},otherDay:{...refund,date:'2026-10-16T12:00:00.000Z'},otherAccount:{...refund,obAcc:'synthetic-account-b'},ordinal:{...refund,obOrd:2,date:'2026-10-15T12:00:00.001Z'}};
 for(const [s,r] of Object.entries(scenarios))for(const reverse of [false,true])for(const [p,fn]of Object.entries(paths))run(s+'/'+p+'/'+(reverse?'refund-first':'purchase-first'),()=>{
   const es=reverse?[r,purchase]:[purchase,r],out=fn(es),expected=net(es),observed=view(out);
   assert.deepEqual({count:out.length,cents:net(out)},{count:2,cents:expected});
   if(!p.startsWith("import"))assert.deepEqual(new Set(out.map(e=>e.id)),new Set(es.map(e=>e.id)));
   else if(p==="importSequential")assert.ok(out.some(e=>e.id===es[0].id&&e.amount===es[0].amount),"conserva el UUID e importe local");
   return {observed};
 });
 for(const[p,fn]of Object.entries(paths)){
   run(p+'/distinct-ref',()=>{const es=[purchase,{...refund,extId:'other-ref'}],out=fn(es);assert.equal(out.length,2);assert.equal(net(out),0);return {observed:view(out)};});
   run(p+'/same-sign-duplicate',()=>{const out=fn([purchase,{...purchase}]);assert.equal(out.length,1);assert.equal(net(out),1234);return {observed:view(out)};});
   run(p+'/other-bank',()=>{const out=fn([purchase,{...refund,ent:'sabadell'}]);assert.equal(out.length,2);assert.equal(net(out),0);return {observed:view(out)};});
 }
 for(const[p,fn]of Object.entries(paths).filter(([p])=>!p.startsWith('import')))run(p+'/same-sign-other-day',()=>{const out=fn([purchase,{...purchase,date:'2026-10-16T12:00:00.000Z'}]);assert.equal(out.length,1);assert.equal(net(out),1234);return {observed:view(out)};});
 for(const[p,fn]of Object.entries(paths).filter(([p])=>!p.startsWith('import')))run(p+'/legacy-opposite-sign',()=>{const out=fn([{...purchase,extId:undefined},{...refund,extId:undefined}]);assert.equal(out.length,2);assert.equal(net(out),0);return {observed:view(out)};});
 run('server/raw-stats-independent-oracle',()=>{const stats=server.statsDelMes([purchase,refund].map(toRow),state([]),server.inicioDeMesMs(now));assert.equal(stats.spent,12.34);assert.equal(stats.income,12.34);assert.equal(stats.against,0);return {stats};});
for(const reverse of [false,true]){
 const es=reverse?[refund,purchase]:[purchase,refund];
 run('partial-response/'+reverse,()=>{const links=[{aspsp:'CaixaBank',truncated:true,transactions:[{ext_id:es[1].extId,date:es[1].date.slice(0,10),amount:es[1].amount,merchant:es[1].merchant,status:'BOOK'}]}];const out=c.flattenBankTx(links,[tx(es[0])]);assert.deepEqual({count:out.length,cents:net(out)},{count:2,cents:0});});
 run('history-after-existing/'+reverse,()=>{const links=[{aspsp:'CaixaBank',accounts:[{uid:'synthetic-account-a',transactions:[{ext_id:es[1].extId,date:es[1].date.slice(0,10),amount:es[1].amount,merchant:es[1].merchant,status:'BOOK'}]}]}];const observed=c.histFlattenHistoryLinks({links},[es[0]],{});assert.equal(observed.out.length,1);});
 run('deleted-reference-link/'+reverse,()=>{const e=es[0],s=state([]);s.deleted=[c.keyOfExpense(e)];s.gemelos=[c.bankDeletionLink(e)];const out=c.importObExpenses(s,[tx(es[1])],[{aspsp:'CaixaBank',syncFrom:'2026-10-01'}])||[];assert.equal(out.length,1);});
 const notice={...purchase,id:'33333333-3333-4333-8333-333333333333',source:'wallet',extId:undefined};
 const lap=c.obAbsorptionKey(purchase),del={[lap]:true},rows=[notice,purchase,refund];if(reverse)rows.reverse();
 run('absorption-client-survivor/'+reverse,()=>{const out=rows.filter(e=>!c.expenseIsTombstoned(e,del));assert.deepEqual({count:out.length,cents:net(out)},{count:2,cents:0});assert.equal(out.find(e=>e.id===notice.id).amount,12.34);});
 run('absorption-server-survivor/'+reverse,()=>{const out=server.filasComoLaApp(rows.map(toRow),[lap]);assert.deepEqual({count:out.length,cents:out.reduce((n,e)=>n+Math.round(e.importe*100),0)},{count:2,cents:0});});
}

// Compatibilidad explícita: una lápida sin signo no se convierte en una decisión nueva.
for(const version of [true,2])run('legacy-mark-'+version,()=>{
 const marker=c.obAbsorptionKey(purchase,version),deleted={[marker]:true};
 assert.equal(c.expenseIsTombstoned(purchase,deleted),true);
 assert.equal(c.expenseIsTombstoned(refund,deleted),true);
 assert.equal(server.filasComoLaApp([purchase,refund].map(toRow),[marker]).length,0);
});
for(const sign of [-1,1])for(const account of [undefined,'synthetic-account-a'])run('signed-mark-scope/'+sign+'/'+account,()=>{
 const gone={...purchase,amount:sign*12.34,obAcc:account},marker=c.obAbsorptionKey(gone),deleted={[marker]:true};
 assert.match(marker,/^ob-absorbed3\|/);assert.equal(marker.split('|').at(-1),String(sign));
 const otherSign={...gone,amount:sign===1?-12.34:12.34};
 assert.equal(c.expenseIsTombstoned(gone,deleted),true);
 assert.equal(c.expenseIsTombstoned(otherSign,deleted),false);
 assert.deepEqual(server.filasComoLaApp([toRow(gone),toRow(otherSign)],[marker]),[toRow(otherSign)]);
 for(const extra of [{extId:'different'},{date:'2026-10-16T12:00:00Z'},{obOrd:2},...(account?[{obAcc:'synthetic-account-b'}]:[])]){
  const e={...gone,...extra};assert.equal(c.expenseIsTombstoned(e,deleted),false);
  assert.equal(server.filasComoLaApp([toRow(e)],[marker]).length,1);
 }
 const noAccount={...gone,obAcc:undefined};assert.equal(c.expenseIsTombstoned(noAccount,deleted),true);
 assert.equal(server.filasComoLaApp([toRow(noAccount)],[marker]).length,0);
});
run('delete-link-roundtrip-and-legacy',()=>{
 const fresh=c.bankDeletionLink(purchase),merged=c.pushGemelos([],JSON.parse(JSON.stringify([fresh])));
 assert.equal(merged[0].bankRefV,2);assert.equal(merged[0].bankRefSign,1);
 const s=state([]);s.deleted=[c.keyOfExpense(purchase)];s.gemelos=merged;
 assert.equal(c.importObExpenses(s,[tx(refund)],[{aspsp:'CaixaBank',syncFrom:'2026-10-01'}]).length,1);
 const legacy={aviso:'',banco:c.keyOfExpense(purchase),bankRef:purchase.extId,ent:purchase.ent};
 s.gemelos=c.pushGemelos([legacy],[fresh]);assert.equal(s.gemelos[0].bankRefV,undefined);
 assert.equal(c.importObExpenses(s,[tx(refund)],[{aspsp:'CaixaBank',syncFrom:'2026-10-01'}]),null);
});
run('metadata-opposite-sign-keeps-own-note-account',()=>{
 const es=[{...purchase,note:undefined},{...refund,note:undefined,obAcc:'synthetic-account-b'}];
 const txs=es.map(e=>({...tx(e),note:e.amount>0?'purchase note':'refund note'}));
 const out=c.tagObAccountsFromBankTx(c.enrichNotesFromBankTx(es.map(e=>({...e,obAcc:undefined})),txs),txs);
 assert.equal(out[0].note,'purchase note');assert.equal(out[1].note,'refund note');
 assert.equal(out[0].obAcc,'synthetic-account-a');assert.equal(out[1].obAcc,'synthetic-account-b');
});

function withoutSignIn(name){
 const from='function '+name+'(',at=clientSource.indexOf(from);assert.ok(at>=0);
 const brace=clientSource.indexOf('{',at);
 return clientSource.slice(0,brace+1)+'const obReferenceKey=(bank,ref)=>String(bank||"")+"|"+ref;'+clientSource.slice(brace+1);
}
function moneyPair(f,path){const es=[f.purchase,f.refund],out=f.paths[path](es);assert.deepEqual({count:out.length,cents:f.net(out)},{count:2,cents:0});}
for(const [path,name] of [['merge','mergeExpenses'],['cloudBatch','mergeExpensesFromCloud'],['cloudSequential','mergeExpensesFromCloud'],['importBatch','importObExpenses'],['importSequential','importObExpenses']])run('mutant-index-'+path,()=>{
 const f=fixture(withoutSignIn(name));assert.throws(()=>moneyPair(f,path),assert.AssertionError);
});
run('mutant-index-server',()=>{
 const from='JSON.stringify([bank, decodeURIComponent(ref[1]), Number(f.importe)>0?1:Number(f.importe)<0?-1:0])';assert.ok(serverSource.includes(from));
 const f=fixture(clientSource,serverSource.replace(from,'JSON.stringify([bank, decodeURIComponent(ref[1])])'));
 assert.throws(()=>moneyPair(f,'server'),assert.AssertionError);
});
for(const name of ['flattenBankTx','histFlattenHistoryLinks'])run('mutant-index-'+name,()=>{
 const f=fixture(withoutSignIn(name)),t={ext_id:f.refund.extId,date:'2026-10-15',amount:-12.34,merchant:f.refund.merchant,status:'BOOK'};
 assert.throws(()=>{if(name==='flattenBankTx')assert.equal(f.c.flattenBankTx([{aspsp:'CaixaBank',truncated:true,transactions:[t]}],[f.tx(f.purchase)]).length,2);
 else assert.equal(f.c.histFlattenHistoryLinks({links:[{aspsp:'CaixaBank',accounts:[{uid:'a',transactions:[t]}]}]},[f.purchase],{}).out.length,1);},assert.AssertionError);
});
run('mutant-new-mark-client',()=>{
 const from='(legacy===2?"":"|"+obPolarity(e.amount))';assert.ok(clientSource.includes(from));
 const f=fixture(clientSource.replace(from,'(legacy===2?"":"|1")'));
 const marker=f.c.obAbsorptionKey(f.purchase);assert.throws(()=>assert.equal(f.c.expenseIsTombstoned(f.refund,{[marker]:true}),false),assert.AssertionError);
});
run('mutant-new-mark-server',()=>{
 const from='(legacy === 2 ? "" : "|" + (Number(f.importe)>0?1:Number(f.importe)<0?-1:0))';assert.ok(serverSource.includes(from));
 const f=fixture(clientSource,serverSource.replace(from,'(legacy === 2 ? "" : "|1")'));
 assert.throws(()=>assert.equal(f.server.filasComoLaApp([f.toRow(f.refund)],[f.c.obAbsorptionKey(f.purchase)]).length,1),assert.AssertionError);
});
run('mutant-deleted-reference-index',()=>{
 const f=fixture(withoutSignIn('importObExpenses')),s=f.state([]);
 s.deleted=[f.c.keyOfExpense(f.purchase)];s.gemelos=[f.c.bankDeletionLink(f.purchase)];
 assert.throws(()=>assert.equal((f.c.importObExpenses(s,[f.tx(f.refund)],[{aspsp:'CaixaBank',syncFrom:'2026-10-01'}])||[]).length,1),assert.AssertionError);
});
run('mutant-delete-link-loses-version',()=>{
 const from='g.bankRefV=2;g.bankRefSign=obPolarity(e.amount);';assert.ok(clientSource.includes(from));
 const f=fixture(clientSource.replace(from,'')),s=f.state([]);
 s.deleted=[f.c.keyOfExpense(f.purchase)];s.gemelos=f.c.pushGemelos([],[f.c.bankDeletionLink(f.purchase)]);
 assert.throws(()=>assert.equal((f.c.importObExpenses(s,[f.tx(f.refund)],[{aspsp:'CaixaBank',syncFrom:'2026-10-01'}])||[]).length,1),assert.AssertionError);
});

// Remates de revisión: una preautorización a cero nunca reserva la referencia del cargo.
for(const amount of [0,-0])for(const reverse of [false,true])for(const path of ['merge','cloudBatch','cloudSequential','server'])run('remate-zero/'+typeof amount+'/'+(Object.is(amount,-0)?'-0':amount)+'/'+reverse+'/'+path,()=>{
 const zero={...purchase,id:'zero-preauth',amount,obPending:true};
 const es=reverse?[purchase,zero]:[zero,purchase],out=paths[path](es);
 assert.equal(out.length,1);assert.equal(net(out),1234);assert.equal(out[0].id,purchase.id);
});
run('remate-zero-no-identity-or-visible-row',()=>{
 const zero={...purchase,amount:0};
 assert.equal(c.obReferenceKey(zero.ent,zero.extId,zero.amount),'');
 assert.equal(c.obAbsorptionKey(zero),null);
 assert.equal(c.expenseIsTombstoned(zero,{}),true);
 assert.equal(server.filasComoLaApp([toRow(zero)],[]).length,0);
 assert.equal(c.mergeExpensesFromCloud([zero],[]).changed,true);
});
for(const version of [true,2])for(const sign of [-1,1])for(const missing of ['row','mark','both'])run('remate-wildcard-v'+version+'/'+sign+'/'+missing,()=>{
 const gone={...purchase,amount:sign*12.34,obAcc:missing==='mark'||missing==='both'?undefined:purchase.obAcc};
 const marker=c.obAbsorptionKey(gone,version),deleted={[marker]:true};
 for(const amount of [12.34,-12.34]){
  const row={...purchase,amount,obAcc:missing==='row'||missing==='both'?undefined:purchase.obAcc};
  assert.equal(c.expenseIsTombstoned(row,deleted),true);
  assert.equal(server.filasComoLaApp([toRow(row)],[marker]).length,0);
  for(const patch of [{extId:'another-reference'},...(version===2?[{date:'2026-10-16T12:00:00Z'},{obOrd:2}]:[])]){
   const other={...row,...patch};assert.equal(c.expenseIsTombstoned(other,deleted),false);
   assert.equal(server.filasComoLaApp([toRow(other)],[marker]).length,1);
  }
 }
});

// Ronda 2: ejecutar los bloques reales de importación/aviso/subida y mezcla del pull.
function zeroCycle(f,raw=clientSource,initial=[]){
 const {c,state,purchase,toRow}=f,uploaded=[],notices=[],rounds=[];
 let s=state(initial);const ref={get current(){return s;}};
 const set=fn=>{s=fn(s);};class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
 const links=[{aspsp:'CaixaBank',syncFrom:'2026-10-01',transactions:[{ext_id:'zero-cycle',date:purchase.date.slice(0,10),amount:0,merchant:'Synthetic zero',status:'PDNG'}]}];
 const a=raw.indexOf('      set(function(prev){',raw.indexOf('obAckPend.current=')),b=raw.indexOf('      // INC-2909-03:',a);
 const p=raw.indexOf('      const delSet=expenseDeletedSet(',raw.indexOf('const syncCloudExpenses=')),q=raw.indexOf('        const rec=reconcileObDupes',p);
 assert.ok(a>=0&&b>a&&p>=0&&q>p,'bloques reales encontrados');
 const names=['flattenBankTx','importObExpenses','applyInvestBuy','cuotasDeDeudaPorMarcar','gemelosDeImportacion','pushGemelos','reconcileGemelosAutomaticos','enrichNotesFromBankTx','tagObAccountsFromBankTx','reconcileFixedPaymentProofs','reconcileEarlyIncomeAnchors','applyBankBalances','bankIssuesOf','expenseFromRow','expensesFromRows','expenseIsTombstoned','expenseDeletedSet','keyOfExpense','keepCategoryChoices','mergeExpensesFromCloud','fusionarGemelos'];
 const namesExtra=['set','links','dbLinks','DEUDA_CAT','Date','at','setTimeout','subirGasto','opts','showToast','tf','stateRef','rows','readStartedAt','cloudGemelos','cloud'];
 const invoke=(code,rows)=>new Function(...names,...namesExtra,code)(...names.map(n=>c[n]),set,links,[],{id:'deudas'},Clock,now,fn=>fn(),e=>uploaded.push(e),{},msg=>notices.push(msg),(k,o)=>[k,o.n],ref,rows,now,[],{});
 for(let i=0;i<3;i++){
  const u=uploaded.length,n=notices.length;
  invoke('let obAdded=[];'+raw.slice(a,b),[]);
  const previous=s.expenses;
  invoke(raw.slice(p,q)+'return base;\n      });',uploaded.map(toRow));
  if(initial.length)assert.ok(uploaded.slice(u).every(e=>initial.some(old=>old.id===e.id)),"solo backfill de filas locales previas");
  rounds.push({uploads:uploaded.length-u,notices:notices.length-n,rewrite:s.expenses!==previous,count:s.expenses.length});
 }
 return rounds;
}
run('zero-cycle-r2/three-real-sync-pull-rounds',()=>{
 const rounds=zeroCycle({c,state,purchase,toRow});console.log(JSON.stringify({zeroCycle:rounds}));
 assert.deepEqual(rounds,Array.from({length:3},()=>({uploads:0,notices:0,rewrite:false,count:0})));
});
for(const source of ['manual','wallet','macrodroid','supabase','ob','ob-hist'])for(const amount of [null,undefined,'0',0,12.34,-12.34])run('zero-cycle-r2/boundary/'+source+'/'+typeof amount+'/'+amount,()=>{
 const e={...purchase,source,amount},drop=(source==='ob'||source==='ob-hist')&&amount===0;
 assert.equal(c.expenseIsTombstoned(e,{}),drop);
 for(const out of [c.mergeExpenses([e],[]),c.mergeExpenses([],[e]),c.mergeExpensesFromCloud([e],[]),c.mergeExpensesFromCloud([],[e])]){
  assert.equal(out.list.length,drop?0:1);if(!drop)assert.equal(out.list[0],e,'preserva objeto local');
 }
 if(!drop)assert.equal(c.mergeExpensesFromCloud([e],[]).changed,false);
 if(source==='ob'||source==='ob-hist'){
  assert.equal(c.obReferenceKey(e.ent,e.extId,e.amount)==='',drop);
  assert.equal(c.obAbsorptionKey(e)===null,drop);
 }
});
run('zero-cycle-r2/import-zero-return-null',()=>{
 for(const amount of [0,-0])assert.equal(c.importObExpenses(state([]),[{...tx(purchase),amount,status:'PDNG'}],[{aspsp:'CaixaBank',syncFrom:'2026-10-01'}]),null);
});
run('zero-cycle-r2/nonzero-signs-and-distinct-reference',()=>{
 const es=[purchase,refund,{...purchase,extId:'another-ref',id:'another-id',amount:3.20}],out=ingest([],es);
 assert.equal(out.length,3);assert.equal(net(out),320);
});

run('zero-cycle-r2/local-other-sources-survive-real-pull',()=>{
 const initial=[{...purchase,source:'manual',amount:null},{...purchase,id:'notice-zero',source:'wallet',amount:0}];
 // El backfill previo de null sigue activo; ninguna subida es de la preautorización cero.
 assert.deepEqual(zeroCycle({c,state,purchase,toRow},clientSource,initial),Array.from({length:3},()=>({uploads:1,notices:0,rewrite:false,count:2})));
});
for(const [name,from,to,check] of [
 ['import-guard','if(tx.amount===0)return null;','',f=>assert.deepEqual(zeroCycle(f),Array.from({length:3},()=>({uploads:0,notices:0,rewrite:false,count:0})))],
 ['source-guard','e&&esFilaDeBanco(e)&&e.amount===0','e&&e.amount===0',f=>assert.equal(f.c.expenseIsTombstoned({...f.purchase,source:'manual',amount:0},{}),false)],
 ['null-coercion','esFilaDeBanco(e)&&e.amount===0','esFilaDeBanco(e)&&Number(e.amount)===0',f=>assert.equal(f.c.expenseIsTombstoned({...f.purchase,amount:null},{}),false)],
 ['cloud-source-guard','if(esFilaDeBanco(e)&&e.amount===0){zeroRemoved=true;return;}','if(e.amount===0){zeroRemoved=true;return;}',f=>assert.equal(f.c.mergeExpensesFromCloud([{...f.purchase,source:'manual',amount:0}],[]).list.length,1)]
])run('zero-cycle-r2/mutant/'+name,()=>{
 const changed=clientSource.replace(from,to);assert.notEqual(changed,clientSource,'mutacion aplicada');
 check({c,state,purchase,toRow});const f=fixture(changed);assert.throws(()=>check(f),{code:'ERR_ASSERTION'});
});
