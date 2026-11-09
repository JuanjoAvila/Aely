import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews,esperaNubeQuieta} from "./fixtures.mjs";
const YM=2026*12+10;
const debt={id:"fam",name:"Préstamo sintético",monthly:260,amort:300,months:20,value:6000,account:"sabadell",day:20,asOf:YM-1};
const share={id:"pe_fam",n:"Familia",via:"debt",debtId:"fam",amt:40};
const bill={id:"fibra",name:"Fibra",amount:50,bankAmount:90,freq:"mes",day:20,account:"sabadell",reparto:[share]};
const messages={es:"Primero quita el descuento del recibo compartido para poner una TAE positiva.",en:"First remove the discount from the shared bill to set a positive APR.",ca:"Primer treu el descompte del rebut compartit per posar una TAE positiva."};
async function open(page,{lang="es",fixed=[bill]}={}){
  test.info().annotations.push({type:"own-clock"});
  await page.clock.install({time:new Date("2026-10-18T12:00:00Z")});
  await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
  await seedLoggedInDashboard(page,{__seedOnce:true,lastBackup:"2026-10-18",bankTx:[],debts:[debt],fixed,flows:[],oneoffs:[],expenses:[],accounts:[{id:"bank",ent:"sabadell",role:"fijos",value:3000}],settings:{autoPrices:false,theme:"green",lang,simpleMode:false,expenseBanks:["sabadell"]}});
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator('.v4-seg-btn').filter({hasText:lang==="en"?"Debts":lang==="ca"?"Deutes":"Deudas"}).click();
  await page.locator('[data-debt-id="fam"] .plan-item-open').click();return page.locator(".plan-edit-sheet");
}
const snapshot=page=>page.evaluate(()=>({state:mcLoadRaw(mcStateKey()),raw:localStorage.getItem(mcStateKey())}));
for(const [name,options] of [["activa es",{}],["pausada en",{lang:"en",fixed:[{...bill,pausedFrom:YM,pausedUntil:YM+2}]}],["futura ca",{lang:"ca",fixed:[{...bill,freq:"anual",months:[12]}]}]]){
  test("TAE bloquea "+name+" sin guardar otros cambios",async({page})=>{
    const sheet=await open(page,options);
    // El ACK del arranque escribe metadatos: la foto debe tomarse cuando ya se asentó, para
    // que la igualdad completa siga detectando cualquier guardado indebido del editor.
    await esperaNubeQuieta(page);
    const before=await snapshot(page);await sheet.locator('[data-debt-field="apr"]').fill("2.5");await sheet.locator('[data-debt-field="name"]').fill("Nombre cambiado");await sheet.locator("button.btn-primary.btn-block").click();
    await expect(sheet).toContainText(messages[options.lang||"es"]);await expect(sheet).toBeVisible();expect(await snapshot(page)).toEqual(before);
  });
}
test("TAE sin relaciones se guarda en la hoja real",async({page})=>{
  const sheet=await open(page,{fixed:[]});await sheet.locator('[data-debt-field="apr"]').fill("2.5");await sheet.locator("button.btn-primary.btn-block").click();await expect(sheet).toHaveCount(0);await expect.poll(async()=>(await snapshot(page)).state.debts[0].apr).toBe(2.5);
});
test("TAE tras quitar descuento desde persona conserva histórico pagado",async({page})=>{
  const sheet=await open(page,{fixed:[{...bill,day:10,paidYm:YM,paidDay:10,soloMes:{[YM]:{amt:50,reparto:[share]}}}]});await sheet.locator('[data-debt-field="apr"]').fill("2.5");await sheet.locator("button.btn-primary.btn-block").click();await expect(sheet).toContainText(messages.es);
  await sheet.getByRole("button",{name:"Cancelar",exact:true}).click();await expect(sheet).toHaveCount(0);
  await page.locator('.v4-seg-btn').filter({hasText:"Recibos"}).click();
  await page.locator('[data-seg="recibos"]').getByTestId("plan-todos").click();await page.locator('[data-bills-manage] [data-group="people"]').click();
  await page.locator('[data-bills-manage] [data-persona="pe_fam"]').click();
  const persona=page.locator('.v4-sheet[data-sheet="persona"]');await persona.locator('[data-pe="via"] button').filter({hasText:"Bizum"}).click();await persona.locator('[data-act="persona-guardar"]').click();await expect(persona).toHaveCount(0);
  const removed=(await snapshot(page)).state;expect(removed.fixed[0].reparto[0].via).toBe("bizum");
  expect(removed.fixed[0].soloMes[YM].reparto).toEqual([share]);
  const manage=page.locator('[data-bills-manage]');await manage.locator('[data-act="back"]').last().click();await expect(manage).toHaveAttribute("data-screen","bills-home");await manage.locator('[data-act="back"]').click();await expect(manage).toHaveCount(0);
  await page.locator('.v4-seg-btn').filter({hasText:"Deudas"}).click();await page.locator('[data-debt-id="fam"] .plan-item-open').click();await sheet.locator('[data-debt-field="apr"]').fill("2.5");await sheet.locator("button.btn-primary.btn-block").click();await expect(sheet).toHaveCount(0);
  await expect.poll(async()=>(await snapshot(page)).state.debts[0].apr).toBe(2.5);expect((await snapshot(page)).state.fixed).toEqual(removed.fixed);
});
