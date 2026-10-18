import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {loadPureLogic,loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';
import {sync,link,movement,handlerSource} from './helpers/h2-sync.mjs';
import {contexto,STATE_KEY,ACK_KEY} from './helpers/banco-sintetico.mjs';

const L=process.env.H2_CLIENT_FILE?loadPureLogic(fs.readFileSync(process.env.H2_CLIENT_FILE,'utf8')):loadPureLogicFromFile(), old=loadPureLogicFromFile();
vm.runInContext(fs.readFileSync(new URL('./fixtures/h2-legacy-client.js',import.meta.url),'utf8'),old);
const stamp='2026-10-18T01:00:00.000Z', prior='2026-10-16T01:00:00.000Z';
let now=Date.parse(stamp);
class Clock extends Date { constructor(...a){super(...(a.length?a:[now]));} static now(){return now;} }
const body={recoverGaps:true,acks:{},accountPhases:1};
const bank=()=>({...link(),last_sync:prior,state_issued_at:'2026-10-01T01:00:00.000Z',session_id:'enc:session',accounts:[{uid:'a'},{uid:'b'}]});
const bal=n=>({balances:[{balance_type:'ITAV',balance_amount:{amount:String(n),currency:'EUR'}}]});
const tx=()=>({transactions:[{...movement(),booking_date:'2026-10-17',status:'BOOK'}]});
const state=()=>({accounts:[],expenses:[],obAccounts:[{key:'a',ent:'caixabank',aspsp:'CaixaBank',value:125,cur:'EUR',balanceAt:prior},{key:'b',ent:'caixabank',aspsp:'CaixaBank',value:80,cur:'EUR',balanceAt:prior}]});
const cents=s=>Math.round(s.obAccounts.reduce((n,a)=>n+a.value,0)*100);
const plain=x=>JSON.parse(JSON.stringify(x));
let pass=0,fail=0;
async function t(name,fn){ now=Date.parse(stamp);try{await fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);} }
async function failedBalance(mode=body){const reply=tx;reply.balanceError=p=>p.includes('/a/')?'EB 503: synthetic':null;try{return await sync([bank()],reply,mode,Clock);}finally{delete reply.balanceError;} }

