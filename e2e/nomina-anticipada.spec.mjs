import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const zone=process.env.MC_NOMINA_TZ||"Europe/Madrid";
test.use({timezoneId:zone});
const salary={ext_id:"salary",date:"2026-09-30",amount:-1800,merchant:"NOMINA EMPRESA SL",status:"BOOK"};
const links=(tx,balance)=>[{aspsp:"Sabadell",ok:true,accounts:[{uid:"synthetic",ok:true,
  balances:[{type:"ITAV",amount:balance,currency:"EUR"}],transactions:[tx]}]}];
async function open(page,lang,time="2026-09-30T12:00:00Z"){
  await page.clock.install({time:new Date(time)});
  await seedLoggedInDashboard(page,{__seedOnce:true,budget:500,hasBankLink:true,
    accounts:[{id:"sb",ent:"sabadell",name:"Cuenta ficticia",role:"diario",spendFrom:true,value:400}],
    expenses:[],fixed:[],debts:[],oneoffs:[],flows:[],bankTx:[],
    settings:{autoPrices:false,theme:"green",lang,budgetCycle:true,gTotalMode:"net",expenseBanks:["sabadell"]}});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.evaluate(()=>{
    window.__salarySyncs=0;
    window.addEventListener("mc-bank-links-changed",()=>window.__salarySyncs++);
  });
}
async function sync(page,tx,balance){
  const before=await page.evaluate(()=>window.__salarySyncs);
  await page.evaluate(feed=>{
    cloud.bankSync=()=>Promise.resolve({ok:true,links:feed});
    window.dispatchEvent(new CustomEvent("mc-bank-role-changed"));
  },links(tx,balance));
  await expect.poll(()=>page.evaluate(()=>window.__salarySyncs)).toBe(before+1);
}
async function check(page,count,balance,cycle,remaining=500){
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await expect(page.locator('.v4-budget .v4-ring')).toContainText('%');
  // El reparto diario ya no delata el ciclo: también sale en el mes natural mientras quede
  // dinero. Lo que distingue un cobro reconocido es el rótulo de la tarjeta.
  await expect(page.locator('.v42-cycle-head>span')).toHaveText(cycle?/^(Este ciclo|This cycle|Aquest cicle)$/:/^(Este mes|This month|Aquest mes)$/);
  // Inicio73 conserva gasto bruto en el mes; Gastos mantiene el balance neto elegido.
  await expect(page.locator('.v4-budget-txt .ph')).toContainText(cycle?String(remaining):"500");
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:"NOMINA EMPRESA SL"})).toHaveCount(count);
  await expect(page.locator('.v4-gastos-summary-left')).toContainText(String(remaining));
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const account=page.locator('.v4-card-list button.v4-mov').filter({hasText:"Cuenta ficticia"});
  await expect(account).toHaveCount(1);
  await expect(account).toContainText(balance===400?"400,00":"2200,00");
}
for(const lang of ["es","en","ca"]){
  test(lang+": pendiente, futuro y estado desconocido no crean ingreso ni ciclo",async({page})=>{
    await open(page,lang);
    for(const patch of [{status:"PDNG"},{date:"2026-10-01"},{status:"UNKNOWN"}]){
      await sync(page,{...salary,...patch},400);
      await check(page,0,400,false);
    }
  });
  test(lang+": PDNG pasa a BOOK una vez y el siguiente sync mantiene saldo y UUID",async({page})=>{
    await open(page,lang);
    await sync(page,{...salary,status:"PDNG"},400);
    await check(page,0,400,false);
    await sync(page,salary,2200);
    await check(page,1,2200,true);
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").length)).toBe(1);
    const id=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp"))[0].id);
    await sync(page,salary,2200);
    await check(page,1,2200,true);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp"))[0].id)).toBe(id);
    await page.reload();
    await dismissNews(page);
    await check(page,1,2200,true);
  });
  test(lang+": BOOK futuro rechazado entra al llegar su día en la frontera mensual",async({page})=>{
    await open(page,lang,"2026-09-30T21:59:00Z");
    const october={...salary,date:"2026-10-01"};
    await sync(page,october,400);
    await check(page,0,400,false);
    await page.clock.setSystemTime(new Date("2026-09-30T22:01:00Z"));
    await sync(page,october,2200);
    // El importador ya usa Madrid; el ciclo aún usa día local. Se caracteriza esa frontera
    // preexistente sin presentarla como coherencia de calendario corregida por esta tanda.
    await check(page,1,2200,zone==="Europe/Madrid",zone==="Europe/Madrid"?500:2300);
    await sync(page,{...salary,date:"2026-10-02"},2200);
    await check(page,1,2200,zone==="Europe/Madrid",zone==="Europe/Madrid"?500:2300);
    await page.clock.setSystemTime(new Date("2026-10-01T00:01:00Z"));
    await sync(page,october,2200);
    await check(page,1,2200,true);
  });
}

