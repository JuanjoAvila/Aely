import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews,installFixtureClock} from "./fixtures.mjs";
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
