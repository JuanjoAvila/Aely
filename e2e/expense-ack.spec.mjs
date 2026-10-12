import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';
import {installExpenseTable} from './expense-table-fixture.mjs';
const id='550e8400-e29b-41d4-a716-446655440011',date=new Date().toISOString();
async function enter(page){
  await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
}
async function setup(page,lang='es',source='manual',mode='zero'){
  await seedLoggedInDashboard(page,{__seedOnce:true,
    expenses:[{id,date,merchant:'Fixture café',amount:12,category:'bares',source,ent:'trade_republic',possibleDup:source==='ob'?true:undefined}],
    __cloudRows:{expenses:[{id,user_id:'e2e-user',fecha:date,comercio:'Fixture café',importe:12,cat:'bares',source:source+':trade_republic'+(source==='ob'?'#dup':''),nota:null,nota_edit:false,no_card:false}]},
    accounts:[{id:'fixture-tr',ent:'trade_republic',name:'Cuenta de prueba',role:'diario',value:100},{id:'fixture-rev',ent:'revolut',name:'Otra cuenta de prueba',role:'diario',value:100}],
    settings:{lang,autoPrices:false,budgetCycle:false,expenseBanks:['trade_republic','revolut']}});
  await installExpenseTable(page,mode);await enter(page);
}
const row=page=>page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:'Fixture café'});
const close=page=>page.locator('.v4-sheet-back').first().click({position:{x:5,y:5}});
async function note(page,value){
  await row(page).click();const label=await page.evaluate(()=>t('f_note_row'));
  await page.locator('.v4-ficha-adjust-row').filter({hasText:label}).click();
  await page.locator('.v4-exp-note-in').fill(value);await page.locator('.v4-exp-note-in').blur();await close(page);
}
async function retry(page,mode='ok'){
  await page.evaluate(mode=>{window.__expenseTable.mode=mode;window.__expenseTable.save()},mode);
  const pending=page.getByTestId('expense-pending');await pending.locator('summary').click();
  await pending.getByRole('button').first().click();
}
for(const lang of ['es','en','ca'])test('nota local pendiente, recarga y reintento confirmado '+lang,async({page})=>{
  await setup(page,lang);await note(page,'Nota sintética');
  await expect(row(page).locator('.nm-note')).toHaveText('Nota sintética');
  const text=await page.evaluate(()=>tf('exp_pending_n',{n:1}));
  await expect(page.getByTestId('expense-pending').locator('summary')).toHaveText(text);
  await page.reload();await dismissNews(page);await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(row(page).locator('.nm-note')).toHaveText('Nota sintética');await expect(page.getByTestId('expense-pending')).toBeVisible();
  await retry(page);await expect(page.getByTestId('expense-pending')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__e2eCloudRows.expenses[0].nota)).toBe('Nota sintética');
});
test('son distintos se aplica sin red y el pull no repone la duda',async({page})=>{
  await setup(page,'es','ob');await row(page).click();await page.getByRole('button',{name:'Son distintos',exact:true}).click();
  await expect(page.getByTestId('expense-pending')).toBeVisible();
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await row(page).click();await expect(page.getByRole('button',{name:'Son distintos',exact:true})).toHaveCount(0);await close(page);
  await retry(page);await expect(page.getByTestId('expense-pending')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__e2eCloudRows.expenses[0].source)).toBe('ob:trade_republic');
});
test('borrado local se puede deshacer sin DELETE ni INSERT',async({page})=>{
  await setup(page,'es','manual','ok');await row(page).click();
  await page.locator('.v4-ficha-del').click();
  await page.getByRole('button',{name:await page.evaluate(()=>t('v4_exp_del')),exact:true}).click();
  await expect(row(page)).toHaveCount(0);await page.getByRole('button',{name:'Deshacer',exact:true}).click();
  await expect(row(page)).toHaveCount(1);await expect(page.getByTestId('expense-pending')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__expenseTable.calls.filter(x=>x.deleted||x.insert))).toEqual([]);
});
test('respuesta perdida tras borrar conserva aviso, reintentar no inventa confirmación',async({page})=>{
  await setup(page,'es','ob','lost');await row(page).click();
  await page.getByRole('button',{name:'Es el mismo',exact:true}).click();
  await expect(row(page)).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>window.__e2eCloudRows.expenses.length)).toBe(0);
  await retry(page);await expect(page.getByTestId('expense-pending')).toBeVisible();
  await expect(page.getByTestId('expense-pending')).toContainText('No se ha podido confirmar');
});
test('colisión al editar conserva la decisión local y muestra conflicto',async({page})=>{
  await setup(page,'es','manual','unique');await row(page).click();
  await page.locator('.v4-exp-sheet .v4-ficha-concept').fill('Colisión sintética');
  await page.locator('.v4-exp-sheet .v4-ficha-concept').blur();await close(page);
  await page.getByTestId('expense-pending').locator('summary').click();
  await expect(page.getByTestId('expense-pending')).toContainText('cambió en otro dispositivo');
  await expect(page.locator('.v4-gastos-list-body [data-expense-id="'+id+'"]').first()).toContainText('Colisión sintética');
  expect(await page.evaluate(()=>window.__expenseTable.calls.filter(x=>x.deleted||x.insert))).toEqual([]);
});
test('renombrar un movimiento bancario conserva origen y UUID sin borrar ni crear',async({page})=>{
  await setup(page,'es','ob','ok');await row(page).click();
  await page.locator('.v4-exp-sheet .v4-ficha-concept').fill('Nombre corregido');
  await page.locator('.v4-exp-sheet .v4-ficha-concept').blur();await close(page);
  await expect(page.locator('.v4-gastos-list-body [data-expense-id="'+id+'"]').first()).toContainText('Nombre corregido');
  await expect.poll(()=>page.evaluate(()=>window.__e2eCloudRows.expenses[0].comercio)).toBe('Nombre corregido');
  const result=await page.evaluate(()=>({rows:window.__e2eCloudRows.expenses,calls:window.__expenseTable.calls}));
  expect(result.rows).toHaveLength(1);expect(result.rows[0].id).toBe(id);expect(result.rows[0].source).toBe('ob:trade_republic#dup');
  expect(result.calls.filter(x=>x.deleted||x.insert)).toEqual([]);
});
test('cambiar banco manual se ve de inmediato y queda pendiente con sesión perdida',async({page})=>{
  await setup(page);await page.evaluate(()=>{window.__expenseTable.session=false});await row(page).click();
  await page.getByTestId('exp-bank').click();await page.getByTestId('exp-bank-list').getByRole('button',{name:/Revolut/}).click();
  await expect(page.getByTestId('exp-bank')).toContainText('Revolut');await expect(page.locator('.v4-ficha-saved')).toHaveText('Pendiente de confirmación');await close(page);
  await page.getByTestId('expense-pending').locator('summary').click();await expect(page.getByTestId('expense-pending')).toContainText('Vuelve a iniciar sesión');
  await page.evaluate(()=>{window.__expenseTable.session=true;window.__expenseTable.mode='ok'});
  await page.getByTestId('expense-pending').getByRole('button').click();await expect(page.getByTestId('expense-pending')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__e2eCloudRows.expenses[0].source)).toBe('manual:revolut');
});
