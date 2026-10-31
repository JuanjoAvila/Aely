// Lecturas NUEVAS trazables: el legado no se convierte en dinero por una fecha vieja.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadPureLogic} from '../scripts/load-pure-logic.mjs';
import {codeMask} from '../scripts/beta-source-code.mjs';
import {withOwnerStorage} from './helpers/owner-storage-fixture.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
let core=read('src/modules/00-core.js'),bank=read('src/modules/08-motor-bank.js');
const mutations={
 bareDate:["const a=accounts[0],proof=manualBalanceRead(s,a.id)","const a=accounts[0],proof=manualBalanceModel(a)"],
 sameDay:["read.d>=day","read.d>day"],
 uniqueBank:["if(accounts.length!==1||!Number.isInteger(day)","if(accounts.length<1||!Number.isInteger(day)"],
 missingLink:["env.stateAt!==s._savedAt||",""],
 resurrect:["if(!intent&&!s.manualBalanceReads) return s;","if(!intent&&s.manualBalanceReads) return Object.assign({},s,{manualBalanceReads:Object.assign({},s.manualBalanceReads,{stateAt:at})});if(!intent&&!s.manualBalanceReads) return s;"],
 staleInverse:["const input=insumosSaldoGasto(s),rows=[]","const input={paidNetByBank:{},spentByBank:{},injTR:0,roundup:0,monthlyInvest:0},rows=[]"],
 preserveUnchanged:["if(Math.round(typed*100)===Math.round(shown*100)) return a;","if(Math.round(typed*100)===Math.round(shown*100)){rows.push({before:manualBalanceModel(a),next:Object.assign(manualBalanceModel(a),{origin:'manual-v1'}),typed:typed});return a;}"],
 snapshot:["manualBalanceSame(p,manualBalanceModel(a))","true"],
 manual:["return !!a&&!a.bankIban&&!a.bankUid&&a.balSaldo==null&&!a.balanceAt&&!saldoLoMandaPuenteNativo(s,a.ent);","return !!a;"],
 nativeWrite:["||a.bankIban||a.bankUid||a._obKey) return a;","||!manualBalanceIsManual(s,a)) return a;"],
 target:["if(![\"id\",\"ent\",\"role\",\"spendFrom\"].every(function(k){return r.expected[k]===target[k];})) return a;",""]
};
const mutant=process.env.RECIBOS_MANUAL_MUTANT||process.argv[2];
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
function harness(s=fixture()){
 const c=withOwnerStorage(loadPureLogic(html)),h={c,s,slots:[],cursor:0};
 c.Date=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 c.setStateRaw=fn=>{h.s=fn(h.s);};
 h.set=vm.runInContext('(function(){'+setter+'return set;})()',c);c.set=h.set;
 c.useEditable=vm.runInNewContext('('+editable+')',{useState(init){const i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof init==='function'?init():init;return[h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v;}];}});
 h.render=()=>{c.state=h.s;c.set=h.set;c.totals=c.insumosSaldoGasto(h.s);c.pn=a=>c.totals.paidNetByBank[a.ent]||0;c.spentOwn=a=>c.totals.spentByBank[a.ent]||0;c.ruM=c.totals.roundup;c.miM=c.totals.monthlyInvest;c.shownAcc=a=>c.saldoCuentaMostrada(a,c.totals);h.cursor=0;return vm.runInContext('(function(){'+writer+'return{save:guardarSaldoDe,editor:accEd};})()',c);};
 h.shown=(id='a')=>cents(c.saldoCuentaMostrada(h.s.accounts.find(a=>a.id===id),c.insumosSaldoGasto(h.s)));
 h.pause=(from=2026*12+10,until=from+1)=>{tick();h.set(s=>c.fixedPausa(s,'f',from,until));};
 h.read=(v=1000)=>{tick();h.render().save('a',v);assert.equal(h.shown(),cents(v));};
 h.legacy=v=>{let w=h.render();w.editor.start();w=h.render();w.editor.setDraft(d=>Object.assign({},d,{a:String(v)}));tick();h.render().editor.save();};
 return h;
}
function beforeDue(account={},receipt={}){clock('2026-10-01T12:00:00Z');const h=harness(fixture(account,receipt));h.read();clock('2026-10-18T12:00:00Z');return h;}
async function check(name,fn){await fn();count++;console.log('PASS '+name);}
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
await check('edición ajena invalida una vez, sin resurrección ni clonar cuentas',()=>{
 const h=beforeDue(),a=h.s.accounts,proof=h.s.manualBalanceReads;tick();h.set(s=>Object.assign({},s,{note:'edición ajena'}));assert.equal(h.s.accounts,a);assert.equal(h.s.manualBalanceReads,undefined);h.pause();assert.equal(h.shown(),98701);
 const old=beforeDue();old.s=Object.assign({},old.s,{_savedAt:now});assert.equal(old.c.manualBalanceRead(old.s,'a'),null);tick();old.set(s=>Object.assign({},s,{note:'otra'}));assert.equal(old.s.manualBalanceReads,undefined);assert.ok(proof);
});
await check('editor legacy real: lectura nueva, confirmación idéntica y filas conectadas',()=>{
 const h=beforeDue();clock('2026-10-10T12:00:00Z');h.legacy('1234,56');assert.equal(h.shown(),123456);assert.equal(h.s.accounts[0].saldoLeidoAt,new Date(now).toISOString());h.pause();assert.equal(h.shown(),123456);
 const same=beforeDue();same.legacy('987,01');assert.equal(same.s.manualBalanceReads,undefined);assert.equal(same.s.accounts[0].saldoLeidoAt,'2026-10-01T12:00:00.010Z');same.pause();assert.equal(same.shown(),98701);
 clock('2026-10-01T12:00:00Z');const linked=harness(fixture({bankUid:'SYNTHETIC',value:1000}));const account=linked.s.accounts[0];linked.legacy('2000');assert.equal(linked.s.accounts[0],account);assert.equal(account.saldoLeidoAt,undefined);
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
 clock('2026-10-04T22:30:00Z');const same=harness();same.read();clock('2026-10-18T12:00:00Z');same.pause();assert.equal(same.shown(),100000,'4/oct UTC ya es 5/oct Madrid: mismo día, no anterior');
 clock('2026-10-04T21:59:00Z');const earlier=harness();earlier.read();clock('2026-10-18T12:00:00Z');earlier.pause();assert.equal(earlier.shown(),100000,'todavía 4/oct Madrid: sí retira proyección');
 const beforeTZ=process.env.TZ;try{process.env.TZ='UTC';const other=beforeDue();clock('2026-10-04T22:30:00Z');other.pause();assert.equal(other.shown(),100000);assert.equal(other.s.manualBalanceReads,undefined,'días distintos: no conserva carry optimista');}finally{process.env.TZ=beforeTZ;}
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
