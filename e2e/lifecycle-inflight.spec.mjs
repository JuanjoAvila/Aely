import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews,installFixtureClock,FIXTURE_NOW} from "./fixtures.mjs";

test.use({serviceWorkers:"block"});
const raw=page=>page.evaluate(()=>({stateRaw:localStorage.getItem("micartera_v3"),expensesRaw:localStorage.getItem("micartera_v3_exp"),writes:{...window.__inflight.writes}}));
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function visibility(page,state){
 const result=await page.evaluate(state=>{
  window.__inflight.visibility=state;document.dispatchEvent(new Event("visibilitychange"));
  const readback={visibility:document.visibilityState,hidden:document.hidden,online:navigator.onLine};
  window.__inflight.transitions.push(readback);return readback;
 },state);
 expect(result.visibility).toBe(state);expect(result.hidden).toBe(state==="hidden");return result;
}
for(const terminal of ["success","error"])test("lifecycle drena lectura retenida con final antiguo "+terminal,async({page,context},testInfo)=>{
 const errors=[];const pageError=()=>errors.push("pageerror");page.on("pageerror",pageError);
 const origin=new URL(testInfo.project.use.baseURL).origin;
 await context.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await installFixtureClock(page);
 const date=new Date(FIXTURE_NOW).toISOString();
 await seedLoggedInDashboard(page,{
  budget:100,lastBackup:date.slice(0,10),badges:["first_goal","first_underbudget","first_reto","streak_3","save_100","save_500","save_1000","save_5000"],
  accounts:[{id:"a",ent:"sabadell",name:"Cuenta sintética",value:1000,role:"diario",spendFrom:true}],
  expenses:[{id:"550e8400-e29b-41d4-a716-446655440001",date,amount:40,merchant:"Compra sintética",category:"otros",source:"manual",ent:"sabadell"}],
  __cloudRows:{expenses:[{id:"550e8400-e29b-41d4-a716-446655440001",fecha:date,importe:40,comercio:"Compra sintética",cat:"otros",source:"manual:sabadell"}]},
  settings:{autoPrices:false,theme:"green",expenseBanks:["sabadell"]},
 });
 await page.addInitScript(()=>{
  const p=window.__inflight={visibility:"visible",transitions:[],unhandled:0,records:[],promises:[],inFlight:0,bankSync:0,writes:{state:0,expenses:0}};
  Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>p.visibility});
  Object.defineProperty(document,"hidden",{configurable:true,get:()=>p.visibility==="hidden"});
  p.onUnhandled=()=>p.unhandled++;window.addEventListener("unhandledrejection",p.onUnhandled);
 });
 try{
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load")&&document.querySelector(".botnav"));await dismissNews(page);
  // lastSync persistido acredita el pull inicial; no usar una demora como prueba de asentamiento.
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem("micartera_v3"))?.lastSync>0);await frames(page);
  await page.evaluate(()=>{
   const p=window.__inflight;p.originalPull=cloud.pullExpenses;p.originalBank=cloud.bankSync;
   p.originalPut=Storage.prototype.setItem;
   Storage.prototype.setItem=function(k,v){if(k==="micartera_v3")p.writes.state++;if(k==="micartera_v3_exp")p.writes.expenses++;return p.originalPut.apply(this,arguments);};
   cloud.bankSync=function(){p.bankSync++;return p.originalBank.apply(this,arguments);};
   cloud.pullExpenses=function(){
    const record={id:p.records.length+1,phase:"started",online:navigator.onLine};p.records.push(record);p.inFlight++;
    const gate=record.id===1?new Promise(resolve=>{record.release=resolve;}):null;
    const args=arguments;
    const promise=(async()=>{
     try{
      // Offline es real en Chromium, pero el rechazo del transporte doble es explícito:
      // no se afirma cancelar un socket ni una consulta Supabase real ya en vuelo.
      if(!record.online)throw new Error("fixture-offline");
      const rows=await p.originalPull.apply(cloud,args);record.payload=JSON.stringify(rows);
      if(record.id===1){record.phase="held-before-delivery";record.outcome=await gate;if(record.outcome==="error")throw new Error("fixture-late-error");}
      record.phase="fulfilled";return rows;
     }catch(error){record.phase="rejected";throw error;}
     finally{p.inFlight--;record.settled=true;}
    })();
    p.promises.push(promise);return promise;
   };
  });
  await visibility(page,"hidden");await visibility(page,"visible");
  await page.waitForFunction(()=>window.__inflight.records[0]?.phase==="held-before-delivery");
  await visibility(page,"hidden");await context.setOffline(true);
  expect((await visibility(page,"visible")).online).toBe(false);
  await page.waitForFunction(()=>window.__inflight.records[1]?.phase==="rejected"&&window.__inflight.records[1].settled);
  expect(await page.evaluate(()=>window.__inflight.records[0].phase)).toBe("held-before-delivery");
  await visibility(page,"hidden");await context.setOffline(false);
  const beforeC=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).lastSync);
  expect((await visibility(page,"visible")).online).toBe(true);
  await page.waitForFunction(()=>window.__inflight.records[2]?.phase==="fulfilled"&&JSON.parse(localStorage.getItem("micartera_v3")).lastSync>0);
  await page.waitForFunction(before=>JSON.parse(localStorage.getItem("micartera_v3")).lastSync>before,beforeC);
  await frames(page);await visibility(page,"hidden");
  const afterC=await raw(page);
  const preRelease=await page.evaluate(()=>({phases:window.__inflight.records.map(r=>r.phase),inFlight:window.__inflight.inFlight,
   payloadSame:window.__inflight.records[0].payload===window.__inflight.records[2].payload}));
  expect(preRelease).toEqual({phases:["held-before-delivery","rejected","fulfilled"],inFlight:1,payloadSame:true});
  await page.evaluate(terminal=>window.__inflight.records[0].release(terminal),terminal);
  await page.waitForFunction(()=>window.__inflight.inFlight===0&&window.__inflight.records.every(r=>r.settled));
  // El hidden real del fixture vuelve a ejecutar flushPersist tras el commit de React:
  // también descubre una escritura tardía que aún estuviera en el debounce de 400ms.
  await frames(page);await visibility(page,"hidden");expect(await raw(page)).toEqual(afterC);
  const final=await page.evaluate(()=>({phases:window.__inflight.records.map(r=>r.phase),inFlight:window.__inflight.inFlight,
   starts:window.__inflight.records.length,unhandled:window.__inflight.unhandled,bankSync:window.__inflight.bankSync}));
  expect(final).toEqual({phases:[terminal==="success"?"fulfilled":"rejected","rejected","fulfilled"],inFlight:0,starts:3,unhandled:0,bankSync:0});
  expect(errors).toEqual([]);
  console.log("LIFECYCLE_INFLIGHT_SYNTHETIC "+JSON.stringify({terminal,preRelease,final,transitions:await page.evaluate(()=>window.__inflight.transitions),rawInvariantAfterC:true,
   limits:"same synthetic payload; hidden getters+visibilitychange, Chromium offline, explicit promise rejection; no socket cancellation, OS suspension, bank transport or lag conclusion"}));
 }finally{
  // Libera cualquier A retenido incluso si falló un readback; no queda una operación colgada.
  await page.evaluate(async()=>{
   const p=window.__inflight;if(!p)return;
   p.records.forEach(r=>r.release?.("success"));await Promise.allSettled(p.promises);
   if(p.originalPull)cloud.pullExpenses=p.originalPull;if(p.originalBank)cloud.bankSync=p.originalBank;
   if(p.originalPut)Storage.prototype.setItem=p.originalPut;
   window.removeEventListener("unhandledrejection",p.onUnhandled);p.visibility="visible";
  });
  await context.setOffline(false);page.off("pageerror",pageError);
 }
});
