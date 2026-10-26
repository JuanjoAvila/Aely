// Handler real intacto; el SDK y el almacenamiento son sintéticos, sin red ni PostgreSQL.
import { claveEvento, fechaEventoOrdinal, ordinalEvento } from '../_shared/ingest_identity.ts';
import { filasComoLaApp } from '../_shared/presupuesto.ts';
const runtime=Deno as unknown as Record<string,any>;
let handler:(req:Request)=>Promise<Response>;
let activeDb:any;
const oldServe=runtime.serve;
runtime.serve=(f:any)=>{handler=f;return {};};
Deno.env.set('INGEST_NATIVE_TWINS','1');
Deno.env.set('SUPABASE_URL','https://synthetic.invalid');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','synthetic');
Deno.env.set('INGEST_TOKEN','');Deno.env.set('INGEST_USER_ID','owner-synthetic');
(globalThis as any).__ingestSyntheticClient=()=>activeDb;
await import('./index.ts');
function equal(actual:any,expected:any,label:string){if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(label+': expected '+JSON.stringify(expected)+', actual '+JSON.stringify(actual));}
function storage(opts:any={}){
 const rows:any[]=(opts.rows||[]).map((r:any)=>({...r})),events:any[]=[],writes:any[]=[],interleaving:any[]=[];
 let insertSeq=0,nearCount=0,releaseNear:any;const insertOrigin=Date.now(),bothNear=new Promise<void>(resolve=>{releaseNear=resolve;});
 const insertOrder:string[]=opts.insertOrder||[];let insertedCount=0,releaseFirst:any,releaseBoth:any;
 const firstInserted=new Promise<void>(resolve=>{releaseFirst=resolve;}),bothInserted=new Promise<void>(resolve=>{releaseBoth=resolve;});
 function from(name:string){const q:any={op:'select',filters:[],cols:'*',row:null};const api:any={
 select(cols='*'){q.cols=cols;return api;},eq(k:string,v:any){if(k==='token')q.token=v;q.filters.push((r:any)=>String(r[k])===String(v));return api;},
 in(k:string,v:any[]){q.filters.push((r:any)=>v.includes(r[k]));return api;},
 gte(k:string,v:any){q.filters.push((r:any)=>r[k]>=v);return api;},lte(k:string,v:any){q.filters.push((r:any)=>r[k]<=v);return api;},lt(k:string,v:any){q.filters.push((r:any)=>r[k]<v);return api;},
 limit(n:number){q.limit=n;return api;},range(a:number,b:number){q.range=[a,b];return api;},order(){return api;},abortSignal(){return api;},
 upsert(row:any,opts:any){q.op='upsert';q.row={...row};q.options=opts;return api;},insert(row:any){q.op='insert';q.row={...row};return api;},update(row:any){q.op='update';q.row={...row};return api;},delete(){q.op='delete';return api;},
 async maybeSingle(){return name==='ingest_tokens'?{data:{user_id:q.token==='token-other'?'owner-other':'owner-synthetic'},error:null}:name==='app_state'?{data:{data:{accounts:[{ent:'trade_republic',role:'diario'}],settings:{}}},error:null}:{data:null,error:null};},
 then(resolve:any,reject:any){return Promise.resolve().then(insertOrder.length?runScheduled:run).then(async result=>{if(opts.syncPrechecks&&q.op==='select'&&q.cols==='id,fecha,importe,ingest_event_id,source'&&nearCount<2){nearCount++;if(nearCount===2)releaseNear();await bothNear;}return result;}).then(resolve,reject);}};
 function run(){
 if(name==='app_events'){events.push(q.row);return {data:null,error:null};}if(name!=='expenses')return {data:[],error:null};
 const matches=()=>rows.filter(r=>q.filters.every((f:any)=>f(r)));
 if(q.op==='select'){if(opts.ackError&&q.cols.includes('source')&&q.cols.includes('comercio'))return {data:null,error:{code:'unavailable',message:'synthetic read failure'}};if(opts.slotError&&q.cols==='id,fecha,source,ingest_event_id')return {data:null,error:{message:'synthetic slots failure'}};let selected=matches();if(q.range)selected=selected.slice(q.range[0],q.range[1]+1);if(q.limit)selected=selected.slice(0,q.limit);const cols=q.cols.split(',');return {data:selected.map(r=>q.cols==='*'?{...r}:Object.fromEntries(cols.map((k:string)=>[k,r[k]]))),count:selected.length,error:null};}
 if(q.op==='upsert'||q.op==='insert'){
 writes.push({row:{...q.row},options:q.options});if(opts.emptyInsert)return {data:[],error:null};if(opts.race23505){opts.race23505=false;rows.push({id:'racing',created_at:q.row.fecha,...q.row,source:'macrodroid'});return {data:null,error:{code:'23505',message:'synthetic race'}};}if(opts.noAck23505)return {data:null,error:{code:'23505',message:'synthetic unknown conflict'}};
 if(q.options)equal(q.options.onConflict,'user_id,fecha,importe,comercio','baseline conflict target');
 if(q.row.ingest_event_id&&rows.some(r=>r.user_id===q.row.user_id&&r.ingest_event_id===q.row.ingest_event_id))return {data:null,error:{code:'23505',message:'expenses_ingest_event_idx'}};
 // Contrato literal de0001: la restricción de contenido también se aplica a eventos distintos.
 const legacy=rows.some(r=>r.user_id===q.row.user_id&&r.fecha===q.row.fecha&&Number(r.importe)===Number(q.row.importe)&&r.comercio===q.row.comercio);
 if(legacy)return q.op==='upsert'?{data:[],error:null}:{data:null,error:{code:'23505',message:'expenses_dedup_idx'}};
 const row={id:'synthetic-'+(rows.length+1),created_at:new Date(insertOrigin+(++insertSeq)).toISOString(),...q.row};rows.push(row);return {data:[{id:row.id}],error:null};}
 if(q.op==='update'){if(opts.releaseError){opts.releaseError=false;return {data:null,error:{message:'synthetic release failure'}};}for(const r of matches())Object.assign(r,q.row);return {data:[],error:null};}
 if(q.op==='delete'){if(opts.deleteError)return {data:null,error:{message:'synthetic delete failure'}};const gone=new Set(matches());for(let i=rows.length-1;i>=0;i--)if(gone.has(rows[i]))rows.splice(i,1);return {data:Array.from(gone).map((r:any)=>({id:r.id})),error:null};}
 throw Error('Unexpected query');}
 // El SHA-256 real termina fuera de orden: el escenario fija las inserciones y espera ambas antes del chequeo posterior.
 async function runScheduled(){
 const inserting=name==='expenses'&&(q.op==='upsert'||q.op==='insert');
 const postinsert=name==='expenses'&&q.op==='select'&&q.cols==='id,fecha,importe,ingest_event_id,created_at,source';
 if(inserting){equal(insertOrder.includes(q.row.ingest_event_id),true,'scheduled event belongs to scenario');if(q.row.ingest_event_id!==insertOrder[0])await firstInserted;}
 if(postinsert)await bothInserted;
 const result=run();
 if(inserting){equal(result.error,null,'scheduled insert succeeded');equal(result.data.length,1,'scheduled insert created one row');
 equal(q.row.ingest_event_id,insertOrder[insertedCount],'explicit insertion order');interleaving.push({op:'insert',eventKey:q.row.ingest_event_id});
 if(++insertedCount===1)releaseFirst();if(insertedCount===insertOrder.length)releaseBoth();}
 if(postinsert)interleaving.push({op:'postinsert',rows:result.data.map((r:any)=>r.id)});
 if(q.op==='delete')interleaving.push({op:'delete'});
 return result;}
 return api;}
 return {db:{from,rpc:()=>Promise.resolve({data:true,error:null})},rows,events,writes,interleaving};}
