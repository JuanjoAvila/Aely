import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, FIXTURE_NOW } from "./fixtures.mjs";
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
    expenses:history.map((p,i)=>({id:"series-"+i,date:p.day+"T12:00:00Z",amount:i?(falling?1:-1):0,category:"inversion",ent:"sabadell",merchant:"Flujo sintético"})).concat([{id:"salary",date:"2026-09-01T12:00:00Z",amount:-2000,merchant:"Nómina sintética",category:"ingreso",ent:"sabadell"},
      {id:"spending",date:"2026-09-02T12:00:00Z",amount:spent,merchant:"Compra sintética",category:"super",ent:"sabadell"}])});
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
  await card.screenshot({animations:"disabled",path:testInfo.outputPath("cycle-"+state.id+"-synthetic.png")});
  await testInfo.attach("cycle-"+state.id+"-synthetic",{path:testInfo.outputPath("cycle-"+state.id+"-synthetic.png"),contentType:"image/png"});
});
for(const zone of ["UTC","Europe/Madrid"]) test.describe("calendario de Madrid en "+zone,()=>{
  test.use({timezoneId:zone});
  test("casi agotado dice justo y conserva el margen sin inventar ritmo",async({page})=>{
    await open(page,{cycle:false,day:26,spent:950});
    await expect(page.locator(".v42-cycle")).toHaveAttribute("data-state","tight");
    await expect(page.locator(".v42-cycle .st")).toHaveText("Vas justito");
    await expect(page.locator(".v42-cycle-amount>.serif")).toHaveText("50 €");
    await expect(page.getByTestId("inicio-cycle-pace")).toHaveText("10 € al día durante 5 días");
  });
  test("el cambio horario no inventa un día más de margen diario",async({page})=>{
    await page.clock.install({time:new Date("2026-10-25T23:30:00Z")});
    await seedLoggedInDashboard(page,{budget:1000,settings:{autoPrices:false,theme:"green",budgetCycle:true},
      accounts:[{id:"a",ent:"sabadell",value:5000,role:"diario",spendFrom:true}],expenses:[
        {id:"salary",date:"2026-10-25T12:00:00Z",amount:-2000,merchant:"Nómina sintética",category:"ingreso",ent:"sabadell"},
        {id:"expense",date:"2026-10-25T16:00:00Z",amount:100,merchant:"Compra sintética",category:"super",ent:"sabadell"}]});
    await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
    await expect(page.getByTestId("inicio-cycle-pace")).toHaveText("30 € al día durante 30 días");
    await expect(page.locator(".v42-cycle-amount>.serif")).toHaveText("900 €");
  });
  test("la gráfica y el dedo incluyen el ingreso de hoy tras medianoche de Madrid",async({page})=>{
    await page.clock.install({time:new Date("2026-09-25T22:30:00Z")});
    await seedLoggedInDashboard(page,{budget:1000,settings:{autoPrices:false,theme:"green",budgetCycle:false},accounts:[
      {id:"a",ent:"sabadell",value:500,role:"fijos",bankIban:"ES-SYNTHETIC-A"},
      {id:"b",ent:"revolut",value:300,role:"fijos",bankIban:"ES-SYNTHETIC-B"}],expenses:[
      {id:"coverage-a",date:"2026-09-25T12:00:00Z",amount:0,category:"super",ent:"sabadell"},
      {id:"coverage-b",date:"2026-09-25T12:00:00Z",amount:0,category:"super",ent:"revolut"},
      {id:"income",date:"2026-09-25T22:10:00Z",amount:-200,category:"ingreso",ent:"sabadell",merchant:"Ingreso sintético"}]});
    await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
    const hero=page.getByTestId("inicio-net-current"),amount=hero.locator(".v4-hero-amt");
    await expect(amount).toContainText("800,00 €");
    await expect(hero.locator(".v42-net-ranges button")).toHaveText(["Todo"]);
    await expect(hero.getByTestId("inicio-net-delta")).toContainText("200");
    const path=await hero.locator(".v42-net-line").getAttribute("d");expect([...path.matchAll(/[ML]/g)]).toHaveLength(2);
    const box=await hero.locator(".v42-net-chart").boundingBox(),client=await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+4,y:box.y+35}]});
    await expect(hero.getByTestId("inicio-net-date")).toContainText(/^25\b/);await expect(amount).toContainText("600,00 €");
    await expect(hero.getByTestId("inicio-net-guide")).toBeVisible();
    await client.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await expect(amount).toContainText("800,00 €");await expect(hero.getByTestId("inicio-net-date")).toHaveCount(0);
    await expect(hero.getByTestId("inicio-net-guide")).toHaveCount(0);await client.detach();
  });
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
test("historial corto no ofrece rangos inventados y mes natural conserva ritmo",async({page})=>{
  await open(page,{historyDays:10,cycle:false});await expect(page.locator(".v42-net-ranges button")).toHaveText(["Todo"]);
  await expect(page.getByTestId("inicio-cycle-pace")).toHaveText("27 € al día durante 18 días");
});
test("fotos atrasadas no recortan los flujos hasta hoy",async({page})=>{
  await open(page,{lag:20});const hero=page.getByTestId("inicio-net-current");
  await expect(hero.locator(".v42-net-chart svg")).toBeVisible();
  await expect(hero.locator(".v42-net-ranges button")).toHaveCount(4);
  await expect(hero.getByTestId("inicio-net-delta")).toBeVisible();
});
for(const commonEnd of [false,true]) test("fotos escalonadas no pintan pérdida de un traspaso "+commonEnd,async({page})=>{
  await seedLoggedInDashboard(page,{budget:1000,accounts:[
    {id:"a",ent:"sabadell",value:300,role:"diario",spendFrom:true},
    {id:"b",ent:"revolut",value:300,role:"diario",spendFrom:true}],accountBalanceHistory:{
      "acc:a":[{day:"2026-09-01",value:500},{day:"2026-09-02",value:300}].concat(commonEnd?[{day:"2026-09-03",value:300}]:[]),
      "acc:b":[{day:"2026-09-01",value:100},{day:"2026-09-03",value:300}]},expenses:[
        {id:"coverage-a",date:"2026-09-01T12:00:00Z",amount:0,ent:"sabadell",category:"super"},
        {id:"coverage-b",date:"2026-09-01T12:00:00Z",amount:0,ent:"revolut",category:"super"},
        {id:"out",date:"2026-09-02T12:00:00Z",amount:200,ent:"sabadell",category:"traspaso"},
        {id:"in",date:"2026-09-03T12:00:00Z",amount:-200,ent:"revolut",category:"traspaso"}]});
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  const hero=page.getByTestId("inicio-net-current");
  await expect(hero.locator(".v4-hero-amt")).toContainText("600,00 €");
  await expect(hero.locator("svg")).toHaveCount(1);
  const path=await hero.locator(".v42-net-line").getAttribute("d");
  expect([...path.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map(m=>m[1]).every(y=>y==="40.00")).toBe(true);
});
for(const reduced of [false,true]) test("dedo consulta y suelta "+reduced,async({page})=>{
  // Contador de render sin cambiar el comportamiento: comprueba que el dedo sólo toca
  // el bloque local, no toda la pantalla. El HTML servido sigue siendo el candidato real.
  await page.route("http://127.0.0.1:*/",async route=>{
    const response=await route.fetch(),html=await response.text();
    const marker="function Dashboard({state, totals, set, onOpenSettings, onOpenProfile, onGoGastos, onGoPlan, showToast}){";
    expect(html.split(marker)).toHaveLength(2);
    await route.fulfill({response,body:html.replace(marker,marker+"window.__v42DashboardRenders=(window.__v42DashboardRenders||0)+1;window.__v42DashboardChanges=(window.__v42DashboardChanges||[]).concat([window.__v42PreviousState?Object.keys(state).filter(function(k){return state[k]!==window.__v42PreviousState[k];}):['mount']]);window.__v42PreviousState=state;")});
  });
  await page.emulateMedia({reducedMotion:reduced?"reduce":"no-preference"});await open(page);
  await page.waitForFunction(()=>window.__mcBootReady===true);await page.waitForTimeout(2200);
  const hero=page.getByTestId("inicio-net-current"), amount=hero.locator(".v4-hero-amt"), before=await amount.innerText(),delta=await hero.getByTestId("inicio-net-delta").innerText();
  const chart=page.locator(".v42-net-chart"),box=await chart.boundingBox();
  expect(await chart.evaluate(el=>getComputedStyle(el).touchAction)).toBe("pan-y");
  const renders=await page.evaluate(()=>window.__v42DashboardRenders);
  const client=await page.context().newCDPSession(page);
  const touch=async(type,x)=>client.send("Input.dispatchTouchEvent",{type,touchPoints:type==="touchEnd"?[]:[{x:box.x+x*box.width,y:box.y+35}]});
  await touch("touchStart",.1);await expect(hero.getByTestId("inicio-net-date")).toBeVisible();await expect(hero.getByTestId("inicio-net-guide")).toBeVisible();const first=await amount.innerText(),date=await hero.getByTestId("inicio-net-date").innerText();
  await touch("touchMove",.8);await expect(amount).not.toHaveText(first);await expect(hero.getByTestId("inicio-net-date")).not.toHaveText(date);
  await expect(hero.getByTestId("inicio-net-delta")).toHaveText(delta);await expect(page.locator('.botnav-tab[data-tour="inicio"].active')).toBeVisible();
  await touch("touchEnd",.8);await expect(hero.getByTestId("inicio-net-date")).toHaveCount(0);await expect(hero.getByTestId("inicio-net-guide")).toHaveCount(0);await expect(amount).toHaveText(before);
  expect(await page.evaluate(()=>window.__v42DashboardRenders),JSON.stringify(await page.evaluate(()=>window.__v42DashboardChanges))).toBe(renders);
  await hero.locator(".v42-net-ranges button").last().click();
  await touch("touchStart",316/320);await expect(hero.getByTestId("inicio-net-date")).toContainText(/^13\b/);
  await touch("touchEnd",316/320);await expect(hero.getByTestId("inicio-net-date")).toHaveCount(0);await expect(amount).toHaveText(before);
  if(reduced){expect(await chart.locator(".v42-net-line").evaluate(el=>getComputedStyle(el).animationName)).toBe("none");await expect(chart.locator(".v42-net-halo")).toBeHidden();}
  await client.detach();
});

test("NO-GO scroll vertical sobre la gráfica conserva cifra y no consulta fecha",async({page})=>{
  await open(page);await page.waitForTimeout(2200);
  const hero=page.getByTestId("inicio-net-current"),before=await hero.locator(".v4-hero-amt").innerText();
  const box=await hero.locator(".v42-net-chart").boundingBox(),cdp=await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+box.width/2,y:box.y+35}]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:box.x+box.width/2+2,y:box.y-35}]});
  await page.waitForTimeout(350);
  await expect(hero.locator(".v4-hero-amt")).toHaveText(before);
  await expect(hero.getByTestId("inicio-net-date")).toHaveCount(0);
  await expect(hero.getByTestId("inicio-net-guide")).toHaveCount(0);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await cdp.detach();
});

