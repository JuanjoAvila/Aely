// Lecturas NUEVAS trazables: el legado no se convierte en dinero por una fecha vieja.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {loadPureLogic} from '../scripts/load-pure-logic.mjs';
import {codeMask} from '../scripts/beta-source-code.mjs';
import {withOwnerStorage} from './helpers/owner-storage-fixture.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
let core=read('src/modules/00-core.js'),bank=read('src/modules/08-motor-bank.js');
const pauseSource=process.argv.find(x=>x.startsWith('--pause-source='));
if(pauseSource){
 const sha=pauseSource.slice('--pause-source='.length);
 assert.equal(sha,'550a9cf47e72aa62d7e190aa2994858ca52c5b6d','única fuente roja rechazada');
 const source=execFileSync('git',['show',sha+':src/modules/08-motor-bank.js'],{cwd:new URL('..',import.meta.url),encoding:'utf8',windowsHide:true});
 bank=bank.replace(block(bank,'function fixedPausa('),()=>block(source,'function fixedPausa('));
}
const mutations={
 bareDate:["const a=accounts[0],proof=manualBalanceRead(s,a.id)","const a=accounts[0],proof=manualBalanceModel(a)"],
 sameDay:["read.d>=day","read.d>day"],
 uniqueBank:["if(accounts.length!==1||!Number.isInteger(day)","if(accounts.length<1||!Number.isInteger(day)"],
 missingLink:["env.stateAt!==s._savedAt||",""],
 resurrect:["if(!intent&&!s.manualBalanceReads) return s;","if(!intent&&s.manualBalanceReads) return Object.assign({},s,{manualBalanceReads:Object.assign({},s.manualBalanceReads,{stateAt:at})});if(!intent&&!s.manualBalanceReads) return s;"],
 staleInverse:["const input=insumosSaldoGasto(s),rows=[]","const input={paidNetByBank:{},spentByBank:{},injTR:0,roundup:0,monthlyInvest:0},rows=[]"],
 preserveUnchanged:["if(Math.round(typed*100)===Math.round(shown*100)){changed=true;return Object.assign({},a,{saldoLeidoAt:new Date().toISOString()});}","if(Math.round(typed*100)===Math.round(shown*100)){rows.push({before:manualBalanceModel(a),next:Object.assign(manualBalanceModel(a),{origin:'manual-v1'}),typed:typed});return a;}"],
 sameReadStamp:["if(Math.round(typed*100)===Math.round(shown*100)){changed=true;return Object.assign({},a,{saldoLeidoAt:new Date().toISOString()});}","if(Math.round(typed*100)===Math.round(shown*100)) return a;"],
 resumeCompensation:["origin&&origin.schema===1","false&&origin.schema===1"],
 intervalResume:["!fixedPausedIn(f,y,m)&&origin","until<=from&&origin"],
 resumeNever:["const out=conSaldoMostrado(s,next),origin=", "const out=e&&f&&fixedPausedIn(e,y,m)&&!fixedPausedIn(f,y,m)?next:conSaldoMostrado(s,next),origin="],
 loseOrigin:["if(e&&f&&(s.fixed||[]).filter", "if(manualBalanceRead(s,e.manualPauseBalance&&e.manualPauseBalance.accountId)&&e&&f&&(s.fixed||[]).filter"],
 splitOrigin:["[\"pausedFrom\",\"pausedUntil\",\"manualPauseBalance\"]","[\"pausedFrom\",\"pausedUntil\"]"],
 originMonth:["origin.ym<=ym","origin.ym===ym"],
 snapshot:["manualBalanceSame(p,manualBalanceModel(a))","true"],
 manual:["return !!a&&!a.bankIban&&!a.bankUid&&a.balSaldo==null&&!a.balanceAt&&!saldoLoMandaPuenteNativo(s,a.ent);","return !!a;"],
 nativeWrite:["||a.bankIban||a.bankUid||a._obKey) return a;","||!manualBalanceIsManual(s,a)) return a;"],
 target:["if(![\"id\",\"ent\",\"role\",\"spendFrom\"].every(function(k){return r.expected[k]===target[k];})) return a;",""]
};
const mutant=process.env.RECIBOS_MANUAL_MUTANT||process.argv.slice(2).find(x=>!x.startsWith('--'));
if(mutant){const pair=mutations[mutant];assert.ok(pair,'mutante conocido');if(bank.includes(pair[0]))bank=bank.replace(pair[0],pair[1]);else{assert.ok(core.includes(pair[0]),'mutante aplicable');core=core.replace(pair[0],pair[1]);}}
const app=read('src/modules/11-app-main.js'),accounts=read('src/modules/07-tab-patri-fijos.js'),shared=read('src/modules/02-ui-shared.js');
const js=JSON.parse(read('src/build-order.json')).map(f=>f==='00-core.js'?core:f==='08-motor-bank.js'?bank:read('src/modules/'+f)).join('\n');
const html=read('src/shell.html').replace('<!--MC_APP_SCRIPT-->',()=>js);
const writer=accounts.slice(accounts.indexOf('  const valorDesdeTecleado=function'),accounts.indexOf('  // Cartera pinta cuentas y bienes planos'));
const editable=shared.slice(shared.indexOf('function useEditable('),shared.indexOf('/* Cuentas y brókers comparten el mismo HOLD'));
const setter=app.slice(app.indexOf('  const set=useCallback('),app.indexOf('  // En el propio commit'));
const callback=read('src/modules/14-v4-screens.js').split('\n').find(x=>x.includes('if(f&&!pagado) pausaChips.push'));
const cents=v=>Math.round(Number(v)*100),copy=v=>JSON.parse(JSON.stringify(v));
let now=Date.parse('2026-10-01T12:00:00Z'),count=0;
function clock(s){now=Date.parse(s);}
function tick(){now+=10;}
function block(src,token){const mask=codeMask(src),start=mask.indexOf(token);assert.ok(start>=0,token);let i=mask.indexOf('{',start)+1,n=1;for(;n;i++){if(mask[i]==='{')n++;if(mask[i]==='}')n--;}return src.slice(start,i);}
function fixture(account={},receipt={}){return {accounts:[Object.assign({id:'a',ent:'sabadell',role:'fijos',value:0},account)],fixed:[Object.assign({id:'f',name:'Cuota sintetica',amount:12.99,day:5,freq:'mes',account:'sabadell'},receipt)],expenses:[],bankTx:[],debts:[],flows:[],oneoffs:[],settings:{},_savedAt:now-1000,_historyOwner:'synthetic-owner'};}
// Vía anterior de c89bb12c5 (t4), idéntica a la de 555fe0c3 para las exclusiones sin
// lectura nueva. Oráculo separado: NO llama a fixedPausa ni decide con la prueba del candidato.
let baselinePausa=`function(s,id,from,until){
 let changed=false;
 const fixed=(s.fixed||[]).map(function(e){
  if(e.id!==id)return e;
  const n=Object.assign({},e);
  if(until>from){n.pausedFrom=from;n.pausedUntil=until;}
  else{delete n.pausedFrom;delete n.pausedUntil;}
  if(goalSyncEqual(n,e))return e;
  changed=true;return n;
 });
 return changed?conSaldoMostrado(s,Object.assign({},s,{fixed:fixed})):s;
}`;
// Las pasadas dirigidas pueden contrastar también las DOS fuentes reales completas de la
// función; la pasada normal de CI no depende de disponer de objetos históricos en un shallow.
const baselineSelector=process.argv.find(x=>x.startsWith('--baseline='));
if(baselineSelector){
 const sha=baselineSelector.slice('--baseline='.length);
 assert.ok(['555fe0c3656a3aeb948ff2423c79f674c5b3f92c','c89bb12c528f079640a514b95334c21b9df2d2c1'].includes(sha),'base de comparación explícita');
 baselinePausa=block(execFileSync('git',['show',sha+':src/modules/08-motor-bank.js'],{cwd:new URL('..',import.meta.url),encoding:'utf8',windowsHide:true}),'function fixedPausa(');
}
function harness(s=fixture(),baseline=false){
 const c=withOwnerStorage(loadPureLogic(html)),h={c,s,slots:[],cursor:0};
 c.Date=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 c.setStateRaw=fn=>{h.s=fn(h.s);};
 h.set=vm.runInContext('(function(){'+setter+'return set;})()',c);c.set=h.set;
 c.useEditable=vm.runInNewContext('('+editable+')',{useState(init){const i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof init==='function'?init():init;return[h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v;}];}});
 h.render=()=>{c.state=h.s;c.set=h.set;c.totals=c.insumosSaldoGasto(h.s);c.pn=a=>c.totals.paidNetByBank[a.ent]||0;c.spentOwn=a=>c.totals.spentByBank[a.ent]||0;c.ruM=c.totals.roundup;c.miM=c.totals.monthlyInvest;c.shownAcc=a=>c.saldoCuentaMostrada(a,c.totals);h.cursor=0;return vm.runInContext('(function(){'+writer+'return{save:guardarSaldoDe,editor:accEd};})()',c);};
 h.shown=(id='a')=>cents(c.saldoCuentaMostrada(h.s.accounts.find(a=>a.id===id),c.insumosSaldoGasto(h.s)));
 const pause=baseline?vm.runInContext('('+baselinePausa+')',c):c.fixedPausa;
 h.pause=(from=2026*12+10,until=from+1)=>{tick();h.set(s=>pause(s,'f',from,until));};
 h.read=(v=1000)=>{tick();h.render().save('a',v);assert.equal(h.shown(),cents(v));};
 h.legacy=v=>{let w=h.render();w.editor.start();w=h.render();w.editor.setDraft(d=>Object.assign({},d,{a:String(v)}));tick();h.render().editor.save();};
 return h;
}
function beforeDue(account={},receipt={}){clock('2026-10-01T12:00:00Z');const h=harness(fixture(account,receipt));h.read();clock('2026-10-18T12:00:00Z');return h;}
async function check(name,fn){if(process.argv.includes('--roundtrip-only')&&!name.startsWith('roundtrip'))return;await fn();count++;console.log('PASS '+name);}
await check('writer + set + callback reales: RED corregido, pausa, persistencia y reanudar',()=>{
 const h=beforeDue(),{c}=h;assert.equal(h.shown(),98701);assert.ok(c.manualBalanceRead(h.s,'a'));
 const original=h.s;Object.assign(c,{f:h.s.fixed[0],pagado:false,cur:2026*12+10,pausaChips:[],t:x=>x,tf:x=>x,cerrarCon:()=>{},row:{name:'Cuota sintetica'},set:h.set});
 tick();vm.runInContext(callback,c);c.pausaChips[0].go();assert.equal(h.shown(),100000,'100000 leídos menos CERO cargos reales');assert.equal(original.accounts[0].value,1000);assert.equal(h.s.accounts[0].value,1000);
 c.mcSaveRaw('synthetic-manual-state',h.s);h.s=c.mcLoadRaw('synthetic-manual-state');assert.ok(c.manualBalanceRead(h.s,'a'),'guardado y lectura reales conservan pareja íntegra');
 h.s=copy(c.slimForCloud(h.s));assert.ok(c.manualBalanceRead(h.s,'a'),'pareja nube íntegra');h.pause(0,0);assert.equal(h.shown(),98701);h.pause();assert.equal(h.shown(),100000);
 const same=h.s;h.pause();assert.equal(h.s,same,'no-op no refecha');
 clock('2026-11-01T12:00:00Z');assert.equal(c.fixedPausedIn(h.s.fixed[0],2026,11),false);h.pause(0,0);assert.equal(h.shown(),100000,'otro mes conserva comportamiento actual');
});
await check('legado, mismo día, posterior, futuro y día inválido mantienen saldo',()=>{
 for(const at of [undefined,'invalida','2026-12-01T00:00:00Z']){clock('2026-10-18T12:00:00Z');const h=harness(fixture({value:1000,saldoLeidoAt:at}));h.pause();assert.equal(h.shown(),98701);}
 for(const at of ['2026-10-05T08:00:00Z','2026-10-10T12:00:00Z']){clock(at);const h=harness();h.read();clock('2026-10-18T12:00:00Z');h.pause();assert.equal(h.shown(),100000);}
 for(const day of [25,null,1.5]){const h=beforeDue({}, {day}),before=h.shown();h.pause();assert.equal(h.shown(),before);}
});
await check('roundtrip de CADA exclusión coincide con la base independiente y no cobra dos veces',()=>{
 const cur=2026*12+10;
 for(const mode of ['sin sello','sello legado','conectada','TR nativo','edición legacy','dos cuentas'])for(const target of [[0,0],[cur+1,cur+2],[cur-2,cur]]){
  clock('2026-10-18T12:00:00Z');
  const s=fixture({value:1000});
  if(mode==='sello legado')s.accounts[0].saldoLeidoAt='2026-10-01T12:00:00Z';
  if(mode==='conectada')s.accounts[0].bankUid='SYNTHETIC';
  if(mode==='TR nativo'){s.accounts[0].ent='trade_republic';s.fixed[0].account='trade_republic';s.settings.brokersOn=['trade_republic'];}
  if(mode==='dos cuentas')s.accounts.push({id:'b',ent:'sabadell',role:'fijos',value:400});
  const h=harness(copy(s)),base=harness(copy(s),true);
  if(mode==='edición legacy'){const at=now;h.legacy('987,01');now=at;base.legacy('987,01');}
  const before=copy(h.s.accounts),expectedShown=mode==='dos cuentas'?97402:98701;
  assert.equal(base.shown(),expectedShown,mode+' partida de base');assert.equal(h.shown(),expectedShown,mode+' partida');
  h.pause();base.pause();assert.deepEqual(copy(h.s.accounts),copy(base.s.accounts),mode+' pausa vs base');assert.equal(base.shown(),expectedShown,mode+' pausa de base');assert.equal(h.shown(),expectedShown,mode+' pausa');assert.equal(h.shown(),base.shown(),mode+' mostrado pausado vs base');
  assert.equal(h.s.fixed[0].manualPauseBalance,undefined,mode+' no inventa origen manual');
  // Ausencia de proof en esta vía significa seguir deshaciendo la compensación de BASE.
  h.pause(...target);base.pause(...target);
  assert.deepEqual(copy(h.s.accounts),copy(base.s.accounts),mode+' reanudar vs base '+target);
  assert.deepEqual(copy(h.s.accounts),before,mode+' roundtrip restaura cada cuenta');assert.deepEqual(copy(base.s.accounts),before,mode+' roundtrip de base restaura cada cuenta');assert.equal(base.shown(),expectedShown,mode+' roundtrip mostrado de base');assert.equal(h.shown(),expectedShown,mode+' roundtrip conserva céntimos');assert.equal(h.shown(),base.shown(),mode+' mostrado reanudado vs base');
  assert.equal(cents(h.s.accounts[0].value),100000,mode+' vuelve a base100000c');
 }
});
await check('reanudar restaura la base previa o no compensa sin prueba B1',()=>{
 const clean=beforeDue(),prior=copy(clean.s.accounts);clean.pause();assert.equal(clean.shown(),100000);clean.pause(0,0);assert.deepEqual(copy(clean.s.accounts),prior);assert.equal(clean.shown(),98701);
 for(const edit of ['nota','base','lectura posterior']){
  const h=beforeDue(),prior=copy(h.s.accounts);h.pause();assert.equal(h.shown(),100000);
  if(edit==='lectura posterior')h.read(800);else{tick();h.set(s=>edit==='nota'?Object.assign({},s,{note:'otra edición'}):Object.assign({},s,{accounts:s.accounts.map(a=>Object.assign({},a,{value:800}))}));}
  const base=cents(h.s.accounts[0].value);h.pause(0,0);assert.equal(cents(h.s.accounts[0].value),base,'B1 no suma 1299c tras '+edit);assert.equal(h.shown(),base-1299);if(edit==='nota')assert.deepEqual(copy(h.s.accounts),prior);
 }
 for(const old of ['sin prueba','sello desfasado','base distinta']){
  const h=beforeDue();h.pause();const oldState=copy(h.s);tick();
  if(old==='sin prueba')delete oldState.manualBalanceReads;else if(old==='sello desfasado')oldState._savedAt=now;else oldState.accounts[0].value=800;
  h.s=oldState;assert.equal(h.c.manualBalanceRead(h.s,'a'),null);const base=cents(h.s.accounts[0].value);h.pause(0,0);assert.equal(cents(h.s.accounts[0].value),base,'B1 cliente viejo '+old);assert.equal(h.shown(),base-1299);
 }
});
await check('B1: matriz completa de intervalos conserva base o falla cerrada al reactivar',()=>{
 const cur=2026*12+10,ranges=[[0,0],[cur,cur+1],[cur-1,cur+2],[cur+1,cur+2],[cur-2,cur]];
 for(const source of ranges)for(const target of ranges)for(const mode of ['íntegra','nota','base','sin prueba','cliente viejo']){
  const h=beforeDue();h.pause(...source);
  if(mode==='nota'||mode==='base'){tick();h.set(s=>mode==='nota'?Object.assign({},s,{note:'cambio intermedio'}):Object.assign({},s,{accounts:s.accounts.map(a=>Object.assign({},a,{value:800.25}))}));}
  if(mode==='sin prueba')delete h.s.manualBalanceReads;
  if(mode==='cliente viejo')h.s=Object.assign({},h.s,{_savedAt:now+1});
  const prior=copy(h.s.accounts),base=cents(prior[0].value),shown=h.shown(),proof=!!h.c.manualBalanceRead(h.s,'a'),origin=h.s.fixed[0].manualPauseBalance;
  const paused=source[0]<=cur&&cur<source[1],nextPaused=target[0]<=cur&&cur<target[1],resumes=paused&&!nextPaused;
  h.pause(...target);
  const label=JSON.stringify({source,target,mode});
  if((proof&&!paused&&nextPaused)||resumes&&origin||paused===nextPaused)assert.deepEqual(copy(h.s.accounts),prior,'base exacta: '+label);
  else assert.equal(h.shown(),shown,'pausar sin prueba conserva lo mostrado: '+label);
  if(resumes&&origin)assert.equal(h.shown(),base-1299,'reactivar vía nueva devuelve la proyección: '+label);
  if(resumes&&!origin)assert.equal(cents(h.s.accounts[0].value),base+1299,'reactivar vía base deshace su compensación: '+label);
 }
});
await check('origen de pausa nuevo persiste separado de proof y viaja con intervalo en tres vías',()=>{
 const h=beforeDue(),cur=2026*12+10;h.pause();
 const paused=copy(h.s),origin=copy(h.s.fixed[0].manualPauseBalance);assert.deepEqual(origin,{schema:1,origin:'manual-v1',ym:cur,accountId:'a',ent:'sabadell'});
 tick();h.set(s=>Object.assign({},s,{note:'otra edición'}));assert.equal(h.s.manualBalanceReads,undefined);assert.deepEqual(copy(h.s.fixed[0].manualPauseBalance),origin);
 h.s=copy(h.c.slimForCloud(h.s));h.pause(cur+1,cur+2);assert.equal(cents(h.s.accounts[0].value),100000,'sin proof no aparece compensación de base');assert.equal(h.shown(),98701);assert.equal(h.s.fixed[0].manualPauseBalance,undefined);
 const remote=copy(paused.fixed),local=copy(paused.fixed);delete local[0].pausedFrom;delete local[0].pausedUntil;delete local[0].manualPauseBalance;remote[0].manualPauseBalance=Object.assign({},origin,{ym:cur-1});
 const merged=h.c.mergePlanThreeWay(paused.fixed,local,remote,'fixed',[],false);
 assert.deepEqual(copy(merged.rows[0]),remote[0],'no mezcla intervalo borrado local con origen remoto');assert.ok(merged.conflicts.some(x=>x.fields.includes('manualPauseBalance')),'conflicto conserva bloque de pausa completo');
});
await check('origen nuevo conserva sólo su cuenta al perder proof y añadir cuenta o cambiar rol',()=>{
 for(const mode of ['segunda cuenta','ID duplicado','rol','banco']){
  const h=beforeDue();h.pause();tick();
  h.set(s=>Object.assign({},s,{accounts:mode==='segunda cuenta'||mode==='ID duplicado'?s.accounts.concat([{id:mode==='ID duplicado'?'a':'b',ent:'sabadell',role:'fijos',value:400}]):s.accounts.map(a=>Object.assign({},a,mode==='rol'?{role:'ambos',spendFrom:true}:{ent:'revolut'}))}));
  const incoming=copy(h.s),base=harness(copy(h.s),true);h.pause(0,0);base.pause(0,0);
  if(mode==='banco')assert.deepEqual(copy(h.s.accounts),copy(base.s.accounts),'no aplica origen de Sabadell a una cuenta ahora Revolut');
  else{
   assert.equal(cents(h.s.accounts[0].value),cents(incoming.accounts[0].value),'no compensa cuenta de vía nueva tras '+mode);
   if(mode==='segunda cuenta')assert.deepEqual(copy(h.s.accounts[1]),copy(base.s.accounts[1]),'segunda cuenta conserva SU vía base');
   if(mode==='ID duplicado')assert.deepEqual(copy(h.s.accounts),incoming.accounts,'ninguna copia ambigua recibe compensación extra');
  }
 }
});
await check('pausa nueva continua conserva su origen al cambiar de mes, otra pausa no lo hereda',()=>{
 const cur=2026*12+10;
 for(const mode of ['íntegra','sin prueba']){
  const h=beforeDue();h.pause(cur,cur+2);clock('2026-11-18T12:00:00Z');
  if(mode==='sin prueba'){tick();h.set(s=>Object.assign({},s,{note:'edición en noviembre'}));}
  const base=cents(h.s.accounts[0].value);h.pause(0,0);assert.equal(cents(h.s.accounts[0].value),base,'no suma por cambiar de mes: '+mode);assert.equal(h.shown(),base-1299);
 }
 const old=beforeDue();old.pause();clock('2026-11-18T12:00:00Z');const base=cents(old.s.accounts[0].value);
 old.pause(cur+1,cur+2);assert.equal(old.s.fixed[0].manualPauseBalance,undefined,'otra pausa sin lectura de noviembre no hereda octubre');
 old.pause(0,0);assert.equal(cents(old.s.accounts[0].value),base,'la nueva pausa base sí deshace SU compensación');assert.equal(old.shown(),base-1299);
});
await check('edición ajena invalida una vez, sin resurrección ni clonar cuentas',()=>{
 const h=beforeDue(),a=h.s.accounts,proof=h.s.manualBalanceReads;tick();h.set(s=>Object.assign({},s,{note:'edición ajena'}));assert.equal(h.s.accounts,a);assert.equal(h.s.manualBalanceReads,undefined);h.pause();assert.equal(h.shown(),98701);
 const old=beforeDue();old.s=Object.assign({},old.s,{_savedAt:now});assert.equal(old.c.manualBalanceRead(old.s,'a'),null);tick();old.set(s=>Object.assign({},s,{note:'otra'}));assert.equal(old.s.manualBalanceReads,undefined);assert.ok(proof);
});
await check('editor legacy real: lectura nueva, confirmación idéntica y filas conectadas',()=>{
 const h=beforeDue();clock('2026-10-10T12:00:00Z');h.legacy('1234,56');assert.equal(h.shown(),123456);assert.equal(h.s.accounts[0].saldoLeidoAt,new Date(now).toISOString());h.pause();assert.equal(h.shown(),123456);
 const same=beforeDue();same.legacy('987,01');assert.equal(same.s.manualBalanceReads,undefined);assert.equal(same.s.accounts[0].saldoLeidoAt,new Date(now).toISOString());same.pause();assert.equal(same.shown(),98701);
 clock('2026-10-01T12:00:00Z');const linked=harness(fixture({bankUid:'SYNTHETIC',value:1000}));const account=linked.s.accounts[0];linked.legacy('2000');assert.equal(linked.s.accounts[0],account);assert.equal(account.saldoLeidoAt,undefined);
});
await check('ficha: confirmar la misma cifra sella lectura t3 sin cambiar base R2',()=>{
 for(const at of ['2026-10-18T12:00:00Z','2026-10-18T23:30:00Z','2026-10-19T12:00:00Z']){
  const h=beforeDue(),base=cents(h.s.accounts[0].value),shown=h.shown(),old=h.s.accounts[0].saldoLeidoAt;clock(at);h.read(shown/100);
  assert.notEqual(h.s.accounts[0].saldoLeidoAt,old);assert.equal(h.s.accounts[0].saldoLeidoAt,new Date(now).toISOString(),'R2 misma cifra sella t3');assert.equal(h.c.saldoLeidoDelBanco(h.s,'sabadell'),now,'puerta real de lectura ve t3');assert.equal(cents(h.s.accounts[0].value),base);assert.equal(h.shown(),shown);assert.equal(h.s.manualBalanceReads,undefined,'la misma cifra no fabrica prueba manual');
  assert.equal(h.c.reciboEnElSaldo(h.s,h.s.fixed[0],2026,10,new Date(now).getDate(),h.c.saldoLeidoDelBanco(h.s,'sabadell'),18),now>=new Date(2026,9,19).getTime(),'t3 sólo incluye el cargo desde el día siguiente local');
 }
});
await check('writer viejo real conserva sello; vínculo de estado detecta base idéntica',()=>{
 const h=beforeDue(),oldShared=read('src/modules/02-ui-shared.js'),oldEditable=oldShared.slice(oldShared.indexOf('function useEditable('),oldShared.indexOf('/* Cuentas y brókers comparten el mismo HOLD'));
 const c=h.c;let slots=[],idx=0;const use=vm.runInNewContext('('+oldEditable+')',{useState(init){const i=idx++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];}});
 const start=copy(h.s.accounts[0]);function render(){idx=0;return use(h.s.accounts,it=>{h.s=Object.assign({},h.s,{accounts:it,_savedAt:now});},{display:a=>c.saldoCuentaMostrada(a,c.insumosSaldoGasto(h.s)),toStored:(a,v)=>+(v-(c.insumosSaldoGasto(h.s).paidNetByBank[a.ent]||0)).toFixed(2)});}
 clock('2026-10-10T12:00:00Z');let w=render();w.start();w=render();w.setDraft({a:'987,01'});render().save();assert.deepEqual(copy(h.s.accounts[0]),start);assert.equal(c.manualBalanceRead(h.s,'a'),null);h.pause();assert.equal(h.shown(),98701);
});
await check('corregir saldo sigue disponible en TR nativo y adoptadas sin identidad OB',()=>{
 for(const extra of [{ent:'trade_republic'},{balSaldo:1000},{balanceAt:'2026-10-01T00:00:00Z'}]){
  clock('2026-10-10T12:00:00Z');const s=fixture(extra,{account:extra.ent||'sabadell'});if(extra.ent)s.settings.brokersOn=['trade_republic'];const h=harness(s);h.read(500);assert.equal(h.shown(),50000);assert.equal(h.s.accounts[0].saldoLeidoAt,new Date(now).toISOString());assert.equal(h.s.manualBalanceReads,undefined,'guardar no equivale a acreditar lectura manual');h.pause();assert.equal(h.shown(),50000);
  h.legacy('600,25');assert.equal(h.shown(),60025);assert.equal(h.s.manualBalanceReads,undefined);
 }
});
await check('fresh inverse y objetivo esperado del render',()=>{
 clock('2026-10-10T12:00:00Z');const h=harness(),w=h.render();h.s=Object.assign({},h.s,{fixed:h.s.fixed.map(f=>Object.assign({},f,{amount:25.37}))});tick();w.save('a',500);assert.equal(h.shown(),50000);assert.equal(cents(h.s.accounts[0].value),52537);assert.ok(h.c.manualBalanceRead(h.s,'a'));
 const other=harness(),stale=other.render();other.s=Object.assign({},other.s,{accounts:other.s.accounts.map(a=>Object.assign({},a,{ent:'revolut',role:'ambos'}))});const prior=other.s;tick();stale.save('a',777);assert.equal(other.s,prior,'no escribe saldo de otra entidad/rol');
});
await check('cuentas ambiguas, conectadas, TR nativo, pagados y recibos duplicados',()=>{
 for(const extra of [{bankIban:'SYNTHETIC'},{bankUid:'SYNTHETIC'},{balSaldo:1000},{balanceAt:'2026-10-01T00:00:00Z'}]){const h=beforeDue();h.s=Object.assign({},h.s,{accounts:h.s.accounts.map(a=>Object.assign({},a,extra))});const before=h.shown();h.pause();assert.equal(h.shown(),before);}
 const native=beforeDue({ent:'trade_republic'},{account:'trade_republic'});native.s=Object.assign({},native.s,{settings:{brokersOn:['trade_republic']}});native.pause();assert.equal(native.shown(),98701);
 const manual=beforeDue({ent:'trade_republic'},{account:'trade_republic'});manual.pause();assert.equal(manual.shown(),100000,'TR manual sin puente sí');
 const multi=beforeDue();multi.s=Object.assign({},multi.s,{accounts:multi.s.accounts.concat([{id:'b',ent:'sabadell',role:'fijos',value:400}])});const before=multi.shown();multi.pause();assert.equal(multi.shown(),before);
 const paid=beforeDue();paid.s=Object.assign({},paid.s,{fixed:paid.s.fixed.map(f=>Object.assign({},f,{paidYm:2026*12+10,paidDay:5}))});paid.pause();assert.equal(paid.shown(),98701);
 const dup=beforeDue();dup.s=Object.assign({},dup.s,{fixed:dup.s.fixed.concat([Object.assign({},dup.s.fixed[0])])});const prev=dup.shown();dup.pause();assert.equal(dup.shown(),prev);
});
await check('carry ligado a entrada, tras reconciler, relojes y edited=false',()=>{
 const h=beforeDue(),c=h.c,staged=c.fixedPausa(h.s,'f',2026*12+10,2026*12+11);
 const damaged=Object.assign({},staged,{accounts:staged.accounts.map(a=>Object.assign({},a,{value:999}))});const committed=c.planSyncEditState(damaged,now+100);assert.equal(c.manualBalanceRead(committed,'a'),null);
 const twice1=c.planSyncEditState(staged,now+100),twice2=c.planSyncEditState(staged,now+100);assert.equal(c.obStateCanonical(twice1),c.obStateCanonical(twice2));assert.ok(c.manualBalanceRead(twice1,'a'));
 for(const at of [h.s._savedAt,h.s._savedAt-1,NaN])assert.equal(c.manualBalanceRead(c.planSyncEditState(staged,at),'a'),null);
 const json=copy(h.s);json.carry={kind:'pause'};assert.equal(c.planSyncEditState(json,now+100).manualBalanceReads,undefined);
 h.set(s=>Object.assign({},s,{accounts:s.accounts.map(a=>Object.assign({},a,{role:'ambos'}))}),false);assert.equal(c.manualBalanceRead(h.s,'a'),null);
});
await check('días Madrid en el borde UTC y fallback si el calendario local difiere',()=>{
 const beforeTZ=process.env.TZ;try{
 for(const tz of ['UTC','Europe/Madrid']){
  process.env.TZ=tz;
  clock('2026-10-04T22:30:00Z');const same=harness();same.read();clock('2026-10-18T12:00:00Z');same.pause();assert.equal(same.shown(),tz==='UTC'?98701:100000,'lectura del día 5 Madrid no retira proyección: '+tz);assert.equal(same.s.manualBalanceReads,undefined,'mismo día Madrid no conserva prueba');
  clock('2026-10-04T21:59:00Z');const earlier=harness();earlier.read();clock('2026-10-18T12:00:00Z');earlier.pause();assert.equal(earlier.shown(),100000,'todavía día 4 Madrid: retira proyección en '+tz);assert.ok(earlier.c.manualBalanceRead(earlier.s,'a'));
  const other=beforeDue();clock('2026-10-04T22:30:00Z');other.pause();assert.equal(other.shown(),100000);assert.equal(!!other.c.manualBalanceRead(other.s,'a'),tz==='Europe/Madrid','días locales distintos no conservan carry: '+tz);
  for(const at of ['2026-10-25T00:30:00Z','2026-10-25T01:30:00Z']){const dst=beforeDue();clock(at);dst.pause();assert.equal(dst.shown(),100000);assert.ok(dst.c.manualBalanceRead(dst.s,'a'),'ambas horas del cambio de horario son el mismo día: '+tz);}
  for(const at of ['2026-03-29T00:30:00Z','2026-03-29T01:30:00Z']){
   clock('2026-03-01T12:00:00Z');const spring=harness(fixture({}, {day:25}));spring.read();clock(at);spring.pause(2026*12+3,2026*12+4);assert.equal(spring.shown(),100000);assert.ok(spring.c.manualBalanceRead(spring.s,'a'),'salto de primavera antes/después: '+tz);
  }
 }
 }finally{if(beforeTZ===undefined)delete process.env.TZ;else process.env.TZ=beforeTZ;}
});
await check('varios bancos y roles: sólo la cuenta manual inequívoca cambia',()=>{
 for(const role of ['fijos','ambos']){
  clock('2026-10-01T12:00:00Z');const s=fixture({role,spendFrom:role==='ambos'});s.accounts.push({id:'b',ent:'revolut',role:'fijos',value:543.21,bankUid:'SYNTHETIC'});const h=harness(s);h.read();const other=h.s.accounts[1];clock('2026-10-18T12:00:00Z');h.pause();assert.equal(h.shown(),100000);assert.equal(h.shown('b'),54321);assert.equal(h.s.accounts[1],other);
 }
});
function cloudFixture(c,base){
 let row={user_id:'synthetic-owner',data:copy(base),updated_at:'r0'};const requests=[];
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-owner'}}}})},from(table){let body,mode;const filters=[];const q={update(v){body=v;mode='update';return q;},insert(v){body=v;mode='insert';return q;},eq(k,v){filters.push([k,v]);return q;},async select(){assert.equal(table,'app_state');assert.ok(filters.every(([k,v])=>row[k]===v));requests.push({mode,body:copy(body)});row=copy(body);return{data:[{updated_at:row.updated_at}],error:null};}};return q;}};
 const cloud=vm.runInContext('(function(sb){const statePushCache=new Map();return{'+block(core,'async session(')+','+block(core,'async pushState(')+'};})',c)(sb);
 const read={owner:'synthetic-owner',ready:true,baseData:copy(base)},refs={cloudPullRef:{current:null},syncFromCloud:()=>{},cloudReadRef:{current:read},cloudUpdatedAtRef:{current:'r0'},sessionRef:{current:{user:{id:'synthetic-owner'}}},cloud,setStateRaw:()=>{},goalSyncAck:s=>s};
 const keys=Object.keys(refs),send=vm.runInContext('(function('+keys.join(',')+'){'+block(app,'const pushAppState=function(')+';return pushAppState;})',c)(...keys.map(k=>refs[k]));
 return {cloud,send,requests,row:()=>row,refs};
}
await check('ambas puertas cloud reales, cache fría/baseData: clear una vez y cero eco',async()=>{
 const h=beforeDue(),withProof=copy(h.s);tick();h.set(s=>Object.assign({},s));const cleared=h.s;assert.equal(cleared.manualBalanceReads,undefined);
 const first=cloudFixture(h.c,withProof);await first.send('synthetic-owner',cleared);assert.equal(first.requests.length,1,'invalidez es cambio semántico real');
 const later=Object.assign({},cleared,{_savedAt:now+100});const cold=cloudFixture(h.c,cleared);assert.equal((await cold.send('synthetic-owner',later)).unchanged,true);assert.equal(cold.requests.length,0,'guardia11 con cache00 fría');
 const cash=cloudFixture(h.c,cleared);const ack=await cash.cloud.pushState('synthetic-owner',cleared,'r0');assert.equal((await cash.cloud.pushState('synthetic-owner',later,ack.updated_at)).unchanged,true);assert.equal(cash.requests.length,1,'guardia00 caliente');
 const fresh=beforeDue();const sent=cloudFixture(fresh.c,cleared);await sent.send('synthetic-owner',fresh.s);assert.equal(sent.requests.length,1);assert.deepEqual(sent.requests[0].body.data.manualBalanceReads,copy(fresh.s.manualBalanceReads));assert.equal(sent.requests[0].body.data._savedAt,fresh.s._savedAt);
 const prior=copy(fresh.s);fresh.pause();const pa=cloudFixture(fresh.c,prior);await pa.send('synthetic-owner',fresh.s);assert.equal(pa.requests.length,1,'pausa real sí cambia payload');
});
console.log('recibos-manual-pausa: '+count+' grupos OK'+(mutant?' MUTANT '+mutant:''));
