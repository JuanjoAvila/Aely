import {test, expect} from '@playwright/test';
import {seedLoggedInDashboard} from './fixtures.mjs';
import fs from 'node:fs';

// También lo ejecuta el banco CDP sin dependencias: eventos DOM y animaciones CSS reales;
// el único doble es el motor nativo, que un navegador no puede acreditar.
export async function ux16BrowserCases(){
  const results=[], sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const check=(name,actual,expected)=>results.push({name,actual,expected,pass:actual===expected});
  for(let i=0;i<400&&(!window.__mcSplashGone||!document.querySelector('.page-scroll-host .v42-cycle-draw'));i++)await sleep(25);
  const ring=document.querySelector('.page-scroll-host .v42-cycle-draw');
  if(!ring)throw Error('Fixture: Inicio sin anillo');
  const host=ring.closest('.page');
  await sleep(250);
  const calls=window.__ux16;
  check('anillo: un disparo tras splash y delay',calls.fill.length,1);
  check('anillo: duracion CSS real',calls.fill[0]?.durationMs??0,1100);
  check('anillo: no pulsa detras del splash',calls.fillBeforeSplash,0);
  check('anillo: respeta 150ms de delay CSS',!!calls.fill[0]&&calls.fill[0].at-calls.splashAt>=120,true);
  ring.dispatchEvent(new AnimationEvent('animationstart',{animationName:'v42-cycle-draw',bubbles:true}));
  check('anillo: evento duplicado no duplica RPC',calls.fill.length,1);
  const first=calls.fill.length;
  document.querySelector('.v42-cycle').click(); // rerender real de Dashboard al abrir su hoja.
  await sleep(30);
  check('anillo: rerender no dispara',calls.fill.length,first);
  document.querySelector('.v4-sheet-back')?.click();
  await sleep(450);
  const tabs=[...document.querySelectorAll('.botnav-tab')];
  tabs[1]?.click();await sleep(800);tabs[0]?.click();await sleep(800);
  check('anillo: volver sin reanimacion no dispara',calls.fill.length,first);
  check('retorno real: mismo anillo montado',document.querySelector('.v42-cycle-draw')===ring,true);
  check('retorno real: Inicio recupera host',document.querySelector('.page-scroll-host')===host,true);

  const box=document.createElement('div');
  box.style.cssText='height:100px;overflow-y:auto;overscroll-behavior:auto';
  box.innerHTML='<div style="height:600px;width:100%">Sintético</div>';
  document.body.append(box);
  function touch(type,x,y,el=box,n=1){
    const e=new Event(type,{bubbles:true,cancelable:true});
    const points=Array.from({length:n},(_,i)=>({identifier:i,clientX:x,clientY:y}));
    Object.defineProperty(e,'touches',{value:/end|cancel/.test(type)?[]:points});
    el.dispatchEvent(e);return e.defaultPrevented;
  }
  const start=(y=200,el=box)=>touch('touchstart',200,y,el);
  const move=(y,x=200,el=box)=>touch('touchmove',x,y,el);
  const end=()=>touch('touchend',200,200);
  box.scrollTop=0;let before=calls.edge.length;start();move(204);
  check('umbral: microdesplazamiento silencioso',calls.edge.length,before);
  const prevented=move(216);move(245);move(260);end();
  check('borde superior: una vez por gesto',calls.edge.length-before,1);
  check('listener haptico no impide scroll',prevented,false);
  before=calls.edge.length;start();move(220);end();
  check('touchstart rearma otro gesto',calls.edge.length-before,1);
  before=calls.edge.length;box.scrollTop=500;start();move(180);move(155);end();
  check('borde inferior: una vez',calls.edge.length-before,1);
  before=calls.edge.length;box.scrollTop=200;start();move(170);box.scrollTop=500;
  move(165);check('llegar al borde no cuenta recorrido previo',calls.edge.length,before);
  move(145);end();check('empuje despues de llegar al borde',calls.edge.length-before,1);
  before=calls.edge.length;move(100);box.dispatchEvent(new Event('scroll',{bubbles:true}));
  check('fling sin dedo no dispara',calls.edge.length,before);
  box.scrollTop=0;start();move(206,240);move(225,280);end();
  check('horizontal no dispara',calls.edge.length,before);
  box.firstChild.style.height='50px';start();move(240);end();
  check('sin scroll no dispara',calls.edge.length,before);
  box.firstChild.style.height='600px';box.dataset.noswipe='1';start();move(240);end();
  check('stopSwipe no dispara',calls.edge.length,before);delete box.dataset.noswipe;
  before=calls.edge.length;
  start();touch('touchcancel',200,200);move(240);
  check('cancelado no dispara',calls.edge.length,before);
  before=calls.edge.length;
  touch('touchstart',200,200,box,2);move(240);end();
  check('multitouch no dispara',calls.edge.length,before);
  before=calls.edge.length;
  document.documentElement.classList.add('reduce-motion');start();move(240);end();
  check('movimiento reducido: borde silencioso',calls.edge.length,before);
  document.documentElement.classList.remove('reduce-motion');
  before=calls.edge.length;
  const plugin=window.Capacitor.Plugins.AelyHaptics;delete window.Capacitor.Plugins.AelyHaptics;
  start();move(240);end();check('PWA sin plugin: borde silencioso',calls.edge.length,before);
  window.Capacitor.Plugins.AelyHaptics=plugin;
  // El gesto de abrir Perfil pertenece al controlador existente, no al borde.
  before=calls.edge.length;host.scrollTop=0;
  touch('touchstart',180,250,host);touch('touchmove',180,290,host);touch('touchend',180,290,host);
  check('gesto Perfil no dispara borde',calls.edge.length,before);
  box.remove();
  return results;
}

test('UX16: borde y anillo reales con transporte nativo sintetico',async({page})=>{
  await seedLoggedInDashboard(page,{budget:1000,accounts:[],expenses:[],__seenVersion:fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim()});
  await page.route('https://**/*',route=>route.abort());
  await page.addInitScript(()=>{
    window.__ux16={edge:[],fill:[],fillBeforeSplash:0,splashAt:0};
    window.addEventListener('mc-splash-gone',()=>{window.__ux16.fillBeforeSplash=window.__ux16.fill.length;window.__ux16.splashAt=performance.now();});
    window.Capacitor={Plugins:{AelyHaptics:{edge(){window.__ux16.edge.push({});return Promise.resolve();},fill(p){window.__ux16.fill.push({...p,at:performance.now()});return Promise.resolve();}}}};
  });
  await page.goto('/');
  const results=await page.evaluate(ux16BrowserCases);
  expect(results.filter(r=>!r.pass),JSON.stringify(results)).toEqual([]);
});
