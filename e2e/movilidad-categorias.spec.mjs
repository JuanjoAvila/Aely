import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

const labels={es:{multas:"Multas",zona_azul:"Zona azul",peajes:"Peajes"},en:{multas:"Fines",zona_azul:"Blue zone",peajes:"Tolls"},ca:{multas:"Multes",zona_azul:"Zona blava",peajes:"Peatges"}};
const entries=[["multas","Multa DGT",40,"🚨"],["zona_azul","Zona azul",6,"🅿️"],["peajes","Peaje AP7",8,"🛣️"]];
const accounts=[{id:"mobility",ent:"trade_republic",name:"Diario",value:2000,role:"diario",spendFrom:true}];
const settings=lang=>({lang,autoPrices:false,aiCat:false,expenseBanks:["trade_republic"],gTotalMode:"split"});
async function open(page){
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
}
async function record(page,merchant,category,amount,manual=false){
  await page.locator(".botnav-fab").click();const sheet=page.locator(".v4-exp-sheet");
  if(manual){
    await sheet.locator(".v4-ficha-cat-title button").click();
    await page.locator('[data-testid="expense-all-cat-'+category+'"]').click();
  }
  await sheet.locator(".v4-exp-name").fill(merchant);
  // Esperar la sugerencia evita que una elección manual aparentemente correcta se pise tarde.
  if(manual) await page.waitForTimeout(650);
  await expect(sheet.locator('[data-testid="ap-cat-'+category+'"]').first()).toHaveAttribute("aria-pressed","true");
  for(const digit of String(amount))await sheet.locator(".v4-keys").getByRole("button",{name:digit,exact:true}).click();
  await sheet.locator(".v4-cta").click();await expect(sheet).toHaveCount(0);
}
for(const lang of ["es","en","ca"]){
  test(lang+": selector, iconos, altas y elección manual en DOM real",async({page})=>{
    await installFixtureClock(page);await seedLoggedInDashboard(page,{accounts,settings:settings(lang),expenses:[],budget:500,__seedOnce:true});
    await open(page);await page.locator(".botnav-fab").click();
    await page.locator(".v4-exp-sheet .v4-ficha-cat-title button").click();
    const cats=page.locator(".v4-ficha-cat-sheet");
    for(const [cat,, ,icon] of entries){
      await expect(cats.locator('[data-testid="expense-all-cat-'+cat+'"]')).toContainText(labels[lang][cat]);
      await expect(cats.locator('[data-testid="expense-all-cat-'+cat+'"] .v4-ficha-cat-icon')).toHaveText(icon);
    }
    for(const cat of ["taxi","gasolina","parking","transporte","tasas"])await expect(cats.locator('[data-testid="expense-all-cat-'+cat+'"]')).toHaveCount(1);
    await cats.locator('[data-testid="expense-all-cat-multas"]').click();
    const sheet=page.locator(".v4-exp-sheet");await sheet.locator(".v4-exp-name").fill("Zona azul elegida como multa");
    await page.waitForTimeout(650);await expect(sheet.locator('[data-testid="ap-cat-multas"]')).toHaveAttribute("aria-pressed","true");
    await sheet.locator(".v4-keys").getByRole("button",{name:"5",exact:true}).click();await sheet.locator(".v4-cta").click();await expect(sheet).toHaveCount(0);
    for(const [cat,merchant,amount] of entries)await record(page,merchant,cat,amount);
    await record(page,"Peaje elegido como zona azul","zona_azul",2,true);
    await record(page,"Multa elegida como peaje","peajes",3,true);
    await record(page,"Uber Eats","bares",12);await record(page,"Repsol Luz","luz",9);await record(page,"Metro TMB","transporte",7);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    const rows=page.locator(".v4-gastos-list-body button.v4-mov");await expect(rows).toHaveCount(9);
    for(const [cat,merchant] of entries)await expect(rows.filter({hasText:merchant}).locator(".nm-cat")).toContainText(labels[lang][cat]);
    const saved=await page.evaluate(()=>mcLoadRaw("micartera_v3").expenses.map(e=>[e.merchant,e.category,e.amount]));
    expect(saved).toEqual(expect.arrayContaining([["Zona azul elegida como multa","multas",5],["Peaje elegido como zona azul","zona_azul",2],["Multa elegida como peaje","peajes",3]]));
  });
  test(lang+": filtros, edición y límites independientes persisten offline sin recategorizar",async({page,context})=>{
    await installFixtureClock(page);
    const expenses=entries.map(([category,merchant,amount])=>({id:category,merchant,category,amount,date:"2026-09-23T12:00:00Z",source:"manual",ent:"trade_republic"})).concat([
      {id:"oldfine",merchant:"Multa antigua",category:"tasas",amount:11,date:"2026-09-22T12:00:00Z",source:"bank",ent:"trade_republic"},
      {id:"oldzone",merchant:"Zona azul antigua",category:"parking",amount:3,date:"2026-09-21T12:00:00Z",source:"bank",ent:"trade_republic"},
      {id:"oldtoll",merchant:"Peaje antiguo",category:"transporte",amount:7,date:"2026-09-20T12:00:00Z",source:"bank",ent:"trade_republic"}]);
    const budgets={multas:100,zona_azul:20,peajes:50,tasas:60,parking:30,transporte:90};
    await seedLoggedInDashboard(page,{accounts,settings:settings(lang),expenses,budget:500,categoryBudgets:budgets,__seedOnce:true});
    await open(page);await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await expect(page.locator('.v4-gastos-progress[role="progressbar"]')).toHaveAttribute("aria-valuenow","75");
    for(const [cat,,spent] of entries){
      const row=page.locator('.v4-gastos-cat[data-cat="'+cat+'"]');await expect(row).toContainText(labels[lang][cat]);
      await expect(row.locator('[role="progressbar"]')).toHaveAttribute("aria-valuenow",String(spent));
      await expect(row.locator('[role="progressbar"]')).toHaveAttribute("aria-valuemax",String(budgets[cat]));
      await row.click();await page.locator(".chip",{hasText:"200 €"}).click();
      await page.locator(".btn-primary",{hasText:/Guardar|Save|Desa/}).click();
      await expect(row.locator('[role="progressbar"]')).toHaveAttribute("aria-valuemax","200");
    }
    for(const [cat,merchant] of entries){
      await page.locator('.filters button[title]').click();await page.locator(".v4-filter-cats-toggle").click();
      await page.locator('.v4-ficha-cat-title button').filter({hasText:/Todas|All|Totes/}).click();
      await page.locator('[data-testid="gastos-filter-cat-'+cat+'"]').click();await page.locator('.v4-gastos-filter-sheet .btn-primary').click();
      await expect(page.locator(".v4-gastos-list-body button.v4-mov")).toHaveCount(1);
      await expect(page.locator(".v4-gastos-list-body button.v4-mov")).toContainText(merchant);
    }
    // La ficha y Apuntar usan el mismo catálogo; corregir solo esta fila no cambia otras.
    await page.locator(".v4-gastos-list-body button.v4-mov").click();
    await page.locator('.v4-ficha-cat-title button').filter({hasText:/Todas|All|Totes/}).click();
    await page.locator('[data-testid="expense-all-cat-zona_azul"]').click();
    await expect.poll(()=>page.evaluate(()=>mcLoadRaw("micartera_v3").expenses.find(e=>e.id==="peajes").category)).toBe("zona_azul");
    // El SW sirve el mismo artefacto offline; esperar control impide confundir una caída de red con la app.
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true);await page.reload();await dismissNews(page);await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await expect(page.locator('.v4-gastos-progress[role="progressbar"]')).toHaveAttribute("aria-valuenow","75");
    for(const cat of ["multas","zona_azul"])await expect(page.locator('.v4-gastos-cat[data-cat="'+cat+'"]')).toContainText(labels[lang][cat]);
    expect(await page.evaluate(()=>mcLoadRaw("micartera_v3").categoryBudgets)).toEqual({...budgets,multas:200,zona_azul:200,peajes:200});
    const saved=await page.evaluate(()=>mcLoadRaw("micartera_v3").expenses.map(e=>[e.id,e.category]));
    expect(saved).toEqual(expect.arrayContaining([["oldfine","tasas"],["oldzone","parking"],["oldtoll","transporte"],["peajes","zona_azul"]]));
    await context.setOffline(false);
  });
  test(lang+": pull y reentrada reales conservan categorías explícitas de otro cliente",async({page})=>{
    await installFixtureClock(page);await seedLoggedInDashboard(page,{accounts,settings:settings(lang),expenses:[],budget:500,__seedOnce:true});
    await open(page);await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await page.evaluate(()=>{
      window.__e2eCloudRows.expenses=["multas","zona_azul","peajes"].map((cat,i)=>({id:"550e8400-e29b-41d4-a716-44665544000"+i,fecha:"2026-09-23T12:00:00Z",importe:[40,6,8][i],comercio:"Comercio ambiguo "+i,cat,source:"manual:trade_republic"}));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const rows=page.locator(".v4-gastos-list-body button.v4-mov");await expect(rows).toHaveCount(3);
    for(const [i,cat] of ["multas","zona_azul","peajes"].entries())await expect(rows.filter({hasText:"Comercio ambiguo "+i}).locator(".nm-cat")).toContainText(labels[lang][cat]);
    await expect(page.locator('.v4-gastos-progress[role="progressbar"]')).toHaveAttribute("aria-valuenow","54");
    await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));await expect(rows).toHaveCount(3);
    await page.reload();await dismissNews(page);await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await expect(rows).toHaveCount(3);await expect(page.locator('.v4-gastos-progress[role="progressbar"]')).toHaveAttribute("aria-valuenow","54");
  });
}
