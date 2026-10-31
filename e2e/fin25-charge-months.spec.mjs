import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// El calendario y la pantalla deben cobrar lo mismo sin corregir los datos guardados.
async function abreMayo(page, fixed) {
  await page.clock.install({ time: new Date("2026-05-10T12:00:00+02:00") });
  await page.route("**/*", r => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce:true, lastBackup:"2026-05-10", fixed,
    accounts:[{id:"bank",ent:"sabadell",role:"fijos",value:3000}],
    expenses:[], bankTx:[], debts:[], flows:[], oneoffs:[],
    settings:{autoPrices:false,theme:"green",lang:"es",simpleMode:false,expenseBanks:["sabadell"]} });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:15000});
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}

test("FIN25 anual 600 con months [5,5]: una fila de 600 en mayo y ningun otro mes", async ({page}) => {
  const fixed=[{id:"fin25",name:"Seguro sintetico FIN25",amount:600,freq:"anual",months:[5,5],day:20,account:"sabadell"}];
  const recibos=await abreMayo(page,fixed);
  const row=recibos.getByTestId("plan-due").locator('[data-recibo="fixed_fin25"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("600,00");
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText("600,00 €");
  expect(await page.evaluate(() => {
    const s=mcLoadRaw(mcStateKey());
    return Array.from({length:12},(_,i) => {
      const p=planChargesMonth(s,i+1,2026,10);
      return p.pendingBills.concat(p.paidBills).filter(x=>x.id==="fixed_fin25").map(x=>Math.round(x.amount*100));
    });
  })).toEqual([[],[],[],[],[60000],[],[],[],[],[],[],[]]);
  expect(await page.evaluate(() => mcLoadRaw(mcStateKey()).fixed)).toEqual(fixed);
});

test("FIN25 ignora meses invalidos y mantiene el importe de schedule prioritario", async ({page}) => {
  const fixed=[
    {id:"invalid",name:"Anual sintetico",amount:240,freq:"año",months:[0,13,1.5,"5",5,5],day:20,account:"sabadell"},
    {id:"schedule",name:"Calendario sintetico",amount:999,freq:"anual",months:[5,6],account:"sabadell",
      schedule:[{m:5,amt:172.05,day:20},{m:5,amt:172.05,day:20},{m:9,amt:166.94,day:20}]},
  ];
  const recibos=await abreMayo(page,fixed),due=recibos.getByTestId("plan-due");
  await expect(due.locator('[data-recibo="fixed_invalid"]')).toContainText("240,00");
  await expect(due.locator('[data-recibo="fixed_schedule"]')).toContainText("172,05");
  await expect(due.locator(".v4-charge")).toHaveCount(2);
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText("412,05 €");
  expect(await page.evaluate(() => mcLoadRaw(mcStateKey()).fixed)).toEqual(fixed);
});

test("FIN25 R2 Gestionar conserva la cifra mensual y los datos al ignorar meses repetidos e invalidos", async ({page}) => {
  const fixed=[{id:"r2",name:"Seguro mensual sintetico",amount:999,freq:"anual",account:"sabadell",
    schedule:[{m:9,amt:166.94,day:20},{m:5,amt:172.05,day:20},{m:5,amt:999,day:25},
      {m:0,amt:90},{m:13,amt:90},{m:2.5,amt:90},{m:"6",amt:90},{m:null,amt:90}]}];
  const recibos=await abreMayo(page,fixed);
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_r2"]')).toContainText("172,05");
  const manage=await page.evaluate(() => t("pr6_todos"));
  await recibos.getByRole("button",{name:manage,exact:true}).click();
  const hub=page.locator("[data-bills-manage]");
  await expect(hub).toBeVisible();
  await expect(hub.locator(".v4-bills-hero-amt")).toHaveText("28,25 €");
  await expect(hub.locator('.v4-bills-group[data-group="serv"] .v4-bills-group-amt')).toContainText("28,25 €");
  expect(await page.evaluate(() => mcLoadRaw(mcStateKey()).fixed)).toEqual(fixed);
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible();
  expect(await page.evaluate(() => mcLoadRaw(mcStateKey()).fixed)).toEqual(fixed);
});

for(const version of [1,2]) for(const amount of [600,300]){
  test("FIN25 R1 "+(amount===600?"A completo pagado":"B parcial pendiente")+" huella"+version+" antes y despues de recargar", async ({page}) => {
    const name="Seguro pagado sintetico",id="r1",merchant="COMERCIO SINTETICO";
    const proof={kind:"expense",key:"revolut|2026-05-05|"+amount+"|"+merchant,
      identity:JSON.stringify(["revolut","2026-05-05",amount,merchant]),expenseId:"r1-charge",
      expenseKey:"2026-05-05|"+amount+"|"+merchant,expenseLegacyKey:"2026-05-05|"+amount+"|"+merchant,
      date:"2026-05-05",bank:"revolut",amount,model:JSON.stringify([version===2?id:name,"sabadell",300,null]),
      ...(version===2?{modelVersion:2,receiptId:id,receiptName:name}:{})};
    const fixed=[{id,name,amount:600,freq:"anual",months:[5,5],day:20,account:"sabadell",paymentProofs:{[2026*12+5]:proof}}];
    const recibos=await abreMayo(page,fixed);
    const check=async()=>{
      const due=recibos.getByTestId("plan-due").locator('[data-recibo="fixed_r1"]');
      const paid=recibos.getByTestId("plan-paid").locator('[data-recibo="fixed_r1"]');
      await expect(due).toHaveCount(amount===600?0:1);
      await expect(paid).toHaveCount(amount===600?1:0);
      if(amount===600){
        await recibos.getByTestId("plan-paid").locator(".pr6-paid-h").click();
        await expect(paid).toBeVisible();
        await expect(paid).toContainText("600,00");
      } else await expect(due).toContainText("600,00");
      expect(await page.evaluate(() => mcLoadRaw(mcStateKey()).fixed)).toEqual(fixed);
    };
    await check();
    await page.reload();
    await expect(page.locator(".botnav")).toBeVisible();
    await page.waitForFunction(() => !document.getElementById("mc-load"));
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await check();
  });
}
