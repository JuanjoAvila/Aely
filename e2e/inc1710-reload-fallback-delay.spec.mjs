import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';
import fs from 'node:fs';

test.beforeEach(async({context})=>{await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:48541'?r.continue():r.abort('blockedbyclient'));});

async function start(page,inside=false){
  await seedLoggedInDashboard(page,{__seedOnce:true,__cloudRows:{profiles:[{is_admin:true}]},settings:{autoPrices:false,theme:'green'}});
  await page.addInitScript(inside=>{
    if(inside&&!sessionStorage.getItem('_incDelayPrepared'))localStorage.setItem('_mcSandbox','1');
    const boot=Number(sessionStorage.getItem('_incDelayBoot')||0)+1;sessionStorage.setItem('_incDelayBoot',String(boot));
    const log=(kind,detail={})=>{const events=JSON.parse(sessionStorage.getItem('_incDelayEvents')||'[]');events.push({kind,boot,index:events.length,at:Date.now(),...detail});sessionStorage.setItem('_incDelayEvents',JSON.stringify(events));};
    window._incDelayLog=log;log('boot');
    if(!sessionStorage.getItem('_incDelayPrepared')){sessionStorage.setItem('_incDelayPrepared','1');localStorage.setItem('_mcAdminProfile',JSON.stringify({uid:'e2e-user',isAdmin:true}));const s=JSON.parse(localStorage.getItem('micartera_v3'));localStorage.setItem('micartera_sandbox',JSON.stringify({...s,settings:{...s.settings,profile:{fullName:'INC_DELAY_SEED_ONLY'}}}));}
    window._incDelayPerformance=performance;const nativeMark=performance.mark.bind(performance);performance.mark=function(name,...args){if(name==='mc_mode_change_reopen_required')log('fallback-mark');return nativeMark(name,...args);};
    new MutationObserver(()=>{if(document.querySelector('.mode-change-warning')&&!window._incDelaySawWarning){window._incDelaySawWarning=true;log('warning-mounted');}}).observe(document,{childList:true,subtree:true});
    const d=Object.getOwnPropertyDescriptor(window,'supabase');Object.defineProperty(window,'supabase',{configurable:true,get:d.get,set(lib){d.set(lib);const mock=d.get(),create=mock?.createClient;if(!create)return;mock.createClient=()=>{const client=create(),from=client.from;client.from=table=>{const chain=from(table);for(const method of ['insert','update','upsert','delete'])if(chain[method]){const original=chain[method];chain[method]=(...args)=>{log('write',{table,method,hasSeed:JSON.stringify(args).includes('INC_DELAY_SEED_ONLY')});return original(...args);};}return chain;};return client;};}});
    window.addEventListener('mc-sandbox-transition',()=>{log('transition',{active:mcSandboxTransition()});if(mcSandboxTransition())Promise.resolve().then(async()=>{const r=await cloud.pushState('e2e-user',slimForCloud(mcLoadRaw(mcStateKey())),null);log('guard-probe',{blocked:r===null});});});
    window.addEventListener('mc-sandbox-reload-requested',()=>log('reload-returned'));
    window.addEventListener('beforeunload',e=>{log('beforeunload');if(window._incDelayCancel){e.preventDefault();e.returnValue='';}});
    window.addEventListener('pagehide',()=>log('pagehide'));
    document.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.closest('[role=dialog]')&&['Entrar a probar','Salir a mi cartera real'].includes(b.textContent))log('confirm');},true);
  },inside);
  await page.goto('/');await ready(page,1);await dismissNews(page);
}
async function ready(page,boot){await page.waitForFunction(n=>document.readyState==='complete'&&Number(sessionStorage.getItem('_incDelayBoot'))===n&&typeof mcSandbox==='function',boot);await expect(page.locator('.botnav')).toBeVisible();await page.locator('#mc-load').waitFor({state:'detached'});}
async function ask(page,inside){await page.locator('.v4-avatar').click();await page.getByRole('button',{name:'Ir a Ajustes',exact:true}).click();await page.getByRole('button',{name:/Banco de pruebas/}).click();return page.getByRole('dialog').getByRole('button',{name:inside?'Salir a mi cartera real':'Entrar a probar',exact:true});}
const snapshot=page=>page.evaluate(()=>({boot:Number(sessionStorage.getItem('_incDelayBoot')),events:JSON.parse(sessionStorage.getItem('_incDelayEvents')||'[]'),pinned:mcSandbox(),flag:mcSandboxFlag(),transition:mcSandboxTransition(),warnings:document.querySelectorAll('.mode-change-warning').length,marks:performance.getEntriesByName('mc_mode_change_reopen_required').length}));
function windowGuard(events,boot){const confirm=events.find(e=>e.kind==='confirm'&&e.boot===boot),hide=events.find(e=>e.kind==='pagehide'&&e.boot===boot);expect(confirm).toBeTruthy();expect(hide).toBeTruthy();expect(events.filter(e=>e.kind==='write'&&e.index>confirm.index&&e.index<hide.index),'existing cloud writers remain guarded during reload').toEqual([]);expect(events.filter(e=>e.kind==='guard-probe'&&e.boot===boot).every(e=>e.blocked)).toBe(true);expect(events.filter(e=>e.kind==='write'&&e.hasSeed)).toEqual([]);}

