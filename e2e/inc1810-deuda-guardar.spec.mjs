import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';

// INC1810-01: separar un Guardar válido de la negativa financiera de FIN16.
// La fecha fija deja cuatro cuotas pagadas y seis pendientes, sin depender del día del CI.
const debt={id:'inc1810',name:'Préstamo sintético',value:2000,original:2000,monthly:200,amort:200,months:10,day:25,asOf:2026*12+5,apr:null,unknown:{keep:7}};
const saved=page=>page.evaluate(()=>{
 const s=JSON.parse(localStorage.getItem('micartera_v3'));
 return {debts:s.debts,fixed:s.fixed,goals:s.goals,expenses:localStorage.getItem('micartera_v3_exp')};
});
const sheet=page=>page.getByRole('dialog',{name:'Editar deuda',exact:true});
const save=page=>sheet(page).getByRole('button',{name:'Guardar cambios',exact:true});
async function open(page){
 await page.clock.install({time:new Date('2026-10-18T12:00:00Z')});
 await seedLoggedInDashboard(page,{__seedOnce:true,debts:[debt],expenses:[],settings:{lang:'es',autoPrices:false,theme:'green',reservaRules:[]}});
 await page.goto('/');await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
 await page.locator('.botnav-tab[data-tour="plan"]').click();await page.getByRole('tab',{name:'Deudas',exact:true}).click();
 await page.locator('[data-debt-id="inc1810"] .plan-item-open').click();await expect(sheet(page)).toBeVisible();
}
async function reload(page,expected){
 await page.reload();await page.waitForFunction(()=>!document.getElementById('mc-load'));
 expect(await saved(page)).toEqual(expected);
}

test('INC1810: Guardar sin cambios cierra y conserva todos los datos tras recargar',async({page})=>{
 await open(page);const before=await saved(page);
 await save(page).click();await expect(sheet(page)).toHaveCount(0);
 await expect(page.getByText('Cambios guardados',{exact:true})).toHaveCount(1);
 expect(await saved(page)).toEqual(before);await reload(page,before);
});

test('INC1810: editar nombre, nota y TAE guarda sin alterar saldo ni calendario',async({page})=>{
 await open(page);const before=await saved(page);
 for(const [key,value] of Object.entries({name:'Nombre corregido',note:'Nota sintética',apr:'1,05'}))await sheet(page).locator('[data-debt-field="'+key+'"]').fill(value);
 await save(page).click();await expect(sheet(page)).toHaveCount(0);
 const expected={...before,debts:[{...before.debts[0],name:'Nombre corregido',note:'Nota sintética',apr:1.05}]};
 await expect.poll(()=>saved(page)).toEqual(expected);await reload(page,expected);
});

test('INC1810: subir cuota válida conserva el pendiente al céntimo y persiste',async({page})=>{
 await open(page);const before=await saved(page);
 await sheet(page).locator('[data-debt-field="monthly"]').fill('210,01');await save(page).click();await expect(sheet(page)).toHaveCount(0);
 const expected={...before,debts:[{...before.debts[0],monthly:210.01,amort:210.01,value:2040.04,settledAt:null,archivedAt:null}]};
 await expect.poll(()=>saved(page)).toEqual(expected);
 expect(Math.round((expected.debts[0].value-4*expected.debts[0].amort)*100)).toBe(120000);
 await reload(page,expected);
});

test('INC1810 FIN16: bajar cuota insuficiente responde cada vez y cancelar no escribe',async({page})=>{
 await open(page);const before=await saved(page),alert=sheet(page).getByRole('alert');
 for(const monthly of ['100','90']){
  await sheet(page).locator('[data-debt-field="monthly"]').fill(monthly);await save(page).click();
  await expect(alert).toContainText('El plazo y la cuota no encajan con el saldo pendiente. Revisa el plazo o la cuota.');
  await expect(alert).toContainText('entre 200,00 € y 239,99 €');
  await expect(alert).toBeFocused();await expect(alert).toBeInViewport({ratio:1});
  await expect(sheet(page)).toBeVisible();await expect(save(page)).toBeEnabled();expect(await saved(page)).toEqual(before);
 }
 await sheet(page).getByRole('button',{name:'Cancelar',exact:true}).click();await expect(sheet(page)).toHaveCount(0);await reload(page,before);
});

test('INC1810: campo mal formado muestra error, conserva borrador y permite corregir',async({page})=>{
 await open(page);const before=await saved(page),field=sheet(page).locator('[data-debt-field="monthly"]');
 await field.fill('1,2,3');await save(page).click();const alert=sheet(page).getByRole('alert');
 await expect(alert).not.toBeEmpty();await expect(alert).toBeFocused();await expect(alert).toBeInViewport({ratio:1});
 await expect(field).toHaveValue('1,2,3');await expect(save(page)).toBeEnabled();expect(await saved(page)).toEqual(before);
 await field.fill('200');await save(page).click();await expect(sheet(page)).toHaveCount(0);await reload(page,before);
});
