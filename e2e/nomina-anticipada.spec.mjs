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
  await expect(page.locator('.v42-cycle-pace')).toHaveCount(cycle?1:0);
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
