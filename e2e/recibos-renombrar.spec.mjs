import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

for(const legacy of [false,true])for(const name of ["IBI","Impuesto de vivienda"]){
  test((legacy?"legacy":"nuevo")+": recibo cobrado conserva vínculo al renombrar a "+name,async({page})=>{
    await page.clock.install({time:new Date("2026-10-18T12:00:00+02:00")});
    const bill={id:"recibo-sintetico",name:"Ibi",amount:123.45,freq:"mes",day:10,account:"sabadell"};
    const charge={id:"cargo-sintetico",extId:"ref-sintetica-1",obAcc:"cuenta-sintetica",date:"2026-10-10",merchant:"TRIBUTO MUNICIPAL SINTETICO",obName:"TRIBUTO MUNICIPAL SINTETICO",amount:123.45,ent:"sabadell",category:"otros",source:"ob",status:"BOOK"};
    await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:"cuenta-sintetica",ent:"sabadell",role:"fijos",value:800}],fixed:[bill],expenses:[charge],bankTx:[],debts:[],flows:[],oneoffs:[],settings:{autoPrices:false,theme:"green",lang:"es"}});
    await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
    const before=await page.evaluate(legacy=>{
      const s=mcLoadRaw(mcStateKey()),n=linkFixedPayment(s,"cargo-sintetico","recibo-sintetico",2026,10,18);
      if(legacy){const p=n.fixed[0].paymentProofs[24322];p.model=fixedPaymentModel(n.fixed[0],10);delete p.modelVersion;delete p.receiptId;delete p.receiptName;}
      mcSaveRaw(mcStateKey(),n);const status=fixedPaymentState(n,n.fixed[0],2026,10,18);
      return {paid:status.paid,cents:Math.round(status.paidAmount*100),expenses:n.expenses,accounts:n.accounts,proof:n.fixed[0].paymentProofs[24322]};
    },legacy);
    expect(before.paid).toBe(true);expect(before.cents).toBe(12345);
    await page.reload();await dismissNews(page);await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Ibi"})).toHaveCount(1);
    const manage=await page.evaluate(()=>t("v4_gestionar"));
    await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button",{name:manage,exact:true}).click();
    const hub=page.locator('[data-bills-manage]');await hub.locator('.v4-bills-group').first().click();
    await hub.locator('.v4-bills-row').filter({hasText:"Ibi"}).click();
    await page.locator('.v4-sheet[data-sheet="bill"] input.v4-bills-search:not([inputmode])').fill(name);
    await expect.poll(()=>page.evaluate(()=>mcLoadRaw(mcStateKey()).fixed[0].name)).toBe(name);
    await page.reload();await dismissNews(page);
    const after=await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey()),r=s.fixed[0],p=fixedPaymentState(s,r,2026,10,18);return {id:r.id,name:r.name,paid:p.paid,cents:Math.round(p.paidAmount*100),proof:r.paymentProofs[24322],expenses:s.expenses,accounts:s.accounts};});
    expect(after.id).toBe(bill.id);expect(after.name).toBe(name);
    expect(after.expenses).toEqual(before.expenses);expect(after.accounts).toEqual(before.accounts);
    expect(after.proof.identity).toBe(before.proof.identity);
    expect(after.paid).toBe(true);expect(after.cents).toBe(12345);
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:name})).toHaveCount(1);
  });
}

test("vínculo ya roto se recupera sólo al confirmar el cargo desde Gastos",async({page})=>{
  await page.clock.install({time:new Date("2026-10-18T12:00:00+02:00")});
  await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:"cuenta",ent:"sabadell",role:"diario",spendFrom:true,value:800}],fixed:[{id:"recibo-roto",name:"Ibi",amount:123.45,freq:"mes",day:10,account:"sabadell"}],expenses:[{id:"cargo-roto",extId:"referencia-roto",obAcc:"cuenta",date:"2026-10-10",merchant:"TRIBUTO SINTETICO",obName:"TRIBUTO SINTETICO",amount:123.45,ent:"sabadell",category:"otros",source:"ob",status:"BOOK"}],bankTx:[],debts:[],flows:[],oneoffs:[],settings:{autoPrices:false,theme:"green",lang:"es"}});
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  const before=await page.evaluate(()=>{
    const s=mcLoadRaw(mcStateKey()),n=linkFixedPayment(s,"cargo-roto","recibo-roto",2026,10,18),f=n.fixed[0],p=f.paymentProofs[24322];
    p.model=fixedPaymentModel(f,10);delete p.modelVersion;delete p.receiptId;delete p.receiptName;f.name="IBI";
    mcSaveRaw(mcStateKey(),n);return {expenses:n.expenses,accounts:n.accounts,proof:p};
  });
  await page.reload();await dismissNews(page);
  expect(await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey());return fixedPaymentState(s,s.fixed[0],2026,10,18).paid;})).toBe(false);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:"TRIBUTO SINTETICO"}).click();
  await page.getByTestId("exp-receipt").click();
  // La ficha conserva el vínculo durable roto para que se pueda deshacer primero.
  await page.getByTestId("exp-receipt-unlink").click();
  await page.getByTestId("exp-receipt-recibo-roto").click();
  await page.locator('.askback button.btn-primary').click();
  await expect(page.getByTestId("exp-receipt")).toContainText("IBI");
  await page.reload();await dismissNews(page);
  const after=await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey()),p=fixedPaymentState(s,s.fixed[0],2026,10,18);return {paid:p.paid,cents:Math.round(p.paidAmount*100),expenses:s.expenses,accounts:s.accounts};});
  expect(after.paid).toBe(true);expect(after.cents).toBe(12345);expect(after.expenses).toEqual(before.expenses);expect(after.accounts).toEqual(before.accounts);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"IBI"})).toHaveCount(1);
});
