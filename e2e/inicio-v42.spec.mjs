import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, FIXTURE_NOW, estadoHeredado } from "./fixtures.mjs";
export const states=[
  {id:"over",spent:1001,text:"Te has pasado 1 €",tone:"coral"},
  {id:"start",spent:900,text:"Ciclo recién empezado",tone:"mint",day:3},
  {id:"comfort",spent:250,text:"Vas sobrado",tone:"mint"},
  {id:"good",spent:500,text:"Vas bien",tone:"mint"},
  {id:"tight",spent:800,text:"Vas justito",tone:"tan"},
  {id:"slow",spent:801,text:"Toca frenar un poco",tone:"tan"},
];
// La «i» pinta fechas con el mismo Intl que la app (día, mes corto, año, calendario de Madrid).
const fecha=(day,lang)=>new Intl.DateTimeFormat({es:"es",en:"en-GB",ca:"ca"}[lang],{timeZone:"Europe/Madrid",day:"numeric",month:"short"}).format(Date.parse(day+"T12:00:00Z"));
// Filas de la hoja «Cómo se calcula» que abre la «i»: [etiqueta, dato].
const filas=page=>page.locator('[data-sheet="net-info"] .row').evaluateAll(els=>els.map(e=>[e.querySelector(".rname").textContent,e.querySelector(".rval").textContent]));
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
  await expect(card).toHaveAttribute("data-state",state.id); await expect(card).toHaveAttribute("aria-label",new RegExp("^"+state.text+"\\. Te quedan "));
  // El estado ya no se pinta como texto: lo dicen el color del anillo y de la línea «al día».
  await expect(card).not.toContainText(state.text); await expect(card).not.toContainText("Te quedan");
  await expect(card.locator(".v42-cycle-amount>.serif")).toHaveText((state.id==="over"?"-1":String(1000-state.spent))+" €");
  const color=await card.evaluate((el,tone)=>getComputedStyle(el).color===getComputedStyle(document.documentElement).getPropertyValue("--"+tone).trim() ||
    (()=>{const probe=document.createElement("span");probe.style.color="var(--"+tone+")";el.appendChild(probe);const result=getComputedStyle(probe).color===getComputedStyle(el).color;probe.remove();return result;})(),state.tone);
  expect(color).toBe(true);
  const painted=await card.evaluate(el=>{const pace=el.querySelector("[data-testid=inicio-cycle-pace] b");return {card:getComputedStyle(el).color,
    pace:pace?getComputedStyle(pace).color:null,ring:getComputedStyle(el.querySelector(".v42-cycle-draw")).stroke,
    font:getComputedStyle(el.querySelector(".v42-cycle-amount>.serif")).fontSize};});
  expect(painted.ring).toBe(painted.card);expect(painted.font).toBe("24px");
  if(painted.pace) expect(painted.pace).toBe(painted.card);
  await expect(card.getByTestId("inicio-cycle-pace")).toHaveCount(state.id==="over"?0:1);
  await expect(card.locator(".v4-budget-foot")).toHaveCount(0);
  await card.screenshot({animations:"disabled",path:testInfo.outputPath("cycle-"+state.id+"-synthetic.png")});
  await testInfo.attach("cycle-"+state.id+"-synthetic",{path:testInfo.outputPath("cycle-"+state.id+"-synthetic.png"),contentType:"image/png"});
});
// Feedback 2026-10-13: la tarjeta se quedó en importe + «al día», centrada contra el anillo (con
// una o dos líneas) y sin los rótulos de estado, que siguen en el aria-label.
for(const state of [{id:"tight",spent:800},{id:"over",spent:1001}]) test("tarjeta limpia y centrada con el anillo: "+state.id,async({page})=>{
  await open(page,state);
  const card=page.locator(".v42-cycle");
  await expect(card).not.toContainText(/Te quedan|Vas |Toca frenar|Te has pasado/);
  await expect(card.locator(".v42-cycle-amount>.serif")).toBeVisible(); await expect(card.locator(".v42-cycle-of")).toHaveText("de 1000 €");
  await expect(card.getByTestId("inicio-cycle-pace")).toHaveCount(state.id==="over"?0:1);
  await expect(card).toHaveAttribute("aria-label",state.id==="tight"?"Vas justito. Te quedan 200 € de 1000 €. 11 € al día durante 18 días":"Te has pasado 1 €. Te quedan -1 € de 1000 €");
  await page.waitForTimeout(1300); // el anillo se dibuja al entrar; con él quieto se mide el reposo
  const box=await card.evaluate(el=>{const c=n=>{const r=el.querySelector(n).getBoundingClientRect();return r.top+r.height/2;};
    return {ring:c(".v42-cycle-ring"),txt:c(".v4-budget-txt")};});
  expect(Math.abs(box.ring-box.txt)).toBeLessThanOrEqual(2);
});
for(const zone of ["UTC","Europe/Madrid"]) test.describe("calendario de Madrid en "+zone,()=>{
  test.use({timezoneId:zone});
  test("casi agotado dice justo y conserva el margen sin inventar ritmo",async({page})=>{
    await open(page,{cycle:false,day:26,spent:950});
    await expect(page.locator(".v42-cycle")).toHaveAttribute("data-state","tight");
    await expect(page.locator(".v42-cycle")).toHaveAttribute("aria-label",/^Vas justito\. Te quedan 50 € de 1000 €/);
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
    // Un día de datos no tiene ciclo anterior: frase neutra, sin «menos» ni «más» (13/10).
    await expect(hero.getByTestId("inicio-net-delta")).toHaveText("Aún sin datos para comparar");
    await expect(hero.getByTestId("inicio-net-delta")).toHaveAttribute("data-verdict","none");
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
  await open(page,{lang,falling:true,spent:2100});
  const hero=page.getByTestId("inicio-net-current"), ranges=hero.locator(".v42-net-ranges button");
  await expect(ranges).toHaveText({es:["1M","3M","6M","1A","Todo"],en:["1M","3M","6M","1Y","All"],ca:["1M","3M","6M","1A","Tot"]}[lang]);
  // La serie baja 1 €/día durante un año y el mes se gasta más que la nómina (2.000 cobrados,
  // 2.100 gastados): hoy frente al mismo día del mes pasado son 130 € menos, rojo de verdad
  // (margen 10 € sin inversión). Con veredicto, la línea y la frase van del mismo color; sin
  // datos para comparar, línea neutra y frase en gris.
  const same=()=>page.evaluate(()=>{const probe=document.createElement("span");document.body.appendChild(probe);const v=n=>{probe.style.color="var(--"+n+")";return getComputedStyle(probe).color;};
    const line=getComputedStyle(document.querySelector(".v42-net-chart svg")).color,text=getComputedStyle(document.querySelector(".v42-net-delta")).color,verdict=document.querySelector(".v42-net-delta").dataset.verdict;
    const ok=verdict==="none"?line===v("blue")&&text===v("muted"):line===text;probe.remove();return ok;});
  expect(await same()).toBe(true);
  await expect(hero.getByTestId("inicio-net-delta")).toHaveAttribute("data-verdict","down");
  await expect(hero.getByTestId("inicio-net-delta")).toHaveText({es:/^\d+ € menos que el mes pasado$/,en:/^\d+ € less than last month$/,ca:/^\d+ € menys que el mes passat$/}[lang]);
  const original=await hero.locator("svg").evaluate(el=>{window.__v42Original=el;return true;});expect(original).toBe(true);
  await hero.locator(".v42-net-info").click(); await expect(page.getByRole("dialog",{name:{es:"Cómo se calcula",en:"How it's worked out",ca:"Com es calcula"}[lang]})).toBeVisible();
  expect(await hero.locator("svg").evaluate(el=>el===window.__v42Original)).toBe(true);
  await page.mouse.click(10,60);await expect(page.locator('[data-sheet="net-info"]')).toHaveCount(0);
  await hero.locator(".v42-net-chart").evaluate(el=>{window.__v42Mounts=0;window.__v42Observer=new MutationObserver(rows=>{
    for(const row of rows)for(const node of row.addedNodes)if(node.nodeName.toLowerCase()==="svg")window.__v42Mounts++;
  });window.__v42Observer.observe(el,{childList:true});});
  for(let i=0;i<10;i++){
    const index=(i+1)%5;await ranges.nth(index).click();await expect(ranges.nth(index)).toHaveAttribute("aria-pressed","true");
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
  await expect(hero.locator(".v42-net-ranges button")).toHaveCount(5);
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
  // El rótulo «Te quedan» ya no se pinta, pero sigue en el idioma de la app para lectores de pantalla.
  await expect(page.locator(".v42-cycle")).not.toContainText(labels[1]);
  await expect(page.locator(".v42-cycle")).toHaveAttribute("aria-label",new RegExp(labels[1]+" 100 €"));
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
  const hero=page.getByTestId("inicio-net-current");
  // Bajo la gráfica no va texto fijo; la cuenta que empieza después se declara en la «i» y ya
  // no recorta la serie: arranca el 1/9 con el banco antiguo (13/10).
  await expect(hero.getByTestId("inicio-net-coverage")).toHaveCount(0);
  await hero.locator(".v42-net-info").click();
  // La cuenta que entra 24 días después no se nombra: solo cuenta la fecha más antigua.
  expect(await filas(page)).toEqual([["Cuentas","movimientos reales desde 1 sept"]]);
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

const goodsBank={id:"goods-bank",ent:"sabadell",value:5000,role:"fijos",bankIban:"ES-SYNTHETIC-GOODS"};
const goodsExpenses=[{id:"goods-cover",date:"2026-08-01T12:00:00Z",amount:0,category:"super",ent:"sabadell"},
  {id:"goods-use",date:"2026-08-20T12:00:00Z",amount:100,category:"super",ent:"sabadell"}];
async function openGoodsHistory(page,overrides){
  await page.clock.install({time:new Date("2026-09-04T12:00:00Z")});
  await seedLoggedInDashboard(page,{__seedOnce:true,budget:1000,accounts:[goodsBank],expenses:goodsExpenses,
    settings:{autoPrices:false,budgetCycle:false},...overrides});
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
}
// El rango por defecto es un mes (32 puntos): la cobertura entera, del 1/8 al 4/9, sólo se
// mide con «Todo». Devuelve las alturas para poder acreditar también la forma de la serie.
async function wholeGoodsLine(hero){
  const all=hero.locator(".v42-net-ranges button").last();
  await all.click();await expect(all).toHaveAttribute("aria-pressed","true");
  const path=await hero.locator(".v42-net-line").getAttribute("d");
  return [...path.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map(x=>Number(x[1]));
}
async function ownGoodsState(page){
  return page.evaluate(()=>{window.dispatchEvent(new Event("pagehide"));const s=mcLoadRaw(mcStateKey());return {assets:s.assets,history:s.assetValueHistory};});
}
for(const lang of ["es","en","ca"])test("RONDA3 bien legado conserva gráfica y declara su valor constante "+lang,async({page})=>{
  await openGoodsHistory(page,{assets:[{id:"legacy-home",name:"Piso sintético",value:200000}],settings:{lang,autoPrices:false,budgetCycle:false}});
  const hero=page.getByTestId("inicio-net-current");
  await expect(hero.locator(".v4-hero-amt")).toContainText("205.000,00 €");
  await expect(hero.locator(".v42-net-line")).toHaveCount(1);
  expect(await wholeGoodsLine(hero)).toHaveLength(35);
  // Nada de texto fijo bajo la gráfica; el detalle vive en la «i», en dos líneas (13/10).
  await expect(hero.getByTestId("inicio-net-coverage")).toHaveCount(0);
  await hero.locator(".v42-net-info").click();
  expect(await filas(page)).toEqual({
    es:[["Cuentas","movimientos reales desde "+fecha("2026-08-01","es")],["Bienes","valor conocido mantenido"]],
    en:[["Accounts","real transactions from "+fecha("2026-08-01","en")],["Property","known value kept"]],
    ca:[["Comptes","moviments reals des de "+fecha("2026-08-01","ca")],["Béns","valor conegut mantingut"]]}[lang]);
  const stored=await ownGoodsState(page);expect(stored.history?.["legacy-home"]).toBeUndefined();
});
test("RONDA3 piso que llega de la nube no nace al montar el móvil",async({page})=>{
  const incoming={budget:1000,accounts:[goodsBank],assets:[{id:"cloud-home",name:"Piso nube sintético",value:200000}],
    investments:[],debts:[],fixed:[],flows:[],oneoffs:[],expenses:goodsExpenses,goals:[],shared:[],settings:{autoPrices:false,budgetCycle:false},onboarded:true,
    // Sin sello gana el estado local (la app sella el suyo al arrancar) y la nube no se
    // aplica: el caso pasaba o caía sin haber recibido nunca el piso.
    _savedAt:Date.parse("2026-09-04T12:00:00Z")+600000};
  await openGoodsHistory(page,{assets:[],__cloudRows:{app_state:[{data:incoming,updated_at:"2026-09-04T12:10:00Z"}]}});
  const hero=page.getByTestId("inicio-net-current");
  await expect(hero.locator(".v4-hero-amt")).toContainText("205.000,00 €");
  const ys=await wholeGoodsLine(hero);expect(ys).toHaveLength(35);
  // Plana salvo el gasto de 100 del 20/8: dos alturas y ninguna subida de 200.000.
  expect(new Set(ys).size).toBe(2);expect(ys.every((y,i)=>!i||y>=ys[i-1])).toBe(true);
  // 35 días de serie: no hay dos ventanas de 45 con las que comparar; frase neutra, sin color.
  await expect(hero.getByTestId("inicio-net-delta")).toHaveText("Aún sin datos para comparar");
  await expect(hero.getByTestId("inicio-net-delta")).toHaveAttribute("data-verdict","none");
  const stored=await ownGoodsState(page);
  expect(stored.assets).toEqual([{id:"cloud-home",name:"Piso nube sintético",value:200000}]);
  expect(stored.history?.["cloud-home"]).toBeUndefined();
});
test("RONDA3 guardar el alta en Bienes acredita la fecha sin cambiar días anteriores",async({page})=>{
  await openGoodsHistory(page,{assets:[]});
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button",{name:"Añadir bien",exact:true}).click();
  const sheet=page.getByRole("dialog",{name:"Añadir bien",exact:true});
  await sheet.getByLabel("Nombre del bien").fill("Bien nuevo sintético");
  await sheet.getByLabel("Valor en euros").fill("15000");
  await sheet.getByRole("button",{name:"Guardar",exact:true}).click();
  const saved=await ownGoodsState(page);expect(saved.assets).toHaveLength(1);
  expect(saved.history[saved.assets[0].id]).toEqual([{day:"2026-09-04",value:15000,born:true}]);
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  const hero=page.getByTestId("inicio-net-current");await expect(hero.locator(".v4-hero-amt")).toContainText("20.000,00 €");
  await expect(hero.getByTestId("inicio-net-delta")).toHaveText("Aún sin datos para comparar");
  await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  expect((await ownGoodsState(page)).history[saved.assets[0].id]).toEqual(saved.history[saved.assets[0].id]);
});
test("revalorar un bien heredado conserva la gráfica y su valor anterior",async({page})=>{
  await openGoodsHistory(page,{assets:[{id:"legacy-car",name:"Coche sintético",kind:"coche",value:15000}]});
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.locator("button.v4-mov").filter({hasText:"Coche sintético"}).click();
  const sheet=page.getByRole("dialog",{name:"Editar bienes",exact:true});
  await sheet.getByLabel("Valor en euros").fill("12000");
  await sheet.getByRole("button",{name:"Guardar",exact:true}).click();
  expect((await ownGoodsState(page)).history["legacy-car"]).toEqual([{day:"2026-09-03",value:15000,legacy:true},{day:"2026-09-04",value:12000}]);
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  const hero=page.getByTestId("inicio-net-current");await expect(hero.locator(".v4-hero-amt")).toContainText("17.000,00 €");
  // Antes la serie se quedaba en un punto: sin línea, sin rangos y sin frase de comparación.
  const ys=await wholeGoodsLine(hero);expect(ys).toHaveLength(35);
  expect(new Set(ys).size).toBe(3);expect(ys.every((y,i)=>!i||y>=ys[i-1])).toBe(true);
  await expect(hero.getByTestId("inicio-net-delta")).toHaveText("Aún sin datos para comparar");
  await expect(hero.getByTestId("inicio-net-coverage")).toHaveCount(0);
  await hero.locator(".v42-net-info").click();
  expect(await filas(page)).toEqual([["Cuentas","movimientos reales desde 1 ago"],["Bienes","valor conocido mantenido"]]);
});
test("RONDA3 banco a hucha con escalones mantiene el patrimonio plano",async({page})=>{
  await openGoodsHistory(page,{accounts:[{...goodsBank,value:300},{id:"manual-hucha",ent:"revolut",value:600,role:"fijos"}],
    assets:[],expenses:[{...goodsExpenses[0],date:"2026-09-01T12:00:00Z"},
      {id:"step-out",date:"2026-09-02T12:00:00Z",amount:300,category:"traspaso",ent:"sabadell"},
      {id:"step-in",date:"2026-09-02T12:00:00Z",amount:-300,category:"traspaso",ent:"revolut"}],
    accountBalanceHistory:{"acc:manual-hucha":[{day:"2026-09-01",value:300},{day:"2026-09-02",value:600}]}});
  const hero=page.getByTestId("inicio-net-current");await expect(hero.locator(".v4-hero-amt")).toContainText("900,00 €");
  const path=await hero.locator(".v42-net-line").getAttribute("d"),ys=[...path.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map(x=>Number(x[1]));
  expect(ys).toHaveLength(4);expect(new Set(ys).size).toBe(1);
});
test("RONDA3 deuda sin día de cuota declara la convención mensual",async({page})=>{
  await openGoodsHistory(page,{assets:[],debts:[{id:"no-day",name:"Préstamo sintético",value:10000,monthly:500,amort:400,months:null,asOf:2026*12+7,asOfDate:"2026-08-01"}]});
  const hero=page.getByTestId("inicio-net-current");
  await expect(hero.locator(".v4-hero-amt")).toContainText("-4600,00 €");
  await expect(hero.locator(".v42-net-line")).toHaveCount(1);
  await expect(hero.getByTestId("inicio-net-coverage")).toHaveCount(0);
  await hero.locator(".v42-net-info").click();
  expect(await filas(page)).toEqual([["Cuentas","movimientos reales desde 1 ago"],["Deudas","según sus cuotas"]]);
});

// Incidente 13/10 (beta 4.26.121): con hipoteca y préstamo dados de alta antes, Inicio salía sin
// gráfica y con un muro de seis líneas. El mismo estado que el caso Node (fixtures.estadoHeredado).
for(const lang of ["es","en","ca"])test("cartera heredada ve la gráfica el primer día y el detalle en la i "+lang,async({page})=>{
  await page.clock.install({time:new Date("2026-10-13T12:00:00Z")});
  const state=estadoHeredado("2026-10-13");
  await seedLoggedInDashboard(page,{__seedOnce:true,...state,settings:{...state.settings,lang}});
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  const hero=page.getByTestId("inicio-net-current");
  await expect(hero.locator(".v4-hero-amt")).toContainText(",");
  await expect(hero.locator(".v42-net-line")).toHaveCount(1);
  // El rango por defecto es 1M (32 puntos); con «Todo» la serie entera desde el 15/6 (121 días).
  const all=hero.locator(".v42-net-ranges button").last();await all.click();
  const path=await hero.locator(".v42-net-line").getAttribute("d");expect([...path.matchAll(/[ML]/g)]).toHaveLength(121);
  await expect(hero.locator(".v42-net-ranges button")).toHaveText({es:["1M","3M","Todo"],en:["1M","3M","All"],ca:["1M","3M","Tot"]}[lang]);
  await expect(hero).not.toContainText({es:"Todavía no hay gráfica",en:"No chart yet",ca:"Encara no hi ha gràfica"}[lang]);
  await expect(hero).not.toContainText("Faltan saldos");
  // Nada de texto fijo bajo los periodos (13/10: «el mensaje de abajo me sobra»).
  await expect(hero.getByTestId("inicio-net-coverage")).toHaveCount(0);
  await expect(hero.locator(".hint")).toHaveCount(0);
  // Entre la cifra y la gráfica no hay ninguna nota.
  expect(await hero.evaluate(el=>{const amt=el.querySelector(".v4-hero-amt"),chart=el.querySelector(".v42-net-chart");let n=amt.nextElementSibling,hints=0;while(n&&n!==chart){if(n.classList.contains("hint"))hints++;n=n.nextElementSibling;}return hints;})).toBe(0);
  await expect(page.locator('[data-sheet="net-info"]')).toHaveCount(0);
  await hero.locator(".v42-net-info").click();
  // Tres filas y ya, por tipo, sin nombrar cuenta a cuenta (13/10: «el textaco… enorme»).
  expect(await filas(page)).toEqual({
    es:[["Cuentas","movimientos reales desde "+fecha("2026-06-15","es")],["Inversiones, bienes y cuentas manuales","valor conocido mantenido"],["Deudas","según sus cuotas; las cuotas sin tipo de interés se cuentan enteras como capital"],["Comparación","desde el principio"]],
    en:[["Accounts","real transactions from "+fecha("2026-06-15","en")],["Investments, property and manual accounts","known value kept"],["Debts","by their payment schedule; payments with no interest rate count in full as capital"],["Comparison","since the start"]],
    ca:[["Comptes","moviments reals des de "+fecha("2026-06-15","ca")],["Inversions, béns i comptes manuals","valor conegut mantingut"],["Deutes","segons les seves quotes; les quotes sense tipus d\'interès es compten senceres com a capital"],["Comparació","des del principi"]]}[lang]);
  await page.mouse.click(10,60);await expect(page.locator('[data-sheet="net-info"]')).toHaveCount(0);
});
