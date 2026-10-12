import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recta,resumen,discrimina,atribuciones} from '../e2e/lag-banco-metricas.mjs';
import {instalaSonda,inyectaFuga,retiraFuga} from '../e2e/lag-banco-sonda.mjs';
import {curvasSVG} from '../e2e/lag-banco-informe.mjs';

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
  h.p.restore();assert.equal(h.raf.size,0);assert.equal(h.document.visibilityState,'visible');
});
test('RAF32ms es delta real y el propio bucle de la sonda se cancela al restaurar',()=>{
  const h=environment();h.p.begin();
  for(const t of [0,16,60,76]){const [id,fn]=h.raf.entries().next().value;h.raf.delete(id);h.now.value=t;fn(t);}
  const out=h.p.end();assert.equal(out.frames,3);assert.equal(out.slowFrames,1);assert.equal(out.maxFrame,44);
  h.p.restore();assert.equal(h.raf.size,0);
});
test('fuga conocida retiene callbacks en el destino real y retirarla deja el destino limpio',()=>{
  const h=environment();const inject=new Function('window','performance',`(${inyectaFuga.toString()})('e2e/lag-banco-sonda.mjs:1');`);
  inject(h.window,{now:()=>++h.now.value});inject(h.window,{now:()=>++h.now.value});
  assert.equal(h.window.handlers.length,8);assert.equal(h.p.listeners.size,8);
  new Function('window',`(${retiraFuga.toString()})();`)(h.window);
  assert.equal(h.window.handlers.length,0);assert.equal(h.p.listeners.size,0);assert.equal(h.p.leaks.length,0);h.p.restore();
});
