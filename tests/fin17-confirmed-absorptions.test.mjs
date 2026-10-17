import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {client,database,seed,pending,booked,kept,uid,uuid,h1,h2,server,original,read} from './helpers/fin17-fixture.mjs';
const make=()=>{const db=database(),a=client(db,'A');db.rows=[a.wire(pending),a.wire(booked)];return{db,a};};
const record=(a,n=0,ackAt=1792324800000)=>({owner:uid,id:uuid(100+n),key:a.c.obAbsorptionKey(n?{...booked,extId:'confirmed-'+n}:booked),keepId:kept.id,keepKey:a.c.obAbsorptionKey(kept),ackAt});
const boundCloud=e=>{const s=read('src/modules/00-core.js'),a=s.indexOf('const cloud = (function(){'),b=s.indexOf('\n})();',a),start=s.indexOf('  return {',a);assert.ok(a>=0&&b>start);return vm.runInContext('(function(sb){'+s.slice(start,b)+'})',e.c)(e.sdk);};

for(const [phase,switchAt] of [['candidate-filter',3],['fallback-checked',5]])test('FIN17 batch session barrier '+phase+': dos filas,cambio A→B exige0SDKupserts',async()=>{
 const {a,db}=make();db.rows=[];
 const first={...booked,id:uuid(9),extId:'first-reference'},second={...booked,id:uuid(10),extId:'second-reference',date:'2026-10-16T12:00:01Z'};
 db.onSession=(e,n)=>{if(n===switchAt)e.owner='synthetic-owner-b';};
 const result=await a.cloud.addExpensesBatch([first,second]),writes=db.queries.filter(q=>q.op==='upsert');
 console.log(JSON.stringify({batchWindow:phase,sessionCalls:a.sessions,sessionOwner:a.owner,SDKupserts:writes.length,sentOwners:writes.flatMap(q=>(Array.isArray(q.payload)?q.payload:[q.payload]).map(p=>p.user_id))}));
 assert.equal(writes.length,0,phase+' no envía una fila aprobada bajo otro dueño');
 assert.equal(result.cloudIds.length,0,'sin falso ACK de batch');
});

test('FIN17 batch barrera final conserva ACK reales y relee confirmed después del último await',async()=>{
 const rows=[{...booked,id:uuid(9),extId:'first-reference'},{...booked,id:uuid(10),extId:'second-reference',date:'2026-10-16T12:00:01Z'}];
 const {a,db}=make();db.rows=[];const normal=await a.cloud.addExpensesBatch(rows);assert.deepEqual(Array.from(normal.cloudIds),rows.map(e=>e.id));
 assert.equal(db.queries.filter(q=>q.op==='upsert').length,1);
 const {a:b,db:db2}=make();db2.rows=[];
 db2.onSession=(e,n)=>{if(n===6)e.c.obConfirmedPersist(uid,[{...record(e),id:rows[0].id,key:e.c.obAbsorptionKey(rows[0])}]);};
 const result=await b.cloud.addExpensesBatch(rows);assert.deepEqual(Array.from(result.cloudIds),[rows[1].id]);
 assert.deepEqual(db2.queries.filter(q=>q.op==='upsert').flatMap(q=>q.payload.map(e=>e.id)),[rows[1].id]);
});

test('FIN17 binding: SDK real del escritor, no cloud global, con guarda después de await',async()=>{
 const {a,db}=make();db.rows=[];a.cloud.session=async()=>null;const bound=boundCloud(a);
 delete a.c.localStorage; // El mismo Storage del navegador también es accesible por window.
 await bound.addExpense(booked);assert.equal(db.rows.length,1,'SDK ligado válido puede escribir sin delegar a otro cloud');
 const {a:b,db:db2}=make();db2.rows=[];b.cloud.session=async()=>({user:{id:uid}});db2.onSession=(e,n)=>{if(n===2)e.owner='synthetic-other-owner';};
 assert.equal(await boundCloud(b).addExpense(booked),null);assert.equal(db2.rows.length,0,'sesión global vieja no autoriza el SDK que cambió de dueño');
 const {a:c,db:db3}=make();db3.rows=[];c.cloud.session=async()=>null;c.c.obConfirmedPersist(uid,[record(c)]);
 assert.equal(await boundCloud(c).addExpense(booked),null);assert.equal(db3.rows.length,0,'registro durable también obliga al SDK ligado');
});

