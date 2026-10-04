import { test, expect, devices } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const textos={
  es:{metas:"Metas",title:"Reservar dinero de tus ingresos",add:"+ Añadir regla",save:"Guardar regla",apply:"Aplicar reparto",del:"Borrar regla",cancel:"Cancelar",question:"¿Borrar esta regla?",explanation:"Se libera del presupuesto lo que siga reservado por esta regla y pueda comprobarse. Las aportaciones ya guardadas en la meta y su historial se conservan; no se mueve dinero."},
  en:{metas:"Goals",title:"Reserve money from your income",add:"+ Add rule",save:"Save rule",apply:"Apply split",del:"Delete rule",cancel:"Cancel",question:"Delete this rule?",explanation:"Any remaining reservation that can be verified is released from the budget. Contributions already saved towards the goal and their history are kept; no money moves."},
  ca:{metas:"Metes",title:"Reservar diners dels teus ingressos",add:"+ Afegir regla",save:"Desar regla",apply:"Aplicar repartiment",del:"Esborrar regla",cancel:"Cancel·la",question:"Vols esborrar aquesta regla?",explanation:"S’allibera del pressupost el que segueixi reservat per aquesta regla i es pugui comprovar. Es conserven les aportacions ja desades a la meta i el seu historial; no es mouen diners."}
};
const goals=[{id:"g1",name:"Reserva A",emoji:"🎯",target:5000,saved:125},
  {id:"g2",name:"Reserva B",emoji:"🎯",target:5000,saved:50}];
const expenses=[{id:"salary",date:"2026-09-25T12:00:00Z",amount:-2000,merchant:"NOMINA SINTETICA",category:"ingreso",ent:"sabadell",source:"ob:sabadell",status:"BOOK"},
  {id:"purchase",date:"2026-09-26T10:00:00Z",amount:100,merchant:"Compra sintetica",category:"super",ent:"sabadell"}];
async function fechaFinanciera(page){
  // El periodo necesita septiembre; Date.now debe avanzar para completar la animación de tabs.
  const desfase=Date.parse("2026-09-28T12:00:00Z")-Date.now();
  await page.addInitScript(desfase=>{
    const FechaReal=Date,ahora=()=>FechaReal.now()+desfase;
    window.Date=new Proxy(FechaReal,{
      construct:(target,args,newTarget)=>Reflect.construct(target,args.length?args:[ahora()],newTarget),
      apply:()=>new FechaReal(ahora()).toString(),
      get:(target,key,receiver)=>key==="now"?ahora:Reflect.get(target,key,receiver)
    });
  },desfase);
}
test.beforeEach(async({page})=>{await fechaFinanciera(page);});