for(const lang of ["es","en","ca"]) test("NO-GO último día natural y etiqueta de lo que queda "+lang,async({page})=>{
  await open(page,{cycle:false,day:30,spent:900,lang});
  const labels={es:["Este mes","Te quedan","100 € al día durante 1 día"],en:["This month","Left to spend","100 € a day for 1 day"],ca:["Aquest mes","Et queden","100 € al dia durant 1 dia"]}[lang];
  await expect(page.locator(".v42-cycle-head>span")).toHaveText(labels[0]);
  await expect(page.locator(".v42-cycle-remaining")).toHaveText(labels[1]);
  await expect(page.getByTestId("inicio-cycle-pace")).toHaveText(labels[2]);
  await expect(page.locator(".v42-cycle-percent")).toHaveText("10%");
});
test("NO-GO presupuesto agotado no ofrece gasto diario",async({page})=>{
  await open(page,{cycle:false,spent:1000});await expect(page.getByTestId("inicio-cycle-pace")).toHaveCount(0);
});
test("NO-GO cuenta nueva nombra el límite y un usuario nuevo empieza hoy",async({page})=>{
  await installFixtureClock(page);
  await seedLoggedInDashboard(page,{accounts:[{id:"a",ent:"sabadell",name:"Cuenta antigua",value:1000,role:"fijos",bankIban:"SYN-A"},{id:"b",ent:"revolut",name:"Cuenta reciente",value:300,role:"fijos",bankIban:"SYN-B"}],expenses:[{id:"a1",ent:"sabadell",date:"2026-09-01T12:00:00Z",amount:10,category:"super"},{id:"b1",ent:"revolut",date:"2026-09-25T12:00:00Z",amount:10,category:"super"}]});
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  await expect(page.getByTestId("inicio-net-coverage")).toContainText(/Cuenta reciente: datos desde 25/);
});
test("NO-GO usuario nuevo sin presupuesto tiene mensaje propio y ningún ritmo",async({page})=>{
  await installFixtureClock(page);await seedLoggedInDashboard(page,{accounts:[],investments:[],expenses:[],budget:0,history:[],invHistory:[],accountBalanceHistory:{}});
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  await expect(page.getByTestId("inicio-net-current")).toContainText("Tu histórico empieza hoy");
  await expect(page.getByTestId("inicio-cycle-pace")).toHaveCount(0);
});

