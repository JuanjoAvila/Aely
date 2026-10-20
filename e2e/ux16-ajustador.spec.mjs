import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';
import fs from 'node:fs';

/* UX16 ronda 4: el ajustador de vibración vive en Ajustes y SOLO en el canal beta. Se mueve un
 * deslizador de verdad, se comprueba que queda en este móvil, que «Probar» manda esos números
 * al motor y que el borde y la gráfica los obedecen. El motor nativo es un doble: un navegador
 * no puede acreditar la sensación, sí qué se le pide. */

const VERSION=fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();

async function boot(page,channel){
  await page.route('https://**/*',route=>route.abort());
  await seedLoggedInDashboard(page,{budget:1000,accounts:[],expenses:[],__seenVersion:VERSION});
  await page.addInitScript(ch=>{
    if(ch==='beta') localStorage.setItem('_mcChannel','beta'); else localStorage.removeItem('_mcChannel');
    window.__ux16={edge:[],fill:[]};
    window.Capacitor={Plugins:{AelyHaptics:{
      edge(p){if(p&&p.cycle){window.__ux16.fill.push({...p,at:performance.now()});return Promise.resolve({tunable:true,shaped:true,amplitudeControl:true});}window.__ux16.edge.push({...p,at:performance.now()});return Promise.resolve({tunable:true,shaped:true,amplitudeControl:true});},
      fill(p){window.__ux16.fill.push(p);return Promise.resolve({tunable:true,shaped:true,amplitudeControl:true});}}}};
  },channel);
  await page.goto('/');
  await expect(page.locator('.botnav')).toBeVisible({timeout:15_000});
  await dismissNews(page);
}

async function openTuner(page){
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mc-open-settings')));
  await expect(page.getByRole('heading',{name:/Ajustes|Settings|Ajustos/i})).toBeVisible({timeout:8_000});
  const head=page.locator('.set-row',{hasText:'Vibración'});
  await expect(head).toHaveCount(1);
  await head.click();
  const tuner=page.locator('.hv-tuner');
  await expect(tuner.locator('input[type=range]')).toHaveCount(7);
  return tuner;
}

// React escucha `input` con el setter nativo: así se mueve un range igual que con el dedo.
async function slide(page,key,value){
  await page.locator(`input[data-haptic="${key}"]`).evaluate((el,v)=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(v));
    el.dispatchEvent(new Event('input',{bubbles:true}));
  },value);
}

