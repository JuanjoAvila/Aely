import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";
export const states=[
  {id:"over",spent:1001,text:"Te has pasado 1 €",tone:"coral"},
  {id:"start",spent:900,text:"Ciclo recién empezado",tone:"mint",day:3},
  {id:"comfort",spent:250,text:"Vas sobrado",tone:"mint"},
  {id:"good",spent:500,text:"Vas bien",tone:"mint"},
  {id:"tight",spent:800,text:"Vas justito",tone:"tan"},
  {id:"slow",spent:801,text:"Toca frenar un poco",tone:"tan"},
];
async function open(page,{spent=500,day=13,lang="es",historyDays=370,falling=false,cycle=true,lag=0}={}){
  await page.clock.install({time:new Date(`2026-09-${String(day).padStart(2,"0")}T12:00:00Z`)});
  const end=Date.parse(`2026-09-${String(day).padStart(2,"0")}T12:00:00Z`)-lag*864e5;
  const history=Array.from({length:historyDays},(_,i)=>({day:new Date(end-(historyDays-1-i)*864e5).toISOString().slice(0,10),value:1000+(falling?-i:i)}));
  await seedLoggedInDashboard(page,{accounts:[{id:"a",ent:"sabadell",name:"Cuenta sintética",value:5000,role:"diario",spendFrom:true}],
    budget:1000,history:[0,999999],accountBalanceHistory:{"acc:a":history},settings:{autoPrices:false,theme:"green",lang,budgetCycle:cycle},
    expenses:[{id:"salary",date:"2026-09-01T12:00:00Z",amount:-2000,merchant:"Nómina sintética",category:"ingreso",ent:"sabadell"},
      {id:"spending",date:"2026-09-02T12:00:00Z",amount:spent,merchant:"Compra sintética",category:"super",ent:"sabadell"}]});
  await page.goto("/"); await page.waitForFunction(()=>!document.getElementById("mc-load")); await dismissNews(page);
  await expect(page.locator(".v42-cycle")).toBeVisible();
}
for(const state of states) test("estado real "+state.id,async({page},testInfo)=>{
  await open(page,state);
  const card=page.locator(".v42-cycle");
  await expect(card).toHaveAttribute("data-state",state.id); await expect(card.locator(".st")).toHaveText(state.text);
  await expect(card.locator(".v42-cycle-amount>.serif")).toHaveText((state.id==="over"?"-1":String(1000-state.spent))+" €");
  const color=await card.evaluate((el,tone)=>getComputedStyle(el).color===getComputedStyle(document.documentElement).getPropertyValue("--"+tone).trim() ||
    (()=>{const probe=document.createElement("span");probe.style.color="var(--"+tone+")";el.appendChild(probe);const result=getComputedStyle(probe).color===getComputedStyle(el).color;probe.remove();return result;})(),state.tone);
  expect(color).toBe(true);
  const painted=await card.evaluate(el=>({card:getComputedStyle(el).color,state:getComputedStyle(el.querySelector(".st")).color,
    ring:getComputedStyle(el.querySelector(".v42-cycle-draw")).stroke,font:getComputedStyle(el.querySelector(".st")).fontSize}));
  expect(painted.state).toBe(painted.card);expect(painted.ring).toBe(painted.card);expect(painted.font).toBe("12.5px");
  await expect(card.getByTestId("inicio-cycle-pace")).toHaveCount(state.id==="over"?0:1);
  await expect(card.locator(".v4-budget-foot")).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath("cycle-"+state.id+"-synthetic.png")});
  await testInfo.attach("cycle-"+state.id+"-synthetic",{path:testInfo.outputPath("cycle-"+state.id+"-synthetic.png"),contentType:"image/png"});
});
for(const lang of ["es","en","ca"]) test("rangos, colores y puertas "+lang,async({page})=>{
  await open(page,{lang,falling:true});
  const hero=page.getByTestId("inicio-net-current"), ranges=hero.locator(".v42-net-ranges button");
  await expect(ranges).toHaveCount(4);expect(await ranges.allTextContents()).not.toContain("3M");
  const same=()=>page.evaluate(()=>getComputedStyle(document.querySelector(".v42-net-delta")).color===getComputedStyle(document.querySelector(".v42-net-chart svg")).color);
  expect(await same()).toBe(true);
  const original=await hero.locator("svg").evaluate(el=>{window.__v42Original=el;return true;});expect(original).toBe(true);
  await hero.locator(".v42-net-info").click(); await expect(hero.getByRole("note")).toBeVisible();
  expect(await hero.locator("svg").evaluate(el=>el===window.__v42Original)).toBe(true);
  await hero.locator(".v42-net-chart").evaluate(el=>{window.__v42Mounts=0;window.__v42Observer=new MutationObserver(rows=>{
    for(const row of rows)for(const node of row.addedNodes)if(node.nodeName.toLowerCase()==="svg")window.__v42Mounts++;
  });window.__v42Observer.observe(el,{childList:true});});
  for(let i=0;i<10;i++){
    const index=(i+1)%4;await ranges.nth(index).click();await expect(ranges.nth(index)).toHaveAttribute("aria-pressed","true");
    expect(await same()).toBe(true);expect(await page.evaluate(()=>window.__v42Mounts)).toBe(i+1);
  }
  await page.evaluate(()=>window.__v42Observer.disconnect());
  await expect(hero.getByTestId("inicio-net-date")).toHaveCount(0);
  await page.locator(".v42-cycle-head .link").click();await expect(page.locator('.botnav-tab[data-tour="gastos"].active')).toBeVisible();
  await page.locator('.botnav-tab[data-tour="inicio"]').click();await page.locator(".v42-cycle").click();await expect(page.locator(".v4-budget-sheet")).toBeVisible();
});
test("historial corto no ofrece rangos inventados y sin ciclo oculta ritmo",async({page})=>{
  await open(page,{historyDays:10,cycle:false});await expect(page.locator(".v42-net-ranges button")).toHaveText(["Todo"]);
  await expect(page.getByTestId("inicio-cycle-pace")).toHaveCount(0);
});
test("foto atrasada conserva la gráfica sin comparar con hoy",async({page})=>{
  await open(page,{lag:20});const hero=page.getByTestId("inicio-net-current");
  await expect(hero.locator(".v42-net-chart svg")).toBeVisible();
  await expect(hero.locator(".v42-net-ranges button")).toHaveText(["Todo"]);
  await expect(hero.getByTestId("inicio-net-delta")).toHaveCount(0);
});
for(const commonEnd of [false,true]) test("fotos escalonadas no pintan pérdida de un traspaso "+commonEnd,async({page})=>{
  await seedLoggedInDashboard(page,{budget:1000,accounts:[
    {id:"a",ent:"sabadell",value:300,role:"diario",spendFrom:true},
    {id:"b",ent:"revolut",value:300,role:"diario",spendFrom:true}],accountBalanceHistory:{
      "acc:a":[{day:"2026-09-01",value:500},{day:"2026-09-02",value:300}].concat(commonEnd?[{day:"2026-09-03",value:300}]:[]),
      "acc:b":[{day:"2026-09-01",value:100},{day:"2026-09-03",value:300}]},expenses:[
        {id:"out",date:"2026-09-02T12:00:00Z",amount:200,ent:"sabadell",category:"traspaso"},
        {id:"in",date:"2026-09-02T12:00:00Z",amount:-200,ent:"revolut",category:"traspaso"}]});
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  const hero=page.getByTestId("inicio-net-current");
  await expect(hero.locator(".v4-hero-amt")).toContainText("600,00 €");
  await expect(hero.locator("svg")).toHaveCount(0);await expect(hero.getByTestId("inicio-net-delta")).toHaveCount(0);
  await expect(hero).toContainText("Faltan saldos fiables para mostrar la gráfica.");
});
for(const reduced of [false,true]) test("dedo consulta y suelta "+reduced,async({page})=>{
  await page.emulateMedia({reducedMotion:reduced?"reduce":"no-preference"});await open(page);
  await page.waitForTimeout(1200);
  const hero=page.getByTestId("inicio-net-current"), amount=hero.locator(".v4-hero-amt"), before=await amount.innerText(),delta=await hero.getByTestId("inicio-net-delta").innerText();
  const chart=page.locator(".v42-net-chart"),box=await chart.boundingBox();
  const client=await page.context().newCDPSession(page);
  const touch=async(type,x)=>client.send("Input.dispatchTouchEvent",{type,touchPoints:type==="touchEnd"?[]:[{x:box.x+x*box.width,y:box.y+35}]});
  await touch("touchStart",.1);await expect(hero.getByTestId("inicio-net-date")).toBeVisible();const first=await amount.innerText(),date=await hero.getByTestId("inicio-net-date").innerText();
  await touch("touchMove",.8);await expect(amount).not.toHaveText(first);await expect(hero.getByTestId("inicio-net-date")).not.toHaveText(date);
  await expect(hero.getByTestId("inicio-net-delta")).toHaveText(delta);await expect(page.locator('.botnav-tab[data-tour="inicio"].active')).toBeVisible();
  await touch("touchEnd",.8);await expect(hero.getByTestId("inicio-net-date")).toHaveCount(0);await expect(amount).toHaveText(before);
  await hero.locator(".v42-net-ranges button").last().click();
  await touch("touchStart",316/320);await expect(hero.getByTestId("inicio-net-date")).toContainText(/^13\b/);
  await touch("touchEnd",316/320);await expect(hero.getByTestId("inicio-net-date")).toHaveCount(0);await expect(amount).toHaveText(before);
  if(reduced){expect(await chart.locator(".v42-net-line").evaluate(el=>getComputedStyle(el).animationName)).toBe("none");await expect(chart.locator(".v42-net-halo")).toBeHidden();}
  await client.detach();
});
