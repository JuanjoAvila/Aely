import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews,FIXTURE_NOW,installFixtureClock} from "./fixtures.mjs";
import fs from "node:fs";
import crypto from "node:crypto";

test.use({serviceWorkers:"block",timezoneId:"Europe/Madrid"});
test.beforeAll(async({request})=>{
 const response=await request.get("/");expect(response.ok()).toBe(true);
 const hash=data=>crypto.createHash("sha256").update(data).digest("hex");
 expect(hash(await response.body())).toBe(hash(fs.readFileSync(new URL("../public/index.html",import.meta.url))));
});
const pending={id:"fin15-p",user_id:"user",fecha:"2026-09-24T21:59:00Z",importe:3.2,comercio:"Compra sintetica FIN15",cat:"otros",source:"ob:caixabank#refstable-ref#pdng"};
const booked={...pending,id:"fin15-b",fecha:"2026-09-25T10:00:00Z",source:"ob:caixabank#refstable-ref"};
for(const reverse of [false,true])test("FIN15 nube cruza dia Madrid: una compra visible, orden "+reverse,async({page})=>{
 await installFixtureClock(page);
 await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:"cx",ent:"caixabank",name:"Cuenta sintetica",role:"diario",spendFrom:true,value:1000}],expenses:[],fixed:[],debts:[],oneoffs:[],goals:[],budget:1000,settings:{autoPrices:false,theme:"green",expenseBanks:["caixabank"]},__cloudRows:{expenses:reverse?[booked,pending]:[pending,booked]}});
 await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
 await page.waitForFunction(()=>!document.getElementById("mc-load"));
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").length)).toBe(1);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();
 const rows=page.locator(".v4-gastos-list-body button.v4-mov").filter({hasText:"Compra sintetica FIN15"});
 await expect(rows).toHaveCount(1);await expect(rows).toContainText("3,20");
 await page.reload();await dismissNews(page);await page.waitForFunction(()=>!document.getElementById("mc-load"));
 await page.locator('.botnav-tab[data-tour="gastos"]').click();await expect(rows).toHaveCount(1);
});

// Cobertura DOM de absorción FIN10 portada de la candidata congelada 8eb.
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
