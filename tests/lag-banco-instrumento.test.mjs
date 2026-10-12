import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recta,resumen,discrimina,atribuciones} from '../e2e/lag-banco-metricas.mjs';
import {instalaSonda,inyectaFuga,retiraFuga} from '../e2e/lag-banco-sonda.mjs';
import {curvasSVG,ultimaMuestra} from '../e2e/lag-banco-informe.mjs';
import {preparaTransporte,recorrido,syntheticAck,planScroll,validaScroll,liberaDedo,contextoScroll,scroll} from '../e2e/lag-banco-recorrido.mjs';
import {loadPureLogic} from '../scripts/load-pure-logic.mjs';
import {instalaRetorno,instrumentaTotales,instrumentaArranque,bloqueoPorCausa,ventanaCruda} from '../e2e/lag-banco-retorno.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sample=(i,extra={})=>({valid:true,elapsedMs:30000,measuredMinute:i/2,slowFrames:3,
  slowFramesPerMinute:6,storageBytes:100,domNodes:100,listeners:40,timeouts:0,intervals:1,
  heapAfterGC:100000,retainedSources:[],...extra});

test('tasas ponderadas por tiempo real, no media de tasas ni minutos simulados',()=>{
  const out=resumen([sample(0,{elapsedMs:1000,slowFrames:1}),sample(1,{elapsedMs:9000,slowFrames:9}),sample(2,{valid:false,slowFrames:999})]);
  assert.equal(out.slowFramesPerMinute,60);assert.equal(out.measuredMs,10000);assert.equal(out.rejected,1);
  assert.equal(out.storageBytes,200);assert.equal(out.curves.listeners.length,2);
});
test('pendiente distingue crecimiento lineal, dientes de sierra y falta de puntos',()=>{
  assert.equal(recta([{x:0,y:2},{x:1,y:4},{x:2,y:6}]).slope,2);
  assert.equal(recta([{x:0,y:2},{x:1,y:6},{x:2,y:2}]).slope,0);
  assert.equal(recta([{x:0,y:2},{x:1,y:4}]).slope,null);
});
test('el control tiene que acumular listeners y heap retenido y permitir recuperación',()=>{
  const normal=[0,1,2,3].map(i=>sample(i));
  const leak=[0,1,2,3].map(i=>sample(i,{listeners:44+4*i,heapAfterGC:200000+50000*i}));
  const recovered=[0,1,2].map(i=>sample(i));
  assert.equal(discrimina(normal,leak,recovered).passed,true);
  assert.equal(discrimina(normal,normal,recovered).passed,false,'quitar la fuga no puede dar GO instrumental');
  assert.equal(discrimina(normal,leak,leak).passed,false,'una fuga sin desmontar no recupera');
  assert.equal(discrimina(normal,leak.map(s=>({...s,heapAfterGC:100000})),recovered).passed,false);
});
test('atribución enumera sólo registros retenidos crecientes, por origen',()=>{
  const out=atribuciones([sample(0,{retainedSources:[{source:'src/a.js:2',count:2},{source:'src/b.js:3',count:4}]}),
    sample(1,{retainedSources:[{source:'src/a.js:2',count:5},{source:'src/b.js:3',count:2},{source:'src/c.js:4',count:1}]})]);
  assert.deepEqual(out,[{source:'src/a.js:2',delta:3},{source:'src/c.js:4',delta:1}]);
});
test('figura no inventa observaciones para campañas incompletas y distingue smoke de campaña larga',()=>{
  const svg=curvasSVG({size:2000,phase:'warmup',full:false,sourceSHA:'<&',normal:[]});
  assert.ok(svg.includes('INCOMPLETO'));assert.ok(svg.includes('SMOKE'));assert.ok(svg.includes('Sin observaciones'));
  assert.ok(svg.includes('&lt;&amp;'));assert.equal((svg.match(/<polyline/g)||[]).length,0);
});

