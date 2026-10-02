import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews} from "./fixtures.mjs";

const debt={id:"loan-a",name:"Préstamo sintético A",value:12000,original:12000,monthly:60,account:"sabadell",day:3,asOf:2026*12+9};
const cargo={id:"charge-a",date:"2026-10-02",amount:60,merchant:"Prestamista sintético",obName:"Prestamista sintético",category:"deudas",source:"ob",ent:"sabadell",debtId:"loan-a"};
async function open(page,lang,overrides={}){
  await page.clock.install({time:new Date("2026-10-02T12:00:00Z")});
  await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:"sb",ent:"sabadell",name:"Cuenta sintética",value:800,role:"fijos"}],
    fixed:[],debts:[debt],expenses:[cargo],flows:[],oneoffs:[],bankTx:[],
    settings:{lang,autoPrices:false,theme:"green",expenseBanks:["sabadell"]},...overrides});
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
}
const bills=page=>page.locator('div[data-seg="recibos"]');
const pending=page=>bills(page).locator('.v4-charge:not(.v4-paid)');
const paid=page=>bills(page).locator('.v4-charge.v4-paid');
for(const lang of ["es","en","ca"]){
  test(lang+": cuota más pago final decimal se pinta pagada sin repetir el cargo",async({page})=>{
    await open(page,lang,{debts:[{...debt,monthly:0.1,balloon:0.2,months:1}],expenses:[{...cargo,amount:0.3}]});
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(pending(page)).toHaveCount(0);await expect(paid(page)).toHaveCount(2);
    await expect(paid(page).locator('.am')).toHaveText(await page.evaluate(()=>[eur(0.2),eur(0.1)]));
    const balloon=await page.evaluate(()=>t("db_balloon_tag"));await expect(paid(page).filter({hasText:balloon})).toHaveCount(1);
    expect(await page.evaluate(()=>Math.round(planChargesMonth(mcLoadRaw(mcStateKey()),10,2026,2).paidBillsTotal*100))).toBe(30);
  });
  test(lang+": cargo59 EUR no acredita cuota60 EUR ni la pinta pagada",async({page})=>{
    await open(page,lang,{expenses:[{...cargo,amount:59}]});
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(pending(page)).toHaveCount(1);await expect(paid(page)).toHaveCount(0);
    await expect(bills(page).locator('.v4-card-hero .serif.num')).toHaveText(await page.evaluate(()=>eur(60)));
  });
  test(lang+": cuota vinculada desde otro banco muestra el banco del pago",async({page})=>{
    await open(page,lang,{expenses:[{...cargo,ent:"trade_republic"}]});
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(pending(page)).toHaveCount(0);await expect(paid(page)).toContainText("Trade Republic");
  });
  test(lang+": cargo anterior al día1 conserva el vencimiento sin inventar una fecha futura",async({page})=>{
    await open(page,lang,{debts:[{...debt,day:1}],expenses:[{...cargo,date:"2026-09-30"}]});
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(pending(page)).toHaveCount(0);await expect(paid(page).locator('.dt .d')).toHaveText("1");
  });
  test(lang+": sin día fiable no atribuye mes al cargo vinculado",async({page})=>{
    await open(page,lang,{debts:[{...debt,day:undefined}]});
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(pending(page)).toHaveCount(1);await expect(paid(page)).toHaveCount(0);
    await expect(pending(page).locator('.dt .d')).toHaveText("—");
  });
  test(lang+": el cargo que llega con Plan abierto actualiza la lista sin reentrada",async({page})=>{
    await open(page,lang,{expenses:[],__cloudRows:{expenses:[]}});
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(pending(page)).toHaveCount(1);
    await page.evaluate(()=>{
      window.__e2eCloudRows.expenses.push({id:"550e8400-e29b-41d4-a716-446655440099",fecha:"2026-10-02",importe:60,comercio:"Prestamista sintético",cat:"deudas",source:"ob:sabadell~deuda.loan-a"});
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(pending(page)).toHaveCount(0);
    await expect(paid(page)).toHaveCount(1);await expect(paid(page)).toContainText(debt.name);
  });
  test(lang+": cargo vinculado antes del vencimiento desaparece de pendiente y proyección, también al reabrir",async({page})=>{
    await open(page,lang);
    await expect(page.locator('.page-scroll-host .v4-charge').filter({hasText:debt.name})).toHaveCount(0);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    const row=page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:cargo.merchant});
    await expect(row).toHaveCount(1);await expect(row).toContainText(debt.name);
    await expect(row).toContainText({es:"ya cuenta en el Plan",en:"already in your Plan",ca:"ja compta al Pla"}[lang]);
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(pending(page).filter({hasText:debt.name})).toHaveCount(0);
    await expect(paid(page).filter({hasText:debt.name})).toHaveCount(1);
    const zero=await page.evaluate(()=>eur(0));
    await expect(bills(page).locator('.v4-card-hero .serif.num')).toHaveText(zero);
    // La proyección comparte el contrato; el saldo actual conserva su ancla, sin otro descuento.
    expect(await page.evaluate(()=>{
      const s=mcLoadRaw(mcStateKey()),p=planChargesMonth(s,10,2026,2);
      return {pending:p.pendingBillsTotal,paid:p.paidBillsTotal,events:bankPendingEvents(s,"sabadell",2026,10,2).length,base:s.accounts[0].value};
    })).toEqual({pending:0,paid:60,events:0,base:800});
    await page.reload();await dismissNews(page);
    await expect(pending(page).filter({hasText:debt.name})).toHaveCount(0);
    await expect(paid(page).filter({hasText:debt.name})).toHaveCount(1);
  });
  test(lang+": otro préstamo equivalente sigue pendiente y totaliza una sola cuota",async({page})=>{
    const other={...debt,id:"loan-b",name:"Préstamo sintético B"};
    await open(page,lang,{debts:[debt,other]});
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(pending(page)).toHaveCount(1);await expect(pending(page)).toContainText(other.name);
    await expect(paid(page)).toHaveCount(1);await expect(paid(page)).toContainText(debt.name);
    await expect(bills(page).locator('.v4-card-hero .serif.num')).toHaveText(await page.evaluate(()=>eur(60)));
  });
  test(lang+": dos cargos vinculados compatibles no acreditan por orden",async({page})=>{
    await open(page,lang,{expenses:[cargo,{...cargo,id:"charge-b",date:"2026-10-01"}]});
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(pending(page)).toHaveCount(1);await expect(pending(page)).toContainText(debt.name);
    await expect(paid(page)).toHaveCount(0);
    await expect(bills(page).locator('.v4-card-hero .serif.num')).toHaveText(await page.evaluate(()=>eur(60)));
  });
  test(lang+": feed pendiente no acredita el cargo vinculado",async({page})=>{
    await open(page,lang,{bankTx:[{...cargo,status:"PDNG"}]});
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(pending(page)).toHaveCount(1);await expect(paid(page)).toHaveCount(0);
  });
}
