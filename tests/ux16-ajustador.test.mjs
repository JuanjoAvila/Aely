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
    const timers=[];
  const context={document,window,localStorage,performance:{now:()=>0},Promise,WeakSet,WeakMap,Number,Math,JSON,Object,getComputedStyle:()=>({}),console,
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:()=>{}};
  vm.createContext(context);vm.runInContext(block,context);
  // Dispara los temporizadores pendientes en orden de reloj (la ristra del anillo).
  const flush=()=>{timers.sort((a,b)=>a.ms-b.ms).splice(0).forEach(t=>t.fn());};
  return {context,calls,store,css,timers,flush};
}
function ringEvent(pct,duration=1100){
  const animation={animationName:'v42-cycle-draw',playState:'running',effect:{getComputedTiming:()=>({duration})}};
  const el={style:{getPropertyValue:k=>k==='--cycle-pct'?String(pct):''},matches:s=>s==='.v42-cycle-draw',
    closest:()=>({classList:{contains:()=>true}}),getAnimations:()=>[animation]};
  return {target:el,animationName:'v42-cycle-draw',elapsedTime:0};
}
test('valores por defecto (ronda 9): ciclo y borde que se notan, segmento propio y grafica intacta',()=>{
  const x=setup();const v=x.context.mcHapticTune();
  assert.equal(v.fillAmp,140);assert.equal(v.fillMs,1100);assert.equal(v.edgeEvery,150);
  assert.ok(v.edgeAmp>=100&&v.edgeMs>=16,'borde: los 70/12 ms de la ronda 8 no se sentian');
  assert.equal(v.tickAmp,70);assert.equal(v.tickMs,10);
  assert.ok(v.segAmp>0&&v.segAmp<255&&v.segMs<45,'segmento: un poco mas suave que el efecto de serie de 45 ms');
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
  const x=setup('{no es json');assert.equal(x.context.mcHapticTune().fillAmp,140);
  const y=setup(JSON.stringify({v:2,fillAmp:'fuerte',edgeMs:null}));assert.equal(y.context.mcHapticTune().fillAmp,140);
});
test('borde (ronda 8): el choque obedece fuerza y duracion del ajustador, con uso hardware',()=>{
  for(const [amp,ms,felt] of [[1,8,4],[140,20,21],[255,60,90]]){
    const x=setup(JSON.stringify({v:2,edgeAmp:amp,edgeMs:ms,usage:'touch'}));
    x.context.mcEdgeHaptic();
    assert.deepEqual(x.calls.map(c=>[c.method,c.amplitude,c.durationMs,c.usage]),[['edge',amp,felt,'hardware']],
      'con «toque» OxygenOS lo cambia por su efecto de serie y la fuerza no se nota');
  }
});
test('fuerza perceptible (ronda 9): entre 1 y 255 el toque dura al menos el doble, en borde, segmento y anillo',()=>{
  const one=(k,amp)=>{const x=setup(JSON.stringify({v:2,[k+'Amp']:amp}));
    if(k==='edge')x.context.mcEdgeHaptic();else if(k==='seg')x.context.mcTickHaptic();else{x.context.mcInicioFillHaptic(ringEvent(100));x.flush();}
    return x.calls.at(-1);};
  for(const k of ['edge','seg','fill']){
    const lo=one(k,1),hi=one(k,255);
    assert.equal(hi.usage,'hardware',k);
    assert.ok(hi.durationMs>=2*lo.durationMs,k+': '+lo.durationMs+' ms frente a '+hi.durationMs+' ms');
  }
  assert.ok(one('fill',140).durationMs>=15,'el anillo de serie no son toques de 10 ms que el motor no arranca');
});
test('guardado de antes de la ronda 9: fuerzas de ciclo y borde a los de serie; grafica y tipo se conservan',()=>{
  const v=setup('{"fillAmp":40,"edgeAmp":70,"edgeMs":12,"tickAmp":90,"tickMs":8,"fillMs":1500,"usage":"media"}').context.mcHapticTune();
  assert.equal(v.fillAmp,140);assert.equal(v.edgeAmp,120);assert.equal(v.edgeMs,20);
  assert.equal(v.tickAmp,90);assert.equal(v.tickMs,8);assert.equal(v.fillMs,1500);assert.equal(v.usage,'media');assert.equal(v.v,2);
});
test('Mi ciclo (ronda 8): toques sueltos, proporcionales al ciclo, con fuerza y duracion del ajustador',()=>{
  const run=(tune,pct,dur)=>{const x=setup(JSON.stringify({v:2,...tune}));x.context.mcInicioFillHaptic(ringEvent(pct,dur));x.flush();return x;};
  const full=run({fillAmp:200,fillMs:1500},100,1500), quarter=run({fillAmp:200,fillMs:1500},25,1500);
  assert.equal(full.calls.length,8,'anillo lleno: ocho toques, cada uno su llamada');
  assert.equal(quarter.calls.length,2,'un cuarto del ciclo: dos');
  assert.ok(full.calls.every(c=>c.method==='edge'&&c.usage==='hardware'&&c.durationMs<=30),'toques cortos con uso hardware');
  const amps=full.calls.map(c=>c.amplitude);
  assert.ok(amps.every((a,i)=>i===0||a>=amps[i-1])&&amps.at(-1)===200&&amps[0]<=135,'de mas suave a la fuerza del deslizador');
  const soft=run({fillAmp:40,fillMs:1500},100,1500);
  assert.equal(soft.calls.at(-1).amplitude,40,'el deslizador de fuerza se nota');
  const at=x=>x.timers.map(t=>t.ms);
  const slow=setup(JSON.stringify({v:2,fillAmp:200}));slow.context.mcInicioFillHaptic(ringEvent(100,2000));
  const fast=setup(JSON.stringify({v:2,fillAmp:200}));fast.context.mcInicioFillHaptic(ringEvent(100,600));
  assert.ok(Math.max(...at(slow))>1800&&Math.max(...at(fast))<700,'la duracion reparte los toques por el trazo');
  const t=at(slow).sort((a,b)=>a-b);assert.ok(t.every((v,i)=>i===0||v-t[i-1]>=50),'nunca dos toques pegados');
  const empty=setup();empty.context.mcInicioFillHaptic(ringEvent(0));empty.flush();assert.equal(empty.calls.length,0,'anillo vacio no vibra');
});
test('texto para copiar: corto y con los nueve numeros',()=>{
  const x=setup(JSON.stringify({v:2,fillAmp:40,fillMs:900,edgeAmp:90,edgeMs:15,edgeEvery:120,tickAmp:80,tickMs:9,segAmp:133,segMs:27}));
  const txt=x.context.mcHapticTuneText();
  for(const n of [40,900,90,15,120,80,9,133,27])assert.match(txt,new RegExp('(^|[^0-9])'+n+'([^0-9]|$)'));
  assert.ok(txt.length<160);
});
test('grafica de Inicio: el tick usa los valores del ajustador',()=>{
  const dash=fs.readFileSync(new URL('../src/modules/03-tab-dash.js',import.meta.url),'utf8');
  assert.match(dash,/mcHaptic\("edge",\{amplitude:v\.tickAmp,durationMs:v\.tickMs\}\)/);
});
test('borde (ronda 7): una vibracion por arrastre; volver atras y empujar otra vez si',()=>{
  const x=setup(JSON.stringify({v:2,edgeEvery:100}));const clock={t:1000};x.context.performance.now=()=>clock.t;
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
test('segmentos (ronda 9): UN toque por cambio, con su propio par del ajustador y uso hardware',()=>{
  const x=setup(JSON.stringify({v:2,tickAmp:55,tickMs:9,segAmp:102,segMs:20}));const clock={t:1000};x.context.performance.now=()=>clock.t;
  x.context.mcTickHaptic();x.context.mcTickHaptic();clock.t+=40;x.context.mcTickHaptic();
  assert.deepEqual(x.calls.map(c=>[c.method,c.amplitude,c.durationMs,c.usage]),[["edge",102,18,"hardware"]]);
  clock.t+=100;x.context.mcEdgeHaptic();
  assert.equal(x.calls.length,1,'el borde que provoca el propio cambio (scroll recolocado) no suena encima');
  const plan=fs.readFileSync(new URL('../src/modules/14-v4-screens.js',import.meta.url),'utf8');
  clock.t+=300;x.context.mcTickHaptic();assert.equal(x.calls.length,2,'el siguiente cambio, otro');
  assert.match(plan,/if\(seg!==s\.id\) mcTickHaptic\(\); setSeg\(s\.id\)/,'Plan: tick al cambiar de segmento');
});
test('uso de la vibracion (ronda 6): se guarda, viaja en cada llamada y la basura vuelve a toque',()=>{
  const x=setup();assert.equal(x.context.mcHapticTune().usage,'touch','por defecto, el de siempre');
  x.context.mcHapticTuneSave({usage:'hardware'});
  assert.equal(setup(x.store.get('_mcHapticTune')).context.mcHapticTune().usage,'hardware');
  x.context.mcEdgeHaptic();assert.equal(x.calls.at(-1).usage,'hardware','el borde lo lleva');
  x.context.mcHaptic('edge',{amplitude:9,durationMs:9,usage:'media'});assert.equal(x.calls.at(-1).usage,'media','quien llama puede forzarlo');
  assert.equal(setup(JSON.stringify({v:2,usage:'vibracion-total'})).context.mcHapticTune().usage,'touch');
  assert.match(x.context.mcHapticTuneText(),/hardware/,'el texto copiado dice que uso se probo');
});
