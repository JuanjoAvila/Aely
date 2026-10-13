import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, FIXTURE_NOW, installFixtureClock } from "./fixtures.mjs";
const day=new Date(FIXTURE_NOW).toISOString().slice(0,10);
const notice={id:"a1000000-0000-4000-8000-000000000001",date:day+"T08:00:00Z",merchant:"Compra sintética",amount:12,category:"otros",source:"macrodroid",ent:"trade_republic"};
const bank={id:"b1000000-0000-4000-8000-000000000001",date:day+"T12:00:00Z",merchant:"Movimiento",amount:12,category:"otros",source:"ob",ent:"trade_republic",possibleDup:true,possibleDupOf:notice.id};
const rows=page=>page.locator(".v4-gastos-list-body button.v4-mov");
async function open(page,manual=false){
  await installFixtureClock(page);
  await seedLoggedInDashboard(page,{
    __seedOnce:true,
    accounts:[{id:"tr",ent:"trade_republic",role:"diario",value:900}],
    settings:{autoPrices:false,theme:"green",expenseBanks:["trade_republic"]},
    expenses:[Object.assign({},notice,manual?{source:"manual"}:{}),bank],gemelos:[],
  });
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
}
test("migra al abrir: una fila sin pregunta; separar muestra ambas y sobrevive al reinicio",async({page})=>{
  await open(page);
  await expect(rows(page)).toHaveCount(1);
  await rows(page).filter({hasText:"Compra sintética"}).click();
  await expect(page.getByTestId("exp-auto-paired")).toBeVisible();
  await expect(page.getByRole("button",{name:/^Es el mismo$/})).toHaveCount(0);
  await page.getByTestId("exp-auto-separate").click();
  await expect(rows(page)).toHaveCount(2);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")||"{}").gemelos?.some(g=>g.separado))).toBe(true);
  await page.reload();await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(rows(page)).toHaveCount(2);
});
test("un gasto manual conserva la pregunta en su ficha bancaria",async({page})=>{
  await open(page,true);await expect(rows(page)).toHaveCount(2);
  await rows(page).filter({hasText:"Movimiento"}).click();
  await expect(page.getByRole("button",{name:/^Es el mismo$/})).toBeVisible();
  await expect(page.getByTestId("exp-auto-separate")).toHaveCount(0);
});

const links=[{aspsp_name:"Trade Republic",aspsp_country:"DE",status:"active",valid_until:"2027-01-01T00:00:00Z",accounts:[{uid:"tr-e2e"}]}];
const response=n=>({data:{ok:true,links:[{aspsp:"Trade Republic",ok:true,accounts:[{uid:"tr-e2e",ok:true,balances:[],transactions:Array.from({length:n},()=>({date:day,amount:12,merchant:"Movimiento",status:"BOOK"}))}]}]},error:null});
async function bankApp(page,expenses,n){
 await installFixtureClock(page);
 await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:"tr",ent:"trade_republic",role:"diario",value:900}],settings:{autoPrices:false,theme:"green",expenseBanks:["trade_republic"]},hasBankLink:true,expenses,gemelos:[],__cloudRows:{bank_links:links},__cloudFns:{"bank-sync":response(n)}});
 await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
 await page.evaluate(()=>{
   window.__pairWrites=[];
   const add=cloud.addExpense;cloud.addExpense=function(e){window.__pairWrites.push({kind:"add",id:e.id,source:expenseSourceForCloud(e)});return add.call(cloud,e);};
   const dup=cloud.setExpenseDup;cloud.setExpenseDup=function(e,value){window.__pairWrites.push({kind:"dup",id:e.id,value});return dup.call(cloud,e,value);};
 });
}
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]"));
const syncBank=page=>page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-bank-role-changed")));
test("sync real une el aviso, sube #dup y separar/volver a unir escribe la decision",async({page})=>{
 await bankApp(page,[notice],2);await syncBank(page);
 await expect.poll(async()=>(await saved(page)).length).toBe(3);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();await expect(rows(page)).toHaveCount(2);
 await expect.poll(()=>page.evaluate(()=>window.__pairWrites.filter(x=>x.kind==="add"&&x.source.includes("#dup")).length)).toBe(1);
 await rows(page).filter({hasText:"Compra sintética"}).click();await expect(page.getByTestId("exp-auto-paired")).toBeVisible();
 await expect(page.getByRole("button",{name:/^Es el mismo$/})).toHaveCount(0);
 await page.getByTestId("exp-auto-separate").click();await expect(rows(page)).toHaveCount(3);
 await expect.poll(()=>page.evaluate(()=>window.__pairWrites.some(x=>x.kind==="dup"&&x.value===false))).toBe(true);
 await rows(page).filter({hasText:"Compra sintética"}).click();await page.getByTestId("exp-auto-rejoin").click();await expect(rows(page)).toHaveCount(2);
 await expect.poll(()=>page.evaluate(()=>window.__pairWrites.some(x=>x.kind==="dup"&&x.value===true))).toBe(true);
 await syncBank(page);await expect.poll(async()=>(await saved(page)).length).toBe(3);await expect(rows(page)).toHaveCount(2);
});
test("pull real empareja aviso tardio y repara la marca bancaria en nube",async({page})=>{
 await bankApp(page,[],1);await syncBank(page);await expect.poll(async()=>(await saved(page)).length).toBe(1);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();await expect(rows(page)).toHaveCount(1);
 await page.evaluate(n=>{
   const b=JSON.parse(localStorage.getItem("micartera_v3_exp"))[0];
   window.__e2eCloudRows.expenses=[{id:b.id,fecha:b.date,importe:b.amount,comercio:b.merchant,source:expenseSourceForCloud(b),cat:b.category,ob_name:b.obName},{id:n.id,fecha:n.date,importe:n.amount,comercio:n.merchant,source:"macrodroid",cat:"otros"}];
   document.dispatchEvent(new Event("visibilitychange"));
 },notice);
 await expect.poll(async()=>(await saved(page)).filter(e=>e.autoGemelo).length).toBe(1);
 await expect(rows(page)).toHaveCount(1);await expect(rows(page)).toContainText("Compra sintética");
 await expect.poll(()=>page.evaluate(()=>window.__pairWrites.some(x=>x.kind==="dup"&&x.value===true))).toBe(true);
});
test("borrar la pareja explica ambas filas y Deshacer restaura ambas",async({page})=>{
 await open(page);await rows(page).first().click();
 await page.getByRole("button",{name:/borrar/i}).last().click();
 await expect(page.getByText("Aviso y apunte del banco borrados")).toBeVisible();
 await expect.poll(async()=>(await saved(page)).length).toBe(0);
 await page.getByRole("button",{name:/^Deshacer$/}).click();await expect(rows(page)).toHaveCount(1);
 await expect.poll(async()=>(await saved(page)).length).toBe(2);
});
