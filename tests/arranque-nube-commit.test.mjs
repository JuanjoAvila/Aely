import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {codeMask} from '../scripts/beta-source-code.mjs';
import {loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';
import {startupSummary,instrumentStartup} from '../e2e/helpers/arranque-nube-instrument.mjs';

const app=fs.readFileSync(new URL('../src/modules/11-app-main.js',import.meta.url),'utf8');
const dash=fs.readFileSync(new URL('../src/modules/03-tab-dash.js',import.meta.url),'utf8');
const base='f5904735b514751ee926d25c22c92195b6ce3653';
function block(source,token,from=0){
  const mask=codeMask(source),start=mask.indexOf(token,from),open=mask.indexOf('{',start);
  assert.ok(start>=0&&open>=0,token+' existe en producto');
  let depth=1,end=open+1;
  for(;depth&&end<mask.length;end++){if(mask[end]==='{')depth++;else if(mask[end]==='}')depth--;}
  assert.equal(depth,0);return source.slice(start,end)+';';
}
const paintSource=block(app,'const bootAfterPaint=function(');
const committedSource=block(app,'const bootPaintCommitted=function(');
assert.ok(app.includes('useLayoutEffect(bootPaintCommitted,[bootPaint]);'),'los frames nacen del commit real de React');
const cleanupSource=block(app,'function(){',app.indexOf('  useEffect(function(){',app.indexOf('const bootAfterPaint=function(')));
function paintWorld(source=paintSource){
  const frames=new Map(),window={},ref={current:{live:true,frame:0}},events=[];let id=0;
  let commit=()=>{},onReady=()=>{},pending=false;
  const env={bootPaintRef:ref,window,requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},
    bootPaint:false,setBootPaint:()=>{pending=true;},cancelAnimationFrame:n=>frames.delete(n),
    mcBootReady:()=>{events.push('ready');window.__mcBootReady=true;onReady();}};
  const names=Object.keys(env),make=new Function(...names,source+'return bootAfterPaint;');
  const helper=make(...names.map(n=>env[n]));
  const committed=new Function(...names,committedSource+'return bootPaintCommitted;');
  const cleanup=new Function('bootPaintRef','cancelAnimationFrame','return ('+cleanupSource.slice(0,-1)+')();')(ref,env.cancelAnimationFrame);
  return {env,frames,events,helper,cleanup,setCommit:fn=>{commit=fn;},setReady:fn=>{onReady=fn;},
    commit(){if(!pending||env.bootPaint)return;pending=false;commit();events.push('commit');env.bootPaint=true;committed(...names.map(n=>env[n]))();},
    frame(){const callbacks=[...frames.values()];frames.clear();for(const fn of callbacks)fn();}};
}
{
  const w=paintWorld();let committed=false;
  w.setCommit(()=>{committed=true;});w.setReady(()=>assert.equal(committed,true));
  w.helper();assert.deepEqual(w.events,[]);w.frame();assert.deepEqual(w.events,[],'sin commit no se programa un frame');
  w.commit();w.frame();assert.deepEqual(w.events,['commit']);
  w.frame();assert.deepEqual(w.events,['commit','ready']);w.helper();assert.equal(w.frames.size,0);
}
for(const completedFrames of [0,1]){
  const w=paintWorld();w.helper();w.commit();if(completedFrames)w.frame();
  const late=[...w.frames.values()];w.cleanup();assert.equal(w.frames.size,0);
  for(const fn of late)fn();assert.equal(w.events.includes('ready'),false,'callback conservado tras cleanup no marca listo');
  assert.equal(w.frames.size,0,'tampoco deja un segundo frame vivo');
}
{
  const w=paintWorld();w.helper();w.helper();assert.equal(w.frames.size,0);w.commit();assert.equal(w.frames.size,1);
  w.frame();w.frame();assert.deepEqual(w.events,['commit','ready'],'una sola barrera aunque dos pulls terminen en el mismo tick');
}
{
  const mutant=paintSource.replace('setBootPaint(true);','mcBootReady();');
  assert.notEqual(mutant,paintSource);const w=paintWorld(mutant);let committed=false;
  w.setCommit(()=>{committed=true;});w.setReady(()=>assert.equal(committed,true));
  assert.throws(()=>w.helper(),assert.AssertionError,'marcar ready desde la Promise vuelve a saltarse el commit');
}

