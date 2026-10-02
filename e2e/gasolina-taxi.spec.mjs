import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

const labels={es:{gasolina:"Gasolina",taxi:"Taxi",transporte:"Transporte"},en:{gasolina:"Fuel",taxi:"Taxi",transporte:"Transport"},ca:{gasolina:"Benzina",taxi:"Taxi",transporte:"Transport"}};
const accounts=[{id:"mobility",ent:"trade_republic",name:"Diario",value:2000,role:"diario",spendFrom:true}];
const settings=lang=>({lang,autoPrices:false,aiCat:false,expenseBanks:["trade_republic"],gTotalMode:"split"});
async function open(page){
  await page.goto("/"); await expect(page.locator(".botnav")).toBeVisible(); await dismissNews(page);
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
}
async function entry(page,merchant,category,amount){
  await page.locator(".botnav-fab").click();
  const sheet=page.locator(".v4-exp-sheet");
  await sheet.locator(".v4-exp-name").fill(merchant);
  await expect(sheet.locator('[data-testid="ap-cat-'+category+'"]').first()).toHaveAttribute("aria-pressed","true");
  for(const digit of String(amount)) await sheet.locator(".v4-keys").getByRole("button",{name:digit,exact:true}).click();
  await sheet.locator(".v4-cta").click(); await expect(sheet).toHaveCount(0);
}
for(const lang of ["es","en","ca"]){
  test(lang+": altas, selector y clasificación conservadora en DOM",async({page})=>{
    await installFixtureClock(page);
    await seedLoggedInDashboard(page,{accounts,settings:settings(lang),expenses:[],budget:500,__seedOnce:true});
    await open(page);
    await page.locator(".botnav-fab").click();
    await page.locator(".v4-exp-sheet .v4-ficha-cat-title button").click();
    const cats=page.locator(".v4-ficha-cat-sheet");
    await expect(cats.locator('[data-testid="expense-all-cat-gasolina"]')).toContainText(labels[lang].gasolina);
    await expect(cats.locator('[data-testid="expense-all-cat-gasolina"] .v4-ficha-cat-icon')).toHaveText("⛽");
    await expect(cats.locator('[data-testid="expense-all-cat-taxi"]')).toContainText(labels[lang].taxi);
    await expect(cats.locator('[data-testid="expense-all-cat-taxi"] .v4-ficha-cat-icon')).toHaveText("🚕");
    await cats.locator('[data-testid="expense-all-cat-taxi"]').click();
    await expect(cats).toHaveCount(0);
    // Una elección expresa no se mueve aunque el concepto tenga una sugerencia distinta.
    const sheet=page.locator(".v4-exp-sheet");
    await sheet.locator(".v4-exp-name").fill("Gasolinera elegida como taxi");
    // Dejar vencer la sugerencia de400ms: comprobar antes ocultaría una elección pisada después.
    await page.waitForTimeout(650);
    await expect(sheet.locator('[data-testid="ap-cat-taxi"]')).toHaveAttribute("aria-pressed","true");
    await sheet.locator(".v4-keys").getByRole("button",{name:"5",exact:true}).click();
    await sheet.locator(".v4-cta").click(); await expect(sheet).toHaveCount(0);
    await entry(page,"Gasolinera Norte","gasolina",30);
    await entry(page,"Taxi Barcelona","taxi",10);
    await entry(page,"Repsol Luz","luz",8);
    await entry(page,"Uber Eats","bares",12);
    await entry(page,"Repsol","transporte",7);
    await entry(page,"Repsol recarga electrica","transporte",6);
    await entry(page,"UBER *EATS","bares",9);
    await expect.poll(()=>page.evaluate(()=>mcLoadRaw("micartera_v3").expenses.length)).toBe(8);
    const saved=await page.evaluate(()=>mcLoadRaw("micartera_v3").expenses.map(e=>[e.merchant,e.category,e.amount]));
    expect(saved).toEqual(expect.arrayContaining([["Gasolinera Norte","gasolina",30],["Taxi Barcelona","taxi",10],["Repsol Luz","luz",8],["Uber Eats","bares",12],["Repsol","transporte",7],["Repsol recarga electrica","transporte",6],["UBER *EATS","bares",9],["Gasolinera elegida como taxi","taxi",5]]));
    await page.reload(); await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await expect(page.locator('.v4-gastos-cat[data-cat="gasolina"]')).toContainText(labels[lang].gasolina);
    await expect(page.locator('.v4-gastos-cat[data-cat="taxi"]')).toContainText(labels[lang].taxi);
  });
  test(lang+": filtros y límites independientes conservan histórico al reiniciar",async({page})=>{
    await installFixtureClock(page);
    const expenses=[
      {id:"fuel",merchant:"Gasolinera Norte",category:"gasolina",amount:30,date:"2026-09-23T12:00:00Z",source:"manual",ent:"trade_republic"},
      {id:"taxi",merchant:"Taxi nuevo",category:"taxi",amount:10,date:"2026-09-22T12:00:00Z",source:"manual",ent:"trade_republic"},
      {id:"old",merchant:"Taxi anterior",category:"transporte",amount:7,date:"2026-09-21T12:00:00Z",source:"bank",ent:"trade_republic"},
      {id:"unknown",merchant:"Gasolinera Norte anterior",category:"otros",amount:13,date:"2026-09-20T12:00:00Z",source:"bank",ent:"trade_republic"}];
    await seedLoggedInDashboard(page,{accounts,settings:settings(lang),expenses,budget:500,categoryBudgets:{gasolina:100,taxi:50,transporte:90},__seedOnce:true});
    await open(page); await page.locator('.botnav-tab[data-tour="gastos"]').click();
    const head=page.locator('.v4-gastos-progress[role="progressbar"]');
    await expect(head).toHaveAttribute("aria-valuenow","60");
    for(const [cat,spent,limit] of [["gasolina",30,100],["taxi",10,50],["transporte",7,90]]){
      const row=page.locator('.v4-gastos-cat[data-cat="'+cat+'"]');
      await expect(row).toContainText(labels[lang][cat]);
      await expect(row.locator('[role="progressbar"]')).toHaveAttribute("aria-valuenow",String(spent));
      await expect(row.locator('[role="progressbar"]')).toHaveAttribute("aria-valuemax",String(limit));
    }
    await page.locator('.v4-gastos-cat[data-cat="gasolina"]').click();
    await page.locator(".chip",{hasText:"200 €"}).click();
    await page.locator(".btn-primary",{hasText:/Guardar|Save|Desa/}).click();
    await expect(page.locator('.v4-gastos-cat[data-cat="gasolina"] [role="progressbar"]')).toHaveAttribute("aria-valuemax","200");
    for(const [cat,merchant] of [["gasolina","Gasolinera Norte"],["taxi","Taxi nuevo"],["transporte","Taxi anterior"]]){
      await page.locator('.filters button[title]').click();
      await page.locator(".v4-filter-cats-toggle").click();
      await page.locator('.v4-ficha-cat-title button').filter({hasText:/Todas|All|Totes/}).click();
      await page.locator('[data-testid="gastos-filter-cat-'+cat+'"]').click();
      await page.locator('.v4-gastos-filter-sheet .btn-primary').click();
      await expect(page.locator(".v4-gastos-list-body button.v4-mov")).toHaveCount(1);
      await expect(page.locator(".v4-gastos-list-body button.v4-mov")).toContainText(merchant);
    }
    await expect.poll(()=>page.evaluate(()=>mcLoadRaw("micartera_v3").categoryBudgets.gasolina)).toBe(200);
    await page.reload(); await dismissNews(page); await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await expect(page.locator('.v4-gastos-cat[data-cat="gasolina"] [role="progressbar"]')).toHaveAttribute("aria-valuemax","200");
    expect(await page.evaluate(()=>mcLoadRaw("micartera_v3").categoryBudgets)).toEqual({gasolina:200,taxi:50,transporte:90});
    expect(await page.evaluate(()=>mcLoadRaw("micartera_v3").expenses.find(e=>e.id==="old").category)).toBe("transporte");
    expect(await page.evaluate(()=>mcLoadRaw("micartera_v3").expenses.find(e=>e.id==="unknown").category)).toBe("otros");
  });
}
