// Cada guardián pasa en código real y tiene que fallar al retirar su protección.
import assert from 'node:assert/strict';
import {client,database,storage,expense,id,owner,other} from './expense-write-fixture.mjs';
const cases=[
 ['ACK dueño','w.data.user_id!==op.owner || ','',async make=>{
   const a=await make(database({badAck:{user_id:'other-owner'}}));await assert.rejects(()=>a.cloud.setExpenseNote(expense,'New'));
 }],
 ['ACK UUID','String(w.data.id).toLowerCase()!==id.toLowerCase()','false',async make=>{
   const a=await make(database({badAck:{id:other}}));await assert.rejects(()=>a.cloud.setExpenseNote(expense,'New'));
 }],
 ['cero filas','if(!w.data) continue;','if(!w.data) return row;',async make=>{
   const a=await make(database({zeroAck:true}));await assert.rejects(()=>a.cloud.setExpenseNote(expense,'New'));
 }],
 ['cola durable','localStorage.setItem(mcExpenseOpKey(op),JSON.stringify(op));','void 0;',async make=>{
   const db=database({error:true}),saved=storage(),a=await make(db,saved);await assert.rejects(()=>a.cloud.setExpenseNote(expense,'New'));
   const b=await make(db,saved);assert.equal(b.cloud.expenseWrites().length,1);
 }],
 ['reintento idempotente','if(same) return row;','if(false) return row;',async make=>{
   const db=database({afterWrite(){throw Error('lost')}}),a=await make(db);await assert.rejects(()=>a.cloud.setExpenseNote(expense,'New'));
   delete db.options.afterWrite;await a.cloud.retryExpenseWrite(a.cloud.expenseWrites()[0].opId);assert.equal(db.calls.filter(x=>x.patch).length,1);
 }],
 ['CAS conserva campo ajeno','conditions.forEach(function(k){ q=row[k]==null?q.is(k,null):q.eq(k,row[k]); });','void 0;',async make=>{
   const db=database({beforeWrite(rows,n){if(n===1)rows[0].source='ob:trade_republic'}}),a=await make(db);
   await a.cloud.setExpenseBank(expense,'revolut');assert.equal(db.rows[0].source,'ob:revolut');
 }],
 ['conflicto mismo campo','else if(!same && !mcExpenseSame(op.bases[id],base))','else if(false)',async make=>{
   const db=database({beforeWrite(rows,n){if(n===1)rows[0].source='ob:sabadell#dup'}}),a=await make(db);
   await assert.rejects(()=>a.cloud.setExpenseBank(expense,'revolut'),/conflict/);
 }],
 ['sesión al confirmar','if(w.error) throw w.error;\n    await mcExpenseAuth(sb,op.owner,epoch);','if(w.error) throw w.error;',async make=>{
   const db=database({afterWrite(){db.login('other-owner')}}),a=await make(db);await assert.rejects(()=>a.cloud.setExpenseNote(expense,'New'),/session/);
 }],
 ['ausencia exige sesión vigente','const rows=await mcExpenseFind(sb,op,id,epoch);\n    await mcExpenseAuth(sb,op.owner,epoch);','const rows=await mcExpenseFind(sb,op,id,epoch);',async make=>{
   const db=database({rows:[],before(){db.login(null)}}),a=await make(db);await assert.rejects(()=>a.cloud.deleteExpense(expense));
 }],
 ['aislamiento titular','.filter(function(op){ return op.owner===owner; })','.filter(function(op){ return true; })',async make=>{
   const db=database({error:true}),a=await make(db);await assert.rejects(()=>a.cloud.setExpenseNote(expense,'New'));
   db.login('other-owner');await a.cloud.session();assert.equal(a.cloud.expenseWrites().length,0);
 }],
 ['pull conserva intención','if(guard[k]) return;','if(false) return;',async make=>{
   const db=database({error:true}),a=await make(db);await assert.rejects(()=>a.cloud.setExpenseNote(expense,'New'));
   const old=a.c.expenseFromRow(db.rows[0]);assert.equal(a.c.mergeExpensesFromCloud([{...old,note:'New'}],[old],Date.now()).list[0].note,'New');
 }],
 ['identidad sin gemelos','if(rows.length!==1) throw mcExpenseFailure("identity");','if(!rows.length) throw mcExpenseFailure("identity");',async make=>{
   const db=database();db.rows.push({...db.rows[0],id:other});const a=await make(db);await assert.rejects(()=>a.cloud.setExpenseNote({...expense,id:'legacy'},'New'));assert.equal(db.calls.filter(q=>q.patch).length,0);
 }],
 ['último gesto entre tipos','return !x.cancelled &&','return x.kind===kind && !x.cancelled &&',async make=>{
   const a=await make(database({error:true}));await assert.rejects(()=>a.cloud.setExpenseCat(expense,'super'));
   await assert.rejects(()=>a.cloud.setExpenseDeuda({...expense,debtId:'debt-fixture'}));await assert.rejects(()=>a.cloud.setExpenseCat(expense,'super'));
   assert.equal(a.cloud.expenseWrites().length,3);
 }],
 ['orden de tres vuelos','mcExpensePending(op.owner).slice().reverse().find','mcExpensePending(op.owner).find',async make=>{
   const writes=[],a=await make(database({async beforeWrite(rows,n){await new Promise(r=>setTimeout(r,n===2?15:1));},afterWrite(row){writes.push(row.nota)}}));
   const results=await Promise.allSettled(['Primera','Segunda','Tercera'].map(v=>a.cloud.setExpenseNote(expense,v)));
   assert(results.every(x=>x.status==='fulfilled'));assert.deepEqual(writes,['Primera','Segunda','Tercera']);
 }],
 ['Deshacer después del intento','!ops.length || ops.some(function(x){ return x.attempted; })','!ops.length',async make=>{
   const a=await make(database({afterWrite(){throw Error('lost')}}));await assert.rejects(()=>a.cloud.deleteExpense(expense));assert.equal(a.cloud.cancelExpenseDelete(id),false);
 }],
 ['adoptar edición remota posterior al ACK','readStartedAt<=a.at','true',async make=>{
   const a=await make();await a.cloud.setExpenseNote(expense,'Local');const local=a.c.expenseFromRow(a.db.rows[0]);a.db.rows[0].nota='Remote';
   assert.equal(a.c.mergeExpensesFromCloud([local],[a.c.expenseFromRow(a.db.rows[0])],Date.now()+1).list[0].note,'Remote');
 }],
 ['epoch al volver al mismo titular','s.user.id!==owner || epoch!==_mcExpenseEpoch','s.user.id!==owner',async make=>{
   let a;const db=database({afterWrite(){a.c.mcExpenseSession({user:{id:'other-owner'}});a.c.mcExpenseSession({user:{id:owner}})}});a=await make(db);
   await assert.rejects(()=>a.cloud.setExpenseNote(expense,'New'),/session/);
 }],
 ['backfill no convierte edición en alta','&& !guards[e.id] && !e.catStale','&& !e.catStale',async make=>{
   const a=await make(database({error:true}));await assert.rejects(()=>a.cloud.editExpense(expense,{comercio:'Edited'}));
   assert.equal(a.c.backfillExpenseCandidates([{...expense,merchant:'Edited'}],[],Date.now()+1).length,0);
 }],
 ['DELETE compara la fila leída','Object.keys(row).filter(function(k){ return k!=="id"&&k!=="user_id"; })','[]',async make=>{
   const a=await make(database({beforeWrite(rows,n){if(n===1) rows[0].importe=19}}));await assert.rejects(()=>a.cloud.deleteExpense(expense),/conflict/);assert.equal(a.db.rows.length,1);
 }],
 ['colisión índice único es conflicto','err&&err.code==="23505"?"conflict"','false?"conflict"',async make=>{
   const db=database({unique:true});db.rows.push({...db.rows[0],id:other,comercio:'Other'});const a=await make(db);
   await assert.rejects(()=>a.cloud.editExpense(expense,{comercio:'Other'}));assert.equal(a.cloud.expenseWrites()[0].status,'conflict');
 }],
 ['edición restringida a columnas permitidas','Object.keys(v).some(function(x){ return allowed.indexOf(x)<0; })','false',async make=>{
   const a=await make();await assert.rejects(()=>a.cloud.editExpense(expense,{ingest_event_id:'injected'}));assert.equal(a.db.rows[0].ingest_event_id,undefined);
 }],
];
for(const [name,from,to,check] of cases){
 await check(client);
 let applied=false;
 const mutate=source=>{source=source.replaceAll('\r\n','\n');assert.equal(source.split(from).length,2,'mutación inequívoca: '+name);applied=true;return source.replace(from,to)};
 let killed=false;
 try{await check((db,saved)=>client(db,saved,mutate))}catch(e){if(e.name!=='AssertionError')throw e;killed=true;}
 assert(applied,'mutación no ejecutada: '+name);assert(killed,'mutación superviviente: '+name);console.log('  KILLED '+name);
}
console.log('expense-write-mutations: '+cases.length+'/'+cases.length+' KILLED');
