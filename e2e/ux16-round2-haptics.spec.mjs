import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard} from './fixtures.mjs';
import fs from 'node:fs';

// El navegador acredita scroll/DOM y RPC, no la sensación ni la física de un motor Android.
export async function ux16Round2BrowserCases(){
  const results=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const check=(name,actual,expected)=>results.push({name,actual,expected,pass:actual===expected});
  for(let i=0;i<400&&(!window.__mcSplashGone||!document.querySelector('.page-scroll-host .v42-cycle-draw'));i++)await sleep(25);
  if(!document.querySelector('.page-scroll-host .v42-cycle-draw'))throw Error('Fixture: Inicio no listo');
  const calls=window.__ux16,box=document.createElement('div');
  box.style.cssText='position:fixed;top:200px;left:100px;width:150px;height:100px;overflow-y:auto;overscroll-behavior:auto';
  box.innerHTML='<div style="height:600px">Sintético</div>';document.body.append(box);
  const scroll=async y=>{box.scrollTop=y;box.dispatchEvent(new Event('scroll'));await sleep(35);};
  function touch(type,x=200,y=250){
    const e=new Event(type,{bubbles:true,cancelable:true});
    Object.defineProperty(e,'touches',{value:/end|cancel/.test(type)?[]:[{identifier:0,clientX:x,clientY:y}]});
    box.dispatchEvent(e);return e.defaultPrevented;
  }
  let before=calls.edge.length;
  await scroll(0);check('borde inicial sin llegada no pulsa',calls.edge.length,before);
  await scroll(180);touch('touchstart');touch('touchmove',200,200);touch('touchend');
  before=calls.edge.length;await scroll(0);
  check('inercia superior despues de soltar',calls.edge.length-before,1);
  before=calls.edge.length;await scroll(0);touch('touchstart');touch('touchmove',200,285);touch('touchend');
  check('otro dedo antes del intervalo no duplica',calls.edge.length,before);
  await scroll(3);await scroll(0);check('rebote menor que separacion no repite',calls.edge.length,before);
  await scroll(100);await scroll(0);check('separarse y volver rearma superior',calls.edge.length-before,1);
  await scroll(250);before=calls.edge.length;await scroll(500);
  check('inercia inferior sin dedo',calls.edge.length-before,1);
  before=calls.edge.length;await scroll(500);await scroll(499.5);
  check('mismo maximo repetido silencioso',calls.edge.length,before);
  await scroll(250);await scroll(500);check('separacion rearma inferior',calls.edge.length-before,1);
  await scroll(250);before=calls.edge.length;await scroll(300);check('scroll interior no pulsa',calls.edge.length,before);
  box.dataset.noswipe='1';await scroll(0);check('scroll stopSwipe no pulsa',calls.edge.length,before);delete box.dataset.noswipe;
  await scroll(250);document.documentElement.classList.add('reduce-motion');await scroll(500);
  check('inercia movimiento reducido silenciosa',calls.edge.length,before);document.documentElement.classList.remove('reduce-motion');
  await scroll(250);box.style.overscrollBehaviorY='none';await scroll(0);
  check('scroller sin ola silencioso',calls.edge.length,before);box.style.overscrollBehaviorY='auto';
  await scroll(250);box.classList.add('page');await scroll(500);
  check('pagina premontada silenciosa',calls.edge.length,before);box.classList.remove('page');
  await scroll(250);box.dataset.noswipe='1';await scroll(0);delete box.dataset.noswipe;
  // Llegada ignorada no se emite tarde; el tirón inicial sí puede armarse en un scroller nuevo.
  const other=box.cloneNode(true);box.remove();document.body.append(other);
  const e=new Event('touchstart',{bubbles:true});Object.defineProperty(e,'touches',{value:[{identifier:0,clientX:200,clientY:250}]});other.dispatchEvent(e);
  const m=new Event('touchmove',{bubbles:true,cancelable:true});Object.defineProperty(m,'touches',{value:[{identifier:0,clientX:200,clientY:275}]});other.dispatchEvent(m);
  check('tiron inicial sigue disponible',calls.edge.length-before,1);check('observador pasivo',m.defaultPrevented,false);
  other.dispatchEvent(new Event('touchend',{bubbles:true}));other.remove();
  return results;
}

test('UX16 ronda2: llegada por inercia y rearme por separacion',async({page})=>{
  await seedLoggedInDashboard(page,{budget:1000,accounts:[],expenses:[],__seenVersion:fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim()});
  await page.route('https://**/*',route=>route.abort());
  await page.addInitScript(()=>{window.__ux16={edge:[],fill:[]};window.Capacitor={Plugins:{AelyHaptics:{edge(p){if(p&&p.cycle){window.__ux16.fill.push(p);return Promise.resolve();}window.__ux16.edge.push({});return Promise.resolve();},fill(p){window.__ux16.fill.push(p);return Promise.resolve();}}}};});
  await page.goto('/');const r=await page.evaluate(ux16Round2BrowserCases);expect(r.filter(x=>!x.pass),JSON.stringify(r)).toEqual([]);
});