const ticks=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function transport(source){
  const c=loadPureLogicFromFile(),w=paintWorld(),stateRead=deferred(),expensesRead=deferred(),updates=[];
  let state={accounts:[],investments:[],assets:[],debts:[],fixed:[],expenses:[],budget:1},readyState;
  const identity=x=>x;
  const env={cloud:{pullState:()=>stateRead.promise,pushState:()=>Promise.resolve({})},
    set:fn=>updates.push(fn),stateRef:{current:state},sessionRef:{current:{user:{id:'synthetic'}}},
    cloudUpdatedAtRef:{current:null},pullOkRef:{current:null},
    reservaMensualPuerta:()=>({lee:()=>{},vale:ok=>ok}),applyReservaMensual:s=>({...s,monthlySettled:true}),
    mergeExpenses:(a,b)=>({list:a.concat(b)}),mergeAccountBalanceHistory:identity,fusionarGemelos:identity,
    seedFlows:identity,fixMovInvasion:identity,fixRevoDupes:identity,fixInvAuto:identity,fixInvSold:identity,reconcileTR:identity,reconcileEarlyIncomeAnchors:identity,
    syncCloudExpenses:()=>expensesRead.promise.then(()=>{env.set(s=>({...s,expenses:[{id:'cloud-final',amount:1.37}]}));}),
    showToast:()=>{},slimForCloud:identity,navigator:{onLine:true},bootAfterPaint:w.helper,
    mcBootReady:()=>{w.env.mcBootReady();}};
  const names=Object.keys(env),factory=vm.runInContext('(function('+names.join(',')+'){'+
    block(source,'const reservaMensualAlDia=function(')+block(source,'const syncFromCloud=function(')+'return syncFromCloud;})',c);
  const sync=factory(...names.map(n=>env[n]));
  w.setCommit(()=>{for(const fn of updates.splice(0))state=fn(state);env.stateRef.current=state;});
  w.setReady(()=>{readyState=state;});sync({user:{id:'synthetic'}});
  return {w,stateRead,expensesRead,ready:()=>readyState,state:()=>state};
}
function definitive(s){assert.equal(s.budget,2500);assert.equal(s.expenses.length,1);assert.equal(s.monthlySettled,true);}
for(const failure of [false,true]){
  const t=transport(app);assert.equal(t.ready(),undefined);
  t.stateRead.resolve({data:{accounts:[],investments:[],assets:[],debts:[],fixed:[],expenses:[],budget:2500,_savedAt:99}});await ticks();
  assert.equal(t.ready(),undefined,'estado sin gastos todavía no está listo');
  if(failure)t.expensesRead.reject(Error('synthetic network'));else t.expensesRead.resolve();await ticks();
  assert.equal(t.ready(),undefined,'terminar promesas tampoco acredita commit');
  t.w.frame();assert.equal(t.ready(),undefined,'no hay frames vivos antes del commit');t.w.commit();
  t.w.frame();assert.equal(t.ready(),undefined);t.w.frame();assert.ok(t.ready());
  if(!failure)definitive(t.ready());else assert.equal(t.ready().monthlySettled,undefined,'un pull fallido no acredita asiento');
}
const original=execFileSync('git',['show',base+':src/modules/11-app-main.js'],{encoding:'utf8',maxBuffer:3e6});
{
  const site='const asentado=reservaMensualAlDia(pullOkRef.current.then(mensualPuerta.vale));';
  assert.equal(app.split(site).length,2,'el mutante del asiento toca un sitio real y único');
  const t=transport(app.replace(site,'const asentado=Promise.resolve();'));
  t.stateRead.resolve({data:{accounts:[],investments:[],debts:[],fixed:[],expenses:[],budget:2500,_savedAt:99}});
  await ticks();t.expensesRead.resolve();await ticks();t.w.commit();t.w.frame();t.w.frame();
  assert.equal(t.ready().budget,2500);assert.equal(t.ready().expenses.length,1);
  assert.throws(()=>definitive(t.ready()),assert.AssertionError,'sin asiento se mata el mutante por estado, no por identificador ausente');
}
{
  const t=transport(original);t.stateRead.resolve({data:{accounts:[],investments:[],debts:[],fixed:[],expenses:[],budget:2500}});
  await ticks();t.expensesRead.resolve();await ticks();
  assert.ok(t.ready(),'la base emite ready antes de entregar un frame');
  assert.throws(()=>definitive(t.ready()),assert.AssertionError,'la base falla el oráculo de estado aplicado al marcar ready');
}

