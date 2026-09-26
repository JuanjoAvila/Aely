import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { transformSync } from "esbuild";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// Respuesta generada por el mapper real y petición explícita al sincronizador del navegador.
// Un test que siembre directamente la categoría no vería si flattenBankTx tira las pistas.
const src=fs.readFileSync(new URL("../supabase/functions/_shared/enablebanking.ts",import.meta.url),"utf8");
const E=await import("data:text/javascript;base64,"+Buffer.from(transformSync(src,{loader:"ts",format:"esm"}).code).toString("base64"));
test("TR: Movimiento se clasifica por información bancaria y conserva el histórico renombrado",async({page})=>{
  const date=new Date().toISOString().slice(0,10);
  const raw=(amount,extra={})=>E.mapTransaction({booking_date:date,transaction_amount:{amount:String(amount)},credit_debit_indicator:"DBIT",creditor:{name:"Movimiento"},bank_transaction_code:{description:"Card payment"},...extra});
  const transactions=[raw(12.5,{merchant_category_code:"5411"}),raw(7.25,{remittance_information:["Panadería ficticia"]}),raw(18.09,{merchant_category_code:"5411",remittance_information:["Mercadona"]}),raw(9.01),raw(24.76,{remittance_information:["Transferencia pago alquiler día 5"]})];
  await seedLoggedInDashboard(page,{
    accounts:[{id:"tr",ent:"trade_republic",name:"Trade Republic",role:"diario",value:900}],
    settings:{autoPrices:false,theme:"green",expenseBanks:["trade_republic"]},hasBankLink:true,
    expenses:[{id:"old",date:date+"T12:00:00.000Z",amount:18.09,merchant:"Nombre propio",obName:"Movimiento",category:"compras",source:"ob",ent:"trade_republic"}],
    __cloudFns:{"bank-sync":{data:{ok:true,links:[{aspsp:"Trade Republic",ok:true,accounts:[{uid:"synthetic",ok:true,balances:[],transactions}]}]},error:null}}
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:15000});
  await dismissNews(page);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-bank-role-changed")));
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").length),{timeout:15000}).toBe(5);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const rows=page.locator(".v4-gastos-list-body button.v4-mov");
  await expect(rows.filter({hasText:"12,50"}).locator(".nm-cat")).toContainText("Super");
  await expect(rows.filter({hasText:"7,25"}).locator(".nm-cat")).toContainText("Pan");
  await expect(rows.filter({hasText:"7,25"}).locator(".nm-note")).toContainText("Panadería ficticia");
  await expect(rows.filter({hasText:"9,01"}).locator(".nm-cat")).toContainText("Otros");
  await expect(rows.filter({hasText:"24,76"}).locator(".nm-cat")).toContainText("Otros");
  const old=rows.filter({hasText:"Nombre propio"});
  await expect(old).toHaveCount(1);await expect(old.locator(".nm-cat")).toContainText("Compras");
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-bank-role-changed")));
  await expect(rows).toHaveCount(5);
});
