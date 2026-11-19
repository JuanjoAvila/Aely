import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';
import fs from 'node:fs';

/* UX16: el ajustador de vibración vivió en Ajustes (solo beta) hasta el 19/11/2026, cuando él
 * pidió quitarlo y que lo que eligió fuera lo de todos (MC_HAPTIC_DEF). Aquí se comprueba que ya
 * no aparece en ningún canal y que la vibración sigue obedeciendo a mcHapticTune: lo guardado en
 * su móvil y, si no hay nada, los de serie. El motor nativo es un doble: un navegador no puede
 * acreditar la sensación, sí qué se le pide. */

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

async function openSettings(page){
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mc-open-settings')));
  await expect(page.getByRole('heading',{name:/Ajustes|Settings|Ajustos/i})).toBeVisible({timeout:8_000});
}

for(const channel of ['beta','stable']){
  test('UX16: sin ajustador de vibración en Ajustes (canal '+channel+')',async({page})=>{
    await boot(page,channel);
    await openSettings(page);
    await expect(page.locator('.set-row',{hasText:/Vibraci/})).toHaveCount(0);
    await expect(page.locator('.hv-tuner')).toHaveCount(0);
    await expect(page.locator('input[type=range][data-haptic]')).toHaveCount(0);
    await expect(page.locator('.v4-set-sec',{hasText:/^(Avanzado|Advanced|Avançat)$/})).toHaveCount(0);
    // Buscar «vibración» tampoco lo encuentra.
    await page.locator('.set-search-in').fill('vibración');
    await expect(page.locator('.set-row',{hasText:/Vibraci/})).toHaveCount(0);
  });
}

test('UX16: el choque contra el borde obedece a lo guardado en este móvil, con uso hardware',async({page})=>{
  await boot(page,'stable');
  await page.evaluate(()=>localStorage.setItem('_mcHapticTune',JSON.stringify({v:2,edgeAmp:180,edgeMs:30,edgeEvery:90})));
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
  // La fuerza alarga también el toque (ronda 9): 30 ms a fuerza 180 salen 36 ms.
  expect(r.arrival,'el choque real obedece a lo guardado').toMatchObject({amplitude:180,durationMs:36,usage:'hardware'});
  expect(r.immediate,'seguir tirando estando abajo vibra al momento').toBe(1);
  expect(r.held,'con el dedo quieto no repite').toBe(1);
  expect(r.repeated,'ni al seguir arrastrando: uno por arrastre').toBe(1);
});

test('UX16 ronda 9: cambiar de segmento en Plan da su propio toque (seg*)',async({page})=>{
  await boot(page,'beta');
  await page.evaluate(()=>localStorage.setItem('_mcHapticTune',JSON.stringify({v:2,tickAmp:66,tickMs:9,segAmp:102,segMs:20})));
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const deudas=page.locator('.v4-seg-btn[data-seg="deudas"]').last();
  await expect(deudas).toBeVisible({timeout:8_000});
  const before=await page.evaluate(()=>window.__ux16.edge.length);
  await deudas.click();
  await expect.poll(()=>page.evaluate(()=>window.__ux16.edge.length)).toBe(before+1);
  expect(await page.evaluate(()=>window.__ux16.edge.at(-1))).toMatchObject({amplitude:102,durationMs:18,usage:'hardware'});
  await deudas.click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(()=>window.__ux16.edge.length),'pulsar el segmento ya activo no vibra').toBe(before+1);
});