// Hook real, incluido su vector: el reloj y el renderer son doubles, no evidencia DOM/FPS.
const seriesStart=dash.indexOf('  const series=useMemo(function()'),seriesEnd=dash.indexOf('\n',dash.indexOf(']);',seriesStart));
const seriesCode=dash.slice(seriesStart,seriesEnd),logic=new Function('useMemo','netWorthSeries','state','tt','seriesToday','seriesReady',seriesCode+'return series;');
let cachedDeps,cachedResult,calculations=0;
const memo=(fn,deps)=>{if(cachedDeps&&deps.every((v,i)=>v===cachedDeps[i]))return cachedResult;cachedDeps=deps;return cachedResult=fn();};
const calc=()=>{calculations++;return [{value:17}];},state={accounts:[],expenses:[],settings:{}},tt={liquid:17};
assert.deepEqual(logic(memo,calc,state,tt,'2026-10-13',false),[]);
const newer={...state,expenses:[{id:'new'}]};logic(memo,calc,newer,tt,'2026-10-13',false);assert.equal(calculations,0);
logic(memo,calc,newer,tt,'2026-10-13',true);logic(memo,calc,newer,tt,'2026-10-13',true);assert.equal(calculations,1);
assert.deepEqual(cachedDeps.slice(0,-1).length,20,'se conservan las veinte dependencias previas');
const priorDash=execFileSync('git',['show',base+':src/modules/03-tab-dash.js'],{encoding:'utf8',maxBuffer:2e6});
const priorStart=priorDash.indexOf('  const series=useMemo(function()'),priorEnd=priorDash.indexOf('\n',priorDash.indexOf(']);',priorStart));
const previous=new Function('useMemo','netWorthSeries','state','tt','seriesToday',priorDash.slice(priorStart,priorEnd)+'return series;');
let priorDeps,priorCalls=0;
const previousMemo=(fn,deps)=>{priorDeps=deps;return fn();};
previous(previousMemo,()=>{priorCalls++;return [];},newer,tt,'2026-10-13');
assert.deepEqual(cachedDeps.slice(0,-1),priorDeps,'cada referencia financiera previa se conserva exactamente');
assert.equal(priorCalls,1,'la base calcula la serie antes de acreditar la nube, aunque nadie la vea');
const shell=fs.readFileSync(new URL('../src/shell.html',import.meta.url),'utf8');
assert.ok(shell.includes('MINIMO=520, ESPERA_NUBE=1800, TOPE_DURO=8000'),'los topes de entrada no se amplían');
assert.throws(()=>startupSummary({start:null,end:null}),/incomplete/,'sin ventana no se inventan métricas');
assert.throws(()=>startupSummary({start:0,end:3000,frames:[],calls:[]}),/missing/,'tiempo sin RAF no acredita frames');
const metric=startupSummary({loadedAt:0,start:100,end:3100,frames:[{delta:16.7},{delta:32.01},{delta:50}],calls:[],bankCalls:0,liveTabs:4});
assert.equal(metric.slowFrames,2);assert.equal(metric.elapsedMs,3000);assert.equal(metric.maxFrame,50);
assert.throws(()=>instrumentStartup('sin marcador'),/anchor/);
console.log('arranque-nube-commit: barrera real, cleanup, pull/asiento, rojo base y memo0→1 OK; no DOM ni FPS');
