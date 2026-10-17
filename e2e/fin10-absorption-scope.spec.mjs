import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews,FIXTURE_NOW,installFixtureClock} from "./fixtures.mjs";

for(const kind of ["account","day","absorbed"])test("FIN10 Gastos tras absorcion: "+kind,async({page})=>{
 await installFixtureClock(page);
 const day=n=>new Date(FIXTURE_NOW-n*86400000).toISOString().slice(0,10);
 const base={source:"ob",ent:"caixabank",extId:"reused-ref",obOrd:2,amount:3.20,category:"otros",date:day(2)+"T12:00:00.001Z",obAcc:"synthetic-account-a"};
 // La absorbida ya se retiró del estado. Sembrar las tres juntas ejercitaría la
 // deduplicación general por referencia antes del filtro que estamos verificando.
 const name=kind==="account"?"Compra cuenta B":kind==="day"?"Compra otro dia":"Absorbida propia";
 const expenses=[{...base,id:"candidate",merchant:name,obName:name,...(kind==="account"?{obAcc:"synthetic-account-b"}:kind==="day"?{date:day(1)+"T12:00:00.001Z"}:{})}];
 await seedLoggedInDashboard(page,{accounts:[{id:"cx",ent:"caixabank",role:"diario",spendFrom:true,value:1000}],settings:{autoPrices:false,theme:"green",expenseBanks:["caixabank"]},expenses,deleted:["ob-absorbed2|caixabank|reused-ref|2|synthetic-account-a|"+day(2)],budget:1000});
 await page.goto("/");await dismissNews(page);
 await expect(page.locator(".botnav")).toBeVisible();
 await page.locator('.botnav-tab[data-tour="gastos"]').click();
 const rows=page.locator(".v4-gastos-list-body button.v4-mov");
 await expect(rows.filter({hasText:name})).toHaveCount(kind==="absorbed"?0:1);
 await expect(rows).toHaveCount(kind==="absorbed"?0:1);
});
