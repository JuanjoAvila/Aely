import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {seedLoggedInDashboard,installFixtureClock,dismissNews} from './fixtures.mjs';
import {instalaSonda,inyectaFuga,retiraFuga} from './lag-banco-sonda.mjs';
import {recorrido,preparaTransporte,scroll,syntheticAck} from './lag-banco-recorrido.mjs';
import {instalaRetorno,instrumentaTotales,instrumentaArranque,bloqueoPorCausa,ventanaCruda} from './lag-banco-retorno.mjs';
import {resumen,discrimina,atribuciones} from './lag-banco-metricas.mjs';
import {curvasSVG,ultimaMuestra} from './lag-banco-informe.mjs';

test.use({serviceWorkers:'block',timezoneId:'Europe/Madrid'});
test.describe.configure({mode:'default',retries:0});
const normalCycles=Number(process.env.MC_LAG_BANCO_CYCLES||4);
const full=process.env.MC_LAG_BANCO_LONG==='1';
if(!Number.isInteger(normalCycles)||normalCycles<4||normalCycles>60)throw new Error('MC_LAG_BANCO_CYCLES:4..60');
if(full&&(normalCycles<40||normalCycles>60))throw new Error('Pasada larga:40..60 ciclos de30s (20..30min)');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const helperNames=['sonda','recorrido','metricas','informe','retorno'];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const leakLine=readFileSync(new URL('./lag-banco-sonda.mjs',import.meta.url),'utf8').split(/\r?\n/).findIndex(line=>line.includes('export function inyectaFuga'))+1;

function sourceMap(html){
  // Sólo una línea idéntica y única se atribuye a fuente; no inventar offsets tras separar idiomas.
  const source=new Map(),render=new Map();
  const order=JSON.parse(readFileSync('src/build-order.json','utf8'));
  for(const file of ['src/shell.html',...order.map(n=>'src/modules/'+n)]){
    readFileSync(file,'utf8').split(/\r?\n/).forEach((text,i)=>{if(text.trim().length>=32){const list=source.get(text)||[];list.push({file,line:i+1});source.set(text,list);}});
  }
  html.split(/\r?\n/).forEach((text,i)=>{const list=render.get(text)||[];list.push(i+1);render.set(text,list);});
  return [...source].filter(([text,a])=>a.length===1&&render.get(text)?.length===1)
    .map(([text,a])=>({file:a[0].file,sourceLine:a[0].line,startLine:render.get(text)[0],endLine:render.get(text)[0]}));
}

