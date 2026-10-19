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
  assert.equal(v.fillAmp,30);assert.equal(v.fillMs,1100);assert.equal(v.edgeEvery,150);
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
  const x=setup('{no es json');assert.equal(x.context.mcHapticTune().fillAmp,30);
  const y=setup(JSON.stringify({fillAmp:'fuerte',edgeMs:null}));assert.equal(y.context.mcHapticTune().fillAmp,30);
});
test('borde: mcHaptic lleva la fuerza y duracion guardadas',()=>{
  const x=setup(JSON.stringify({edgeAmp:140,edgeMs:20}));
  x.context.mcEdgeHaptic();
  assert.deepEqual(x.calls.map(c=>[c.method,c.amplitude,c.durationMs]),[['edge',140,20]]);
});
test('Mi ciclo: dura la animacion, sigue al trazo y es proporcional al porcentaje',()=>{
  const big=setup(JSON.stringify({fillAmp:200}));big.context.mcInicioFillHaptic(ringEvent(90));
  const small=setup(JSON.stringify({fillAmp:200}));small.context.mcInicioFillHaptic(ringEvent(20));
  const [b]=big.calls,[s]=small.calls;
  assert.equal(b.method,'fill');assert.equal(b.durationMs,1100);assert.equal(b.amplitude,200);
  assert.equal(b.timings.reduce((a,t)=>a+t,0),1100,'la onda dura lo que la animacion');
  assert.equal(b.timings.length,b.amplitudes.length);
  assert.equal(Math.max(...b.amplitudes),Math.round(200*.9));assert.equal(Math.max(...s.amplitudes),Math.round(200*.2));
  const sum=w=>w.amplitudes.reduce((a,x)=>a+x,0);assert.ok(sum(b)>sum(s)*3,'mas lleno, mas vibracion');
  const peak=b.amplitudes.indexOf(Math.max(...b.amplitudes));
  assert.ok(b.amplitudes[0]<b.amplitudes[peak]/3&&b.amplitudes.at(-1)<b.amplitudes[peak]/3,'arranca y acaba suave, como el trazo');
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
test('borde (ronda 5): con el dedo quieto no repite; cada recorrido nuevo contra el borde, si',()=>{
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
  clock.t+=1000;
  assert.equal(edges(),1,'un segundo con el dedo quieto: ningun toque mas');
  touch('touchmove',283);assert.equal(edges(),1,'un temblor de 2 px no cuenta como seguir tirando');
  touch('touchmove',270);assert.equal(edges(),2,'seguir tirando hacia el borde vuelve a avisar');
  touch('touchmove',255);assert.equal(edges(),2,'sin pasar el intervalo no se encadena');
  clock.t+=150;assert.equal(edges(),2,'el reloj solo no repite');
  touch('touchmove',254);assert.equal(edges(),3,'el recorrido que el intervalo freno cuenta en el siguiente movimiento');
  clock.t+=150;touch('touchmove',250);assert.equal(edges(),3,'4 px nuevos no bastan');
  touch('touchend');clock.t+=500;assert.equal(edges(),3,'soltar no deja nada pendiente');
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
