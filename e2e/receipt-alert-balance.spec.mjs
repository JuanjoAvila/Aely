import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,installFixtureClock,dismissNews} from "./fixtures.mjs";

test.use({timezoneId:"Europe/Madrid"});

async function setup(page,{balance=100,prior=0,missing=false,fired=[],tomorrow=false,debt=false,salary=false,early=false,sandbox=false}={}){
  await installFixtureClock(page);
  const fixed=debt?[]:[{id:"target",name:early?"Iberdrola luz":"Recibo sintético",amount:89.54,freq:"mes",day:tomorrow?27:28,account:"sabadell"}];
  if(prior) fixed.push({id:"prior",name:"Cargo anterior",amount:prior,freq:"mes",day:27,account:"sabadell"});
  fixed.push({id:"later",name:"Cargo posterior",amount:500,freq:"mes",day:29,account:"sabadell"});
  await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:"sb",ent:"sabadell",role:"fijos",value:balance},
    {id:"rv",ent:"revolut",role:"fijos",value:9000}],fixed:missing?fixed.map(x=>({...x,account:undefined})):fixed,
    debts:[{id:"loan",name:debt?"Cuota sintética":"Cuota BOOK",monthly:60,value:1000,account:debt&&missing?undefined:"sabadell",day:27,asOf:2026*12+8}],
    expenses:debt?[]:[{id:"book",merchant:"Cuota sintética",amount:60,date:"2026-09-26",ent:"sabadell",debtId:"loan",category:"deudas",source:"ob"}],
    bankTx:early?[{id:"early",merchant:"IBERDROLA LUZ",amount:89.54,date:"2026-09-25",ent:"sabadell",status:"BOOK"}]:debt?[]:[{id:"book",merchant:"Cuota sintética",amount:60,date:"2026-09-26",ent:"sabadell",status:"BOOK"}],
    flows:salary?[{id:"salary",kind:"income",amount:100,day:28,to:"sabadell"}]:[],oneoffs:[],settings:{budgetNotis:false,budgetCycle:false,expenseBanks:["revolut"]}});
  await page.addInitScript(({fired,sandbox})=>{
    if(sandbox){
      localStorage.setItem("micartera_sandbox",localStorage.getItem("micartera_v3"));
      localStorage.setItem("micartera_sandbox_exp",localStorage.getItem("micartera_v3_exp")||"[]");
      localStorage.setItem("_mcSandbox","1");
    }
    window.__receiptNotis=[];
    window.__receiptCalendars=0;
    window.Capacitor={isNativePlatform:()=>false,Plugins:{MiCartera:new Proxy({
      showNotification:async msg=>window.__receiptNotis.push(msg),
      setAlertData:async()=>{window.__receiptCalendars++;return {fired};},addListener:async()=>({remove(){}}),
    },{get:(obj,key)=>obj[key]||(()=>Promise.resolve({}))})}};
  },{fired,sandbox});
  await page.goto("/");
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
}

for(const [label,args,phrase] of [
  ["alcanza",{},"En Sabadell alcanzaría para pagarlo; quedarían 10,46 €."],
  ["falta contando el cargo anterior",{prior:20.47},"En Sabadell faltarían 10,01 € para pagarlo."],
  ["banco desconocido conserva el original",{missing:true},"Recibo sintético: 89,54 € el día 28."],
  ["nómina simultánea",{balance:20,salary:true},"En Sabadell faltarían 69,54 € para pagarlo."],
]){
  test("recordatorio: "+label,async({page})=>{
    await setup(page,args);
    const target=()=>page.evaluate(()=>window.__receiptNotis.filter(n=>n.body.startsWith("Recibo sintético:")));
    await expect.poll(async()=> (await target()).length).toBe(1);
    const notices=await target();expect(notices[0].body).toContain(phrase);
    if(args.missing) expect(notices[0].body).toBe(phrase);
    expect(await page.evaluate(()=>window.__receiptNotis.some(n=>n.body.startsWith("Cuota BOOK:")))).toBe(false);
    // Recargar vuelve a ejecutar el efecto, pero no debe repetir el aviso ya sellado.
    await page.reload();
    await expect(page.locator('.botnav-tab[data-tour="plan"]')).toBeVisible();
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await expect.poll(()=>page.evaluate(()=>window.__receiptCalendars)).toBeGreaterThanOrEqual(2);
    await expect.poll(()=>page.evaluate(()=>localStorage.getItem("_rc_target_2026-09_28"))).toBe("1");
    expect(await target()).toHaveLength(0);
  });
}

test("recordatorio: el nativo ya avisó la víspera",async({page})=>{
  await setup(page,{fired:["prior"],prior:20.47});
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("_rc1_prior_2026-09"))).toBe("1");
  expect(await page.evaluate(()=>window.__receiptNotis.some(n=>n.body.startsWith("Cargo anterior:")))).toBe(false);
});

for(const args of [{tomorrow:true},{tomorrow:true,missing:true},{debt:true},{debt:true,missing:true},{early:true,balance:10.46}]){
  test("recordatorio específico "+JSON.stringify(args),async({page})=>{
    await setup(page,args);
    const name=args.debt?"Cuota sintética":args.early?"Iberdrola luz":"Recibo sintético";
    await expect.poll(()=>page.evaluate(name=>window.__receiptNotis.filter(n=>n.body.startsWith(name+":")),name)).toHaveLength(1);
    const body=await page.evaluate(name=>window.__receiptNotis.find(n=>n.body.startsWith(name+":")).body,name);
    if(args.early) expect(body).toBe("Iberdrola luz: 89,54 € el día 28.");
    else if(args.missing) expect(body).toBe(name+": mañana se cobran "+(args.debt?"60,00":"89,54")+" €. Si algo no cuadra, aún estás a tiempo.");
    else expect(body).toContain("quedarían "+(args.debt?"40,00":"10,46")+" €.");
  });
}
test("modo pruebas no envía recibos ni calendario al puente",async({page})=>{
  await setup(page,{sandbox:true});
  await expect(page.locator(".sandbox-bar")).toBeVisible();
  expect(await page.evaluate(()=>window.__receiptNotis)).toHaveLength(0);
  expect(await page.evaluate(()=>window.__receiptCalendars)).toBe(0);
});
