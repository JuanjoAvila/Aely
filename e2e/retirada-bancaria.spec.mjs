import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const id="550e8400-e29b-41d4-a716-446655440000";
const expense={id,date:new Date().toISOString(),merchant:"Disposición oficina ficticia",amount:80,category:"otros",source:"ob",ent:"caixabank"};
async function open(page,lang="es",mode="ok",remoteCat="otros"){
  const remote={id,fecha:expense.date,comercio:expense.merchant,importe:80,cat:remoteCat,source:"ob:caixabank"};
  await seedLoggedInDashboard(page,{__seedOnce:true,expenses:[expense],__cloudRows:{expenses:[remote]},
    accounts:[{id:"caixa",ent:"caixabank",name:"Cuenta ficticia",value:920,bankIban:"fixture",role:"diario"}],
    settings:{lang,autoPrices:false,expenseBanks:["caixabank"],budgetCycle:false}});
  // Ejecuta el método real de cloud: este doble responde SELECT y UPDATE filtrados por fila.
  await page.addInitScript(({remote,mode})=>{
    const desc=Object.getOwnPropertyDescriptor(window,"supabase");
    window.__withdrawalFixture={mode,writes:0,row:JSON.parse(localStorage.getItem("_fixtureWithdrawal")||"null")||remote};
    Object.defineProperty(window,"supabase",{configurable:true,get(){
      const lib=desc.get();if(!lib)return lib;
      return {createClient(){const base=lib.createClient();
        return {...base,auth:{...base.auth,getSession:async()=>({data:{session:window.__withdrawalFixture.mode==="noSession"?null:{user:{id:"e2e-user"}}}})},
          from(table){if(table!=="expenses")return base.from(table);
            const filters=[];let patch=null,beforeId=null;const fixture=window.__withdrawalFixture;
            const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},limit(){return q;},lt(k,v){if(k==="id")beforeId=v;return q;},
              upsert(){return base.from(table).upsert();},update(p){patch=p;return q;},
              async maybeSingle(){return {data:fixture.mode==="wrongUuid"?null:structuredClone(fixture.row),error:null};},
              async then(resolve){
                if(!patch)return resolve({data:beforeId&&fixture.row.id>=beforeId?[]:[structuredClone(fixture.row)],error:null});
                fixture.writes++;
                if(fixture.mode==="timeout")return;
                await new Promise(r=>setTimeout(r,200));
                if(fixture.mode==="zero")return resolve({data:[],error:null});
                if(fixture.mode==="error")return resolve({data:null,error:new Error("denied")});
                if(filters.some(([k,v])=>k!=="user_id"&&fixture.row[k]!==v))return resolve({data:[],error:null});
                Object.assign(fixture.row,patch);localStorage.setItem("_fixtureWithdrawal",JSON.stringify(fixture.row));
                return resolve({data:[structuredClone(fixture.row)],error:null});
              }};return q;
          }};
      }};
    },set(value){desc.set(value);}});
  },{remote,mode});
  await page.goto("/");
  await dismissNews(page);
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  if(remoteCat==="traspaso"){
    const syncLabel=await page.evaluate(()=>t("g_sync"));
    await page.locator('.v4-screen:has(.v4-gastos-summary)').getByRole("button",{name:syncLabel,exact:true}).click();
    await expect(page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:expense.merchant})).toHaveClass(/v4-mov-skip/);
  }
  await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:expense.merchant}).click();
  return page.getByTestId("exp",{exact:true});
}

test("banco y tipo explican sus campos; Efectivo explica no operación y Traspaso pide confirmar",async({page})=>{
  const sheet=await open(page);
  const aviso="El banco fija el importe, la cuenta y si entra o sale dinero. La categoría sí se puede corregir aquí.";
  for(const door of [sheet.getByTestId("exp-bank"),sheet.locator('.v4-ficha-seg button').nth(1)]){
    await door.click();
    await expect(page.getByText(aviso,{exact:true})).toBeVisible();
  }
  await sheet.getByTestId("exp-efectivo").click();
  await expect(sheet.getByTestId("exp-withdrawal-info")).toContainText("no suma dinero a Efectivo");
  await sheet.locator('.v4-ficha-cat-title button').click();
  await page.getByTestId("expense-all-cat-traspaso").click();
  await page.locator('.askback .btn-primary').click();
  await expect(sheet.getByTestId("exp-cat-traspaso")).toHaveAttribute("aria-pressed","true");
  await expect(sheet.getByTestId("exp-bank")).toContainText("CaixaBank");
});

