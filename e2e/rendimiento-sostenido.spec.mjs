import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { seedLoggedInDashboard, installFixtureClock } from "./fixtures.mjs";

/* INC-2709-09: guarda el guion además de las cifras. Un verde significa que aterrizaron
   las acciones y que el instrumento detecta el control; NO que el móvil esté arreglado.
   La pasada larga se pide con MC_LAG_CYCLES; CI conserva un recorrido corto registrado. */
test.use({ serviceWorkers:"block" });
const cycles = Number(process.env.MC_LAG_CYCLES || 4);
const sizes = (process.env.MC_LAG_SIZES || "3000,5200").split(",").map(Number);
const VARIANT="lifecycle-network-v3";
let currentAction="setup";
const guionSHA256=createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture(n) {
  const expenses = Array.from({length:n}, (_,i) => ({
    id:"11111111-1111-4111-8111-"+String(i).padStart(12,"0"),
    date:new Date(Date.parse("2026-09-26T10:00:00Z")-i*3600000).toISOString(),
    amount:2+i%9, merchant:"Comercio sintético "+i, category:"super", source:"manual", ent:"sabadell",
  }));
  return {
    __seenVersion:"dev",
    expenses, hasBankLink:true,
    accounts:[{id:"e2e",ent:"sabadell",name:"Cuenta sintética",value:1000,role:"diario"}],
    debts:Array.from({length:6},(_,i)=>({id:"d"+i,name:"Deuda sintética "+i,value:6000,monthly:180,apr:5.5,account:"e2e",start:"2024-01-15",anchor:8000})),
    goals:Array.from({length:6},(_,i)=>({id:"g"+i,name:"Meta sintética "+i,target:3000,saved:400,emoji:"🎯",account:"e2e"})),
    __cloudRows:{
      expenses:expenses.map(e=>({id:e.id,fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,source:"manual:sabadell",no_card:false,nota:null,nota_edit:false})),
      bank_links:[{id:"fixture-link",aspsp_name:"Sabadell",status:"active",valid_until:"2027-01-01T00:00:00Z",accounts:[{uid:"fixture-account"}]}],
    },
    __cloudDelays:{expenses:80,bank_links:80},
    __cloudFns:{"bank-sync":{data:{ok:true,links:[{aspsp:"Sabadell",ok:true,accounts:[{uid:"fixture-account",ok:true,balances:[{amount:1000,currency:"EUR",type:"CLBD"}],transactions:[]}]}]},error:null}},
  };
}

