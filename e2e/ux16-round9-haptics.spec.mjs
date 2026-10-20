import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';
import fs from 'node:fs';

/* UX16 ronda 9 (veredicto de la beta 4.26.155): al cambiar de segmento sonaban DOS vibraciones
 * (la del segmento y otra hipersuave de «llegar arriba»), el anillo de Inicio «no vibra» y la
 * fuerza del borde «no cambia nada». El motor es un doble que apunta cada llamada: un navegador
 * no puede acreditar la sensación, sí cuántas veces y con qué se le pide. */

const VERSION=fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();

async function boot(page,tune){
  await page.route('https://**/*',route=>route.abort());
  await seedLoggedInDashboard(page,{budget:1000,accounts:[],expenses:[],__seenVersion:VERSION});
  await page.addInitScript(tn=>{
    localStorage.setItem('_mcChannel','beta');
    if(tn&&!window._ux16Seeded){window._ux16Seeded=1;localStorage.setItem('_mcHapticTune',JSON.stringify(tn));}
    window.__ux16=[];
    window.Capacitor={Plugins:{AelyHaptics:{
      edge(p){window.__ux16.push({...p,at:performance.now()});return Promise.resolve({tunable:true,shaped:true,amplitudeControl:true});},
      fill(p){window.__ux16.push({...p,fill:true});return Promise.resolve({tunable:true,shaped:true,amplitudeControl:true});}}}};
  },tune||null);
  await page.goto('/');
  await expect(page.locator('.botnav')).toBeVisible({timeout:15_000});
}

// Plan con Recibos lo bastante largo como para que la página tenga borde de verdad.
async function openPlan(page){
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('.v4-seg-btn[data-seg="deudas"]').last()).toBeVisible({timeout:8_000});
  await page.evaluate(()=>{
    for(const [id,h] of [['recibos',3000],['deudas',1400]]){
      const layer=[...document.querySelectorAll('div[data-seg="'+id+'"]')].pop();
      const pad=document.createElement('div');pad.className='ux16-pad';pad.style.height=h+'px';layer.append(pad);
    }
  });
  // La ristra del anillo de Inicio (si quedaba algo) no debe colarse en la cuenta.
  await page.waitForTimeout(1600);
  await page.evaluate(()=>{window.__ux16.length=0;});
}

test('UX16 ronda 9: tirar desde arriba en Plan cambia de segmento con UN toque, sin el del borde',async({page})=>{
  await boot(page,{v:2,segAmp:140,segMs:22,edgeAmp:200,edgeMs:30});
  await openPlan(page);
  const r=await page.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const el=[...document.querySelectorAll('div[data-seg="recibos"] .ux16-pad')].pop();
    const page=el.closest('.page');page.scrollTop=0;
    function touch(type,y){const e=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperty(e,'touches',{value:/end|cancel/.test(type)?[]:[{identifier:0,clientX:200,clientY:y}]});el.dispatchEvent(e);}
    // Como en el móvil: el primer touchmove llega a ~8-11 px, antes de que Plan fije el eje (12 px).
    touch('touchstart',300);for(const y of [311,330,360,400,440]){touch('touchmove',y);await sleep(16);}
    touch('touchend',440);await sleep(400);
    return {seg:[...document.querySelectorAll('.v4-seg-btn.on')].pop().dataset.seg,calls:window.__ux16.slice()};
  });
  expect(r.seg,'el tirón cambia de segmento').toBe('deudas');
  expect(r.calls.length,'UNA vibración por cambio: '+JSON.stringify(r.calls)).toBe(1);
  expect(r.calls[0]).toMatchObject({amplitude:140,usage:'hardware'});
});

test('UX16 ronda 9: tocar otro segmento con la lista a medias no suma el borde del recolocado',async({page})=>{
  await boot(page,{v:2,segAmp:140,segMs:22});
  await openPlan(page);
  const r=await page.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const page=[...document.querySelectorAll('.v4-seg-btn.on')].pop().closest('.page');
    page.scrollTop=2600;await sleep(120);window.__ux16.length=0;
    [...document.querySelectorAll('.v4-seg-btn[data-seg="deudas"]')].pop().click();
    await sleep(500);
    return {clamped:page.scrollTop>=page.scrollHeight-page.clientHeight-1,calls:window.__ux16.slice()};
  });
  expect(r.clamped,'Deudas es más corto: el scroll se queda en el borde de abajo').toBe(true);
  expect(r.calls.length,'UNA vibración: '+JSON.stringify(r.calls)).toBe(1);
  expect(r.calls[0]).toMatchObject({amplitude:140,usage:'hardware'});
});

test('UX16 ronda 9: el anillo de Inicio manda toques que el motor puede sentir',async({page})=>{
  await boot(page);
  await expect.poll(()=>page.evaluate(()=>window.__ux16.filter(c=>c.cycle).length),{timeout:6_000}).toBe(8);
  const ring=await page.evaluate(()=>window.__ux16.filter(c=>c.cycle));
  expect(ring.every(c=>c.usage==='hardware'),'uso hardware: OxygenOS no lo cambia por su efecto de serie').toBe(true);
  expect(Math.min(...ring.map(c=>c.durationMs)),'ningún toque de 10 ms que el motor no arranca').toBeGreaterThanOrEqual(15);
  expect(Math.min(...ring.map(c=>c.amplitude)),'ni a un tercio de fuerza').toBeGreaterThanOrEqual(80);
});
