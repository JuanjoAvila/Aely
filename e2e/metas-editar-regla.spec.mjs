import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const textos={
  es:{metas:"Metas",title:"Reservar dinero de tus ingresos",edit:"Editar regla",save:"Guardar regla",cancel:"Cancelar",hint:"Lo ya aportado no cambia. Si esta regla ya se aplicó este mes, los cambios se aplicarán el próximo mes."},
  en:{metas:"Goals",title:"Reserve money from your income",edit:"Edit rule",save:"Save rule",cancel:"Cancel",hint:"Past contributions stay unchanged. If this rule has already been applied this month, changes will apply next month."},
  ca:{metas:"Metes",title:"Reservar diners dels teus ingressos",edit:"Edita la regla",save:"Desar regla",cancel:"Cancel·la",hint:"Les aportacions fetes no canvien. Si aquesta regla ja s'ha aplicat aquest mes, els canvis s'aplicaran el mes vinent."}
};
const rule={id:"monthly-a",name:"Reserva mensual",kind:"fixed",value:100,goalId:"g1",mensual:true,unknown:{keep:7}};
const log={id:"mensual|monthly-a|2026-10",ruleId:"monthly-a",goalId:"g1",name:"Reserva mensual",amount:100,date:"2026-10-01T12:00:00Z",incomeKey:"mensual|monthly-a|2026-10",mensual:"2026-10"};
async function boot(page,lang,overrides={}){
  // El reloj financiero avanza; congelar Date.now también detiene la animación de pestañas.
  await page.addInitScript(()=>{
    const Native=Date, offset=Date.parse("2026-10-08T12:00:00Z")-Native.now();
    window.__editOffset=offset;
    function Clock(...args){ return new.target?Reflect.construct(Native,args.length?args:[Native.now()+window.__editOffset],new.target):new Native(Native.now()+window.__editOffset).toString(); }
    Object.setPrototypeOf(Clock,Native); Clock.prototype=Native.prototype; Clock.now=()=>Native.now()+window.__editOffset; window.Date=Clock;
  });
  await seedLoggedInDashboard(page,{__seedOnce:true,budget:1000,goals:[{id:"g1",name:"Meta A",target:9000,saved:100},{id:"g2",name:"Meta B",target:9000,saved:0}],reservaLog:[log],
    settings:{autoPrices:false,theme:"green",lang,gTotalMode:"split",expenseBanks:["sabadell"],reservaRules:[rule]},...overrides});
  await page.goto("/");
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.getByRole("tab",{name:textos[lang].metas,exact:true}).click();
  if(!await page.locator('[data-reserva-rule]').first().isVisible()) await page.getByText(textos[lang].title,{exact:true}).click();
  await expect.poll(async()=> (await saved(page)).settings.reservaRules.length).toBe(1);
}
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")));
const expenseRaw=page=>page.evaluate(()=>localStorage.getItem("micartera_v3_exp"));
const formOf=page=>page.locator(".add-form");
async function open(page,lang){ await page.locator('[data-reserva-rule]').getByRole("button",{name:textos[lang].edit,exact:true}).click(); return formOf(page); }
async function nav(page,id){
  await page.locator(".page").evaluateAll(pages=>pages.forEach(el=>{el.scrollTop=0;}));
  await page.locator('.botnav-tab[data-tour="'+id+'"]').click();
}
const errors={
  es:{amount:"Escribe un importe mayor que 0, por ejemplo 1200 o 1200,50.",pct:"El porcentaje tiene que ser mayor que 0 y como máximo 100.",goal:"Elige una meta que siga activa.",changed:"Esta regla cambió o se borró. Cancela y vuelve a abrirla para editar la versión actual.",income:"Lo ya repartido no cambia. Los cambios se aplicarán al siguiente ingreso que se reparta."},
  en:{amount:"Enter an amount above 0, for example 1200 or 1200.50.",pct:"The percentage must be above 0 and no more than 100.",goal:"Choose a goal that is still active.",changed:"This rule changed or was deleted. Cancel and reopen it to edit the current version.",income:"Past distributions stay unchanged. Changes will apply to the next income you distribute."},
  ca:{amount:"Escriu un import més gran que 0, per exemple 1200 o 1200,50.",pct:"El percentatge ha de ser més gran que 0 i com a màxim 100.",goal:"Tria un objectiu que encara estigui actiu.",changed:"Aquesta regla ha canviat o s'ha esborrat. Cancel·la i torna-la a obrir per editar la versió actual.",income:"El que ja s'ha repartit no canvia. Els canvis s'aplicaran al següent ingrés que es reparteixi."}
};
// La escritura usa el set REAL de App. Encolar antes del toque comprueba el estado fresco
// aun cuando React todavía pinta la copia antigua; no se escribe localStorage por detrás.
async function concurrent(page,mode,save){
  return page.evaluate(({mode,save})=>{
    const row=document.querySelector('[data-reserva-rule]');
    let fiber=row[Object.keys(row).find(k=>k.startsWith("__reactFiber$"))];
    while(fiber && !(fiber.memoizedProps&&fiber.memoizedProps.state&&fiber.memoizedProps.set)) fiber=fiber.return;
    if(!fiber) throw new Error("No se encontró ReservaRules con el set real");
    fiber.memoizedProps.set(function(s){
      if(mode==="goneGoal" || mode==="doneGoal") return {...s,goals:s.goals.flatMap(g=>g.id!=="g1"?[g]:mode==="goneGoal"?[]:[{...g,done:true}])};
      return {...s,settings:{...s.settings,reservaRules:mode==="deleted"?[]:s.settings.reservaRules.map(r=>({...r,value:222,unknown:{keep:8}}))}};
    });
    const beforePaint=row.textContent;
    if(save) [...document.querySelectorAll(".add-form button")].find(b=>b.textContent.trim()===save).click();
    return beforePaint;
  },{mode,save});
}
for(const lang of Object.keys(textos)){
  test(`editar conserva identidad, aportación y descuento; cancelar y recargar son seguros (${lang})`,async({page})=>{
    await boot(page,lang);
    const t=textos[lang], row=page.locator('[data-reserva-rule="monthly-a"]');
    const before=await saved(page);
    const expenses=await expenseRaw(page);
    await expect(row.getByRole("button",{name:t.edit,exact:true})).toHaveCount(1);
    await row.getByRole("button",{name:t.edit,exact:true}).click();
    const form=page.locator(".add-form");
    await expect(form.locator("input").first()).toHaveValue("Reserva mensual");
    await expect(form.locator("input").last()).toHaveValue("100");
    await expect(form).toContainText(t.hint);
    await form.locator("input").last().fill("300");
    await form.getByRole("button",{name:t.cancel,exact:true}).click();
    expect(await saved(page)).toEqual(before);
    await row.getByRole("button",{name:t.edit,exact:true}).click();
    await form.locator("input").first().fill("Reserva actualizada");
    await form.locator("input").last().fill(lang==="en"?"175.50":"175,50");
    await form.locator("select").last().selectOption("g2");
    await form.getByRole("button",{name:t.save,exact:true}).click();
    await expect(form).toHaveCount(0);
    await expect(row).toContainText("Reserva actualizada");
    await expect(row.locator('[data-reserva-mensual]')).toContainText("Meta A");
    await expect.poll(async()=> (await saved(page)).settings.reservaRules[0].value).toBe(175.5);
    const after=await saved(page);
    expect(after.settings.reservaRules).toEqual([{...rule,name:"Reserva actualizada",value:175.5,goalId:"g2"}]);
    expect(after.reservaLog).toEqual(before.reservaLog);
    expect(after.goals).toEqual(before.goals);
    expect(after.accounts).toEqual(before.accounts);
    expect(await expenseRaw(page)).toBe(expenses);
    await expect(page.locator(".v4-goal-card").filter({hasText:"Meta A"}).locator(".v4-debt-sub")).toHaveText(/^100\s/);
    await expect(page.locator(".v4-goal-card").filter({hasText:"Meta B"}).locator(".v4-debt-sub")).toHaveText(/^0\s/);
    await nav(page,"gastos"); await expect(page.locator(".v4-gastos-summary-budget")).toContainText(/900[,.]00/);
    await nav(page,"inicio"); await expect(page.locator(".v4-budget .ph")).toContainText("900");
    await page.reload();
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await expect.poll(async()=> (await saved(page)).settings.reservaRules[0].value).toBe(175.5);
    expect((await saved(page)).reservaLog).toEqual(before.reservaLog);
    expect((await saved(page)).goals).toEqual(before.goals);
    await expect(page.locator(".v4-budget .ph")).toContainText("900");
  });

  test(`editar valida importe y porcentaje sin escribir; doble toque guarda una vez (${lang})`,async({page})=>{
    await boot(page,lang); const t=textos[lang], before=await saved(page), form=await open(page,lang);
    for(const value of ["","0","-1","abc"]){
      await form.locator("input").last().fill(value); await form.getByRole("button",{name:t.save,exact:true}).click();
      await expect(form.getByRole("alert")).toHaveText(errors[lang].amount);
      expect((await saved(page)).settings.reservaRules).toEqual(before.settings.reservaRules);
    }
    await form.locator("select").first().selectOption("pct"); await form.locator("input").last().fill("101");
    await form.getByRole("button",{name:t.save,exact:true}).click(); await expect(form.getByRole("alert")).toHaveText(errors[lang].pct);
    await form.locator("input").last().fill("100");
    await form.getByRole("button",{name:t.save,exact:true}).evaluate(b=>{b.click();b.click();});
    await expect(form).toHaveCount(0);
    await expect.poll(async()=> (await saved(page)).settings.reservaRules[0].kind).toBe("pct");
    const after=await saved(page); expect(after.settings.reservaRules).toEqual([{...rule,kind:"pct",value:100}]);
    expect(after.reservaLog).toEqual(before.reservaLog); expect(after.goals).toEqual(before.goals);
  });

  for(const mode of ["changed","deleted","goneGoal","doneGoal"]){
    test(`edición no pisa estado fresco (${mode}, ${lang})`,async({page})=>{
      await boot(page,lang); const t=textos[lang], before=await saved(page), expenses=await expenseRaw(page), form=await open(page,lang);
      await form.locator("input").first().fill("Borrador conservado"); await form.locator("input").last().fill("175");
      const oldPaint=await concurrent(page,mode,t.save); expect(oldPaint).toContain("Reserva mensual");
      await expect(form.getByRole("alert")).toHaveText(mode.endsWith("Goal")?errors[lang].goal:errors[lang].changed);
      await expect(form.locator("input").first()).toHaveValue("Borrador conservado");
      await expect(form.locator("input").last()).toHaveValue("175");
      await expect.poll(async()=> (await saved(page)).settings.reservaRules).toEqual(mode==="deleted"?[]:mode==="changed"?[{...rule,value:222,unknown:{keep:8}}]:[rule]);
      const after=await saved(page); expect(after.reservaLog).toEqual(before.reservaLog); expect(after.accounts).toEqual(before.accounts); expect(await expenseRaw(page)).toBe(expenses);
      await form.getByRole("button",{name:t.cancel,exact:true}).click(); await expect(form).toHaveCount(0);
    });
  }

  test(`mensual pendiente editada aplica una vez y el siguiente mes Madrid usa la meta nueva (${lang})`,async({page})=>{
    const pending={...rule,kind:"pct",value:10};
    await boot(page,lang,{budget:0,reservaLog:[],settings:{autoPrices:false,theme:"green",lang,gTotalMode:"split",expenseBanks:["sabadell"],reservaRules:[pending]}});
    const t=textos[lang], form=await open(page,lang);
    await form.locator("select").first().selectOption("fixed"); await form.locator("input").last().fill("75"); await form.locator("select").last().selectOption("g2");
    await form.getByRole("button",{name:t.save,exact:true}).evaluate(b=>{b.click();b.click();}); await expect(form).toHaveCount(0);
    await expect.poll(async()=> (await saved(page)).reservaLog.length).toBe(1);
    const once=await saved(page); expect(once.reservaLog[0]).toMatchObject({id:"mensual|monthly-a|2026-10",goalId:"g2",amount:75});
    expect(once.goals.map(g=>g.saved)).toEqual([100,75]);
    // La vuelta real espera pull válido; el mock devuelve el estado recién persistido.
    await page.evaluate(state=>{
      cloud.pullState=async()=>({data:state});
      window.__editOffset+=Date.parse("2026-10-31T23:30:00Z")-Date.now();
      localStorage.setItem("_mr2026-11","1"); document.dispatchEvent(new Event("visibilitychange"));
    },once);
    await expect.poll(async()=> (await saved(page)).reservaLog.length).toBe(2);
    const next=await saved(page); expect(next.reservaLog[1]).toMatchObject({id:"mensual|monthly-a|2026-11",goalId:"g2",amount:75});
    expect(next.reservaLog[0]).toEqual(once.reservaLog[0]); expect(next.goals.map(g=>g.saved)).toEqual([100,150]);
    await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(async()=> (await saved(page)).reservaLog.length).toBe(2);
  });

  test(`editar regla por ingreso conserva reparto antiguo y no se vuelve mensual (${lang})`,async({page})=>{
    const legacy={id:rule.id,name:"Legada",kind:"fixed",value:100,goalId:"g1",unknown:rule.unknown};
    const incomeLog={id:"income-old",ruleId:rule.id,goalId:"g1",name:"Legada",amount:100,date:"2026-10-01",incomeKey:"2026-10-01|-2000|NOMINA"};
    await boot(page,lang,{reservaLog:[incomeLog],settings:{autoPrices:false,theme:"green",lang,gTotalMode:"split",expenseBanks:["sabadell"],reservaRules:[legacy]}});
    const before=await saved(page), form=await open(page,lang), t=textos[lang]; await expect(form).toContainText(errors[lang].income);
    await form.locator("input").last().fill("150"); await form.locator("select").last().selectOption("g2");
    await form.getByRole("button",{name:t.save,exact:true}).click(); await expect(form).toHaveCount(0);
    await expect.poll(async()=> (await saved(page)).settings.reservaRules[0].value).toBe(150);
    const after=await saved(page); expect(after.settings.reservaRules).toEqual([{...legacy,value:150,goalId:"g2"}]);
    expect(after.goals).toEqual(before.goals); expect(after.reservaLog).toEqual(before.reservaLog);
    await page.reload(); await page.waitForFunction(()=>!document.getElementById("mc-load"));
    expect((await saved(page)).reservaLog).toEqual(before.reservaLog);
  });

  test(`reabrir céntimos y guardar sin cambios conserva cifras; actualización posterior no reabre (${lang})`,async({page})=>{
    const cents={...rule,value:175.5};
    await boot(page,lang,{settings:{autoPrices:false,theme:"green",lang,gTotalMode:"split",expenseBanks:["sabadell"],reservaRules:[cents]}});
    const before=await saved(page), t=textos[lang], form=await open(page,lang);
    await expect(form.locator("input").last()).toHaveValue(lang==="en"?"175.5":"175,5");
    await form.getByRole("button",{name:t.save,exact:true}).click(); await expect(form).toHaveCount(0);
    expect(await saved(page)).toEqual(before);
    await open(page,lang); await expect(form.locator("input").last()).toHaveValue(lang==="en"?"175.5":"175,5");
    await form.locator("input").last().fill(lang==="en"?"175.50":"175,50");
    await form.getByRole("button",{name:t.save,exact:true}).click(); await expect(form).toHaveCount(0);
    await concurrent(page,"changed",null);
    await expect.poll(async()=> (await saved(page)).settings.reservaRules[0].value).toBe(222);
    await expect(form).toHaveCount(0); await expect(page.getByRole("alert")).toHaveCount(0);
    const after=await saved(page); expect(after.goals).toEqual(before.goals); expect(after.reservaLog).toEqual(before.reservaLog);
  });

  test(`replay del updater confirma edición mensual que cumple meta sin doble aportación (${lang})`,async({page})=>{
    await page.addInitScript(()=>{
      let lib;
      Object.defineProperty(window,"React",{configurable:true,get:()=>lib,set(value){
        // UMD asigna primero React={} y después useState: interceptar solo el objeto vacío
        // dejaba el wrapper sobrescrito y el supuesto replay nunca ocurría.
        lib=value; let wrapped;
        Object.defineProperty(value,"useState",{configurable:true,get:()=>wrapped,set(original){
          wrapped=function(init){
            const [state,dispatch]=original(init);
            if(typeof init!=="function" || init.name!=="loadState") return [state,dispatch];
            return [state,function(updater){
              if(window.__editReplay && typeof updater==="function") dispatch(function(s){window.__editReplays=(window.__editReplays||0)+1; return updater(updater(s));});
              else dispatch(updater);
            }];
          };
        }});
      }});
    });
    const pending={...rule,kind:"pct",value:10};
    await boot(page,lang,{budget:0,reservaLog:[],goals:[{id:"g1",name:"Meta A",target:50,saved:0}],settings:{autoPrices:false,theme:"green",lang,gTotalMode:"split",expenseBanks:["sabadell"],reservaRules:[pending]}});
    const t=textos[lang], form=await open(page,lang);
    await form.locator("select").first().selectOption("fixed"); await form.locator("input").last().fill("75");
    await page.evaluate(()=>window.__editReplay=true);
    await form.getByRole("button",{name:t.save,exact:true}).click();
    await expect(form).toHaveCount(0); await expect(page.getByRole("alert")).toHaveCount(0);
    await expect.poll(async()=> (await saved(page)).reservaLog.length).toBe(1);
    const after=await saved(page); expect(after.goals[0]).toMatchObject({saved:75,done:true});
    expect(after.reservaLog[0]).toMatchObject({id:"mensual|monthly-a|2026-10",amount:75});
    expect(await page.evaluate(()=>window.__editReplays)).toBeGreaterThan(0);
  });
}