function environment(){
  class Target{constructor(){this.handlers=[];}addEventListener(type,fn,opts){const cap=typeof opts==='boolean'?opts:!!opts?.capture;if(!this.handlers.some(h=>h.type===type&&h.fn===fn&&h.cap===cap))this.handlers.push({type,fn,cap});}
    removeEventListener(type,fn,opts){const cap=typeof opts==='boolean'?opts:!!opts?.capture;this.handlers=this.handlers.filter(h=>!(h.type===type&&h.fn===fn&&h.cap===cap));}}
  class Storage{setItem(k,v){this.value=String(v);}}
  const window=new Target(),document=new Target(),live=new Map(),raf=new Map();let id=0;
  window.setTimeout=window.setInterval=(fn,ms,...args)=>{live.set(++id,{fn,args});return id;};
  window.clearTimeout=window.clearInterval=id=>live.delete(id);
  window.requestAnimationFrame=fn=>{raf.set(++id,fn);return id;};window.cancelAnimationFrame=id=>raf.delete(id);
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
  const now={value:0};
  const install=new Function('window','document','EventTarget','Storage','performance','WeakRef',`(${instalaSonda.toString()})();`);
  install(window,document,Target,Storage,{now:()=>now.value},WeakRef);
  return {window,document,live,raf,now,Target,Storage,p:window.__lagBanco};
}
test('sonda conserva identidad, capture y argumentos; timeout vencido y cancelado dejan de estar vivos',()=>{
  const h=environment();let value=0;const fn=n=>{value+=n;};
  const a=h.window.setTimeout(fn,10,4),b=h.window.setTimeout(fn,10,9);
  assert.equal(h.p.snapshot().timeouts,2);h.window.clearInterval(b);
  const scheduled=h.live.get(a);scheduled.fn(...scheduled.args);assert.equal(value,4);assert.equal(h.p.snapshot().timeouts,0);
  h.window.addEventListener('focus',fn,false);h.window.addEventListener('focus',fn,false);h.window.addEventListener('focus',fn,true);
  assert.equal(h.p.listeners.size,2);h.window.removeEventListener('focus',fn,false);assert.equal(h.p.listeners.size,1);
  h.window.removeEventListener('focus',fn,true);assert.equal(h.p.listeners.size,0);
  new h.Storage().setItem('micartera_v3_exp','😀');assert.equal(h.p.snapshot().storageBytes,4);
  let disconnected=0;h.p.observers.add({disconnect(){disconnected++;}});
  h.p.restore();assert.equal(h.raf.size,0);assert.equal(h.document.visibilityState,'visible');
  assert.equal(disconnected,1);assert.equal(h.p.observers.size,0);
});
test('RAF32ms es delta real y el propio bucle de la sonda se cancela al restaurar',()=>{
  const h=environment();h.p.begin();
  for(const t of [0,16,60,76]){const [id,fn]=h.raf.entries().next().value;h.raf.delete(id);h.now.value=t;fn(t);}
  const out=h.p.end();assert.equal(out.frames,3);assert.equal(out.slowFrames,1);assert.equal(out.maxFrame,44);
  h.p.restore();assert.equal(h.raf.size,0);
});
test('el primer frame conserva el bloqueo justo después de retirar el splash',()=>{
  const h=environment();h.now.value=10;h.p.begin();
  const [id,fn]=h.raf.entries().next().value;h.raf.delete(id);h.now.value=90;fn(90);
  const out=h.p.end();assert.equal(out.slowFrames,1);assert.equal(out.maxFrame,80);h.p.restore();
});
test('fuga conocida retiene callbacks en el destino real y retirarla deja el destino limpio',()=>{
  const h=environment();const inject=new Function('window','performance',`(${inyectaFuga.toString()})('e2e/lag-banco-sonda.mjs:1');`);
  inject(h.window,{now:()=>++h.now.value});inject(h.window,{now:()=>++h.now.value});
  assert.equal(h.window.handlers.length,8);assert.equal(h.p.listeners.size,8);
  new Function('window',`(${retiraFuga.toString()})();`)(h.window);
  assert.equal(h.window.handlers.length,0);assert.equal(h.p.listeners.size,0);assert.equal(h.p.leaks.length,0);h.p.restore();
});
test('observación del pull espera la promesa verdadera, conserva argumentos y no retiene sus filas',async()=>{
  let resolve;const rows=[{id:'synthetic-row'}],proof={};
  const window={__lagBanco:{transport:{},bankSync:0}};
  const cloud={pullExpenses(arg){assert.equal(this,cloud);assert.equal(arg,proof);arg.valid=true;return new Promise(r=>{resolve=r;});},bankSync:async()=>({ok:true})};
  const original=cloud.pullExpenses;
  const page={evaluate:fn=>new Function('window','cloud',`return (${fn.toString()})();`)(window,cloud)};
  await preparaTransporte(page);const pull=cloud.pullExpenses(proof);let ended=false;
  window.__lagBanco.lastPull.then(()=>{ended=true;});await Promise.resolve();assert.equal(ended,false);
  resolve(rows);assert.equal(await pull,rows);assert.equal(await window.__lagBanco.lastPull,undefined);
  assert.equal(window.__lagBanco.transport.pullExpenses.succeeded,1);assert.equal(proof.valid,true);
  window.__lagBanco.restoreTransport();assert.equal(cloud.pullExpenses,original);
});

