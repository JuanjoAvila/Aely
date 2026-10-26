import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

// «Coche» (mantenimiento del vehículo): sale en la lista completa de categorías en los tres
// idiomas y «Taller Pepe» la sugiere sola al apuntar.
const accounts=[{id:"coche",ent:"trade_republic",name:"Diario",value:2000,role:"diario",spendFrom:true}];
const label={es:"Coche",en:"Car",ca:"Cotxe"};
for(const lang of ["es","en","ca"]){
  test(lang+": la categoría Coche está en la lista y se sugiere para «Taller Pepe»",async({page})=>{
    await installFixtureClock(page);
    await seedLoggedInDashboard(page,{accounts,settings:{lang,autoPrices:false,aiCat:false,expenseBanks:["trade_republic"],gTotalMode:"split"},expenses:[],budget:500,__seedOnce:true});
    await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await page.locator(".botnav-fab").click();
    const sheet=page.locator(".v4-exp-sheet");
    await sheet.locator(".v4-ficha-cat-title button").click();
    const item=page.locator('.v4-ficha-cat-sheet [data-testid="expense-all-cat-coche"]');
    await expect(item).toContainText(label[lang]);
    await expect(item.locator(".v4-ficha-cat-icon")).toHaveText("🚗");
    await item.click();
    await sheet.locator(".v4-exp-name").fill("Taller Pepe");
    await page.waitForTimeout(650);
    await expect(sheet.locator('[data-testid="ap-cat-coche"]').first()).toHaveAttribute("aria-pressed","true");
  });
}
