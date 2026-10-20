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
for(const partial of [false,true])for(const reverse of [false,true])test("C compra y devolucion visibles: partial="+partial+" reverse="+reverse,async({page})=>{
 await installFixtureClock(page);
 const purchase={id:"c-buy",user_id:"user",fecha:"2026-09-25T10:00:00Z",importe:12.34,comercio:"Compra sintetica C",cat:"otros",source:"ob:caixabank#refrefund-c"};
 const refund={...purchase,id:"c-refund",importe:partial?-2.34:-12.34,comercio:"Devolucion sintetica C"};
 await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:"cx",ent:"caixabank",name:"Cuenta sintetica",role:"diario",spendFrom:true,value:1000}],expenses:[],fixed:[],debts:[],oneoffs:[],goals:[],budget:1000,settings:{gTotalMode:"net",autoPrices:false,theme:"green",expenseBanks:["caixabank"]},__cloudRows:{expenses:reverse?[refund,purchase]:[purchase,refund]}});
 await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
 await page.waitForFunction(()=>!document.getElementById("mc-load"));
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").length)).toBe(2);
 const check=async()=>{
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const rows=page.locator(".v4-gastos-list-body button.v4-mov");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({hasText:"Compra sintetica C"})).toContainText("12,34");
  await expect(rows.filter({hasText:"Devolucion sintetica C"})).toContainText(partial?"2,34":"12,34");
  await expect(page.locator(".v4-gastos-progress")).toHaveAttribute("aria-valuenow",partial?"10":"0");
 };
 await check();await page.reload();await dismissNews(page);await page.waitForFunction(()=>!document.getElementById("mc-load"));await check();
});