await t('balance failure does not suppress transaction query, complete transactions offer ACK',async()=>{
 const r=await failedBalance();const l=r.data.links[0];
 assert.equal(r.calls.filter(x=>x.includes('/transactions')).length,2);assert.ok(l.ack);
 assert.equal(l.accounts[0].balanceOk,false);assert.equal(l.accounts[0].balanceError,'eb_503');
 assert.equal(l.accounts[0].ok,true);assert.equal(l.accounts[0].count,1);
 assert.equal(r.writes.some(w=>w.last_sync===stamp),false);
});
await t('healthy sister preserves 12500 cents and timestamp, total 22500 cents',async()=>{
 const r=await failedBalance();const s=L.applyBankBalances(state(),r.data.links).state;
 assert.equal(cents(s),22500);const a=s.obAccounts.find(a=>a.key==='a');
 assert.equal(a.stale,true);assert.equal(a.balanceAt,prior);assert.equal(s.obAccounts.find(a=>a.key==='b').balanceAt,stamp);
 assert.equal(r.data.links[0].balanceAt,undefined);
 assert.ok(L.bankReadWarnings(r.data.links,[],false).some(w=>w.key==='bank_read_balance'));
});
await t('first transaction page failure still applies valid 10000-cent balance, no ACK',async()=>{
 const b=bank();b.accounts=[{uid:'a'}];const r=await sync([b],()=>{throw Error('EB 503');},body,Clock);
 assert.equal(r.data.links[0].accounts[0].balanceOk,true);assert.equal(r.data.links[0].ack,undefined);
 const s=L.applyBankBalances({...state(),obAccounts:state().obAccounts.slice(0,1)},r.data.links).state;
 assert.equal(cents(s),10000);assert.equal(s.obAccounts[0].balanceAt,stamp);
});
await t('old client new server keeps entire bank and cursor when balance missing; replay stable',async()=>{
 const r=await failedBalance({recoverGaps:true,acks:{}}),l=r.data.links[0];
 assert.equal(l.ok,false);assert.equal(l.ack,undefined);assert.equal(l.balanceAt,undefined);
 assert.equal(r.writes.some(w=>w.last_sync),false);
 let s=old.applyBankBalances(state(),r.data.links).state;assert.equal(cents(s),20500);
 s=old.applyBankBalances(s,r.data.links).state;assert.equal(cents(s),20500);
 const once=old.flattenBankTx(r.data.links,[]);assert.deepEqual(plain(old.flattenBankTx(r.data.links,once)),plain(once));
});
await t('old client new server valid balance survives failed transaction page',async()=>{
 const b=bank();b.accounts=[{uid:'a'}];const r=await sync([b],()=>{throw Error('EB 503');},{recoverGaps:true,acks:{}},Clock);
 assert.equal(cents(old.applyBankBalances({...state(),obAccounts:state().obAccounts.slice(0,1)},r.data.links).state),10000);
 assert.equal(r.data.links[0].ack,undefined);
});
await t('new client actual base server mixed accounts retain previous failed balance',async()=>{
 const legacy=handlerSource(execFileSync('git',['show','ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13:supabase/functions/bank-sync/index.ts'],{encoding:'utf8'}));
 const reply=()=>({transactions:[]});reply.balanceError=p=>p.includes('/a/')?'EB 503':null;
 const {data:{links}}=await sync([bank()],reply,body,Clock,null,legacy);
 const s=L.applyBankBalances(state(),links).state;assert.equal(cents(s),22500);assert.equal(s.obAccounts[0].balanceAt,prior);
 const oldTx=[{ent:'caixabank',id:'old',date:'2026-10-16',amount:-12.5,merchant:'Synthetic',status:'BOOK'}];
 assert.deepEqual(plain(L.flattenBankTx(links,oldTx)),oldTx);
});
await t('valid zero is zero, unavailable and malformed are not zero',async()=>{
 for(const value of [0,null,'',NaN]){
  const b=bank();b.accounts=[{uid:'a'}];const reply=()=>({transactions:[]});reply.balance=()=>bal(value);
  if(value===null)reply.balance=()=>({balances:[]});
  const r=await sync([b],reply,body,Clock);const s=L.applyBankBalances({...state(),obAccounts:state().obAccounts.slice(0,1)},r.data.links).state;
  assert.equal(cents(s),value===0?0:12500);assert.equal(r.data.links[0].accounts[0].balanceOk,value===0);
 }
});
await t('no prior balance creates no invented zero',async()=>{
 const r=await failedBalance();const s=L.applyBankBalances({...state(),obAccounts:[]},r.data.links).state;
 assert.equal(s.obAccounts.length,1);assert.equal(cents(s),10000);
});
await t('boolean and structured provider amounts are not valid numeric balances',async()=>{
 for(const value of [false,true,[],{}]){
  const b=bank();b.accounts=[{uid:'a'}];const reply=()=>({transactions:[]});reply.balance=()=>({balances:[{balance_amount:{amount:value,currency:'EUR'}}]});
  const r=await sync([b],reply,body,Clock);assert.equal(r.data.links[0].accounts[0].balanceOk,false);
  assert.equal(cents(L.applyBankBalances({...state(),obAccounts:state().obAccounts.slice(0,1)},r.data.links).state),12500);
 }
});
await t('promoted UID and IBAN identities survive reorder; failed main retains value/date',()=>{
 const s={...state(),accounts:[{id:'main',ent:'caixabank',role:'fijos',bankUid:'a',value:125,balSaldo:125,balanceAt:prior}],obAccounts:state().obAccounts.slice(1)};
 const l={aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[{uid:'b',balanceOk:true,balanceAt:stamp,balances:[{amount:100,type:'ITAV'}]},{uid:'a',balanceOk:false,balances:[]}]};
 const got=L.applyBankBalances(s,[l]).state;
 assert.equal(got.accounts[0].value,125);assert.equal(got.accounts[0].balanceAt,prior);assert.equal(got.accounts[0].balanceStale,true);assert.equal(cents(got),10000);
 const ib={...s,accounts:[{...s.accounts[0],bankIban:'IBAN-A'}]};l.accounts[1].iban='IBAN-A';l.accounts[1].uid='changed';
 assert.equal(L.applyBankBalances(ib,[l]).state.accounts[0].value,125);
});
await t('principal without identity is not rebound to first healthy account',()=>{
 const s={...state(),accounts:[{ent:'caixabank',role:'fijos',value:125}],obAccounts:[]};
 const links=[{aspsp:'CaixaBank',ok:true,accounts:[{uid:'b',balances:[{type:'ITAV',amount:100}]}]}];
 const got=L.applyBankBalances(s,links).state;assert.equal(got.accounts[0].value,125);assert.equal(got.accounts[0].bankUid,undefined);assert.equal(got.obAccounts.length,0);
});
await t('unreported bank retains original accounts unchanged',()=>{
 const s=state();s.obAccounts.push({key:'other',aspsp:'Other',value:17,cur:'EUR'});
 const got=L.applyBankBalances(s,[{aspsp:'CaixaBank',ok:false}]).state;assert.ok(got.obAccounts.some(a=>a.key==='other'&&a.value===17));
});
await t('pagination failure retains prefix, prior rows and forbids ACK; replay no duplicates',async()=>{
 const b=bank();b.accounts=[{uid:'a'}];const r=await sync([b],u=>{if(u.searchParams.has('continuation_key'))throw Error('EB 503');return {...tx(),continuation_key:'opaque +/='};},body,Clock);
 assert.equal(r.data.links[0].accounts[0].count,1);assert.equal(r.data.links[0].ack,undefined);
 const prev=[{ent:'caixabank',id:'older',date:'2026-10-16',amount:-2,merchant:'Earlier',status:'BOOK'}];
 const once=L.flattenBankTx(r.data.links,prev);assert.equal(once.length,2);assert.deepEqual(plain(L.flattenBankTx(r.data.links,once)),plain(once));
});
await t('controlled balance timeout leaves 10 seconds for transactions, serial calls',async()=>{
 const b=bank();b.accounts=[{uid:'a'}];let abortBalance,delay;
 const reply=()=>({transactions:[]});reply.balance=(p,init)=>new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true});queueMicrotask(()=>{now+=delay;abortBalance();});});
 const timers={setTimeout:(fn,ms)=>{abortBalance=fn;delay=ms;return 1;},clearTimeout:()=>{}};
 const r=await sync([b],reply,body,Clock,timers);
 assert.equal(delay,5000);assert.equal(r.budgets[0].timeout,10000);assert.deepEqual(r.calls.map(p=>p.split('/')[3].split('?')[0]),['balances','transactions']);
 assert.ok(r.data.links[0].ack);assert.equal(r.data.links[0].accounts[0].balanceError,'timeout');
});
await t('no transaction budget remains after global deadline; no new cursor',async()=>{
 const b=bank();b.accounts=[{uid:'a'}];const reply=()=>({transactions:[]});reply.balance=()=>{now+=60000;return bal(100);};
 const r=await sync([b],reply,body,Clock);assert.equal(r.data.links[0].ack,undefined);assert.equal(r.calls.length,1);
});
await t('accepted ACK requires matching affected row; stale auth cannot advance plan',async()=>{
 const b=bank();const initial=await sync([b],()=>({transactions:[]}),body,Clock);const ack=initial.data.links[0].ack;
 const reply=()=>({transactions:[]});reply.rejectWrites=true;
 b.last_sync='2026-08-25T01:00:00.000Z';
 const r=await sync([b],reply,{...body,acks:{CaixaBank:ack}},Clock);
 assert.equal(b.last_sync,'2026-08-25T01:00:00.000Z');assert.equal(r.writes.length,0);
 assert.ok(r.calls.some(p=>p.includes('date_to=')),'rejected ACK must not skip the old window');
 const b2=bank();await sync([b2],()=>({transactions:[]}),{...body,acks:{CaixaBank:ack}},Clock);assert.equal(b2.last_sync,stamp);
 b2.state_issued_at='2026-10-17T01:00:00.000Z';b2.last_sync=prior;await sync([b2],()=>({transactions:[]}),{...body,acks:{CaixaBank:ack}},Clock);assert.equal(b2.last_sync,prior);
});
await t('lost response repeats same cursor window, no duplicate ingestion',async()=>{
 const b=bank();b.accounts=[{uid:'a'}];const a=await sync([b],tx,body,Clock),c=await sync([b],tx,body,Clock);
 assert.equal(b.last_sync,prior);assert.deepEqual(a.calls,c.calls);
 const once=L.flattenBankTx(a.data.links,[]);assert.deepEqual(plain(L.flattenBankTx(c.data.links,once)),plain(once));
});
await t('local persistence mismatch cannot save ACK',()=>{
 assert.equal(L.obAckSave('not-on-disk',{CaixaBank:'anything'},[]),false);
});
await t('H2 ACK waits for expenses on disk even if balance and state are persisted',async()=>{
 const m=contexto(),exp=STATE_KEY+m.clave('EXP_SUFFIX'),s={...state(),lastBankSync:1};
 m.ctx.mcSaveRaw(STATE_KEY,s);
 const r=await failedBalance(),ack={CaixaBank:r.data.links[0].ack};
 const updated=m.ctx.applyBankBalances(s,r.data.links).state;
 updated.lastBankSync=2;updated.expenses=[{id:'test',amount:12.5,date:'2026-10-17',merchant:'Synthetic'}];
 m.disco.lleno=k=>k===exp;m.ctx.mcSaveRaw(STATE_KEY,updated);
 assert.equal(m.ctx.obAckSave(2,ack,updated.expenses),false);assert.equal(m.disco.actual.has(ACK_KEY),false);
 m.disco.lleno=null;m.ctx.mcSaveRaw(STATE_KEY,updated);
 assert.equal(m.ctx.obAckSave(2,ack,updated.expenses),true);
 assert.equal(JSON.parse(m.disco.actual.get(ACK_KEY)).CaixaBank,ack.CaixaBank);
});
await t('duplicate incoming account identity cannot double the balance',()=>{
 const a={uid:'a',balanceOk:true,balances:[{amount:100,type:'ITAV'}]};
 const s=L.applyBankBalances({...state(),obAccounts:state().obAccounts.slice(0,1)},[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[a,a]}]).state;
 assert.equal(cents(s),12500);assert.equal(s.obAccounts.length,1);assert.equal(s.obAccounts[0].stale,true);
});
await t('contradictory IBAN with the same UID neither replaces nor duplicates prior money',()=>{
 const s={...state(),obAccounts:[{...state().obAccounts[0],iban:'IBAN-A'}]};
 const a={uid:'a',iban:'IBAN-B',balanceOk:true,balances:[{type:'ITAV',amount:100}]};
 for(const accounts of [[a],[a,{...a,iban:'IBAN-C'}]]){
  const got=L.applyBankBalances(s,[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts}]).state;
  assert.equal(cents(got),12500);assert.equal(got.obAccounts.length,1);assert.equal(got.obAccounts[0].iban,'IBAN-A');
 }
});
await t('promotion without IBAN preserves UID and original freshness through next failed sync',async()=>{
 const original={...state(),obAccounts:state().obAccounts.slice(0,1)};
 const promoted=L.promoteObAccount(original,{},'a','fijos','main');
 assert.equal(promoted.accounts[0].bankUid,'a');assert.equal(promoted.accounts[0].balanceAt,prior);
 const r=await failedBalance();const got=L.applyBankBalances(promoted,r.data.links).state;
 assert.equal(got.accounts[0].value,125);assert.equal(got.accounts[0].balanceAt,prior);assert.equal(got.accounts[0].balanceStale,true);
 assert.equal(cents(got),10000);
});
await t('UID still matches when a response omits a previously known IBAN',()=>{
 const s=state();s.obAccounts[0].iban='IBAN-A';
 const l={aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[{uid:'a',balanceOk:true,balances:[{type:'ITAV',amount:100}]}]};
 const got=L.applyBankBalances(s,[l]).state;assert.equal(cents(got),18000);assert.equal(got.obAccounts.length,2);
 assert.equal(got.obAccounts.find(a=>a.key==='a').iban,'IBAN-A');assert.equal(got.obAccounts.find(a=>a.key==='a').balanceAt,prior);
});
await t('duplicate principal owners are both retained stale, never chosen by array order',()=>{
 const s={...state(),obAccounts:[],accounts:[{ent:'caixabank',bankUid:'a',value:125},{ent:'caixabank',bankUid:'a',value:80}]};
 const links=[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[{uid:'a',balanceOk:true,balances:[{type:'ITAV',amount:100}]}]}];
 const got=L.applyBankBalances(s,links).state;
 assert.deepEqual(plain(got.accounts.map(a=>a.value)),[125,80]);assert.ok(got.accounts.every(a=>a.balanceStale));assert.equal(got.obAccounts.length,0);
});
await t('previously promoted account retains its explicit ob order UID',()=>{
 const s={...state(),obAccounts:[],accounts:[{ent:'caixabank',role:'fijos',accountOrderKey:'ob:a',value:125}]};
 const links=[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[{uid:'a',balanceOk:true,balances:[{type:'ITAV',amount:100}]}]}];
 const got=L.applyBankBalances(s,links).state;
 assert.equal(got.accounts[0].value,100);assert.equal(got.accounts[0].bankUid,'a');assert.equal(got.obAccounts.length,0);
});
await t('unbound manual sister cannot block an explicitly identified principal',()=>{
 const s={...state(),obAccounts:[],accounts:[{ent:'caixabank',role:'fijos',bankUid:'a',value:125},{ent:'caixabank',role:'fijos',value:17}]};
 const links=[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[{uid:'a',balanceOk:true,balances:[{type:'ITAV',amount:100}]}]}];
 const got=L.applyBankBalances(s,links).state;
 assert.deepEqual(plain(got.accounts.map(a=>a.value)),[100,17]);assert.equal(got.obAccounts.length,0);
});
await t('valid balance does not suppress transaction 401 session verdict',async()=>{
 for(const closed of [false,true]){
  const b=bank();b.accounts=[{uid:'a'}];const reply=()=>{throw Error('EB 401');};reply.session=()=>({status:closed?'CLOSED':'AUTHORIZED'});
  const r=await sync([b],reply,body,Clock);
  assert.equal(r.calls.filter(p=>p.startsWith('/sessions/')).length,1);assert.equal(b.status,closed?'expired':'active');
  assert.equal(r.data.links[0].accounts[0].balanceOk,true);assert.equal(r.data.links[0].expired,closed);assert.equal(r.data.links[0].ack,undefined);
  assert.equal(cents(L.applyBankBalances({...state(),obAccounts:state().obAccounts.slice(0,1)},r.data.links).state),10000);
 }
});
console.log(JSON.stringify({passed:pass,failed:fail}));process.exitCode=fail?1:0;