const body=(evento:string)=>({evento,fuente:'tr',fecha:'1792137600000',texto:'Has gastado 9,95 € en COMERCIO SINTETICO',titulo:'Trade Republic'});
async function post(s:any,b:any,token='token-synthetic'){activeDb=s.db;const response=await handler(new Request('https://synthetic.invalid/ingest',{method:'POST',headers:{'x-ingest-token':token},body:JSON.stringify(b)}));return {status:response.status,data:await response.json()};}
Deno.test('F2 real handler: distinct native IDs same millisecond/content persist1990c',async()=>{
 const s=storage();const first=await post(s,body('v1_native_a'));const second=await post(s,body('v1_native_b'));
 const visible=filasComoLaApp(s.rows,[],[],'owner-synthetic');
 const cents=visible.filter(r=>!String(r.source).includes('#dup')).reduce((n,r)=>n+Math.round(Number(r.importe)*100),0);
 console.log(JSON.stringify({expectedCents:1990,observedCents:cents,rows:s.rows.length,firstStatus:first.status,secondStatus:second.status,secondDup:second.data.dup===true,secondACK:second.data.ack||null,firstEvent:claveEvento('v1_native_a','tr',''),secondEvent:claveEvento('v1_native_b','tr','')}));
 equal(cents,1990,'independent cents oracle');equal(s.rows.length,2,'distinct native events');equal(second.data.month.spent,19.9,'actual monthly handler total');equal(second.data.month.shownDelta,9.95,'second native monthly contribution');
});
Deno.test('F2 real handler: true repeat retains one row995c and stableACK',async()=>{
 const s=storage();const first=await post(s,body('v1_repeat'));const second=await post(s,body('v1_repeat'));
 equal(s.rows.length,1,'true repeat rows');equal(Math.round(Number(s.rows[0].importe)*100),995,'true repeat cents');equal(first.data.ack,second.data.ack,'stable ACK');
});

