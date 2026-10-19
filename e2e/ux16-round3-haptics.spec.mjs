import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,estadoHeredado} from './fixtures.mjs';
import fs from 'node:fs';

export async function ux16Round3BrowserCases(){
  const results=[],sleep=ms=>new Promise(r=>setTimeout(r,ms)),frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const check=(name,actual,expected)=>results.push({name,actual,expected,pass:actual===expected});
  for(let i=0;i<400&&(!window.__mcSplashGone||!document.querySelector('.page-scroll-host .v42-net-chart svg'));i++)await sleep(25);
  const chart=document.querySelector('.page-scroll-host .v42-net-chart'),svg=chart?.querySelector('svg');
  if(!svg)throw Error('Fixture: grafica real ausente');
  const calls=window.__ux16.edge;
  function touch(el,type,x,y,n=1){
    const e=new Event(type,{bubbles:true,cancelable:true});
    Object.defineProperty(e,'touches',{value:/end|cancel/.test(type)?[]:Array.from({length:n},(_,i)=>({identifier:i,clientX:x,clientY:y}))});
    el.dispatchEvent(e);return e.defaultPrevented;
  }
  const box=document.createElement('div');box.style.cssText='height:100px;overflow-y:auto;overscroll-behavior:auto';box.innerHTML='<div style="height:600px">Sintetico</div>';document.body.append(box);
  let before=calls.length;
  // Ronda 7: una vibración por arrastre contra el borde; ni quieto ni arrastrando se repite.
  touch(box,'touchstart',200,250);const prevented=touch(box,'touchmove',200,275);await sleep(365);
  check('dedo quieto en el borde no repite',calls.length-before,1);
  for(let y=290;y<=350;y+=15){await sleep(170);touch(box,'touchmove',200,y);}
  check('seguir arrastrando contra el borde no repite',calls.length-before,1);
  before=calls.length;touch(box,'touchmove',200,353);await sleep(170);touch(box,'touchmove',200,356);
  check('temblor de unos pixeles no repite',calls.length,before);
  touch(box,'touchend',200,356);before=calls.length;await sleep(210);check('soltar detiene inmediatamente',calls.length,before);
  touch(box,'touchstart',200,250);touch(box,'touchmove',200,275);await sleep(180);touch(box,'touchcancel',200,275);
  before=calls.length;await sleep(180);check('cancelar detiene ticks',calls.length,before);
  touch(box,'touchstart',200,250);touch(box,'touchmove',200,275);touch(box,'touchmove',200,260);
  before=calls.length;await sleep(180);touch(box,'touchmove',200,262);check('dar marcha atras no repite',calls.length,before);
  touch(box,'touchend',200,262);
  box.scrollTop=200;box.dispatchEvent(new Event('scroll'));box.scrollTop=500;box.dispatchEvent(new Event('scroll'));
  before=calls.length;await sleep(330);check('inercia no inicia repeticion sin dedo',calls.length,before);
  touch(box,'touchstart',200,250);touch(box,'touchmove',200,225);await sleep(180);
  check('tirar tras llegada inferior vuelve a pulsar',calls.length>before,true);
  touch(box,'touchend',200,225);before=calls.length;await sleep(180);check('soltar en inferior detiene',calls.length,before);
  document.documentElement.classList.add('reduce-motion');touch(box,'touchstart',200,250);touch(box,'touchmove',200,225);await sleep(180);touch(box,'touchend',200,225);
  check('tiron reducido sin ticks',calls.length,before);document.documentElement.classList.remove('reduce-motion');
  check('observador no impide gesto',prevented,false);box.remove();
  const rect=svg.getBoundingClientRect(),y=rect.top+rect.height/2,x0=rect.left+rect.width*.1,x1=rect.left+rect.width*.55;
  const tab=document.querySelector('.botnav-tab.active')?.dataset.tour;
  before=calls.length;touch(chart,'touchstart',x0,y);touch(chart,'touchmove',x0+15,y);await frame();
  check('cursor real aparece',!!chart.querySelector('[data-testid="inicio-net-guide"]'),true);
  check('primer punto activo emite un tick',calls.length-before,1);
  const firstDay=document.querySelector('[data-testid="inicio-net-date"]')?.textContent;
  before=calls.length;await sleep(55);touch(chart,'touchmove',x0+15,y);await frame();check('mismo punto no repite',calls.length,before);
  touch(chart,'touchmove',x1,y);await frame();check('dia de cursor cambia',document.querySelector('[data-testid="inicio-net-date"]')?.textContent!==firstDay,true);
  check('nuevo punto emite un tick',calls.length-before,1);
  await sleep(45);const fastStart=calls.length;
  for(let i=0;i<18;i++){touch(chart,'touchmove',rect.left+rect.width*(i%2?.25:.75),y);await new Promise(r=>requestAnimationFrame(r));}
  await frame();const fast=calls.slice(fastStart);
  check('barrido rapido tiene ticks',fast.length>=2,true);
  check('barrido deja acabar cada tick',fast.slice(1).every((p,i)=>p.at-fast[i].at>=(fast[i].durationMs||8)+10),true);
  touch(chart,'touchend',x1,y);before=calls.length;await sleep(80);
  check('soltar grafica no pulsa tarde',calls.length,before);check('cursor desaparece al soltar',!!chart.querySelector('[data-testid="inicio-net-guide"]'),false);
  check('grafica conserva stopSwipe',chart.dataset.noswipe,'1');check('grafica no cambia pestaña',document.querySelector('.botnav-tab.active')?.dataset.tour,tab);
  touch(chart,'touchstart',x0,y);touch(chart,'touchmove',x0+1,y+25);await sleep(280);touch(chart,'touchend',x0+1,y+25);
  check('gesto vertical no activa tick de grafica',calls.length,before);
  document.documentElement.classList.add('reduce-motion');touch(chart,'touchstart',x0,y);touch(chart,'touchmove',x1,y);await frame();touch(chart,'touchend',x1,y);
  check('grafica reducida conserva silencio',calls.length,before);document.documentElement.classList.remove('reduce-motion');
  return results;
}

test('UX16 ronda3: tiron limitado y tick por punto real de Inicio',async({page})=>{
  const state=estadoHeredado('2026-10-18');state.obAccounts=state.obAccounts.map(a=>({...a,key:a.id}));
  await seedLoggedInDashboard(page,{...state,__seenVersion:fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim()});
  await page.route('https://**/*',route=>route.abort());
  await page.addInitScript(()=>{window.__ux16={edge:[],fill:[]};window.Capacitor={Plugins:{AelyHaptics:{edge(p){window.__ux16.edge.push({...p,at:performance.now()});return Promise.resolve();},fill(p){window.__ux16.fill.push(p);return Promise.resolve();}}}};});
  await page.goto('/');const r=await page.evaluate(ux16Round3BrowserCases);expect(r.filter(x=>!x.pass),JSON.stringify(r)).toEqual([]);
});