test('INC1710 delay normal roundtrip never mounts fallback or records fallback mark',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let outcome;
  try{await start(page);for(const inside of [false,true]){const boot=inside?2:1,ok=await ask(page,inside);await Promise.all([page.waitForEvent('load'),ok.click()]);await ready(page,boot+1);outcome=await snapshot(page);windowGuard(outcome.events,boot);expect(outcome.events.filter(e=>e.boot===boot&&e.kind==='fallback-mark'),'normal reload must not emit fallback telemetry').toEqual([]);expect(outcome.events.filter(e=>e.boot===boot&&e.kind==='warning-mounted'),'normal reload must never mount recovery warning').toEqual([]);expect(outcome.pinned).toBe(!inside);}expect(errors).toEqual([]);}
  finally{outcome=await snapshot(page);fs.writeFileSync(info.outputPath('delay-normal.json'),JSON.stringify({outcome,errors},null,2)+'\n');}
});

for(const inside of [false,true])test('INC1710 delay canceled '+(inside?'exit':'entry')+' warns and marks only at 1800ms then reopens',async({page},info)=>{
  const errors=[],dialogs=[],phases=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.type());await d.dismiss();});let outcome;
  try{
    await start(page,inside);const boot=1,ok=await ask(page,inside);await ok.click({trial:true});
    await page.clock.install({time:new Date('2026-10-18T12:00:00Z')});
    await page.evaluate(()=>{window.performance=window._incDelayPerformance;});
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)));
    await page.evaluate(()=>{window._incDelayCancel=true;});
    await Promise.all([page.waitForEvent('dialog'),ok.click({force:true})]);
    await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('_incDelayEvents')).some(e=>e.kind==='reload-returned'&&e.boot===Number(sessionStorage.getItem('_incDelayBoot'))))).toBe(true);
    const before=await snapshot(page);expect(before.warnings).toBe(0);expect(before.marks).toBe(0);expect(before.pinned).toBe(inside);expect(before.flag).toBe(!inside);expect(before.transition).toBe(true);
    const probes=await page.evaluate(async()=>{const result=[];for(const name of CLOUD_WRITES)result.push({name,blocked:await cloud[name]()===null});return result;});expect(probes).toHaveLength(32);expect(probes.every(p=>p.blocked)).toBe(true);
    await page.clock.runFor(1799);const early=await snapshot(page);expect(early.warnings).toBe(0);expect(early.marks).toBe(0);
    await page.clock.runFor(1);await expect(page.locator('.mode-change-warning')).toBeVisible();outcome=await snapshot(page);expect(outcome.marks).toBe(1);expect(outcome.events.filter(e=>e.kind==='fallback-mark'&&e.boot===boot)).toHaveLength(1);
    const requested=outcome.events.find(e=>e.kind==='reload-returned'&&e.boot===boot),marked=outcome.events.find(e=>e.kind==='fallback-mark'&&e.boot===boot);expect(marked.at-requested.at).toBe(1800);phases.push({inside,before,early,after:outcome,probes});
    await page.evaluate(()=>{window._incDelayCancel=false;});await page.clock.resume();await page.reload();await ready(page,2);outcome=await snapshot(page);windowGuard(outcome.events,boot);expect(outcome.pinned).toBe(!inside);expect(outcome.warnings).toBe(0);expect(outcome.marks).toBe(0);
    expect(dialogs).toEqual(['beforeunload']);expect(errors).toEqual([]);
  }finally{outcome=await snapshot(page);fs.writeFileSync(info.outputPath('delay-canceled.json'),JSON.stringify({outcome,errors,dialogs,phases},null,2)+'\n');}
});