test('atribución de bloqueo intersecta ventanas y no duplica trabajo anidado ni tiempo de red',()=>{
  const out=bloqueoPorCausa([{start:10,duration:100}],[{kind:'timer',start:0,duration:120,depth:0},
    {kind:'totals',start:20,duration:50,depth:1},{kind:'serialize',start:40,duration:10,depth:2},
    {kind:'pull-async',start:0,duration:1000,async:true}]);
  assert.deepEqual(out,{timer:50,totals:40,serialize:10});assert.equal(Object.values(out).reduce((a,b)=>a+b,0),100);
  assert.deepEqual(bloqueoPorCausa([{start:0,duration:80}],[]),{unattributed:80});
});
test('calendario desplazado conserva Date con argumentos, scheduler y RAF; wrapper conserva promesa y receptor',async()=>{
  const h=environment();h.window.Date=Date;const nativeRAF=h.window.requestAnimationFrame,nativeTimeout=h.window.setTimeout;
  const json={stringify:JSON.stringify};let resolve;const rows=[{id:'synthetic'}],argument={};
  const cloud={pullExpenses(value){assert.equal(this,cloud);assert.equal(value,argument);return new Promise(r=>{resolve=r;});}};
  class Observer{observe(){}disconnect(){this.disconnected=true;}takeRecords(){return [];}}
  const install=new Function('window','document','PerformanceObserver','JSON','cloud','performance',`(${instalaRetorno.toString()})({epoch:100000});`);
  install(h.window,h.document,Observer,json,cloud,{now:()=>h.now.value});
  const Clock=h.window.Date;const before=Clock.now();h.p.advanceCalendar(4*3600000);
  assert.ok(Math.abs(Clock.now()-before-4*3600000)<100);
  assert.equal(new Clock('2026-09-26T12:00:00Z').getTime(),Date.parse('2026-09-26T12:00:00Z'));
  assert.equal(Clock.parse('2026-01-01'),Date.parse('2026-01-01'));assert.equal(Clock.UTC(2026,0,1),Date.UTC(2026,0,1));
  assert.ok(new Clock() instanceof Date);assert.equal(typeof Clock(),'string');
  assert.equal(h.window.requestAnimationFrame,nativeRAF);assert.equal(h.window.setTimeout,nativeTimeout);
  const original=cloud.pullExpenses;h.p.installCauses();h.p.begin();const work=cloud.pullExpenses(argument);
  resolve(rows);assert.equal(await work,rows);assert.ok(h.p.events.some(e=>e.kind==='pullExpenses-async'));
  h.p.armWindow(5000);assert.equal(h.p.snapshot().timeouts,0,'el deadline del instrumento no es timer de la app');
  const scheduled=[...h.live.values()].at(-1);h.now.value=5000;scheduled.fn();
  const metric=await h.p.windowDone;assert.equal(metric.elapsedMs,5000);assert.equal(metric.events.length,0);
  h.p.restoreCauses();assert.equal(cloud.pullExpenses,original);h.p.restoreForeground();assert.equal(h.window.Date,Date);h.p.restore();
});
test('instrumentación usa anclas únicas de la fuente real y conserva sintaxis, líneas y mínimo del splash',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),main=readFileSync(new URL('../src/modules/11-app-main.js',import.meta.url),'utf8');
  const changed=instrumentaArranque(instrumentaTotales(html,main));
  assert.equal(changed.split('\n').length,html.split('\n').length);assert.ok(changed.includes('MINIMO=520'));
  assert.ok(changed.includes("measureSync('totals'"));assert.ok(changed.includes('window.__lagBanco.installCauses();ReactDOM.createRoot'));
  for(const match of changed.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1].trim())new vm.Script(match[1]);
  assert.throws(()=>instrumentaTotales(html+html,main),/ambigua/);assert.throws(()=>instrumentaArranque(''),/ausente/);
});
test('fixture119 devuelve el acuse sin cambiar volumen ni las filas del pull',()=>{
  for(const n of [2000,20000]){const f=recorrido.fixture(n);assert.equal(f.expenses.length,n);assert.equal(f.__cloudRows.expenses.length,n);
    assert.equal(f.__cloudFns['bank-sync'].data.links[0].ack,syntheticAck);assert.equal(f.fixed.length,6);
    assert.deepEqual(f.fixed.map(x=>x.day),[10,10,10,28,28,28]);}
});
test('hook de totales parseado y ejecutado conserva resultado financiero, dependencias y un cálculo por llamada',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),main=readFileSync(new URL('../src/modules/11-app-main.js',import.meta.url),'utf8');
  const ctx=loadPureLogic(html),record=[];
  ctx.state={accounts:[{id:'e2e',ent:'sabadell',role:'diario',value:1000}],assets:[{value:400}],budget:500,fx:0.92,settings:{},trAnchor:'2026-09'};
  for(const k of ['expenses','bankTx','investments','debts','fixed','flows','oneoffs','deleted','aportaciones','obAccounts'])ctx.state[k]=[];
  ctx.calendarDay='2026-09-26';ctx.window.__lagBanco={measureSync(kind,fn){record.push(kind);return fn();}};
  const end='state.trRewardsTotal,state.fx,state.fxRates,calendarDay]);';
  function execute(source){const start=source.indexOf('const totals=useMemo('),stop=source.indexOf(end,start)+end.length;
    return vm.runInContext('(()=>{const useMemo=(fn,deps)=>{globalThis._lagDeps=deps;return fn();};'+source.slice(start,stop)+';return totals;})()',ctx);}
  const before=execute(main),deps=Array.from(ctx._lagDeps);
  const after=execute(instrumentaTotales(html,main));
  assert.deepEqual(JSON.parse(JSON.stringify(after)),JSON.parse(JSON.stringify(before)));assert.equal(after.netWorth,1400);
  assert.deepEqual(Array.from(ctx._lagDeps),deps);assert.equal(deps.length,16);assert.deepEqual(record,['totals']);
});

