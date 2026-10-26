import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {transformSync} from 'esbuild';
import {loadPureLogic} from '../scripts/load-pure-logic.mjs';

const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const html=fs.readFileSync(process.env.FIN19_R3_HTML||new URL('public/index.html',root),'utf8');
const serverSource=fs.readFileSync(process.env.FIN19_R3_SERVER||new URL('supabase/functions/_shared/presupuesto.ts',root),'utf8');
const module={exports:{}};new Function('module','exports',transformSync(serverSource,{loader:'ts',format:'cjs'}).code)(module,module.exports);
const srv=module.exports,plain=x=>JSON.parse(JSON.stringify(x)),cents=rows=>rows.reduce((n,e)=>n+Math.round(Number(e.amount??e.importe)*100),0);
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),date='2026-10-19T10:00:00.000Z',now=Date.parse('2026-10-20T12:00:00.000Z');
const row=(n,extra={})=>({id:uuid(n),date,amount:3.2,merchant:'Compra sintetica R3',obName:'Compra sintetica R3',category:'otros',source:'ob',ent:'sabadell',obAcc:'account-a',...extra});
const seed=rows=>({_historyOwner:'synthetic-owner',expenses:plain(rows),accounts:[],settings:{expenseBanks:['trade_republic','sabadell','caixabank']},fixed:[],debts:[],oneoffs:[],flows:[],goals:[],investments:[],assets:[],bankTx:[],gemelos:[],deleted:[],deletedAt:{},budget:1000});
const permutations=rows=>rows.length===1?[rows]:rows.flatMap((e,i)=>permutations(rows.filter((_,j)=>i!==j)).map(rest=>[e,...rest]));
function slice(start,end,source=html){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,'real callback anchors');return source.slice(a,b);}
function environment(rows,{deleteFails=false,source=html,server=srv}={}){
 const c=loadPureLogic(source),disk=new Map(),timers=[],uploads=[],events=[],trace={imports:[],uploads:[],bankCalls:0,deletes:0};
 const storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,String(v)),removeItem:k=>disk.delete(k)};
 c.localStorage=storage;c.window.localStorage=storage;
 const RealDate=Date;c.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 let id=100; c.mcExpenseId=()=>uuid(id++);
 const cloud=vm.runInContext('cloud',c),env={c,disk,timers,uploads,events,trace,state:seed(rows),remote:[],links:[]};
 const wire=e=>({id:e.id,user_id:'synthetic-owner',fecha:e.date,importe:e.amount,comercio:e.merchant,ob_name:e.obName,cat:e.category,source:c.expenseSourceForCloud(e),nota:e.note,nota_edit:e.noteEdited,no_card:e.noCard});
 env.wire=wire;env.remote=rows.map(wire);
 cloud.enabled=()=>true;cloud.logEvent=(...args)=>{events.push(args);return Promise.resolve();};
 cloud.addExpense=async e=>{uploads.push(plain(e));const r=wire(e),i=env.remote.findIndex(x=>x.id===r.id);if(i<0)env.remote.push(r);else env.remote[i]=r;return true;};
 cloud.deleteExpense=async e=>{trace.deletes++;if(deleteFails)throw Error('synthetic-delete-failed');env.remote=env.remote.filter(x=>x.id!==e.id);};
 cloud.bankLinks=async()=>[];cloud.bankSync=async()=>{trace.bankCalls++;return {links:env.links};};
 const realImport=c.importObExpenses;c.importObExpenses=function(...args){const out=realImport(...args);trace.imports.push({txs:plain(args[1]),before:plain(args[0].expenses),after:plain(out||[])});return out;};
 const realUpload=c.subirGasto;c.subirGasto=function(e,where){trace.uploads.push({row:plain(e),where});return realUpload(e,where);};
 const set=fn=>{env.state=fn(env.state);env.ref.current=env.state;},timer=(fn,ms)=>{timers.push({fn,ms});return timers.length;};
 env.ref={current:env.state};
 const delFactory=vm.runInContext('(function(state,set,cloud,setTimeout){const keyOfE=keyOfExpense,undoTimerRef={current:null},undoDeleteRef={current:null},clearTimeout=function(){},setUndoDelete=function(){};'+slice('  const delExpense=function(e){','  /* Posible repetido OB')+'return {del:delExpense,undo:undoLastDelete};})',c);
 env.deleteControl=delFactory(env.state,set,cloud,timer);
 const syncFactory=vm.runInContext('(function(stateRef,set,cloud,setTimeout){const sessionRef={current:{user:{id:"synthetic-owner"}}},bankSyncing={current:false},pullOkRef={current:Promise.resolve(true)},obAckPend={current:null},SYNC_SIN_NUBE={},showToast=function(){},avisaSync=function(){},setTab=function(){};const syncCloudExpenses=function(){throw Error("unexpected cloud pull");};'+slice('  const runBankSync=function(opts){','  /* EL ACUSE SE GUARDA DETRÁS')+'return runBankSync;})',c);
 env.syncCallback=syncFactory(env.ref,set,cloud,timer);
 env.flush=async()=>{for(let i=0;i<6;i++){const pending=timers.filter(t=>t.ms===0&&!t.ran);pending.forEach(t=>{t.ran=true;t.fn();});await Promise.resolve();}await new Promise(resolve=>setImmediate(resolve));};
 env.sync=async()=>{const before=trace.imports.length;await env.syncCallback({manual:false});await env.flush();assert.equal(trace.imports.length,before+1,'actual runBankSync completed import');assert.equal(env.state.lastBankSync,now);};
 env.persist=()=>{c.mcSaveRaw('synthetic-r3',env.state);env.state=c.mcLoadRaw('synthetic-r3');env.ref.current=env.state;assert.ok(disk.has('synthetic-r3_exp'));};
 env.pull=()=>{const del=c.expenseDeletedSet(env.state),inc=c.expensesFromRows(env.remote,'synthetic-owner').filter(e=>!c.expenseIsTombstoned(e,del)),kept=c.keepCategoryChoices(env.state.expenses,inc,now);env.state={...env.state,expenses:c.mergeExpensesFromCloud(kept.prev,kept.incoming,now,del).list};env.ref.current=env.state;};
 env.visible=()=>env.state.expenses.filter(e=>!c.expenseIsTombstoned(e,c.expenseDeletedSet(env.state)));
 env.widget=()=>{const live=server.filasComoLaApp(env.remote,env.state.deleted,env.state.obAbsorbedPending,env.state._historyOwner,env.state.obAbsorbedConfirmed);return {rows:plain(live),cents:Math.round(server.statsDelMes(live,env.state,Date.parse('2026-10-01')).spent*100)};};
 return env;
}
function links(accounts){return [{aspsp:'Trade Republic',ok:true,syncFrom:'2026-01-01',accounts:accounts.map(([acc,count])=>({uid:acc,ok:true,transactions:Array.from({length:count},()=>({ext_id:null,date:'2026-10-19',amount:12,merchant:'Movimiento',status:'BOOK'}))}))}];}
async function noReferenceCase({ordinal=1,mode='normal',otherAccount=false,source=html}={}){
 const a=row(1,{ent:'trade_republic',obAcc:'account-a',amount:12,merchant:'Movimiento',obName:'Movimiento',date:new Date(Date.parse(date)+ordinal-1).toISOString(),...(ordinal>1?{obOrd:ordinal}:{})});
 const before=ordinal>1?[row(2,{...a,id:uuid(2),obOrd:1,date}),a]:[a];
 if(otherAccount)before.push({...a,id:uuid(3),obAcc:'account-b',obOrd:1,date});
 const env=environment(before,{source});env.links=links([['account-a',ordinal],...(otherAccount?[['account-b',1]]:[])]);
 env.deleteControl.del(env.state.expenses.find(e=>e.id===a.id));await env.flush();
 if(mode==='legacy'){env.state={...env.state,deleted:[env.c.keyOfExpense(a)],deletedAt:{},gemelos:[]};env.ref.current=env.state;}
 if(mode==='linkOnly'){env.state={...env.state,deleted:[],deletedAt:{}};env.ref.current=env.state;}
 if(mode==='scopedOnly'){env.state={...env.state,gemelos:[]};env.ref.current=env.state;}
 env.persist();await env.sync();env.persist();env.pull();await env.sync();env.pull();
 const result={ordinal,mode,otherAccount,before:plain(before),after:plain(env.visible()),widget:env.widget(),uploads:plain(env.uploads),trace:plain(env.trace),stateDeleted:plain(env.state.deleted),gemelos:plain(env.state.gemelos)};
 if(mode==='normal'){env.deleteControl.undo();await env.flush();env.persist();env.pull();result.undo={rows:plain(env.visible()),widget:env.widget()};}
 return result;
}
const matrix={variant:process.env.FIN19_R3_LABEL||'current',noReference:[],bankAllocation:[],remoteFailure:[]};
for(const options of [{},{ordinal:2},{otherAccount:true},{mode:'legacy'},{mode:'linkOnly'},{mode:'scopedOnly'}])matrix.noReference.push(await noReferenceCase(options));
const selectedBudget=(c,rows,bank)=>Math.round(c.monthBudgetStats({...seed(rows),settings:{expenseBanks:[bank]}},now).spent*100);
for(const [label,bank,other,source] of [['TR','trade_republic','sabadell','macrodroid'],['Wallet','sabadell','caixabank','wallet']]){
 const notice=row(10,{source,ent:bank,obAcc:undefined,note:'Nota elegida',noteEdited:true,noCard:true}),a=row(11,{ent:bank,obAcc:'same-bank-account'}),b=row(12,{ent:other,obAcc:'other-bank-account'});
 for(const ordered of permutations([notice,a,b]))for(const kind of ['mergeExpenses','mergeExpensesFromCloud'])for(let split=0;split<=3;split++){
  const c=loadPureLogic(html),before=plain(ordered),out=c[kind](ordered.slice(0,split),ordered.slice(split)).list,repeat=c[kind](out,ordered.slice().reverse()).list;
  matrix.bankAllocation.push({label,bank,other,kind,split,input:before,rows:plain(out),repeat:plain(repeat),cents:cents(out),perBank:{[bank]:selectedBudget(c,out,bank),[other]:selectedBudget(c,out,other)},repeatBank:{[bank]:selectedBudget(c,repeat,bank),[other]:selectedBudget(c,repeat,other)},inputsUnchanged:JSON.stringify(before)===JSON.stringify(plain(ordered))});
 }
}
for(const sameBank of [false,true])for(const ordinal of [1,2]){
 const a=row(21,{extId:'ref-a',...(ordinal>1?{obOrd:ordinal}:{})}),b=row(22,{ent:sameBank?'sabadell':'caixabank',obAcc:'account-c',extId:'ref-c',...(ordinal>1?{obOrd:ordinal}:{})});
 const env=environment([a,b],{deleteFails:true});env.deleteControl.del(env.state.expenses[0]);await env.flush();env.persist();env.pull();
 const result={sameBank,ordinal,input:[a,b],remote:plain(env.remote),visible:plain(env.visible()),widget:env.widget(),deleted:plain(env.state.deleted),deleteCalls:env.trace.deletes,events:plain(env.events)};
 env.deleteControl.undo();await env.flush();env.persist();env.pull();result.undo={rows:plain(env.visible()),widget:env.widget()};matrix.remoteFailure.push(result);
}
if(process.env.FIN19_R3_EVIDENCE)fs.writeFileSync(process.env.FIN19_R3_EVIDENCE,JSON.stringify(matrix,null,2)+'\n',{flag:'wx'});
test('FIN19 R3 no ext_id deletion survives actual sync/import/upload/widget, persistence and undo',()=>{
 for(const r of matrix.noReference){
  const expected=(r.ordinal-1+(r.otherAccount?1:0))*1200;
  assert.ok(r.trace.imports.every(x=>x.txs.every(t=>t.id===null&&t.acc)),'causal fixture has account and NO bank reference');
  assert.equal(cents(r.after),expected,JSON.stringify({ordinal:r.ordinal,mode:r.mode,otherAccount:r.otherAccount})+' local cents');
  assert.equal(r.widget.cents,expected,'widget after real sync and subirGasto');
  assert.equal(r.uploads.length,0,'sync does not upload resurrected rows');
  assert.deepEqual(r.after,r.before.filter(e=>e.id!==uuid(1)),'complete surviving rows');
  if(r.undo){assert.equal(cents(r.undo.rows),expected+1200);assert.equal(r.undo.widget.cents,expected+1200);assert.deepEqual(r.undo.rows,r.before,'undo full rows');}
 }
});
test('FIN19 R3 incomplete notice chooses its own bank: selected expenseBanks exact cents',()=>{
 for(const r of matrix.bankAllocation){
  assert.equal(r.cents,640,'global total');
  assert.deepEqual(r.perBank,{[r.bank]:320,[r.other]:320},r.label+' '+r.kind+' split'+r.split);
  assert.deepEqual(r.repeatBank,r.perBank,'repeat retains bank allocation');assert.ok(r.inputsUnchanged);
  if(r.input.slice(0,r.split).some(e=>e.id===uuid(10))&&r.input[0].id===uuid(10)){
   const notice=r.rows.find(e=>e.id===uuid(10));assert.ok(notice,'local notice UUID retained');
   for(const k of ['note','noteEdited','noCard'])assert.equal(notice[k],r.input[0][k],k+' remains manual');
   assert.ok(!notice.obAcc||notice.obAcc==='same-bank-account','no account from another bank inferred');
  }
 }
});
test('FIN19 R3 failed remote delete: widget respects account tombstone and leaves survivor320',()=>{
 for(const r of matrix.remoteFailure){
  assert.equal(r.deleteCalls,1);assert.equal(r.remote.length,2,'remote deletion really failed');
  assert.equal(cents(r.visible),320,'client visible survivor');assert.equal(r.widget.cents,320,'widget survivor despite failed DELETE');
  assert.deepEqual(r.widget.rows,r.remote.filter(e=>e.id===uuid(22)),'server full survivor row');
  assert.equal(cents(r.undo.rows),640);assert.equal(r.undo.widget.cents,640,'undo restores both');
 }
});
function mutate(source,from,to){assert.ok(source.includes(from),'mutation anchor');return source.replace(from,to);}
test('FIN19 R3 cubierta mutations reimport through actual sync and upload',async()=>{
 for(const [mode,from,to] of [
  ['scopedOnly','hasKey(row) || delSet[key] ||','hasKey(row) ||'],
  ['linkOnly','|| vinculado[key] || vinculado[g.scoped+suf]','|| vinculado[g.scoped+suf]']
 ]){
  const r=await noReferenceCase({mode,source:mutate(html,from,to)});
  assert.ok(r.uploads.length>0,mode+' mutant uploads deleted expense');
 }
});
async function oldTombstonePair(source){
 const a=row(1,{ent:'trade_republic',amount:12,merchant:'Movimiento',obName:'Movimiento'});
 const manuals=[row(40,{source:'manual',ent:'trade_republic',amount:12,merchant:'Primero',obName:undefined,obAcc:undefined}),row(41,{source:'manual',ent:'trade_republic',amount:12,merchant:'Segundo',obName:undefined,obAcc:undefined})];
 const env=environment([a,...manuals],{source});env.links=links([['account-a',2]]);
 env.deleteControl.del(env.state.expenses[0]);await env.flush();env.state.gemelos=[];env.persist();await env.sync();
 return plain(env.uploads);
}
test('FIN19 R3 lapidaVieja reserves first manual candidate for answered ordinal',async()=>{
 const good=await oldTombstonePair(html);
 const bad=await oldTombstonePair(mutate(html,'(delSet[key] || delSet[g.scoped] || delSet[g.base])','(delSet[g.scoped] || delSet[g.base])'));
 assert.equal(good.length,1);assert.equal(good[0].possibleDupOf,uuid(41));
 assert.equal(bad.length,1);assert.equal(bad[0].possibleDupOf,uuid(40),'mutant incorrectly consumes first candidate');
});
test('FIN19 R3 server tombstone mutation counts failed DELETE again',async()=>{
 const mutant=mutate(serverSource,'if (porCuenta.size && !esSourceManual(f.source))','if (false && !esSourceManual(f.source))'),mod={exports:{}};
 new Function('module','exports',transformSync(mutant,{loader:'ts',format:'cjs'}).code)(mod,mod.exports);
 const env=environment([row(21,{extId:'ref-a'}),row(22,{ent:'caixabank',obAcc:'account-c',extId:'ref-c'})],{deleteFails:true,server:mod.exports});
 env.deleteControl.del(env.state.expenses[0]);await env.flush();env.persist();env.pull();
 assert.equal(env.widget().cents,640,'mutant exposes remotely surviving deleted row');
});
test('FIN19 R3 bank preference mutant charges wrong selected budget',()=>{
 const c=loadPureLogic(mutate(html,'||bankContents.get(bank+"|"+key)||contents.get(key)','||contents.get(key)'));
 const notice=row(10,{source:'macrodroid',ent:'trade_republic',obAcc:undefined}),a=row(11),b=row(12,{ent:'trade_republic',obAcc:'account-t'});
 const out=c.mergeExpensesFromCloud([notice],[a,b]).list;
 assert.equal(selectedBudget(c,out,'trade_republic'),640);
 assert.equal(selectedBudget(c,out,'sabadell'),0);
});
test('FIN19 R3 server known-scope mutant loses other account on undo',async()=>{
 const mutant=mutate(serverSource,'k = scope ? scope + "|" + key : key','k = key'),mod={exports:{}};
 new Function('module','exports',transformSync(mutant,{loader:'ts',format:'cjs'}).code)(mod,mod.exports);
 const env=environment([row(1,{amount:12}),row(2,{amount:12,obAcc:'account-b'})],{server:mod.exports});
 env.deleteControl.del(env.state.expenses[0]);await env.flush();env.deleteControl.undo();await env.flush();env.persist();env.pull();
 assert.equal(cents(env.visible()),2400);assert.equal(env.widget().cents,1200);
});
