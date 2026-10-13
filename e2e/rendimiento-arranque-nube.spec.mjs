import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {seedLoggedInDashboard,installFixtureClock,FIXTURE_NOW} from './fixtures.mjs';
import {startupBase,lagReference,hash,baselineHTML,installStartupProbe,instrumentStartup,startupSummary} from './helpers/arranque-nube-instrument.mjs';

test.use({serviceWorkers:'block',timezoneId:'Europe/Madrid'});
test.describe.configure({mode:'default',retries:0});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const candidate=readFileSync('public/index.html','utf8'),baseline=baselineHTML();
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();

function fixture(size,scenario){
  const expenses=Array.from({length:size},(_,i)=>({id:'startup-'+i,date:new Date(FIXTURE_NOW-i*3600000).toISOString(),
    amount:1+i%7,ent:'sabadell',category:'super',merchant:'Comercio sintético '+i,source:'manual:sabadell'}));
  const accounts=[{id:'startup-bank',ent:'sabadell',name:'Cuenta sintética',value:1000,role:'fijos',bankIban:'ES-SYNTHETIC-STARTUP'}];
  const settings={autoPrices:false,budgetCycle:false};
  const newer={accounts:[{...accounts[0],value:5000}],investments:[],assets:[],debts:[],fixed:[],flows:[],oneoffs:[],
    aportaciones:[],expenses:[],goals:[],shared:[],settings,budget:2500,onboarded:true,_savedAt:FIXTURE_NOW+60000};
  return {__seenVersion:'dev',accounts,expenses,budget:500,settings,_savedAt:FIXTURE_NOW-86400000,
    __cloudRows:{app_state:scenario==='offline'?[]:[{data:newer,updated_at:'2026-09-26T12:01:00Z'}],
      expenses:expenses.map(e=>({id:e.id,fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,source:e.source,no_card:false}))},
    __cloudDelays:{app_state:scenario==='slow'?60000:scenario==='pending'?900:0,expenses:scenario==='pending'?200:0},
    __cloudErrors:scenario==='offline'?{app_state:'synthetic offline',expenses:'synthetic offline'}:{}};
}
async function sample(browser,testInfo,size,scenario,variant){
  const context=await browser.newContext({...testInfo.project.use,serviceWorkers:'block'}),page=await context.newPage();
  const html=variant==='baseline'?baseline:candidate,rendered=instrumentStartup(html,{withoutCloud:scenario==='clear'});
  const origin=new URL(testInfo.project.use.baseURL).origin;let blocked=0;
  const record={sourceSHA:variant==='baseline'?startupBase:source,variant,size,scenario,cpuRate:6,
    HTMLSHA256:hash(html),instrumentedSHA256:hash(rendered),transport:'synthetic only; no external provider',phase:'prepared'};
  try{
    await context.route('**/*',route=>{
      const u=new URL(route.request().url());if(u.origin!==origin){blocked++;return route.abort('blockedbyclient');}
      if(u.pathname==='/'||u.pathname==='/index.html')return route.fulfill({body:rendered,contentType:'text/html'});
      return route.continue();
    });
    await installFixtureClock(page);await seedLoggedInDashboard(page,fixture(size,scenario));
    if(scenario==='offline')await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}));
    await page.addInitScript(installStartupProbe,{windowMs:3000});
    const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
    const response=await page.goto('/',{waitUntil:'commit'});record.servedSHA256=hash(await response.body());
    expect(record.servedSHA256).toBe(record.instrumentedSHA256);
    // La ventana se resuelve desde RAF nativo; ningún polling DOM entra en esos3s.
    record.raw=await page.evaluate(async()=>{const p=await window.__startupProbe.done;
      return {loadedAt:p.loadedAt,start:p.start,end:p.end,frames:p.frames,calls:p.calls,bankCalls:p.bankCalls,
        firstAmount:p.firstAmount,firstNetWorth:p.firstNetWorth,firstExpenseCount:p.firstExpenseCount,liveTabs:p.liveTabs,bootReady:p.bootReady,timedOut:p.timedOut};});
    record.metrics=startupSummary(record.raw);record.phase='complete';
    expect(record.metrics.bankCalls).toBe(0);expect(record.metrics.liveTabs).toBe(4);
    expect(blocked,'la muestra debe ser hermética, sin consultas externas').toBe(0);
    return record;
  }catch(error){record.phase='failed';record.failure={name:error.name};error.startupRecord=record;throw error;}
  finally{record.blockedExternalRequests=blocked;record.browser=context.browser().version();await context.close();}
}
for(const size of [2000,20000])for(const group of ['pending','offline','slow'])test('arranque nube A/B '+group+' '+size,async({browser},testInfo)=>{
  const report={schema:1,sourceSHA:source,baseSHA:startupBase,lagUtilityReference:lagReference,
    utilityReuse:'RAF delta>32ms and node-removal window; render anchor from PR219; heavy listener/timer probes omitted',
    lagCalibrationForNewerCloudNotAccredited:true,windowMs:3000,cpuRate:6,size,group,samples:[],complete:false};
  const out=testInfo.outputPath('arranque-nube-ab.json');mkdirSync(testInfo.outputDir,{recursive:true});
  try{
    const scenarios=group==='pending'?['clear','pending']:[group];
    for(const scenario of scenarios)for(const variant of ['baseline','candidate']){
      report.samples.push(await sample(browser,testInfo,size,scenario,variant));writeFileSync(out,JSON.stringify(report,null,2));
      await pause(100);
    }
    const get=(scenario,variant)=>report.samples.find(s=>s.scenario===scenario&&s.variant===variant).metrics;
    if(group==='pending'){
      const good=get('clear','baseline'),bad=get('pending','baseline'),after=get('pending','candidate');
      report.calibrated=bad.slowFrames>good.slowFrames;
      expect(report.calibrated,'la base debe distinguir nube nueva pendiente del caso sin nube').toBe(true);
      expect(after.slowFrames).toBeLessThan(bad.slowFrames);
      expect(after.seriesCalls).toBe(1);expect(after.seriesAfterSplash).toBe(0);expect(after.expensesAfterSplash).toBe(0);
      expect(report.samples.find(s=>s.scenario==='pending'&&s.variant==='candidate').raw.firstNetWorth).toBe(5000);
    }else{
      // Un frame/sondeo60ms de dispersión no puede esconder una espera nueva.
      const before=get(group,'baseline'),next=get(group,'candidate');
      expect(next.splashMs-before.splashMs).toBeLessThanOrEqual(60);
      if(group==='slow')expect(next.timedOut).toBe(true);
    }
    report.complete=true;
  }catch(error){if(error.startupRecord)report.samples.push(error.startupRecord);throw error;}
  finally{writeFileSync(out,JSON.stringify(report,null,2));console.log('ARRANQUE_NUBE_RAW '+JSON.stringify(report));await testInfo.attach('arranque-nube-ab',{path:out,contentType:'application/json'});}
});