// Cada etiqueta se sella una vez: sin polling de Playwright dentro del gesto.
async function markAction(page, name) {
  currentAction=name;
  await page.evaluate(name=>{
    const p=window.__lag;
    if(p.active){
      if(p.action) p.action.elapsed=performance.now()-p.action.start;
      p.action={name,start:performance.now(),elapsed:0,frames:0,slow:0,maxFrame:0,longtasks:0,longtaskMs:0};
      p.actions.push(p.action);
    }
  },name);
}
async function lifecycle(page,cdp) {
  const transitions=[];
  const change=async state=>{
    await page.evaluate(state=>{
      window.__lag.visibility=state;
      document.dispatchEvent(new Event("visibilitychange"));
    },state);
    await delay(250);
    transitions.push(await page.evaluate(()=>({visibility:document.visibilityState,hidden:document.hidden,online:navigator.onLine})));
  };
  await markAction(page,"lifecycle-baseline");const before=await snapshot(page,cdp);
  await markAction(page,"background-hidden");await change("hidden");
  if(transitions.at(-1).visibility!=="hidden" || !transitions.at(-1).hidden)throw new Error("Hidden no aterrizó");
  await markAction(page,"offline-hidden");await page.context().setOffline(true);await delay(250);
  if(await page.evaluate(()=>navigator.onLine))throw new Error("Offline no aterrizó");
  await markAction(page,"foreground-offline");await change("visible");await delay(450);
  const offline=await snapshot(page,cdp);
  if(offline.transport.pullExpenses?.failed!==(before.transport.pullExpenses?.failed||0)+1)throw new Error("Pull offline doble no falló");
  await markAction(page,"online-visible");await page.context().setOffline(false);await delay(250);
  if(!await page.evaluate(()=>navigator.onLine))throw new Error("Online no aterrizó");
  await markAction(page,"background-retry");await change("hidden");
  await markAction(page,"foreground-retry");await change("visible");await delay(900);
  const recovered=await snapshot(page,cdp);
  if(recovered.transport.pullExpenses?.succeeded!==(offline.transport.pullExpenses?.succeeded||0)+1)throw new Error("Pull recuperado doble no terminó");
  if(recovered.cloud.bankSync!==before.cloud.bankSync)throw new Error("Lifecycle disparó banco sin demanda");
  if(recovered.expensesWrites!==before.expensesWrites)throw new Error("Lifecycle reescribió histórico idéntico");
  return {transitions,before,offline,recovered};
}
async function click(page, selector) {
  await page.evaluate(selector=>{
    const el=document.querySelector(selector); if(!el) throw new Error("Acción ausente: "+selector); el.click();
  },selector);
  await delay(750);
}
async function snapshot(page,cdp,collect=false) {
  if(collect) await cdp.send("HeapProfiler.collectGarbage");
  const dom=await cdp.send("Memory.getDOMCounters");
  const heap=await cdp.send("Runtime.getHeapUsage");
  const local=await page.evaluate(()=>{
    const expenses=JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]");
    return ({
    expenseCount:expenses.length, distinctExpenseDates:new Set(expenses.map(e=>e.date)).size,
    domElements:document.querySelectorAll("*").length,
    backStack:typeof _mcBackStack!=="undefined"?_mcBackStack.length:null,
    writes:window.__lag.writes, bytes:window.__lag.bytes,
    expensesWrites:window.__lag.expensesWrites,
    cloud:{...window.__lag.cloud}, transport:JSON.parse(JSON.stringify(window.__lag.transport)), visibility:document.visibilityState, online:navigator.onLine, intervalTimers:window.__lag.timers.size,
  });});
  return {...dom,heapUsed:heap.usedSize,...local};
}
async function windowMeasure(page, action, phase="normal") {
  await page.evaluate(()=>{ window.__lag.frames=[];window.__lag.longtasks=[];window.__lag.prev=null;window.__lag.start=performance.now();window.__lag.active=true;window.__lag.actions=[];window.__lag.action=null; });
  const start=Date.now();
  let valid=true,landings=[],failure=null;
  try{ landings=await action(); }catch(error){ valid=false; failure={phase,action:currentAction,code:error.name==="TimeoutError"?"browser-timeout":"action-failed"}; }
  const measured=await page.evaluate(elapsed=>{
    const p=window.__lag; p.active=false;if(p.action)p.action.elapsed=performance.now()-p.action.start;
    return {elapsed,frames:p.frames.length,slow:p.frames.filter(x=>x>32).length,maxFrame:Math.max(0,...p.frames),longtaskMs:p.longtasks.reduce((a,b)=>a+b,0),longtasks:p.longtasks.length,actions:p.actions.map(({start,...a})=>a)};
  },Date.now()-start);
  return {...measured,valid,landings,failure};
}
async function scroll(page,cdp,down) {
  const before=await page.evaluate(()=>document.querySelector(".page-scroll-host").scrollTop);
  const y=down?600:230;
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:187,y}]});
  for(let i=1;i<=14;i++){
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:187,y:y+(down?-1:1)*i*22}]});
    await delay(16);
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await delay(250);
  const after=await page.evaluate(()=>document.querySelector(".page-scroll-host").scrollTop);
  if(down && after<before+20) throw new Error("Scroll táctil no aterrizó");
  if(!down && after>before-20) throw new Error("Scroll táctil arriba no aterrizó");
}
async function cycle(page,cdp) {
  const landings=[];
  for(const tab of ["inicio","gastos","plan","cartera"]){
    await markAction(page,"tab-"+tab);
    await click(page,'.botnav-tab[data-tour="'+tab+'"]');
    const active=await page.evaluate(()=>document.querySelector(".botnav-tab.active").dataset.tour);
    if(active!==tab)throw new Error("Tab no aterrizó: "+tab);landings.push(tab);
    if(tab==="inicio" || tab==="gastos"){
      await page.evaluate(()=>{document.querySelector(".page-scroll-host").scrollTop=0;});
      await delay(100);
      await markAction(page,"scroll-down-"+tab);await scroll(page,cdp,true);
      await markAction(page,"scroll-up-"+tab);await scroll(page,cdp,false);
    }
    if(tab==="gastos"){
      await markAction(page,"expense-open");await click(page,'.page-scroll-host button.v4-mov');
      await markAction(page,"expense-back");
      await page.evaluate(()=>history.back());await delay(850);
      if(await page.evaluate(()=>_mcBackStack.length!==0))throw new Error("Back ficha no cerró");
      landings.push("ficha/back");
    }
    if(tab==="plan")for(const seg of ["deudas","metas","recibos"]){
      await markAction(page,"plan-segment-"+seg);
      await page.evaluate(seg=>{
        const btn=[...document.querySelectorAll('.page-scroll-host .v4-seg-btn')].find(b=>new RegExp(seg==="deudas"?"deuda":seg==="metas"?"meta":"recibo","i").test(b.textContent));
        if(!btn)throw new Error("Segmento ausente: "+seg);btn.click();
      },seg);await delay(300);
      const visible=await page.evaluate(seg=>getComputedStyle(document.querySelector('.v4-screen > [data-seg="'+seg+'"]')).contentVisibility!=="hidden",seg);
      if(!visible)throw new Error("Segmento no aterrizó: "+seg);landings.push(seg);
    }
    if(tab==="cartera"){
      await markAction(page,"banks-open");
      await page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-open-banks",{detail:{focus:null}})));await delay(850);
      await markAction(page,"banks-expand");await click(page,'[data-aspsp="Sabadell"] .v4-mov');
      if(await page.evaluate(()=>document.querySelectorAll(".bk-actions").length)!==1)throw new Error("Conexión sintética no aterrizó");
      await markAction(page,"banks-back");await page.evaluate(()=>history.back());await delay(850);
      if(await page.evaluate(()=>!!document.querySelector(".v4-banks")))throw new Error("Back bancos no cerró");
      await markAction(page,"settings-back");await page.evaluate(()=>history.back());await delay(850);
      if(await page.evaluate(()=>document.querySelector(".settings-push").classList.contains("open")))throw new Error("Back Ajustes no cerró");
      landings.push("bancos/back/ajustes/back");
      await markAction(page,"bank-sync");
      await page.evaluate(()=>{
        const btn=[...document.querySelectorAll('.page-scroll-host button')].find(b=>/Sincronizar bancos/i.test(b.getAttribute("aria-label")||b.textContent));
        if(!btn)throw new Error("Sync explícito ausente");btn.click();
      });await delay(1200);
      if(await page.evaluate(()=>!document.querySelector(".sync-report")))throw new Error("Sync doble no aterrizó: "+JSON.stringify(await page.evaluate(()=>({cloud:window.__lag.cloud,toast:document.querySelector(".toast")?.textContent}))));
      await markAction(page,"sync-report-back");await page.evaluate(()=>history.back());await delay(850);landings.push("sync/back");
    }
  }
  await markAction(page,"inicio-return");await click(page,'.botnav-tab[data-tour="inicio"]');
  await markAction(page,"profile-open");await click(page,'.v4-avatar');
  await markAction(page,"profile-back");await page.evaluate(()=>history.back());await delay(850);
  if(await page.evaluate(()=>document.querySelector(".profile-pull").classList.contains("open")))throw new Error("Back perfil no cerró");
  await markAction(page,"apuntar-open");await click(page,'.botnav-fab');
  await markAction(page,"apuntar-back");await page.evaluate(()=>history.back());await delay(850);
  if(await page.evaluate(()=>!!document.querySelector(".v4-exp-sheet")))throw new Error("Back Apuntar no cerró");
  // La visibilidad es un estado del doble; offline usa el estado real del contexto Chromium.
  const states=await lifecycle(page,cdp);
  return [...landings,"perfil/back","apuntar/back",states];
}

