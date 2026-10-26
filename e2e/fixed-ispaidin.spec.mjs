import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews,gastosAbreGasto,esperaNubeQuieta} from "./fixtures.mjs";

test("rehacer vínculo bancario actualiza saldo y pendientes sin pull",async({page})=>{
  test.info().annotations.push({type:"own-clock"});
  await page.clock.install({time:new Date("2026-10-18T12:00:00+02:00")});
  await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
  const ym=2026*12+10;
  const bill={id:"receipt",name:"Recibo sintético",amount:42.37,freq:"mes",day:28,account:"sabadell",wait:ym,paidYm:ym,paidDay:12};
  const charge={id:"charge",merchant:"Cargo de otro nombre",date:"2026-10-12",amount:42.37,ent:"sabadell",category:"recibos",source:"ob-hist"};
  bill.paymentProofs={[ym]:{kind:"expense",key:"sabadell|2026-10-12|42.37|Cargo de otro nombre",identity:JSON.stringify(["sabadell","2026-10-12",42.37,charge.merchant]),expenseId:charge.id,expenseKey:"2026-10-12|42.37|Cargo de otro nombre",expenseLegacyKey:"2026-10-12|42.37|Cargo de otro nombre",date:charge.date,bank:"sabadell",amount:42.37,model:JSON.stringify([bill.id,"sabadell",42.37,null]),modelVersion:2,receiptId:bill.id,receiptName:bill.name}};
  // El cargador migra el saldo legado al ancla del mes; 800,23 visibles quedan en 842,60.
  await seedLoggedInDashboard(page,{__seedOnce:true,lastBackup:"2026-10-18",accounts:[{id:"bank",ent:"sabadell",role:"fijos",value:800.23}],fixed:[bill],expenses:[charge],bankTx:[],debts:[],flows:[],oneoffs:[],settings:{autoPrices:false,theme:"green",lang:"es",simpleMode:false,expenseBanks:["sabadell"]}});
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);await esperaNubeQuieta(page);
  const initial=await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey());return {fixed:s.fixed[0],expense:s.expenses[0],proof:!!fixedPaymentProof(s,s.fixed[0],2026,10,18),today:new Date().toISOString()};});
  expect(initial.proof,JSON.stringify(initial)).toBe(true);
  await page.evaluate(()=>{
    window.__isPaidReads={pull:0,derived:0};
    const pull=cloud.pullState,derived=planSyncDerived;
    cloud.pullState=function(...a){window.__isPaidReads.pull++;return pull.apply(this,a);};
    planSyncDerived=function(...a){window.__isPaidReads.derived++;return derived(...a);};
    const s=mcLoadRaw(mcStateKey());window.__isPaidMoney={accounts:s.accounts,expenses:s.expenses};
  });
  const tab=async id=>page.locator('.botnav-tab[data-tour="'+id+'"]').click();
  const balance=()=>page.locator('button[data-account-id="bank"] .am');
  const euro=async n=>page.evaluate(n=>eur(n),n);
  await tab("cartera");await expect(balance()).toHaveText(await euro(800.23));
  await tab("gastos");await gastosAbreGasto(page,charge.merchant);
  await page.getByTestId("exp-receipt").click();await page.getByTestId("exp-receipt-unlink").click();
  await page.locator(".v4-exp-sheet .v4-ficha-done").click();
  await tab("cartera");await expect(balance()).toHaveText(await euro(842.60));
  await tab("plan");await expect(page.getByTestId("plan-due")).toContainText(bill.name);
  await expect(page.getByTestId("plan-due")).toContainText(await euro(42.37));
  await tab("gastos");await gastosAbreGasto(page,charge.merchant);
  await page.getByTestId("exp-receipt").click();await page.getByTestId("exp-receipt-receipt").click();
  await page.locator(".askback .btn-primary").click();
  await expect(page.getByTestId("exp-receipt-value")).toHaveText(bill.name);
  await page.locator(".v4-exp-sheet .v4-ficha-done").click();
  await tab("cartera");await expect(balance()).toHaveText(await euro(800.23));
  await tab("plan");await expect(page.getByTestId("plan-due").locator(".v4-charge")).toHaveCount(0);
  await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:bill.name})).toHaveCount(1);
  const saved=await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey());return {calls:window.__isPaidReads,accounts:s.accounts,expenses:s.expenses,before:window.__isPaidMoney,mark:s.fixed[0].paidYm,proof:fixedPaymentProof(s,s.fixed[0],2026,10,18)!=null,events:bankPendingEvents(s,"sabadell",2026,10,18),net:Math.round(monthNetForAccount(s,"sabadell",2026,10,18)*100)};});
  expect(saved.calls).toEqual({pull:0,derived:0});expect(saved.mark).toBeUndefined();expect(saved.proof).toBe(true);
  expect(saved.events).toEqual([]);expect(saved.net).toBe(-4237);
  expect(saved.accounts).toEqual(saved.before.accounts);expect(saved.expenses).toEqual(saved.before.expenses);
});
