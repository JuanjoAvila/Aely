import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';
import {paymentFixture} from '../tests/fixtures/payment-ui.mjs';

async function openRound2(page,state,settings={}){
  await page.clock.install({time:new Date('2026-10-18T12:00:00+02:00')});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await seedLoggedInDashboard(page,{...state,lastBackup:'2026-10-18',__seedOnce:true,settings:{autoPrices:false,theme:'green',lang:'es',expenseBanks:['sabadell'],...settings}});
  await page.addInitScript(()=>{
    const descriptor=Object.getOwnPropertyDescriptor(window,'supabase');window.__paymentWrites=[];
    Object.defineProperty(window,'supabase',{...descriptor,set(lib){descriptor.set(lib);const mock=descriptor.get();if(!mock)return;
      const create=mock.createClient;mock.createClient=function(...args){const client=create(...args),from=client.from.bind(client);
        client.from=function(table){const q=from(table);for(const method of ['insert','update','upsert','delete'])if(q[method]){const original=q[method];q[method]=function(...args){window.__paymentWrites.push({table,method});return original.apply(this,args);};}return q;};return client;};}});
  });
  await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);await page.clock.runFor(6000);
  await page.evaluate(()=>{window.__paymentWrites=[];window.__paymentBefore=JSON.stringify(mcLoadRaw(mcStateKey()));});
}
async function unchangedRound2(page){
  expect(await page.evaluate(()=>JSON.stringify(mcLoadRaw(mcStateKey()))===window.__paymentBefore)).toBe(true);
  expect(await page.evaluate(()=>window.__paymentWrites)).toEqual([]);
}
for(const kind of ['debt','receipt'])for(const missing of [false,true])test('R1 '+kind+' explicit '+(missing?'missing ID':'amount mismatch'),async({page})=>{
  const s=paymentFixture(kind==='debt'?'linked-debt':'receipt'),e=s.expenses[0];
  if(kind==='debt')e.amount=197.50;
  else {e.reciboId=s.fixed[0].id;e.amount=30.49;}
  if(missing)e[kind==='debt'?'debtId':'reciboId']='missing-synthetic';
  await openRound2(page,s);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:e.merchant}).click();
  const row=page.locator('.v4-exp-sheet .v4-ficha-adjust-row').filter({hasText:kind==='debt'?'Es la cuota de una deuda':'Paga un recibo'});
  await expect(row.locator('.value')).toHaveText(missing?'—':(kind==='debt'?s.debts[0].name:s.fixed[0].name)+' · sin confirmar');
  if(kind==='debt'&&!missing){await row.click();await expect(page.getByTestId('exp-cuota-de').locator('.v4-chip.on')).toContainText(s.debts[0].name);}
  expect(await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey());return expensePaymentRelationUI(s,s.expenses[0]);})).toBeNull();
  await unchangedRound2(page);
});
const round2Text={
  es:{due:'Por pagar',inside:'Se suma a lo que queda por pagar.',outside:'No se suma a lo que queda por pagar.',pending:'Por confirmar · 1',one:'Todo pagado, salvo 1 cargo por confirmar.',many:'Todo pagado, salvo 2 cargos por confirmar.'},
  en:{due:'Still to pay',inside:'Included in the amount left to pay.',outside:'Not included in the amount left to pay.',pending:'To confirm · 1',one:'Everything paid, except 1 charge awaiting confirmation.',many:'Everything paid, except 2 charges awaiting confirmation.'},
  ca:{due:'Per pagar',inside:'Es suma al que queda per pagar.',outside:'No es suma al que queda per pagar.',pending:'Per confirmar · 1',one:'Tot pagat, excepte 1 càrrec per confirmar.',many:'Tot pagat, excepte 2 càrrecs per confirmar.'}
};
for(const lang of ['es','en','ca']){
  test('A3 simple title and grouped transfers '+lang,async({page})=>{
    const s=paymentFixture('debt');s.flows=[{id:'transfer',kind:'transfer',name:'Movimiento previsto',from:'sabadell',to:'trade_republic',amount:100,day:25}];
    await openRound2(page,s,{lang,simpleMode:true});await page.locator('.botnav-tab[data-tour="plan"]').click();
    const due=page.getByTestId('plan-due');
    await expect(due.locator('.v4-section-h')).toHaveText(await page.evaluate(()=>t('v4_aun_saldra')));
    await expect(due).toContainText('Movimiento previsto');await expect(page.getByTestId('plan-transfers')).toHaveCount(0);
    await expect(due).toContainText(await page.evaluate(()=>t('v4_payment_mixed_hint')));
    if(lang==='ca')await expect(page.getByTestId('plan-unconfirmed')).toContainText('No es suma');
    await unchangedRound2(page);
  });
  test('R2 separate remaining and confirmation '+lang,async({page},info)=>{
    const s=paymentFixture('debt'),txt=round2Text[lang];await openRound2(page,s,{lang});
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    const plan=page.locator('div[data-seg="recibos"]'),pending=page.getByTestId('plan-unconfirmed');
    await expect.soft(plan).toContainText(txt.inside);await expect.soft(pending).toContainText(txt.outside);
    await expect.soft(pending.locator('.v4-section-h')).toHaveText(txt.pending);
    const row=pending.locator('.v4-charge');await expect.soft(row.locator('.sub')).toHaveText('Sabadell');
    await expect(row).toContainText('197');await expect(plan.locator('.v4-card-hero .serif')).toContainText('42');
    await pending.screenshot({path:info.outputPath('confirmation.png')});await unchangedRound2(page);
  });
  for(const count of [1,2])test('R3 complete summary '+lang+' '+count,async({page},info)=>{
    const s=paymentFixture('debt');s.fixed=[];
    // Un importe distinto evita que el arranque vincule el cargo existente a la segunda deuda.
    if(count===2)s.debts.push({...s.debts[0],id:'second-debt',name:'Segunda deuda sintetica',monthly:153});
    await openRound2(page,s,{lang,simpleMode:true});await page.locator('.botnav-tab[data-tour="plan"]').click();
    expect(await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey()),pack=planChargesMonth(s,10,2026,18),confirmed=paymentEvidenceUI(s,2026,10,18).confirmed;return pack.paidBills.filter(x=>!confirmed[x.id]).length;})).toBe(count);
    await expect(page.locator('.v4-plan-cover-simple')).toContainText(count===1?round2Text[lang].one:round2Text[lang].many);
    await page.locator('.v4-plan-cover-simple').screenshot({path:info.outputPath('cover.png')});
    await unchangedRound2(page);
  });
}

