import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {seedLoggedInDashboard,installFixtureClock,dismissNews} from './fixtures.mjs';
import {instalaSonda,inyectaFuga,retiraFuga} from './lag-banco-sonda.mjs';
import {recorrido,preparaTransporte} from './lag-banco-recorrido.mjs';
import {resumen,discrimina,atribuciones} from './lag-banco-metricas.mjs';
import {curvasSVG} from './lag-banco-informe.mjs';

test.use({serviceWorkers:'block'});
test.describe.configure({mode:'serial',retries:0});
const normalCycles=Number(process.env.MC_LAG_BANCO_CYCLES||4);
const full=process.env.MC_LAG_BANCO_LONG==='1';
if(!Number.isInteger(normalCycles)||normalCycles<4||normalCycles>60)throw new Error('MC_LAG_BANCO_CYCLES:4..60');
if(full&&(normalCycles<40||normalCycles>60))throw new Error('Pasada larga:40..60 ciclos de30s (20..30min)');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
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
  const report={schema:1,variant:'beta117-retained-lifecycle',sourceSHA:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    htmlSHA256:hash(readFileSync('public/index.html')),servedHTMLSHA256,guionSHA256:hash(readFileSync(new URL(import.meta.url))),
    helperHashes:Object.fromEntries(['sonda','recorrido','metricas','informe'].map(n=>[n,hash(readFileSync(new URL('./lag-banco-'+n+'.mjs',import.meta.url)))])),
    appVersion:await page.evaluate(()=>CONFIG.APP_VERSION),browser:page.context().browser().version(),
    cpuRate:6,size,normalCycles,full,normal:[],leak:[],recovered:[],phase:'warmup',blockedRequests:0,
    storageUnit:'UTF16 value payload bytes; not physical IO',lifecycle:'fixture getters; no OS suspension',
    transport:'synthetic Supabase/bank client; no external requests',gc:'after each cycle, outside RAF window; can change later allocation pressure'};
  const save=()=>{report.blockedRequests=blocked;writeFileSync(out,JSON.stringify(report,null,2));};
  async function checkpoint(){
    const natural=await cdp.send('Runtime.getHeapUsage');await cdp.send('HeapProfiler.collectGarbage');
    const heap=await cdp.send('Runtime.getHeapUsage'),dom=await cdp.send('Memory.getDOMCounters');
    const local=await page.evaluate(()=>window.__lagBanco.snapshot());
    return {...local,domNodes:dom.nodes,listeners:dom.jsEventListeners,documents:dom.documents,
      heapNatural:natural.usedSize,heapAfterGC:heap.usedSize};
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
      action:await page.evaluate(()=>window.__lagBanco.actionName||'unknown').catch(()=> 'unavailable')};}
    const metric=await page.evaluate(()=>({ ...window.__lagBanco.end(),inertia:window.__lagBanco.landings,
      bytes:window.__lagBanco.storageBytes,bank:window.__lagBanco.bankSync}));
    const retained=await checkpoint();
    return {...retained,...metric,phase,cycle:index,valid,failure,landings,
      storageBytes:metric.bytes-before.bytes,explicitBankSyncs:metric.bank-before.bank,
      measuredMinute:(Date.now()-phaseStart)/60000,slowFramesPerMinute:metric.slowFrames*60000/metric.elapsedMs};
  }
  try{
    const start=Date.now();report.warmup=await measured('warmup',0,start);save();
    expect(report.warmup.valid,'calentamiento debe aterrizar').toBe(true);
    const count=await page.evaluate(()=>JSON.parse(localStorage.getItem('micartera_v3_exp')||'[]').length);expect(count).toBe(size);
    for(const [phase,total]of [['normal',normalCycles],['leak',4],['recovered',3]]){
      report.phase=phase;const phaseStart=Date.now();
      if(phase==='recovered')await page.evaluate(retiraFuga);
      for(let i=0;i<total;i++){
        if(phase==='leak')await page.evaluate(inyectaFuga,'e2e/lag-banco-sonda.mjs:'+leakLine);
        const metric=await measured(phase,i+1,phaseStart);report[phase].push(metric);save();
        expect(metric.valid,'muestra sin aterrizaje no produce curva').toBe(true);
        expect(metric.explicitBankSyncs).toBe(1);
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
  }finally{
    await page.evaluate(()=>{for(const fn of window.__lagBanco.leaks)window.removeEventListener('visibilitychange',fn);
      window.__lagBanco.leaks=[];window.__lagBanco.restoreTransport();window.__lagBanco.restore();}).catch(()=>{});
    save();await testInfo.attach('banco-pendientes',{path:out,contentType:'application/json'});
    const figure=testInfo.outputPath('banco-curvas.svg');writeFileSync(figure,curvasSVG(report));
    await testInfo.attach('banco-curvas',{path:figure,contentType:'image/svg+xml'});
  }
});
