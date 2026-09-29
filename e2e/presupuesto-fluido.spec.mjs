/* EDITAR PRESUPUESTO MENSUAL (feedback 18/9, punto 8).
 *
 * La prueba entra por la tarjeta real de Inicio: el editor debe usar una cifra más contenida y
 * conservarse montado mientras sale. Guardar sigue cambiando solo `budget`; movimiento reducido
 * no obliga a esperar una animación que el usuario ha pedido quitar. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ viewport:{width:375,height:812}, hasTouch:true });

for(const caso of [
  {lang:"es", ahead:"Has gastado 300 € de tus 1000 €.", month:"del mes", start:"Aquí empieza el mes"},
  {lang:"en", ahead:"You've spent 300 € of your 1000 €.", month:"of month", start:"Your month starts here"},
  {lang:"ca", ahead:"Has gastat 300 € dels teus 1000 €.", month:"del mes", start:"Aquí comença el mes"},
]) test(`Inicio conserva la frase de gasto con ingresos mayores (${caso.lang})`,async({page})=>{
  await page.clock.install({time:new Date("2026-09-15T12:00:00Z")});
  await seedLoggedInDashboard(page,{
    budget:1000,
    settings:{autoPrices:false,theme:"green",lang:caso.lang,gTotalMode:"net"},
    accounts:[{id:"tr",ent:"trade_republic",name:"Efectivo",value:1000,role:"diario",spendFrom:true}],
    expenses:[
      {id:"g",date:"2026-09-14T12:00:00Z",amount:300,merchant:"Compra",category:"super",ent:"trade_republic"},
      {id:"i",date:"2026-09-14T12:00:00Z",amount:-1000,merchant:"Ingreso",category:"ingreso",ent:"trade_republic"},
    ],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  const dash=page.locator(".v4-budget");
  await expect(dash.locator(".v4-ring")).toContainText(caso.month);
  await expect(dash.locator(".v4-budget-txt .ph")).toContainText(caso.ahead);
  await expect(dash).toContainText(/300/);
  await expect(dash.locator(".v4-budget-txt .ph")).toContainText(/Puedes gastar|You can spend|Pots gastar/);
  await expect(dash).not.toContainText(caso.start);
  await expect(page.locator("[data-testid='dash-budget-streak']")).toHaveText({es:"Mes en curso",en:"Month in progress",ca:"Mes en curs"}[caso.lang]);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const gastos=page.locator(".v4-gastos-summary");
  await expect(gastos).toContainText(/700/);
  await expect(gastos).toContainText(/300/);
});

for(const caso of [
  {lang:"es",cycle:"del ciclo",net:"Gasto neto desde el cobro: 980,00 € de tus 1000,00 €.",left:"Te quedan 20,00 €.",period:"Mi ciclo"},
  {lang:"en",cycle:"of cycle",net:"Net spending since payday: 980,00 € of your 1000,00 €.",left:"20,00 € left.",period:"My cycle"},
  {lang:"ca",cycle:"del cicle",net:"Despesa neta des del cobrament: 980,00 € dels teus 1000,00 €.",left:"Et queden 20,00 €.",period:"El meu cicle"},
]) test(`Inicio y Gastos dan el mismo neto y margen en Mi ciclo (${caso.lang})`,async({page})=>{
  await page.clock.install({time:new Date("2026-09-28T12:00:00Z")});
  await seedLoggedInDashboard(page,{
    budget:1000,
    settings:{autoPrices:false,theme:"green",lang:caso.lang,gTotalMode:"split",budgetCycle:true,expenseBanks:["sabadell"]},
    accounts:[{id:"sb",ent:"sabadell",name:"Diaria",value:1000,role:"diario",spendFrom:true}],
    expenses:[
      {id:"antes",date:"2026-09-20T12:00:00Z",amount:200,merchant:"Compra anterior",category:"super",ent:"sabadell"},
      {id:"nomina",date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso",ent:"sabadell"},
      {id:"gasto",date:"2026-09-27T12:00:00Z",amount:1450,merchant:"Compra",category:"super",ent:"sabadell"},
      {id:"ingreso",date:"2026-09-27T14:00:00Z",amount:-470,merchant:"Ingreso recibido",category:"ingreso",ent:"revolut"},
    ],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  const dash=page.locator(".v4-budget");
  await expect(dash.locator(".v4-ring")).toContainText("98%");
  await expect(dash.locator(".v4-ring")).toContainText(caso.cycle);
  await expect(dash.locator(".v4-budget-txt .ph")).toHaveText(caso.net+" "+caso.left);
  await expect(page.locator(".v4-budget-foot")).toContainText(caso.period);
  await expect(dash.locator(".v4-budget-txt .ph")).not.toContainText("1450,00");
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-period-btn.on")).toHaveText(caso.period);
  const gastos=page.locator(".v4-gastos-summary");
  await expect(gastos.locator(".v4-gastos-summary-amount")).toContainText("980,00");
  await expect(gastos.locator(".v4-gastos-summary-sub")).toContainText("1450,00");
  await expect(gastos.locator(".v4-gastos-summary-sub")).toContainText("470,00");
  await expect(gastos.locator(".v4-gastos-summary-left")).toContainText("20,00");
  await expect(gastos.locator(".v4-gastos-progress")).toHaveAttribute("aria-valuenow","980");
});

for(const caso of [
  {income:780,net:"-680,00 €",left:"Te quedan 1680,00 €.",pct:"0%",remaining:"1680,00",progress:"0"},
  {income:50,net:"1150,00 €",left:"Te faltan 150,00 €.",pct:"100%",remaining:"-150,00",progress:"1150"},
]) test(`Mi ciclo explica el margen con ingreso ${caso.income}`,async({page})=>{
  await page.clock.install({time:new Date("2026-09-28T12:00:00Z")});
  await seedLoggedInDashboard(page,{
    budget:1000,settings:{autoPrices:false,theme:"green",lang:"es",budgetCycle:true},
    accounts:[{id:"sb",ent:"sabadell",name:"Diaria",value:1000,role:"diario",spendFrom:true}],
    expenses:[
      {id:"nomina",date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso",ent:"sabadell"},
      {id:"gasto",date:"2026-09-27T12:00:00Z",amount:caso.income===780?100:1200,merchant:"Compra",category:"super",ent:"sabadell"},
      {id:"ingreso",date:"2026-09-27T14:00:00Z",amount:-caso.income,merchant:"Ingreso recibido",category:"ingreso",ent:"revolut"},
    ],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  const dash=page.locator(".v4-budget");
  await expect(dash.locator(".v4-ring")).toContainText(caso.pct);
  await expect(dash.locator(".v4-budget-txt .ph")).toContainText(caso.net);
  await expect(dash.locator(".v4-budget-txt .ph")).toContainText(caso.left);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const gastos=page.locator(".v4-gastos-summary");
  await expect(gastos.locator(".v4-gastos-summary-left")).toContainText(caso.remaining);
  await expect(gastos.locator(".v4-gastos-progress")).toHaveAttribute("aria-valuenow",caso.progress);
});

test("Inicio conserva la frase de gasto también con balance desfavorable",async({page})=>{
  await page.clock.install({time:new Date("2026-09-15T12:00:00Z")});
  await seedLoggedInDashboard(page,{
    budget:1000,settings:{autoPrices:false,theme:"green",lang:"es",gTotalMode:"net"},
    accounts:[{id:"tr",ent:"trade_republic",name:"Efectivo",value:1000,role:"diario",spendFrom:true}],
    expenses:[
      {id:"g",date:"2026-09-14T12:00:00Z",amount:300,merchant:"Compra",category:"super",ent:"trade_republic"},
      {id:"i",date:"2026-09-14T12:00:00Z",amount:-100,merchant:"Ingreso",category:"ingreso",ent:"trade_republic"},
    ],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  const dash=page.locator(".v4-budget");
  await expect(dash.locator(".v4-ring")).toContainText("del mes");
  await expect(dash.locator(".v4-budget-txt .ph")).toContainText("Has gastado 300");
  await expect(dash.locator(".v4-budget-txt .ph")).not.toContainText(/[−-]\s*300/);
  await expect(dash.locator(".v4-budget-txt .ph")).not.toContainText("Balance en contra");
  await expect(dash.locator(".v4-budget-txt .ph")).toContainText("Puedes gastar");
  await expect(dash.locator(".v4-budget-txt .st")).toContainText("Vas muy bien");
});

test("el cobro del 26 reinicia el presupuesto opcional y Mi ciclo abre por defecto",async({page})=>{
  await page.clock.install({time:new Date("2026-09-25T12:00:00Z")});
  await seedLoggedInDashboard(page,{
    __seedOnce:true,budget:1000,
    settings:{autoPrices:false,theme:"green",lang:"es",gTotalMode:"net",budgetCycle:true},
    expenses:[
      {id:"agosto",date:"2026-08-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso"},
      {id:"previos",date:"2026-09-20T12:00:00Z",amount:600,merchant:"Compras",category:"super"},
      {id:"septiembre",date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso"},
      {id:"traspaso",date:"2026-09-27T12:00:00Z",amount:-500,merchant:"Movimiento",category:"traspaso"},
      {id:"bizum",date:"2026-09-27T14:00:00Z",amount:-250,merchant:"Bizum recibido",category:"ingreso"},
    ],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  const ajustesIniciales=page.locator(".settings-push.open").filter({has:page.getByRole("heading",{name:/Ajustes/i})});
  if(await ajustesIniciales.count()) await ajustesIniciales.locator(".settings-push-h .back").click();
  await expect(page.locator(".v4-budget")).toContainText(/600/);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-period-btn.on")).toHaveText("Mi ciclo");
  await expect(page.locator(".v4-cycle-box")).toContainText(/26\/0?8/);
  await expect(page.locator(".v4-gastos-summary")).toContainText(/600/);
  await page.clock.pauseAt(new Date("2026-09-26T08:00:00Z"));
  await page.clock.resume();
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-period-btn.on")).toHaveText("Mi ciclo");
  await expect(page.locator(".v4-cycle-box")).toContainText(/26\/0?9/);
  await expect(page.locator(".v4-gastos-summary")).toContainText(/1\.?000/);
  await expect(page.locator(".v4-gastos-summary")).not.toContainText(/600/);
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await expect(page.locator(".v4-budget")).toContainText("Aquí empieza tu ciclo");
  await page.clock.pauseAt(new Date("2026-09-28T10:00:00Z"));
  await page.clock.resume();
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-cycle-box")).toContainText(/26\/0?9/);
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await page.locator(".v4-avatar").click();
  await page.getByRole("button",{name:/Ir a Ajustes/i}).click();
  const ajustes=page.locator(".settings-push.open");
  await ajustes.getByRole("button",{name:/Dinero/}).first().click();
  await ajustes.getByRole("button",{name:/Presupuesto por ciclo de cobro/}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")||"{}").settings?.budgetCycle)).toBe(false);
});

test("Mi ciclo muestra la cena neta de los Bizums recibidos aunque el modo mensual sea Gastos",async({page})=>{
  await page.clock.install({time:new Date("2026-09-28T12:00:00Z")});
  await seedLoggedInDashboard(page,{
    budget:1000,settings:{autoPrices:false,theme:"green",lang:"es",gTotalMode:"split",budgetCycle:true,expenseBanks:["sabadell"]},
    accounts:[{id:"sb",ent:"sabadell",name:"Diaria",value:1000,role:"diario",spendFrom:true}],
    expenses:[
      {id:"nomina",date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso",ent:"sabadell"},
      {id:"cena",date:"2026-09-27T12:00:00Z",amount:100,merchant:"Cena",category:"restaurantes",ent:"sabadell"},
      {id:"amigos",date:"2026-09-27T14:00:00Z",amount:-80,merchant:"Bizum recibido",category:"ingreso",ent:"revolut"},
    ],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  const ajustes=page.locator(".settings-push.open").filter({has:page.getByRole("heading",{name:/Ajustes/i})});
  if(await ajustes.count()) await ajustes.locator(".settings-push-h .back").click();
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-period-btn.on")).toHaveText("Mi ciclo");
  const summary=page.locator(".v4-gastos-summary");
  await expect(summary.locator(".v4-gastos-summary-label")).toHaveText("Balance desde el cobro");
  await expect(summary.locator(".v4-gastos-summary-amount")).toContainText("20");
  await expect(summary.locator(".v4-gastos-summary-sub")).toContainText("Gastos");
  await expect(summary.locator(".v4-gastos-summary-sub")).toContainText("100");
  await expect(summary.locator(".v4-gastos-summary-sub")).toContainText("Ingresos");
  await expect(summary.locator(".v4-gastos-summary-sub")).toContainText("80");
  await expect(summary.locator(".v4-gastos-summary-left")).toContainText("980");
  await expect(summary.locator(".v4-gastos-progress")).toHaveAttribute("aria-valuenow","20");
});

test("Mi ciclo incluye el alquiler recibido y puede dejar más margen que el límite inicial",async({page})=>{
  await page.clock.install({time:new Date("2026-09-28T12:00:00Z")});
  await seedLoggedInDashboard(page,{
    budget:1000,settings:{autoPrices:false,theme:"green",lang:"es",gTotalMode:"split",budgetCycle:true,expenseBanks:["sabadell"]},
    accounts:[{id:"sb",ent:"sabadell",name:"Diaria",value:1000,role:"diario",spendFrom:true}],
    expenses:[
      {id:"nomina",date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso",ent:"sabadell"},
      {id:"cena",date:"2026-09-27T12:00:00Z",amount:100,merchant:"Cena",category:"restaurantes",ent:"sabadell"},
      {id:"amigos",date:"2026-09-27T14:00:00Z",amount:-80,merchant:"Bizum recibido",category:"ingreso",ent:"revolut"},
      {id:"alquiler",date:"2026-09-27T15:00:00Z",amount:-700,merchant:"Alquiler cobrado",category:"ingreso",ent:"revolut"},
    ],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  const ajustes=page.locator(".settings-push.open").filter({has:page.getByRole("heading",{name:/Ajustes/i})});
  if(await ajustes.count()) await ajustes.locator(".settings-push-h .back").click();
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const summary=page.locator(".v4-gastos-summary");
  await expect(page.locator(".v4-period-btn.on")).toHaveText("Mi ciclo");
  await expect(summary.locator(".v4-gastos-summary-amount")).toContainText("680");
  await expect(summary.locator(".v4-gastos-summary-sub")).toContainText("780");
  await expect(summary.locator(".v4-gastos-summary-left")).toContainText("1680");
  await expect(summary.locator(".v4-gastos-progress")).toHaveAttribute("aria-valuenow","0");
});

test("sin activar el ciclo Gastos abre en Este mes",async({page})=>{
  await page.clock.install({time:new Date("2026-09-26T12:00:00Z")});
  await seedLoggedInDashboard(page,{settings:{autoPrices:false,theme:"green",lang:"es",budgetCycle:false}});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-period-btn.on")).toHaveText("Este mes");
});

async function abrir(page, reduced){
  if(reduced) await page.emulateMedia({ reducedMotion:"reduce" });
  await seedLoggedInDashboard(page,{__seedOnce:true,budget:500,expenses:[],accounts:[]});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(() => !document.getElementById("mc-load"),null,{timeout:30_000});
  await dismissNews(page);
  const ajustes=page.locator(".settings-push.open").filter({has:page.getByRole("heading",{name:/Ajustes|Settings|Ajustos/i})});
  if(await ajustes.count()) await ajustes.locator(".settings-push-h .back").click();
  await page.locator(".v4-budget").click();
  const sheet=page.locator(".v4-budget-sheet");
  await expect(sheet).toBeVisible();
  return sheet;
}

test("el presupuesto entra más pausado, con cifra compacta, y sale antes de desmontarse",async({page})=>{
  const sheet=await abrir(page,false);
  const medidas=await sheet.evaluate(function(el){
    const amount=el.querySelector(".v4-ob-stepper .serif");
    return {anim:parseFloat(getComputedStyle(el).animationDuration)*1000,font:parseFloat(getComputedStyle(amount).fontSize)};
  });
  expect(medidas.anim).toBeGreaterThanOrEqual(400);
  expect(medidas.font).toBeLessThanOrEqual(42);
  await page.waitForTimeout(450);
  await sheet.getByRole("button",{name:"+",exact:true}).click();
  await sheet.locator(".v4-cta").click();
  await expect(sheet).toHaveCount(1);
  await expect(sheet).toHaveCSS("transform",/matrix|translate3d/);
  await page.waitForTimeout(120);
  await expect(sheet).toHaveCount(1);
  await expect(sheet).toHaveCount(0,{timeout:1_000});
  await expect.poll(async()=>page.evaluate(function(){
    const key=localStorage.getItem("_mcSandbox")==="1"?"micartera_sandbox":"micartera_v3";
    return JSON.parse(localStorage.getItem(key)).budget;
  })).toBe(550);
});

test("movimiento reducido cierra sin espera",async({page})=>{
  const sheet=await abrir(page,true);
  await sheet.locator(".v4-cta").click();
  await expect(sheet).toHaveCount(0);
});

test("las demás hojas liberan el fondo al empezar a cerrarse",async({page})=>{
  await seedLoggedInDashboard(page,{__seedOnce:true,expenses:[],accounts:[]});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(() => !document.getElementById("mc-load"),null,{timeout:30_000});
  await dismissNews(page);
  const ajustes=page.locator(".settings-push.open").filter({has:page.getByRole("heading",{name:/Ajustes|Settings|Ajustos/i})});
  if(await ajustes.count()) await ajustes.locator(".settings-push-h .back").click();

  await page.locator(".botnav-fab").click();
  const sheet=page.locator(".v4-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(450);
  await expect.poll(()=>page.evaluate(()=>({overflow:document.body.style.overflow,locked:document.documentElement.classList.contains("sheet-open")})))
    .toEqual({overflow:"hidden",locked:true});

  const box=await sheet.boundingBox();
  const cdp=await page.context().newCDPSession(page);
  const x=Math.round(box.x+box.width/2), y=Math.round(box.y+24);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:x,y:y}]});
  for(let i=1;i<=7;i++) await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x,y:y+i*42}]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});

  // Durante la animación el nodo sigue montado, pero el fondo ya no conserva el candado.
  await expect(sheet).toHaveCount(1);
  expect(await page.evaluate(()=>({overflow:document.body.style.overflow,locked:document.documentElement.classList.contains("sheet-open")})))
    .toEqual({overflow:"",locked:false});
  await expect(sheet).toHaveCount(0,{timeout:1_000});
});