async function prioritySetup(page,testInfo,size,epoch,startup){
  const html=readFileSync('public/index.html','utf8');
  const instrumented=instrumentaArranque(instrumentaTotales(html,readFileSync('src/modules/11-app-main.js','utf8')));
  const origin=new URL(testInfo.project.use.baseURL).origin;
  let blocked=0;
  await page.context().route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){blocked++;return route.abort('blockedbyclient');}
    if(url.pathname==='/'||url.pathname==='/index.html')return route.fulfill({body:instrumented,contentType:'text/html'});
    return route.continue();
  });
  const fixture=recorrido.fixture(size);fixture.__seenVersion=html.match(/APP_VERSION:\s*"([^"]+)"/)[1];
  let seed;
  await seedLoggedInDashboard({addInitScript:async(fn,arg)=>{seed={fn,arg};}},fixture);
  // Calendario y fixture en la misma llamada: un ancla sembrada en el mes real falsearía el retorno.
  await page.addInitScript({content:'('+instalaSonda.toString()+')('+JSON.stringify(sourceMap(html))+');('+instalaRetorno.toString()+')('+JSON.stringify({epoch,startup})+');('+seed.fn.toString()+')('+JSON.stringify(seed.arg)+');'});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
  const response=await page.goto('/',{waitUntil:'commit'});
  const servedHTMLSHA256=hash(await response.body());expect(servedHTMLSHA256).toBe(hash(instrumented));
  return {cdp,blocked:()=>blocked,report:{schema:2,sourceSHA:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    executionBase:'788432f4682c199edd785f6973d9353330c0064a',htmlSHA256:hash(html),instrumentedSHA256:hash(instrumented),servedHTMLSHA256,
    guionSHA256:hash(readFileSync(new URL(import.meta.url))),helperHashes:Object.fromEntries(helperNames.map(n=>[n,hash(readFileSync(new URL('./lag-banco-'+n+'.mjs',import.meta.url)))])),
    cpuRate:6,size,epoch,browser:page.context().browser().version(),phase:'prepared',valid:false,
    model:'App real; synthetic cloud; web path; Date offset only; real RAF/performance/scheduler',
    limits:['No OS suspension or native queued timer burst','Native widget IPC not exercised','Probe adds work; async elapsed is not CPU blocking','Unattributed longtask time has no inferred cause'],
    splashMinimumMs:520,splashChanged:false}};
}
async function prioritySave(page,testInfo,setup,name){
  const {report}=setup;report.blockedRequests=setup.blocked();
  if(report.metrics){report.blockingByCauseMs=bloqueoPorCausa(report.metrics.longtasks,report.metrics.events);
    if(report.variant==='startup-5s'&&report.requestedScrollSecond===null){
      report.residualWorkEndMsObserved=Math.max(0,...report.metrics.longtasks.map(e=>e.start+e.duration-report.metrics.start));
      report.curtainEstimateLimit='Idle observation only; readiness and any additional splash wait require a separate actual A/B';}}
  mkdirSync(testInfo.outputDir,{recursive:true});const out=testInfo.outputPath(name+'.json');writeFileSync(out,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));await testInfo.attach(name,{path:out,contentType:'application/json'});
  await page.evaluate(()=>{const p=window.__lagBanco;p.restoreCauses?.();p.restoreForeground?.();p.restore();}).catch(()=>{});
}

// Caso 3 primero: cada combinación arranca una página nueva; ninguna usa un calentamiento previo.
for(const size of [2000,20000])for(const tab of ['inicio','gastos'])for(const second of [null,0,1,2,3])
test('arranque 5s: '+size+' '+tab+' scroll segundo '+second,async({page},testInfo)=>{
  const setup=await prioritySetup(page,testInfo,size,Date.parse('2026-09-26T12:00:00Z'),{tab});
  const report=setup.report;report.variant='startup-5s';report.tab=tab;report.requestedScrollSecond=second;
  try{
    await page.evaluate(()=>window.__lagBanco.startupStarted);
    await page.evaluate(()=>{window.__lagBanco.landings=[];});
    if(second!==null){
      const remaining=second*1000-await page.evaluate(()=>performance.now()-window.__lagBanco.elapsedStart);
      if(remaining>0)await pause(remaining);
      report.actualScrollSecond=await page.evaluate(()=>(performance.now()-window.__lagBanco.elapsedStart)/1000);
      await scroll(page,setup.cdp,true,tab);
      expect(report.actualScrollSecond).toBeLessThan(second+1);
    }
    report.metrics=await page.evaluate(()=>window.__lagBanco.windowDone);
    report.landings=await page.evaluate(()=>window.__lagBanco.landings);
    expect(report.metrics.elapsedMs).toBeGreaterThanOrEqual(5000);
    expect(report.metrics.frames).toBeGreaterThan(0);
    expect(await page.evaluate(()=>document.querySelector('.botnav-tab.active')?.dataset.tour)).toBe(tab);
    report.valid=true;report.phase='complete';
  }catch(error){report.failure={code:error.message.match(/scroll-[\w-]+/)?.[0]||'startup-invalid',record:error.scrollRecord};throw error;}
  finally{report.landings=await page.evaluate(()=>window.__lagBanco.landings||[]).catch(()=>[]);
    if(!report.metrics)report.metrics=await ventanaCruda(page).catch(()=>null);
    await prioritySave(page,testInfo,setup,'banco-arranque');}
});