test('FIN17 H1 conserva320c tras ACK,poda500 y backfill de otro cliente que conoce el confirmado',async()=>{
 const r=await h1();
 assert.equal(r.after.bLocal,320,'el BOOK confirmado no puede volver al presupuesto local');
 assert.equal(r.after.server,320,'el escritor debe impedir su reinserción');
 assert.equal(r.confirmed.length,1,'ACK durable separado de las lápidas y de pending');
});

test('FIN17 upserts simple/batch y metadatos no resuben el confirmado; DELETE sigue útil',async()=>{
 const {a,db}=make(),r=record(a);assert.equal(a.c.obConfirmedPersist(uid,[r]),true);
 assert.equal(await a.cloud.addExpense(booked),null);await a.c.subirGasto({...booked,reciboId:'synthetic-recibo'},'backfill');
 for(const [method,arg] of [['setExpenseDup',false],['setExpenseBank','caixabank'],['setExpenseNoCard',true],['setExpenseNote','synthetic'],['setExpenseCat','otros'],['setExpenseDeuda'],['setExpenseRecibo']])await a.cloud[method](booked,arg);
 assert.equal(db.queries.length,0,'ningún UPDATE ni falsa reparación de recibo');
 const other={...booked,id:uuid(9),extId:'distinct-ref',date:'2026-10-16T12:00:01Z'};
 const batch=await a.cloud.addExpensesBatch([booked,other]);assert.deepEqual(Array.from(batch.cloudIds),[other.id]);assert.equal(batch.offline,false);
 assert.equal(db.queries.filter(q=>q.op==='upsert').length,1);assert.deepEqual(db.queries.find(q=>q.op==='upsert').payload.map(e=>e.id),[other.id]);
 await a.cloud.deleteExpense(booked);assert.equal(db.queries.filter(q=>q.op==='delete').length,1,'no se corta el cleanup');
});

test('FIN17 la sesión y lectura durable se revalidan después de awaits/fallback y batch',async()=>{
 const {a,db}=make(),r=record(a);
 db.onSession=(env,n)=>{if(n===2)env.c.obConfirmedPersist(uid,[r]);};
 assert.equal(await a.cloud.addExpense(booked),null);assert.equal(db.queries.length,0);
 const {a:b,db:db2}=make();db2.onSession=(env,n)=>{if(n===2)env.owner='synthetic-other-owner';};
 assert.equal(await b.cloud.addExpense(booked),null);assert.equal(db2.queries.length,0);
});

test('FIN17 identidad FIN10: cuenta comodín simétrica,ordinal/día/banco/ref distintos y superviviente',()=>{
 const {a}=make(),r=record(a),matches=e=>a.c.obConfirmedMatches(e,[r],uid);
 assert.equal(matches(booked),true);assert.equal(matches({...booked,obAcc:undefined}),true);
 assert.equal(a.c.obConfirmedMatches(booked,[{...r,key:r.key.replace('|synthetic-account-a|','||')}],uid),true);
 for(const e of [{...booked,extId:'other'}, {...booked,ent:'sabadell'}, {...booked,obOrd:3}, {...booked,date:'2026-10-15T12:00:00Z'}, {...booked,obAcc:'other-account'},kept,{...booked,id:kept.id}])assert.equal(matches(e),false);
 assert.equal(a.c.obConfirmedMatches(booked,[r],'another-owner'),false);
});

test('FIN17 fallo al persistir confirmado conserva intención tras ACK y poda',async()=>{
 const {a}=make();a.stage();const set=a.storage.setItem;a.storage.setItem=(k,v)=>{if(k.includes('_oback_'))throw Error('synthetic-quota');return set(k,v);};
 await a.drain();assert.equal(a.state.obAbsorbedPending.length,1);assert.equal(a.db.rows.length,1);a.prune();assert.equal(a.spent(),320);
 a.storage.setItem=set;await a.drain();assert.equal(a.state.obAbsorbedPending.length,0);assert.equal(a.state.obAbsorbedConfirmed.length,1);
});

test('FIN17 readback distinto nunca autoriza retirar pending',async()=>{
 const {a}=make();a.stage();const get=a.storage.getItem;let wrote=false;const set=a.storage.setItem;
 a.storage.setItem=(k,v)=>{if(k.includes('_oback_'))wrote=true;return set(k,v);};a.storage.getItem=k=>wrote&&k.includes('_oback_')?'synthetic-corrupt':get(k);
 await a.drain();assert.equal(a.state.obAbsorbedPending.length,1);
});