async function boot(page){
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  const now=await page.evaluate(()=>Date.now());
  await expect.poll(()=>page.evaluate(()=>Date.now())).toBeGreaterThan(now);
}
async function nav(page,id){
  // Las páginas ocultas también tienen cifras ya pintadas: no encadenar navegación hasta
  // que termine la transición, ni provocar scroll en otra pestaña mientras se asienta.
  await page.locator(".page.page-scroll-host").evaluate(el=>{el.scrollTop=0;});
  await expect(page.locator(".botnav")).not.toHaveClass(/\bbotnav-hidden\b/);
  const button=page.locator('.botnav-tab[data-tour="'+id+'"]');
  await expect(button).toBeInViewport();
  await button.click();
  const index=await page.locator(".botnav-tab[data-tour]").evaluateAll((buttons,id)=>buttons.findIndex(b=>b.dataset.tour===id),id);
  await expect(button).toHaveClass(/\bactive\b/);
  await expect(page.locator(".track > .page").nth(index)).toHaveClass(/\bpage-scroll-host\b/);
}
async function metas(page,t){
  await nav(page,"plan");
  await page.getByRole("tab",{name:t.metas,exact:true}).click();
  const card=page.locator(".card").filter({hasText:t.title});
  const header=page.getByText(t.title,{exact:true});
  if(!await page.getByRole("button",{name:t.add,exact:true}).isVisible()) await header.click();
  return card;
}
async function presupuesto(page,value,mode){
  await nav(page,"gastos");
  const summary=page.locator(".v4-gastos-summary");
  await expect(summary.locator(".v4-gastos-summary-budget")).toContainText(value+",00");
  await expect(summary.locator(".v4-gastos-summary-amount")).toContainText(mode==="net"?/1[.,\s]?900/:"100");
  await nav(page,"inicio");
  await expect(page.locator(".v4-budget .ph")).toContainText(String(value));
}
async function disk(page){ return page.evaluate(()=>{
  const s=JSON.parse(localStorage.getItem("micartera_v3"));
  return {...s,expenses:JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]")};
}); }
async function erase(page,t,name,confirm=true){
  await page.locator("[data-reserva-rule]").filter({hasText:name}).getByRole("button",{name:t.del,exact:true}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#ask-dialog-title")).toHaveText(t.question);
  await expect(dialog.getByText(t.explanation,{exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:confirm?t.del:t.cancel,exact:true}).click();
  await expect(dialog).toHaveCount(0);
}

for(const lang of Object.keys(textos)) for(const mode of ["split","net"]){
  test(`activar, cancelar y borrar varias reglas conserva nómina e historial (${lang}, ${mode})`,async({page,context,browser})=>{
    const t=textos[lang];
    await seedLoggedInDashboard(page,{__seedOnce:true,goals,expenses,budget:1000,
      accounts:[{id:"bank",ent:"sabadell",name:"Diaria",value:3000,role:"diario",spendFrom:true}],
      // Reglas POR INGRESO sembradas: las que crea la pantalla desde la 4.26.94 son mensuales y
      // aportan al guardarse (su cobertura está en metas-mensual). Este caso guarda el contrato
      // anterior, que sigue vivo para las reglas que ya existían.
      settings:{autoPrices:false,theme:"green",lang,gTotalMode:mode,expenseBanks:["sabadell"],
        reservaRules:[{id:"rA",name:"Regla A",kind:"fixed",value:200,goalId:"g1"},{id:"rB",name:"Regla B",kind:"fixed",value:100,goalId:"g2"}]},
      aportaciones:[{id:"manual",amount:25,name:"Manual",ent:"sabadell"}]});
    await boot(page);
    // Tener reglas por ingreso no aplica nada: solo el botón de confirmación reparte una nómina ya existente.
    await presupuesto(page,1000,mode);
    await metas(page,t);
    await page.getByRole("button",{name:t.apply,exact:true}).click();
    await expect(page.getByRole("button",{name:t.apply,exact:true})).toHaveCount(0);
    await expect(page.locator(".v4-goal-card").filter({hasText:"Reserva A"})).toContainText("325");
    await expect(page.locator(".v4-goal-card").filter({hasText:"Reserva B"})).toContainText("150");
    // La UI cambia antes del guardado diferido: el segundo cliente debe recibir dos reglas
    // realmente persistidas, no una captura vacía que depende del ritmo del runner.
    await expect.poll(async()=> (await disk(page)).settings.reservaRules.length).toBe(2);
    await expect.poll(async()=> (await disk(page)).reservaLog?.length).toBe(2);
    const rulesBefore=(await disk(page)).settings.reservaRules;
    await presupuesto(page,700,mode);
    await metas(page,t);
    await erase(page,t,"Regla A",false);
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(2);
    await presupuesto(page,700,mode);
    await metas(page,t);
    await context.setOffline(true);
    await erase(page,t,"Regla A");
    await presupuesto(page,900,mode);
    await expect.poll(async()=> (await disk(page)).reservaLog?.length).toBe(3);
    const saved=await disk(page);
    expect(saved.expenses.map(e=>e.id)).toEqual(["salary","purchase"]);
    expect(saved.goals.map(g=>g.saved)).toEqual([325,150]);
    expect(saved.aportaciones[0].amount).toBe(25);
    expect(saved.accounts[0].value).toBe(3000);
    await context.setOffline(false);
    await page.reload();
    await expect(page.locator(".botnav")).toBeVisible();
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await dismissNews(page);
    await presupuesto(page,900,mode);
    await metas(page,t);
    await expect(page.getByRole("button",{name:t.apply,exact:true})).toHaveCount(0);
    await erase(page,t,"Regla B");
    await presupuesto(page,1000,mode);
    await expect.poll(async()=> (await disk(page)).reservaLog?.length).toBe(4);
    // Otro cliente recibe el estado corregido por el pull real de app_state, sin movimientos nuevos.
    const cloudState=await disk(page), cloudExpenses=cloudState.expenses.map(e=>({id:e.id,fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,source:e.source?"ob:sabadell":"manual:sabadell"}));
    delete cloudState.expenses;
    // El doble conserva el log actualizado y devuelve la configuración anterior: no presupone
    // una causa de sync real, pero obliga a soportar que la regla reaparezca sin sobreliberar.
    cloudState.settings={...cloudState.settings,reservaRules:rulesBefore};
    const secondContext=await browser.newContext({...devices["Pixel 5"],baseURL:new URL(page.url()).origin});
    const second=await secondContext.newPage();
    await fechaFinanciera(second);
    await seedLoggedInDashboard(second,{goals:[],expenses:[],settings:{lang},
      __cloudRows:{app_state:[{data:cloudState,updated_at:new Date().toISOString()}],expenses:cloudExpenses}});
    await boot(second);
    await presupuesto(second,1000,mode);
    await metas(second,t);
    await expect(second.locator(".v4-goal-card").filter({hasText:"Reserva A"})).toContainText("325");
    await expect(second.getByRole("button",{name:t.apply,exact:true})).toHaveCount(0);
    await expect(second.locator("[data-reserva-rule]")).toHaveCount(2);
    await erase(second,t,"Regla A");
    await presupuesto(second,1000,mode);
    await metas(second,t);
    await erase(second,t,"Regla B");
    await presupuesto(second,1000,mode);
    expect((await disk(second)).reservaLog).toHaveLength(4);
    await secondContext.close();
  });
  test(`borrar regla sin aplicar no cambia presupuesto (${lang}, ${mode})`,async({page})=>{
    const t=textos[lang];
    await seedLoggedInDashboard(page,{__seedOnce:true,goals,expenses,budget:1000,
      accounts:[{id:"bank",ent:"sabadell",name:"Diaria",value:3000,role:"diario",spendFrom:true}],
      settings:{lang,gTotalMode:mode,expenseBanks:["sabadell"],reservaRules:[{id:"rS",name:"Sin reparto",kind:"fixed",value:100,goalId:"g1"}]}});
    await boot(page);
    await metas(page,t);
    await erase(page,t,"Sin reparto");
    await presupuesto(page,1000,mode);
    expect((await disk(page)).reservaLog||[]).toEqual([]);
  });
}
