import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// Queja del 8/11/2026: el cargo del banco no pasaba el recibo a «Ya pagados» porque no llevaba
// su nombre. Recibo «Luz» y adeudo de Sabadell «ENERGIA SINTETICA SA» un día después, al céntimo;
// otro recibo sin cargo sigue pendiente, y una transferencia del mismo importe que otro recibo no
// lo paga (revisión del 8/11). Desde la ficha se puede decir «No es este recibo». Datos inventados.
async function abreRecibos(page) {
  await page.clock.install({ time: new Date("2026-09-30T12:00:00+02:00") });
  await page.route("**/*", r => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce:true, lastBackup:"2026-09-30",
    fixed:[{id:"luz",name:"Luz",amount:54.30,freq:"mes",day:5,account:"sabadell"},
      {id:"gym",name:"Gimnasio",amount:30,freq:"mes",day:29,account:"sabadell"}],
    accounts:[{id:"bank",ent:"sabadell",role:"fijos",value:3000}],
    bankTx:[{id:"ref-luz",ent:"sabadell",date:"2026-09-06",amount:54.30,merchant:"ENERGIA SINTETICA SA",concept:"ADEUDO RECIBO SEPA",status:"BOOK"},
      {id:"ref-tr",ent:"sabadell",date:"2026-09-28",amount:30,merchant:"TRANSFERENCIA A PERSONA SINTETICA",concept:"cena",status:"BOOK"}],
    expenses:[{id:"x-luz",extId:"ref-luz",ent:"sabadell",date:"2026-09-06T12:00:00.000Z",amount:54.30,merchant:"ENERGIA SINTETICA SA",obName:"ENERGIA SINTETICA SA",source:"ob",status:"BOOK",category:"otros"}],
    debts:[], flows:[], oneoffs:[],
    settings:{autoPrices:false,theme:"green",lang:"es",simpleMode:false,expenseBanks:["sabadell"]} });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:15000});
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}

test("el adeudo del banco sin el nombre del recibo lo pasa a «Ya pagados»; una transferencia no", async ({page}) => {
  const recibos=await abreRecibos(page);
  const paid=recibos.getByTestId("plan-paid");
  await expect(paid.locator('[data-recibo="fixed_luz"]')).toHaveCount(1);
  await expect(paid.locator(".pr6-paid-t")).toContainText("· 1");
  await expect(paid.locator('[data-recibo="fixed_luz"]')).toContainText("54,30");
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_luz"]')).toHaveCount(0);
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_gym"]')).toHaveCount(1);
  // Lo que queda por pagar es solo el recibo sin cargo: la transferencia de 30 € no lo paga.
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText("30,00 €");
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(recibos.getByTestId("plan-paid").locator('[data-recibo="fixed_luz"]')).toHaveCount(1);
});

test("el pago que puso el banco sin nombre se puede deshacer desde la ficha", async ({page}) => {
  const recibos=await abreRecibos(page);
  const paid=recibos.getByTestId("plan-paid");
  await paid.locator(".pr6-paid-h").click();
  await paid.locator('[data-recibo="fixed_luz"]').click();
  await expect(page.locator('[data-act="no-es"]')).toBeVisible();
});
