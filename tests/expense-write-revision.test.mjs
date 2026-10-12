import assert from 'node:assert/strict';
import {client,database,storage,expense,owner,id,other} from './expense-write-fixture.mjs';
let passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log('  OK '+name)}catch(e){failed++;console.error('  FAIL '+name+': '+e.message)}}
await test('gesto sin red conserva la base anterior al cambio remoto',async()=>{
 const db=database({error:true}),a=await client(db);
 await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Local'));
 db.rows[0].nota='Otro móvil';db.rows[0].nota_edit=true;delete db.options.error;
 await assert.rejects(()=>a.cloud.retryExpenseWrite(a.cloud.expenseWrites()[0].opId),/conflict/);
 assert.equal(db.rows[0].nota,'Otro móvil');
});
await test('drenado ordenado recupera sesión y no repite un conflicto en bucle',async()=>{
 const db=database({error:true}),a=await client(db);
 await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Primero'));
 await assert.rejects(()=>a.cloud.setExpenseNote({...expense,note:'Primero',noteEdited:true},'Segundo'));
 delete db.options.error;await a.cloud.drainExpenseWrites();
 assert.equal(db.rows[0].nota,'Segundo');assert.equal(a.cloud.expenseWrites().length,0);
});
await test('borrar y cerrar antes de cinco segundos conserva el plazo durable',async()=>{
 const db=database(),saved=storage(),a=await client(db,saved);a.db.login(null);
 await assert.rejects(()=>a.cloud.deleteExpense(expense,Date.now()-1));
 db.login(owner);const b=await client(db,saved);await b.cloud.drainExpenseWrites();
 assert.equal(db.rows.length,0);assert.equal(b.cloud.expenseWrites().length,0);
});
await test('fila borrada remotamente cierra DELETE y descartar una edición ausente',async()=>{
 const a=await client(database({rows:[]}));await a.cloud.deleteExpense(expense);assert.equal(a.cloud.expenseWrites().length,0);
 await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Ausente'));
 const result=await a.cloud.discardExpenseWrite(a.cloud.expenseWrites()[0].opId);
 assert.equal(result.row,null);assert.equal(a.cloud.expenseWrites().length,0);
});
await test('importe se redondea antes de encolar y confirmar',async()=>{
 const a=await client(database({error:true}));await assert.rejects(()=>a.cloud.editExpense(expense,{importe:12.345}));
 assert.equal(a.cloud.expenseWrites()[0].value.importe,12.35);delete a.db.options.error;
 await a.cloud.drainExpenseWrites();assert.equal(a.db.rows[0].importe,12.35);
});
await test('sin titular aceptado no nace una operación huérfana',async()=>{
 const db=database();db.login(null);const a=await client(db);await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Sin dueño'));
 assert.equal(a.saved.length,0);
});
await test('legado y UUID divergente se realinean por clave exacta única',async()=>{
 for(const localId of ['legacy',other]){const a=await client();await a.cloud.setExpenseNote({...expense,id:localId},'Exacto');assert.equal(a.db.rows[0].nota,'Exacto');assert.equal(a.cloud.expenseWrites().length,0);}
});
await test('dos identidades exactas no autorizan escoger una',async()=>{
 const db=database();db.rows.push({...db.rows[0],id:other});const a=await client(db);
 await assert.rejects(()=>a.cloud.setExpenseNote({...expense,id:'legacy'},'Ambiguo'),/identity|conflict/);
 assert.equal(db.calls.filter(q=>q.patch).length,0);
});
await test('son distintos restaura el origen de la notificación TR',async()=>{
 const a=await client();a.db.rows[0].ingest_event_id='synthetic-event';
 await a.cloud.setExpenseDup({...expense,source:'macrodroid'},false);assert.equal(a.db.rows[0].source,'macrodroid');
});
await test('cerrar sesión borra las claves sensibles y no deja que un vuelo las resucite',async()=>{
 const a=await client(database({error:true}));await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Privado'));
 a.db.sb.auth.signOut=async()=>({error:null});await a.cloud.signOut();assert.equal(a.saved.length,0);assert.equal(a.cloud.expenseWrites().length,0);
});
await test('descartar conflicto restaura el remoto y retira la cadena de intenciones',async()=>{
 const a=await client(database({error:true}));await assert.rejects(()=>a.cloud.editExpense(expense,{comercio:'Local'}));
 await assert.rejects(()=>a.cloud.setExpenseNote({...expense,merchant:'Local'},'Nota local'));
 delete a.db.options.error;const ev=await a.cloud.discardExpenseWrite(a.cloud.expenseWrites()[0].opId);
 const s={expenses:[{...expense,merchant:'Local',note:'Nota local'}],settings:{},deleted:[a.c.keyOfExpense(expense)]};
 const next=a.c.mcExpenseApplyEvent(s,ev,{});assert.equal(next.expenses[0].merchant,expense.merchant);assert.equal(next.expenses[0].note,undefined);
 assert.equal(a.cloud.expenseWrites().length,0);assert.equal(next.deleted.length,0);assert.equal(a.db.calls.filter(q=>q.patch||q.deleted).length,0);
});
await test('no hay descarte si falla la lectura o cambia el titular',async()=>{
 const a=await client(database({error:true}));await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Privado'));
 const op=a.cloud.expenseWrites()[0];await assert.rejects(()=>a.cloud.discardExpenseWrite(op.opId));assert.equal(a.cloud.expenseWrites().length,1);
 delete a.db.options.error;a.db.options.before=()=>a.db.login('other-owner');await assert.rejects(()=>a.cloud.discardExpenseWrite(op.opId),/session/);assert.equal(a.saved.length,1);
});
await test('un disparador no reintenta el mismo fallo hasta vaciar la cola',async()=>{
 const a=await client(database({error:true}));await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Offline'));a.db.calls.length=0;
 await Promise.all([a.cloud.drainExpenseWrites(),a.cloud.drainExpenseWrites()]);assert.equal(a.db.calls.length,1);
});
await test('reabrir dentro de la ventana de Deshacer programa sólo el plazo restante',async()=>{
 const db=database(),saved=storage(),a=await client(db,saved);db.login(null);await assert.rejects(()=>a.cloud.deleteExpense(expense,Date.now()+35));
 db.login(owner);const b=await client(db,saved);await b.cloud.drainExpenseWrites();assert.equal(db.rows.length,1);
 await new Promise(r=>setTimeout(r,65));assert.equal(db.rows.length,0);assert.equal(b.cloud.expenseWrites().length,0);
});
await test('ausencia con lápida de una fila retirada cierra intención de edición',async()=>{
 const a=await client(database({error:true,rows:[]}));await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Pendiente'));
 delete a.db.options.error;await a.cloud.drainExpenseWrites({expenses:[],deleted:[a.c.keyOfExpense(expense)]});assert.equal(a.cloud.expenseWrites().length,0);
});
await test('realinear conserva orden manual y vínculo possibleDupOf',async()=>{
 const a=await client();let state={expenses:[{...expense,id:'legacy'},{...expense,id:other,possibleDupOf:'legacy'}],settings:{expenseOrder:{day:['legacy',other]}},deleted:[]};
 a.c.mcOnExpenseWrites(ev=>{if(ev)state=a.c.mcExpenseApplyEvent(state,ev,a.c.mcExpenseReadGuards(Infinity))});
 await a.cloud.setExpenseNote({...expense,id:'legacy'},'Realineado');assert.equal(state.expenses[0].id,id);assert.equal(state.expenses[0].note,'Realineado');
 assert.equal(state.expenses[1].possibleDupOf,id);assert.equal(state.settings.expenseOrder.day[0],id);
});
await test('datos sintéticos representativos: sólo clave completa y única puede realinearse',async()=>{
 const cases=[['corto','legacy',{},true],['uuid distinto',other,{},true],['otro dueño','legacy',{user_id:'other-owner'},false],['otro instante','legacy',{fecha:'2026-10-12T10:00:01Z'},false],['otro importe','legacy',{importe:12.01},false],['otro comercio','legacy',{comercio:'fixture'},false],['otro origen','legacy',{source:'manual'},false]];
 let resolved=0;for(const [name,localId,patch,ok] of cases){const db=database();Object.assign(db.rows[0],patch);const a=await client(db);
  if(ok){await a.cloud.setExpenseNote({...expense,id:localId},name);resolved++}else await assert.rejects(()=>a.cloud.setExpenseNote({...expense,id:localId},name));}
 assert.equal(resolved,2);console.log('    Identidad sintética: 2/7 resolubles; 5/7 conflictos por clave no idéntica. No es una medida de datos reales.');
});
await test('cerrar sesión durante un envío impide recrear sus claves privadas',async()=>{
 let release;const a=await client(database({before:()=>new Promise(r=>{release=r})}));a.db.sb.auth.signOut=async()=>({error:null});
 const p=a.cloud.setExpenseNote(expense,'Privado');while(!release)await new Promise(r=>setTimeout(r,1));await a.cloud.signOut();release();await assert.rejects(()=>p);
 assert.equal(a.saved.length,0);
});
await test('borrar la cuenta purga la cola sólo tras confirmación del servidor',async()=>{
 const a=await client(database({error:true}));await assert.rejects(()=>a.cloud.setExpenseNote(expense,'Privado'));
 a.db.sb.functions={invoke:async()=>({data:{ok:false},error:null})};a.db.sb.auth.signOut=async()=>({});
 await assert.rejects(()=>a.cloud.deleteAccount('synthetic'));assert.equal(a.saved.length,1);
 a.db.sb.functions.invoke=async()=>({data:{ok:true},error:null});await a.cloud.deleteAccount('synthetic');assert.equal(a.saved.length,0);
});
await test('cola vacía no notifica renders y una escritura no publica metadatos internos',async()=>{
 const a=await client();let changes=0;a.c.mcOnExpenseWrites(()=>changes++);
 await a.cloud.drainExpenseWrites();await a.cloud.drainExpenseWrites();assert.equal(changes,0);
 await a.cloud.setExpenseNote(expense,'Nota');assert.equal(changes,3);
});
await test('ACK acotado mantiene la protección de lecturas anteriores al recorte',async()=>{
 const a=await client();const before=Date.now()-1;
 for(let n=0;n<260;n++){const uuid='550e8400-e29b-41d4-a716-'+String(n).padStart(12,'0');a.db.rows.splice(0,1,{...a.db.rows[0],id:uuid,nota:null,nota_edit:false});await a.cloud.setExpenseNote({...expense,id:uuid},'ACK');}
 assert(Object.keys(a.c._mcExpenseAcks).length<=256);
 const local={...expense,note:'ACK',noteEdited:true};assert.equal(a.c.mergeExpensesFromCloud([local],[expense],before).list[0].note,'ACK');
 assert.equal(a.c.mergeExpensesFromCloud([local],[{...local,note:'Nuevo remoto'}],Date.now()+1).list[0].note,'Nuevo remoto');
});
await test('drenado acorta la ventana de lápida antigua, sin prometer corregir un cliente viejo',async()=>{
 const a=await client(database({error:true})),tombstones={[a.c.keyOfExpense(expense)]:1};
 await assert.rejects(()=>a.cloud.editExpense(expense,{comercio:'Nuevo nombre'}));
 assert.equal([a.c.expenseFromRow(a.db.rows[0])].filter(e=>!a.c.expenseIsTombstoned(e,tombstones)).length,0);
 delete a.db.options.error;await a.cloud.drainExpenseWrites();const remote=a.c.expenseFromRow(a.db.rows[0]);
 assert.equal([remote].filter(e=>!a.c.expenseIsTombstoned(e,tombstones)).length,1);
 assert.equal(a.c.mergeExpenses([expense],[remote]).list.length,2,'la mezcla antigua por clave conserva dos filas');
 assert.equal(a.c.mergeExpensesFromCloud([expense],[remote],Date.now()+1).list.length,1);
});
await test('aprender doce filas con UUID divergentes actualiza doce identidades exactas',async()=>{
 const db=database({rows:[]}),a=await client(db),local=[];
 for(let n=0;n<12;n++){const uuid='550e8400-e29b-41d4-a716-'+String(n).padStart(12,'0'),e={...expense,id:'legacy-'+n,amount:12+n};local.push(e);
  db.rows.push({id:uuid,user_id:owner,source:'ob:trade_republic#dup',cat:'bares',fecha:e.date,importe:e.amount,comercio:e.merchant});}
 for(const e of local)await a.cloud.setExpenseCat(e,'super');assert.equal(db.rows.filter(r=>r.cat==='super').length,12);assert.equal(a.cloud.expenseWrites().length,0);
});
await test('realinear no duplica fila existente ni pierde la referencia acreditada del recibo',async()=>{
 const a=await client(),local={...expense,id:'legacy'},proof={kind:'expense',expenseId:'legacy',identity:a.c.fixedPaymentIdentity('trade_republic',expense)};
 let state={expenses:[expense,local],settings:{},deleted:[],fixed:[{id:'fixed',paymentProofs:{'24322':proof}}]};
 a.c.mcOnExpenseWrites(ev=>{if(ev)state=a.c.mcExpenseApplyEvent(state,ev,a.c.mcExpenseReadGuards(Infinity))});
 await a.cloud.setExpenseNote(local,'Nota');assert.equal(state.expenses.length,1);assert.equal(state.expenses[0].note,'Nota');
 assert.equal(state.fixed[0].paymentProofs['24322'].expenseId,id);assert.equal(state.fixed[0].paymentProofs['24322'].identity,proof.identity);
});
await test('realinear protege el UUID antiguo del backfill hasta que React aplica el evento',async()=>{
 let release;const a=await client(database({beforeWrite:()=>new Promise(r=>{release=r})})),local={...expense,id:'legacy'};
 const p=a.cloud.editExpense(local,{comercio:'Cambio local'});while(!release)await new Promise(r=>setTimeout(r,1));
 assert.equal(a.cloud.expenseWrites()[0].id,id);assert.equal(a.c.backfillExpenseCandidates([{...local,merchant:'Cambio local'}],[],Date.now()+1).length,0);
 release();await p;
});
await test('el límite de ACK también se cumple para un lote grande',async()=>{
 const a=await client(database({rows:[]})),ids=Array.from({length:270},(_,n)=>'550e8400-e29b-41d4-a716-'+String(n).padStart(12,'0'));
 await a.cloud.deleteExpensesByIds(ids);assert.equal(Object.keys(a.c._mcExpenseAcks).length,256);
});
await test('logout de otra pestaña no permite recrear la cola desde una respuesta tardía',async()=>{
 const saved=storage(),db=database(),a=await client(db,saved),b=await client(db,saved);let release;
 db.options.before=()=>new Promise(r=>{release=r});db.sb.auth.signOut=async()=>{db.login(null);a.c.mcExpenseSession(null);return {error:null}};
 const p=a.cloud.setExpenseNote(expense,'Privado entre pestañas');while(!release)await new Promise(r=>setTimeout(r,1));
 await b.cloud.signOut();assert.equal(saved.length,0);delete db.options.before;release();await assert.rejects(()=>p);assert.equal(saved.length,0);
});
console.log('expense-write-revision: '+passed+' PASS / '+failed+' FAIL');
if(failed) process.exitCode=1;