test('FIN17 confirmed antes que clear: fallo de clear/reapertura conserva ambos',async()=>{
 const {a}=make();a.stage();const set=a.storage.setItem;a.storage.setItem=(k,v)=>{if(k.includes('_obabs_'))throw Error('synthetic-quota');return set(k,v);};
 await a.drain();assert.equal(a.state.obAbsorbedPending.length,1);assert.equal(a.state.obAbsorbedConfirmed.length,1);
 a.c.mcSaveRaw('micartera_v3',a.state);const restored=a.c.mcLoadRaw('micartera_v3');assert.equal(restored.obAbsorbedConfirmed.length,1);assert.equal(restored.obAbsorbedPending.length,1);
});

test('FIN17 cap1000: jóvenes/exact90/futuros/edad inválida no se expulsan y pending sigue',async()=>{
 for(const at of [1792324800000,1792324800000-90*864e5,1792324800000+864e5,null]){
  const {a}=make();a.stage();const list=Array.from({length:1000},(_,i)=>record(a,i+1,at));a.state.obAbsorbedConfirmed=list;assert.equal(a.c.obConfirmedPersist(uid,list),true);
  await a.drain();assert.equal(a.state.obAbsorbedPending.length,1);assert.equal(a.state.obAbsorbedConfirmed.length,1000);
 }
});

test('FIN17 expulsión solo con presión y confirmado estrictamente mayor90d',async()=>{
 const {a}=make();a.stage();const list=Array.from({length:1000},(_,i)=>record(a,i+1,i?1792324800000:1792324800000-91*864e5));a.state.obAbsorbedConfirmed=list;a.c.obConfirmedPersist(uid,list);
 assert.equal(a.c.obConfirmedJoin(list,[],uid).length,1000,'edad por sí sola no poda');await a.drain();
 assert.equal(a.state.obAbsorbedPending.length,0);assert.equal(a.state.obAbsorbedConfirmed.length,1000);assert.ok(!a.state.obAbsorbedConfirmed.some(p=>p.key===list[0].key));assert.ok(a.state.obAbsorbedConfirmed.some(p=>p.key===a.c.obAbsorptionKey(booked)));
});

test('FIN17 edad indefinida no pierde la protección en serialización/reapertura',()=>{
 const {a}=make(),r=record(a,0,undefined);r.ackAt=undefined;
 assert.equal(a.c.obConfirmedPersist(uid,[r]),true);
 const restored=a.c.obConfirmedRead(uid);assert.ok(restored&&restored.length===1,'edad inválida se conserva como no expulsable');
 assert.equal(a.c.obConfirmedMatches(booked,restored,uid),true);
});

test('FIN17 unión independiente LWW/CAS y overflow no trunca ni avanza escritura',async()=>{
 const {a,db}=make(),r=record(a),other=record(a,1);a.c.obConfirmedPersist(uid,[r]);
 const remote={...seed(),_savedAt:1,obAbsorbedConfirmed:[other]};const local={...seed(),_savedAt:999,obAbsorbedConfirmed:[r]};
 const joined=a.c.obConfirmedMerge(local,remote,uid);assert.equal(joined.length,2);
 await a.cloud.pushState(uid,a.c.slimForCloud(local),'old-cas');assert.equal(db.stateWrite.data.obAbsorbedConfirmed.length,2);assert.equal(db.stateWrite.data.expenses,undefined);
 const many=Array.from({length:1000},(_,i)=>record(a,i+10));a.c.obConfirmedPersist(uid,many);
 assert.equal(a.c.obConfirmedMerge({...local,obAbsorbedConfirmed:many},remote,uid),null);
 const writes=db.queries.length;assert.equal(await a.cloud.addExpense(booked),null);assert.equal(db.queries.length,writes);
 assert.equal(a.c.obConfirmedRead(uid).length,1000);
});

test('FIN17 H2 conserva640 incierto con aviso/código cerrado; no rebaja el RED histórico320',async()=>{
 for(const kind of ['full','missing-owner']){const r=h2(kind);assert.equal(r.local,640);assert.equal(r.server,640);}
 const {a,db}=make();delete a.state._historyOwner;a.stage();await new Promise(r=>setImmediate(r));
 assert.equal(a.state.obAbsorbedIssue,'owner');assert.ok(db.events.some(e=>e.row.message==='ob_absorbed'&&e.row.detail==='{"code":"owner"}'));
 assert.equal(a.c.mcLogEvent('error','ob_absorbed','{"code":"owner","amount":999,"owner":"private"}').detail,'{"code":"owner"}');
 assert.equal(a.c.mcLogEvent('error','ob_absorbed','{"code":"private"}'),null);
 assert.equal(vm.runInContext('LANG.es.ob_absorbed_review',a.c),'Hay movimientos pendientes de revisar');
 assert.ok(vm.runInContext('LANG.en.ob_absorbed_review&&LANG.ca.ob_absorbed_review',a.c));
});