// Caso 1: diez segundos reales en ambos brazos; sólo el calendario diferencia 10s de cuatro horas.
for(const size of [2000,20000])for(const [boundary,epoch]of [['same-day','2026-09-26T12:00:00Z'],['day','2026-09-26T21:58:00Z'],['month','2026-09-30T21:58:00Z']])
for(const hours of [false,true])test('retorno 15s: '+size+' '+boundary+' '+(hours?'4h calendario':'10s'),async({page},testInfo)=>{
  const setup=await prioritySetup(page,testInfo,size,Date.parse(epoch),null),report=setup.report;
  report.variant='foreground-15s';report.boundary=boundary;report.calendarHours=hours?4:0;
  try{
    await page.waitForFunction(()=>!!document.querySelector('.botnav')&&!document.getElementById('mc-load'));
    await dismissNews(page);await pause(6000);await preparaTransporte(page);
    const before=await page.evaluate(()=>{const p=window.__lagBanco;return {calendar:Date.now(),real:performance.now(),snapshot:p.snapshot(),bank:p.bankSync};});
    await page.evaluate(()=>{const p=window.__lagBanco;p.visibility='hidden';document.dispatchEvent(new Event('visibilitychange'));});
    await pause(10000);
    const returning=await page.evaluate(hours=>{
      const p=window.__lagBanco;if(hours)p.advanceCalendar(4*3600000-10000);
      const overdue=[...p.timers.values()].filter(t=>t.calendarDue<Date.now()).length;
      p.landings=[];p.armWindow(15000);p.visibility='visible';document.dispatchEvent(new Event('visibilitychange'));
      return {calendar:Date.now(),real:performance.now(),theoreticalCalendarOverdueTimers:overdue};
    },hours);
    report.background={realMs:returning.real-before.real,calendarMs:returning.calendar-before.calendar,
      theoreticalCalendarOverdueTimers:returning.theoreticalCalendarOverdueTimers,overdueLimit:'Calendar deadlines do not reschedule native callbacks'};
    await scroll(page,setup.cdp,true,'inicio');await scroll(page,setup.cdp,false,'inicio');
    await page.evaluate(()=>document.querySelector('.botnav-tab[data-tour="gastos"]').click());await pause(750);
    await scroll(page,setup.cdp,true,'gastos');
    report.metrics=await page.evaluate(()=>window.__lagBanco.windowDone);
    report.landings=await page.evaluate(()=>window.__lagBanco.landings);
    report.after=await page.evaluate(()=>{const p=window.__lagBanco;return {snapshot:p.snapshot(),bank:p.bankSync,transport:p.transport};});
    expect(report.after.bank-before.bank).toBe(0);
    expect(report.after.snapshot.expensesWrites-before.snapshot.expensesWrites).toBe(0);
    expect(report.after.transport.pullExpenses?.succeeded||0).toBeGreaterThan(0);
    expect(report.metrics.elapsedMs).toBeGreaterThanOrEqual(15000);expect(report.metrics.frames).toBeGreaterThan(0);
    report.valid=true;report.phase='complete';
  }catch(error){report.failure={code:error.message.match(/scroll-[\w-]+/)?.[0]||'foreground-invalid',record:error.scrollRecord};throw error;}
  finally{report.landings=await page.evaluate(()=>window.__lagBanco.landings||[]).catch(()=>[]);
    if(!report.metrics)report.metrics=await ventanaCruda(page).catch(()=>null);
    await page.evaluate(()=>window.__lagBanco.restoreTransport?.()).catch(()=>{});await prioritySave(page,testInfo,setup,'banco-retorno');}
});