Deno.test('F2 same content: third event survives handler, monthly reader and unchanged global unique',async()=>{
 const s=storage();for(const id of ['v1_a','v1_b','v1_c'])equal((await post(s,body(id))).status,200,'new event status');
 equal(s.rows.length,3,'three events');equal(new Set(s.rows.map(r=>r.fecha)).size,3,'three unique timestamp slots');
 equal(filasComoLaApp(s.rows,[],[],'owner-synthetic').reduce((n,r)=>n+Math.round(Number(r.importe)*100),0),2985,'third-event cents');
 equal(s.rows.every(r=>String(r.source).startsWith('native:trade_republic#e')),true,'native source never bank');
 equal((await post(s,body('v1_b'))).data.ack,s.rows[1].id,'middle-event replay ACK');
});
Deno.test('F2 distinct concurrent events collide then reserve their own slots',async()=>{
 const s=storage();const rs=await Promise.all(['v1_ca','v1_cb','v1_cc'].map(id=>post(s,body(id))));
 equal(rs.map(r=>r.status),[200,200,200],'concurrent distinct statuses');equal(s.rows.length,3,'concurrent distinct rows');
 equal(filasComoLaApp(s.rows,[],[],'owner-synthetic').reduce((n,r)=>n+Math.round(Number(r.importe)*100),0),2985,'concurrent distinct cents');
 for(const [i,id] of ['v1_ca','v1_cb','v1_cc'].entries())equal((await post(s,body(id))).data.ack,rs[i].data.ack,'stable own ACK');
});
Deno.test('F2 concurrent true repeat and lost response retain stable own ACK995c',async()=>{
 const s=storage();const rs=await Promise.all([post(s,body('v1_same_concurrent')),post(s,body('v1_same_concurrent'))]);
 const replay=await post(s,body('v1_same_concurrent'));equal(s.rows.length,1,'concurrent repeat rows');equal(replay.data.ack,s.rows[0].id,'lost response ACK');
 equal(Math.round(Number(s.rows[0].importe)*100),995,'concurrent repeat cents');for(const r of rs)if(r.data.ack)equal(r.data.ack,replay.data.ack,'race ACK');
});
Deno.test('F2 23505 exact native recovery never aliases another event',async()=>{
 const s=storage({race23505:true});const r=await post(s,body('v1_23505'));equal(r.status,200,'race status');equal(r.data.ack,'racing','race ACK');equal(s.rows.length,1,'race row');
 const bad=storage({noAck23505:true});const uncertain=await post(bad,body('v1_uncertain'));equal(uncertain.status,503,'unknown conflict closed');equal(uncertain.data.ok,false,'no false success');
});
Deno.test('F2 release uncertainty remains pending outside totals and retry repairs same row',async()=>{
 const s=storage({releaseError:true});const first=await post(s,body('v1_release'));equal(first.status,503,'pending status');equal(String(s.rows[0].source).includes('#dup'),true,'pending source');
 const retry=await post(s,body('v1_release'));equal(retry.status,200,'repair status');equal(retry.data.ack,first.data.ack,'repair ACK');equal(s.rows.length,1,'repair one row');equal(String(s.rows[0].source).startsWith('native:trade_republic#e'),true,'confirmed native source');
});
Deno.test('F2 owner is token-bound and months never share native slots',async()=>{
 const s=storage();const a=await post(s,body('v1_owner'));const b=await post(s,{...body('v1_owner'),user_id:'owner-synthetic'},'token-other');
 equal(s.rows.map(r=>r.user_id),['owner-synthetic','owner-other'],'owner from token only');equal(s.rows[0].fecha,s.rows[1].fecha,'owners have independent slots');
 const other=await post(s,{...body('v1_month'),fecha:String(Date.parse('2026-11-16T08:00:00Z'))});equal(other.status,200,'new month');equal(s.rows[2].fecha.slice(0,7),'2026-11','new month preserved');
});
Deno.test('F2 old client without native ID preserves legacy duplicate behavior',async()=>{
 const s=storage();const b:any=body('');delete b.evento;await post(s,b);const r=await post(s,b);equal(s.rows.length,1,'legacy exact repeat row');equal(r.data.dup,true,'legacy exact duplicate');
});
Deno.test('F2 TR Wallet cross-door still deduplicates to matching original ACK',async()=>{
 const s=storage();const first=await post(s,body('v1_tr'));const alias=await post(s,{evento:'v1_wallet',fuente:'wallet',fecha:body('').fecha,titulo:'OTRO COMERCIO SINTETICO',texto:'9,95 € con Trade Republic Visa Card'});
 equal(alias.data.dup,true,'cross-door duplicate');equal(alias.data.ack,first.data.ack,'cross-door original ACK');equal(s.rows.length,1,'cross-door rows');
});
Deno.test('F2 timestamp slots preserve UTC and Madrid day/month/year including DST',async()=>{
 const madrid=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
 for(const fecha of ['2026-10-31T22:59:59.999Z','2026-10-31T23:59:59.999Z','2026-12-31T22:59:59.999Z','2026-12-31T23:59:59.999Z','2026-03-28T22:59:59.999Z','2026-03-29T00:59:59.999Z','2026-10-25T00:59:59.999Z']){
 const s=storage();const a=await post(s,{...body('v1_boundary_a'),fecha:String(Date.parse(fecha))});const b=await post(s,{...body('v1_boundary_b'),fecha:String(Date.parse(fecha))});
 equal([a.status,b.status],[200,200],'boundary statuses');equal(s.rows.length,2,'boundary rows');
 for(const row of s.rows){equal(row.fecha.slice(0,10),fecha.slice(0,10),'UTC accounting day');equal(madrid.format(new Date(row.fecha)),madrid.format(new Date(fecha)),'Madrid accounting day');}
 equal(filasComoLaApp(s.rows,[],[],'owner-synthetic').reduce((n,r)=>n+Math.round(Number(r.importe)*100),0),1990,'boundary cents');}
 equal(fechaEventoOrdinal('2026-10-16T08:00:00.000Z',1000000),null,'unsafe ordinal rejected');
});
Deno.test('F2 failed native reads cannot ACK or insert blindly',async()=>{
 for(const opts of [{ackError:true}]){const s=storage(opts);const r=await post(s,body('v1_read_error'));equal(r.status,503,'uncertain read status');equal(s.rows.length,0,'no blind insert');equal(r.data.ack,undefined,'no fabricated ACK');}
});