test('FIN17 lector servidor y cliente filtran confirmado antes de consumir referencia',()=>{
 const {a}=make(),hidden={...booked,date:'2026-10-14T12:00:00Z'},survivor={...booked,id:uuid(8),date:'2026-10-15T12:00:00Z'},r={...record(a),key:a.c.obAbsorptionKey(hidden)};
 for(const rows of [[hidden,survivor],[survivor,hidden]]){
  const state={...seed(),expenses:rows,deleted:[],obAbsorbedConfirmed:[r]};const visible=rows.filter(e=>!a.c.expenseIsTombstoned(e,a.c.expenseDeletedSet(state)));assert.deepEqual(visible.map(e=>e.id),[survivor.id]);
  const actual=server.filasComoLaApp(rows.map(a.wire),[],[],uid,[r]);assert.deepEqual(actual.map(e=>e.id),[survivor.id]);
 }
 const state=seed(),before=a.c.expenseDeletedSet(state);state.obAbsorbedConfirmed=[record(a)];assert.notEqual(a.c.expenseDeletedSet(state),before);
});

test('FIN17 tres mutantes causales fallan por aserción, no por sintaxis/ReferenceError',async()=>{
 const cases=[
  ['writer',s=>s.replace('return !obConfirmedMatches(e,list,owner);','return true;'),async e=>{e.c.obConfirmedPersist(uid,[record(e)]);assert.equal(await e.cloud.addExpense(booked),null);} ],
  ['prune',s=>s.replace('function lapidaPon(s, key, ahora){','function lapidaPon(s, key, ahora){ if(s.obAbsorbedConfirmed){s.obAbsorbedConfirmed=[];localStorage.removeItem(obConfirmedStorageKey(s._historyOwner));}'),async e=>{e.stage();await e.drain();e.prune();e.c.mcSaveRaw('micartera_v3',e.state);e.state={...e.c.mcLoadRaw('micartera_v3'),expenses:[{...pending},{...booked}]};await e.sync();assert.equal(e.spent(),320,'poda mutada resucita BOOK tras reapertura/backfill');assert.equal(e.c.obConfirmedRead(uid).length,1,'registro durable después de poda');} ],
  ['ref-only',s=>s.replace('return obAbsorptionMatches(e,index.gone);','return Object.keys(index.gone).some(function(k){return k.split("|")[2]===encodeURIComponent(String(e.extId||""));});'),async e=>{assert.equal(e.c.obConfirmedMatches({...booked,obOrd:3},[record(e)],uid),false);} ]
 ];
 for(const [name,mutate,check] of cases){const changed=mutate(original);assert.notEqual(changed,original,name+' aplicado');const db=database(),e=client(db,name,seed(),changed);db.rows=[e.wire(pending),e.wire(booked)];await assert.rejects(()=>check(e),err=>err?.code==='ERR_ASSERTION',name+' muerto por aserción');console.log('FIN17 mutant '+name+': ERR_ASSERTION causal');}
});

test('FIN17 ocho controles sobre fuente nueva, conservando incertidumbre y noACK',async()=>{
 let count=0;
 for(const opts of [{},{prune:false},{retainBook:false},{deleteError:true}]){const r=await h1(opts);assert.equal(r.after.bLocal,320);assert.equal(r.after.server,320);count++;}
 for(const kind of ['full','missing-owner']){const r=h2(kind);assert.equal(r.local,640);assert.equal(r.server,640);count++;}
 for(const kind of ['ambiguous','edited']){
  const {a,db}=make();a.stage();const before=JSON.stringify(a.state.obAbsorbedPending);
  if(kind==='edited')db.rows[1].comercio='Synthetic edited';else{db.rows[1].id=uuid(3);db.rows.push({...db.rows[1],id:uuid(4),fecha:'2026-10-16T12:00:00.002Z'});}
  for(const days of [0,30,336]){a.advanceDays(days);await a.drain();assert.equal(JSON.stringify(a.state.obAbsorbedPending),before);}
  assert.equal(db.queries.filter(q=>q.op==='delete').length,0);count++;
 }
 assert.equal(count,8);console.log('FIN17 controles fuente nueva8/8;H2=640 incierto,noACK intacto');
});
