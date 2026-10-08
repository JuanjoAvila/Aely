import {test,expect,devices} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews,installFixtureClock,FIXTURE_NOW} from "./fixtures.mjs";
import {prepararFuentesPlan,dedoPlan,resumenFramesPlan,debts,goals,fixed,finanzasPlanSnapshot,deltasFinanzasPlan} from "./plan-ownership-candidate.mjs";
let hosted;
const backupDay=new Date(FIXTURE_NOW).toISOString().slice(0,10);
test.beforeAll(async()=>{hosted=await prepararFuentesPlan();});
test.afterAll(async()=>{await hosted?.close();});
const tab=page=>page.evaluate(()=>document.querySelector(".botnav-tab.active")?.dataset.tour);
const segment=page=>page.evaluate(()=>document.querySelector('[data-seg][aria-hidden="false"]')?.dataset.seg);
async function settled(page){await page.waitForFunction(()=>{
  const host=document.querySelector(".page.page-scroll-host"),track=document.querySelector(".track.scroll-host-park:not(.dragging)");
  return !!track&&!!host&&host.classList.contains("page-live")&&host.contains(document.elementFromPoint(196,430));
},null,{polling:"raf",timeout:10_000});}
async function selectTab(page,id,cdp){
 const order=["inicio","gastos","plan","cartera"],from=order.indexOf(await tab(page)),to=order.indexOf(id);
 expect(from).toBeGreaterThanOrEqual(0);expect(to).toBeGreaterThanOrEqual(0);
 for(let i=from;i!==to;i+=Math.sign(to-from)){
  await settled(page);const forward=to>from;
  await dedoPlan(cdp,{x:forward?350:80,y:200,dy:0,dx:forward?-270:270,steps:16,interval:16});
  await expect.poll(()=>tab(page)).toBe(order[i+Math.sign(to-from)]);await settled(page);
 }
}
async function boot(browser,source,mode="no-preference",safe=0){
 const context=await browser.newContext({...devices["Pixel 5"],baseURL:source.url,reducedMotion:mode});const page=await context.newPage();
 await page.route("**/*",route=>["127.0.0.1","localhost"].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 // El backup diario sintético ya existe: evita su escritura de arranque, sin ignorar
 // lastBackup/_savedAt ni ningún otro campo en el guardián financiero completo.
 await installFixtureClock(page);await seedLoggedInDashboard(page,{debts,goals,fixed,lastBackup:backupDay,badges:["first_goal","first_underbudget","first_reto","streak_3","save_100","save_500","save_1000","save_5000"]});
 const response=await page.goto("/");expect(response.headers()["x-aely-source"]).toBe(source.sha);expect(response.headers()["x-aely-html-sha"]).toBe(source.htmlHash);
 await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
 expect(await page.evaluate(()=>new Date().toISOString().slice(0,10))).toBe(backupDay);
 await page.evaluate(safe=>document.documentElement.style.setProperty("--safe-bottom",safe+"px"),safe);
 const cdp=await context.newCDPSession(page);await cdp.send("Emulation.setCPUThrottlingRate",{rate:6});
 return {page,cdp,close:async()=>{await cdp.send("Emulation.setCPUThrottlingRate",{rate:1});await cdp.detach();await context.close();}};
}
async function chooseSegment(page,id){
 if(await segment(page)!==id){await page.locator(".v4-seg-btn",{hasText:id==="deudas"?/deuda/i:id==="metas"?/meta/i:/recibo/i}).click();await expect.poll(()=>segment(page)).toBe(id);}
 if(id==="recibos"&&await page.locator('[data-seg="recibos"][aria-hidden="false"] .v4-charge').count()!==40){await page.locator('[data-seg="recibos"][aria-hidden="false"] button.v4-link-mini').first().click();await expect(page.locator('[data-seg="recibos"][aria-hidden="false"] .v4-charge')).toHaveCount(40);}
 await settled(page);await expect.poll(()=>page.locator(".page.page-scroll-host").evaluate(el=>el.scrollHeight-el.clientHeight)).toBeGreaterThan(200);
}
async function resetTop(page){await page.locator(".page.page-scroll-host").evaluate(el=>{el.scrollTop=0;});await page.waitForTimeout(300);await settled(page);}
async function released(page){expect(await page.locator(".page.page-scroll-host").evaluate(el=>({own:el.classList.contains("mc-touch-own"),plan:el.classList.contains("mc-p")}))).toEqual({own:false,plan:false});}
async function unchangedFinanzas(page,before,source,label){
 const after=await finanzasPlanSnapshot(page);
 if(after.fingerprint!==before.fingerprint){
  // Datos inventados por boot y red externa bloqueada: el estado íntegro permite auditar
  // también lo que el resumen acotado no alcance, sin perder evidencia al terminar la CI.
  console.log("PLAN_CANDIDATE_SYNTHETIC_FINANCE_SNAPSHOTS "+JSON.stringify({sourceLabel:source.label,sourceSHA:source.sha,
   htmlHash:source.htmlHash,label,syntheticContext:true,before,after}));
  console.log("PLAN_CANDIDATE_SYNTHETIC_FINANCE_DELTA "+JSON.stringify({
  sourceLabel:source.label,sourceSHA:source.sha,htmlHash:source.htmlHash,label,syntheticContext:true,
  beforeFingerprint:before.fingerprint,afterFingerprint:after.fingerprint,...deltasFinanzasPlan(before,after),
  limitsNote:"Full state/expenses in SYNTHETIC_FINANCE_SNAPSHOTS; pointer summary bounded only, original complete fingerprint equality required; no field ignored or normalized."}));
 }
 expect(after.fingerprint).toBe(before.fingerprint);
}
async function genericOwnershipCssControl(page,source,motion,safe){
 const financeBefore=await finanzasPlanSnapshot(page);
 const control=await page.evaluate(()=>{
  const host=document.querySelector(".page.page-scroll-host"),root=document.getElementById("root");
  if(!host||!root)throw new Error("Falta host/root para el control CSS aislado");
  const live=()=>({classList:Array.from(host.classList),scrollTop:host.scrollTop,style:host.getAttribute("style"),touchAction:getComputedStyle(host).touchAction});
  const before=live(),probe=document.createElement("div");
  // Sólo prueba la cascada cargada: nunca fuerza ownership sobre el host real ni
  // demuestra permisos de gesto. La sonda no pinta ni sobrevive al evaluate.
  probe.className="page page-scroll-host mc-touch-own";probe.style.display="none";
  let touchAction;try{root.appendChild(probe);touchAction=getComputedStyle(probe).touchAction;}finally{probe.remove();}
  return {before,after:live(),touchAction,removed:!probe.isConnected};
 });
 expect(control.touchAction).toBe("none");expect(control.removed).toBe(true);expect(control.after).toEqual(control.before);
 await unchangedFinanzas(page,financeBefore,source,"candidate/css-control/"+motion+"/safe"+safe);
 console.log("PLAN_CANDIDATE_GENERIC_CSS_CONTROL "+JSON.stringify({sourceLabel:source.label,sourceSHA:source.sha,htmlHash:source.htmlHash,motion,safe,syntheticContext:true,
  control,limits:"Hidden disposable node tests loaded CSS cascade only; live host and complete finance hash unchanged; no native permissions or performance claim."}));
}
async function naturalSample(page,cdp,source,label){
 await resetTop(page);
 await page.evaluate(()=>{
  const frames=[],events=[];let raf;const host=document.querySelector(".page.page-scroll-host");
  const terminal=e=>events.push({type:e.type,t:performance.now(),touches:e.touches.length});
  document.addEventListener("touchstart",terminal,{capture:true,passive:true});
  document.addEventListener("touchend",terminal,{capture:true,passive:true});document.addEventListener("touchcancel",terminal,{capture:true,passive:true});
  let ready;const beforeFinger=new Promise(resolve=>{ready=resolve;});
  const tick=t=>{frames.push(t);if(frames.length===2)ready();raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
  window.__planNaturalStop=()=>{cancelAnimationFrame(raf);document.removeEventListener("touchstart",terminal,true);document.removeEventListener("touchend",terminal,true);document.removeEventListener("touchcancel",terminal,true);delete window.__planNaturalStop;return {frames,events,scroll:host.scrollTop};};
  return beforeFinger;
 });
 let result;try{await dedoPlan(cdp);await page.waitForTimeout(450);}finally{result=await page.evaluate(()=>window.__planNaturalStop());}
 expect(result.events).toHaveLength(2);expect(result.events[0].type).toBe("touchstart");expect(result.events[0].touches).toBe(1);expect(["touchend","touchcancel"]).toContain(result.events[1].type);expect(result.events[1].touches).toBe(0);expect(result.scroll).toBeGreaterThan(2);expect(result.frames.length).toBeGreaterThan(5);await released(page);
 const report={sourceSHA:source.sha,label,start:result.events[0],terminal:result.events[1],scroll:result.scroll,frames:resumenFramesPlan(result.frames,result.events[0].t,result.events[1].t),
  limits:"natural rAF timestamps only; no Tracing/Profiler, style/size/DOM reads per frame; no means, speedup or human cause claim; native inertia observation window 450ms"};
 console.log("PLAN_CANDIDATE_NATURAL_FRAMES "+JSON.stringify(report));return report;
}
for(const seg of ["recibos","deudas","metas"]){
 test("prototipo Plan A/B naturalframes "+seg,async({browser})=>{
  test.setTimeout(240_000);const reports=[];
  // Orden distinto entre segmentos; cada fuente usa contexto fresco y exactamente el mismo fixture.
  const order=seg==="deudas"?["candidate","main","beta"]:["beta","main","candidate"];
  for(const name of order){const source=hosted.sources[name],env=await boot(browser,source);
   try{const{page,cdp}=env;await selectTab(page,"plan",cdp);await chooseSegment(page,seg);
    const financeBefore=await finanzasPlanSnapshot(page);
    for(const phase of ["first","after-12-use-cycles"]){
     if(phase!=="first")for(let i=0;i<12;i++){
      await resetTop(page);await dedoPlan(cdp,{steps:12,interval:16});await page.waitForTimeout(100);expect(await page.locator(".page.page-scroll-host").evaluate(el=>el.scrollTop)).toBeGreaterThan(2);
      await selectTab(page,"gastos",cdp);await selectTab(page,"plan",cdp);await chooseSegment(page,seg);
     }
     await unchangedFinanzas(page,financeBefore,source,name+"/"+seg+"/"+phase+"/before-natural");
     const report=await naturalSample(page,cdp,source,name+"/"+seg+"/"+phase);
     await unchangedFinanzas(page,financeBefore,source,name+"/"+seg+"/"+phase+"/after-natural");expect(await tab(page)).toBe("plan");expect(await segment(page)).toBe(seg);reports.push(report);
    }
    await unchangedFinanzas(page,financeBefore,source,name+"/"+seg+"/final");
   }finally{await env.close();}
  }
  console.log("PLAN_CANDIDATE_FRAME_GATE "+JSON.stringify({segment:seg,reports,
   gate:"Inspect individual baseline/candidate frame distributions including touchIntersecting and crossing boundaries; touchIntersecting overlaps exclusive phase rows and must not be summed with them. If baseline bad-frame case is absent or candidate does not distinguish it, no optimization/human-lag conclusion; prototype remains unaccepted."}));
 });
}
for(const motion of ["no-preference","reduce"])for(const safe of [0,34]){
 test("prototipo Plan nativecontracts "+motion+" safe"+safe,async({browser})=>{
  test.setTimeout(120_000);const env=await boot(browser,hosted.sources.candidate,motion,safe);
  try{const{page,cdp}=env;
   // Una lectura fuera del gesto conserva la precondición real, sin asentarlo ni corregirlo.
   const precondition=await page.evaluate(()=>{
    const host=document.querySelector(".page.page-scroll-host"),track=document.querySelector(".track"),root=document.documentElement;
    return {activeTab:document.querySelector(".botnav-tab.active")?.dataset.tour??null,scrollTop:host?.scrollTop??null,
     hostClassList:host?Array.from(host.classList):null,trackClassList:track?Array.from(track.classList):null,
     genericOwnership:host?.classList.contains("mc-touch-own")??null,planOwnership:host?.classList.contains("mc-p")??null,
     sheetOpen:root.classList.contains("sheet-open"),profileOpen:root.classList.contains("profile-open"),
     computedTouchAction:host?getComputedStyle(host).touchAction:null,live:host?.classList.contains("page-live")??null,
     settled:!!track?.matches(".track.scroll-host-park:not(.dragging)")&&!!host?.classList.contains("page-live")&&host.contains(document.elementFromPoint(196,430))};
   });
   console.log("PLAN_CANDIDATE_NATIVE_PRECONDITION "+JSON.stringify({sourceLabel:hosted.sources.candidate.label,sourceSHA:hosted.sources.candidate.sha,htmlHash:hosted.sources.candidate.htmlHash,motion,safe,syntheticContext:true,precondition}));
   // Las ocho observaciones oficiales arrancaron aquí sin ownership y en auto.
   // El contrato none genérico se comprueba aparte, sin falsear el host de Inicio.
   expect(precondition).toEqual({activeTab:"inicio",scrollTop:0,hostClassList:["page","page-live","page-scroll-host"],trackClassList:["track","scroll-host-park"],
    genericOwnership:false,planOwnership:false,sheetOpen:false,profileOpen:false,computedTouchAction:"auto",live:true,settled:true});
   await genericOwnershipCssControl(page,hosted.sources.candidate,motion,safe);
   await selectTab(page,"plan",cdp);await chooseSegment(page,"deudas");await resetTop(page);
   const financeBefore=await finanzasPlanSnapshot(page);
   await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:196,y:430}]});
   expect(await page.locator(".page.page-scroll-host").evaluate(el=>({own:el.classList.contains("mc-touch-own"),plan:el.classList.contains("mc-p"),touchAction:getComputedStyle(el).touchAction}))).toEqual({own:true,plan:true,touchAction:"auto"});
   // offline es una re-renderización real de App, sin sync bancario ni escritura de dinero.
   await expect(page.locator(".offline-pill")).toHaveCount(0);
   await page.evaluate(()=>window.dispatchEvent(new Event("offline")));
   await expect(page.locator(".offline-pill")).toBeVisible();
   // App sync clears generic Plan ownership on this observed React update.
   // The Plan-only marker may survive unchanged className reconciliation; record it,
   // require fixed-host auto in either case, then require both absent at terminal.
   const rerenderOwnership=await page.locator(".page.page-scroll-host").evaluate(el=>({own:el.classList.contains("mc-touch-own"),plan:el.classList.contains("mc-p"),touchAction:getComputedStyle(el).touchAction,sheet:document.documentElement.classList.contains("sheet-open")}));
   expect(rerenderOwnership.own).toBe(false);expect(rerenderOwnership.touchAction).toBe("auto");expect(rerenderOwnership.sheet).toBe(false);
   console.log("PLAN_CANDIDATE_RERENDER "+JSON.stringify({sourceSHA:hosted.sources.candidate.sha,motion,safe,offlinePillObserved:true,ownership:rerenderOwnership}));
   await cdp.send("Input.dispatchTouchEvent",{type:"touchCancel",touchPoints:[]});await released(page);expect(await segment(page)).toBe("deudas");
   await resetTop(page);await dedoPlan(cdp);expect(await page.locator(".page.page-scroll-host").evaluate(el=>el.scrollTop)).toBeGreaterThan(2);expect(await segment(page)).toBe("deudas");await released(page);
   await dedoPlan(cdp,{dy:100,dx:20,steps:14,interval:16});expect(await segment(page)).toBe("deudas");expect(await tab(page)).toBe("plan");await released(page);
   for(const target of ["metas","recibos","deudas"]){await resetTop(page);await dedoPlan(cdp,{y:260,dy:190,dx:30,steps:14,interval:16});await expect.poll(()=>segment(page)).toBe(target);expect(await tab(page)).toBe("plan");await released(page);}
   await resetTop(page);await dedoPlan(cdp,{x:350,y:200,dy:0,dx:-270,steps:16,interval:16});await expect.poll(()=>tab(page)).toBe("cartera");await settled(page);
   await dedoPlan(cdp,{x:80,y:200,dy:0,dx:270,steps:16,interval:16});await expect.poll(()=>tab(page)).toBe("plan");await settled(page);await released(page);
   await resetTop(page);
   await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:196,y:430}]});
   await page.evaluate(()=>document.querySelector(".botnav-fab").click());
   await page.waitForFunction(()=>document.documentElement.classList.contains("sheet-open"));
   expect(await page.locator(".page.page-scroll-host").evaluate(el=>getComputedStyle(el).touchAction)).toBe("none");
   await cdp.send("Input.dispatchTouchEvent",{type:"touchCancel",touchPoints:[]});await released(page);
   await unchangedFinanzas(page,financeBefore,hosted.sources.candidate,"candidate/nativecontracts/"+motion+"/safe"+safe+"/final");
  }finally{await env.close();}
 });
}