for(const decision of ["mismo","distintos","ambiguo"]){
  test("UX2909 manual: BOOK con nombre pide revision " + decision,async({page})=>{
    await page.clock.install({time:new Date("2026-10-17T12:00:00Z")});
    const manual={id:"manual-salary",source:"manual",ent:"sabadell",date:"2026-10-16T12:00:00Z",amount:-1800,merchant:"Nomina manual",category:"ingreso"};
    await seedLoggedInDashboard(page,{__seedOnce:true,__seenVersion:"4.26.137",hasBankLink:true,budget:500,
      accounts:[{id:"sb",ent:"sabadell",name:"Cuenta ficticia",role:"diario",spendFrom:true,value:400}],
      expenses:decision==="ambiguo"?[manual,{...manual,id:"other-manual",merchant:"Otra nomina manual"}]:[manual],
      settings:{autoPrices:false,theme:"green",lang:"es",budgetCycle:false,gTotalMode:"net",expenseBanks:["sabadell"]}});
    await page.goto("/");
    await page.locator(".botnav").waitFor({state:"visible"});
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await dismissNews(page);
    const feed=links({...salary,date:"2026-10-16"},2200);
    await page.evaluate(feed=>{cloud.bankSync=()=>Promise.resolve({ok:true,links:feed});},feed);
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    await page.getByRole("button",{name:/Sincronizar bancos/i}).click();
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").some(e=>e.extId==="salary"))).toBe(true);
    const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")).find(e=>e.extId==="salary"));
    expect(pending.possibleDup).toBe(true);
    expect(pending.possibleDupOf).toBe(decision==="ambiguo"?undefined:"manual-salary");
    expect(pending.autoGemelo).toBeUndefined();
    await page.locator(".sync-report").getByRole("button",{name:"Cerrar",exact:true}).click();
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    const bank=page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:"NOMINA EMPRESA SL"});
    await expect(bank).toHaveCount(1);
    await bank.click();
    await expect(page.getByText("¿Es el mismo movimiento?",{exact:true})).toBeVisible();
    if(decision==="ambiguo"){
      // No fabricar un gemelo concreto: se puede conservar como distinto desde la ficha.
      await page.getByRole("button",{name:"Son distintos",exact:true}).click();
    }else await page.getByRole("button",{name:decision==="mismo"?"Es el mismo":"Son distintos",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>{
      const s=mcLoadRaw("micartera_v3");return {rows:s.expenses.length,income:monthBudgetStats(s).income};
    })).toEqual({rows:decision==="mismo"?1:decision==="ambiguo"?3:2,income:decision==="mismo"?1800:decision==="ambiguo"?5400:3600});
  });
}

test("UX2909 remates: generico ambiguo con manuales sigue visible para revision",async({page})=>{
  await page.clock.install({time:new Date("2026-10-17T12:00:00Z")});
  const manual={id:"manual-salary",source:"manual",ent:"sabadell",date:"2026-10-16T12:00:00Z",amount:-1800,merchant:"Nomina manual",category:"ingreso"};
  await seedLoggedInDashboard(page,{__seedOnce:true,__seenVersion:"4.26.137",hasBankLink:true,budget:500,
    accounts:[{id:"sb",ent:"sabadell",name:"Cuenta ficticia",role:"diario",spendFrom:true,value:400}],
    expenses:[manual,{...manual,id:"other-manual",merchant:"Otra nomina manual"},{...manual,id:"notice",source:"wallet",merchant:"Aviso sintetico"}],
    settings:{autoPrices:false,theme:"green",lang:"es",budgetCycle:false,gTotalMode:"net",expenseBanks:["sabadell"]}});
  await page.goto("/");
  await page.locator(".botnav").waitFor({state:"visible"});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.evaluate(feed=>{cloud.bankSync=()=>Promise.resolve({ok:true,links:feed});},links({...salary,ext_id:null,date:"2026-10-16",merchant:"Movimiento"},2200));
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button",{name:/Sincronizar bancos/i}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").some(e=>e.source==="ob"&&e.merchant==="Movimiento"))).toBe(true);
  const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")).find(e=>e.source==="ob"&&e.merchant==="Movimiento"));
  expect(pending.possibleDup).toBe(true);
  expect(pending.possibleDupOf).toBeUndefined();
  expect(pending.autoGemelo).toBeUndefined();
  await page.locator(".sync-report").getByRole("button",{name:"Cerrar",exact:true}).click();
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const bank=page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:"Movimiento"});
  await expect(bank).toHaveCount(1);
  await bank.click();
  await expect(page.getByText("¿Es el mismo movimiento?",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Son distintos",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>{const s=mcLoadRaw("micartera_v3");return{rows:s.expenses.length,income:monthBudgetStats(s).income};})).toEqual({rows:4,income:7200});
});
