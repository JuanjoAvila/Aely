import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const labels={es:{overdue:"Cargos vencidos",unknown:"Sin pago acreditado"},en:{overdue:"Overdue charges",unknown:"Payment unconfirmed"},ca:{overdue:"Càrrecs vençuts",unknown:"Sense pagament acreditat"}};
const fixed={id:"gas",name:"Gas ficticio",amount:42,freq:"mes",day:25,account:"sabadell",wait:2026*12+9};
const tx={id:"gas-bank",ent:"sabadell",date:"2026-09-25",amount:42,merchant:"Gas ficticio",status:"BOOK"};

async function open(page,lang,overrides={},time="2026-09-30T12:00:00Z"){
  await page.clock.install({time:new Date(time)});
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
  test(lang+": H1 homónimos en dos bancos mantienen ambos pagados también sin extracto",async({page,browser})=>{
    const bills=[Object.assign({},fixed,{id:"netflix-sb",name:"Netflix ficticio"}),Object.assign({},fixed,{id:"netflix-tr",name:"Netflix ficticio",account:"trade_republic"})];
    const accounts=[{id:"sb",ent:"sabadell",value:800,role:"fijos"},{id:"tr",ent:"trade_republic",value:300,role:"fijos"}];
    const books=[Object.assign({},tx,{merchant:bills[0].name}),Object.assign({},tx,{id:"netflix-book-tr",ent:"trade_republic",merchant:bills[1].name})];
    await open(page,lang,{accounts,fixed:bills,bankTx:books});
    await expect(page.locator('.page-scroll-host .v4-charge').filter({hasText:"Netflix ficticio"})).toHaveCount(0);
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Netflix ficticio"})).toHaveCount(2);
    const snapshot=await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey());return slimForCloud(reconcileFixedPaymentProofs(s,2026,9,30));});
    expect(snapshot.bankTx).toBeUndefined();
    const device=await browser.newContext({baseURL:test.info().project.use.baseURL,viewport:{width:393,height:851},isMobile:true,hasTouch:true});
    try{
      const other=await device.newPage();await open(other,lang,Object.assign({},snapshot,{expenses:[],bankTx:[]}));
      await expect(other.locator('.page-scroll-host .v4-charge').filter({hasText:"Netflix ficticio"})).toHaveCount(0);
      await other.locator('.botnav-tab[data-tour="plan"]').click();
      await expect(other.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Netflix ficticio"})).toHaveCount(2);
    }finally{await device.close();}
  });
  test(lang+": H2 cambiar el día conserva el BOOK viajado y el saldo",async({page})=>{
    const bill=Object.assign({},fixed,{day:12,wait:undefined}),date="2026-09-12",model=JSON.stringify([bill.name,"sabadell",42,null]);
    bill.paymentProofs={[2026*12+9]:{kind:"book",key:"sabadell|gas-bank",identity:JSON.stringify(["sabadell",date,42,bill.name]),date,bank:"sabadell",merchant:bill.name,amount:42,model}};
    await open(page,lang,{fixed:[bill],bankTx:[]},"2026-09-15T12:00:00Z");
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    const before=await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey());return monthNetForAccount(s,"sabadell",2026,9,15);});
    const manage=await page.evaluate(()=>t("v4_gestionar"));
    await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button",{name:manage,exact:true}).click();
    const hub=page.locator('[data-bills-manage]');await hub.locator('.v4-bills-group').first().click();
    await hub.locator('.v4-bills-row').filter({hasText:bill.name}).click();
    const sheet=page.locator('.v4-sheet[data-sheet="bill"]');await sheet.locator('input[inputmode="numeric"]').fill("25");
    await expect.poll(()=>page.evaluate(()=>mcLoadRaw(mcStateKey()).fixed[0].paidDay)).toBe(12);
    const saved=await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey());return {bill:s.fixed[0],net:monthNetForAccount(s,"sabadell",2026,9,15)};});
    expect(saved.bill.day).toBe(25);expect(saved.bill.paidYm).toBe(2026*12+9);expect(saved.bill.paymentProofs[2026*12+9].kind).toBe("book");expect(saved.net).toBe(before);
    await page.reload();await dismissNews(page);
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:bill.name})).toHaveCount(1);
  });
  test(lang+": H4 la notificación y el cargo importado mantienen el recibo pagado",async({page})=>{
    const bill=Object.assign({},fixed,{category:"recibos"}),notice={id:"notificacion",date:"2026-09-24",merchant:bill.name,amount:42,ent:"trade_republic",category:"recibos",source:"macrodroid"};
    await open(page,lang,{fixed:[bill],expenses:[notice]});
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:bill.name})).toHaveCount(1);
    const book=Object.assign({},tx,{id:"importado",ent:"trade_republic",date:"2026-09-25",merchant:"GAS FICTICIO SA"});
    const combined=await page.evaluate(book=>{const s=mcLoadRaw(mcStateKey()),added=importObExpenses(s,[book]);return {added:added.length,state:Object.assign({},s,{expenses:s.expenses.concat(added),bankTx:[book]})};},book);
    expect(combined.added).toBe(1);
    await page.evaluate(s=>mcSaveRaw(mcStateKey(),s),combined.state);await page.reload();await dismissNews(page);
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:bill.name})).toHaveCount(1);
    expect(await page.evaluate(()=>mcLoadRaw(mcStateKey()).expenses.length)).toBe(2);
  });
  test(lang+": editar un recibo notificado no confirma dinero en el calendario",async({page})=>{
    const cargo={id:"notificado",date:"2026-09-24",merchant:"Gas ficticio",amount:42,ent:"trade_republic",category:"otros",source:"macrodroid"};
    await open(page,lang,{expenses:[cargo]});
    await expect(page.locator('.page-scroll-host .v4-charge').filter({hasText:fixed.name})).toHaveCount(0);
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    const manage=await page.evaluate(()=>t("v4_gestionar"));
    await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button",{name:manage,exact:true}).click();
    const hub=page.locator('[data-bills-manage]');
    await hub.locator('.v4-bills-group').first().click();
    await hub.locator('.v4-bills-row').filter({hasText:fixed.name}).click();
    const sheet=page.locator('.v4-sheet[data-sheet="bill"]');
    await sheet.locator('input[inputmode="numeric"]').fill("26");
    await expect.poll(()=>page.evaluate(()=>mcLoadRaw(mcStateKey()).fixed[0].day)).toBe(26);
    const edited=await page.evaluate(()=>mcLoadRaw(mcStateKey()).fixed[0]);
    expect(edited.day).toBe(26);
    expect(edited.paidYm).toBeUndefined();
    expect(edited.paidDay).toBeUndefined();
    await sheet.locator('.settings-push-h .back').click();
    await expect(sheet).toHaveCount(0);
    await hub.locator(':scope > .v4-bills-push > [data-screen="bills-group"] > .settings-push-h .back').click();
    await expect(hub.locator(':scope > .v4-bills-push')).toHaveCount(0);
    await hub.locator(':scope > [data-screen="bills-home"] > .settings-push-h .back').click();
    await expect(hub).toHaveCount(0);
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:fixed.name})).toHaveCount(1);
    await page.reload(); await dismissNews(page);
    const reloaded=await page.evaluate(()=>mcLoadRaw(mcStateKey()).fixed[0]);
    expect(reloaded.paidYm).toBeUndefined();
    expect(reloaded.paidDay).toBeUndefined();
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:fixed.name})).toHaveCount(1);
  });
  test(lang+": Agua de otro banco con categoría distinta sigue sin acreditar",async({page})=>{
    const bill=Object.assign({},fixed,{name:"Agua",amount:30,category:"hogar"});
    const cargo={id:"agua-bar",date:"2026-09-24",merchant:"AGUA MINERAL BAR PEPE",amount:30,ent:"trade_republic",category:"bares",source:"macrodroid"};
    await open(page,lang,{fixed:[bill],expenses:[cargo]});
    await expect(page.locator('.page-scroll-host .v4-charge').filter({hasText:"Agua"})).toHaveCount(1);
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Agua"})).toHaveCount(0);
    await expect(page.locator('div[data-seg="recibos"]')).toContainText(labels[lang].unknown);
    await page.reload(); await dismissNews(page);
    await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:"Agua"})).toHaveCount(0);
    await expect(page.locator('div[data-seg="recibos"]')).toContainText(labels[lang].unknown);
  });
  for(const [kind,tie,tolerant,duplicate] of [["nombre más específico",false,false],["empate real",true,false],["BOOK tolerante y gasto exacto",false,true],["identificador duplicado",false,false,true]]){
    test(lang+": un cargo no acredita dos recibos · "+kind,async({page})=>{
      // La disputa por nombre se hace dentro del mismo banco: el BOOK de otra entidad
      // conserva su identidad propia aunque haya un homónimo (H1, revisión12/10).
      const specific=Object.assign({},fixed,{id:"seguro",name:"Seguro Mapfre",category:"recibos",amount:tolerant?42.4:42});
      const generic=Object.assign({},fixed,{id:"mapfre",name:tie?"SEGURO MAPFRE":"Mapfre",category:"recibos"});
      if(duplicate) generic.id=specific.id;
      const cargo={id:"seguro-sb",date:"2026-09-24",merchant:"SEGURO MAPFRE SA",amount:42,ent:"sabadell",category:"recibos",source:"ob"};
      const book=Object.assign({},tx,{ent:cargo.ent,date:cargo.date,merchant:cargo.merchant});
      await open(page,lang,{accounts:[{id:"sb",ent:"sabadell",value:800,role:"fijos"},{id:"tr",ent:"trade_republic",value:300,role:"fijos"}],fixed:[generic,specific],expenses:[cargo],bankTx:[book]});
      const unconfirmed=tie||duplicate;
      await expect(page.locator('.page-scroll-host .v4-charge')).toHaveCount(unconfirmed?2:1);
      await page.locator('.botnav-tab[data-tour="plan"]').click();
      const paid=page.locator('div[data-seg="recibos"] .v4-paid');
      await expect(paid).toHaveCount(unconfirmed?0:1);
      if(!unconfirmed) await expect(paid).toContainText(specific.name);
      await page.reload(); await dismissNews(page);
      await expect(paid).toHaveCount(unconfirmed?0:1);
    });
  }
  for(const [kind,charge] of [
    ["nombre bancario original",{source:"ob",ent:"sabadell",merchant:"Nombre legible distinto",obName:"Gas ficticio"}],
    ["otra entidad por notificación",{source:"macrodroid",ent:"trade_republic",merchant:"GAS FICTICIO SA"}]
  ]){
    test(lang+": acredita cargo guardado sin extracto · "+kind,async({page,browser})=>{
      const cargo=Object.assign({id:"guardado",date:"2026-09-24",amount:42,category:"otros"},charge);
      await open(page,lang,{expenses:[cargo]});
      const before=await page.evaluate(()=>{ const s=mcLoadRaw(mcStateKey()); return JSON.stringify([s.accounts,s.expenses,s.fixed]); });
      await expect(page.locator('.page-scroll-host .v4-charge').filter({hasText:fixed.name})).toHaveCount(0);
      await page.locator('.botnav-tab[data-tour="plan"]').click();
      const paid=page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:fixed.name});
      await expect(paid).toHaveCount(1);
      await expect(paid).toContainText("24");
      await expect(paid).toContainText(charge.ent==="sabadell"?"Sabadell":"Trade Republic");
      const snapshot=await page.evaluate(()=>slimForCloud(mcLoadRaw(mcStateKey())));
      expect(snapshot.bankTx).toBeUndefined();
      const deviceB=await browser.newContext({baseURL:test.info().project.use.baseURL,viewport:{width:393,height:851},isMobile:true,hasTouch:true});
      try{
        const pageB=await deviceB.newPage();
        // app_state y Gastos viajan por separado: el móvil nuevo tiene el cargo, sin feed.
        await open(pageB,lang,Object.assign({},snapshot,{expenses:[cargo],bankTx:[]}));
        await expect(pageB.locator('.page-scroll-host .v4-charge').filter({hasText:fixed.name})).toHaveCount(0);
        await pageB.locator('.botnav-tab[data-tour="plan"]').click();
        await expect(pageB.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:fixed.name})).toHaveCount(1);
      }finally{ await deviceB.close(); }
      await page.reload(); await dismissNews(page);
      await expect(paid).toHaveCount(1);
      expect(await page.evaluate(()=>{ const s=mcLoadRaw(mcStateKey()); return JSON.stringify([s.accounts,s.expenses,s.fixed]); })).toBe(before);
    });
  }
  for(const [kind,patch] of [["solo importe",{merchant:"Comercio diferente"}],["token genérico",{merchant:"Otro ficticio"}],["nombre bancario genérico",{merchant:"Ficticio"}],["importe parecido",{amount:42.40}],["pendiente",{status:"PDNG"}]]){
    test(lang+": cargo guardado insuficiente sigue vencido · "+kind,async({page})=>{
      const cargo=Object.assign({id:"sin-identidad",date:"2026-09-24",merchant:"Gas ficticio",amount:42,ent:"trade_republic",category:"otros",source:"macrodroid"},patch);
      await open(page,lang,{expenses:[cargo]});
      const before=await page.evaluate(()=>{ const s=mcLoadRaw(mcStateKey()); return JSON.stringify([s.accounts,s.expenses,s.fixed]); });
      const row=page.locator('.page-scroll-host .v4-charge').filter({hasText:fixed.name});
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(labels[lang].unknown);
      await expect(row.locator('.dt .d')).toHaveText("25");
      await page.locator('.botnav-tab[data-tour="plan"]').click();
      await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:fixed.name})).toHaveCount(0);
      await expect(page.locator('div[data-seg="recibos"]')).toContainText(labels[lang].unknown);
      expect(await page.evaluate(()=>{ const s=mcLoadRaw(mcStateKey()); return JSON.stringify([s.accounts,s.expenses,s.fixed]); })).toBe(before);
    });
  }
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
