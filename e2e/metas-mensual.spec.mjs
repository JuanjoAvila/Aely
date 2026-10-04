import { test, expect, devices } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const textos={
  es:{metas:"Metas",title:"Reservar dinero de tus ingresos",add:"+ Añadir regla",save:"Guardar regla"},
  en:{metas:"Goals",title:"Reserve money from your income",add:"+ Add rule",save:"Save rule"},
  ca:{metas:"Metes",title:"Reservar diners dels teus ingressos",add:"+ Afegir regla",save:"Desar regla"}
};
const octubre="2026-10-31T12:00:00Z", noviembre="2026-11-02T12:00:00Z";
const goal={id:"g1",name:"Ahorro sintetico",emoji:"🎯",target:5000,saved:0};
const salary={id:"salary",date:"2026-10-25T12:00:00Z",amount:-2000,merchant:"NOMINA SINTETICA",category:"ingreso",ent:"sabadell",source:"ob:sabadell",status:"BOOK"};

async function boot(page,reload=false){
  if(reload) await page.reload(); else await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
}
async function nav(page,id){
  // Metas queda al fondo: volver arriba evita confundir la barra oculta con un fallo del presupuesto.
  await page.locator(".page").evaluateAll(pages=>pages.forEach(el=>{el.scrollTop=0;}));
  await page.locator('.botnav-tab[data-tour="'+id+'"]').click();
}
async function metas(page,t){
  await nav(page,"plan");
  await page.getByRole("tab",{name:t.metas,exact:true}).click();
  if(!await page.getByRole("button",{name:t.add,exact:true}).isVisible()) await page.getByText(t.title,{exact:true}).click();
}
async function disk(page){ return page.evaluate(()=>{
  const s=JSON.parse(localStorage.getItem("micartera_v3"));
  return {...s,expenses:JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]")};
}); }
async function saved(page,amount){
  // Se comprueba la cifra del progreso, no un porcentaje o el nombre de la regla.
  await expect(page.locator(".v4-goal-card").filter({hasText:goal.name}).locator(".v4-debt-sub")).toHaveText(new RegExp("^"+amount+"\\s"));
}
async function presupuesto(page,amount){
  await nav(page,"gastos");
  await expect(page.locator(".v4-gastos-summary-budget")).toContainText(amount+",00");
  await nav(page,"inicio");
  await expect(page.locator(".v4-budget .ph")).toContainText(String(amount));
}
async function alta(page,lang,cycle=false){
  await page.clock.install({time:new Date(octubre)});
  await seedLoggedInDashboard(page,{__seedOnce:true,budget:1000,goals:[goal],expenses:[salary],
    accounts:[{id:"bank",ent:"sabadell",name:"Diaria",value:3000,role:"diario",spendFrom:true}],
    settings:{autoPrices:false,theme:"green",lang,gTotalMode:"split",budgetCycle:cycle,expenseBanks:["sabadell"],reservaRules:[]}});
  await boot(page);
  const t=textos[lang];
  await metas(page,t);
  await page.getByRole("button",{name:t.add,exact:true}).click();
  const form=page.locator(".add-form").filter({has:page.getByRole("button",{name:t.save,exact:true})});
  await form.locator("input").first().fill("Mensual sintetica");
  await form.locator("input").last().fill("100");
  await form.getByRole("button",{name:t.save,exact:true}).click();
  await expect(form).toHaveCount(0);
  await saved(page,100);
  await expect.poll(async()=> (await disk(page)).reservaLog?.length).toBe(1);
  await presupuesto(page,900);
  return disk(page);
}
async function interceptar(page){
  await page.evaluate(()=>{
    window.__mensualPulls=0; window.__mensualBank=0;
    cloud.bankSync=async function(){ window.__mensualBank++; return {}; };
    cloud.pullState=function(){
      window.__mensualPulls++;
      return new Promise(function(resolve,reject){ window.__mensualResolve=resolve; window.__mensualReject=reject; });
    };
    // El cambio de reloj no debe abrir el informe del mes encima de la pantalla bajo prueba.
    localStorage.setItem("_mr2026-11","1");
  });
}
async function volver(page){ await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange"))); }
async function nube(page,state){
  await page.evaluate(({state,noviembre})=>{
    state._savedAt=Date.parse(noviembre);
    window.__mensualResolve({data:state,updated_at:noviembre});
  },{state,noviembre});
}

for(const lang of Object.keys(textos)){
  test(`retorno nativo sin visibilitychange también espera nube y aporta el mes (${lang})`,async({page})=>{
    await page.addInitScript(()=>{
      window.__mensualNative=[];
      window.Capacitor={isNativePlatform:()=>false,Plugins:{App:{addListener:function(name,cb){
        if(name==="appStateChange") window.__mensualNative.push(cb);
        return Promise.resolve({remove:function(){ const i=window.__mensualNative.indexOf(cb); if(i>=0) window.__mensualNative.splice(i,1); }});
      }}}};
    });
    const original=await alta(page,lang);
    await metas(page,textos[lang]); await interceptar(page);
    await page.clock.setSystemTime(new Date(noviembre));
    // En algunos Android solo llega este evento: añadir visibilitychange escondería la omisión.
    await page.evaluate(()=>{ for(const cb of window.__mensualNative) cb({isActive:true}); });
    await expect.poll(()=>page.evaluate(()=>window.__mensualPulls)).toBe(1);
    await saved(page,100);
    await nube(page,original); await saved(page,200);
    await expect.poll(async()=> (await disk(page)).reservaLog?.length).toBe(2);
    await presupuesto(page,900);
    expect(await page.evaluate(()=>window.__mensualBank)).toBe(0);
  });

  test(`alta 100 sobre 1000 y otro mes dentro del mismo ciclo aportan 200 (${lang})`,async({page})=>{
    const original=await alta(page,lang,true);
    await metas(page,textos[lang]);
    await interceptar(page);
    await page.clock.setSystemTime(new Date(noviembre));
    await volver(page);
    await expect.poll(()=>page.evaluate(()=>window.__mensualPulls)).toBe(1);
    // Antes de recibir la nube no se acredita noviembre con una copia local que puede estar atrasada.
    await saved(page,100);
    expect((await disk(page)).reservaLog.map(x=>x.mensual)).toEqual(["2026-10"]);
    await nube(page,original);
    await saved(page,200);
    await expect.poll(async()=> (await disk(page)).reservaLog?.length).toBe(2);
    expect((await disk(page)).reservaLog.map(x=>[x.mensual,x.amount])).toEqual([["2026-10",100],["2026-11",100]]);
    // El cobro del 25/10 sigue siendo el ancla del ciclo: cuentan ambos descuentos, no solo el último.
    await presupuesto(page,800);
    await volver(page); await volver(page);
    expect(await page.evaluate(()=>[window.__mensualPulls,window.__mensualBank])).toEqual([1,0]);
    expect((await disk(page)).expenses.map(x=>x.id)).toEqual(["salary"]);
    await boot(page,true);
    await metas(page,textos[lang]); await saved(page,200);
    expect((await disk(page)).reservaLog).toHaveLength(2);
  });

  test(`pull fallido al volver no aporta y el siguiente retorno sí lo reintenta (${lang})`,async({page})=>{
    const original=await alta(page,lang);
    await metas(page,textos[lang]); await interceptar(page);
    await page.clock.setSystemTime(new Date(noviembre)); await volver(page);
    await expect.poll(()=>page.evaluate(()=>window.__mensualPulls)).toBe(1);
    await page.evaluate(()=>window.__mensualReject(new Error("fallo sintetico")));
    // Dejar terminar la promesa evita que un segundo evento mida el bloqueo del vuelo anterior.
    await expect(page.locator(".toast")).toContainText("fallo sintetico");
    await saved(page,100);
    expect((await disk(page)).reservaLog).toHaveLength(1);
    await volver(page);
    await expect.poll(()=>page.evaluate(()=>window.__mensualPulls)).toBe(2);
    await nube(page,original); await saved(page,200);
    await expect.poll(async()=> (await disk(page)).reservaLog?.length).toBe(2);
    await presupuesto(page,900);
    expect(await page.evaluate(()=>window.__mensualBank)).toBe(0);
  });

  test(`estado de nube inválido no acredita un mes con la copia local (${lang})`,async({page})=>{
    await alta(page,lang);
    await metas(page,textos[lang]); await interceptar(page);
    await page.clock.setSystemTime(new Date(noviembre)); await volver(page);
    await expect.poll(()=>page.evaluate(()=>window.__mensualPulls)).toBe(1);
    await nube(page,{incomplete:true});
    await expect(page.locator(".toast")).toContainText("formato inesperado");
    // Recuperar la copia local no acredita que el estado remoto carezca ya de un asiento del mes.
    await saved(page,100);
    expect((await disk(page)).reservaLog).toHaveLength(1);
    expect(await page.evaluate(()=>window.__mensualBank)).toBe(0);
  });

  test(`otro cliente adopta el asiento mensual de la nube sin duplicarlo (${lang})`,async({page,browser})=>{
    const original=await alta(page,lang);
    const first=original.reservaLog[0];
    const remote={...original,_savedAt:Date.parse(noviembre),goals:[{...goal,saved:200}],reservaLog:[first,
      {...first,id:first.id.replace("2026-10","2026-11"),incomeKey:first.incomeKey.replace("2026-10","2026-11"),mensual:"2026-11",date:noviembre}]};
    delete remote.expenses;
    const secondContext=await browser.newContext({...devices["Pixel 5"],baseURL:new URL(page.url()).origin});
    try{
      const second=await secondContext.newPage();
      await second.clock.install({time:new Date(noviembre)});
      await seedLoggedInDashboard(second,{__seedOnce:true,...original,
        __cloudRows:{app_state:[{data:remote,updated_at:noviembre}]}});
      await boot(second); await metas(second,textos[lang]); await saved(second,200);
      await expect.poll(async()=> (await disk(second)).reservaLog?.length).toBe(2);
      await presupuesto(second,900);
      await interceptar(second); await volver(second); await volver(second);
      expect(await second.evaluate(()=>[window.__mensualPulls,window.__mensualBank])).toEqual([0,0]);
      await boot(second,true); await metas(second,textos[lang]); await saved(second,200);
      expect((await disk(second)).reservaLog).toHaveLength(2);
    }finally{ await secondContext.close(); }
  });
}