for(const sandbox of [false,true]) test("historial partido migra 400 puntos y recarga "+sandbox,async({page})=>{
  await installFixtureClock(page);
  const key=sandbox?"micartera_sandbox":"micartera_v3";
  const history=Array.from({length:400},(_,i)=>({day:new Date(FIXTURE_NOW-(399-i)*864e5).toISOString().slice(0,10),value:1000+i}));
  await seedLoggedInDashboard(page,{__seedOnce:true,budget:1000,accounts:[{id:"a",ent:"efectivo",value:1399,role:"fijos"}],expenses:[],accountBalanceHistory:{"acc:a":history}});
  await page.addInitScript(sandbox=>{
    if(sandbox){
      if(!localStorage.getItem("micartera_sandbox")) localStorage.setItem("micartera_sandbox",localStorage.getItem("micartera_v3"));
      localStorage.setItem("_mcSandbox","1");
    }
    const original=Storage.prototype.setItem;window.__v42Writes=[];
    Storage.prototype.setItem=function(k,v){window.__v42Writes.push({key:k,bytes:new TextEncoder().encode(v).length});return original.call(this,k,v);};
  },sandbox);
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  await page.locator(".v42-cycle").click();const sheet=page.locator(".v4-budget-sheet");
  await sheet.getByRole("button",{name:"+",exact:true}).click();await sheet.locator(".v4-cta").click();await page.waitForTimeout(700);
  const stored=await page.evaluate(key=>({main:JSON.parse(localStorage.getItem(key)),history:JSON.parse(localStorage.getItem(key+"_balhist"))}),key);
  expect(stored.main.accountBalanceHistory).toBeUndefined();expect(stored.history.history["acc:a"]).toEqual(history);
  await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  await expect(page.locator(".v42-cycle-of")).toContainText("1050");
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key+"_balhist")).history["acc:a"],key)).toEqual(history);
});
