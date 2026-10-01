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
  for(const [planned,actual,name,gross] of [[32,32.40,"Agua variable ficticia"],[32,35.10,"Agua variable ficticia"],[18,18.15,"Suscripción ficticia"],[21,44,"Recibo compartido ficticio",42]]){
    test(lang+": confirma importe variable "+actual+" frente a previsto "+planned,async({page})=>{
      const bill=Object.assign({},fixed,{name:name,amount:planned},gross?{bankAmount:gross}:{});
      const charge={id:"variable",date:"2026-09-25",merchant:"PROVEEDOR VARIABLE SA",amount:actual,ent:"trade_republic",category:"otros",source:"macrodroid"};
      await open(page,lang,{fixed:[bill],expenses:[charge]});
      await expect(page.locator('.page-scroll-host .v4-charge').filter({hasText:name})).toHaveCount(1);
      await page.locator('.botnav-tab[data-tour="gastos"]').click();
      const header=page.locator('.v4-gastos-summary-top');
      await expect(page.locator('.v4-gastos-summary-amount')).toBeVisible();
      const before=await header.textContent();
      await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:charge.merchant}).click();
      await page.getByTestId("exp-receipt").click();
      await page.getByTestId("exp-receipt-gas").click();
      const confirm=page.locator('.askback');
      const amounts=await page.evaluate(([a,b,c])=>[eur(a),eur(b),eur(c)],[actual,planned,gross||planned]);
      await expect(confirm).toContainText(amounts[0]);
      await expect(confirm).toContainText(amounts[2]);
      await expect(confirm).toContainText("Trade Republic");
      await expect(confirm).toContainText("Sabadell");
      await confirm.locator('button.btn-primary').click();
      await page.locator('.v4-exp-sheet .v4-ficha-done').click();
      await expect(header).toHaveText(before);
      await page.locator('.botnav-tab[data-tour="inicio"]').click();
      await expect(page.locator('.page-scroll-host .v4-charge').filter({hasText:name})).toHaveCount(0);
      await page.locator('.botnav-tab[data-tour="plan"]').click();
      const paid=page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:name});
      await expect(paid).toHaveCount(1);
      await expect(paid).toContainText(amounts[0]);
      await expect(paid.locator('.am')).toContainText(amounts[1]);
      await expect(paid.locator('.am small')).toHaveText({es:"Previsto",en:"Expected",ca:"Previst"}[lang]);
      await page.reload(); await dismissNews(page);
      await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:name})).toHaveCount(1);
    });
  }
  test(lang+": vincula y deshace un pago con otro nombre y banco sin descontar otra vez",async({page,browser})=>{
    const cargo={id:"cargo-tr",date:"2026-09-25T12:00:00.000Z",merchant:"PROVEEDOR SINTETICO SA",obName:"PROVEEDOR SINTETICO SA",amount:42,ent:"trade_republic",category:"otros",source:"ob"};
    await open(page,lang,{
      accounts:[{id:"sb",ent:"sabadell",name:"Cuenta ficticia",value:800,role:"fijos"},{id:"tr",ent:"trade_republic",name:"Diaria ficticia",value:300,role:"diario",spendFrom:true}],expenses:[cargo]});
    await expect(page.locator('.page-scroll-host .v4-charge').filter({hasText:"Gas ficticio"})).toHaveCount(1);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    const header=page.locator('.v4-gastos-summary-top');
    await expect(header).toContainText("42");
    await expect(page.locator('.v4-gastos-summary-amount')).toBeVisible();
    const budgetBefore=await header.textContent();
    await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:cargo.merchant}).click();
    await page.getByTestId("exp-receipt").click();
    await page.getByTestId("exp-receipt-gas").click();
    const confirm=page.locator('.askback');
    await expect(confirm).toContainText("Trade Republic");
    await expect(confirm).toContainText("Sabadell");
    await confirm.locator('button.btn-ghost').click();
    await expect(page.getByTestId("exp-receipt")).not.toContainText("Gas ficticio");
    await page.getByTestId("exp-receipt-gas").click();
    await confirm.locator('button.btn-primary').click();
    await expect(page.getByTestId("exp-receipt")).toContainText("Gas ficticio");
    await page.locator('.v4-exp-sheet .v4-ficha-done').click();
    await expect(header).toHaveText(budgetBefore);
    await expect(page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:cargo.merchant})).toHaveCount(1);
    await page.locator('.botnav-tab[data-tour="inicio"]').click();
    await expect(page.locator('.page-scroll-host .v4-charge').filter({hasText:"Gas ficticio"})).toHaveCount(0);
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Gas ficticio"})).toHaveCount(1);
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Gas ficticio"})).toContainText("Trade Republic");
    await page.reload(); await dismissNews(page);
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Gas ficticio"})).toHaveCount(1);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:cargo.merchant}).click();
    await page.locator('.v4-exp-sheet .v4-ficha-concept').fill("Nombre legible del cargo");
    await page.locator('.v4-exp-sheet .v4-ficha-concept').blur();
    await page.locator('.v4-exp-sheet .v4-ficha-done').click();
    await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:"Nombre legible del cargo"}).click();
    await expect(page.getByTestId("exp-receipt")).toContainText("Gas ficticio");
    const snapshot=await page.evaluate(()=>slimForCloud(mcLoadRaw(mcStateKey())));
    expect(snapshot.fixed[0].paymentProofs[2026*12+9].bank).toBe("trade_republic");
    expect(snapshot.expenses).toBeUndefined();
    expect(snapshot.bankTx).toBeUndefined();
    const deviceB=await browser.newContext({baseURL:test.info().project.use.baseURL,viewport:{width:393,height:851},isMobile:true,hasTouch:true});
    try{
      const pageB=await deviceB.newPage();
      await open(pageB,lang,snapshot);
      await expect(pageB.locator('.page-scroll-host .v4-charge').filter({hasText:"Gas ficticio"})).toHaveCount(0);
      await pageB.locator('.botnav-tab[data-tour="plan"]').click();
      await expect(pageB.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Gas ficticio"})).toHaveCount(1);
      await expect(pageB.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Gas ficticio"})).toContainText("Trade Republic");
    }finally{ await deviceB.close(); }
    await page.getByTestId("exp-receipt").click();
    await page.getByTestId("exp-receipt-unlink").click();
    await page.locator('.v4-exp-sheet .v4-ficha-done').click();
    await page.locator('.botnav-tab[data-tour="inicio"]').click();
    await expect(page.locator('.page-scroll-host .v4-charge').filter({hasText:"Gas ficticio"})).toHaveCount(1);
  });
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