test('UX16 ajustador: en beta se mueve, se guarda, se prueba y lo obedecen borde y grafica',async({page})=>{
  await boot(page,'beta');
  const tuner=await openTuner(page);
  await slide(page,'edgeAmp',180);
  await slide(page,'edgeEvery',90);
  await expect(tuner.locator('[data-group="edge"]')).toContainText('180');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('_mcHapticTune')||'null'));
  expect(saved).toMatchObject({edgeAmp:180,edgeEvery:90});

  // Ronda 8: probar el borde = un choque, el mismo que en la app, con su fuerza y duración.
  await slide(page,'edgeMs',30);
  const before=await page.evaluate(()=>window.__ux16.edge.length);
  await tuner.locator('[data-group="edge"] .chip').click();
  await expect.poll(()=>page.evaluate(()=>window.__ux16.edge.length)).toBe(before+1);
  await page.waitForTimeout(400);
  expect(await page.evaluate(()=>window.__ux16.edge.length)).toBe(before+1);
  expect(await page.evaluate(()=>window.__ux16.edge.at(-1))).toMatchObject({amplitude:180,durationMs:30,usage:'hardware'});

  // Ronda 6: el tipo de vibración se elige con chips y viaja en cada llamada al motor.
  await tuner.locator('[data-usage="hardware"]').click();
  await expect(tuner.locator('[data-usage="hardware"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('_mcHapticTune')).usage)).toBe('hardware');
  await tuner.locator('[data-group="tick"] .chip').click();
  await expect.poll(()=>page.evaluate(()=>window.__ux16.edge.at(-1).usage)).toBe('hardware');

  await slide(page,'fillMs',1500);
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--v42-cycle-ms').trim())).toBe('1500ms');
  // Probar el anillo = la ristra entera con el anillo lleno: ocho toques hasta la fuerza elegida.
  await page.evaluate(()=>{window.__ux16.fill=[];});
  await tuner.locator('[data-group="fill"] .chip').click();
  await expect.poll(()=>page.evaluate(()=>window.__ux16.fill.length),{timeout:4_000}).toBe(8);
  const ring=await page.evaluate(()=>window.__ux16.fill);
  expect(ring.at(-1).amplitude).toBe(40);
  expect(ring.every(c=>c.usage==='hardware')).toBe(true);
  expect(ring.at(-1).at-ring[0].at).toBeGreaterThan(500);

  // Copiar deja en el portapapeles el texto corto que él nos manda.
  await page.evaluate(()=>{window.__copied=null;navigator.clipboard.writeText=t=>{window.__copied=t;return Promise.resolve();};});
  await tuner.getByRole('button',{name:'Copiar valores'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__copied)).toContain('borde 180/');

  // Tras recargar sigue ahí: vive en este móvil.
  await page.reload();
  await expect(page.locator('.botnav')).toBeVisible({timeout:15_000});
  await dismissNews(page);
  await openTuner(page);
  await expect(page.locator('input[data-haptic="edgeAmp"]')).toHaveValue('180');

  // Borde con sus números: la llegada y, tras el intervalo, tirar otra vez estando abajo avisa YA.
  const r=await page.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms)),calls=window.__ux16.edge;
    const box=document.createElement('div');box.style.cssText='position:fixed;top:0;left:0;width:200px;height:100px;overflow-y:auto;z-index:999';
    box.innerHTML='<div style="height:600px">Sintetico</div>';document.body.append(box);
    function touch(type,y){const e=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperty(e,'touches',{value:/end|cancel/.test(type)?[]:[{identifier:0,clientX:50,clientY:y}]});box.dispatchEvent(e);}
    box.scrollTop=200;box.dispatchEvent(new Event('scroll'));box.scrollTop=500;box.dispatchEvent(new Event('scroll'));
    const arrival=calls.at(-1);await sleep(200);
    const before=calls.length;touch('touchstart',250);touch('touchmove',230);const immediate=calls.length-before;
    await sleep(140);const held=calls.length-before;
    touch('touchmove',215);const repeated=calls.length-before;touch('touchend',215);box.remove();
    return {arrival,immediate,held,repeated};
  });
  expect(r.arrival,'el choque real obedece al ajustador').toMatchObject({amplitude:180,durationMs:30,usage:'hardware'});
  expect(r.immediate,'seguir tirando estando abajo vibra al momento').toBe(1);
  expect(r.held,'con el dedo quieto no repite').toBe(1);
  expect(r.repeated,'ni al seguir arrastrando: uno por arrastre').toBe(1);
});

test('UX16 ajustador: en el canal estable no aparece',async({page})=>{
  await boot(page,'stable');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mc-open-settings')));
  await expect(page.getByRole('heading',{name:/Ajustes|Settings|Ajustos/i})).toBeVisible({timeout:8_000});
  await expect(page.locator('.set-row',{hasText:'Vibración'})).toHaveCount(0);
  await expect(page.locator('.hv-tuner')).toHaveCount(0);
});

test('UX16 ronda 7: cambiar de segmento en Plan da el tick de la grafica',async({page})=>{
  await boot(page,'beta');
  await page.evaluate(()=>localStorage.setItem('_mcHapticTune',JSON.stringify({tickAmp:66,tickMs:9})));
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const deudas=page.locator('.v4-seg-btn[data-seg="deudas"]').last();
  await expect(deudas).toBeVisible({timeout:8_000});
  const before=await page.evaluate(()=>window.__ux16.edge.length);
  await deudas.click();
  await expect.poll(()=>page.evaluate(()=>window.__ux16.edge.length)).toBe(before+1);
  expect(await page.evaluate(()=>window.__ux16.edge.at(-1))).toMatchObject({amplitude:66,durationMs:9});
  await deudas.click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(()=>window.__ux16.edge.length),'pulsar el segmento ya activo no vibra').toBe(before+1);
});
