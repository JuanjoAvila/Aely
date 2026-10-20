import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* BANCO DE PRUEBAS (petición 2026-07-24: «un entorno de pruebas solamente para mí dentro de mi
   móvil, para probar antes de que se suba a prod para el resto»).

   Lo que hay que blindar con tests no es la UI, es la PROMESA: mientras estás dentro, tu cartera
   real no se toca y no sale nada a la nube. Si eso falla, el modo pruebas es peor que no tenerlo,
   porque invita a trastear con datos que sí son reales. */

const REAL = "micartera_v3";
const TEST = "micartera_sandbox";

/** Deja el móvil «dentro del banco de pruebas» antes de que arranque la app. */
async function entraEnPruebas(page, { real, pruebas }) {
  // OJO: addInitScript corre en CADA carga, también tras el location.reload() de salir del modo
  // pruebas. Sin este guardo, el test volvería a activarlo y nunca vería la salida.
  await page.addInitScript(([r, p, kR, kT]) => {
    if (localStorage.getItem("_e2eSeeded")) return;
    localStorage.setItem("_e2eSeeded", "1");
    localStorage.setItem(kR, JSON.stringify(r));
    localStorage.setItem(kT, JSON.stringify(p));
    localStorage.setItem("_mcSandbox", "1");
    localStorage.setItem("_seenVersion", "dev");
  }, [real, pruebas, REAL, TEST]);
}

test("dentro del modo pruebas se ven los datos de PRUEBA, no los reales", async ({ page }) => {
  // Se siembra el estado base con el helper y luego se duplica a las dos claves con presupuestos
  // distintos: así se ve de un vistazo cuál de los dos está leyendo la app.
  await seedLoggedInDashboard(page, { budget: 500 });
  await page.addInitScript(([kR, kT]) => {
    const base = JSON.parse(localStorage.getItem(kR));
    localStorage.setItem(kT, JSON.stringify(Object.assign({}, base, { budget: 9999 })));
    localStorage.setItem("_mcSandbox", "1");
  }, [REAL, TEST]);

  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  // La banda naranja avisa de que NO son datos reales: sin ella es cuestión de tiempo apuntar un
  // gasto de verdad en la cartera de mentira.
  await expect(page.locator(".sandbox-bar")).toBeVisible();

  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-gastos-summary")).toContainText("9999");
});

test("lo que haces en pruebas NO toca la cartera real", async ({ page }) => {
  await seedLoggedInDashboard(page, { budget: 500 });
  await page.addInitScript(([kR, kT]) => {
    const base = JSON.parse(localStorage.getItem(kR));
    localStorage.setItem(kT, JSON.stringify(Object.assign({}, base, { budget: 9999 })));
    localStorage.setItem("_mcSandbox", "1");
  }, [REAL, TEST]);

  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  // Desde 4.8.0 el estado va PARTIDO: los gastos viven en `<clave>_exp`. Se vigilan las dos
  // claves reales — la promesa es que ninguna se toque estando en pruebas.
  const realAntes = await page.evaluate((k) => [localStorage.getItem(k), localStorage.getItem(k + "_exp")], REAL);

  // Apunta un gasto dentro del modo pruebas (FAB → teclado propio → Guardar).
  await page.locator(".botnav-fab").click();
  await expect(page.locator(".v4-sheet")).toBeVisible();
  await page.waitForTimeout(450);   // fin de la animación sheetup
  for (const k of ["7", "7"]) await page.locator(".v4-keys button", { hasText: new RegExp(`^${k}$`) }).first().click();
  await page.locator(".v4-exp-sheet > .v4-cta").click();
  await page.waitForTimeout(900);   // el guardado a localStorage va con debounce de 400 ms

  // El gasto entra en la cartera de PRUEBAS…
  const gastosPrueba = await page.evaluate((k) => JSON.parse(localStorage.getItem(k + "_exp") || "[]"), TEST);
  expect(gastosPrueba.some((e) => Math.abs(e.amount) === 77)).toBe(true);

  // …y la REAL sigue byte a byte como estaba, en sus dos claves.
  const realDespues = await page.evaluate((k) => [localStorage.getItem(k), localStorage.getItem(k + "_exp")], REAL);
  expect(realDespues).toEqual(realAntes);
});

