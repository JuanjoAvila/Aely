// Handler real intacto; el SDK y el almacenamiento son sintéticos, sin red ni PostgreSQL.
import { claveEvento, fechaEventoOrdinal } from '../_shared/ingest_identity.ts';
import { filasComoLaApp } from '../_shared/presupuesto.ts';
const runtime=Deno as unknown as Record<string,any>;
let handler:(req:Request)=>Promise<Response>;
let activeDb:any;
const oldServe=runtime.serve;
runtime.serve=(f:any)=>{handler=f;return {};};
Deno.env.set('SUPABASE_URL','https://synthetic.invalid');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','synthetic');
Deno.env.set('INGEST_TOKEN','');Deno.env.set('INGEST_USER_ID','owner-synthetic');
(globalThis as any).__ingestSyntheticClient=()=>activeDb;
await import('./index.ts');
function equal(actual:any,expected:any,label:string){if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(label+': expected '+JSON.stringify(expected)+', actual '+JSON.stringify(actual));}
function storage(opts:any={}){
 const rows:any[]=(opts.rows||[]).map((r:any)=>({...r})),events:any[]=[],writes:any[]=[];
 function from(name:string){const q:any={op:'select',filters:[],cols:'*',row:null};const api:any={
 select(cols='*'){q.cols=cols;return api;},eq(k:string,v:any){if(k==='token')q.token=v;q.filters.push((r:any)=>String(r[k])===String(v));return api;},
 in(k:string,v:any[]){q.filters.push((r:any)=>v.includes(r[k]));return api;},
 gte(k:string,v:any){q.filters.push((r:any)=>r[k]>=v);return api;},lte(k:string,v:any){q.filters.push((r:any)=>r[k]<=v);return api;},lt(k:string,v:any){q.filters.push((r:any)=>r[k]<v);return api;},
 limit(n:number){q.limit=n;return api;},range(a:number,b:number){q.range=[a,b];return api;},order(){return api;},abortSignal(){return api;},
 upsert(row:any,opts:any){q.op='upsert';q.row={...row};q.options=opts;return api;},insert(row:any){q.op='insert';q.row={...row};return api;},update(row:any){q.op='update';q.row={...row};return api;},delete(){q.op='delete';return api;},
 async maybeSingle(){return name==='ingest_tokens'?{data:{user_id:q.token==='token-other'?'owner-other':'owner-synthetic'},error:null}:name==='app_state'?{data:{data:{accounts:[{ent:'trade_republic',role:'diario'}],settings:{}}},error:null}:{data:null,error:null};},
 then(resolve:any,reject:any){return Promise.resolve().then(run).then(resolve,reject);}};
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
 const row={id:'synthetic-'+(rows.length+1),created_at:q.row.fecha,...q.row};rows.push(row);return {data:[{id:row.id}],error:null};}
 if(q.op==='update'){if(opts.releaseError){opts.releaseError=false;return {data:null,error:{message:'synthetic release failure'}};}for(const r of matches())Object.assign(r,q.row);return {data:[],error:null};}
 if(q.op==='delete'){const gone=new Set(matches());for(let i=rows.length-1;i>=0;i--)if(gone.has(rows[i]))rows.splice(i,1);return {data:[],error:null};}
 throw Error('Unexpected query');}
 return api;}
 return {db:{from,rpc:()=>Promise.resolve({data:true,error:null})},rows,events,writes};}
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
 equal(s.rows.map(r=>r.source),['macrodroid','ob:trade_republic#n2','ob:trade_republic#n3'],'ordinal source');
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
 const s=storage({releaseError:true});const first=await post(s,body('v1_release'));equal(first.status,503,'pending status');equal(s.rows[0].source,'ob:trade_republic#dup','pending source');
 const retry=await post(s,body('v1_release'));equal(retry.status,200,'repair status');equal(retry.data.ack,first.data.ack,'repair ACK');equal(s.rows.length,1,'repair one row');equal(s.rows[0].source,'macrodroid','confirmed source');
});
Deno.test('F2 owner is token-bound and months never share native slots',async()=>{
 const s=storage();const a=await post(s,body('v1_owner'));const b=await post(s,{...body('v1_owner'),user_id:'owner-synthetic'},'token-other');
 equal(s.rows.map(r=>r.user_id),['owner-synthetic','owner-other'],'owner from token only');equal(s.rows[0].fecha,s.rows[1].fecha,'owners have independent slots');
 const other=await post(s,{...body('v1_month'),fecha:String(Date.parse('2026-11-16T08:00:00Z'))});equal(other.status,200,'new month');equal(s.rows[2].source,'macrodroid','month ordinal reset');
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
 for(const opts of [{ackError:true},{slotError:true}]){const s=storage(opts);const r=await post(s,body('v1_read_error'));equal(r.status,503,'uncertain read status');equal(s.rows.length,0,'no blind insert');equal(r.data.ack,undefined,'no fabricated ACK');}
});

Deno.test('F2 unknown empty insert or manual collision never becomes a fabricated extra payment',async()=>{
 const empty=storage({emptyInsert:true});const e=await post(empty,body('v1_empty'));equal(e.status,503,'empty insertion closed');equal(e.data.ack,undefined,'empty has no ACK');
 const manual=storage({rows:[{id:'manual-paid',user_id:'owner-synthetic',fecha:'2026-10-16T08:00:00.000Z',importe:9.95,comercio:'COMERCIO SINTETICO',cat:'taxi',source:'manual:trade_republic'}]});
 const m=await post(manual,body('v1_manual_collision'));equal(m.status,503,'manual collision remains retryable');equal(m.data.ack,undefined,'no ACK of another row');equal(manual.rows.length,1,'manual not doubled');equal(manual.rows[0].cat,'taxi','manual category untouched');
});

Deno.test('F2 concurrent native events with different original milliseconds keep distinct read identity',async()=>{
 const s=storage();await Promise.all([post(s,body('v1_time_a')),post(s,{...body('v1_time_b'),fecha:String(Number(body('').fecha)+10)})]);
 equal(s.rows.length,2,'different-time concurrent rows');equal(filasComoLaApp(s.rows,[],[],'owner-synthetic').reduce((n,r)=>n+Math.round(Number(r.importe)*100),0),1990,'different-time concurrent cents');
});
