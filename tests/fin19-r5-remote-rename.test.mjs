import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {transformSync} from 'esbuild';
import {environment,section,plain,now,owner,uuid,cents} from './helpers/fin19-r4-fixture.mjs';
const html=fs.readFileSync(process.env.FIN19_R5_HTML||new URL('../public/index.html',import.meta.url),'utf8');
const source=fs.readFileSync(process.env.FIN19_R5_SERVER||new URL('../supabase/functions/_shared/presupuesto.ts',import.meta.url),'utf8');
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
 const a={id:uuid(1),user_id:owner,fecha:'2026-10-19T10:00:00.00'+(ordinal-1)+'Z',importe:3.2,comercio:'BAR SL',ob_name:'BAR SL',cat:'otros',source:'ob:sabadell#refref-a'+(legacy?'':'#accaccount-a')+(ordinal>1?'#n'+ordinal:'')};
 const b={...a,id:uuid(2),comercio:collision?'BAR SL':'Otra compra',ob_name:collision?'BAR SL':'Otra compra',source:'ob:'+(sameBank?'sabadell':'caixabank')+'#refref-c#accaccount-c'+(ordinal>1?'#n'+ordinal:'')};
 const rows=[a,b];if(manual)rows.push({...a,id:uuid(3),source:'manual:sabadell'});
 const env=environment(html,rows,{deleteFails:true}),other=environment(html,[a]);
 await other.rename(uuid(1),'Mi bar');env.remote[0]=plain(other.remote[0]);
 const old=plain(env.stateRef.current.expenses[0]);assert.equal(old.merchant,'BAR SL');assert.equal(env.remote[0].comercio,'Mi bar');assert.equal(env.remote[0].ob_name,'BAR SL');
 const controls=env.controls();controls.del(env.stateRef.current.expenses[0]);await env.flush();env.persist();
 const widget=()=>{const s=env.stateRef.current,live=reader.filasComoLaApp(env.remote,s.deleted,s.obAbsorbedPending,owner,s.obAbsorbedConfirmed);return {rows:plain(live),cents:Math.round(reader.statsDelMes(live,s,Date.parse('2026-10-01')).spent*100)};};
 const first=widget();await importDeleted(env,legacy);env.persist();await env.pull();env.persist();await env.pull();
 const after=plain(env.stateRef.current.expenses),result={sameBank,ordinal,manual,legacy,collision,old,remote:plain(env.remote),after,first,widget:widget(),deleted:plain(env.stateRef.current.deleted),uploads:plain(env.uploads),deleteCalls:env.deletes};
 result.perBank=Object.fromEntries(['sabadell','caixabank'].map(bank=>[bank,Math.round(env.c.monthBudgetStats({...env.stateRef.current,settings:{expenseBanks:[bank]}},now).spent*100)]));
 controls.undo();await env.flush();env.persist();await env.pull();result.undo={rows:plain(env.stateRef.current.expenses),widget:widget()};
 return result;
}
const cases=[];
for(const sameBank of [false,true])for(const ordinal of [1,2])cases.push(await scenario({sameBank,ordinal}));
for(const opts of [{manual:true},{legacy:true},{collision:true},{collision:true,sameBank:true}])cases.push(await scenario(opts));
if(process.env.FIN19_R5_EVIDENCE)fs.writeFileSync(process.env.FIN19_R5_EVIDENCE,JSON.stringify({cases},null,2)+'\n',{flag:'wx'});
test('FIN19 R5 lector widget con lápida de cuenta conserva la superviviente completa tras renombrado remoto',()=>{
 for(const r of cases.filter(r=>!r.legacy)){
  const expected=r.manual?640:320;
  assert.equal(r.first.cents,expected);
  assert.equal(r.widget.cents,expected);
  assert.deepEqual(r.widget.rows,r.remote.filter(e=>e.id!==uuid(1)));
  assert.equal(r.undo.widget.cents,expected+320);
 }
});
test('FIN19 R5 mutante sin clave original devuelve 640 al widget',async()=>{
 const needle='const original = f.ob_name == null ? key : claveComoLaApp({ ...f, comercio: f.ob_name });';
 assert.ok(source.includes(needle));
 const result=await scenario({},server(source.replace(needle,'const original = key;')));
 assert.equal(result.first.cents,640);
 assert.equal(result.widget.cents,640);
});
test('FIN19 R5 otro móvil renombra, cliente antiguo borra, DELETE falla, persistir/pull/repetir/deshacer',()=>{
 for(const r of cases){
  const expected=r.manual?640:320;
  assert.equal(r.deleteCalls,1);assert.equal(cents(r.after),expected);
  assert.equal(r.first.cents,expected,JSON.stringify({sameBank:r.sameBank,ordinal:r.ordinal,legacy:r.legacy}));
  assert.equal(r.widget.cents,expected);assert.deepEqual(r.widget.rows,r.remote.filter(e=>e.id!==uuid(1)));
  assert.deepEqual(r.after.map(e=>e.id).sort(),r.remote.filter(e=>e.id!==uuid(1)).map(e=>e.id).sort());
  assert.deepEqual(r.perBank,{sabadell:(r.sameBank?320:0)+(r.manual?320:0),caixabank:r.sameBank?0:320});
  assert.equal(r.uploads.length,0);assert.equal(cents(r.undo.rows),expected+320);assert.equal(r.undo.widget.cents,expected+320);
 }
});
