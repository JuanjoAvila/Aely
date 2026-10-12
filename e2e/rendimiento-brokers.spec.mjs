import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// El mismo guion sirve contra la base anterior: solo usa DOM que ambas versiones comparten.
// Ni sondeos de Playwright ni profiler dentro de la ventana de rAF (AGENTS §7 bis).
for(const screen of ["overview","full"]) test(`desplegar posiciones ${screen} a CPU6: frames de apertura y reposo`,async({page},testInfo)=>{
  const investments=Array.from({length:6},(_,n)=>({id:"tr-"+n,ent:"trade_republic",name:"Posición sintética "+n,value:100+n,cost:90+n,cur:"EUR"}));
  await seedLoggedInDashboard(page,{investments,settings:{autoPrices:false,theme:"green"}});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  if(screen==="full"){
    await page.getByRole("button",{name:/Ver todas tus inversiones|See all your investments|Veure totes les inversions/i}).click();
    await expect(page.locator("[data-inv-screen]")).toBeVisible();
  }
  const list=screen==="full"?page.locator("[data-inv-screen]"):page.locator(".v4-card-list").filter({hasText:/posiciones|positions|posicions/}).first();
  const row=list.locator("button.v4-mov").filter({hasText:"Trade Republic"});
  await row.scrollIntoViewIfNeeded();
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(500);
  const cdp=await page.context().newCDPSession(page), samples=[];
  try{
    await cdp.send("Emulation.setCPUThrottlingRate",{rate:6});
    for(let pass=0;pass<5;pass++){
      for(const open of [false,true]){
        const frames=await row.evaluate((el,open)=>new Promise(resolve=>{
          const deltas=[];
          requestAnimationFrame(first=>{
            let previous=first;
            if(open) el.click();
            const next=time=>{
              deltas.push(time-previous); previous=time;
              if(time-first<450) requestAnimationFrame(next);
              else resolve(deltas);
            };
            requestAnimationFrame(next);
          });
        }),open);
        samples.push({pass,phase:open?"expansion":"idle",frames,over32:frames.filter(ms=>ms>32).length,max:Math.max(...frames)});
        if(open){
          await expect(list.locator("[data-inv-position]")).toHaveCount(6);
          await row.evaluate(el=>el.click());
          await expect(list.locator("[data-inv-position]")).toHaveCount(0);
        }
        await page.waitForTimeout(150);
      }
    }
  }finally{
    await cdp.send("Emulation.setCPUThrottlingRate",{rate:1}); await cdp.detach();
  }
  await testInfo.attach("brokers-cpu6-frames.json",{body:Buffer.from(JSON.stringify({screen,source:process.env.MC_BROKER_SOURCE_SHA||"uncommitted",samples},null,2)),contentType:"application/json"});
  // El reposo se publica también: si la máquina introduce tirones ajenos al gesto, el rojo
  // queda pendiente de atribución, nunca se convierte en un pase quitando esas muestras.
  expect(samples.filter(s=>s.phase==="expansion").flatMap(s=>s.frames).filter(ms=>ms>32)).toEqual([]);
});