for(const size of sizes)test("uso sostenido con nube doble y control discriminante: "+size,async({page},testInfo)=>{
  test.setTimeout(Math.max(240000,cycles*22000+180000));
  let blockedExternalRequests=0;
  const localOrigin=new URL(testInfo.project.use.baseURL).origin;
  await page.context().route("**/*",route=>{
    const u=new URL(route.request().url());
    if(u.origin===localOrigin)return route.continue();
    blockedExternalRequests++;return route.abort("blockedbyclient");
  });
  await installFixtureClock(page);await seedLoggedInDashboard(page,fixture(size));
  await page.addInitScript(()=>{
    const p=window.__lag={active:false,prev:null,frames:[],longtasks:[],writes:0,bytes:0,expensesWrites:0,cloud:{},transport:{},timers:new Set(),visibility:"visible",actions:[],action:null};
    // No pretende suspender la WebView: solo estados/ramas de lifecycle del código real.
    Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>p.visibility});
    Object.defineProperty(document,"hidden",{configurable:true,get:()=>p.visibility==="hidden"});
    function frame(t){if(p.active){if(p.prev!==null){const dt=t-p.prev;p.frames.push(dt);if(p.action){p.action.frames++;if(dt>32)p.action.slow++;p.action.maxFrame=Math.max(p.action.maxFrame,dt);}}p.prev=t;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
    new PerformanceObserver(list=>{if(p.active)for(const e of list.getEntries())if(e.startTime>=p.start){p.longtasks.push(e.duration);const a=p.actions.findLast(x=>x.start<=e.startTime);if(a){a.longtasks++;a.longtaskMs+=e.duration;}}}).observe({entryTypes:["longtask"]});
    const put=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){p.writes++;p.bytes+=String(v).length*2;if(k==="micartera_v3_exp")p.expensesWrites++;return put.apply(this,arguments);};
    const setI=window.setInterval,clearI=window.clearInterval;window.setInterval=function(){const id=setI.apply(this,arguments);p.timers.add(id);return id;};window.clearInterval=function(id){p.timers.delete(id);return clearI.call(this,id);};
  });
  const cdp=await page.context().newCDPSession(page);await cdp.send("Emulation.setCPUThrottlingRate",{rate:6});
  await page.goto("/");await page.waitForFunction(()=>!!document.querySelector(".botnav")&&!document.getElementById("mc-load"));
  // Solamente antes de medir: nunca polling dentro de las ventanas.
  await page.evaluate(()=>{const b=[...document.querySelectorAll("button")].find(x=>/Entendido|Got it|D'acord/.test(x.textContent));if(b)b.click();});
  await delay(10000);
  await page.evaluate(()=>{
    for(const name of ["pullExpenses","bankLinks","bankSync"]){
      const real=cloud[name];cloud[name]=async function(){
        const p=window.__lag;p.cloud[name]=(p.cloud[name]||0)+1;
        const t=p.transport[name]||(p.transport[name]={started:0,succeeded:0,failed:0,inFlight:0,maxInFlight:0,totalMs:0});
        t.started++;t.inFlight++;t.maxInFlight=Math.max(t.maxInFlight,t.inFlight);const start=performance.now();
        try{
          // El cliente de fixture no usa sockets: fuerza el fallo solo en su frontera doble.
          if(!navigator.onLine)throw new Error("fixture-offline");
          const result=await real.apply(this,arguments);t.succeeded++;return result;
        }catch(error){t.failed++;throw error;}finally{t.inFlight--;t.totalMs+=performance.now()-start;}
      };
    }
  });
  let start=null;
  const out=testInfo.outputPath("sustained-lag.json");mkdirSync(testInfo.outputDir,{recursive:true});
  const report={schema:3,variant:VARIANT,lifecycleModel:"document getters + visibilitychange; no OS suspension",networkModel:"Chromium context offline + cloud-double failures; no bank transport",guionSHA256,
    sourceSHA:process.env.MC_LAG_SOURCE_SHA||"unspecified",
    htmlSHA256:createHash("sha256").update(readFileSync("public/index.html")).digest("hex"),
    appVersion:await page.evaluate(()=>CONFIG.APP_VERSION),
    platform:"Linux cloud / Chromium desktop / Pixel5 viewport",browser:page.context().browser().version(),
    cpuRate:6,size,cycles,start,checkpoints:[],measured:[],degraded:[],phase:"normal",blockedExternalRequests};
  const save=()=>{ report.blockedExternalRequests=blockedExternalRequests;writeFileSync(out,JSON.stringify(report,null,2)); };
  const slowRate=a=>a.reduce((n,x)=>n+x.slow,0)/a.reduce((n,x)=>n+x.elapsed,0)*1000;
  save();
  try{
    report.phase="warmup";save();
    report.warmup=await windowMeasure(page,()=>cycle(page,cdp),"warmup");save();
    expect(report.warmup.valid,"calentamiento debe aterrizar; evidencia parcial guardada").toBe(true);
    start=await snapshot(page,cdp,true);report.start=start;report.phase="normal";save();
    expect(start.expenseCount).toBe(size);expect(start.distinctExpenseDates).toBe(size);
    for(let i=0;i<cycles;i++){
      const metric=await windowMeasure(page,()=>cycle(page,cdp));
      report.measured.push({...metric,cycle:i+1});save();
      expect(metric.valid,"el ciclo normal debe aterrizar; evidencia parcial guardada").toBe(true);
      if((i+1)%5===0){ report.checkpoints.push({cycle:i+1,gcForced:false,...await snapshot(page,cdp)});save();console.log("sustained",size,"cycles",i+1,"slow",metric.slow); }
    }
    report.endBeforeGC=await snapshot(page,cdp);save();
    report.endAfterGC=await snapshot(page,cdp,true);save();
    expect(report.endBeforeGC.expenseCount).toBe(size);expect(report.endBeforeGC.distinctExpenseDates).toBe(size);
    expect(report.endBeforeGC.cloud.bankSync-start.cloud.bankSync).toBe(cycles);
    expect(report.endBeforeGC.backStack).toBe(0);
    // El GC final ya queda fuera de la sesión normal: el control es otra fase explícita.
    report.phase="control";save();
    await page.evaluate(()=>{window.__lag.control=setInterval(()=>{const end=performance.now()+150;while(performance.now()<end){}},300);});
    for(let i=0;i<2;i++){
      const metric=await windowMeasure(page,()=>cycle(page,cdp),"control");report.degraded.push(metric);save();
      expect(metric.valid,"el control debe recorrer las mismas acciones").toBe(true);
    }
    await page.evaluate(()=>clearInterval(window.__lag.control));
    report.phase="recovery";save();
    report.recovered=await windowMeasure(page,()=>cycle(page,cdp),"recovery");save();
    expect(report.recovered.valid).toBe(true);
    report.slowRate={normal:slowRate(report.measured),degraded:slowRate(report.degraded),recovered:slowRate([report.recovered])};save();
    expect(report.slowRate.degraded,"el instrumento debe distinguir el bloqueo conocido").toBeGreaterThan(report.slowRate.normal*1.5);
    expect(Math.max(...report.degraded.map(x=>x.maxFrame))).toBeGreaterThan(120);
    expect(report.slowRate.recovered).toBeLessThan(report.slowRate.degraded/1.5);
    // Un fallo intencional verifica trazabilidad sin guardar mensajes de error ni rutas.
    currentAction="diagnostic-missing-control";report.phase="diagnostic";
    report.diagnostic=await windowMeasure(page,()=>click(page,"[data-lag-missing-control]"),"diagnostic");save();
    expect(report.diagnostic.valid).toBe(false);
    expect(report.diagnostic.failure).toEqual({phase:"diagnostic",action:"diagnostic-missing-control",code:"action-failed"});
    report.phase="complete";save();
    console.log(JSON.stringify({variant:VARIANT,size,cycles,start,endBeforeGC:report.endBeforeGC,endAfterGC:report.endAfterGC,slowRate:report.slowRate,blockedExternalRequests}));
  }finally{
    await page.evaluate(()=>{window.__lag.active=false;if(window.__lag.control)clearInterval(window.__lag.control);}).catch(()=>{});
    await page.context().setOffline(false).catch(()=>{});
    save();await testInfo.attach("sustained-lag",{path:out,contentType:"application/json"});
  }
});
