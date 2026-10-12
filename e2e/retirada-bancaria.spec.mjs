import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, FIXTURE_NOW, installFixtureClock } from "./fixtures.mjs";

const id="550e8400-e29b-41d4-a716-446655440000";
const expense={id,date:new Date(FIXTURE_NOW).toISOString(),merchant:"Disposición oficina ficticia",amount:80,category:"otros",source:"ob",ent:"caixabank"};
async function open(page,lang="es",mode="ok",remoteCat="otros",overrides={}){
  await installFixtureClock(page);
  const remote={id,fecha:expense.date,comercio:expense.merchant,importe:80,cat:remoteCat,source:"ob:caixabank"};
  await seedLoggedInDashboard(page,{__seedOnce:true,expenses:[expense],__cloudRows:{expenses:[remote]},
    accounts:[{id:"caixa",ent:"caixabank",name:"Cuenta ficticia",value:920,bankIban:"fixture",role:"diario"}],
    settings:{lang,autoPrices:false,expenseBanks:["caixabank"],budgetCycle:false},...overrides});
  // Ejecuta el método real de cloud: este doble responde SELECT y UPDATE filtrados por fila.
  await page.addInitScript(({remote,mode,id,expenseDate,receiptId})=>{
    const desc=Object.getOwnPropertyDescriptor(window,"supabase");
    window.__withdrawalFixture={mode,writes:0,row:JSON.parse(localStorage.getItem("_fixtureWithdrawal")||"null")||remote};
    Object.defineProperty(window,"supabase",{configurable:true,get(){
      const lib=desc.get();if(!lib)return lib;
      return {createClient(){const base=lib.createClient();
        return {...base,auth:{...base.auth,getSession:async()=>({data:{session:window.__withdrawalFixture.mode==="noSession"?null:{user:{id:"e2e-user"}}}})},
          from(table){
            if(table==="app_state"&&mode.startsWith("lateReceipt")){
              const fixture=window.__withdrawalFixture,q={select(){return q;},eq(){return q;},update(){return q;},upsert(){return q;},
                async maybeSingle(){return {data:fixture.receiptPack||null,error:null};},
                async then(resolve){
                  // El conflicto CAS hace que la app baje metadatos del otro móvil por su ruta real.
                  // No se sustituye set(), el handler ni su lector vivo de estado.
                  if(fixture.writes&&!fixture.receiptPack){
                    const state=mcLoadRaw(mcStateKey()),date=new Date(expenseDate);
                    const linked=linkFixedPayment(state,id,receiptId,date.getFullYear(),date.getMonth()+1,date.getDate());
                    fixture.receiptPack={data:slimForCloud({...linked,_savedAt:Date.now()+1000}),updated_at:new Date().toISOString()};
                    return resolve({data:[],error:null});
                  }
                  return resolve({data:[{updated_at:new Date().toISOString()}],error:null});
                }};return q;
            }
            if(table!=="expenses")return base.from(table);
            const filters=[];let patch=null,beforeId=null;const fixture=window.__withdrawalFixture;
            const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},limit(){return q;},lt(k,v){if(k==="id")beforeId=v;return q;},
              upsert(){return base.from(table).upsert();},update(p){patch=p;return q;},
              async maybeSingle(){return {data:fixture.mode==="wrongUuid"?null:structuredClone(fixture.row),error:null};},
              async then(resolve){
                if(!patch)return resolve({data:beforeId&&fixture.row.id>=beforeId?[]:[structuredClone(fixture.row)],error:null});
                if(patch.cat!=="traspaso"){Object.assign(fixture.row,patch);return resolve({data:[structuredClone(fixture.row)],error:null});}
                fixture.writes++;
                if(fixture.mode==="timeout")return;
                if(fixture.mode.startsWith("lateReceipt"))while(!fixture.releaseAck)await new Promise(r=>setTimeout(r,20));
                await new Promise(r=>setTimeout(r,200));
                if(fixture.mode==="zero")return resolve({data:[],error:null});
                if(fixture.mode==="error"||fixture.mode==="lateReceiptError")return resolve({data:null,error:new Error("denied")});
                if(filters.some(([k,v])=>k!=="user_id"&&fixture.row[k]!==v))return resolve({data:[],error:null});
                Object.assign(fixture.row,patch);localStorage.setItem("_fixtureWithdrawal",JSON.stringify(fixture.row));
                return resolve({data:[structuredClone(fixture.row)],error:null});
              }};return q;
          }};
      }};
    },set(value){desc.set(value);}});
  },{remote,mode,id,expenseDate:expense.date,receiptId:(overrides.fixed||[])[0]?.id});
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
  await page.clock.install({time:new Date(FIXTURE_NOW)});
  await sheet.getByTestId("exp-withdrawal").click();await page.locator('.askback .btn-primary').click();
  if(mode==="timeout")await page.clock.fastForward(11000);
  await expect(sheet.getByTestId("exp-withdrawal-info")).toContainText("No se ha confirmado el cambio");
  await expect(sheet.getByTestId("exp-cat-otros")).toHaveAttribute("aria-pressed","true");
  await expect(sheet.getByTestId("exp-withdrawal-neutral")).toHaveCount(0);
  await expect.poll(async()=>((await stored(page)).expenses[0]||{}).category).toBe("otros");
  expect((await stored(page)).state.accounts[0].value).toBe(920);
});

