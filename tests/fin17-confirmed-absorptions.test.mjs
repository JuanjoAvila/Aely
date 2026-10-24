import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {transformSync} from 'esbuild';
import {fakeDb,post} from './helpers/ingest-handler-fixture.mjs';
import {client,database,seed,pending,booked,kept,uid,uuid,h1,h2,server,original,read} from './helpers/fin17-fixture.mjs';
const make=()=>{const db=database(),a=client(db,'A');db.rows=[a.wire(pending),a.wire(booked)];return{db,a};};
const record=(a,n=0,ackAt=1792324800000)=>({owner:uid,id:uuid(100+n),key:a.c.obAbsorptionKey(n?{...booked,extId:'confirmed-'+n}:booked),keepId:kept.id,keepKey:a.c.obAbsorptionKey(kept),ackAt});
const boundCloud=e=>{const s=read('src/modules/00-core.js'),a=s.indexOf('const cloud = (function(){'),b=s.indexOf('\n})();',a),start=s.indexOf('  return {',a);assert.ok(a>=0&&b>start);return vm.runInContext('(function(sb){'+s.slice(start,b)+'})',e.c)(e.sdk);};
const mutation=(id,file,from,to)=>{const source=read(file);assert.equal(source.split(from).length,2,id+' ancla unica');const changed=source.replace(from,to),sha=s=>crypto.createHash('sha256').update(s).digest('hex');console.log(JSON.stringify({reconstructed:true,authority:'55d1f423',id,file,from,to,sourceSHA256:sha(source),mutantSHA256:sha(changed)}));return changed;};