test('emisor conserva warmup objeto, última fase y fallo original sin invocar at sobre objetos',()=>{
  const warmup={valid:false,failure:{code:'scroll-no-land'},inertia:[{before:{max:100}}]};
  const report={phase:'warmup',warmup,normal:[],leak:[],recovered:[]};
  assert.equal(ultimaMuestra(report),warmup);
  const decoded=JSON.parse(JSON.stringify({...report,last:ultimaMuestra(report)}));assert.deepEqual(decoded.last,warmup);
  assert.equal(ultimaMuestra({...report,phase:'normal',normal:[warmup]}),warmup);
  for(const phase of ['complete','validating','normal','failure'])assert.equal(ultimaMuestra({...report,phase,failure:{message:'primary'}}),null);
});
test('gesto inválido conserva toda la ventana pendiente y una ventana ausente no fabrica cifras',async()=>{
  let resolve;const window={__lagBanco:{windowDone:new Promise(r=>{resolve=r;}),finishWindow(){throw new Error('premature');}}};
  const page={evaluate:fn=>new Function('window',`return (${fn.toString()})();`)(window)};
  let finished=false;const work=ventanaCruda(page);work.then(()=>{finished=true;});await Promise.resolve();assert.equal(finished,false);
  const metric={elapsedMs:5000,frames:240};resolve(metric);assert.equal(await work,metric);
  delete window.__lagBanco.windowDone;assert.equal(await ventanaCruda(page),null);
});
test('stroke reserva recorrido para el fling; falta de sitio y objetivo ausente se rechazan',()=>{
  const context={top:0,max:480,point:{x:187,y:500}};
  const p=planScroll(context,true);assert.equal(p.travel,96);assert.ok(p.room-p.travel>=p.travel*2);
  assert.equal(planScroll({...context,top:180},false).travel,60);
  assert.throws(()=>planScroll({...context,max:119},true),/insufficient-room/);
  assert.throws(()=>planScroll({...context,point:null},true),/target-not-visible/);
  assert.throws(()=>planScroll({...context,error:'scroll-active-page-missing'},true),/active-page-missing/);
});
test('oráculo físico exige desplazamiento, liberación finita, inercia en dirección correcta y barra oculta',()=>{
  const r={down:true,before:{top:0},release:{top:80},after:{top:130,connected:true,hidden:true}};
  assert.deepEqual(validaScroll(r),{delta:130,inertia:50});
  assert.throws(()=>validaScroll({...r,release:{top:null}}),/release-unavailable/);
  assert.throws(()=>validaScroll({...r,after:{...r.after,connected:false}}),/page-detached/);
  assert.throws(()=>validaScroll({...r,after:{...r.after,top:19}}),/no-land/);
  assert.throws(()=>validaScroll({...r,after:{...r.after,top:81}}),/without-inertia/);
  assert.throws(()=>validaScroll({...r,after:{...r.after,top:70}}),/without-inertia/);
  assert.throws(()=>validaScroll({...r,after:{...r.after,hidden:false}}),/navigation-visible/);
  assert.deepEqual(validaScroll({down:false,before:{top:200},release:{top:150},after:{top:100,connected:true}}),{delta:100,inertia:50});
});
test('lectura posterior requiere ACK del touchEnd; excepción de lectura no se acepta',async()=>{
  const calls=[],resolve=[];const cdp={send(name){calls.push(name);return new Promise(r=>resolve.push(r));}};
  const work=liberaDedo(cdp);assert.deepEqual(calls,['Input.dispatchTouchEvent']);
  resolve[0]({});await Promise.resolve();assert.deepEqual(calls,['Input.dispatchTouchEvent','Runtime.evaluate']);
  resolve[1]({});await work;
  await assert.rejects(liberaDedo({send:async name=>name==='Runtime.evaluate'?{exceptionDetails:{text:'failure'}}:{}}),/evaluation-failed/);
});
test('crudos de Gastos no se reinterpretan como falta de inercia ni se aceptan con la barra visible',()=>{
  for(const after of [123,126,127]){
    const r={down:true,before:{top:0},release:{top:81},after:{top:after,connected:true,hidden:false}};
    assert.throws(()=>validaScroll(r),/navigation-visible/);
    assert.deepEqual(validaScroll({...r,after:{...r.after,hidden:true}}),{delta:after,inertia:after-81});
  }
  assert.throws(()=>planScroll({tab:'inicio',top:0,max:637,point:{x:197,y:406}},true,'gastos'),/active-tab-mismatch/);
});
test('un último paso pendiente sin inercia no es movimiento post-ACK; control positivo separado',async()=>{
  async function scenario(momentum){
    const host={scrollTop:65,isConnected:true},window={__lagBanco:{scrollTarget:new WeakRef(host)}};
    const cdp={send:async(name,args)=>{
      if(name==='Input.dispatchTouchEvent'){host.scrollTop=81;return {};}
      new Function('window','performance',args.expression)(window,{now:()=>123});return {};
    }};
    await liberaDedo(cdp);host.scrollTop+=momentum;
    return {down:true,before:{top:0},release:window.__lagBanco.physicalRelease,after:{top:host.scrollTop,connected:true,hidden:true}};
  }
  const bad=await scenario(0);assert.equal(bad.release.top,81);assert.equal(bad.release.boundary,'after-touchEnd-ack');
  assert.throws(()=>validaScroll(bad),/without-inertia/);
  assert.deepEqual(validaScroll(await scenario(42)),{delta:123,inertia:42});
});

