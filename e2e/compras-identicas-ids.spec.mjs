import {test,expect} from "@playwright/test";
import fs from "node:fs";
import {transformSync} from "esbuild";
import {seedLoggedInDashboard,dismissNews,FIXTURE_NOW,installFixtureClock} from "./fixtures.mjs";

test.use({serviceWorkers:"block"});
test.beforeEach(async({page})=>installFixtureClock(page));
const mapper=fs.readFileSync(new URL("../supabase/functions/_shared/enablebanking.ts",import.meta.url),"utf8");
const E=await import("data:text/javascript;base64,"+Buffer.from(transformSync(mapper,{loader:"ts",format:"esm"}).code).toString("base64"));
const day=new Date(FIXTURE_NOW).toISOString().slice(0,10);
const tx=(id,named=true)=>E.mapTransaction({entry_reference:id,booking_date:day,value_date:day,status:"BOOK",transaction_amount:{amount:"9.99",currency:"EUR"},credit_debit_indicator:"DBIT",...(named?{creditor:{name:"Panaderia sintetica"}}:{})});
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]"));
const rows=page=>page.locator(".v4-gastos-list-body button.v4-mov");
async function open(page,transactions,{notice=false,cloud=[]}={}){
 const ent=notice?"trade_republic":"sabadell",aspsp=notice?"Trade Republic":"Banco Sabadell";
 await seedLoggedInDashboard(page,{
  accounts:[{id:"bank",ent,name:aspsp,role:"diario",spendFrom:true,value:1000}],
  settings:{autoPrices:false,theme:"green",expenseBanks:[ent]},hasBankLink:true,
  expenses:notice?[{id:"synthetic-notice",date:day+"T09:00:00Z",amount:9.99,merchant:"Compra aviso",category:"otros",source:"macrodroid",ent}]:[],
  __cloudRows:{bank_links:[{aspsp_name:aspsp,aspsp_country:"ES",status:"active",valid_until:"2027-01-01T00:00:00Z",last_sync:FIXTURE_NOW,accounts:[{uid:"synthetic-account"}]}],expenses:cloud},
  __cloudFns:{"bank-sync":{data:{ok:true,links:[{aspsp,ok:true,syncFrom:"2026-01-01",accounts:[{uid:"synthetic-account",ok:true,balances:[],transactions}]}]},error:null}},
 });
 await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
 await page.waitForFunction(()=>!document.getElementById("mc-load"));
 expect(await page.evaluate(()=>typeof expenseBankIdOrdinals)).toBe("function");
}
async function sync(page){await page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-bank-role-changed")));}
async function gastos(page){await page.locator('.botnav-tab[data-tour="gastos"]').click();await expect(page.locator('.botnav-tab[data-tour="gastos"]')).toHaveClass(/active/);}

test("dos referencias distintas se pintan en Gastos y la segunda sync no duplica",async({page})=>{
 await open(page,[tx("a"),tx("b"),tx("a")]);await sync(page);
 await expect.poll(async()=> (await saved(page)).length).toBe(2);await gastos(page);
 await expect(rows(page).filter({hasText:"Panaderia sintetica"})).toHaveCount(2);
 const first=await saved(page);expect(first.map(e=>e.extId).sort()).toEqual(["a","b"]);
 expect(new Set(first.map(e=>e.date)).size).toBe(2);
 await sync(page);await expect.poll(async()=> (await saved(page)).length).toBe(2);
 await page.reload();await dismissNews(page);await page.waitForFunction(()=>!document.getElementById("mc-load"));await gastos(page);
 await expect(rows(page).filter({hasText:"Panaderia sintetica"})).toHaveCount(2);
});

test("mismo ID repetido y alias sin ID conservan un único cargo",async({page})=>{
 await open(page,[tx("a"),tx("a"),tx(null)]);await sync(page);
 await expect.poll(async()=> (await saved(page)).length).toBe(1);await gastos(page);
 await expect(rows(page).filter({hasText:"Panaderia sintetica"})).toHaveCount(1);
});

test("un aviso sin ID empareja sólo uno de dos cargos y el otro se ve contando",async({page})=>{
 await open(page,[tx("a",false),tx("b",false)],{notice:true});await sync(page);
 await expect.poll(async()=> (await saved(page)).length).toBe(3);await gastos(page);
 await expect(rows(page)).toHaveCount(3);await expect(rows(page).filter({hasText:"Compra aviso"})).toHaveCount(1);
 const values=await saved(page);expect(values.filter(e=>e.possibleDup)).toHaveLength(1);
 expect(values.filter(e=>!e.possibleDup).reduce((sum,e)=>sum+Math.round(e.amount*100),0)).toBe(1998);
 await expect(rows(page).filter({hasText:"Movimiento"})).toHaveCount(2);
});