test('FIN17T M1 cola vacia conserva referencia tras disco vacio y sync repetido',async()=>{
 const {a,db}=make(),empty=[];a.state.obAbsorbedPending=empty;
 assert.equal(a.c.obAbsorbedMerge(empty,[],uid),empty,'cola vacia sin cambios');
 a.c.obAbsorbedPersist(uid,empty);assert.equal(a.c.obAbsorbedMerge(empty,[],uid),empty,'cola vacia durable');
 db.rows=[];a.state.expenses=[];
 for(let i=0;i<3;i++){await a.sync();assert.equal(a.state.obAbsorbedPending,empty,'sync sin cambio mantiene referencia');}
});
test('FIN17T M1 cola durable identica conserva referencia y precedencia',()=>{
 const {a}=make();a.stage();const list=a.state.obAbsorbedPending;
 assert.equal(a.c.obAbsorbedMerge(list,[],uid),list,'JSON del disco no invalida estado identico');
 const reversed=Object.fromEntries(Object.entries(list[0]).reverse());
 a.storage.setItem(a.c.obAbsorbedStorageKey(uid),JSON.stringify({owner:uid,pending:[reversed]}));
 assert.equal(a.c.obAbsorbedMerge(list,[{...list[0],amount:99}],uid),list,'orden de claves no cambia; disco sigue ganando a b');
 a.c.obAbsorbedSignOut(uid,a.state);const restored=a.c.obAbsorbedMerge([],[],uid);
 assert.equal(restored[0].idsOnly,true);assert.equal(a.c.obAbsorbedMerge(restored,[],uid),restored,'identificadores iguales no invalidan');
});
test('FIN17T M1 cambios reales de payload durable nunca reutilizan referencia',()=>{
 for(const patch of [{amount:6.4},{merchant:'Cambio sintetico'},{keepId:uuid(987)},{keepKey:'ob-absorbed2|caixabank|otra|1|3.2|2026-10-16'},{keepRefKey:'ob-absorbed2|caixabank|ref|1|3.2|2026-10-16'},{extra:'dato conservado'}]){
  const {a}=make();a.stage();const before=a.state.obAbsorbedPending,changed={...before[0],...patch};
  assert.equal(a.c.obAbsorbedPersist(uid,[changed]),true);const after=a.c.obAbsorbedMerge(before,[],uid);
  assert.notEqual(after,before,'cambio real '+Object.keys(patch));assert.deepEqual(JSON.parse(JSON.stringify(after)),[changed]);
 }
});
test('FIN17T M1 idsOnly durable mantiene prioridad y elimina payload antiguo',()=>{
 const {a}=make();a.stage();const before=a.state.obAbsorbedPending;a.c.obAbsorbedSignOut(uid,a.state);
 const after=a.c.obAbsorbedMerge(before,[],uid);assert.notEqual(after,before);assert.equal(after[0].idsOnly,true);assert.equal(Object.hasOwn(after[0],'amount'),false);
 a.storage.setItem(a.c.obAbsorbedIdsKey(uid),JSON.stringify({owner:uid,pending:[{...after[0],keepRefKey:undefined}]}));
 const next=a.c.obAbsorbedMerge(after,[],uid);assert.notEqual(next,after,'retirar campo tambien cambia payload');assert.equal(Object.hasOwn(next[0],'keepRefKey'),false);
});
test('FIN17T M1 altas orden saneado y limite conservan contrato de cola',()=>{
 const {a}=make();a.stage();const before=a.state.obAbsorbedPending,p=before[0],other={...p,id:uuid(998)};
 const added=a.c.obAbsorbedMerge(before,[other],uid);assert.notEqual(added,before);assert.equal(added.length,2);assert.equal(added[1],other);
 a.c.obAbsorbedPersist(uid,[other,p]);const reordered=a.c.obAbsorbedMerge([p,other],[],uid);assert.equal(reordered[0].id,other.id);
 a.storage.removeItem(a.c.obAbsorbedStorageKey(uid));const dirty=[{...p,owner:'otro'},p,p],clean=a.c.obAbsorbedMerge(dirty,[],uid);assert.notEqual(clean,dirty);assert.equal(clean.length,1);
 const max=Array.from({length:200},(_,i)=>({...p,id:uuid(1000+i)}));assert.equal(a.c.obAbsorbedMerge(max,[],uid),max,'limite estable');
 assert.equal(a.c.obAbsorbedMerge(max,[other],uid),null,'desbordamiento no devuelve estado anterior');
});
test('FIN17T M1 disco ilegible conserva fallo cerrado aunque estado no cambie',()=>{
 const {a}=make();a.stage();const before=a.state.obAbsorbedPending;
 a.storage.setItem(a.c.obAbsorbedStorageKey(uid),'invalid');assert.equal(a.c.obAbsorbedMerge(before,[],uid),null);
 a.storage.removeItem(a.c.obAbsorbedStorageKey(uid));a.storage.setItem(a.c.obAbsorbedIdsKey(uid),'invalid');assert.equal(a.c.obAbsorbedMerge(before,[],uid),null);
});

