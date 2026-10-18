import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';
import {paymentFixture} from '../tests/fixtures/payment-ui.mjs';

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
    await expect.soft(row).toContainText('Pendiente de confirmar');
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

for(const [lang,label] of [['es','Pendiente de confirmar'],['en','Awaiting confirmation'],['ca','Pendent de confirmar']])test('simple Plan calendar label '+lang,async({page},info)=>{
  await page.clock.install({time:new Date('2026-10-18T12:00:00+02:00')});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const state=paymentFixture('debt');state.fixed=[];
  await seedLoggedInDashboard(page,{...state,lastBackup:'2026-10-18',__seedOnce:true,settings:{autoPrices:false,lang,simpleMode:true,theme:'green',expenseBanks:['sabadell']}});
  await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const pending=page.getByTestId('plan-unconfirmed');
  await expect(pending).toContainText(label);await expect(pending).not.toContainText('✓');
  await expect(page.locator('.v4-plan-cover-simple')).toContainText(label);
  await expect(page.locator('.v4-paid-fold')).toHaveCount(0);
  await pending.screenshot({path:info.outputPath('pending.png')});
});