async function receiptOnB(browser,lang,snapshot,paid,bill){
  expect(snapshot.expenses).toBeUndefined();expect(snapshot.bankTx).toBeUndefined();
  const device=await browser.newContext({baseURL:test.info().project.use.baseURL,viewport:{width:393,height:851},isMobile:true,hasTouch:true});
  try{
    const b=await device.newPage();await installFixtureClock(b);
    await seedLoggedInDashboard(b,{__seedOnce:true,...snapshot,expenses:[],bankTx:[],settings:{...snapshot.settings,lang}});
    await b.goto("/");await dismissNews(b);await b.waitForFunction(()=>!document.getElementById("mc-load"));
    await expect(b.locator('.v4-skel')).toHaveCount(0);
    await expect(b.locator('.page-scroll-host .v4-charge').filter({hasText:bill.name})).toHaveCount(paid?0:1);
    await b.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(b.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:bill.name})).toHaveCount(paid?1:0);
  }finally{await device.close();}
}
for(const lang of ["es","en","ca"])test(`vínculo de recibo bloquea ambas puertas; deshacer habilita retirada sin pago residual en B (${lang})`,async({page,browser})=>{
  const bill={id:"agua-prueba",name:"Agua doméstica sintética",amount:40,bankAmount:80,freq:"mes",day:25,account:"caixabank",wait:2026*12+9};
  const sheet=await open(page,lang,"ok","otros",{fixed:[bill],bankTx:[],flows:[],oneoffs:[],debts:[]});
  await sheet.getByTestId("exp-receipt").click();await sheet.getByTestId("exp-receipt-"+bill.id).click();
  await page.locator('.askback .btn-primary').click();
  const action=sheet.getByTestId("exp-withdrawal");await expect(action).toBeDisabled();
  const blocked=await page.evaluate(()=>t("f_withdraw_receipt_blocked"));
  await expect(sheet.getByTestId("exp-withdrawal-receipt-blocked")).toHaveText(blocked);
  await sheet.locator('.v4-ficha-cat-title button').click();
  await page.getByTestId("expense-all-cat-traspaso").click();
  await expect(sheet.getByTestId("exp-cat-otros")).toHaveAttribute("aria-pressed","true");
  expect((await stored(page)).writes).toBe(0);
  await expect.poll(async()=>!!((await stored(page)).state.fixed[0].paymentProofs||{})[2026*12+9]).toBe(true);
  const linked=await page.evaluate(()=>slimForCloud(mcLoadRaw(mcStateKey())));
  await receiptOnB(browser,lang,linked,true,bill);
  if(!(await sheet.getByTestId("exp-receipt-unlink").isVisible()))await sheet.getByTestId("exp-receipt").click();
  await sheet.getByTestId("exp-receipt-unlink").click();await expect(action).toBeEnabled();
  await expect(sheet.getByTestId("exp-withdrawal-receipt-blocked")).toHaveCount(0);
  await action.click();await page.locator('.askback .btn-primary').click();
  await expect(sheet.getByTestId("exp-withdrawal-neutral")).toHaveText(texts[lang].neutral);
  await expect.poll(async()=>(await stored(page)).expenses[0]?.category).toBe("traspaso");
  const after=await stored(page);expect(after.writes).toBe(1);expect(after.expenses).toHaveLength(1);
  expect(after.expenses[0]).toMatchObject({...expense,category:"traspaso"});
  expect(after.state.accounts).toEqual(linked.accounts);expect(after.state.fixed[0].amount).toBe(40);expect(after.state.fixed[0].bankAmount).toBe(80);
  await receiptOnB(browser,lang,await page.evaluate(()=>slimForCloud(mcLoadRaw(mcStateKey()))),false,bill);
});
for(const lang of ["es","en","ca"])test(`vínculo bajado tras enviar UPDATE se concilia solo con ACK real y deja recibo pendiente en B (${lang})`,async({page,browser})=>{
  const bill={id:"agua-prueba",name:"Agua doméstica sintética",amount:40,bankAmount:80,freq:"mes",day:25,account:"caixabank",wait:2026*12+9};
  const sheet=await open(page,lang,"lateReceipt","otros",{fixed:[bill],bankTx:[],flows:[],oneoffs:[],debts:[]});
  const before=await stored(page);
  await sheet.getByTestId("exp-withdrawal").click();await page.locator('.askback .btn-primary').click();
  await expect.poll(async()=>(await stored(page)).writes).toBe(1);
  const note=await page.evaluate(()=>t("f_note_row"));
  await sheet.locator('.v4-ficha-adjust-row').filter({hasText:note}).click();
  await sheet.locator('.v4-exp-note-in').fill("Nota sintética que provoca un CAS de metadatos");
  await sheet.getByTestId("exp-bank").click();
  await expect(sheet.getByTestId("exp-withdrawal-receipt-blocked")).toBeVisible();
  await expect.poll(async()=>!!((await stored(page)).state.fixed[0].paymentProofs||{})[2026*12+9]).toBe(true);
  await page.evaluate(()=>{window.__withdrawalFixture.releaseAck=true;});
  await expect(sheet.getByTestId("exp-withdrawal-neutral")).toHaveText(texts[lang].neutral);
  const message=await page.evaluate(()=>t("f_withdraw_receipt_undone"));await expect(sheet.getByRole("status")).toHaveText(message);
  await expect.poll(async()=>{const saved=await stored(page);return saved.expenses[0]?.category==="traspaso"&&!saved.state.fixed[0].paymentProofs?.[2026*12+9];}).toBe(true);
  const after=await stored(page);expect(after.writes).toBe(1);expect(after.expenses).toHaveLength(1);
  expect(after.expenses[0]).toMatchObject({...expense,category:"traspaso"});expect(after.state.accounts).toEqual(before.state.accounts);
  expect(after.state.fixed[0].amount).toBe(40);expect(after.state.fixed[0].bankAmount).toBe(80);
  expect(after.state.fixed[0].paymentProofs[2026*12+9]).toBeUndefined();
  // El pull real posterior conserva la única retirada y no recrea la prueba invalidada.
  await page.locator('.v4-exp-sheet .v4-ficha-done').click();
  const sync=await page.evaluate(()=>t("g_sync"));await page.locator('.v4-screen:has(.v4-gastos-summary)').getByRole("button",{name:sync,exact:true}).click();
  await expect.poll(async()=>(await stored(page)).expenses[0]?.category).toBe("traspaso");
  await receiptOnB(browser,lang,await page.evaluate(()=>slimForCloud(mcLoadRaw(mcStateKey()))),false,bill);
});
test("vínculo tardío con UPDATE denegado conserva prueba A/B y categoría original",async({page,browser})=>{
  const bill={id:"agua-prueba",name:"Agua doméstica sintética",amount:40,bankAmount:80,freq:"mes",day:25,account:"caixabank",wait:2026*12+9};
  const sheet=await open(page,"es","lateReceiptError","otros",{fixed:[bill],bankTx:[],flows:[],oneoffs:[],debts:[]});
  await sheet.getByTestId("exp-withdrawal").click();await page.locator('.askback .btn-primary').click();
  await expect.poll(async()=>(await stored(page)).writes).toBe(1);
  const note=await page.evaluate(()=>t("f_note_row"));await sheet.locator('.v4-ficha-adjust-row').filter({hasText:note}).click();
  await sheet.locator('.v4-exp-note-in').fill("Nota sintética con confirmación fallida");await sheet.getByTestId("exp-bank").click();
  await expect(sheet.getByTestId("exp-withdrawal-receipt-blocked")).toBeVisible();
  await page.evaluate(()=>{window.__withdrawalFixture.releaseAck=true;});
  await expect(sheet.getByTestId("exp-withdrawal-info")).toContainText("No se ha confirmado el cambio");
  await expect(sheet.getByTestId("exp-cat-otros")).toHaveAttribute("aria-pressed","true");
  await expect(sheet.getByTestId("exp-withdrawal-neutral")).toHaveCount(0);
  await receiptOnB(browser,"es",await page.evaluate(()=>slimForCloud(mcLoadRaw(mcStateKey()))),true,bill);
});
