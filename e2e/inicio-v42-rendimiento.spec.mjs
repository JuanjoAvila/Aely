import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

test("Inicio y arrastre con historial grande a CPU x6",async({page},testInfo)=>{
  await installFixtureClock(page);
  const now=Date.parse("2026-09-26T12:00:00Z");
  const history=Array.from({length:400},(_,i)=>({day:new Date(now-(399-i)*864e5).toISOString().slice(0,10),value:50000+i}));
  const expenses=Array.from({length:20000},(_,i)=>({id:"s"+i,date:new Date(now-i*864e5/100).toISOString(),amount:1,category:"super",ent:"sabadell",merchant:"Comercio sintético"}));
  await seedLoggedInDashboard(page,{expenses,accounts:[{id:"a",ent:"sabadell",name:"Cuenta sintética",value:60000,role:"diario",spendFrom:true}],accountBalanceHistory:{"acc:a":history},budget:10000});
  await page.addInitScript(()=>{
    window.__v42Frames=[];window.__v42Recording=false;let prev=0;
    function tick(now){if(window.__v42Recording&&prev)window.__v42Frames.push(now-prev);prev=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
    // La ventana se cierra desde la página; ni el sondeo del splash ni abrir otra hoja
    // forman parte de los frames de entrada que atribuimos a Inicio.
    window.addEventListener("mc-splash-gone",()=>{
      prev=0;window.__v42Frames=[];window.__v42Recording=true;
      setTimeout(()=>{window.__v42Recording=false;window.__v42Entry=window.__v42Frames.slice();},1400);
    });
  });
  const client=await page.context().newCDPSession(page);await client.send("Emulation.setCPUThrottlingRate",{rate:6});
  await page.goto("/",{waitUntil:"domcontentloaded"});await page.waitForTimeout(4000);
  const entry=await page.evaluate(()=>window.__v42Entry);
  expect(Array.isArray(entry)).toBe(true);expect(entry.length).toBeGreaterThan(10);
  await dismissNews(page);
  // Click crudo y espera ciega: el sondeo de Playwright no forma parte de la medida.
  const interaction=await page.evaluate(()=>{const started=performance.now();document.querySelector(".v42-cycle").click();return new Promise(resolve=>requestAnimationFrame(()=>resolve({ms:performance.now()-started,opened:!!document.querySelector(".v4-budget-sheet")})));});
  expect(interaction.opened).toBe(true);
  await page.evaluate(()=>history.back());await page.waitForTimeout(1400);
  await expect(page.locator(".v4-budget-sheet")).toHaveCount(0);
  const box=await page.locator(".v42-net-chart").boundingBox();
  await page.evaluate(()=>{window.__v42Frames=[];window.__v42Recording=true;});
  await client.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+10,y:box.y+40}]});
  for(let i=0;i<60;i++){
    await client.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:box.x+10+(box.width-20)*i/59,y:box.y+40}]});
    await page.waitForTimeout(16);
  }
  await client.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  const drag=await page.evaluate(()=>{window.__v42Recording=false;return window.__v42Frames;});
  expect(drag.length).toBeGreaterThan(10);
  const stats=values=>({frames:values.length,fps:1000/(values.reduce((a,b)=>a+b,0)/values.length),over32:values.filter(n=>n>32).length,max:Math.max(...values)});
  const evidence={cpuRate:6,expenses:20000,accountPoints:400,entry:stats(entry),drag:stats(drag),interaction};
  await testInfo.attach("inicio-v42-cpu6",{body:JSON.stringify(evidence,null,2),contentType:"application/json"});
  expect(evidence.entry.fps).toBeGreaterThanOrEqual(50);expect(evidence.drag.fps).toBeGreaterThanOrEqual(50);expect(interaction.ms).toBeLessThan(100);
  await expect(page.locator('.botnav-tab[data-tour="inicio"].active')).toBeVisible();await expect(page.getByTestId("inicio-net-date")).toHaveCount(0);
  await client.send("Emulation.setCPUThrottlingRate",{rate:1});await client.detach();
});
