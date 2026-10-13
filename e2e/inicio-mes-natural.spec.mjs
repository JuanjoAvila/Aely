import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const idiomas=[
  {lang:"es",money:"Dinero",cycle:"Presupuesto por ciclo de cobro",pace:x=>x+" € al día durante 3 días"},
  {lang:"en",money:"Money",cycle:"Budget by pay cycle",pace:x=>x+" € a day for 3 days"},
  {lang:"ca",money:"Diners",cycle:"Pressupost per cicle de cobrament",pace:x=>x+" € al dia durant 3 dies"},
];
// El anillo enseña lo que QUEDA, igual que la cifra «Te quedan» de su derecha (Inicio v4.2):
// agotado o pasado es 0 %, sin tocar es 100 %. Y el reparto diario sale siempre que quede
// dinero y días, también en el mes natural: el 28/9 faltan 3 días para el 1/10.

async function ciclo(page,caso){
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-open-settings")));
  const settings=page.locator(".settings-push.open");
  await expect(settings).toBeVisible();
  await settings.locator("button.set-row").filter({hasText:caso.money}).first().click();
  await settings.locator("button.set-row").filter({hasText:caso.cycle}).click();
  await settings.locator(".settings-push-h .back").click();
}

for(const caso of idiomas) for(const limite of [
  {name:"agotado",spent:1000,pct:"0%",over:false,state:"tight"},
  {name:"excedido",spent:1200,pct:"0%",over:true},
  {name:"reservado entero",spent:100,reserved:1000,pct:"0%",over:true},
  {name:"sin actividad",spent:0,pct:"100%",over:false,daily:333},
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
    await expect(dash.locator(".v42-cycle-amount>.serif")).toHaveText(String(1000-(limite.reserved||0)-limite.spent)+" €");
    await expect(dash).toHaveAttribute("data-state",limite.over?"over":limite.spent===0?"comfort":limite.state||"good");
    if(limite.daily) await expect(dash.getByTestId("inicio-cycle-pace")).toHaveText(caso.pace(limite.daily));
    else await expect(dash.getByTestId("inicio-cycle-pace")).toHaveCount(0);
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
    // En el ciclo quedan 980 de 1000; al salir, el mes natural deja 300 de 900.
    await expect(ring).toHaveText("98%");
    await expect(dash.locator(".v42-cycle-amount>.serif")).toHaveText("980 €");
    await ciclo(page,caso);
    await expect(ring).toHaveText("33%");
    await expect(dash.locator(".v42-cycle-amount>.serif")).toHaveText("300 €");
    await expect(dash.locator(".v42-cycle-of")).toContainText("900");
    await expect(dash.getByTestId("inicio-cycle-pace")).toHaveText(caso.pace(100));
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    // El balance mensual positivo es legítimo; no se transforma en gasto para arreglar Inicio.
    const summary=page.locator(".v4-gastos-summary");
    await expect(summary.locator(".v4-gastos-summary-amount")).toContainText(perfil==="net"?"1480":"600");
    await page.locator('.botnav-tab[data-tour="inicio"]').click();
    await ciclo(page,caso);
    await expect(ring).toHaveText("98%");
    await ciclo(page,caso);
    await page.reload();
    await expect(page.locator(".botnav")).toBeVisible();
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await dismissNews(page);
    await expect(ring).toHaveText("33%");
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.gTotalMode)).toBe(perfil);
  });
}

// El aviso depende del margen real antes que del ritmo: el verde con cero engañaba.
for(const lang of ["es","en","ca"])for(const day of [1,15,30])for(const remaining of [0,-0.01]){
  test(`Inicio avisa sin verde con restante${remaining} día${day} (${lang})`,async({page})=>{
    const date="2026-09-"+String(day).padStart(2,"0")+"T12:00:00Z";
    await page.clock.install({time:new Date(date)});
    await seedLoggedInDashboard(page,{budget:1000,settings:{autoPrices:false,theme:"green",lang,budgetCycle:false,gTotalMode:"split",expenseBanks:["sabadell"]},
      accounts:[{id:"daily",ent:"sabadell",name:"Cuenta sintética",value:1000,role:"diario",spendFrom:true}],
      expenses:[{id:"spent",date,amount:1000-remaining,merchant:"Compra sintética",category:"super",ent:"sabadell"}]});
    await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
    const card=page.locator(".v4-budget"),tone=remaining===0?"tan":"coral";
    await expect(card).toHaveAttribute("data-state",remaining===0?"tight":"over");
    // El aviso se escucha completo; los rótulos retirados no vuelven a la tarjeta.
    await expect(card.locator(".st,.v42-cycle-remaining")).toHaveCount(0);
    const warning=remaining===0?{es:/Vas justito/,en:/Getting tight/,ca:/Vas justet/}[lang]:{es:/Te has pasado/,en:/over budget/,ca:/has passat/}[lang];
    await expect(card).toHaveAttribute("aria-label",warning);
    await expect(card).not.toHaveAttribute("aria-label",/Vas bien|On track|Vas bé|Cicle acabat de començar|Cycle just started/);
    expect(await card.evaluate((el,tone)=>{const probe=document.createElement("span");probe.style.color="var(--"+tone+")";el.appendChild(probe);const ok=getComputedStyle(el).color===getComputedStyle(probe).color;probe.remove();return ok;},tone)).toBe(true);
    await expect(card.locator(".v42-cycle-percent")).toHaveText("0%");
    await expect(card.locator(".v42-cycle-draw")).toHaveAttribute("stroke-dasharray","0 100");
    await expect(card.getByTestId("inicio-cycle-pace")).toHaveCount(0);
  });
}
