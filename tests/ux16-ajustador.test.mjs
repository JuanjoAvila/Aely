import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
// UX16 ronda 4: el ajustador de vibración guarda en este móvil y TODA la vibración lo obedece.
const source=fs.readFileSync(new URL('../src/modules/02-ui-shared.js',import.meta.url),'utf8');
const block=source.slice(source.indexOf('function mcReduced(){'),source.indexOf('/* Count-up compartido'));
function setup(stored){
  const calls=[],store=new Map(),css={};
  if(stored!==undefined)store.set('_mcHapticTune',stored);
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const document={hidden:false,documentElement:{classList:{contains:()=>false},style:{setProperty:(k,v)=>{css[k]=v;}}},getElementById:()=>null};
  const record=method=>p=>{calls.push({method,...p});return Promise.resolve({tunable:true});};
  const window={__mcSplashGone:true,matchMedia:()=>({matches:false}),Capacitor:{Plugins:{AelyHaptics:{fill:record('fill'),edge:record('edge')}}}};
  const context={document,window,localStorage,performance:{now:()=>0},Promise,WeakSet,WeakMap,Number,Math,JSON,Object,getComputedStyle:()=>({}),console};
  vm.createContext(context);vm.runInContext(block,context);
  return {context,calls,store,css};
}
function ringEvent(pct,duration=1100){
  const animation={animationName:'v42-cycle-draw',playState:'running',effect:{getComputedTiming:()=>({duration})}};
  const el={style:{getPropertyValue:k=>k==='--cycle-pct'?String(pct):''},matches:s=>s==='.v42-cycle-draw',
    closest:()=>({classList:{contains:()=>true}}),getAnimations:()=>[animation]};
  return {target:el,animationName:'v42-cycle-draw',elapsedTime:0};
}
test('valores por defecto: los de la ronda 3 y algo mas de fuerza en borde y grafica',()=>{
  const x=setup();const v=x.context.mcHapticTune();
  assert.equal(v.fillAmp,40,"ronda 7: el anillo, suave por defecto");assert.equal(v.fillMs,1100);assert.equal(v.edgeEvery,150);
  assert.ok(v.edgeAmp>30&&v.tickAmp>30,'borde y grafica por encima del 30 de la ronda 3');
  assert.equal(x.css['--v42-cycle-ms'],'1100ms','el anillo arranca con la duracion de siempre');
});
test('guardar: persiste, se recorta al rango y otro arranque lo lee',()=>{
  const x=setup();const v=x.context.mcHapticTuneSave({edgeAmp:999,edgeMs:2,fillMs:1500,tickAmp:120.4,ajeno:5});
  assert.equal(v.edgeAmp,255);assert.equal(v.edgeMs,4);assert.equal(v.fillMs,1500);assert.equal(v.tickAmp,120);
  assert.equal(JSON.parse(x.store.get('_mcHapticTune')).ajeno,undefined,'solo se guardan las claves conocidas');
  assert.equal(x.css['--v42-cycle-ms'],'1500ms','la animacion del anillo sigue a la duracion');
  const y=setup(x.store.get('_mcHapticTune'));
  assert.equal(y.context.mcHapticTune().edgeAmp,255);assert.equal(y.css['--v42-cycle-ms'],'1500ms');
  assert.deepEqual({...y.context.mcHapticTuneReset()},{...setup().context.mcHapticTune()},'volver a los de serie');
  assert.equal(y.css['--v42-cycle-ms'],'1100ms');
  assert.equal(y.store.has('_mcHapticTune'),false);
});
test('almacen roto o con basura vuelve a los de serie sin romper',()=>{
  const x=setup('{no es json');assert.equal(x.context.mcHapticTune().fillAmp,40);
  const y=setup(JSON.stringify({fillAmp:'fuerte',edgeMs:null}));assert.equal(y.context.mcHapticTune().fillAmp,40);
});
test('borde: mcHaptic lleva la fuerza y duracion guardadas',()=>{
  const x=setup(JSON.stringify({edgeAmp:140,edgeMs:20}));
  x.context.mcEdgeHaptic();
  assert.deepEqual(x.calls.map(c=>[c.method,c.amplitude,c.durationMs]),[['edge',140,20]]);
});
test('Mi ciclo (ronda 7): unos toques cortos con la fuerza, la duracion y el uso del ajustador',()=>{
  const tune=JSON.stringify({fillAmp:120,fillMs:1500,usage:'hardware'});
  const full=setup(tune);full.context.mcInicioFillHaptic(ringEvent(100,1500));
  const fifth=setup(tune);fifth.context.mcInicioFillHaptic(ringEvent(20,1500));
  const [b]=full.calls,[s]=fifth.calls;
  assert.equal(b.method,'fill');assert.equal(b.usage,'hardware','el relleno lleva el uso elegido');
  const on=w=>[...w.amplitudes].filter(a=>a>0);
  assert.deepEqual(on(b),[120,120,120,120,120],'anillo lleno: cinco toques a la fuerza del deslizador');
  assert.deepEqual(on(s),[120],'un quinto del ciclo: un solo toque');
  b.timings.forEach((t,i)=>{ if(b.amplitudes[i]>0) assert.ok(t<=8,'cada toque es corto'); assert.ok(t>0&&t<=200,'tramos que la APK acepta'); });
  const total=b.timings.reduce((a,t)=>a+t,0);assert.ok(total<=1500&&total>1400,'repartidos a lo largo de la duracion elegida');
  const onMs=b.timings.reduce((a,t,i)=>a+(b.amplitudes[i]>0?t:0),0);assert.ok(onMs<=40,'en total, menos de 40 ms de vibracion');
  const def=setup();def.context.mcInicioFillHaptic(ringEvent(100));
  assert.ok(Math.max(...def.calls[0].amplitudes)<=40,'por defecto, suave');
  const empty=setup();empty.context.mcInicioFillHaptic(ringEvent(0));assert.equal(empty.calls.length,0,'anillo vacio no vibra');
});
test('texto para copiar: corto y con los siete numeros',()=>{
  const x=setup(JSON.stringify({fillAmp:40,fillMs:900,edgeAmp:90,edgeMs:15,edgeEvery:120,tickAmp:80,tickMs:9}));
  const txt=x.context.mcHapticTuneText();
  for(const n of [40,900,90,15,120,80,9])assert.match(txt,new RegExp('(^|[^0-9])'+n+'([^0-9]|$)'));
  assert.ok(txt.length<140);
});
test('grafica de Inicio: el tick usa los valores del ajustador',()=>{
  const dash=fs.readFileSync(new URL('../src/modules/03-tab-dash.js',import.meta.url),'utf8');
  assert.match(dash,/mcHaptic\("edge",\{amplitude:v\.tickAmp,durationMs:v\.tickMs\}\)/);
});
test('borde (ronda 7): una vibracion por arrastre; volver atras y empujar otra vez si',()=>{
  const x=setup(JSON.stringify({edgeEvery:100}));const clock={t:1000};x.context.performance.now=()=>clock.t;
  x.context.document.body={};
  x.context.getComputedStyle=()=>({overflowX:'visible',overflowY:'auto',overscrollBehaviorY:'auto'});
  const listeners={};const root={addEventListener:(type,fn)=>{listeners[type]=fn;},removeEventListener(){}};
  const el={scrollHeight:600,clientHeight:100,scrollWidth:100,clientWidth:100,scrollTop:500,isConnected:true,parentElement:null,
    closest:()=>null,classList:{contains:()=>false}};
  x.context.mcBindEdgeHaptics(root,()=>false);
  const touch=(type,y)=>listeners[type]({target:el,touches:/end/.test(type)?[]:[{identifier:0,clientX:50,clientY:y}],defaultPrevented:false});
  const edges=()=>x.calls.filter(c=>c.method==='edge').length;
  touch('touchstart',300);touch('touchmove',285);
  assert.equal(edges(),1,'tirar estando abajo avisa al momento');
  for(let y=270;y>=150;y-=15){clock.t+=200;touch('touchmove',y);}
  assert.equal(edges(),1,'seguir arrastrando contra el borde no repite');
  clock.t+=1000;assert.equal(edges(),1,'ni con el dedo quieto');
  clock.t+=200;touch('touchmove',155);touch('touchmove',145);touch('touchmove',130);
  assert.equal(edges(),1,'un temblor hacia atras no rearma');
  clock.t+=200;touch('touchmove',150);touch('touchmove',130);touch('touchmove',110);
  assert.equal(edges(),2,'volver atras de verdad y empujar otra vez es otro gesto');
  touch('touchend');clock.t+=200;touch('touchstart',300);touch('touchmove',280);
  assert.equal(edges(),3,'soltar y volver a tirar, otro');
  touch('touchend');
});
test('segmentos (ronda 7): el tick de la grafica',()=>{
  const x=setup(JSON.stringify({tickAmp:55,tickMs:9}));x.context.mcTickHaptic();
  assert.deepEqual(x.calls.map(c=>[c.method,c.amplitude,c.durationMs]),[["edge",55,9]]);
  const plan=fs.readFileSync(new URL('../src/modules/14-v4-screens.js',import.meta.url),'utf8');
  assert.match(plan,/if\(seg!==s\.id\) mcTickHaptic\(\); setSeg\(s\.id\)/,'Plan: tick al cambiar de segmento');
});
test('uso de la vibracion (ronda 6): se guarda, viaja en cada llamada y la basura vuelve a toque',()=>{
  const x=setup();assert.equal(x.context.mcHapticTune().usage,'touch','por defecto, el de siempre');
  x.context.mcHapticTuneSave({usage:'hardware'});
  assert.equal(setup(x.store.get('_mcHapticTune')).context.mcHapticTune().usage,'hardware');
  x.context.mcEdgeHaptic();assert.equal(x.calls.at(-1).usage,'hardware','el borde lo lleva');
  x.context.mcHaptic('edge',{amplitude:9,durationMs:9,usage:'media'});assert.equal(x.calls.at(-1).usage,'media','quien llama puede forzarlo');
  assert.equal(setup(JSON.stringify({usage:'vibracion-total'})).context.mcHapticTune().usage,'touch');
  assert.match(x.context.mcHapticTuneText(),/hardware/,'el texto copiado dice que uso se probo');
});