Deno.test('F2 unknown empty insert or manual collision never becomes a fabricated extra payment',async()=>{
 const empty=storage({emptyInsert:true});const e=await post(empty,body('v1_empty'));equal(e.status,503,'empty insertion closed');equal(e.data.ack,undefined,'empty has no ACK');
 const manualDate=fechaEventoOrdinal('2026-10-16T08:00:00.000Z',await ordinalEvento(claveEvento('v1_manual_collision','tr','')!));
 const manual=storage({rows:[{id:'manual-paid',user_id:'owner-synthetic',fecha:manualDate,importe:9.95,comercio:'COMERCIO SINTETICO',cat:'taxi',source:'manual:trade_republic'}]});
 const m=await post(manual,body('v1_manual_collision'));equal(m.status,503,'manual collision remains retryable');equal(m.data.ack,undefined,'no ACK of another row');equal(manual.rows.length,1,'manual not doubled');equal(manual.rows[0].cat,'taxi','manual category untouched');
});

Deno.test('F2 concurrent native events with different original milliseconds keep distinct read identity',async()=>{
 const s=storage();await Promise.all([post(s,body('v1_time_a')),post(s,{...body('v1_time_b'),fecha:String(Number(body('').fecha)+10)})]);
 equal(s.rows.length,2,'different-time concurrent rows');equal(filasComoLaApp(s.rows,[],[],'owner-synthetic').reduce((n,r)=>n+Math.round(Number(r.importe)*100),0),1990,'different-time concurrent cents');
});

