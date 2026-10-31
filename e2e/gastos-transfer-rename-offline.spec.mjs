import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews} from "./fixtures.mjs";

for(const fixture of [{category:"traspaso",amount:-123.45},{category:"inversion",amount:-200},{category:"deudas",amount:-200.01},{category:"bizum",amount:-200}])test("renombrar offline conserva categoría, céntimos y persistencia: "+fixture.category,
  {annotation:{type:"own-clock",description:"Movimiento sintético del día de la prueba"}},
  async({page,context},info)=>{
    await context.route("**/*",route=>{
      const host=new URL(route.request().url()).hostname;
      return host==="127.0.0.1"||host==="localhost"?route.continue():route.abort();
    });
    const id="00000000-0000-4000-8000-000000000001";
    await seedLoggedInDashboard(page,{__seedOnce:true,__seenVersion:"4.26.191",
      expenses:[{id,date:new Date().toISOString(),amount:fixture.amount,merchant:"Traspaso sintético",
        category:fixture.category,source:"ob",ent:"sabadell",obName:"Nombre bancario",note:"Nota intacta"}],
      accounts:[{id:"synthetic",ent:"sabadell",name:"Cuenta sintética",value:1000,role:"diario"}],
      settings:{autoPrices:false,theme:"green",lang:"es",expenseBanks:["sabadell"],budgetCycle:false}});
    await page.addInitScript(()=>{
      window.addEventListener("DOMContentLoaded",()=>{cloud.enabled=()=>false;});
    });
    const enter=async()=>{
      await page.goto("/");
      await expect(page.locator(".botnav")).toBeVisible({timeout:15000});
      await dismissNews(page);
      await page.locator('.botnav-tab[data-tour="gastos"]').click();
    };
    const stored=()=>page.evaluate(id=>{
      const state=loadState(),row=state.expenses.find(e=>e.id===id);
      return {row,visible:row&&!expenseIsTombstoned(row,expenseDeletedSet(state)),cloudEnabled:cloud.enabled()};
    },id);
    await enter();
    const before=await stored();
    expect(before.row.category).toBe(fixture.category);
    expect(Math.round(before.row.amount*100)).toBe(Math.round(fixture.amount*100));
    expect(before.cloudEnabled).toBe(false);
    // El traspaso va plegado en «Traspasos · no cuentan» (31/10/2026): se abre el bloque y se toca su fila.
    const traspaso=fixture.category==="traspaso";
    const fila=nombre=>page.locator(".page-scroll-host .gx-root").locator(traspaso?".gx-gris-it":"button.v4-mov").filter({hasText:nombre});
    if(traspaso) await page.locator('.page-scroll-host .gx-root .gx-gris[data-gris="traspaso"] .gx-gris-h').click();
    const row=fila("Traspaso sintético");
    await row.click();
    const concept=page.locator("input.v4-ficha-concept");
    await expect(concept).toBeVisible();
    await concept.fill("Traspaso renombrado");
    await concept.blur();
    await expect.poll(async()=> (await stored()).row.merchant).toBe("Traspaso renombrado");
    const saved=await stored();
    await info.attach("rename-offline-saved",{body:JSON.stringify({before,saved}),contentType:"application/json"});
    expect(saved.row.category).toBe(fixture.category);
    expect(Math.round(saved.row.amount*100)).toBe(Math.round(fixture.amount*100));
    expect(saved.row.obName).toBe("Nombre bancario");
    expect(saved.row.note).toBe("Nota intacta");
    expect(saved.visible).toBe(true);
    await enter();
    const reloaded=await stored();
    expect(reloaded.row).toEqual(saved.row);
    expect(reloaded.visible).toBe(true);
    const renamed=fila("Traspaso renombrado");
    await expect(renamed).toHaveCount(1);
    const label=await page.evaluate(category=>catName(category),fixture.category);
    if(!traspaso) await expect(renamed.locator(".nm-cat")).toHaveText(label);
  });
