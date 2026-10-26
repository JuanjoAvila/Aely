import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {codeMask} from '../scripts/beta-source-code.mjs';import {loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';
import {seedLoggedInDashboard} from '../e2e/fixtures.mjs';
const root=new URL('../',import.meta.url),app=fs.readFileSync(new URL('src/modules/11-app-main.js',root),'utf8'),owner='synthetic-owner';
let core=fs.readFileSync(new URL('src/modules/00-core.js',root),'utf8');
const mutant=process.env.FIN04_FIRST_PULL_MUTANT,mutations={upsert:[".insert({ user_id:uid, data:data, updated_at:now })",".upsert({ user_id:uid, data:data, updated_at:now })"],money:["const now=new Date().toISOString();\n      if(lastKnownUpdatedAt)","data.debts[0].value+=123.45;const now=new Date().toISOString();\n      if(lastKnownUpdatedAt)"]};
if(mutant){const [from,to]=mutations[mutant]||[];core=core.replaceAll('\r\n','\n');assert.ok(from&&core.includes(from),'mutante aplicable');core=core.replace(from,to);}
function block(src,token){const mask=codeMask(src),start=mask.indexOf(token);assert.ok(start>=0,token);let i=mask.indexOf('{',start)+1,depth=1;for(;depth;i++){if(mask[i]==='{')depth++;if(mask[i]==='}')depth--;}return src.slice(start,i);}
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture({exists=true,reply,fail,changeOwner=false}={}){
 let row=exists?{user_id:owner,data:{fixed:[{id:'f',amount:42.37}],debts:[{id:'d',value:1200.23,monthly:100.11}],sentinel:-2.34},updated_at:'r0'}:null,current=owner;
 const requests=[];const sb={auth:{getSession:async()=>({data:{session:current?{user:{id:current}}:null},error:null})},from(table){let mode,body,filters=[];const q={insert(v){mode='insert';body=v;return q;},upsert(v){mode='upsert';body=v;return q;},update(v){mode='update';body=v;return q;},eq(k,v){filters.push([k,v]);return q;},async select(columns){requests.push({table,mode,body:copy(body),filters,columns});if(changeOwner)current='other';if(fail)return {data:null,error:{message:'synthetic failure'}};if(reply!==undefined)return {data:reply,error:null};if(mode==='insert'&&row)return {data:null,error:{code:'23505',message:'duplicate'}};if(mode==='update'&&(!row||!filters.every(([k,v])=>row[k]===v)))return {data:[],error:null};row=copy(body);return {data:[{updated_at:row.updated_at}],error:null};}};return q;}};
 const c=loadPureLogicFromFile();vm.createContext(c);const cloud=vm.runInContext('(function(sb){const statePushCache=new Map();return {'+['async session(','async pushState('].map(t=>block(core,t)).join(',')+'};})',c)(sb);
 return {cloud,requests,row:()=>copy(row),setOwner:u=>{current=u;}};
}
function bindAppSend(c){
 vm.createContext(c);
 const names=['cloudPullRef','syncFromCloud','cloudReadRef','cloudUpdatedAtRef','sessionRef','cloud','setStateRaw','goalSyncAck'];
 c.send=vm.runInContext('(function('+names.join(',')+'){'+block(app,'const pushAppState=function(')+';return pushAppState;})',c)(...names.map(k=>c[k]));
}
const payload=()=>({fixed:[{id:'f',amount:42.37,unknown:{keep:true}}],debts:[{id:'d',value:1200.23,monthly:100.11,original:1200.23}],sentinel:-2.34,_historyOwner:owner});
test('alta sin revisión no pisa una fila existente ni confirma el envío',async()=>{const f=fixture(),before=f.row(),sent=payload();sent.fixed[0].amount=7.77;await assert.rejects(f.cloud.pushState(owner,sent,null),e=>e.code==='23505');assert.deepEqual(f.row(),before);assert.equal(f.requests[0].mode,'insert');});
test('alta ausente inserta una vez; colisión del mismo cliente también rechaza',async()=>{const f=fixture({exists:false}),sent=payload(),ack=await f.cloud.pushState(owner,sent,null);assert.ok(ack.updated_at);assert.deepEqual(f.row().data.fixed,sent.fixed);assert.deepEqual(f.row().data.debts,sent.debts);assert.equal(Math.round(f.row().data.debts[0].value*100),120023);assert.equal(Math.round(f.row().data.debts[0].monthly*100),10011);assert.equal(f.row().data.sentinel,-2.34);await assert.rejects(f.cloud.pushState(owner,payload(),null));assert.equal(f.requests.length,2);});
test('CAS actualiza solo la fila y revisión leídas; la revisión atrasada no modifica dinero',async()=>{const f=fixture(),sent=payload(),ack=await f.cloud.pushState(owner,sent,'r0');assert.ok(ack.updated_at);assert.deepEqual(f.requests[0].filters,[['user_id',owner],['updated_at','r0']]);assert.equal(f.requests[0].columns,'updated_at');const before=f.row();const r=await f.cloud.pushState(owner,{...sent,budget:1},'r0');assert.equal(r.conflict,true);assert.deepEqual(f.row(),before);});
for(const [name,reply] of [['cero',[]],['dos',[{updated_at:'r1'},{updated_at:'r2'}]],['sin-revision',[{}]]])for(const revision of [null,'r0'])test('ACK '+name+' no confirma '+(revision?'UPDATE':'INSERT'),async()=>{const f=fixture({reply});assert.equal((await f.cloud.pushState(owner,payload(),revision)).conflict,true);await f.cloud.pushState(owner,payload(),revision);assert.equal(f.requests.length,2,'no cache de un ACK inválido');});
test('cambio de titular durante la respuesta no confirma ni conserva cache',async()=>{const f=fixture({changeOwner:true});await assert.rejects(f.cloud.pushState(owner,payload(),'r0'),e=>e.message==='ob_confirmed_owner');f.setOwner(owner);await assert.rejects(f.cloud.pushState(owner,payload(),'r0'));assert.equal(f.requests.length,2);});
test('titular distinto antes del envío no hace petición',async()=>{const f=fixture();f.setOwner('other');await assert.rejects(f.cloud.pushState(owner,payload(),'r0'));assert.equal(f.requests.length,0);});
test('cache válida no repite una escritura idéntica y conserva céntimos',async()=>{const f=fixture(),sent=payload(),ack=await f.cloud.pushState(owner,sent,'r0'),again=await f.cloud.pushState(owner,{...sent,_savedAt:123},ack.updated_at);assert.equal(again.unchanged,true);assert.equal(f.requests.length,1);assert.equal(Math.round(f.row().data.fixed[0].amount*100),4237);assert.equal(Math.round(f.row().data.debts[0].value*100),120023);});
test('puerta de App rechaza lectura pendiente/fallida y otro titular antes de llamar a cloud',async()=>{let calls=0,reads=0;const c=Object.assign(loadPureLogicFromFile(),{cloudPullRef:{current:null},syncFromCloud:()=>{reads++;},cloudReadRef:{current:null},cloudUpdatedAtRef:{current:null},sessionRef:{current:{user:{id:owner}}},cloud:{pushState:async()=>{calls++;return {updated_at:'r1'};}},setStateRaw:()=>{},goalSyncAck:()=>{}});bindAppSend(c);
 for(const read of [null,{owner,ready:false},{owner:'other',ready:true}]){c.cloudReadRef.current=read;assert.equal(await c.send(owner,payload()),null);}assert.equal(calls,0);assert.equal(reads,3);
 c.cloudReadRef.current={owner,ready:true};await c.send(owner,payload());assert.equal(calls,1);
});
test('ACK de una lectura sustituida no cambia revisión ni base de Metas',async()=>{let finish,acks=0;const read={owner,ready:true},c=Object.assign(loadPureLogicFromFile(),{cloudPullRef:{current:null},cloudReadRef:{current:read},cloudUpdatedAtRef:{current:'r0'},sessionRef:{current:{user:{id:owner}}},cloud:{pushState:()=>new Promise(r=>{finish=r;})},setStateRaw:()=>{acks++;},goalSyncAck:()=>{}});bindAppSend(c);const p=c.send(owner,payload());c.cloudReadRef.current={owner,ready:false};finish({updated_at:'r1'});assert.equal(await p,null);assert.equal(c.cloudUpdatedAtRef.current,'r0');assert.equal(acks,0);});

test('doble común conserva unicidad, CAS por titular/revisión y ACK de la fila escrita',async()=>{
 const storage={getItem:()=>null,setItem:()=>{}},c={window:{},localStorage:storage,sessionStorage:storage,setTimeout};vm.createContext(c);
 await seedLoggedInDashboard({addInitScript:async(fn,args)=>{c.args=args;vm.runInContext('('+fn.toString()+')(args)',c);}});
 c.window.supabase={createClient(){}};const sb=c.window.supabase.createClient(),p={user_id:'e2e-user',data:payload(),updated_at:'r0'};
 const insert=await sb.from('app_state').insert(p).select('updated_at');assert.deepEqual(copy(insert.data),[{updated_at:'r0'}]);
 const duplicate=await sb.from('app_state').insert({...p,updated_at:'bad'}).select('updated_at');assert.equal(duplicate.error.code,'23505');
 for(const [u,r]of [['other','r0'],['e2e-user','stale']]){const a=await sb.from('app_state').update({...p,updated_at:'bad'}).eq('user_id',u).eq('updated_at',r).select('updated_at');assert.deepEqual(copy(a.data),[]);}
 const ack=await sb.from('app_state').update({...p,updated_at:'r1'}).eq('user_id','e2e-user').eq('updated_at','r0').select('updated_at');assert.deepEqual(copy(ack.data),[{updated_at:'r1'}]);
 const row=(await sb.from('app_state').select('data,updated_at').maybeSingle()).data;assert.equal(row.updated_at,'r1');assert.equal(Math.round(row.data.fixed[0].amount*100),4237);assert.equal(Math.round(row.data.debts[0].value*100),120023);
});

test('ACK en updater diferido no aplica la base a una nueva sesión del mismo titular',async()=>{
 let updater,acks=0;const read={owner,ready:true},c=Object.assign(loadPureLogicFromFile(),{cloudPullRef:{current:null},cloudReadRef:{current:read},cloudUpdatedAtRef:{current:'r0'},sessionRef:{current:{user:{id:owner}}},cloud:{pushState:async()=>({updated_at:'r1'})},setStateRaw:f=>{updater=f;},goalSyncAck:s=>{acks++;return {...s,wrong:true};}});
 bindAppSend(c);await c.send(owner,payload());
 c.cloudReadRef.current={owner,ready:true};c.sessionRef.current={user:{id:owner}};const fresh={newSession:true};
 assert.equal(updater(fresh),fresh);assert.equal(acks,0);
});
