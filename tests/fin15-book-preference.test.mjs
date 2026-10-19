import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {transformSync} from 'esbuild';
import {loadPureLogic} from '../scripts/load-pure-logic.mjs';

const base='ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const old=p=>execFileSync('git',['show',base+':'+p],{cwd:root,encoding:'utf8',maxBuffer:8e6});
export function server(source){const m={exports:{}};new Function('module','exports',transformSync(source,{loader:'ts',format:'cjs'}).code)(m,m.exports);return m.exports;}
export const current={client:loadPureLogic(read('public/index.html')),server:server(read('supabase/functions/_shared/presupuesto.ts'))};
const prior={client:loadPureLogic(old('public/index.html')),server:server(old('supabase/functions/_shared/presupuesto.ts'))};
const plain=x=>JSON.parse(JSON.stringify(x));
export const row=(id,pending=false,extra={})=>({id,fecha:'2026-10-06T10:00:00Z',importe:3.2,comercio:'Compra sintetica D',cat:'otros',source:'ob:caixabank#refsame'+(pending?'#pdng':'')+'#accA',...extra});
const p=row('pending',true),b=row('booked');
const orders=xs=>[xs,[...xs].reverse()];
const cent=xs=>xs.reduce((n,x)=>n+Math.round(Number(x.importe??x.amount)*100),0);
function outcome(api,kind,prev,inc,deleted=[]){
 if(kind==='server')return api.server.filasComoLaApp(inc,deleted);
 const c=api.client,map=Object.fromEntries(deleted.map(k=>[k,1]));
 const a=prev.map(c.expenseFromRow),z=inc.map(c.expenseFromRow);
 return kind==='mergeExpenses'?c[kind](a,z,map).list:c[kind](a,z,0,map).list;
}
export function positive(api){
 for(const rows of orders([p,b]))for(const kind of ['mergeExpenses','mergeExpensesFromCloud','server']){
  const out=outcome(api,kind,[],rows);assert.equal(out.length,1);assert.equal(cent(out),320);
  assert.equal(kind==='server'?/#pdng(?:#|$)/.test(out[0].source):!!out[0].obPending,false,kind+' BOOK must win');
 }
 for(const [local,incoming] of [[p,b],[b,p]])for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){
  const out=outcome(api,kind,[local],[incoming]);assert.equal(out[0].id,local.id);assert.equal(cent(out),320);assert.equal(!!out[0].obPending,false,kind+' retains BOOK status');
 }
}
export function boundaries(api){
 const variants=[
  ['different ref',{source:'ob:caixabank#refother#accA'}],
  ['FIN03 parked other bank',{source:'ob:sabadell#refsame#accA'}],
  ['account',{source:'ob:caixabank#refsame#accB'}],
  ['one account missing',{source:'ob:caixabank#refsame'}],
  ['day',{fecha:'2026-10-07T10:00:00Z'}],
  ['ordinal',{source:'ob:caixabank#refsame#accA#n2'}],
  ['amount outside scope',{importe:3.21}],['merchant',{comercio:'Otro comercio'}],
  ['category',{cat:'viajes'}],['receipt',{source:'ob:caixabank~recibo.r#refsame#accA'}],
  ['debt',{source:'ob:caixabank~deuda.d#refsame#accA'}],['duplicate',{source:'ob:caixabank#dup#refsame#accA'}],
  ['previous ref',{source:'ob:caixabank#refsame#prevrefold#accA'}],
 ];
 for(const [name,extra] of variants)for(const rows of orders([p,{...b,...extra}]))for(const kind of ['mergeExpenses','mergeExpensesFromCloud','server']){
  // FIN19 resuelve los dos límites cliente antes aparcados: dos operaciones, 640 céntimos.
  // El lector servidor conserva su contrato hasta una tanda propia; las demás fronteras no cambian.
  if(kind!=='server'&&(name==='FIN03 parked other bank'||name==='account')){
   const out=outcome(api,kind,[],rows);assert.equal(cent(out),640);assert.deepEqual(plain(out),plain(rows.map(api.client.expenseFromRow)),kind+' FIN19 '+name);
  }else assert.deepEqual(plain(outcome(api,kind,[],rows)),plain(outcome(prior,kind,[],rows)),kind+' unchanged '+name);
 }
 for(const source of ['ob:caixabank','ob:caixabank#ref','ob:#refsame','manual:caixabank#refsame','ob:caixabank#ref%bad']){
  const rows=[{...p,source:source+'#pdng'},{...b,source}];
  for(const kind of ['mergeExpenses','mergeExpensesFromCloud','server'])assert.deepEqual(plain(outcome(api,kind,[],rows)),plain(outcome(prior,kind,[],rows)),kind+' needs bank and decoded ref '+source);
 }
}
export function exclusions(api){
 const c=api.client,dead={...b,source:b.source+'#n2'},lap=['ob-absorbed2|caixabank|same|2|A|2026-10-06'];
 for(const rows of orders([dead,p])){
  assert.deepEqual(plain(api.server.filasComoLaApp(rows,lap)),[p]);
  const map=Object.fromEntries(lap.map(k=>[k,1])),live=rows.map(c.expenseFromRow).filter(e=>!c.expenseIsTombstoned(e,map));
  for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){const out=kind==='mergeExpenses'?c[kind]([],live,map).list:c[kind]([],live,0,map).list;assert.equal(out[0].id,p.id);assert.equal(out[0].obPending,true);assert.equal(cent(out),320);}
 }
 // A deleted BOOK of identical identity must not lend its status, even if still local.
 for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){
  const map={[c.keyOfExpense(c.expenseFromRow(b))]:1},out=kind==='mergeExpenses'?c[kind]([], [c.expenseFromRow(p),c.expenseFromRow(b)],map).list:c[kind]([], [c.expenseFromRow(p),c.expenseFromRow(b)],0,map).list;
  assert.equal(out[0].obPending,true,'excluded evidence cannot promote PDNG');
 }
}
if(!process.env.FIN15_MUTATION_IMPORT){
 test('Night D remates: no pending avoids keys; only candidate bank/ref is inspected',()=>{
  const c=current.client,original=c.obBookedPreferenceKey;
  const rows=Array.from({length:20000},(_,i)=>c.expenseFromRow(row('b'+i,false,{source:'ob:caixabank#ref'+i+'#accA'})));
  let calls=0;c.obBookedPreferenceKey=e=>{calls++;return original(e);};
  try{
   assert.equal(c.preferBookedExpenses(rows),rows);assert.equal(calls,0,'no pending must not calculate full keys');
   const pending={...rows[123],id:'pending',obPending:true};calls=0;
   const out=c.preferBookedExpenses([...rows,pending]);
   assert.equal(calls,2,'only pending and matching bank/ref BOOK need complete keys');
   assert.equal(out.at(-1).id,pending.id);assert.equal(!!out.at(-1).obPending,false);
   assert.equal(cent(out),cent([...rows,pending]));assert.equal(pending.obPending,true);
  }finally{c.obBookedPreferenceKey=original;}
 });
 test('Night D remates: raw legacy category and offset dates retain documented state boundaries',()=>{
  const cases=[['null category',{cat:null}],['legacy category',{cat:'legacy-unknown'}],['offset date',{fecha:'2026-10-07T00:30:00+02:00'}]];
  for(const [name,extra] of cases)for(const rows of orders([{...p,...extra},b])){
   const firstPending=rows[0].id===p.id;
   for(const kind of ['mergeExpenses','mergeExpensesFromCloud','server']){
    const out=outcome(current,kind,[],rows);assert.equal(out.length,1);assert.equal(cent(out),320);
    const pending=kind==='server'?/#pdng(?:#|$)/.test(out[0].source):!!out[0].obPending;
    assert.equal(pending,kind==='server'&&firstPending,name+' '+kind+' stored-state boundary');
   }
  }
 });
 test('Night D: five RED causes green in both orders and existing-local directions',()=>positive(current));
 test('Night D: identity boundaries unchanged, including FIN03 and different amounts',()=>boundaries(current));
 test('Night D: FIN10 exclusions precede preference and preserve survivor',()=>exclusions(current));
 test('Night D: local decisions, id and inputs survive, next pull is stable',()=>{
  const c=current.client,loc=c.expenseFromRow({...p,nota:'decision local',nota_edit:true,no_card:true}),inc=c.expenseFromRow({...b,nota:'nota banco',no_card:true});
  const before=plain([loc,inc]);
  for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){
   const out=c[kind]([loc],[inc]).list[0];assert.equal(out.id,loc.id);assert.equal(out.note,'decision local');assert.equal(out.noteEdited,true);assert.equal(out.noCard,true);assert.equal(out.category,loc.category);assert.equal(!!out.obPending,false);
  }
  assert.deepEqual(plain([loc,inc]),before);
  const ready=c.mergeExpensesFromCloud([loc],[inc]);const again=c.mergeExpensesFromCloud(ready.list,[inc]);assert.equal(again.changed,false);assert.equal(again.list[0],ready.list[0]);
 });
 test('Night D: both legacy accounts absent match but one missing does not bridge',()=>{
  const rows=[{...p,source:'ob:caixabank#refsame#pdng'},{...b,source:'ob:caixabank#refsame'}];
  for(const kind of ['mergeExpenses','mergeExpensesFromCloud','server']){const out=outcome(current,kind,[],rows);assert.equal(kind==='server'?/#pdng(?:#|$)/.test(out[0].source):!!out[0].obPending,false);assert.equal(cent(out),320);}
 });
 test('Night D: semantic mutations reject unproven identity and partial rollout',()=>{
  const html=read('public/index.html'),ts=read('supabase/functions/_shared/presupuesto.ts').replaceAll('\r\n','\n');
  function replaceFunction(source,start,end,body){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,'mutation anchor');return source.slice(0,a)+body+'\n'+source.slice(b);}
  const clientMutant=expression=>loadPureLogic(replaceFunction(html,'function obBookedPreferenceKey(e){','function preferBookedExpenses(', 'function obBookedPreferenceKey(e){return '+expression+';}'));
  const serverMutant=expression=>server(replaceFunction(ts,'function clavePreferenciaBook(f: FilaGasto): string {','/**\n * Lo que la app ve', 'function clavePreferenciaBook(f: FilaGasto): string {return '+expression+';}'));
  const mutants=[
   ['client without identity',{...current,client:clientMutant('JSON.stringify([e.amount,e.merchant])')},boundaries],
   ['server without identity',{...current,server:serverMutant('JSON.stringify([f.importe,f.comercio])')},boundaries],
   ['client ref alone',{...current,client:clientMutant('e.extId||""')},boundaries],
   ['server ref alone',{...current,server:serverMutant('referenciaOb(f)')},boundaries],
   ['only client',{...current,server:prior.server},positive],
   ['only server',{...current,client:prior.client},positive],
  ];
  for(const [name,api,contract] of mutants){let killed=false;try{contract(api);}catch(e){if(!(e instanceof assert.AssertionError))throw e;killed=true;}assert.ok(killed,name+' survived');console.log('KILLED '+name);}
 });
 test('Night D: two BOOK representations retain the first BOOK tie and cents',()=>{
  const later={...b,id:'later-book'};
  for(const rows of [[p,b,later],[b,p,later],[later,p,b]]){
   const result=current.server.filasComoLaApp(rows,[]);assert.equal(result.length,1);assert.equal(cent(result),320);
   assert.equal(result[0].id,rows.find(r=>!r.source.includes('#pdng')).id);
  }
 });
}
