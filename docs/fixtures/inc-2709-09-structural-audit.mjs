import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=process.argv[2];
const {scopeText}=await import(path.join(root,'scripts/beta-source-code.mjs'));
const shas=['067371705615e9cc58923509e3f60c3d0c9003ff','77b7d5e4d6188ec08c7aea0a598c741bb3025d13'];
const readAt=sha=>file=>execFileSync('git',['show',sha+':'+file],{cwd:root,encoding:'utf8',maxBuffer:8e6});
const sha256=s=>createHash('sha256').update(s).digest('hex');
const output={environment:'Node vm exact source fragments, synthetic arrays/EventTarget/timers; no React/browser/CSS/network, no human-frame claim',sourceSHAs:shas,recent:[],plan:[]};
for(const sha of shas){
 const read=readAt(sha),dash=read('src/modules/03-tab-dash.js');
 const recent=dash.match(/^  const recent=.*;$/m)[0];
 const fn=name=>scopeText({file:'src/modules/00-core.js',function:name},read);
 const helper=scopeText({file:'src/modules/01-i18n.js',function:'expenseDeletedSet'},read);
 const ctx=vm.createContext({WeakMap});
 vm.runInContext('const expenseDeletedSets=new WeakMap();'+helper+['keyOfExpenseLegacy','isManualExpenseSource','keyOfExpense','expenseIsTombstoned'].map(fn).join('\n'),ctx);
 const deletedSet=ctx.expenseDeletedSet,tombstone=ctx.expenseIsTombstoned;
 const nativeString=String;
 let stats={deletedSetCalls:0,tombstoneCalls:0,stringCalls:0};
 ctx.expenseDeletedSet=s=>{stats.deletedSetCalls++;return deletedSet(s);};
 ctx.expenseIsTombstoned=(e,d)=>{stats.tombstoneCalls++;return tombstone(e,d);};
 ctx.String=x=>{stats.stringCalls++;return nativeString(x);};
 vm.runInContext('function select(state){'+recent+' return recent;}',ctx);
 for(const n of [3000,5200]){
  const expenses=Array.from({length:n},(_,i)=>({id:'synthetic-'+i,date:new Date(Date.UTC(2026,8,26)-((i*7919)%n)*3600000).toISOString(),amount:1+i%9,merchant:'synthetic '+i,source:'manual'}));
  const state={expenses,deleted:[ctx.keyOfExpense(expenses[0]),ctx.keyOfExpenseLegacy(expenses[1])]};
  stats={deletedSetCalls:0,tombstoneCalls:0,stringCalls:0};
  const expected=ctx.select(state),once={...stats};
  const ids=expected.map(e=>e.id);
  for(let i=0;i<59;i++)assert.deepEqual(ctx.select(state).map(e=>e.id),ids);
  const sixty={...stats};
  let cached,prevExp,prevDeleted,calls=0;
  const selectOnce=s=>{if(s.expenses!==prevExp||s.deleted!==prevDeleted){cached=ctx.select(s);prevExp=s.expenses;prevDeleted=s.deleted;calls++;}return cached;};
  stats={deletedSetCalls:0,tombstoneCalls:0,stringCalls:0};
  for(let i=0;i<60;i++)assert.deepEqual(selectOnce(state).map(e=>e.id),ids);
  const cachedSixty={...stats};assert.equal(calls,1);
  // Negative controls: changed reference/deletion invalidates; no input sort/mutation.
  const before=expenses.map(e=>e.id);selectOnce({...state,expenses:expenses.slice()});assert.equal(calls,2);
  const changed={...state,deleted:state.deleted.concat(ctx.keyOfExpense(expected[0]))};
  assert.notDeepEqual(selectOnce(changed).map(e=>e.id),ids);assert.equal(calls,3);
  assert.deepEqual(expenses.map(e=>e.id),before);
  output.recent.push({sha,n,fragmentSHA256:sha256(recent),once,sixty,cachedSixty,virtualSelectorCalls:1,controls:'array-reference and tombstone-reference invalidation; exact output/row identity; input unchanged',durationClaim:false});
 }
 const source=read('src/modules/14-v4-screens.js');
 const start=source.indexOf('  useEffect(function(){\n    if(simple) return undefined;');
 const end=source.indexOf('  },[simple, seg]);',start)+'  },[simple, seg]);'.length;
 assert.ok(start>=0&&end>start);const effect=source.slice(start,end);
 const axis=fn('gestureAxis');
 const consts=read('src/modules/00-core.js').match(/^const GEST_(?:LEAD|MAX)=.*$/mg).join('\n');
 function world(code,y=0){
  const classes=new Set(),handlers={},page={scrollTop:y,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},el={style:{}},raf=new Map(),trace=[];
  let cleanup,now=0,seq=0,segChanges=0;
  const rootEl={closest(){return page;},addEventListener(k,f){handlers[k]=f;},removeEventListener(k){delete handlers[k];}};
  const c=vm.createContext({simple:false,seg:'recibos',planScreenRef:{current:rootEl},segElRef:{current:{recibos:el}},enterDirRef:{current:null},document:{documentElement:{classList:{contains(){return false;}}}},window:{innerHeight:700},navigator:{},Date:{now:()=>now},mcReduced:()=>true,
   useEffect(f){cleanup=f();},setSeg(){segChanges++;},setSegMounted(){},requestAnimationFrame(f){raf.set(++seq,f);return seq;},cancelAnimationFrame(id){raf.delete(id);},setTimeout(){return 1;}});
  vm.runInContext(consts+'\n'+axis+'\n'+code,c);
  const emit=(type,x,y)=>{now+=100;const e={touches:type==='touchend'||type==='touchcancel'?[]:[{clientX:x,clientY:y}],cancelable:true,stopPropagation(){},preventDefault(){}};handlers[type](e);trace.push({type,scrollTop:page.scrollTop,own:classes.has('mc-touch-own')});};
  return {emit,trace,page,classes,get segChanges(){return segChanges;},off(){cleanup();assert.equal(Object.keys(handlers).length,0);assert.equal(classes.size,0);}};
 }
 const run=code=>{const w=world(code);w.emit('touchstart',100,500);for(const y of [480,460,440,420])w.emit('touchmove',100,y);w.emit('touchend',100,420);w.off();return w.trace;};
 const original=run(effect);assert.deepEqual(original.filter(x=>x.type==='touchmove').map(x=>x.scrollTop),[20,20,20,20]);
 const virtual=effect.replace('if(pageEl.scrollTop>2) setOwn(false);','/* virtual: retain ownership through this gesture */');assert.notEqual(virtual,effect);
 const held=run(virtual);assert.deepEqual(held.filter(x=>x.type==='touchmove').map(x=>x.scrollTop),[20,40,60,80]);
 const outside=world(effect,40);outside.emit('touchstart',100,500);outside.emit('touchmove',100,460);assert.equal(outside.classes.size,0);outside.off();
 const cancelled=world(effect);cancelled.emit('touchstart',100,500);cancelled.emit('touchmove',100,540);cancelled.emit('touchcancel',100,540);assert.equal(cancelled.segChanges,0);cancelled.off();
 const horizontal=world(effect);horizontal.emit('touchstart',100,500);horizontal.emit('touchmove',160,502);assert.equal(horizontal.classes.size,0);horizontal.off();
 output.plan.push({sha,fragmentSHA256:sha256(effect),original,virtualHeldOwnership:held,controls:'outside-top leaves native path alone; horizontal yields; touchcancel makes no segment commit; cleanup removes listeners/classes',nativeScrollSimulated:false,touchActionSpecVerified:false,humanLagCauseVerified:false});
}
assert.equal(output.recent[0].fragmentSHA256,output.recent[2].fragmentSHA256);
assert.equal(output.plan[0].fragmentSHA256,output.plan[1].fragmentSHA256);
console.log(JSON.stringify(output,null,2));
