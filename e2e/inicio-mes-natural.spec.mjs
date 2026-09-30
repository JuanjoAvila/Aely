import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const idiomas=[
  {lang:"es",money:"Dinero",cycle:"Presupuesto por ciclo de cobro",spent:"Has gastado",daily:"Puedes gastar 150",over:"Este mes te fuiste del presupuesto"},
  {lang:"en",money:"Money",cycle:"Budget by pay cycle",spent:"You've spent",daily:"You can spend 150",over:"You went past your budget this month"},
  {lang:"ca",money:"Diners",cycle:"Pressupost per cicle de cobrament",spent:"Has gastat",daily:"Pots gastar 150",over:"Aquest mes has sortit del pressupost"},
];

async function ciclo(page,caso){
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-open-settings")));
  const settings=page.locator(".settings-push.open");
  await expect(settings).toBeVisible();
  await settings.locator("button.set-row").filter({hasText:caso.money}).first().click();
  await settings.locator("button.set-row").filter({hasText:caso.cycle}).click();
  await settings.locator(".settings-push-h .back").click();
}

for(const caso of idiomas) for(const limite of [
  {name:"agotado",spent:1000,pct:"100%",over:false},
  {name:"excedido",spent:1200,pct:"100%",over:true},
  {name:"reservado entero",spent:100,reserved:1000,pct:"100%",over:true},
  {name:"sin actividad",spent:0,pct:"0%",over:false},
  {name:"sin presupuesto",spent:100,budget:0},
]) test(`Inicio distingue ${limite.name} (${caso.lang})`,async({page})=>{
  await page.clock.install({time:new Date("2026-09-28T12:00:00Z")});
  await seedLoggedInDashboard(page,{budget:limite.budget==null?1000:limite.budget,
    settings:{autoPrices:false,theme:"green",lang:caso.lang,gTotalMode:"net",budgetCycle:false},
    expenses:limite.spent?[{id:"g",date:"2026-09-27T12:00:00Z",amount:limite.spent,category:"super"},
      {id:"i",date:"2026-09-26T12:00:00Z",amount:-2000,category:"ingreso"}]:[],
    reservaLog:limite.reserved?[{date:"2026-09-27T12:00:00Z",amount:limite.reserved}]:[],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  const dash=page.locator(".v4-budget");
  if(limite.budget===0){
    await expect(dash).toHaveCount(0);
    await expect(page.locator(".v4-empty").filter({hasText:/Ponle un presupuesto|Set a monthly budget|Posa-li un pressupost/})).toBeVisible();
  }else{
    await expect(dash.locator(".v4-ring .num")).toHaveText(limite.pct);
    await expect(dash.locator(".ph")).toContainText(caso.spent+" "+limite.spent);
    if(limite.over) await expect(dash.locator(".ph")).toContainText(caso.over);
    else await expect(dash.locator(".ph")).not.toContainText(caso.over);
  }
});

for(const caso of idiomas) for(const perfil of ["split","net"]){
  test(`salir del ciclo muestra gasto mensual coherente (${caso.lang}, ${perfil})`,async({page})=>{
    await page.clock.install({time:new Date("2026-09-28T12:00:00Z")});
    await seedLoggedInDashboard(page,{
      __seedOnce:true,budget:1000,settings:{autoPrices:false,theme:"green",lang:caso.lang,gTotalMode:perfil,budgetCycle:true,expenseBanks:["sabadell"]},
      accounts:[{id:"sb",ent:"sabadell",name:"Diaria",value:1000,role:"diario",spendFrom:true},
        {id:"rv",ent:"revolut",name:"Reserva",value:500,role:"ahorro",spendFrom:false}],
      expenses:[
        {id:"antes",date:"2026-09-20T12:00:00Z",amount:500,merchant:"Compra anterior",category:"super",ent:"sabadell"},
        {id:"nomina",date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso",ent:"sabadell"},
        {id:"compra",date:"2026-09-27T12:00:00Z",amount:100,merchant:"Compra reciente",category:"super",ent:"sabadell"},
        {id:"bizum",date:"2026-09-27T14:00:00Z",amount:-80,merchant:"Bizum recibido",category:"ingreso",ent:"sabadell"},
        {id:"otro",date:"2026-09-27T15:00:00Z",amount:900,merchant:"Banco excluido",category:"super",ent:"revolut"},
        {id:"neutro",date:"2026-09-27T16:00:00Z",amount:300,merchant:"Traspaso",category:"traspaso",ent:"sabadell"},
        {id:"dup",date:"2026-09-27T17:00:00Z",amount:250,merchant:"Posible repetido",category:"super",ent:"sabadell",possibleDup:true},
      ],reservaLog:[{date:"2026-09-21T12:00:00Z",amount:100}],
    });
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await dismissNews(page);
    const dash=page.locator(".v4-budget"), ring=dash.locator(".v4-ring .num");
    await expect(ring).toHaveText("2%");
    await ciclo(page,caso);
    await expect(ring).toHaveText("67%");
    await expect(dash.locator(".ph")).toContainText(caso.spent+" 600");
    await expect(dash.locator(".ph")).toContainText("900");
    await expect(dash.locator(".ph")).toContainText(caso.daily);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    // El balance mensual positivo es legítimo; no se transforma en gasto para arreglar Inicio.
    const summary=page.locator(".v4-gastos-summary");
    await expect(summary.locator(".v4-gastos-summary-amount")).toContainText(perfil==="net"?"1480":"600");
    await page.locator('.botnav-tab[data-tour="inicio"]').click();
    await ciclo(page,caso);
    await expect(ring).toHaveText("2%");
    await ciclo(page,caso);
    await page.reload();
    await expect(page.locator(".botnav")).toBeVisible();
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await dismissNews(page);
    await expect(ring).toHaveText("67%");
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.gTotalMode)).toBe(perfil);
  });
}
