import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {transformSync} from 'esbuild';
import {environment,section,plain,now,owner,uuid,cents} from './helpers/fin19-r4-fixture.mjs';
const html=fs.readFileSync(process.env.FIN19_R4_HTML||new URL('../public/index.html',import.meta.url),'utf8');
const source=fs.readFileSync(process.env.FIN19_R4_SERVER||new URL('../supabase/functions/_shared/presupuesto.ts',import.meta.url),'utf8');
function server(text){const mod={exports:{}};new Function('module','exports',transformSync(text,{loader:'ts',format:'cjs'}).code)(mod,mod.exports);return mod.exports;}
const srv=server(source);
async function importDeleted(env,legacy){
 const trace=[],realImport=env.c.importObExpenses;
 env.c.importObExpenses=(...args)=>{const result=realImport(...args);trace.push({transactions:plain(args[1]),before:plain(args[0].expenses),result:plain(result),after:plain(result||args[0].expenses)});return result;};
 env.cloud.bankLinks=async()=>[];
 env.cloud.bankSync=async()=>({links:[{aspsp:'Banco Sabadell',ok:true,syncFrom:'2026-01-01',accounts:[{uid:legacy?null:'account-a',ok:true,transactions:[{ext_id:'ref-a',date:'2026-10-19',amount:3.2,merchant:'BAR SL',status:'BOOK'}]}]}]});
 const factory=vm.runInContext('(function(stateRef,set,cloud,setTimeout){const sessionRef={current:{user:{id:"'+owner+'"}}},bankSyncing={current:false},pullOkRef={current:Promise.resolve(true)},obAckPend={current:null},SYNC_SIN_NUBE={},showToast=function(){},avisaSync=function(){},setTab=function(){};const syncCloudExpenses=function(){throw Error("unexpected implicit pull");};'+section(html,'  const runBankSync=function(opts){','  /* EL ACUSE SE GUARDA DETRÁS')+'return runBankSync;})',env.c);
 const sync=factory(env.stateRef,env.set,env.cloud,(fn,ms)=>{env.timers.push({fn,ms});return env.timers.length;});
 await sync({manual:false});await env.flush();
 assert.equal(trace.length,1,'actual runBankSync executes import');
 assert.equal(env.stateRef.current.lastBankSync,now);
 assert.equal(trace[0].transactions.length,1);
 assert.equal(trace[0].transactions[0].merchant,'BAR SL');
 return trace;
}
async function scenario({sameBank=false,ordinal=1,manual=false,legacy=false,collision=false}={},reader=srv){
 const a={id:uuid(1),user_id:owner,fecha:'2026-10-19T10:00:00.00'+(ordinal-1)+'Z',importe:3.2,comercio:'BAR SL',cat:'otros',source:'ob:sabadell#refref-a'+(legacy?'':'#accaccount-a')+(ordinal>1?'#n'+ordinal:'')};
 const b={...a,id:uuid(2),comercio:collision?'Mi bar':'Otra compra',source:'ob:'+(sameBank?'sabadell':'caixabank')+'#refref-c#accaccount-c'+(ordinal>1?'#n'+ordinal:'')};
 const rows=[a,b];if(manual)rows.push({...a,id:uuid(3),comercio:'Mi bar',source:'manual:sabadell'});
 const env=environment(html,rows,{deleteFails:true});await env.rename(uuid(1),'Mi bar');
 const renamed=plain(env.stateRef.current.expenses.find(e=>e.id===uuid(1)));
 assert.equal(renamed.merchant,'Mi bar');assert.equal(renamed.obName,'BAR SL');
 assert.equal(env.remote[0].comercio,'Mi bar');assert.equal(env.remote[0].ob_name,'BAR SL');
 const beforeDelete=plain(env.remote),controls=env.controls();controls.del(env.stateRef.current.expenses.find(e=>e.id===uuid(1)));await env.flush();
 const widget=()=>{const s=env.stateRef.current,live=reader.filasComoLaApp(env.remote,s.deleted,s.obAbsorbedPending,owner,s.obAbsorbedConfirmed);return {rows:plain(live),cents:Math.round(reader.statsDelMes(live,s,Date.parse('2026-10-01')).spent*100)};};
 env.persist();const importTrace=await importDeleted(env,legacy);env.persist();await env.pull();await env.pull();
 const after=plain(env.stateRef.current.expenses),r={sameBank,ordinal,manual,legacy,collision,renamed,beforeDelete,after,importTrace,deleted:plain(env.stateRef.current.deleted),widget:widget(),remote:plain(env.remote),writes:plain(env.writes),uploads:plain(env.uploads),deleteCalls:env.deletes};
 r.perBank=Object.fromEntries(['sabadell','caixabank'].map(bank=>[bank,Math.round(env.c.monthBudgetStats({...env.stateRef.current,settings:{expenseBanks:[bank]}},now).spent*100)]));
 env.deleteFails=false;await env.cloud.deleteExpense(renamed);await env.pull();r.retry={rows:plain(env.stateRef.current.expenses),widget:widget()};
 controls.undo();await env.flush();env.persist();await env.pull();r.undo={rows:plain(env.stateRef.current.expenses),widget:widget()};
 return r;
}
const cases=[];
if(process.env.FIN19_R4_BASE_CONTROL)cases.push(await scenario());
else{
 for(const sameBank of [false,true])for(const ordinal of [1,2])cases.push(await scenario({sameBank,ordinal}));
 cases.push(await scenario({manual:true}));cases.push(await scenario({legacy:true}));
 cases.push(await scenario({collision:true}));cases.push(await scenario({collision:true,sameBank:true}));
}
if(process.env.FIN19_R4_EVIDENCE)fs.writeFileSync(process.env.FIN19_R4_EVIDENCE,JSON.stringify({variant:process.env.FIN19_R4_LABEL||'current',cases},null,2)+'\n',{flag:'wx'});
test('FIN19 R4 actual rename writer/delete/failed DELETE/persistence/full pull/widget',()=>{
 for(const r of cases){
  const expected=r.manual?640:320;assert.equal(r.deleteCalls,1);assert.equal(r.remote.length,r.manual?3:2);
  assert.equal(cents(r.after),expected);assert.equal(r.widget.cents,expected,JSON.stringify({sameBank:r.sameBank,ordinal:r.ordinal,manual:r.manual,legacy:r.legacy}));
  assert.deepEqual(r.widget.rows,r.remote.filter(e=>e.id!==uuid(1)),'full server survivor rows');
  assert.deepEqual(r.after.map(e=>e.id).sort(),r.beforeDelete.filter(e=>e.id!==uuid(1)).map(e=>e.id).sort());
  assert.deepEqual(r.perBank,{sabadell:(r.sameBank?320:0)+(r.manual?320:0),caixabank:r.sameBank?0:320});
  assert.equal(r.uploads.length,0,'full pull never reuploads deleted row');
  assert.deepEqual(r.importTrace[0].after,r.importTrace[0].before,'import retains complete surviving rows');
  assert.equal(r.retry.widget.cents,expected);assert.deepEqual(r.retry.rows,r.after);
  assert.equal(cents(r.undo.rows),expected+320);assert.equal(r.undo.widget.cents,expected+320);
  const restored=r.undo.rows.find(e=>e.id===uuid(1));assert.equal(restored.merchant,'Mi bar');assert.equal(restored.obName,'BAR SL');
 }
});
if(!process.env.FIN19_R4_BASE_CONTROL&&!process.env.FIN19_R4_CAUSAL_CONTROL)test('FIN19 R4 bank-name-only lookup mutant restores640 after actual rename/delete',async()=>{
 const needle='const key = k;';assert.ok(source.includes(needle),'mutation anchor');
 const mutant=server(source.replace(needle,'const key = f.ob_name == null ? k : claveComoLaApp({ ...f, comercio: f.ob_name });'));
 const result=await scenario({},mutant);assert.equal(result.widget.cents,640);assert.equal(cents(result.after),320);
});