Deno.test('F2 double-pending cross-door replays never ACK an unconfirmed survivor',async()=>{
 const opts={releaseError:true,deleteError:true,syncPrechecks:true};const s=storage(opts);
 const tr=body('v1_double_pending_tr');
 const wallet={evento:'v1_double_pending_wallet',fuente:'wallet',fecha:tr.fecha,titulo:'ALIAS SINTETICO',texto:'9,95 € con Trade Republic Visa Card'};
 const seeded=await Promise.all([post(s,tr),post(s,wallet)]);
 equal(seeded.map(r=>r.status),[503,503],'both uncertain writes');equal(s.rows.length,2,'both uncertain rows retained');
 equal(s.rows.every(r=>String(r.source).includes('#dup')),true,'both still pending');
 const replays=await Promise.all([post(s,tr),post(s,wallet)]);
 console.log(JSON.stringify({rows:s.rows.length,pending:s.rows.filter(r=>String(r.source).includes('#dup')).length,replayStatuses:replays.map(r=>r.status),replayACKs:replays.map(r=>r.data.ack||null)}));
 for(const r of replays){if(r.status===200){const ack=s.rows.find(row=>row.id===r.data.ack);equal(!!ack&&!String(ack.source).includes('#dup'),true,'every successful ACK is released');}else equal(r.status,503,'pending remains retryable');}
 // Se resuelve el fallo del SDK; las filas SOLO cambian mediante los reenvíos al handler real.
 opts.deleteError=false;
 const finalA=await post(s,tr),finalB=await post(s,wallet);
 equal([finalA.status,finalB.status],[200,200],'automatic recovery without changing source externally');
 equal(finalA.data.ack,finalB.data.ack,'one stable released survivor ACK');equal(s.rows.length,1,'pending alias removed only after survivor release');
 equal(String(s.rows[0].source).startsWith('native:trade_republic#e'),true,'confirmed survivor');equal(Math.round(Number(s.rows[0].importe)*100),995,'one cross-door payment');
});

Deno.test('F2 postinsert never deletes own row or ACKs an earlier pending twin',async()=>{
 const tr=body('v1_post_pending_tr');
 const wallet={evento:'v1_post_pending_wallet',fuente:'wallet',fecha:tr.fecha,titulo:'ALIAS POST SINTETICO',texto:'9,95 € con Trade Republic Visa Card'};
 const trKey=claveEvento(tr.evento,'tr',tr.texto)!,walletKey=claveEvento(wallet.evento,'wallet',wallet.texto)!;
 for(const trFirst of [true,false]){
 const insertOrder=trFirst?[trKey,walletKey]:[walletKey,trKey];
 const s=storage({releaseError:true,syncPrechecks:true,insertOrder});
 const rs=await Promise.all([post(s,tr),post(s,wallet)]);
 console.log(JSON.stringify({insertOrder,statuses:rs.map(r=>r.status),rows:s.rows.length,sources:s.rows.map(r=>r.source),ACKs:rs.map(r=>r.data.ack||null),interleaving:s.interleaving}));
 equal(rs.map(r=>r.status),[503,503],'postinsert pending twin cannot confirm success');equal(s.rows.length,2,'do not delete while survivor is pending');
 equal(s.rows.map(r=>r.ingest_event_id),insertOrder,'actual event identities follow scheduled inserts');
 equal(s.rows.every(r=>String(r.source).includes('#dup')),true,'both rows remain pending');
 equal(s.interleaving.filter(r=>r.op==='postinsert').map(r=>r.rows.length),[2,2],'both postinsert reads see both rows');
 equal(s.interleaving.filter(r=>r.op==='delete').length,0,'no pending row deletion attempted');
 equal(s.rows.map(r=>Math.round(Number(r.importe)*100)),[995,995],'both original amounts unchanged');
 equal(s.rows.filter(r=>!String(r.source).includes('#dup')).reduce((n,r)=>n+Math.round(Number(r.importe)*100),0),0,'pending rows contribute no confirmed cents');
 // Promise.all conserva el orden de las peticiones, no el del INSERT: la posterior nunca acusa la gemela pendiente.
 if(trFirst)equal(rs[1].data.ack,undefined,'no pending survivor ACK');
 else equal(rs[0].data.ack,undefined,'no pending survivor ACK');
 }
});

