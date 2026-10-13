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
