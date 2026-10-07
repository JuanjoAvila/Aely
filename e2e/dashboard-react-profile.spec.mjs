import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { seedLoggedInDashboard, installFixtureClock, dismissNews } from "./fixtures.mjs";
import { instrumentDashboard, installDashboardProfile } from "./dashboard-profile-instrument.mjs";

/* Diagnóstico de App/Dashboard reales, no un componente reconstruido.
   El A/B es una transformación VIRTUAL de la respuesta local: nunca producto entregado. */
test.use({serviceWorkers:"block"});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const html=readFileSync("public/index.html","utf8");
const instrumented=instrumentDashboard(html);
const guionSHA256=createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex");

function fixture(n){
  const expenses=Array.from({length:n},(_,i)=>({
    id:"11111111-1111-4111-8111-"+String(i).padStart(12,"0"),
    date:new Date(Date.parse("2026-09-26T10:00:00Z")-Math.floor(i/2)*3600000).toISOString(),
    amount:2+i%9,merchant:"Comercio sintético "+i,category:"super",source:"manual",ent:"sabadell",
  }));
  const deleted=expenses.slice(-100).map(e=>e.date.slice(0,10)+"|"+e.amount+"|"+e.merchant+"|"+e.id);
  return {expenses,deleted,budget:500,accounts:[{id:"e2e",ent:"sabadell",name:"Cuenta sintética",value:1000,role:"diario"}],
    __cloudRows:{expenses:expenses.map(e=>({id:e.id,fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,source:"manual:sabadell",no_card:false,nota:null,nota_edit:false}))}};
}

async function budgetCycles(page){
  for(let i=0;i<4;i++){
    await page.evaluate(()=>{const el=document.querySelector('.v4-budget');if(!el)throw new Error("Presupuesto no alcanzable");el.click();});
    await delay(350);
    await page.evaluate(()=>{if(!document.querySelector('.v4-budget-sheet'))throw new Error("Apertura presupuesto no aterrizó");history.back();});
    await delay(450);
    await page.evaluate(()=>{if(document.querySelector('.v4-budget-sheet'))throw new Error("Back presupuesto no aterrizó");});
  }
}

async function measured(page,mode,action){
  await page.evaluate(mode=>window.__dashProfile.begin(mode),mode);
  await action();await delay(250);
  // Las esperas de polling y el oracle no contaminan la ventana de rAF/coste medida.
  const result=await page.evaluate(()=>window.__dashProfile.end());
  result.check=await page.evaluate(()=>window.__dashProfile.verify());
  result.dom=await page.evaluate(()=>window.__dashProfile.verifyDOM());
  return result;
}

