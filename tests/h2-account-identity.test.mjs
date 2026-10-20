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
let pass=0,fail=0,differentials=0;
async function t(name,fn){if(process.env.H2_CASE_FILTER&&!name.includes(process.env.H2_CASE_FILTER))return;try{await fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}}
async function response(accounts,source,answer=reply){return (await sync([bank(accounts)],answer,{recoverGaps:true,acks:{},accountPhases:1},Clock,null,source)).data.links;}
// R5: todos los campos, sin quitar fechas ni banderas para disimular diferencias.
// Cada escenario fallido tiene también su contraparte all-OK antes de probar H2.
function compare(s,links,expected){
 const baseline=old.applyBankBalances(plain(s),plain(links));
 const got=L.applyBankBalances(plain(s),plain(links));
 if(expected!=null)assert.equal(cents(baseline.state),expected,'actual base cents');
 console.log('ORACLE '+JSON.stringify({baseCents:cents(baseline.state),candidateCents:cents(got.state)}));
 assert.deepEqual(plain(got),plain(baseline),'complete real-base result: state, mapping, order, amounts, dates, changed, synced');
 assert.deepEqual(plain(L.applyBankBalances(plain(got.state),plain(links))),plain(old.applyBankBalances(plain(baseline.state),plain(links))),'complete replay');
 differentials++;return got.state;
}
const account=(uid,value=70,more={})=>({uid,ok:true,balanceOk:true,balanceAt:stamp,balances:[{amount:value,type:'ITAV'}],...more});
const direct=accounts=>[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts}];
for(const [mode,source] of modes){
 const cases=[
  ['R4 R1 total UID replacement',state([manual(50,{bankUid:'old-main'})]),['a','b'],10000],
  ['R4 R1 total UID replacement with omitted extra',state([manual(50,{bankUid:'old-main'})],[extra('old-extra',20)]),['a','b'],10000],
  ['R4 R2 one linked UID',state([manual(50,{bankUid:'a'}),manual(20,{id:'free'})]),['b','a','c'],10500],
  ['R4 R2 one linked IBAN',state([manual(50,{bankIban:'IBAN-A'}),manual(20,{id:'free'})]),[{uid:'b'},{uid:'a',iban:'IBAN-A'},{uid:'c'}],10500],
  ['R4 partial UID replacement',state([manual(50,{bankUid:'old-main',balanceAt:prior})],[extra('b',20)]),['a','b','c'],17000],
  ['R4 multiple old UID principals',state([manual(50,{bankUid:'old1'}),manual(30,{id:'second',bankUid:'old2'})]),['a','b'],10000],
  ['R3 new bank two accounts',state([manual(50)]),['a','b'],10000],
  ['R3 new bank three accounts',state([manual(50)]),['a','b','c'],17000],
  ['R3 exact IBAN priority',state([manual(50,{bankIban:'IBAN-B'})]),[{uid:'a',iban:'IBAN-A'},{uid:'b',iban:'IBAN-B'}],10000],
  ['R3 response order',state([manual(50)]),['b','a'],10000],
  ['B1 new connection',state([manual(50)]),['a'],7000],
  ['B1 manual order before later exact match',state([manual(50),manual(40,{id:'known',bankIban:'IBAN-B'})]),[{uid:'b',iban:'IBAN-B'},{uid:'a',iban:'IBAN-A'}],10000],
  ['B2 manual reconnect',state([manual(50,{bankUid:'old'})]),['a'],7000],
  ['B2 extra reconnect',state([],[extra('old',50)]),['a'],7000],
  ['B3 absent extra removed',state([],[extra('a',50),extra('b',30)]),['a'],7000]
 ];
 for(const [name,s,acs,expected] of cases)await t(`${mode}: ${name}`,async()=>{
  const answer=()=>({transactions:[]});answer.balance=p=>({balances:[{balance_type:'ITAV',balance_amount:{amount:p.includes('/b/')?'30':name.startsWith('R4 R2')&&p.includes('/c/')?'5':'70',currency:'EUR'}}]});
  compare(s,await response(acs.map(a=>typeof a==='string'?{uid:a}:a),source,answer),expected);
 });
}
const former=[
 ['R3 multiple unlinked principals',state([manual(50),manual(30,{id:'second'})]),direct([account('a'),account('b')])],
 ['R3 total replacements',state([manual(50,{bankUid:'old'})]),direct([account('a'),account('b')])],
 ['R3 one unlinked among principals',state([manual(50),manual(30,{id:'known',bankUid:'known'})]),direct([account('known'),account('a'),account('b')])],
 ['B1 failed principal reservation all-OK counterpart',state([manual(125,{bankUid:'a',balanceAt:prior}),manual(80,{id:'free'})]),direct([account('b',100),account('a',125)])],
 ['B3 failed extra and omitted sister all-OK counterpart',state([],[extra('a',125),extra('b',80),extra('gone',50)]),direct([account('a',125),account('b',100)])],
 ['distinct known IBAN base fallback',state([manual(50,{bankIban:'IBAN-OLD'})]),direct([account('new',70,{iban:'IBAN-NEW'})])],
 ['multiple old UID principals base order',state([manual(50,{bankUid:'old1'}),manual(30,{id:'second',bankUid:'old2'})]),direct([account('new1'),account('new2')])]
];
for(const [name,s,links] of former)await t(name,()=>compare(s,links));
// Los cuatro descuadres publicados y dos límites de la revisión (IBAN/principal caída
// y duplicados). Las imperfecciones de ff53 se documentan, no se corrigen aquí.
const review=[
 ['review two manuals two accounts',state([manual(50),manual(20,{id:'second'})]),[account('a',70),account('b',30)],10000],
 ['review two manuals one account',state([manual(50),manual(20,{id:'second'})]),[account('a',70)],9000],
 ['review partial UID replacement',state([manual(50,{bankUid:'old-main'})],[extra('b',20)]),[account('a',70),account('b',30),account('c',5)],10500],
 ['review UID to IBAN',state([manual(50,{bankUid:'old'})]),[account('a',70,{iban:'IBAN-A'}),account('b',30,{iban:'IBAN-B'})],10000],
 ['review earlier unlinked steals later linked account all-OK',state([manual(50),manual(20,{id:'linked',bankIban:'IBAN-A'})]),[account('a',70,{iban:'IBAN-A'}),account('b',30,{iban:'IBAN-B'})],10000],
 ['review duplicated returned identity base imperfection',state([],[extra('a',50)]),[account('a',70),account('a',70)],14000]
];
for(const [name,s,acs,expected] of review)await t(name,async()=>{
 for(const [mode,source] of modes){
  const answer=()=>({transactions:[]});answer.balance=p=>({balances:[{balance_type:'ITAV',balance_amount:{amount:p.includes('/b/')?'30':p.includes('/c/')?'5':'70',currency:'EUR'}}]});
  compare(s,await response(acs.map(({uid,iban})=>({uid,...(iban?{iban}:{})})),source,answer),expected);
 }
});
for(const phases of [false,true])await t(`UID-less metadata does not block complete cursor (phases=${phases})`,async()=>{
 const b=bank([{uid:'a'},{iban:'metadata only'}]);
 const r=await sync([b],reply,{recoverGaps:true,acks:{},...(phases?{accountPhases:1}:{})},Clock);
 compare(state([manual(50)]),r.data.links,7000);assert.equal(r.data.links[0].accounts.length,1);assert.ok(r.data.links[0].ack);assert.equal(r.calls.length,2);
 const accepted=await sync([b],reply,{recoverGaps:true,acks:{CaixaBank:r.data.links[0].ack},...(phases?{accountPhases:1}:{})},Clock);
 assert.equal(b.last_sync,stamp);assert.ok(accepted.writes.some(w=>w.last_sync===stamp));
});
await t('balance failure is logged with closed code even when transactions are complete',async()=>{
 compare(state([],[extra('a',50)]),await response([{uid:'a'}]),7000);
 const answer=()=>({transactions:[]});answer.balanceError='EB 503: PRIVATE_SYNTHETIC_ERROR';
 const r=await sync([bank([{uid:'a'}])],answer,{recoverGaps:true,acks:{},accountPhases:1},Clock);
 const detail=JSON.parse(r.events.find(e=>e.message.startsWith('OB sync')).detail);
 assert.equal(detail.pages,1);assert.equal(detail.status,'empty');assert.deepEqual(detail.reasons,[]);
 assert.ok(r.events.some(e=>{try{return JSON.parse(e.detail).failureCodes?.includes('eb_503');}catch{return false;}}));
 assert.equal(JSON.stringify(r.events).includes('PRIVATE_SYNTHETIC_ERROR'),false);assert.ok(r.data.links[0].ack);
});
await t('legacy balance failure keeps its original zero transaction requests and no cursor',async()=>{
 compare(state([manual(50)]),await response([{uid:'a'}],baseServer),7000);
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
 compare(state([manual(50)]),direct([account('a',70)]),7000);
 const events=[];new Function('links','cloud','pickBankBalance',telemetry)([{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[a]}],{logEvent:(...args)=>events.push(args)},L.pickBankBalance);
 assert.equal(events.length,kind==='malformed-success'?1:0);
});
console.log(JSON.stringify({baseSHA,passed:pass,failed:fail,differentials}));process.exitCode=fail?1:0;
