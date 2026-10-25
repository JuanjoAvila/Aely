import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {createLogicSandbox} from '../scripts/load-pure-logic.mjs';
const source=fs.readFileSync('src/modules/09-tab-debts-goals.js','utf8');
const order=JSON.parse(fs.readFileSync('src/build-order.json','utf8'));
const all=order.map(f=>fs.readFileSync('src/modules/'+f,'utf8')).join('\n');
const pure=all.slice(0,all.search(/\nclass ErrorBoundary\b/));
const inMonths=source.match(/const inMonths=(function\(k\)\{[\s\S]*?\};)/)[1].slice(0,-1);
const endsLabel=source.match(/const endsLabel=(function\(d\)\{[\s\S]*?\n  \};)/)[1].slice(0,-1);
const cases=[
 {zone:'America/Los_Angeles',at:'2026-10-31T23:30:00Z',month:10,localMonth:9},
 {zone:'Asia/Tokyo',at:'2026-10-31T16:30:00Z',month:9,localMonth:10}
];
const months={es:['octubre','noviembre','mayo','junio'],en:['October','November','May','June'],ca:['octubre','novembre','maig','juny']};
for(const row of cases)for(const route of ['lista','asesor'])for(const lang of ['es','en','ca'])test(row.zone+' '+route+' '+lang,()=>{
 const previous=process.env.TZ;process.env.TZ=row.zone;
 try{
  const epoch=Date.parse(row.at);class Clock extends Date{constructor(...a){super(...(a.length?a:[epoch]));}static now(){return epoch;}}
  assert.equal(new Clock().getMonth(),row.localMonth,'La zona debe estar al otro lado de la frontera');
  const c=createLogicSandbox({Date:Clock,leftInfo:d=>d.info});vm.createContext(c);vm.runInContext(pure,c);
  vm.runInContext('CURLANG='+JSON.stringify(lang)+';globalThis.subject='+ (route==='lista'?endsLabel:inMonths),c);
  // Calendario esperado explícito: Madrid es noviembre en LA y octubre en Tokio; +12 y +7 cruzan año.
  const expected=months[lang][row.month===10?1:0]+' 2027';
  if(route==='lista'){
   const prefix={es:'acabas en ',en:'done by ',ca:'acabes el '}[lang];
   assert.equal(c.subject({info:{n:12}}),prefix+expected);
   assert.equal(c.subject({info:null}),null);
  }else{
   assert.equal(c.subject(12),expected);
   assert.equal(c.subject(7),months[lang][row.month===10?3:2]+' 2027');
   assert.equal(c.subject(0),months[lang][row.month===10?1:0]+' 2026');
  }
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