for(const kind of ['debt','receipt','linked-debt'])test(kind+' payment evidence agrees in Plan and detail',async({page},info)=>{
  test.info().annotations.push({type:'own-clock'});
  await page.clock.install({time:new Date('2026-10-18T12:00:00+02:00')});
  const state=paymentFixture(kind);
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await seedLoggedInDashboard(page,{...state,lastBackup:'2026-10-18',__seedOnce:true,settings:{autoPrices:false,theme:'green',lang:'es',expenseBanks:['sabadell']}});
  await page.addInitScript(()=>{
    const descriptor=Object.getOwnPropertyDescriptor(window,'supabase');
    window.__paymentWrites=[];
    Object.defineProperty(window,'supabase',{...descriptor,set(lib){
      descriptor.set(lib);const mock=descriptor.get();if(!mock)return;
      const create=mock.createClient;mock.createClient=function(...args){
        const client=create(...args),from=client.from.bind(client);
        client.from=function(table){const q=from(table);for(const method of ['insert','update','upsert','delete'])if(q[method]){
          const original=q[method];q[method]=function(...args){window.__paymentWrites.push({table,method});return original.apply(this,args);};
        }return q;};return client;
      };
    }});
  });
  await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
  await page.clock.runFor(6000);
  // Capture after startup reconciliation. Opening these views must not persist anything.
  const before=await page.evaluate(()=>JSON.stringify(mcLoadRaw(mcStateKey())));
  await page.evaluate(()=>{window.__paymentWrites=[];});
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('.botnav-tab.active')).toHaveAttribute('data-tour','plan');
  const name=kind==='receipt'?state.fixed[0].name:state.debts[0].name;
  const row=page.locator('div[data-seg="recibos"] .v4-charge').filter({hasText:name});
  await expect(row).toBeVisible();await expect(row).toContainText(kind==='receipt'?'29,99':'197,00');
  await expect(row).toBeInViewport({ratio:0.9});
  if(kind==='debt'){
    await expect.soft(row).not.toHaveClass(/v4-paid/);
    await expect.soft(row.locator('.sub')).toHaveText('Sabadell');
    await expect.soft(page.getByTestId('plan-unconfirmed')).toContainText('Por confirmar · 1');
    await expect.soft(row).not.toContainText('✓');
  }else await expect.soft(row).toHaveClass(/v4-paid/);
  await row.screenshot({path:info.outputPath('plan-row.png')});
  await page.screenshot({path:info.outputPath('plan.png')});
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:state.expenses[0].merchant}).click();
  const sheet=page.locator('.v4-exp-sheet');await expect(sheet).toBeVisible();
  if(kind==='receipt')await expect.soft(page.getByTestId('exp-receipt-value')).toHaveText(name);
  else await expect.soft(sheet.locator('.v4-ficha-adjust-row').filter({hasText:'Es la cuota de una deuda'}).locator('.value')).toHaveText(kind==='linked-debt'?name:'No');
  await expect.soft(sheet).not.toContainText('Esta retirada no suma dinero');
  if(kind==='receipt'){await page.getByTestId('exp-receipt').click();await expect(page.getByTestId('exp-receipt-value')).toHaveText(name);}
  await page.screenshot({path:info.outputPath('detail.png')});
  expect(await page.evaluate(()=>JSON.stringify(mcLoadRaw(mcStateKey())))).toBe(before);
  expect(await page.evaluate(()=>window.__paymentWrites)).toEqual([]);
});