for(const size of [2000,20000])test('banco de pendiente con fuga de lifecycle: '+size,async({page},testInfo)=>{
  // Mismo presupuesto por ciclo que el banco previo; no se modifican timeouts del proyecto.
  test.setTimeout(Math.max(240000,(normalCycles+8)*30000+300000));
  const html=readFileSync('public/index.html','utf8'),map=sourceMap(html);
  const localOrigin=new URL(testInfo.project.use.baseURL).origin;
  let blocked=0;
  await page.context().route('**/*',route=>{
    if(new URL(route.request().url()).origin===localOrigin)return route.continue();
    blocked++;return route.abort('blockedbyclient');
  });
  await installFixtureClock(page);await seedLoggedInDashboard(page,recorrido.fixture(size));
  await page.addInitScript(instalaSonda,map);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
  const response=await page.goto('/');
  const servedHTMLSHA256=hash(await response.body());
  expect(servedHTMLSHA256,'el servidor debe entregar el HTML de este checkout').toBe(hash(readFileSync('public/index.html')));
  await page.waitForFunction(()=>!!document.querySelector('.botnav')&&!document.getElementById('mc-load'));
  await dismissNews(page);await new Promise(resolve=>setTimeout(resolve,6000));
  await preparaTransporte(page);
  const out=testInfo.outputPath('banco-pendientes.json');mkdirSync(testInfo.outputDir,{recursive:true});
  const report={schema:1,variant:'beta122-retained-lifecycle',sourceSHA:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    executionBase:'788432f4682c199edd785f6973d9353330c0064a',
    htmlSHA256:hash(readFileSync('public/index.html')),servedHTMLSHA256,guionSHA256:hash(readFileSync(new URL(import.meta.url))),
    helperHashes:Object.fromEntries(helperNames.map(n=>[n,hash(readFileSync(new URL('./lag-banco-'+n+'.mjs',import.meta.url)))])),
    appVersion:await page.evaluate(()=>CONFIG.APP_VERSION),browser:page.context().browser().version(),
    cpuRate:6,size,normalCycles,full,normal:[],leak:[],recovered:[],phase:'warmup',blockedRequests:0,
    storageUnit:'UTF16 value payload bytes; not physical IO',lifecycle:'fixture getters; no OS suspension',
    transport:'synthetic Supabase/bank client; no external requests',gc:'after each cycle, outside RAF window; can change later allocation pressure'};
    const save=()=>{report.blockedRequests=blocked;writeFileSync(out,JSON.stringify(report,null,2));};
  async function checkpoint(){
    const natural=await cdp.send('Runtime.getHeapUsage');await cdp.send('HeapProfiler.collectGarbage');
    const heap=await cdp.send('Runtime.getHeapUsage'),dom=await cdp.send('Memory.getDOMCounters');
    const local=await page.evaluate(()=>({...window.__lagBanco.snapshot(),bankRequest:window.__lagBanco.lastBankRequest,
      bankAckOnDisk:JSON.parse(localStorage.getItem('micartera_v3_oback')||'{}')}));
    const expenseCount=await page.evaluate(()=>JSON.parse(localStorage.getItem('micartera_v3_exp')||'[]').length);
    return {...local,domNodes:dom.nodes,listeners:dom.jsEventListeners,documents:dom.documents,
      heapNatural:natural.usedSize,heapAfterGC:heap.usedSize,expenseCount};
  }
  async function measured(phase,index,phaseStart){
    const before=await page.evaluate(()=>({bytes:window.__lagBanco.storageBytes,bank:window.__lagBanco.bankSync}));
    await page.evaluate(()=>{window.__lagBanco.landings=[];window.__lagBanco.begin();});
    let landings=[],valid=false,failure=null;
    try{
      landings=await recorrido.cycle(page,cdp);
      // Un minuto de calendario fingido no cuenta como exposición a temporizadores reales.
      if(full){const remaining=30000-await page.evaluate(()=>performance.now()-window.__lagBanco.elapsedStart);
        if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));}
      valid=true;
    }catch(error){failure={code:error.name==='TimeoutError'?'browser-timeout':'action-not-landed',
      action:await page.evaluate(()=>window.__lagBanco.actionName||'unknown').catch(()=> 'unavailable'),
      reason:error.message.match(/(?:scroll|foreground|automatic|unchanged|Back|Segmento)[\w -]*/)?.[0]||'unclassified',record:error.scrollRecord};}
    const metric=await page.evaluate(()=>({ ...window.__lagBanco.end(),inertia:window.__lagBanco.landings,
      bytes:window.__lagBanco.storageBytes,bank:window.__lagBanco.bankSync}));
    const retained=await checkpoint();
    return {...retained,...metric,phase,cycle:index,valid,failure,landings,
      storageBytes:metric.bytes-before.bytes,explicitBankSyncs:metric.bank-before.bank,
      measuredMinute:(Date.now()-phaseStart)/60000,slowFramesPerMinute:metric.slowFrames*60000/metric.elapsedMs};
  }
  try{
    const count=await page.evaluate(()=>JSON.parse(localStorage.getItem('micartera_v3_exp')||'[]').length);expect(count).toBe(size);
    const start=Date.now();report.warmup=await measured('warmup',0,start);save();
    expect(report.warmup.valid,'calentamiento debe aterrizar').toBe(true);
    expect(report.warmup.expenseCount).toBe(size+1);
    expect(report.warmup.bankRequest).toEqual({recoverGaps:true,acks:{}});
    expect(report.warmup.bankAckOnDisk).toEqual({Sabadell:syntheticAck});
    for(const [phase,total]of [['normal',normalCycles],['leak',4],['recovered',3]]){
      report.phase=phase;const phaseStart=Date.now();
      if(phase==='recovered')await page.evaluate(retiraFuga);
      for(let i=0;i<total;i++){
        if(phase==='leak')await page.evaluate(inyectaFuga,'e2e/lag-banco-sonda.mjs:'+leakLine);
        const metric=await measured(phase,i+1,phaseStart);report[phase].push(metric);save();
        expect(metric.valid,'muestra sin aterrizaje no produce curva').toBe(true);
        expect(metric.explicitBankSyncs).toBe(1);
        expect(metric.bankRequest).toEqual({recoverGaps:true,acks:{Sabadell:syntheticAck}});
        expect(metric.bankAckOnDisk).toEqual({Sabadell:syntheticAck});
        const previous=i?report[phase][i-1].expenseCount:phase==='normal'?report.warmup.expenseCount:phase==='leak'?report.normal.at(-1).expenseCount:report.leak.at(-1).expenseCount;
        expect(metric.expenseCount).toBe(previous+1);
      }
      report[phase+'Summary']=resumen(report[phase]);save();
    }
    report.discrimination=discrimina(report.normal,report.leak,report.recovered);
    report.growingSources=atribuciones(report.normal);report.injectedSources=atribuciones(report.leak);
    report.normalMeasuredMinutes=report.normalSummary.measuredMs/60000;report.phase='validating';save();
    expect(report.discrimination.passed,'el banco debe distinguir y retirar la fuga conocida').toBe(true);
    if(full)expect(report.normalMeasuredMinutes).toBeGreaterThanOrEqual(20);
    report.phase='complete';save();
    console.log(JSON.stringify({variant:report.variant,sourceSHA:report.sourceSHA,htmlSHA256:report.htmlSHA256,
      guionSHA256:report.guionSHA256,size,full,normalMeasuredMinutes:report.normalMeasuredMinutes,
      normal:report.normalSummary,leak:report.leakSummary,recovered:report.recoveredSummary,
      growingSources:report.growingSources,discrimination:report.discrimination.passed}));
  }catch(error){report.failure={name:error.name,message:error.message};throw error;}
  finally{
    report.last=ultimaMuestra(report);save();console.log(JSON.stringify(report));
    await page.evaluate(()=>{for(const fn of window.__lagBanco.leaks)window.removeEventListener('visibilitychange',fn);
      window.__lagBanco.leaks=[];window.__lagBanco.restoreTransport();window.__lagBanco.restore();}).catch(()=>{});
    save();await testInfo.attach('banco-pendientes',{path:out,contentType:'application/json'});
    const figure=testInfo.outputPath('banco-curvas.svg');writeFileSync(figure,curvasSVG(report));
    await testInfo.attach('banco-curvas',{path:figure,contentType:'image/svg+xml'});
  }
});
