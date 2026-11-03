/** Oráculos A de investigación: 5PASS/3RED en la base; no implementa persistencia. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {post,fakeDb,client,state,identity,read} from './runtime.mjs';
const result={schema:1,GO:'468ffa260baaee706524c8ebdbe1b4401a57fe7b',baseSHA:'a9916c3cdb21c93f9d3a47653c0608e630ce50ab',oldCasesExecuted:0,proposedTablesUsed:0,runtimeSourceSHA256:createHash('sha256').update(fs.readFileSync(new URL('./runtime.mjs',import.meta.url))).digest('hex'),cases:[],observations:[]};
let failures=0;
async function t(kind,name,fn){try{await fn();result.cases.push({kind,name,pass:true});console.log('PASS '+kind+': '+name);}catch(e){failures++;result.cases.push({kind,name,pass:false,error:e.message,stack:e.stack});console.error('FAIL '+kind+': '+name+'\n'+e.stack);}}
const observe=(name,value)=>{result.observations.push({name,value});console.log('OBS '+name+' '+JSON.stringify(value));};
const body=(extra={})=>({fuente:'tr',titulo:'Round up Invertido',texto:'Se han invertido 0,42 € en Fondo Sintetico',fecha:String(Date.parse('2026-10-16T10:00:00Z')),evento:'v1_'+'a'.repeat(64),...extra});

await t('A-new-red','ACK debe distinguir recepción pendiente de ruido descartado',async()=>{
 const env=fakeDb(),r=await post(env,body());
 assert.equal(r.status,200);assert.equal(env.rows.length,0,'una señal A no es un gasto');
 observe('current-receipt',r.data);
 // received/status son una PROPUESTA de wire contract para la consulta, no campos ya aprobados.
 assert.equal(r.data.received,true,'no hay acuse de señal guardada; el handler solo dice skipped/ignorado');
 assert.equal(r.data.status,'pending');assert.equal(r.data.skipped,true);assert.equal(r.data.ack,undefined,'sin UUID de gasto confirmado');
});
await t('A-new-red','reintento debe devolver recibo estable sin depender de telemetría',async()=>{
 const env=fakeDb(),a=await post(env,body()),b=await post(env,body({texto:'Se han invertido 0,42 € en Otro nombre sintetico'}));
 assert.equal(env.rows.length,0);assert.equal(env.events.length,2,'control: el estado actual registra dos descartes, no un recibo');
 observe('retry-current',{responses:[a.data,b.data],eventKinds:env.events.map(e=>e.kind)});
 assert.equal(typeof a.data.receipt,'string','el mismo evento no tiene un recibo durable confirmado');
 assert.equal(a.data.receipt,b.data.receipt);
});
await t('A-new-control','sin huella nativa no se inventa un recibo a partir de importe/texto',async()=>{
 const env=fakeDb();const r=await post(env,body({evento:''}));assert.equal(r.data.received,undefined);assert.equal(env.rows.length,0);
});
await t('A-new-control','Wallet con comercio llamado Round up Invertido sigue siendo compra Wallet',async()=>{
 const env=fakeDb();const r=await post(env,body({fuente:'wallet',texto:'0,42 € con Trade Republic Visa Card',evento:'v1_'+'b'.repeat(64)}));
 assert.equal(r.data.skipped,undefined);assert.equal(env.rows.length,1);assert.equal(r.data.received,undefined);assert.equal(env.rows[0].comercio,'Round up Invertido');
});
await t('A-storage-risk','una señal simulada como expense#dup puede activarse con la decisión existente',()=>{
 const row={id:'pending-proposal',fecha:'2026-10-16T10:00:00Z',importe:0.42,cat:'inversion',comercio:'Round up Invertido',no_card:true,source:'ob:trade_republic#dup',ingest_event_id:'tr:trade_republic:v1_'+'a'.repeat(64)};
 const e=client.expenseFromRow(row),s=state([e]);assert.equal(client.expenseCountsCash(e,s),false);
 const source=client.expenseSourceForCloud({...e,possibleDup:false});
 const released=client.expenseFromRow({...row,source});observe('expense-pending-release',{source,cashCounts:client.expenseCountsCash(released,state([released]))});
 assert.equal(client.expenseCountsCash(released,state([released])),false,'el codec/decisión existente no puede garantizar cero caja de una señal metida en expenses');
});
await t('A-new-control','huella legacy aceptada no acredita hash nativo específico de la vía nueva',()=>{
 assert.equal(identity.normalizarEventoId('v1_synthetic_roundup'),'v1_synthetic_roundup');
 observe('native-id-limit',{legacyAcceptsArbitraryOpaque:true,requireForNewPath:'v1_[a-f0-9]{64}',serverCanAttestPackage:false});
});
await t('A-new-control','emisor nativo hashea paquete/key/postTime sin texto, pero payload no manda paquete',()=>{
 const java=read('android/app/src/main/java/com/micartera/app/TrExpenseListener.java');
 const method=/static String stableEventId\(([^)]*)\)\s*\{([\s\S]*?)\n    \}/.exec(java);assert.ok(method);
 assert.match(method[1],/String pkg, String key, long postedAt/);assert.match(method[2],/SHA-256/);assert.doesNotMatch(method[1]+method[2],/title|text/i);
 const payload=java.slice(java.indexOf('body = new JSONObject()'),java.indexOf('if (postIngest(INGEST_URL, body)'));
 assert.match(payload,/\.put\("evento", evento\)/);assert.doesNotMatch(payload,/\.put\("(?:package|pkg|paquete)"/);
});
await t('A-new-control','escritor real de categoría no persiste una decisión diferenciada de Otros automático',async()=>{
 const core=read('src/modules/00-core.js');const start=core.indexOf('    async setExpenseCat(e, cat){');const end=core.indexOf('    // Un UPDATE sin filas',start);assert.ok(start>0&&end>start);
 const method=core.slice(start,end).trim().replace(/,\s*$/,'');let payload;
 const q={eq(){return q;},select:async()=>({data:[{id:'expense'}],error:null})};
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-owner'}}}})},from:()=>({update:p=>{payload=p;return q;}})};
 const setCat=new Function('sb','expenseCloudEq','expenseSourceForCloud','return ({'+method+'}).setExpenseCat;')(sb,q=>q,client.expenseSourceForCloud);
 await setCat({id:'expense',category:'otros'},'otros');assert.deepEqual(payload,{cat:'otros'});
 observe('explicit-otros-no-provenance',{write:payload,distinguishableFromAutomaticStoredCategory:false});
});

result.summary={passed:result.cases.filter(x=>x.pass).length,failed:failures,exitCode:failures?1:0};
if(process.env.PRO09_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.PRO09_EVIDENCE_DIR,'pro09-a-causal-evidence.json'),JSON.stringify(result,null,2)+'\n');
console.log('SUMMARY '+JSON.stringify(result.summary));process.exitCode=failures?1:0;
