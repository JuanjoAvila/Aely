import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const source=fs.readFileSync(new URL('../src/modules/02-ui-shared.js',import.meta.url),'utf8');
const block=source.slice(source.indexOf('function mcReduced(){'),source.indexOf('/* Count-up compartido'));
function setup(){
  const calls=[],classes=new Set();
  const document={hidden:false,documentElement:{classList:{contains:k=>classes.has(k)}},getElementById:()=>null};
  const window={__mcSplashGone:true,matchMedia:()=>({matches:false}),Capacitor:{Plugins:{AelyHaptics:{fill:p=>calls.push(p),edge:()=>calls.push('edge')}}}};
  const context={document,window,Promise,WeakSet,Number,getComputedStyle:()=>({}),console};
  vm.createContext(context);vm.runInContext(block,context);
  const animation={animationName:'v42-cycle-draw',playState:'running',effect:{getComputedTiming:()=>({duration:1100})}};
  const el={style:{getPropertyValue:k=>k==='--cycle-pct'?'62':''},matches:s=>s==='.v42-cycle-draw',closest:()=>({classList:{contains:()=>true}}),getAnimations:()=>[animation]};
  const event={target:el,animationName:'v42-cycle-draw',elapsedTime:0};
  return {context,calls,classes,document,window,animation,event};
}
test('fill: solo una instancia real, duracion efectiva y nuevo montaje animado',()=>{
  const x=setup();x.context.mcInicioFillHaptic(x.event);x.context.mcInicioFillHaptic(x.event);
  assert.equal(x.calls.length,1);assert.equal(x.calls[0].durationMs,1100);
  x.event.target.getAnimations=()=>[{...x.animation}];x.context.mcInicioFillHaptic(x.event);
  assert.equal(x.calls.length,2,'otra animacion real puede producir una nueva apertura');
});
test('fill: movimiento reducido del SO y de la app anula incluso una animacion aun activa',()=>{
  for(const mode of ['system','app']){
    const x=setup();if(mode==='system')x.window.matchMedia=()=>({matches:true});else x.classes.add('reduce-motion');
    x.context.mcInicioFillHaptic(x.event);assert.equal(x.calls.length,0,mode);
  }
});
test('fill: pausa, splash, pestaña oculta, otra animacion y documento oculto son silencio',()=>{
  for(const mode of ['paused','splash','tab','animation','hidden']){
    const x=setup();if(mode==='paused')x.animation.playState='paused';
    if(mode==='splash'){x.window.__mcSplashGone=false;x.document.getElementById=()=>({});}
    if(mode==='tab')x.event.target.closest=()=>({classList:{contains:()=>false}});
    if(mode==='animation')x.event.animationName='v42-net-fill';if(mode==='hidden')x.document.hidden=true;
    x.context.mcInicioFillHaptic(x.event);assert.equal(x.calls.length,0,mode);
  }
});
test('transporte ausente o rechazado no rompe la web ni deja promesa rechazada',async()=>{
  const x=setup();delete x.window.Capacitor;x.context.mcHaptic('edge');
  x.window.Capacitor={Plugins:{AelyHaptics:{fill:()=>Promise.reject(Error('synthetic'))}}};
  x.context.mcInicioFillHaptic(x.event);await new Promise(r=>setImmediate(r));assert.equal(x.calls.length,0);
});
test('App: guardas reales de navegación, Perfil y Ajustes no pertenecen al observador',()=>{
  const app=fs.readFileSync(new URL('../src/modules/11-app-main.js',import.meta.url),'utf8');
  const body=app.match(/hapticBlockRef.current=function\(\)\{([\s\S]*?)\n  \};/)[1];
  const run=new Function('locked','state','gestureMode','dDrag','dAx','pDrag','pOwn','pAx',body);
  const ref=current=>({current});
  assert.equal(run(false,{onboarded:true},ref(null),ref(false),ref(null),ref(false),ref(false),ref(null)),false);
  for(const mode of ['profile','drawer','tab'])assert.equal(run(false,{},ref(mode),ref(false),ref(null),ref(false),ref(false),ref(null)),true,mode);
  assert.equal(run(false,{},ref(null),ref(true),ref('x'),ref(false),ref(false),ref(null)),true);
  assert.equal(run(false,{},ref(null),ref(false),ref(null),ref(true),ref(true),ref('y')),true);
});
