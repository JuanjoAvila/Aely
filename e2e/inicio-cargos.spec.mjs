import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const labels={es:{overdue:"Cargos vencidos",unknown:"Sin pago acreditado"},en:{overdue:"Overdue charges",unknown:"Payment unconfirmed"},ca:{overdue:"Càrrecs vençuts",unknown:"Sense pagament acreditat"}};
const fixed={id:"gas",name:"Gas ficticio",amount:42,freq:"mes",day:25,account:"sabadell",wait:2026*12+9};
const tx={id:"gas-bank",ent:"sabadell",date:"2026-09-25",amount:42,merchant:"Gas ficticio",status:"BOOK"};

async function open(page,lang,overrides={}){
  await page.clock.install({time:new Date("2026-09-30T12:00:00Z")});
  await seedLoggedInDashboard(page,Object.assign({__seedOnce:true,
    accounts:[{id:"sb",ent:"sabadell",name:"Cuenta ficticia",value:800,role:"fijos"}],
    fixed:[fixed],debts:[],flows:[],oneoffs:[],expenses:[],bankTx:[],
    settings:{autoPrices:false,theme:"green",lang:lang}},overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await expect(page.locator('.v4-skel')).toHaveCount(0);
}

for(const lang of ["es","en","ca"]){
  test(lang+": el gas confirmado desaparece de Inicio aunque siga en espera",async({page})=>{
    await open(page,lang,{bankTx:[tx]});
    await expect(page.locator('.page-scroll-host .v4-charge').filter({hasText:"Gas ficticio"})).toHaveCount(0);
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Gas ficticio"})).toHaveCount(1);
    await page.reload();
    await dismissNews(page);
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Gas ficticio"})).toHaveCount(1);
  });
  test(lang+": pasado el día no inventa el pago y lo muestra vencido",async({page})=>{
    await open(page,lang,{fixed:[Object.assign({},fixed,{wait:undefined})]});
    const block=page.locator('.page-scroll-host .v4-section').filter({has:page.locator('.v4-section-h',{hasText:labels[lang].overdue})});
    await expect(block).toContainText("Gas ficticio");
    await expect(block).toContainText(labels[lang].unknown);
    await expect(block.locator('.dt .d')).toHaveText("25");
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Gas ficticio"})).toHaveCount(0);
    await expect(page.locator('div[data-seg="recibos"]')).toContainText(labels[lang].unknown);
  });
  test(lang+": un movimiento pendiente no acredita el pago",async({page})=>{
    await open(page,lang,{bankTx:[Object.assign({},tx,{status:"PDNG"})]});
    await expect(page.getByText(labels[lang].overdue,{exact:true})).toBeVisible();
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Gas ficticio"})).toHaveCount(0);
  });
}