test('FIN17R F4 M9 reconstruido: pull guarda union en estado incluso si local gana LWW',async()=>{
 const check=async source=>{const {a,db}=make();a.state._savedAt=999;delete a.state.obAbsorbedConfirmed;db.appState={data:{...seed(),expenses:[],_savedAt:1,obAbsorbedConfirmed:[record(a)]},updated_at:'remote-cas'};
 await a.pull(source);assert.equal(a.c.obConfirmedRead(uid).length,1,'disco acredita union');assert.equal(a.state.obAbsorbedConfirmed?.length,1,'estado tambien acredita union');assert.equal(a.spent(),320);};
 if(!process.env.FIN17_RECONSTRUCTED_MUTANT)await check();const changed=mutation('M9','src/modules/11-app-main.js','          baseObj.obAbsorbedConfirmed=confirmed;','          /* M9 reconstruido: union solo en disco */');
 if(process.env.FIN17_RECONSTRUCTED_MUTANT==='M9')return check(changed);
 await assert.rejects(()=>check(changed),e=>e.code==='ERR_ASSERTION'&&e.message.includes('estado tambien'),'M9 muerto por estado, no por preparacion');
});
test('FIN17R F4 M12 reconstruido: sync mezcla disco sin presembrar confirmed en estado',async()=>{
 const check=async source=>{const {a}=make();delete a.state.obAbsorbedConfirmed;a.c.obConfirmedPersist(uid,[record(a)]);await a.sync(source);assert.equal(a.spent(),320,'sync debe incorporar confirmado durable al estado');};
 if(!process.env.FIN17_RECONSTRUCTED_MUTANT)await check();const changed=mutation('M12','src/modules/11-app-main.js','const confirmed=obConfirmedMerge(stateRef.current,null,readOwner);','const confirmed=stateRef.current.obAbsorbedConfirmed||[];');
 if(process.env.FIN17_RECONSTRUCTED_MUTANT==='M12')return check(changed);
 await assert.rejects(()=>check(changed),e=>e.code==='ERR_ASSERTION'&&e.message.includes('sync debe incorporar'),'M12 muerto por resultado financiero');
});
test('FIN17R F4 M11 reconstruido: handler notificacion calcula month con confirmadas',async()=>{
 const check=async code=>{const {a}=make(),date=new Date().toISOString().slice(0,10),p={...pending,date:date+'T10:00:00.000Z'},b={...booked,date:date+'T10:00:00.001Z'};
 const r={...record(a),owner:'user',key:a.c.obAbsorptionKey(b),keepKey:a.c.obAbsorptionKey(p)};
 const env=fakeDb({state:{...seed(),_historyOwner:'user',expenses:[],obAbsorbedConfirmed:[r]},rows:[p,b].map(e=>({...a.wire(e),user_id:'user'}))});
 const result=await post(env,{fuente:'tr',titulo:'Trade Republic',texto:'Has gastado 0,01 € en Otra cuenta sintetica',fecha:String(Date.now()),evento:'fin17-m11'},undefined,code);
 assert.equal(result.status,200);assert.ok(result.data.month,'handler devuelve month');assert.equal(Math.round(result.data.month.spent*100),320,'month no cuenta BOOK confirmado');};
 if(!process.env.FIN17_RECONSTRUCTED_MUTANT)await check();const changed=mutation('M11','supabase/functions/ingest/index.ts','st?.data?.obAbsorbedPending, userId, st?.data?.obAbsorbedConfirmed);','st?.data?.obAbsorbedPending, userId);');
 const code=transformSync(changed.replace(/^import\s[\s\S]*?from\s+"[^"]+";\r?\n/gm,''),{loader:'ts'}).code;
 if(process.env.FIN17_RECONSTRUCTED_MUTANT==='M11')return check(code);
 await assert.rejects(()=>check(code),e=>e.code==='ERR_ASSERTION'&&e.message.includes('month no cuenta'),'M11 muerto por respuesta real');
});

test('FIN17R F1 union1001 conserva recientes y permite alta manual ajena',async()=>{
 const {a,db}=make(),many=Array.from({length:1000},(_,i)=>record(a,i+1));a.c.obConfirmedPersist(uid,many);
 const merged=a.c.obConfirmedMerge({...seed(),obAbsorbedConfirmed:many},{obAbsorbedConfirmed:[record(a)]},uid);
 assert.equal(merged&&merged.length,1001,'la capacidad no bloquea la union');
 assert.equal(a.c.obConfirmedRead(uid).length,1001,'todos los ACK son durables');
 const manual={...booked,id:uuid(9999),source:'manual',extId:undefined,date:'2026-10-18T13:00:00Z'};
 await a.cloud.addExpense(manual);assert.ok(db.rows.some(r=>r.id===manual.id));
});
test('FIN17R F1 union expulsa solo el mayor90dias bajo presion',()=>{
 const {a}=make(),many=Array.from({length:1000},(_,i)=>record(a,i+1,i?1792324800000:1792324800000-91*864e5));a.c.obConfirmedPersist(uid,many);
 const merged=a.c.obConfirmedMerge({...seed(),obAbsorbedConfirmed:many},{obAbsorbedConfirmed:[record(a)]},uid);
 assert.equal(merged&&merged.length,1000);assert.ok(!merged.some(r=>r.key===many[0].key));assert.ok(merged.some(r=>r.key===record(a).key));
});
test('FIN17R F2 issue local no viaja en pushState',async()=>{
 const {a,db}=make();await a.cloud.pushState(uid,a.c.slimForCloud({...seed(),obAbsorbedIssue:'full'}),'cas');
 assert.equal(Object.hasOwn(db.stateWrite.data,'obAbsorbedIssue'),false,'bandera local excluida del transporte');
});
test('FIN17R F2 resolver pending elimina incidencia',async()=>{
 const {a}=make();a.stage();a.state.obAbsorbedIssue='full';await a.drain();assert.equal(a.state.obAbsorbedPending.length,0);assert.equal(a.state.obAbsorbedIssue,undefined);
});
test('FIN17R F2 aviso una vez por incidencia y dispositivo incluso tras reabrir',async()=>{
 const {a}=make();a.stage();a.state.obAbsorbedIssue='full';a.c.obAbsorbedWarn('full',uid);
 const mount=e=>{const s=read('src/modules/11-app-main.js'),event=s.indexOf('window.addEventListener("mc-ob-absorbed-warning",warning);'),start=s.lastIndexOf('  useEffect(function(){',event),end=s.indexOf('\n  },[]);',event)+10;assert.ok(start>=0&&end>event);const messages=[];e.c.__noticeMessages=messages;
 vm.runInContext('(function(state){const stateRef={current:state};const showToast=m=>__noticeMessages.push(m),useEffect=fn=>fn();'+s.slice(start,end)+'})',e.c)(e.state);return messages;};
 assert.equal(mount(a).length,1,'primera presentacion');
 const b=client(database(),'reopened',a.state);a.storage.map.forEach((v,k)=>b.storage.setItem(k,v));assert.equal(mount(b).length,0,'reapertura del mismo dispositivo no repite');
 await a.drain();a.c.obAbsorbedWarn('full',uid);assert.equal(mount(a).length,1,'incidencia nueva despues de resolver');
 const c=client(database(),'another-device',a.state);c.c.obAbsorbedWarn('full',uid);assert.equal(mount(c).length,1,'otro dispositivo tiene aviso propio');
});
test('FIN17R F3 persistencia identica no reescribe registro',()=>{
 const {a}=make(),list=Array.from({length:1000},(_,i)=>record(a,i+1));let writes=0;const set=a.storage.setItem;a.storage.setItem=(k,v)=>{if(k.includes('_oback_'))writes++;return set(k,v);};
 assert.equal(a.c.obConfirmedPersist(uid,list),true);assert.equal(a.c.obConfirmedPersist(uid,list),true);assert.equal(writes,1,'solo una escritura para datos iguales');
});
test('FIN17R F3 mismo payload semantico y CAS no reenvia; cambio real o CAS si',async()=>{
 const {a,db}=make(),state={...seed(),obAbsorbedConfirmed:[record(a)]};
 const first=await a.cloud.pushState(uid,a.c.slimForCloud(state),'cas1');
 await a.cloud.pushState(uid,a.c.slimForCloud({...state,_savedAt:999}),first.updated_at);
 assert.equal(db.stateWrites.length,1,'solo cambio de sello local no vuelve a enviar');
 await a.cloud.pushState(uid,a.c.slimForCloud({...state,budget:900}),first.updated_at);assert.equal(db.stateWrites.length,2,'cambio real se envia con el registro');
 await a.cloud.pushState(uid,a.c.slimForCloud({...state,budget:900}),'cas2');assert.equal(db.stateWrites.length,3,'otro CAS no se omite');
});
test('FIN17R F3 guardado ligero no duplica registro durable en estado principal',()=>{
 const {a}=make(),state={...seed(),obAbsorbedConfirmed:[record(a)]};a.c.mcSaveRaw('micartera_v3',state);
 const raw=JSON.parse(a.storage.getItem('micartera_v3'));assert.equal(Object.hasOwn(raw,'obAbsorbedConfirmed'),false,'registro vive solo en particion con readback');
 assert.equal(a.c.mcLoadRaw('micartera_v3').obAbsorbedConfirmed.length,1);
});
test('FIN17R F3 colision forzada conserva testigos y paridad servidor; legacy migra sin perdida',()=>{
 const source=original.replace('function obConfirmedHash(text){','function obConfirmedHash(text){return "collision";');assert.notEqual(source,original);
 const a=client(database(),'collision',seed(),source),records=[record(a),record(a,1)],pack=a.c.obConfirmedPack(records,uid);
 assert.equal(Object.keys(pack.r).length,1);assert.equal(pack.r.collision.length,2);
 const decoded=a.c.obConfirmedUnpack(pack,uid);assert.equal(decoded.length,2);
 for(const expense of [booked,{...booked,extId:'confirmed-1'}])assert.equal(a.c.obConfirmedMatches(expense,decoded,uid),true);
 for(const expense of [kept,{...booked,extId:'unrelated'},{...booked,obAcc:'another-account'},{...booked,obOrd:3},{...booked,date:'2026-10-15T12:00:00Z'}]){
  assert.equal(a.c.obConfirmedMatches(expense,decoded,uid),false);assert.equal(server.filasComoLaApp([a.wire(expense)],[],[],uid,pack).length,1);
 }
 assert.equal(server.filasComoLaApp([a.wire(booked)],[],[],uid,pack).length,0);
 assert.equal(server.filasComoLaApp([a.wire(booked)],[],[],'other-owner',pack).length,1);
 const legacy=JSON.stringify({owner:uid,confirmed:records});a.storage.setItem(a.c.obConfirmedStorageKey(uid),legacy);assert.equal(a.c.obConfirmedRead(uid).length,2);
 a.c.obConfirmedMerge(a.state,null,uid);assert.equal(JSON.parse(a.storage.getItem(a.c.obConfirmedStorageKey(uid))).v,1);assert.equal(a.c.obConfirmedRead(uid).length,2);
});
test('FIN17R F3 conflicto o error no marca push como confirmado',async()=>{
 const {a,db}=make(),state=a.c.slimForCloud({...seed(),obAbsorbedConfirmed:[record(a)]});db.stateConflict=true;
 assert.equal((await a.cloud.pushState(uid,state,'cas')).conflict,true);db.stateConflict=false;await a.cloud.pushState(uid,state,'cas');assert.equal(db.stateWrites.length,2);
 db.stateError={code:'synthetic-error'};await assert.rejects(()=>a.cloud.pushState(uid,{...state,budget:900},'synthetic-state-ack'));delete db.stateError;
 await a.cloud.pushState(uid,{...state,budget:900},'synthetic-state-ack');assert.equal(db.stateWrites.length,4,'error no permite saltarse el siguiente envio');
});
test('FIN17R beta141 conflicto de reservas conserva cloudOnly y union compacta',async()=>{
 const {a,db}=make(),goal={id:'synthetic-goal',name:'Meta sintetica',target:1000,saved:100,done:false,doneAt:null};
 const base={...seed(),goals:[goal],settings:{...seed().settings,reservaRules:[{id:'rule',goalId:goal.id,kind:'fixed',value:50,mensual:true}]},reservaLog:[]};
 a.state={...base,...a.c.goalSyncPull(base,base,uid,'base-cas',false),_savedAt:999};
 a.state.goals=[{...goal,saved:150}];a.state.settings={...base.settings,reservaRules:[{...base.settings.reservaRules[0],value:100}]};
 const remote={...base,_savedAt:1,goals:[{...goal,saved:300}],obAbsorbedConfirmed:a.c.obConfirmedPack([record(a)],uid)};
 db.appState={data:remote,updated_at:'remote-cas'};await a.pull();
 assert.equal(a.state._goalSync.cloudOnly,true);assert.equal(a.state.goals[0].saved,300);assert.equal(a.state.settings.reservaRules[0].value,50);
 assert.equal(a.state.obAbsorbedConfirmed.length,1);assert.equal(a.spent(),320);assert.equal(a.c.obConfirmedRead(uid).length,1);
});
test('FIN17R F3 registro compacto reduce bytes conservando identidad',()=>{
 const {a}=make(),list=Array.from({length:1000},(_,i)=>record(a,i+1));const before=Buffer.byteLength(JSON.stringify({owner:uid,confirmed:list}));a.c.obConfirmedPersist(uid,list);
 const raw=a.storage.getItem(a.c.obConfirmedStorageKey(uid));assert.ok(Buffer.byteLength(raw)<before*0.8,'reduccion minima20porciento con fixture identica');
 const restored=a.c.obConfirmedRead(uid);assert.equal(restored.length,1000);assert.equal(a.c.obConfirmedMatches({...booked,extId:'confirmed-1'},restored,uid),true);assert.equal(a.c.obConfirmedMatches({...booked,extId:'other'},restored,uid),false);
});
function signOut(e){
 let fire;e.sdk.auth.onAuthStateChange=fn=>{fire=fn;return{data:{subscription:{unsubscribe(){}}}};};
 const source=read('src/modules/11-app-main.js'),start=source.indexOf('    const off=cloud.onAuth((s,ev)=>{'),end=source.indexOf('\n    return ()=>{ alive=false;',start);assert.ok(start>=0&&end>start);
 const factory=vm.runInContext('(function(state,session){let alive=true;const stateRef={current:state},sessionRef={current:session},cloudReadRef={current:null},cloudUpdatedAtRef={current:null};const set=fn=>stateRef.current=fn(stateRef.current);const setSession=()=>{},setRecovery=()=>{},setShowAuth=()=>{},syncFromCloud=()=>{};'+source.slice(start,end)+'return ()=>stateRef.current;})',e.c);
 const state=factory(e.state,{user:{id:e.owner}});fire('SIGNED_OUT',null);e.state=state();
}
const idsKey=e=>'micartera_v3_obabs_ids_'+encodeURIComponent(e.owner);
test('FIN17S F5 cierre conserva intencion sin ACK solo con identificadores y vuelta del titular reintenta',async()=>{
 const {a,db}=make();a.stage();db.failDelete=true;await a.drain();const intent=a.state.obAbsorbedPending[0];
 signOut(a);const raw=a.storage.getItem(idsKey(a));assert.ok(raw,'SIGNED_OUT conserva intencion sin ACK');
 const pack=JSON.parse(raw);assert.equal(pack.owner,uid);assert.equal(pack.pending.length,1);
 assert.deepEqual(Object.keys(pack.pending[0]).sort(),['id','idsOnly','keepId','keepKey','keepRefKey','key','owner'].sort(),'solo identificadores y discriminador');
 assert.equal(raw.includes(booked.merchant),false);assert.equal(Object.hasOwn(pack.pending[0],'amount'),false);
 assert.equal(pack.pending[0].id,intent.id);assert.equal(a.state.obAbsorbedPending.length,0);
 assert.equal(a.storage.getItem(a.c.obAbsorbedStorageKey(uid)),null);
 db.failDelete=false;await a.drain();assert.equal(a.state.obAbsorbedPending.length,0);assert.equal(a.state.obAbsorbedConfirmed.length,1);
 assert.deepEqual(db.rows.map(r=>r.id),[pending.id]);assert.equal(a.storage.getItem(idsKey(a)),null,'solo ACK durable consume identificadores');assert.equal(a.spent(),320);
});
test('FIN17S F5 otro titular y reapertura no consumen intencion; fallo y testigo cambiado conservan IDs',async()=>{
 const {a,db}=make();a.stage();signOut(a);const key=idsKey(a),raw=a.storage.getItem(key);assert.ok(raw,'intencion conservada');
 const b=client(db,'reopened',{...seed(),_historyOwner:'synthetic-owner-b',expenses:[]});a.storage.map.forEach((v,k)=>b.storage.setItem(k,v));b.owner='synthetic-owner-b';
 await b.drain();signOut(b);assert.equal(b.storage.getItem(key),raw);assert.equal(db.queries.filter(q=>q.op==='delete').length,0);
 b.owner=uid;b.state={...seed(),expenses:[{...kept}],obAbsorbedPending:[]};db.failDelete=true;await b.drain();assert.equal(b.state.obAbsorbedPending.length,1);assert.equal(b.storage.getItem(key),raw);
 db.failDelete=false;db.rows[0].source='manual';await b.drain();assert.equal(b.state.obAbsorbedPending.length,1,'testigo cambiado no autoriza borrado');assert.equal(db.rows.length,2);
 db.rows[0]=b.wire(pending);await b.drain();assert.equal(b.state.obAbsorbedPending.length,0);assert.equal(b.storage.getItem(key),null);assert.deepEqual(db.rows.map(r=>r.id),[pending.id]);
});
test('FIN17S F5 readback fallido no destruye la intencion anterior',()=>{
 const {a}=make();a.stage();const key=a.c.obAbsorbedStorageKey(uid),before=a.storage.getItem(key),write=a.storage.setItem;
 a.storage.setItem=(k,v)=>{if(k.includes('_obabs_ids_'))throw Error('synthetic quota');return write(k,v);};signOut(a);
 assert.equal(a.storage.getItem(key),before,'fallo durable retiene cola anterior');
});
test('FIN17S F5 pull real restaura IDs y un ACK no retira otra intencion',async()=>{
 const {a,db}=make();a.stage();const first=a.state.obAbsorbedPending[0],second={...first,id:uuid(8),key:a.c.obAbsorptionKey({...booked,id:uuid(8),extId:'another-booked'})};
 a.state.obAbsorbedPending.push(second);assert.equal(a.c.obAbsorbedPersist(uid,a.state.obAbsorbedPending),true);signOut(a);
 const b=client(db,'reopen-pull',{...seed(),expenses:[],obAbsorbedPending:[]});a.storage.map.forEach((v,k)=>b.storage.setItem(k,v));
 db.appState={data:{...seed(),expenses:[{...kept}],obAbsorbedPending:[],_savedAt:1},updated_at:'round2-pull'};await b.pull();
 assert.equal(b.state.obAbsorbedPending.length,2,'pull anterior a reintento protege ambos IDs');
 db.rows.push({...b.wire({...booked,id:uuid(8),extId:'another-booked'}),comercio:'Changed synthetic merchant'});
 await b.drain();assert.deepEqual(Array.from(b.state.obAbsorbedPending,p=>p.id),[second.id]);
 assert.deepEqual(JSON.parse(b.storage.getItem(idsKey(b))).pending.map(p=>p.id),[second.id]);
 assert.equal(b.state.obAbsorbedConfirmed.length,1);assert.equal(db.rows.some(r=>r.id===second.id),true,'fila cambiada intacta');
});
test('FIN17S F5 sync restaura IDs antes de backfill incluso sin pull general',async()=>{
 const {a,db}=make();a.stage();a.prune();signOut(a);a.state.expenses=[{...kept},{...booked}];db.rows=[a.wire(pending)];db.failDelete=true;
 await a.sync();assert.equal(db.queries.filter(q=>q.op==='upsert').length,0,'IDs conservados protegen backfill antes del reintento');assert.equal(a.spent(),320);
 assert.equal(db.rows.some(r=>r.id===booked.id),false);
});

test('FIN17R F5 SIGNED_OUT elimina solo particiones salientes',()=>{
 const {a}=make();a.stage();a.c.obConfirmedPersist(uid,[record(a)]);const other='synthetic-other-owner';
 const ownKeys=[a.c.obConfirmedStorageKey(uid),a.c.obAbsorbedStorageKey(uid)],otherKeys=[a.c.obConfirmedStorageKey(other),a.c.obAbsorbedStorageKey(other)];otherKeys.forEach(k=>a.storage.setItem(k,'synthetic-other-unchanged'));
 let fire;a.sdk.auth.onAuthStateChange=fn=>{fire=fn;return{data:{subscription:{unsubscribe(){}}}};};
 const source=read('src/modules/11-app-main.js'),start=source.indexOf('    const off=cloud.onAuth((s,ev)=>{'),end=source.indexOf('\n    return ()=>{ alive=false;',start);assert.ok(start>=0&&end>start);
 const factory=vm.runInContext('(function(state,session){let alive=true;const stateRef={current:state},sessionRef={current:session},cloudReadRef={current:null},cloudUpdatedAtRef={current:null};const set=fn=>stateRef.current=fn(stateRef.current);const setSession=()=>{},setRecovery=()=>{},setShowAuth=()=>{},syncFromCloud=()=>{};'+source.slice(start,end)+'return ()=>stateRef.current;})',a.c);
 const state=factory(a.state,{user:{id:uid}});fire('TOKEN_REFRESHED',{user:{id:uid}});ownKeys.forEach(k=>assert.notEqual(a.storage.getItem(k),null));fire('SIGNED_OUT',null);
 ownKeys.forEach(k=>assert.equal(a.storage.getItem(k),null,'particion saliente eliminada'));otherKeys.forEach(k=>assert.equal(a.storage.getItem(k),'synthetic-other-unchanged'));assert.equal(state().obAbsorbedConfirmed.length,0);
 a.c.mcSaveRaw('micartera_v3',state());ownKeys.forEach(k=>assert.equal(a.storage.getItem(k),null,'guardado posterior no recrea particion saliente'));
});

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
 for(const [method,arg] of [['setExpenseDup',false],['setExpenseBank','caixabank'],['setExpenseNoCard',true],['setExpenseCat','otros'],['setExpenseDeuda'],['setExpenseRecibo']])await a.cloud[method](booked,arg);
 // FIN04: bloquear una nota/renombrado no puede aparentar un ACK. La guarda sigue
 // exigiendo cero consultas, además de rechazar explícitamente la confirmación.
 await assert.rejects(a.cloud.setExpenseNote(booked,'synthetic'),/expense unavailable/);
 await assert.rejects(a.cloud.renameExpense(booked,'synthetic'),/expense unavailable/);
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

test('FIN17 cap1000: jóvenes/exact90/futuros/edad inválida se conservan sin bloquear ACK',async()=>{
 for(const at of [1792324800000,1792324800000-90*864e5,1792324800000+864e5,null]){
  const {a}=make();a.stage();const list=Array.from({length:1000},(_,i)=>record(a,i+1,at));a.state.obAbsorbedConfirmed=list;assert.equal(a.c.obConfirmedPersist(uid,list),true);
  await a.drain();assert.equal(a.state.obAbsorbedPending.length,0);assert.equal(a.state.obAbsorbedConfirmed.length,1001);
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

test('FIN17 unión independiente LWW/CAS y overflow no trunca ni bloquea escritura ajena',async()=>{
 const {a,db}=make(),r=record(a),other=record(a,1);a.c.obConfirmedPersist(uid,[r]);
 const remote={...seed(),_savedAt:1,obAbsorbedConfirmed:[other]};const local={...seed(),_savedAt:999,obAbsorbedConfirmed:[r]};
 const joined=a.c.obConfirmedMerge(local,remote,uid);assert.equal(joined.length,2);
 await a.cloud.pushState(uid,a.c.slimForCloud(local),'old-cas');assert.equal(a.c.obConfirmedUnpack(db.stateWrite.data.obAbsorbedConfirmed,uid).length,2);assert.equal(db.stateWrite.data.expenses,undefined);
 const many=Array.from({length:1000},(_,i)=>record(a,i+10));a.c.obConfirmedPersist(uid,many);
 assert.equal(a.c.obConfirmedMerge({...local,obAbsorbedConfirmed:many},remote,uid).length,1001);
 const otherExpense={...booked,id:uuid(9999),extId:'unrelated',date:'2026-10-18T11:00:00Z'};await a.cloud.addExpense(otherExpense);assert.ok(db.rows.some(r=>r.id===otherExpense.id));
 assert.equal(a.c.obConfirmedRead(uid).length,1001);
});

test('FIN17 H2 conserva640 incierto con aviso/código cerrado; no rebaja el RED histórico320',async()=>{
 for(const kind of ['full','missing-owner']){const r=h2(kind);assert.equal(r.local,640);assert.equal(r.server,640);}
 const {a,db}=make();delete a.state._historyOwner;a.stage();await new Promise(r=>setImmediate(r));
 assert.equal(a.state.obAbsorbedIssue,undefined);assert.equal(a.c.obAbsorbedTakeNotice(''),true);assert.ok(db.events.some(e=>e.row.message==='ob_absorbed'&&e.row.detail==='{"code":"owner"}'));
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
