import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {loadPureLogic,loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';
import {sync,link,handlerSource} from './helpers/h2-sync.mjs';

// La base se carga ENTERA desde Git: una copia de applyBankBalances ocultaba regresiones.
const baseSHA='ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13';
const baseHTML=execFileSync('git',['show',baseSHA+':public/index.html'],{encoding:'utf8',maxBuffer:8*1024*1024});
const old=loadPureLogic(baseHTML), L=process.env.H2_CLIENT_FILE?loadPureLogic(fs.readFileSync(process.env.H2_CLIENT_FILE,'utf8')):loadPureLogicFromFile();
const baseServer=handlerSource(execFileSync('git',['show',baseSHA+':supabase/functions/bank-sync/index.ts'],{encoding:'utf8'}));
const prior='2026-10-16T01:00:00.000Z', stamp='2026-10-18T01:00:00.000Z';
class Clock extends Date {constructor(...a){super(...(a.length?a:[stamp]));} static now(){return Date.parse(stamp);}}
const plain=x=>JSON.parse(JSON.stringify(x));
const manual=(value,extra={})=>({id:'main',ent:'caixabank',role:'fijos',value,...extra});
const extra=(key,value,more={})=>({key,aspsp:'CaixaBank',ent:'caixabank',value,cur:'EUR',balanceAt:prior,...more});
const state=(accounts=[],obAccounts=[])=>({accounts,obAccounts,expenses:[],fixed:[],flows:[],debts:[],oneoffs:[]});
const cents=s=>Math.round([...s.accounts,...s.obAccounts].reduce((n,a)=>n+a.value,0)*100);
const bank=accounts=>({...link(),last_sync:prior,accounts});
const reply=()=>({transactions:[]});
reply.balance=p=>({balances:[{balance_type:'ITAV',balance_amount:{amount:p.includes('/b/')?'30':'70',currency:'EUR'}}]});
const modes=[['new',undefined],['legacy',baseServer]];
let pass=0,fail=0;
async function t(name,fn){if(process.env.H2_CASE_FILTER&&!name.includes(process.env.H2_CASE_FILTER))return;try{await fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}}
async function response(accounts,source,answer=reply){return (await sync([bank(accounts)],answer,{recoverGaps:true,acks:{},accountPhases:1},Clock,null,source)).data.links;}
function compare(s,links,expected){
 const baseline=old.applyBankBalances(plain(s),links).state;
 assert.equal(cents(baseline),expected,'actual base oracle');
 const got=L.applyBankBalances(plain(s),links).state;
 assert.equal(cents(got),expected,'candidate money regression');
 assert.equal(cents(L.applyBankBalances(got,links).state),expected,'replay');
 return got;
}
for(const [mode,source] of modes){
 for(const withExtra of [false,true])await t(`R4 R1 ${mode}: total UID replacement restores 10000 cents (old extra=${withExtra})`,async()=>{
  const links=await response([{uid:'a'},{uid:'b'}],source);
  const got=compare(state([manual(50,{bankUid:'old-main'})],withExtra?[extra('old-extra',20)]:[]),links,10000);
  assert.equal(got.accounts[0].value,70);assert.equal(got.accounts[0].bankUid,'a');assert.equal(got.accounts[0].balanceStale,false);
  assert.deepEqual(plain(got.obAccounts.map(a=>[a.key,a.value])),[['b',30]]);
 });
 for(const identity of ['UID','IBAN'])await t(`R4 R2 ${mode}/${identity}: reserve exact principal then allocate first free and visible extra, 10500 cents`,async()=>{
  const answer=()=>({transactions:[]});answer.balance=p=>({balances:[{balance_type:'ITAV',balance_amount:{amount:p.includes('/b/')?'30':p.includes('/c/')?'5':'70',currency:'EUR'}}]});
  const known=identity==='IBAN'?{bankIban:'IBAN-A'}:{bankUid:'a'};
  const links=await response([{uid:'b'},{uid:'a',...(identity==='IBAN'?{iban:'IBAN-A'}:{})},{uid:'c'}],source,answer);
  const got=compare(state([manual(50,known),manual(20,{id:'free'})]),links,10500);
  assert.deepEqual(plain(got.accounts.map(a=>a.value)),[70,30]);assert.equal(got.accounts[1].bankUid,'b');
  assert.deepEqual(plain(got.obAccounts.map(a=>[a.key,a.value])),[['c',5]]);
 });
 await t(`R4 boundary ${mode}: partial UID replacement keeps principal and shows every free account`,async()=>{
  const links=await response([{uid:'a'},{uid:'b'},{uid:'c'}],source);
  const got=L.applyBankBalances(state([manual(50,{bankUid:'old-main',balanceAt:prior})],[extra('b',20)]),links).state;
  assert.equal(got.accounts[0].bankUid,'old-main');assert.equal(got.accounts[0].value,50);assert.equal(got.accounts[0].balanceAt,prior);assert.equal(got.accounts[0].balanceStale,true);
  assert.deepEqual(plain(got.obAccounts.map(a=>[a.key,a.value])),[['a',70],['b',30],['c',70]]);assert.equal(cents(got),22000);
  assert.equal(cents(L.applyBankBalances(got,links).state),22000);
 });
 await t(`R4 boundary ${mode}: multiple unbound principals stay unassigned with visible extras`,async()=>{
  const links=await response([{uid:'a'},{uid:'b'}],source);
  const got=L.applyBankBalances(state([manual(50,{bankUid:'old1'}),manual(30,{id:'second',bankUid:'old2'})]),links).state;
  assert.deepEqual(plain(got.accounts.map(a=>[a.value,a.bankUid])),[[50,'old1'],[30,'old2']]);assert.ok(got.accounts.every(a=>a.balanceStale));
  assert.deepEqual(plain(got.obAccounts.map(a=>[a.key,a.value])),[['a',70],['b',30]]);assert.equal(cents(got),18000);
 });
 for(const count of [2,3])await t(`R3 ${mode}: new bank ${count} accounts assigns first to sole unlinked manual`,async()=>{
  const links=await response(['a','b','c'].slice(0,count).map(uid=>({uid})),source);
  const got=compare(state([manual(50)]),links,count===2?10000:17000);
  assert.equal(got.accounts[0].value,70);assert.equal(got.accounts[0].bankUid,'a');assert.equal(got.accounts[0].balanceStale,false);
  assert.deepEqual(plain(got.obAccounts.map(a=>[a.key,a.value])),count===2?[['b',30]]:[['b',30],['c',70]]);
 });
 await t(`R3 ${mode}: exact IBAN takes priority over first free account`,async()=>{
  const got=compare(state([manual(50,{bankIban:'IBAN-B'})]),await response([{uid:'a',iban:'IBAN-A'},{uid:'b',iban:'IBAN-B'}],source),10000);
  assert.equal(got.accounts[0].value,30);assert.equal(got.accounts[0].bankIban,'IBAN-B');assert.deepEqual(plain(got.obAccounts.map(a=>[a.key,a.value])),[['a',70]]);
 });
 await t(`R3 ${mode}: first free uses response order, not amount or UID sort`,async()=>{
  const got=compare(state([manual(50)]),await response([{uid:'b'},{uid:'a'}],source),10000);
  assert.equal(got.accounts[0].value,30);assert.equal(got.accounts[0].bankUid,'b');assert.deepEqual(plain(got.obAccounts.map(a=>[a.key,a.value])),[['a',70]]);
 });
 await t(`B1 ${mode}: new connection assigns previous manual 50 to real 70`,async()=>{
  const got=compare(state([manual(50)]),await response([{uid:'a'}],source),7000);
  assert.equal(got.accounts[0].bankUid,'a');assert.equal(got.obAccounts.length,0);
 });
 await t(`B1 ${mode}: reserve exact match before assigning the one free account`,async()=>{
  const s=state([manual(50),manual(40,{id:'known',bankIban:'IBAN-B'})]);
  const got=compare(s,await response([{uid:'b',iban:'IBAN-B'},{uid:'a',iban:'IBAN-A'}],source),10000);
  assert.deepEqual(plain(got.accounts.map(a=>a.bankIban)),['IBAN-A','IBAN-B']);assert.equal(got.obAccounts.length,0);
 });
 for(const representation of ['manual','extra']) await t(`B2 ${mode}/${representation}: no IBAN reconnect old50 plus new70 is 7000 cents`,async()=>{
  const s=representation==='manual'?state([manual(50,{bankUid:'old'})]):state([],[extra('old',50)]);
  const got=compare(s,await response([{uid:'a'}],source),7000);
  assert.equal(got.obAccounts.some(a=>a.key==='old'),false);
  if(representation==='manual')assert.equal(got.accounts[0].bankUid,'a');
 });
 await t(`B3 ${mode}: absent account is removed, not retained as stale money`,async()=>{
  const got=compare(state([],[extra('a',50),extra('b',30)]),await response([{uid:'a'}],source),7000);
  assert.equal(got.obAccounts.length,1);assert.equal(got.obAccounts[0].key,'a');
 });
}
// R4 sustituye expresamente el antiguo contrato de ocultar extras ambiguas.
await t('R3 updated by R4: multiple unlinked principals stay unassigned with visible extras',()=>{
 const s=state([manual(50),manual(30,{id:'second'})]);
 const links=[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:['a','b'].map(uid=>({uid,balanceOk:true,balances:[{amount:70,type:'ITAV'}]}))}];
 const got=L.applyBankBalances(s,links).state;assert.equal(cents(got),22000);assert.ok(got.accounts.every(a=>!a.bankUid&&a.balanceStale));assert.deepEqual(plain(got.accounts.map(a=>a.value)),[50,30]);assert.deepEqual(plain(got.obAccounts.map(a=>a.key)),['a','b']);
});
await t('R3 updated by R4: total UID replacement restores first principal and extras',()=>{
 const s=state([manual(50,{bankUid:'old'})]);
 const links=[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:['a','b'].map(uid=>({uid,balanceOk:true,balances:[{amount:70,type:'ITAV'}]}))}];
 const got=L.applyBankBalances(s,links).state;assert.equal(cents(got),14000);assert.equal(got.accounts[0].bankUid,'a');assert.equal(got.accounts[0].value,70);assert.deepEqual(plain(got.obAccounts.map(a=>a.key)),['b']);
});
await t('R3 updated by R4: one unlinked principal receives first free after exact reservations',()=>{
 const s=state([manual(50),manual(30,{id:'known',bankUid:'known'})]);
 const links=[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:['known','a','b'].map(uid=>({uid,balanceOk:true,balances:[{amount:70,type:'ITAV'}]}))}];
 const got=L.applyBankBalances(s,links).state;assert.equal(cents(got),21000);assert.equal(got.accounts[0].value,70);assert.equal(got.accounts[0].bankUid,'a');assert.equal(got.accounts[1].bankUid,'known');assert.deepEqual(plain(got.obAccounts.map(a=>a.key)),['b']);
});
await t('B1: explicitly failed principal reserves its identity before free manual assignment',()=>{
 const s=state([manual(125,{bankUid:'a',balanceAt:prior}),manual(80,{id:'free'})]);
 const links=[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[{uid:'b',balanceOk:true,balances:[{amount:100,type:'ITAV'}],balanceAt:stamp},{uid:'a',balanceOk:false,balances:[]}]}];
 const got=L.applyBankBalances(s,links).state;assert.equal(cents(got),22500);assert.equal(got.accounts[0].value,125);assert.equal(got.accounts[0].balanceAt,prior);assert.equal(got.accounts[1].bankUid,'b');
});
await t('B3: only returned failed identity is retained while absent sister disappears',()=>{
 const s=state([],[extra('a',125),extra('b',80),extra('gone',50)]);
 const links=[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[{uid:'a',balanceOk:false,balances:[]},{uid:'b',balanceOk:true,balances:[{amount:100,type:'ITAV'}],balanceAt:stamp}]}];
 const got=L.applyBankBalances(s,links).state;assert.equal(cents(got),22500);assert.equal(got.obAccounts.length,2);assert.equal(got.obAccounts[0].balanceAt,prior);
});
await t('distinct known IBAN is never rebound to an unrelated free bank account',()=>{
 const s=state([manual(50,{bankIban:'IBAN-OLD'})]);
 const links=[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[{uid:'new',iban:'IBAN-NEW',balanceOk:true,balances:[{amount:70,type:'ITAV'}]}]}];
 const got=L.applyBankBalances(s,links).state;assert.equal(got.accounts[0].value,50);assert.equal(got.accounts[0].bankIban,'IBAN-OLD');assert.equal(got.obAccounts[0].value,70);
});
await t('several unmatched no-IBAN principals do not choose new UIDs by order',()=>{
 const s=state([manual(50,{bankUid:'old1'}),manual(30,{id:'second',bankUid:'old2'})]);
 const links=[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:['new1','new2'].map(uid=>({uid,balanceOk:true,balances:[{amount:70,type:'ITAV'}]}))}];
 const got=L.applyBankBalances(s,links).state;assert.equal(cents(got),22000);assert.deepEqual(plain(got.accounts.map(a=>[a.value,a.bankUid])),[[50,'old1'],[30,'old2']]);assert.ok(got.accounts.every(a=>a.balanceStale));assert.deepEqual(plain(got.obAccounts.map(a=>a.key)),['new1','new2']);
});
for(const phases of [false,true])await t(`UID-less metadata does not block complete cursor (phases=${phases})`,async()=>{
 const b=bank([{uid:'a'},{iban:'metadata only'}]);
 const r=await sync([b],reply,{recoverGaps:true,acks:{},...(phases?{accountPhases:1}:{})},Clock);
 assert.equal(r.data.links[0].accounts.length,1);assert.ok(r.data.links[0].ack);assert.equal(r.calls.length,2);
 const accepted=await sync([b],reply,{recoverGaps:true,acks:{CaixaBank:r.data.links[0].ack},...(phases?{accountPhases:1}:{})},Clock);
 assert.equal(b.last_sync,stamp);assert.ok(accepted.writes.some(w=>w.last_sync===stamp));
});
await t('balance failure is logged with closed code even when transactions are complete',async()=>{
 const answer=()=>({transactions:[]});answer.balanceError='EB 503: PRIVATE_SYNTHETIC_ERROR';
 const r=await sync([bank([{uid:'a'}])],answer,{recoverGaps:true,acks:{},accountPhases:1},Clock);
 const detail=JSON.parse(r.events.find(e=>e.message.startsWith('OB sync')).detail);
 assert.equal(detail.pages,1);assert.equal(detail.status,'empty');assert.deepEqual(detail.reasons,[]);
 assert.ok(r.events.some(e=>{try{return JSON.parse(e.detail).failureCodes?.includes('eb_503');}catch{return false;}}));
 assert.equal(JSON.stringify(r.events).includes('PRIVATE_SYNTHETIC_ERROR'),false);assert.ok(r.data.links[0].ack);
});
await t('legacy balance failure keeps its original zero transaction requests and no cursor',async()=>{
 const answer=()=>{throw Error('transactions must not be requested');};answer.balanceError='EB 503 PRIVATE_SYNTHETIC_ERROR';
 const b=bank([{uid:'a'}]),r=await sync([b],answer,{recoverGaps:true,acks:{}},Clock);
 assert.equal(r.calls.length,1);assert.equal(r.data.links[0].ack,undefined);assert.equal(b.last_sync,prior);
 const detail=JSON.parse(r.events.find(e=>e.message.startsWith('OB sync')).detail);
 assert.equal(detail.pages,0);assert.equal(detail.status,'error');assert.ok(detail.failureCodes.includes('eb_503'));
});
// Ejecuta el bloque real de telemetría, manteniendo el handler y el balance picker reales.
const main=fs.readFileSync(process.env.H2_MAIN_FILE||new URL('../src/modules/11-app-main.js',import.meta.url),'utf8');
const telemetry=main.slice(main.indexOf('      // Telemetría (caso CaixaBank'),main.indexOf('      const preview=applyBankBalances'));
assert.ok(telemetry.includes('cloud.logEvent'));
for(const kind of ['valid-balance-failed-tx','expected-balance-failure','malformed-success'])await t('telemetry '+kind,()=>{
 const a=kind==='valid-balance-failed-tx'?{ok:false,balanceOk:true,balances:[{amount:70,type:'ITAV'}]}:kind==='expected-balance-failure'?{ok:true,balanceOk:false,balanceError:'eb_503',balances:[]}:{ok:true,balanceOk:true,balances:[]};
 const events=[];new Function('links','cloud','pickBankBalance',telemetry)([{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[a]}],{logEvent:(...args)=>events.push(args)},L.pickBankBalance);
 assert.equal(events.length,kind==='malformed-success'?1:0);
});
console.log(JSON.stringify({baseSHA,passed:pass,failed:fail}));process.exitCode=fail?1:0;