test("salir del modo pruebas devuelve la cartera real intacta", async ({ page }) => {
  await entraEnPruebas(page, {
    real: { budget: 500, expenses: [], accounts: [], investments: [], assets: [], debts: [], fixed: [], flows: [], oneoffs: [], aportaciones: [], goals: [], shared: [], history: [], obAccounts: [], settings: {}, onboarded: true, _dataVer: 6 },
    pruebas: { budget: 9999, expenses: [], accounts: [], investments: [], assets: [], debts: [], fixed: [], flows: [], oneoffs: [], aportaciones: [], goals: [], shared: [], history: [], obAccounts: [], settings: {}, onboarded: true, _dataVer: 6 },
  });
  await page.goto("/");
  await expect(page.locator(".sandbox-bar")).toBeVisible({ timeout: 15_000 });

  // Tocar la banda = salir (y recargar).
  await page.locator(".sandbox-bar").click();
  await page.waitForLoadState("load");
  await expect(page.locator(".sandbox-bar")).toHaveCount(0);

  const sandboxFlag = await page.evaluate(() => localStorage.getItem("_mcSandbox"));
  expect(sandboxFlag).toBeNull();

  // La cartera de pruebas se queda guardada (para seguir otro día), la real no se ha tocado.
  const real = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), REAL);
  expect(real.budget).toBe(500);
  const test0 = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), TEST);
  expect(test0.budget).toBe(9999);
});

test("fuera del modo pruebas no hay ni rastro de la banda", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".sandbox-bar")).toHaveCount(0);
});

import fs from 'node:fs';

