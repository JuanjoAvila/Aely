import assert from 'node:assert/strict';
import {client,database,storage,expense,owner,id,other} from './expense-write-fixture.mjs';
let count=0;
async function test(name,fn){await fn();count++;console.log('  OK '+name);}
const operations=[['setExpenseBank','revolut'],['setExpenseDup',false],['setExpenseCat','super'],['setExpenseNote','A note'],['setExpenseNoCard',true],['setExpenseDeuda',null],['deleteExpense',null],['editExpense',{comercio:'Edited'}]];
for(const [method,value] of operations){
 const e=method==='setExpenseDeuda'?{...expense,debtId:'debt-fixture'}:expense;
 await test(method+' confirma propietario, UUID y rechaza cero filas',async()=>{
  const {cloud,db}=await client();await cloud[method](e,value);
  for(const q of db.calls){assert(q.filters.some(([k,v])=>k==='id'&&v===id));assert(q.filters.some(([k,v])=>k==='user_id'&&v===owner));}
  assert.equal(cloud.expenseWrites().length,0);
  const missing=await client(database({rows:[]}));await assert.rejects(()=>missing.cloud[method](e,value));assert.equal(missing.cloud.expenseWrites().length,1);
 });
 await test(method+' sesión perdida y ACK ajeno quedan pendientes',async()=>{
  const a=await client();a.db.login(null);await assert.rejects(()=>a.cloud[method](e,value));assert.equal(a.cloud.expenseWrites()[0].status,'session');assert.equal(a.db.calls.length,0);
  for(const badAck of [{id:other},{user_id:'other-owner'}]){const b=await client(database({badAck}));await assert.rejects(()=>b.cloud[method](e,value));assert.equal(b.cloud.expenseWrites().length,1);}
 });
}
await test('respuesta perdida después del UPDATE converge sin repetir escritura',async()=>{
 const db=database({afterWrite(){throw Error('lost response')}}), a=await client(db);
 await assert.rejects(()=>a.cloud.setExpenseDup(expense,false));const op=a.cloud.expenseWrites()[0];
 delete db.options.afterWrite;await a.cloud.retryExpenseWrite(op.opId);
 assert.equal(db.calls.filter(q=>q.patch).length,1);assert.equal(a.cloud.expenseWrites().length,0);
});
await test('dos clientes conservan banco, decisión y deuda ajenos',async()=>{
 const db=database();db.rows[0].source='ob:trade_republic~deuda.d1#dup';
 const a=await client(db),b=await client(db);
 await a.cloud.setExpenseDup(expense,false);await b.cloud.setExpenseBank(expense,'revolut');
 assert.equal(db.rows[0].source,'ob:revolut~deuda.d1');assert.equal(db.rows[0].cat,'bares');
});
await test('conflicto del mismo campo no gana por reintentar',async()=>{
 const db=database({beforeWrite(rows,n){if(n===1)rows[0].source='ob:sabadell#dup'}}),a=await client(db);
 await assert.rejects(()=>a.cloud.setExpenseBank(expense,'revolut'),/conflict/);assert.equal(db.rows[0].source,'ob:sabadell#dup');
});
await test('recarga conserva operación y otro usuario no la recibe',async()=>{
 const db=database(),saved=storage(),a=await client(db,saved);db.options.error=true;
 await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Persistent'));
 delete db.options.error;const b=await client(db,saved);assert.equal(b.cloud.expenseWrites().length,1);
 db.login('other-owner');await b.cloud.session();assert.equal(b.cloud.expenseWrites().length,0);
 db.login(owner);await b.cloud.session();await b.cloud.retryExpenseWrite(b.cloud.expenseWrites()[0].opId);assert.equal(db.rows[0].nota,'Persistent');
});
await test('DELETE perdido nunca se convierte en ACK de ausencia',async()=>{
 const db=database({afterWrite(){throw Error('lost delete')}}),a=await client(db);
 await assert.rejects(()=>a.cloud.deleteExpense(expense));delete db.options.afterWrite;
 await assert.rejects(()=>a.cloud.retryExpenseWrite(a.cloud.expenseWrites()[0].opId));assert.equal(db.rows.length,0);assert.equal(a.cloud.expenseWrites().length,1);
});
await test('sin almacenamiento durable no sale una escritura',async()=>{
 const a=await client();a.saved.setItem=()=>{throw Error('full')};await assert.rejects(()=>a.cloud.setExpenseDup(expense,false),/storage/);assert.equal(a.db.calls.length,0);
});
await test('modo pruebas no escribe ni encola operaciones reales',async()=>{
 const a=await client();a.c.mcSandbox=()=>true;await a.cloud.setExpenseDup(expense,false);await a.cloud.retryExpenseWrite('x');await a.cloud.editExpense(expense,{comercio:'Test'});assert.equal(a.db.calls.length,0);assert.equal(a.saved.length,0);
});
await test('timeout tras commit mantiene intención durable y el reintento no duplica',async()=>{
 const db=database({afterWrite:()=>new Promise(()=>{})}),a=await client(db);
 a.c.setTimeout=(fn,ms)=>setTimeout(fn,ms===10000?5:ms);
 await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Timeout'),/pending/);
 assert.equal(db.rows[0].nota,'Timeout');delete db.options.afterWrite;
 await a.cloud.retryExpenseWrite(a.cloud.expenseWrites()[0].opId);
 assert.equal(db.calls.filter(x=>x.patch).length,1);assert.equal(a.cloud.expenseWrites().length,0);
});
await test('sesión cambia durante UPDATE: su respuesta no acredita al nuevo usuario',async()=>{
 const db=database({afterWrite(){db.login('other-owner')}}),a=await client(db);
 await assert.rejects(()=>a.cloud.setExpenseNote(expense,'A'),/session/);
 assert.equal(a.cloud.expenseWrites().length,1);await a.cloud.session();assert.equal(a.cloud.expenseWrites().length,0);
});
await test('UUID divergente o legado nunca busca gemelo por atributos',async()=>{
 for(const missingId of ['legacy',other]){
  const a=await client();await assert.rejects(()=>a.cloud.setExpenseCat({...expense,id:missingId},'super'));
  assert.equal(a.db.rows[0].cat,'bares');assert.equal(a.db.calls.filter(x=>x.patch).length,0);
 }
});
await test('cola huérfana recuperada no se atribuye a una sesión nueva',async()=>{
 const db=database(),saved=storage();db.login(null);const a=await client(db,saved);
 await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Orphan'));
 db.login(owner);await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Orphan'));
 assert.equal(db.calls.length,0);await a.cloud.session();assert.equal(a.cloud.expenseWrites().length,0);
});
await test('Deshacer cancela intención antes de DELETE sin insertar ni borrar',async()=>{
 const a=await client();const promise=a.cloud.deleteExpense(expense,Date.now()+25);
 await new Promise(r=>setTimeout(r,2));assert.equal(a.cloud.cancelExpenseDelete(id),true);
 await promise;assert.equal(a.db.calls.length,0);assert.equal(a.db.rows.length,1);assert.equal(a.cloud.expenseWrites().length,0);
});
await test('dos gestos pendientes del mismo campo conservan orden y último valor',async()=>{
 const db=database({error:true}),a=await client(db);
 await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Primero'));
 await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Segundo'));
 const ops=a.cloud.expenseWrites();assert.equal(ops.length,2);delete db.options.error;
 await assert.rejects(()=>a.cloud.retryExpenseWrite(ops[1].opId));
 await a.cloud.retryExpenseWrite(ops[0].opId);await a.cloud.retryExpenseWrite(ops[1].opId);
 assert.equal(db.rows[0].nota,'Segundo');assert.equal(db.calls.filter(x=>x.patch).length,2);
});
await test('pull protege sólo campos pendientes y otro cliente adopta nota, banco y categoría manual',async()=>{
 const db=database(),a=await client(db),b=await client(db);
 db.rows[0].source='manual:trade_republic';
 const local={...b.c.expenseFromRow(db.rows[0]),note:'Anterior',noteEdited:true};
 await a.cloud.setExpenseBank(expense,'revolut');await a.cloud.setExpenseCat(expense,'super');await a.cloud.setExpenseNote(expense,'Nueva');
 const fromA=b.c.expenseFromRow(db.rows[0]),merged=b.c.mergeExpensesFromCloud([local],[fromA],Date.now()+1).list[0];
 assert.equal(merged.ent,'revolut');assert.equal(merged.category,'super');assert.equal(merged.note,'Nueva');
 db.options.error=true;await assert.rejects(()=>b.cloud.setExpenseNote(expense,'Local sin red'));
 const current={...merged,note:'Local sin red'},pull=b.c.mergeExpensesFromCloud([current],[{...fromA,amount:25}],Date.now()+1).list[0];
 assert.equal(pull.note,'Local sin red');assert.equal(pull.amount,25);
});
await test('lectura anterior a dos ACK no deshace ninguno; edición conserva una sola fila',async()=>{
 const a=await client(),old=a.c.expenseFromRow(a.db.rows[0]),before=Date.now()-1;
 await a.cloud.setExpenseNote(expense,'Nueva');await a.cloud.editExpense(expense,{comercio:'Renamed',fecha:'2026-10-11T10:00:00.000Z'});
 const current=a.c.expenseFromRow(a.db.rows[0]),r=a.c.mergeExpensesFromCloud([current],[old],before);
 assert.equal(r.list.length,1);assert.equal(r.list[0].note,'Nueva');assert.equal(r.list[0].merchant,'Renamed');
 const b=await client(a.db),r2=b.c.mergeExpensesFromCloud([old],[current],Date.now()+1);
 assert.equal(r2.list.length,1);assert.equal(r2.list[0].merchant,'Renamed');assert.equal(r2.list[0].date,current.date);
});
await test('borrado pendiente no resucita por un cambio remoto de comercio',async()=>{
 const a=await client();a.db.options.error=true;await assert.rejects(()=>a.cloud.deleteExpense(expense));
 const incoming={...a.c.expenseFromRow(a.db.rows[0]),merchant:'Other name'};
 assert.equal(a.c.mergeExpensesFromCloud([],[incoming],Date.now()).list.length,0);
});
await test('nota y categoría conservan orígenes Wallet/TR y retirar deuda conserva #dup',async()=>{
 for(const source of ['wallet','tr','macrodroid']){
  const a=await client();a.db.rows[0].source=source;await a.cloud.setExpenseNote(expense,'Nota');await a.cloud.setExpenseCat(expense,'super');assert.equal(a.db.rows[0].source,source);
 }
 const a=await client();a.db.rows[0].source='ob:revolut~deuda.fixture#dup';await a.cloud.setExpenseCat(expense,'super');assert.equal(a.db.rows[0].source,'ob:revolut#dup');
});
await test('la cola observa el ACK de otra pestaña sin conservar un fantasma',async()=>{
 const db=database({error:true}),saved=storage(),a=await client(db,saved);await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Otra pestaña'));
 const b=await client(db,saved);assert.equal(b.cloud.expenseWrites().length,1);delete db.options.error;
 await a.cloud.retryExpenseWrite(a.cloud.expenseWrites()[0].opId);assert.equal(b.cloud.expenseWrites().length,0);
});
await test('ACK de fecha acepta el mismo instante con zona serializada por Postgres',async()=>{
 const db=database({afterWrite(row){row.fecha='2026-10-11T10:00:00+00:00'}}),a=await client(db);
 await a.cloud.editExpense(expense,{fecha:'2026-10-11T10:00:00.000Z'});assert.equal(a.cloud.expenseWrites().length,0);
});
await test('sesión caducada no permite consultar ni escribir',async()=>{
 const a=await client();a.db.sb.auth.getSession=async()=>({data:{session:{user:{id:owner},expires_at:1}}});
 await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Expired'),/session/);assert.equal(a.db.calls.length,0);
});
await test('ACK sin el campo solicitado no confirma aunque coincidan dueño y UUID',async()=>{
 const a=await client(database({afterWrite(row){delete row.nota}}));await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Missing'),/identity/);
 assert.equal(a.cloud.expenseWrites().length,1);
});
await test('el conflicto sólo toma una base nueva tras decisión explícita',async()=>{
 const db=database({beforeWrite(rows,n){if(n===1)rows[0].source='ob:sabadell#dup'}}),a=await client(db);
 await assert.rejects(()=>a.cloud.setExpenseBank(expense,'revolut'),/conflict/);
 const op=a.cloud.expenseWrites()[0];await assert.rejects(()=>a.cloud.retryExpenseWrite(op.opId),/conflict/);
 await a.cloud.retryExpenseWrite(op.opId,true);assert.equal(db.rows[0].source,'ob:revolut#dup');
});
await test('un lote no adelanta una edición pendiente de su segundo UUID',async()=>{
 const db=database({error:true});db.rows.push({...db.rows[0],id:other});const a=await client(db);
 await assert.rejects(()=>a.cloud.setExpenseNote({...expense,id:other},'Antes del lote'));
 delete db.options.error;await assert.rejects(()=>a.cloud.deleteExpensesByIds([id,other]));
 assert.equal(db.calls.filter(q=>q.deleted).length,0);assert.equal(db.rows.length,2);
});
await test('caducar la sesión no oculta la intención y recuperarla permite reintentar',async()=>{
 const a=await client();a.db.login(null);await a.cloud.session();
 await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Conservar sin sesión'));
 const op=a.cloud.expenseWrites()[0];assert.equal(op.owner,owner);assert.equal(op.status,'session');
 a.db.login(owner);await a.cloud.session();await a.cloud.retryExpenseWrite(op.opId);assert.equal(a.db.rows[0].nota,'Conservar sin sesión');
});
await test('pull de cuota TR/Wallet no borra el vínculo que source no transporta',async()=>{
 for(const source of ['macrodroid','wallet']){
  const a=await client();a.db.rows[0].source=source;await a.cloud.setExpenseDeuda({...expense,debtId:'debt-fixture'});
  const incoming=a.c.expenseFromRow(a.db.rows[0]),local={...incoming,debtId:'debt-fixture'};
  const r=a.c.mergeExpensesFromCloud([local],[incoming],Date.now()+1);assert.equal(r.list[0].debtId,'debt-fixture');assert.equal(r.list[0].category,'deudas');
 }
});
await test('volver al primer valor después de otro gesto crea la última intención',async()=>{
 const db=database({error:true}),a=await client(db);
 for(const value of ['Primero','Segundo','Primero'])await assert.rejects(()=>a.cloud.setExpenseNote(expense,value));
 const ops=a.cloud.expenseWrites();assert.equal(ops.length,3);delete db.options.error;
 for(const op of ops)await a.cloud.retryExpenseWrite(op.opId);
 assert.equal(db.rows[0].nota,'Primero');assert.equal(db.calls.filter(q=>q.patch).length,3);
});
await test('categoría, cuota y categoría inicial conservan las tres intenciones',async()=>{
 const db=database({error:true}),a=await client(db);
 await assert.rejects(()=>a.cloud.setExpenseCat(expense,'super'));
 await assert.rejects(()=>a.cloud.setExpenseDeuda({...expense,debtId:'debt-fixture'}));
 await assert.rejects(()=>a.cloud.setExpenseCat(expense,'super'));
 const ops=a.cloud.expenseWrites();assert.equal(ops.length,3);delete db.options.error;
 for(const op of ops)await a.cloud.retryExpenseWrite(op.opId);
 assert.equal(db.rows[0].cat,'super');assert.equal(db.rows[0].source,'ob:trade_republic#dup');
});
await test('tres escrituras en vuelo esperan a su predecesora inmediata',async()=>{
 const writes=[],db=database({async beforeWrite(rows,n){await new Promise(r=>setTimeout(r,n===2?15:1));},afterWrite(row){writes.push(row.nota)}}),a=await client(db);
 await Promise.all(['Primera','Segunda','Tercera'].map(v=>a.cloud.setExpenseNote(expense,v)));
 assert.deepEqual(writes,['Primera','Segunda','Tercera']);assert.equal(db.rows[0].nota,'Tercera');assert.equal(a.cloud.expenseWrites().length,0);
});
console.log('expense-write-contracts: '+count+' PASS');
