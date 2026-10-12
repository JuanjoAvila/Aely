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
 ['borrado perdido no acredita ausencia','const row=r.data;','const row=r.data; if(!row) return {id:id,user_id:op.owner};',async make=>{
   const db=database({rows:[]}),a=await make(db);await assert.rejects(()=>a.cloud.deleteExpense(expense));
 }],
 ['aislamiento titular','.filter(function(op){ return op.owner===owner; })','.filter(function(op){ return true; })',async make=>{
   const db=database({error:true}),a=await make(db);await assert.rejects(()=>a.cloud.setExpenseNote(expense,'New'));
   db.login('other-owner');await a.cloud.session();assert.equal(a.cloud.expenseWrites().length,0);
 }],
 ['pull conserva intención','if(guard[k]) return;','if(false) return;',async make=>{
   const db=database({error:true}),a=await make(db);await assert.rejects(()=>a.cloud.setExpenseNote(expense,'New'));
   const old=a.c.expenseFromRow(db.rows[0]);assert.equal(a.c.mergeExpensesFromCloud([{...old,note:'New'}],[old],Date.now()).list[0].note,'New');
 }],
 ['identidad sin gemelos','if(!isExpenseUuid(id)) throw mcExpenseFailure("identity");','if(!isExpenseUuid(id)) id="'+id+'";',async make=>{
   const a=await make();await assert.rejects(()=>a.cloud.setExpenseNote({...expense,id:'legacy'},'New'));assert.equal(a.db.calls.length,0);
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