for(const size of [3000,5200])test("Dashboard real: frecuencia recientes y A/B virtual "+size,async({page},testInfo)=>{
  test.setTimeout(90000);
  const localOrigin=new URL(testInfo.project.use.baseURL).origin;
  let blockedExternal=0,htmlResponses=0;
  await page.context().route("**/*",async route=>{
    const u=new URL(route.request().url());
    if(u.origin!==localOrigin){blockedExternal++;return route.abort("blockedbyclient");}
    if(route.request().isNavigationRequest()&&(u.pathname==="/"||u.pathname==="/index.html")){
      htmlResponses++;return route.fulfill({status:200,contentType:"text/html",body:instrumented.html});
    }
    return route.continue();
  });
  await installFixtureClock(page);await seedLoggedInDashboard(page,fixture(size));
  await page.addInitScript(installDashboardProfile);
  const cdp=await page.context().newCDPSession(page);await cdp.send("Emulation.setCPUThrottlingRate",{rate:6});
  const report={schema:1,sourceSHA:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),declaredSourceSHA:process.env.MC_DASH_SOURCE_SHA||null,size,cpuRate:6,guionSHA256,
    htmlSHA256:instrumented.sourceSHA256,instrumentedSHA256:instrumented.instrumentedSHA256,
    model:"App real; fixture Supabase; cache virtual expenses/deleted; no red bancaria",phases:[],controls:[],status:"running"};
  const output=testInfo.outputPath("dashboard-react-profile.json");mkdirSync(testInfo.outputDir,{recursive:true});
  const save=()=>writeFileSync(output,JSON.stringify({...report,blockedExternal,htmlResponses},null,2));
  try{
    await page.goto("/");await page.waitForFunction(()=>!!window.__dashProfile.state&&!!document.querySelector('.botnav')&&!document.getElementById('mc-load'));
    await dismissNews(page);await delay(5000);
    expect(htmlResponses).toBe(1);
    expect(await page.evaluate(()=>window.__dashProfile.state.expenses.length)).toBe(size);
    expect(await page.evaluate(()=>window.__dashProfile.state.deleted.length)).toBe(100);
    expect(await page.evaluate(()=>typeof window.__dashProfile.sync)).toBe("function");
    report.appVersion=await page.evaluate(()=>CONFIG.APP_VERSION);
    report.browser=page.context().browser().version();
    const baseline=await measured(page,"baseline",()=>budgetCycles(page));report.phases.push(baseline);
    const cached=await measured(page,"virtual-cache",()=>budgetCycles(page));report.phases.push(cached);
    expect(baseline.metrics.renders).toBeGreaterThanOrEqual(8);
    expect(baseline.metrics.computes).toBe(baseline.metrics.renders);
    expect(cached.metrics.hits).toBeGreaterThanOrEqual(7);
    expect(cached.metrics.computes).toBeLessThan(cached.metrics.renders);
    expect(cached.check).toEqual(baseline.check);expect(cached.dom).toEqual(baseline.dom);
    expect(baseline.expensesWrites).toBe(0);expect(cached.expensesWrites).toBe(0);
    await page.evaluate(()=>{const p=window.__dashProfile;p.originalExpenses=p.state.expenses;p.originalDeleted=p.state.deleted;});
    // Idéntico contrato con state nuevo y referencias relevantes conservadas.
    for(const [name,mutate] of [
      ["settings",()=>{const p=window.__dashProfile;p.set(s=>({...s,settings:{...s.settings,profileSyntheticToggle:!s.settings.profileSyntheticToggle}}));}],
      ["edit",()=>{const p=window.__dashProfile;p.set(s=>({...s,expenses:s.expenses.map((e,i)=>i===0?{...e,amount:e.amount+1,merchant:"Edición sintética"}:e)}));}],
      ["undo-edit",()=>{const p=window.__dashProfile;p.set(s=>({...s,expenses:p.originalExpenses}));}],
      ["manual-legacy",()=>{const p=window.__dashProfile;p.set(s=>({...s,deleted:(s.deleted||[]).concat([keyOfExpenseLegacy(s.expenses[0])])}));}],
      ["undo-remove",()=>{const p=window.__dashProfile;p.set(s=>({...s,deleted:p.originalDeleted}));}],
      ["clock",()=>{const p=window.__dashProfile,NativeDate=Date,shift=86400000;
        function FixtureDate(...args){return new.target?Reflect.construct(NativeDate,args.length?args:[NativeDate.now()+shift],new.target):new NativeDate(NativeDate.now()+shift).toString();}
        Object.setPrototypeOf(FixtureDate,NativeDate);FixtureDate.prototype=NativeDate.prototype;FixtureDate.now=()=>NativeDate.now()+shift;window.Date=FixtureDate;
        p.set(s=>({...s,settings:{...s.settings,profileSyntheticClock:true}}));}],
    ]){
      const before=await page.evaluate(()=>{const p=window.__dashProfile;p.before={expenses:p.state.expenses,deleted:p.state.deleted,json:JSON.stringify(p.state.expenses)};return {computes:p.metrics.computes,hits:p.metrics.hits,rows:p.verify().rows};});
      await page.evaluate(mutate);await delay(350);
      const after=await page.evaluate(()=>{const p=window.__dashProfile;if(JSON.stringify(p.before.expenses)!==p.before.json)throw new Error("Mutación in-place del histórico");return {computes:p.metrics.computes,hits:p.metrics.hits,check:p.verify(),dom:p.verifyDOM(),sameExpenses:p.state.expenses===p.before.expenses,sameDeleted:p.state.deleted===p.before.deleted};});
      if(name==="settings"||name==="clock"){expect(after.check.rows).toEqual(before.rows);expect(after.hits).toBeGreaterThan(before.hits);}
      else expect(after.computes).toBeGreaterThan(before.computes);
      if(name==="settings"||name==="clock"){expect(after.sameExpenses).toBe(true);expect(after.sameDeleted).toBe(true);}
      if(name==="edit"||name==="undo-edit"){expect(after.sameExpenses).toBe(false);expect(after.sameDeleted).toBe(true);}
      if(name==="manual-legacy"||name==="undo-remove"){expect(after.sameExpenses).toBe(true);expect(after.sameDeleted).toBe(false);}
      if(name==="edit")expect(after.check.rows[0].merchant).toBe("Edición sintética");
      if(name==="manual-legacy")expect(after.check.rows.some(e=>e.id===before.rows[0].id)).toBe(false);
      if(name==="undo-edit"||name==="undo-remove")expect(after.check.rows).toEqual(baseline.check.rows);
      report.controls.push({name,before,after});
    }
    const sync=await measured(page,"virtual-cache",async()=>{
      await page.evaluate(async()=>{const p=window.__dashProfile;
        window.__e2eCloudRows.expenses.push({id:"22222222-2222-4222-8222-222222222222",fecha:"2026-09-28T12:00:00Z",importe:17,comercio:"Alta nube sintética",cat:"super",source:"manual:sabadell"});
        await p.sync();});await delay(500);
    });report.phases.push({...sync,action:"sync-cloud-double"});
    expect(sync.check.rows[0].merchant).toBe("Alta nube sintética");
    // Control deliberadamente malo, separado de las métricas naturales y del síntoma humano.
    const bad=await measured(page,"baseline",async()=>{
      for(let i=0;i<3;i++){await delay(150);await page.evaluate(()=>{const end=performance.now()+180;while(performance.now()<end){}});}
    });report.phases.push({...bad,action:"artificial-block-control"});
    expect(Math.max(0,...bad.frames)).toBeGreaterThan(100);
    expect(bad.longtasks.some(ms=>ms>=100)).toBe(true);
    const recovered=await measured(page,"baseline",()=>delay(1000));report.phases.push({...recovered,action:"recovery-natural"});
    expect(recovered.frames.length).toBeGreaterThan(5);
    const ordered=recovered.frames.slice().sort((a,b)=>a-b),median=ordered[Math.floor(ordered.length/2)];
    expect(Math.max(...bad.frames)).toBeGreaterThan(median*3);
    report.controls.push({name:"instrument-discriminates-block",badMaxFrame:Math.max(...bad.frames),recoveredMedianFrame:median});
    report.status="diagnostic-contract-passed";
  }catch(error){report.status="failed";report.error=String(error);throw error;}
  finally{save();await page.evaluate(()=>window.__dashProfile?.dispose()).catch(()=>{});await testInfo.attach("dashboard-react-profile",{path:output,contentType:"application/json"});}
});
