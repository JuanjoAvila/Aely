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