function scrollEnvironment(){
  const classes=names=>({contains:name=>names.includes(name)});
  const host={scrollTop:0,scrollHeight:1200,clientHeight:800,clientWidth:375,scrollWidth:375,isConnected:true,
    classList:classes([]),getBoundingClientRect:()=>({left:0,right:375,top:0,bottom:800}),contains:el=>el===target};
  const target={tagName:'DIV',className:'v4-section',parentElement:host,clientWidth:100,scrollWidth:100,closest:()=>null};
  const tabs=[{classList:classes([]),dataset:{tour:'inicio'}},{classList:classes(['active']),dataset:{tour:'gastos'}}];
  const document={querySelectorAll:selector=>selector==='.botnav-tab'?tabs:[{},host],elementFromPoint:()=>target,
    documentElement:{classList:classes([])},querySelector:()=>({classList:classes(['botnav-hidden'])})};
  const p={landings:[],measureSync:(_kind,fn)=>fn()},window={__lagBanco:p,innerWidth:375,innerHeight:812};
  const style=()=>({touchAction:'pan-y',overflowX:'visible'});
  const evaluate=(fn,arg)=>new Function('window','document','getComputedStyle','arg','performance',`return (${fn.toString()})(arg);`)(window,document,style,arg,{now:()=>123});
  return {host,tabs,document,p,window,evaluate};
}
test('contexto usa la página activa durante el tránsito sin depender de un host todavía ausente',()=>{
  const h=scrollEnvironment(),c=h.evaluate(contextoScroll,true);
  assert.equal(c.tab,'gastos');assert.equal(c.host,false);assert.equal(c.max,400);assert.ok(c.point);
  assert.equal(h.p.scrollTarget.deref(),h.host);
  h.tabs[1].classList={contains:()=>false};assert.equal(h.evaluate(contextoScroll,true).error,'scroll-active-page-missing');
});
test('fling ausente deja el contexto y las lecturas crudas antes de propagar el fallo original',async()=>{
  const h=scrollEnvironment(),cdp={send:async(name,args)=>{
    if(name==='Input.dispatchTouchEvent'&&args.type==='touchMove')h.host.scrollTop+=15;
    if(name==='Runtime.evaluate')new Function('window','performance',args.expression)(h.window,{now:()=>123});
    return {};}};
  let error;try{await scroll({evaluate:async(fn,arg)=>h.evaluate(fn,arg)},cdp,true);}catch(e){error=e;}
  assert.match(error.message,/scroll-without-inertia/);assert.equal(h.p.landings.length,1);
  assert.equal(error.scrollRecord,h.p.landings[0]);assert.equal(error.scrollRecord.valid,false);
  assert.equal(error.scrollRecord.release.top,90);assert.equal(error.scrollRecord.after.top,90);
  assert.ok(error.scrollRecord.before.point);assert.equal(h.p.scrollTarget,null);
});
