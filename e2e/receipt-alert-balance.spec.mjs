import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,installFixtureClock,dismissNews} from "./fixtures.mjs";

test.use({timezoneId:"Europe/Madrid"});

async function setup(page,{balance=100,prior=0,missing=false,fired=[]}={}){
  await installFixtureClock(page);
  const fixed=[{id:"target",name:"Recibo sintético",amount:89.54,freq:"mes",day:28,account:"sabadell"}];
  if(prior) fixed.push({id:"prior",name:"Cargo anterior",amount:prior,freq:"mes",day:27,account:"sabadell"});
  fixed.push({id:"later",name:"Cargo posterior",amount:500,freq:"mes",day:29,account:"sabadell"});
  await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:"sb",ent:"sabadell",role:"fijos",value:balance},
    {id:"rv",ent:"revolut",role:"fijos",value:9000}],fixed:missing?fixed.map(x=>({...x,account:undefined})):fixed,
    debts:[{id:"loan",name:"Cuota BOOK",monthly:60,value:1000,account:"sabadell",day:27,asOf:2026*12+8}],
    expenses:[{id:"book",merchant:"Cuota sintética",amount:60,date:"2026-09-26",ent:"sabadell",debtId:"loan",category:"deudas",source:"ob"}],
    bankTx:[{id:"book",merchant:"Cuota sintética",amount:60,date:"2026-09-26",ent:"sabadell",status:"BOOK"}],
    flows:[],oneoffs:[],settings:{budgetNotis:false,budgetCycle:false,expenseBanks:["revolut"]}});
  await page.addInitScript(({fired})=>{
    window.__receiptNotis=[];
    window.__receiptCalendars=0;
    window.Capacitor={isNativePlatform:()=>false,Plugins:{MiCartera:new Proxy({
      showNotification:async msg=>window.__receiptNotis.push(msg),
      setAlertData:async()=>{window.__receiptCalendars++;return {fired};},addListener:async()=>({remove(){}}),
    },{get:(obj,key)=>obj[key]||(()=>Promise.resolve({}))})}};
  },{fired});
  await page.goto("/");
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
}

for(const [label,args,phrase] of [
  ["alcanza",{},"En Sabadell alcanza para pagarlo; quedarían 10,46 €."],
  ["falta contando el cargo anterior",{prior:20.47},"En Sabadell faltarían 10,01 € para pagarlo."],
  ["banco desconocido conserva el original",{missing:true},"Recibo sintético: 89,54 € el día 28"],
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
