// Cada guardián pasa en código real y tiene que fallar al retirar su protección.
import assert from 'node:assert/strict';
import {client,database,storage,expense,id,owner,other} from './expense-write-fixture.mjs';
const cases=[
 ['lector de deuda histórica', 'ent=pe.ent; debtId=pe.debtId; reciboId=pe.reciboId; source="ob-hist";', 'ent=pe.ent; reciboId=pe.reciboId; source="ob-hist";', async make=>{
  const a=await make(),row={...a.db.rows[0],source:'ob-hist:trade_republic~deuda.d#dup#n2'};assert.equal(a.c.expenseFromRow(row).debtId,'d');
 }],
 ['escritor de deuda histórica','return "ob-hist:"+ent+(deudaSufijo(e&&e.debtId)||reciboSufijo(e&&e.reciboId))','return "ob-hist:"+ent+reciboSufijo(e&&e.reciboId)',async make=>{
  const a=await make();assert.equal(a.c.expenseSourceForCloud({...expense,source:'ob-hist',debtId:'d',obOrd:2}),'ob-hist:trade_republic~deuda.d#dup#n2');
 }],
 ['decidir deuda en histórico','if(p.origin==="ob" || p.origin==="ob-hist"){ p.debt=', 'if(p.origin==="ob"){ p.debt=',async make=>{
  const a=await make();assert.equal(a.c.mcExpensePatch({source:'ob-hist:trade_republic~recibo.r#dup#n2'},{kind:'debt',value:'d'}).source,'ob-hist:trade_republic~deuda.d#dup#n2');
 }],
 ['ACK adopta ordinal','if(Object.prototype.hasOwnProperty.call(incoming,"obOrd")) put("obOrd",incoming.obOrd);','',async make=>{
  const a=await make(),row={...a.db.rows[0],source:'ob:trade_republic#dup#n2'};
  const next=a.c.mcExpenseApplyEvent({expenses:[expense],settings:{},deleted:[]},{type:'ack',oldId:id,id,at:Date.now(),op:{kind:'note'},row},{});
  assert.equal(next.expenses[0].obOrd,2);
 }],
 ['deuda sustituye recibo local','if(exact) put("reciboId",undefined);','',async make=>{
  const a=await make(),local={...expense,reciboId:'r'},incoming={...expense,debtId:'d',category:'deudas'};
  assert.equal(a.c.refreshExpenseFromCloud(local,incoming,Date.now(),{}).reciboId,undefined);
 }],
 ['pull protege recibo decidido sin red','category:["category","debtId","reciboId"],\n      debt:["category","debtId","reciboId"]','category:["category","debtId"],\n      debt:["category","debtId"]',async make=>{
  const db=database({error:true});db.rows[0].source='ob:trade_republic~recibo.r#dup';const a=await make(db),local={...expense,reciboId:'r'};
  await assert.rejects(()=>a.cloud.setExpenseCat(local,'super'));
  const out=a.c.mergeExpensesFromCloud([{...local,category:'super'}],[{...expense,category:'deudas',debtId:'d'}],Date.now());assert.equal(out.list[0].reciboId,'r');assert.equal(out.list[0].category,'super');
 }],
 ['ausencia respeta ordinal de lápida','const e=expenseFromRow(Object.assign({},op.snapshot,{id:op.originalId||op.id}));','const s=op.snapshot,e={id:op.originalId||op.id,date:s.fecha,amount:s.importe,merchant:s.comercio,source:s.source};',async make=>{
  const a=await make(database({error:true,rows:[]}));await assert.rejects(()=>a.cloud.setExpenseNote({...expense,obOrd:2},'Nota'));delete a.db.options.error;
  await a.cloud.drainExpenseWrites({expenses:[],deleted:[a.c.keyOfExpense(expense)]});assert.equal(a.cloud.expenseWrites().length,1);
 }],
 ['descarte respeta ordinal de lápida','removeKeys[keyOfExpense(expenseFromRow(Object.assign({},event.op.snapshot,{id:oldId})))]=1;','const s=event.op.snapshot; removeKeys[keyOfExpense({id:oldId,date:s.fecha,amount:s.importe,merchant:s.comercio,source:s.source})]=1;',async make=>{
  const a=await make(database({error:true,rows:[]})),local={...expense,obOrd:2};await assert.rejects(()=>a.cloud.setExpenseNote(local,'Nota'));delete a.db.options.error;
  const ev=await a.cloud.discardExpenseWrite(a.cloud.expenseWrites()[0].opId),first=a.c.keyOfExpense(expense),second=a.c.keyOfExpense(local);
  assert.deepEqual(Array.from(a.c.mcExpenseApplyEvent({expenses:[],settings:{},deleted:[first,second]},ev,{}).deleted),[first]);
 }],
 ['unión espera banco pendiente','if(guard.ent || guard.source || guard.reciboId || guard.debtId || guard.deleted) return false;','',async make=>{
  const db=database({error:true});db.rows[0].source='ob:trade_republic~recibo.r#dup';const a=await make(db),local={...expense,reciboId:'r'};await assert.rejects(()=>a.cloud.setExpenseBank(local,'revolut'));
  const out=a.c.mergeExpensesFromCloud([{...local,ent:'revolut'}],[{...expense,id:other,source:'macrodroid'}],Date.now());assert.equal(out.list[0].ent,'revolut');assert.equal(out.sinMarca.length,0);
 }],

 ['ordinal conservado al escribir','+(p.ordinal||"")','',async make=>{
   const a=await make(),source='ob:trade_republic~recibo.r#dup#n2';assert.equal(a.c.mcExpenseSource(a.c.mcExpenseSourceParts(source)),source);
 }],
 ['recibo conservado al escribir','+(p.receipt||"")','',async make=>{
   const a=await make(),source='ob:trade_republic~recibo.r#dup#n2';assert.equal(a.c.mcExpenseSource(a.c.mcExpenseSourceParts(source)),source);
 }],
 ['ordinal mínimo y canónico','Number(m[6])<2 || String(Number(m[6]))!==m[6]','false',async make=>{
   const a=await make();assert.throws(()=>a.c.mcExpenseSourceParts('ob:trade_republic#n1'),/identity/);
 }],
 ['ordinal máximo de seis dígitos','(#n([0-9]{1,6}))','(#n([0-9]{1,7}))',async make=>{
   const a=await make();assert.throws(()=>a.c.mcExpenseSourceParts('ob:trade_republic#n1000000'),/identity/);
 }],
 ['escritor valida el source resultante','mcExpenseSourceParts(source); return source;','return source;',async make=>{
   const a=await make();assert.throws(()=>a.c.mcExpensePatch({source:'ob:trade_republic#n2'},{kind:'bank',value:''}),/identity/);
 }],
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
 ['respuesta tardía tras logout no repersiste','if(epoch===_mcExpenseEpoch){ try{ mcExpensePersist(op); }catch(e){} }','try{ mcExpensePersist(op); }catch(e){}',async make=>{
   const db=database(),saved=storage(),a=await make(db,saved),b=await make(db,saved);let release;
   db.options.before=()=>new Promise(r=>{release=r});db.sb.auth.signOut=async()=>{db.login(null);a.c.mcExpenseSession(null);return {}};
   const p=a.cloud.setExpenseNote(expense,'Private');while(!release)await new Promise(r=>setTimeout(r,1));
   await b.cloud.signOut();delete db.options.before;release();await assert.rejects(()=>p);assert.equal(saved.length,0);
 }],
 ['autenticación tardía tras logout no repersiste','if(epoch===_mcExpenseEpoch){ op.status="session"; mcExpensePersist(op); }','op.status="session"; mcExpensePersist(op);',async make=>{
   const db=database(),saved=storage(),a=await make(db,saved),b=await make(db,saved);let release;
   db.options.auth=()=>new Promise(r=>{release=r});db.sb.auth.signOut=async()=>{db.login(null);a.c.mcExpenseSession(null);return {}};
   const p=a.cloud.setExpenseNote(expense,'Private');while(!release)await new Promise(r=>setTimeout(r,1));
   await b.cloud.signOut();delete db.options.auth;release();await assert.rejects(()=>p);assert.equal(saved.length,0);
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