Deno.test('R2 B2 causal GREEN: different original hours retain three complete identities',async()=>{
 const s=storage();await post(s,body('v1_r2_initial'));
 const rs=await Promise.all([post(s,{...body('v1_r2_b'),fecha:String(Number(body('').fecha)+3600000)}),post(s,{...body('v1_r2_c'),fecha:String(Number(body('').fecha)+7200000)})]);
 equal(rs.map(r=>r.status),[200,200],'different-hour statuses');equal(s.rows.length,3,'three real events');
 equal(new Set(s.rows.map(r=>r.source)).size,3,'three full source identities');
 equal(filasComoLaApp(s.rows,[],[],'owner-synthetic').reduce((n,r)=>n+Math.round(Number(r.importe)*100),0),2985,'independent three-event cents');
 console.log(JSON.stringify({causal:'same RED inputs and unchanged handler boundary',rows:s.rows.length,cents:2985,sources:s.rows.map(r=>r.source)}));
});

Deno.test('R2 SHA256 projection collisions arbitrate UNIQUE and retain full-event ACKs',async()=>{
 const groups=new Map<number,string[]>();let ids:string[]=[];
 for(let i=0;i<6000;i++){const id='v1_collision_'+i,n=await ordinalEvento(claveEvento(id,'tr','')!),g=groups.get(n)||[];g.push(id);groups.set(n,g);if(g.length===3){ids=g;break;}}
 equal(ids.length,3,'three real SHA256 projection collisions');const s=storage();
 const rs=await Promise.all(ids.map(id=>post(s,body(id))));equal(rs.map(r=>r.status),[200,200,200],'three collision statuses');
 equal(s.rows.length,3,'three collision events');equal(new Set(s.rows.map(r=>r.fecha)).size,3,'global four-column UNIQUE probes');
 equal(s.writes.length>3,true,'collision arbitration really retried inserts');
 for(const [i,id]of ids.entries())equal((await post(s,body(id))).data.ack,rs[i].data.ack,'own exact-event ACK after collision');
 equal(filasComoLaApp(s.rows,[],[],'owner-synthetic').reduce((n,r)=>n+Math.round(Number(r.importe)*100),0),2985,'collision money invariant');
});

Deno.test('R2 bounded native probe exhaustion fails closed without foreign ACK',async()=>{
 const b=body('v1_probe_cap'),first=await ordinalEvento(claveEvento(b.evento,'tr','')!);
 const rows=Array.from({length:8},(_,i)=>({id:'occupied-'+i,user_id:'owner-synthetic',fecha:fechaEventoOrdinal('2026-10-16T08:00:00.000Z',first+i),importe:9.95,comercio:'COMERCIO SINTETICO',cat:'otros',source:'native:trade_republic#e'+encodeURIComponent('tr:trade_republic:v1_occupied_'+i)+'#t1792137600000#n'+(first+i),ingest_event_id:'tr:trade_republic:v1_occupied_'+i}));
 const s=storage({rows}),r=await post(s,b);equal(r.status,503,'bounded exhaustion status');equal(r.data.ack,undefined,'no foreign ACK');
 equal(s.rows.length,8,'no fabricated extra event');equal(s.writes.length,8,'exact eight-attempt bound');
});

Deno.test('R2 original event time preserves the exact two-hour cross-door boundary',async()=>{
 for(const delta of [7200000,7200001]){const s=storage();await post(s,body('v1_boundary_tr'));
 const r=await post(s,{evento:'v1_boundary_wallet',fuente:'wallet',fecha:String(Number(body('').fecha)+delta),titulo:'ALIAS SINTETICO',texto:'9,95 € con Trade Republic Visa Card'});
 equal(r.status,200,'boundary status');equal(s.rows.length,delta===7200000?1:2,'original time, not displaced slot, controls cross-door pairing');}
});

Deno.test('R2 absent or disabled switch never writes the new native format',async()=>{
 try{for(const value of [undefined,'0','false','true']){if(value===undefined)Deno.env.delete('INGEST_NATIVE_TWINS');else Deno.env.set('INGEST_NATIVE_TWINS',value);
 const s=storage();await post(s,body('v1_off_a'));const r=await post(s,body('v1_off_b'));
 equal(s.rows.length,1,'OFF preserves baseline content conflict');equal(s.rows[0].source,'macrodroid','OFF native marker absent');equal(r.data.dup,true,'OFF legacy dedup');}}
 finally{Deno.env.set('INGEST_NATIVE_TWINS','1');}
});