test('confirmed withdrawal retains cash warning',async({page})=>{
  await page.clock.install({time:new Date('2026-10-18T12:00:00+02:00')});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const state=paymentFixture('debt');Object.assign(state.expenses[0],{category:'traspaso',withdrawalConfirmedAt:Date.parse('2026-10-17T12:00:00Z')});
  await seedLoggedInDashboard(page,{...state,lastBackup:'2026-10-18',settings:{autoPrices:false,lang:'es',expenseBanks:['sabadell']}});
  await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:state.expenses[0].merchant}).click();
  await expect(page.locator('.v4-exp-sheet')).toContainText('Esta retirada no suma dinero');
});

for(const lang of ['es','en','ca'])test('simple Plan calendar label '+lang,async({page},info)=>{
  await page.clock.install({time:new Date('2026-10-18T12:00:00+02:00')});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const state=paymentFixture('debt');state.fixed=[];
  await seedLoggedInDashboard(page,{...state,lastBackup:'2026-10-18',__seedOnce:true,settings:{autoPrices:false,lang,simpleMode:true,theme:'green',expenseBanks:['sabadell']}});
  await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const pending=page.getByTestId('plan-unconfirmed');
  await expect(pending).toContainText(round2Text[lang].pending);await expect(pending).not.toContainText('✓');
  await expect(page.locator('.v4-plan-cover-simple')).toContainText(round2Text[lang].one);
  await expect(page.locator('.v4-paid-fold')).toHaveCount(0);
  await pending.screenshot({path:info.outputPath('pending.png')});
});

// INC-1810-04 (YouTube Premium, rechazos de beta 4.26.145 y 4.26.148): «no deja enlazarlo». Abrir no escribe;
// el enlace solo existe tras pulsar y confirmar, y entonces Plan y la ficha lo cuentan igual.
// `overdue`: vencido por calendario, sin paidYm ni prueba, con un cargo del mismo comercio (4.26.148).
for(const kind of ['marked','calendar','overdue'])test('INC-1810-04 '+kind+' charge can be linked by the user',async({page})=>{
  const s=paymentFixture();s.bankTx=[];delete s.fixed[0].paymentProofs;s.expenses[0].amount=30.49;
  if(kind==='marked')s.expenses[0].reciboId=s.fixed[0].id;else if(kind==='calendar')Object.assign(s.fixed[0],{paidYm:24322,paidDay:10});
  await openRound2(page,s);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('div[data-seg="recibos"] .v4-charge').filter({hasText:'YouTube Premium'})).not.toHaveClass(/v4-paid/);
  if(kind==='calendar')await expect(page.getByTestId('plan-unconfirmed')).toContainText('YouTube Premium');
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:'YOUTUBE PREMIUM'}).click();
  await expect(page.getByTestId('exp-receipt-value')).toHaveText(kind==='marked'?'YouTube Premium · sin confirmar':'No');
  if(kind==='marked')await page.getByTestId('exp-recibo-si').click();
  else{await page.getByTestId('exp-receipt').click();await page.getByTestId('exp-receipt-receipt-synthetic').click();}
  const confirm=page.locator('.askback');
  await expect(confirm).toContainText('30,49');await expect(confirm).toContainText('29,99');
  await unchangedRound2(page);
  await confirm.locator('button.btn-primary').click();
  await expect(page.getByTestId('exp-receipt-value')).toHaveText('YouTube Premium');
  await expect(page.getByTestId('exp-recibo-si')).toHaveCount(0);
  await page.locator('.v4-exp-sheet .v4-ficha-done').click();
  // El guardado va con retardo: se espera a que llegue, sin adelantar el reloj.
  await expect.poll(()=>page.evaluate(()=>{const f=mcLoadRaw(mcStateKey()).fixed[0],p=f.paymentProofs&&f.paymentProofs[24322];return [p?p.kind:null,f.paidYm||null];})).toEqual(['expense',kind==='calendar'?24322:null]);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('div[data-seg="recibos"] .v4-paid').filter({hasText:'YouTube Premium'})).toHaveCount(1);
});