for(const [lang,action] of [['es','activate'],['en','activate'],['ca','activate'],['es','empty'],['es','deactivate']]){
  test(`INC1710R canceled reload ${lang} ${action}: warning, closed diagnostic and reopen`,async({page},info)=>{
    const errors=[],dialogs=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',async d=>{dialogs.push(d.type());await d.dismiss();});
    await seedLoggedInDashboard(page,{__seedOnce:true,__cloudRows:{profiles:[{is_admin:true}]},budget:500,settings:{autoPrices:false,theme:'green',lang}});
    await page.addInitScript(({action})=>{
      if(!sessionStorage.getItem('_incCancelPrepared')){
        sessionStorage.setItem('_incCancelPrepared','1');
        localStorage.setItem('_mcAdminProfile',JSON.stringify({uid:'e2e-user',isAdmin:true}));
        const s=JSON.parse(localStorage.getItem('micartera_v3'));
        localStorage.setItem('micartera_sandbox',JSON.stringify({...s,budget:9999,accounts:[]}));
        if(action!=='activate')localStorage.setItem('_mcSandbox','1');
      }
      window.addEventListener('beforeunload',e=>{if(window._incCancelReload){e.preventDefault();e.returnValue='';}});
    },{action});
    await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await page.locator('#mc-load').waitFor({state:'detached'});await dismissNews(page);
    const news=page.locator('.wn-panel');if(await news.count())await news.getByRole('button',{name:await page.evaluate(()=>t('wn_close')),exact:true}).click();
    await page.locator('.v4-avatar').click();
    await page.getByRole('button',{name:{es:'Ir a Ajustes',en:'Go to Settings',ca:'Ves a Ajustos'}[lang],exact:true}).click();
    await page.getByRole('button',{name:new RegExp(action==='empty'?'Vaciar la cartera de pruebas':'Banco de pruebas')}).click();
    await page.evaluate(()=>{window._incCancelReload=true;});
    const ok=action==='activate'?'Entrar a probar':action==='empty'?'Vaciar':'Salir a mi cartera real';
    await Promise.all([page.waitForEvent('dialog'),page.getByRole('dialog').getByRole('button',{name:ok,exact:true}).click()]);
    const warning=page.locator('.mode-change-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveText({es:'Cierra y vuelve a abrir la app para terminar el cambio de modo.',en:'Close and reopen the app to finish changing mode.',ca:'Tanca i torna a obrir l’app per acabar el canvi de mode.'}[lang]);
    const guarded=await page.evaluate(async()=>{
      const results=[];for(const name of CLOUD_WRITES)results.push(await cloud[name]());
      return {results,writers:CLOUD_WRITES,pinned:mcSandbox(),flag:mcSandboxFlag(),transition:mcSandboxTransition(),marks:performance.getEntriesByName('mc_mode_change_reopen_required').map(e=>({name:e.name,detail:e.detail})),realBudget:mcLoadRaw('micartera_v3').budget};
    });
    expect(dialogs).toEqual(['beforeunload']);expect(guarded.transition).toBe(true);expect(guarded.pinned).toBe(action!=='activate');
    expect(guarded.results).toHaveLength(33);expect(guarded.writers).toContain('renameExpense');expect(new Set(guarded.writers).size).toBe(33);expect(guarded.results.every(r=>r===null)).toBe(true);
    expect(guarded.marks).toEqual([{name:'mc_mode_change_reopen_required',detail:null}]);expect(guarded.realBudget).toBe(500);
    // The same browser reload, now allowed, stands in for closing/reopening this document.
    await page.evaluate(()=>{window._incCancelReload=false;});await page.reload();
    await page.waitForFunction(()=>document.readyState==='complete'&&typeof mcSandbox==='function');
    await page.locator('#mc-load').waitFor({state:'detached'});
    expect(await page.evaluate(()=>({pinned:mcSandbox(),empty:mcSandboxVacio(),transition:mcSandboxTransition(),budget:mcLoadRaw(mcStateKey()).budget}))).toEqual({pinned:action!=='deactivate',empty:action==='empty',transition:false,budget:action==='empty'?0:action==='activate'?9999:500});
    await expect(warning).toHaveCount(0);expect(errors).toEqual([]);
    fs.writeFileSync(info.outputPath('canceled-reload.json'),JSON.stringify({lang,action,dialogs,guarded,errors,telemetry:'local Performance mark only; no guarded cloud writer bypass'},null,2)+'\n');
  });
}

// No production endpoint is contacted. Keep every mock write, including startup and the
// pending real push below; the interval is confirmation capture → old document pagehide.
for(const action of ['activate','empty','deactivate']) test(`INC171001 window fence Settings ${action}: exact reload and whole-window isolation`,async({page,context},info)=>{
  const events=[],errors=[],external=[],probes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===new URL(info.project.use.baseURL).origin)return r.continue();external.push({origin:u.origin,method:r.request().method()});return r.abort('blockedbyclient');});
  await seedLoggedInDashboard(page,{__seedOnce:true,__cloudRows:{profiles:[{is_admin:true}]},budget:500,settings:{autoPrices:false,theme:'green'}});
  await page.addInitScript(({action})=>{
    const keys=['micartera_v3','micartera_v3_exp','micartera_v3_balhist'];
    const real=()=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
    const log=(kind,detail)=>{const rows=JSON.parse(sessionStorage.getItem('_incWholeEvents')||'[]');rows.push({kind,time:performance.timeOrigin+performance.now(),boot:Number(sessionStorage.getItem('_incWholeBoot')),flag:localStorage.getItem('_mcSandbox'),pinned:typeof mcSandbox==='function'?mcSandbox():null,transition:typeof mcSandboxTransition==='function'?mcSandboxTransition():false,...detail});sessionStorage.setItem('_incWholeEvents',JSON.stringify(rows));};
    window._incWholeAfterFlush=()=>log('pagehide-after-flush',{real:real()});
    sessionStorage.setItem('_incWholeBoot',String(Number(sessionStorage.getItem('_incWholeBoot')||0)+1));
    if(!sessionStorage.getItem('_incWholePrepared')){
      sessionStorage.setItem('_incWholePrepared','1');const s=JSON.parse(localStorage.getItem('micartera_v3'));
      localStorage.setItem('micartera_v3_exp','[]');localStorage.setItem('micartera_v3_balhist','{}');
      localStorage.setItem('micartera_sandbox',JSON.stringify({...s,budget:9999,accounts:[],settings:{...s.settings,profile:{fullName:'INC171001_SEED_ONLY'}}}));localStorage.setItem('micartera_sandbox_exp','[]');
      if(action!=='activate')localStorage.setItem('_mcSandbox','1');
      localStorage.setItem('_mcAdminProfile',JSON.stringify({uid:'e2e-user',isAdmin:true}));
    }
    // Retain exact bytes BEFORE the new app boot can perform its normal real-session sync.
    log('boot',{real:real()});
    const descriptor=Object.getOwnPropertyDescriptor(window,'supabase');
    Object.defineProperty(window,'supabase',{configurable:true,get:descriptor.get,set(lib){descriptor.set(lib);const mocked=descriptor.get();if(!mocked?.createClient)return;const create=mocked.createClient;mocked.createClient=()=>{const client=create(),from=client.from;client.from=table=>{const chain=from(table);for(const method of ['insert','update','upsert','delete'])if(chain[method]){const original=chain[method];chain[method]=(...args)=>{log('write',{table,method,budget:args[0]?.data?.budget,payload:args[0],hasSeed:JSON.stringify(args).includes('INC171001_SEED_ONLY'),stack:new Error().stack});return original(...args);};}return chain;};window._incWholeInstrumented=true;return client;};}});
    for(const method of ['back','pushState','replaceState']){const original=history[method];history[method]=function(...args){log('history-'+method,{state:history.state});if(method==='back'&&window._incHoldAsk){window._incHeldBack=()=>Reflect.apply(original,history,args);return;}return Reflect.apply(original,this,args);};}
    for(const event of ['popstate','beforeunload','pagehide'])window.addEventListener(event,()=>log(event,{real:real(),state:history.state}));
    document.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b?.closest('[role=dialog]'))return;
      const ok=action==='activate'?'Entrar a probar':action==='empty'?'Vaciar':'Salir a mi cartera real';
      if(!['Entrar a probar','Vaciar','Salir a mi cartera real'].includes(b.textContent))return;
      log('confirm',{real:real(),state:history.state});
      // A pending write through the REAL cloud API stays enabled. In the broken app the
      // canceled reload lets it fire with the old mode; a successful unload cancels the timer.
      const s=slimForCloud(mcLoadRaw(mcStateKey()));
      setTimeout(()=>{log('pending-writer-fired',{budget:s.budget});cloud.pushState('e2e-user',s,null);},0);
    },true);
  },{action});
  const snap=()=>page.evaluate(()=>({boot:Number(sessionStorage.getItem('_incWholeBoot')),events:JSON.parse(sessionStorage.getItem('_incWholeEvents')||'[]'),flag:localStorage.getItem('_mcSandbox'),emptyFlag:localStorage.getItem('_mcSandboxVacio'),pinned:mcSandbox(),emptyPinned:mcSandboxVacio(),key:mcStateKey(),budget:mcLoadRaw(mcStateKey())?.budget,sandbox:mcLoadRaw('micartera_sandbox'),instrumented:window._incWholeInstrumented,uiInside:document.body.innerText.includes('Banco de pruebas: DENTRO')}));
  const ready=async(boot)=>{
    // load belongs to the NEW document; the init-script counter alone precedes the bundle.
    await page.waitForFunction(n=>document.readyState==='complete'&&Number(sessionStorage.getItem('_incWholeBoot'))===n&&typeof mcLoadRaw==='function'&&typeof mcSandbox==='function',boot);
    await page.locator('#mc-load').waitFor({state:'detached'});
    // Registered after App's listener, this reads bytes after the actual pending flush.
    await page.evaluate(()=>window.addEventListener('pagehide',window._incWholeAfterFlush));
  };
  let outcome;
  try{
    await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await ready(1);await dismissNews(page);
    // No startup-settling sleep and no write counters reset. Prove writers remain usable.
    if(action==='activate')await page.evaluate(()=>cloud.pushState('e2e-user',slimForCloud(mcLoadRaw(mcStateKey())),null));
    const open=async()=>{await page.locator('.v4-avatar').click();await page.getByRole('button',{name:'Ir a Ajustes',exact:true}).click();await expect(page.locator('.settings-push.open')).toBeVisible();};
    await open();
    if(action==='activate'){
      await page.getByRole('button',{name:/Accesibilidad/}).first().click();
      await page.getByRole('button',{name:/Reducir animaciones/}).click();
      // This edit must be durable locally but still pending its normal 1200ms cloud push.
      await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('micartera_v3')).settings.reduceMotion)).toBe(true);
      expect((await snap()).events.some(e=>e.kind==='write'&&e.payload?.data?.settings?.reduceMotion===true)).toBe(false);
    }
    await page.getByRole('button',{name:new RegExp(action==='empty'?'Vaciar la cartera de pruebas':action==='activate'?'Banco de pruebas':'Banco de pruebas: DENTRO')}).click();
    const ok=action==='activate'?'Entrar a probar':action==='empty'?'Vaciar':'Salir a mi cartera real';
    await page.evaluate(()=>{window._incHoldAsk=true;});
    await page.getByRole('dialog').getByRole('button',{name:ok,exact:true}).click();
    await page.waitForFunction(()=>typeof window._incHeldBack==='function');
    const interval=await page.evaluate(async()=>{
      const rows=()=>JSON.parse(sessionStorage.getItem('_incWholeEvents'));
      const before=rows().filter(e=>e.kind==='write').length;
      // The real writer is callable here: flag has NOT changed and Ask's pop is held.
      await cloud.pushState('e2e-user',slimForCloud(mcLoadRaw(mcStateKey())),null);
      return {before,after:rows().filter(e=>e.kind==='write').length,flag:mcSandboxFlag(),pinned:mcSandbox(),transition:mcSandboxTransition()};
    });
    probes.push({interval});
    expect(interval.after-interval.before,'confirm→Ask pop must block actual writes before the flag changes').toBe(0);
    expect(interval.transition).toBe(true);
    expect(interval.flag).toBe(action!=='activate');
    const probe=await page.evaluate(async()=>{const results=[];for(const name of CLOUD_WRITES)results.push({name,result:await cloud[name]()});return results;});
    probes[0].allWriters=probe;
    expect(probe).toHaveLength(33);expect(probe.map(p=>p.name)).toContain('renameExpense');expect(new Set(probe.map(p=>p.name)).size).toBe(33);
    expect(probe.every(p=>p.result===null)).toBe(true);
    await Promise.all([page.waitForEvent('load'),page.evaluate(()=>{window._incHoldAsk=false;window._incHeldBack();})]);
    await ready(2);
    outcome=await snap();expect(outcome.instrumented).toBe(true);
    const confirm=outcome.events.find(e=>e.kind==='confirm'),hide=outcome.events.find(e=>e.kind==='pagehide-after-flush'&&e.boot===1),boot=outcome.events.find(e=>e.kind==='boot'&&e.boot===2);
    expect(confirm).toBeTruthy();expect(hide).toBeTruthy();expect(boot).toBeTruthy();
    expect(boot.real).toEqual(hide.real);
    if(action!=='activate')expect(hide.real).toEqual(confirm.real);
    expect(outcome.events.filter(e=>e.kind==='write'&&e.time>=confirm.time&&e.time<=hide.time)).toEqual([]);
    for(const e of outcome.events.filter(e=>e.kind==='pending-writer-fired'&&e.boot===1))expect(e.transition).toBe(true);
    expect(outcome.events.filter(e=>e.kind==='write'&&e.hasSeed)).toEqual([]);
    if(action==='activate')expect(JSON.parse(boot.real.micartera_v3).settings.reduceMotion).toBe(true);
    if(action==='activate'){
      expect(outcome.events.some(e=>e.kind==='write'&&e.time<confirm.time&&e.budget===500)).toBe(true);
      expect(outcome.pinned).toBe(true);expect(outcome.budget).toBe(9999);await expect(page.locator('.sandbox-bar')).toBeVisible();
      // A writer remains enabled at the call site, but the unchanged sandbox guard blocks it.
      const n=outcome.events.filter(e=>e.kind==='write').length;
      await page.evaluate(()=>cloud.pushState('e2e-user',slimForCloud(mcLoadRaw(mcStateKey())),null));
      expect((await snap()).events.filter(e=>e.kind==='write')).toHaveLength(n);
    }else if(action==='empty'){
      expect(outcome.emptyPinned).toBe(true);expect(outcome.sandbox.budget).toBe(0);expect(outcome.sandbox.expenses).toEqual([]);await expect(page.locator('.v4-ob-title')).toBeVisible();
    }else{expect(outcome.pinned).toBe(false);expect(outcome.budget).toBe(500);await expect(page.locator('.sandbox-bar')).toHaveCount(0);}
    if(action!=='empty'){await open();await expect(page.getByRole('button',{name:/Banco de pruebas/})).toContainText(action==='activate'?'Banco de pruebas: DENTRO':'Banco de pruebas');await page.locator('.settings-push-h .back').click();await expect(page.locator('.settings-push.open')).toHaveCount(0);await open();}
    if(action==='activate'){
      await page.getByRole('button',{name:/Banco de pruebas: DENTRO/}).click();
      await Promise.all([page.waitForEvent('load'),page.getByRole('dialog').getByRole('button',{name:'Salir a mi cartera real',exact:true}).click()]);
      await ready(3);
      // Returning uses the existing durable real state and normal startup/debounced push.
      await expect.poll(async()=>(await snap()).events.some(e=>e.kind==='write'&&e.boot===3&&e.table==='app_state'&&e.payload?.data?.settings?.reduceMotion===true)).toBe(true);
      expect((await snap()).events.filter(e=>e.kind==='write'&&e.hasSeed)).toEqual([]);
    }
    expect(errors).toEqual([]);expect(external.filter(e=>!['GET','HEAD','OPTIONS'].includes(e.method))).toEqual([]);
  }finally{
    outcome=await snap();events.push(...outcome?.events||[]);
    const artifact={action,outcome,events,probes,errors,external,conflictCopyKeyPresent:false};
    fs.writeFileSync(info.outputPath('whole-window.json'),JSON.stringify(artifact,null,2)+'\n');
  }
});