test("una retirada importada tiene una corrección neutra explícita",async({page})=>{
  const sheet=await open(page);
  await expect(sheet.getByTestId("exp-withdrawal")).toBeVisible();
});

const texts={
  es:{action:"Es una retirada de efectivo",neutral:"Traspaso: no cuenta como gasto.",pending:"Confirmando la retirada…",limit:"no suma dinero a Efectivo"},
  en:{action:"This is a cash withdrawal",neutral:"Transfer: does not count as spending.",pending:"Confirming the withdrawal…",limit:"does not add money to Cash"},
  ca:{action:"És una retirada d'efectiu",neutral:"Traspàs: no compta com a despesa.",pending:"Confirmant la retirada…",limit:"no suma diners a Efectiu"}
};
const stored=page=>page.evaluate(()=>({expenses:JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]"),state:JSON.parse(localStorage.getItem("micartera_v3")||"{}"),writes:window.__withdrawalFixture.writes}));
for(const lang of ["es","en","ca"])test(`cancelar, ACK, recarga y móvil B conservan la retirada (${lang})`,async({page,browser})=>{
  const sheet=await open(page,lang),txt=texts[lang];
  const action=sheet.getByTestId("exp-withdrawal");
  await expect(action).toHaveText(txt.action);
  const before=await stored(page);
  await expect(page.locator('.v4-gastos-progress[role="progressbar"]')).toHaveAttribute("aria-valuenow","80");
  await action.click();await page.locator('.askback .btn-ghost').click();
  expect((await stored(page)).writes).toBe(0);
  await expect(sheet.getByTestId("exp-cat-otros")).toHaveAttribute("aria-pressed","true");
  await action.click();await page.locator('.askback .btn-primary').click();
  await expect(action).toBeDisabled();
  await expect(sheet.getByTestId("exp-withdrawal-info")).toContainText(txt.pending);
  await expect(sheet.getByTestId("exp-withdrawal-neutral")).toHaveText(txt.neutral);
  await expect(sheet.getByTestId("exp-bank")).toContainText("CaixaBank");
  await expect.poll(async()=>((await stored(page)).expenses[0]||{}).category).toBe("traspaso");
  const after=await stored(page);
  expect(after.writes).toBe(1);expect(after.expenses).toHaveLength(1);
  expect(after.expenses[0]).toMatchObject({...expense,category:"traspaso"});
  expect(after.state.accounts).toEqual(before.state.accounts);
  await expect(page.locator('.v4-gastos-progress[role="progressbar"]')).toHaveAttribute("aria-valuenow","0");
  await expect(sheet.getByTestId("exp-withdrawal-info")).toContainText(txt.limit);
  await page.reload();await dismissNews(page);await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const row=page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:expense.merchant});
  await expect(row).toHaveCount(1);await row.click();
  await expect(page.getByTestId("exp-withdrawal-neutral")).toHaveText(txt.neutral);
  const deviceB=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true});
  const b=await deviceB.newPage();await open(b,lang,"ok","traspaso");
  await expect(b.getByTestId("exp-withdrawal-neutral")).toHaveText(txt.neutral);
  expect((await stored(b)).writes).toBe(0);
  await deviceB.close();
});
for(const mode of ["zero","noSession","wrongUuid","error","timeout"])test(`sin confirmación (${mode}) no cambia cifra ni categoría`,async({page})=>{
  const sheet=await open(page,"es",mode);
  await page.clock.install();
  await sheet.getByTestId("exp-withdrawal").click();await page.locator('.askback .btn-primary').click();
  if(mode==="timeout")await page.clock.fastForward(11000);
  await expect(sheet.getByTestId("exp-withdrawal-info")).toContainText("No se ha confirmado el cambio");
  await expect(sheet.getByTestId("exp-cat-otros")).toHaveAttribute("aria-pressed","true");
  await expect(sheet.getByTestId("exp-withdrawal-neutral")).toHaveCount(0);
  await expect.poll(async()=>((await stored(page)).expenses[0]||{}).category).toBe("otros");
  expect((await stored(page)).state.accounts[0].value).toBe(920);
});
