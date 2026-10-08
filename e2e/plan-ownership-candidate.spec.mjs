import {test,expect,devices} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews,installFixtureClock} from "./fixtures.mjs";
import {prepararFuentesPlan,dedoPlan,resumenFramesPlan,debts,goals,fixed,finanzasPlanFingerprint} from "./plan-ownership-candidate.mjs";
let hosted;
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
 await installFixtureClock(page);await seedLoggedInDashboard(page,{debts,goals,fixed,badges:["first_goal","first_underbudget","first_reto","streak_3","save_100","save_500","save_1000","save_5000"]});
 const response=await page.goto("/");expect(response.headers()["x-aely-source"]).toBe(source.sha);expect(response.headers()["x-aely-html-sha"]).toBe(source.htmlHash);
 await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
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
async function released(page){expect(await page.locator(".page.page-scroll-host").evaluate(el=>({own:el.classList.contains("mc-touch-own"),plan:el.classList.contains("mc-plan-touch-own")}))).toEqual({own:false,plan:false});}
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
    const financeBefore=await finanzasPlanFingerprint(page);
    for(const phase of ["first","after-12-use-cycles"]){
     if(phase!=="first")for(let i=0;i<12;i++){
      await resetTop(page);await dedoPlan(cdp,{steps:12,interval:16});await page.waitForTimeout(100);expect(await page.locator(".page.page-scroll-host").evaluate(el=>el.scrollTop)).toBeGreaterThan(2);
      await selectTab(page,"gastos",cdp);await selectTab(page,"plan",cdp);await chooseSegment(page,seg);
     }
     expect(await finanzasPlanFingerprint(page)).toBe(financeBefore);
     const report=await naturalSample(page,cdp,source,name+"/"+seg+"/"+phase);
     expect(await finanzasPlanFingerprint(page)).toBe(financeBefore);expect(await tab(page)).toBe("plan");expect(await segment(page)).toBe(seg);reports.push(report);
    }
    expect(await finanzasPlanFingerprint(page)).toBe(financeBefore);
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
   expect(await page.locator(".page.page-scroll-host").evaluate(el=>({marker:el.classList.contains("mc-plan-touch-own"),touchAction:getComputedStyle(el).touchAction}))).toEqual({marker:false,touchAction:"none"});
   await selectTab(page,"plan",cdp);await chooseSegment(page,"deudas");await resetTop(page);
   const financeBefore=await finanzasPlanFingerprint(page);
   await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:196,y:430}]});
   expect(await page.locator(".page.page-scroll-host").evaluate(el=>({own:el.classList.contains("mc-touch-own"),plan:el.classList.contains("mc-plan-touch-own"),touchAction:getComputedStyle(el).touchAction}))).toEqual({own:true,plan:true,touchAction:"auto"});
   // offline es una re-renderización real de App, sin sync bancario ni escritura de dinero.
   await expect(page.locator(".offline-pill")).toHaveCount(0);
   await page.evaluate(()=>window.dispatchEvent(new Event("offline")));
   await expect(page.locator(".offline-pill")).toBeVisible();
   // App sync clears generic Plan ownership on this observed React update.
   // The Plan-only marker may survive unchanged className reconciliation; record it,
   // require fixed-host auto in either case, then require both absent at terminal.
   const rerenderOwnership=await page.locator(".page.page-scroll-host").evaluate(el=>({own:el.classList.contains("mc-touch-own"),plan:el.classList.contains("mc-plan-touch-own"),touchAction:getComputedStyle(el).touchAction,sheet:document.documentElement.classList.contains("sheet-open")}));
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
   expect(await finanzasPlanFingerprint(page)).toBe(financeBefore);
  }finally{await env.close();}
 });
}
