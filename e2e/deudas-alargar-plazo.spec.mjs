import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from "./fixtures.mjs";
const original={id:'extend',name:'Préstamo sintético',value:2000,monthly:200,amort:200,months:10,day:25,asOf:2026*12+5,original:2000,apr:0,paidYm:[24320],unknown:{keep:7}};
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('micartera_v3')));
const copy={es:{tab:'Deudas',edit:'Editar deuda',save:'Guardar cambios',action:'Alargar el plazo a 16 meses',error:'El plazo y la cuota no encajan',unknown:'No se puede calcular un plazo con esta TAE'},en:{tab:'Debts',edit:'Edit debt',save:'Save changes',action:'Extend the term to 16 months',error:'The term and payment do not match',unknown:'A term cannot be calculated with this APR'},ca:{tab:'Deutes',edit:'Edita el deute',save:'Desa els canvis',action:'Allarga el termini a 16 mesos',error:'El termini i la quota no encaixen',unknown:'No es pot calcular un termini amb aquesta TAE'}};
async function open(page,lang,debt=original){
 await page.clock.install({time:new Date('2026-10-19T12:00:00Z')});
 await seedLoggedInDashboard(page,{__seedOnce:true,debts:[debt],expenses:[{id:'linked-history',date:'2026-09-25',amount:200,account:'sabadell',category:'debt',debtId:'extend',reciboId:'historical-receipt',paymentProof:{version:2,keep:'synthetic'}}],settings:{lang,autoPrices:false,theme:'green',reservaRules:[]}});
 await page.goto('/');await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
 await page.locator('.botnav-tab[data-tour="plan"]').click();await page.getByRole('tab',{name:copy[lang].tab,exact:true}).click();await page.locator('[data-debt-id="extend"] .plan-item-open').click();return page.getByRole('dialog',{name:copy[lang].edit,exact:true});
}
const links=page=>page.evaluate(()=>localStorage.getItem('micartera_v3_exp'));
for(const lang of Object.keys(copy))test(`Bajar cuota ${lang}: ofrece alargar, conserva borrador hasta elegir y guarda plazo explícito`,async({page},info)=>{
 const t=copy[lang],sheet=await open(page,lang),before=await saved(page),history=await links(page);
 await sheet.locator('[data-debt-field="monthly"]').fill('100');await sheet.getByRole('button',{name:t.save,exact:true}).click();
 await expect(sheet.getByRole('alert')).toContainText(t.error);await expect(sheet.locator('[data-debt-field="months"]')).toHaveValue('10');
 expect((await saved(page)).debts).toEqual(before.debts);await page.screenshot({path:info.outputPath('antes-alargar.png')});
 await info.attach('antes-persistido',{body:Buffer.from(JSON.stringify(before)),contentType:'application/json'});
 const extend=sheet.getByRole('button',{name:t.action,exact:true});await expect(extend).toBeVisible();await extend.click();
 await expect(sheet.locator('[data-debt-field="months"]')).toHaveValue('16');expect((await saved(page)).debts).toEqual(before.debts);
 await expect(sheet.getByRole('alert')).toHaveCount(0);await page.screenshot({path:info.outputPath('plazo-elegido.png')});await sheet.getByRole('button',{name:t.save,exact:true}).click();await expect(sheet).toHaveCount(0);
 const expected={...before.debts[0],monthly:100,amort:100,months:16,value:1600,settledAt:null,archivedAt:null};
 await expect.poll(async()=>(await saved(page)).debts).toEqual([expected]);
 expect(await page.evaluate(d=>({balance:Math.round(debtBalance(d)*100),paid:debtPaidCount(d),left:debtLeft(d)}),expected)).toEqual({balance:120000,paid:4,left:12});
 expect(await links(page)).toBe(history);for(const key of ['accounts','fixed','flows','oneoffs','goals'])expect((await saved(page))[key]).toEqual(before[key]);
 await expect(page.locator('[data-debt-id="extend"]')).toContainText('12/16');
 await page.screenshot({path:info.outputPath('despues-guardado.png')});
 await page.reload();await page.waitForFunction(()=>!document.getElementById('mc-load'));expect((await saved(page)).debts).toEqual([expected]);expect(await links(page)).toBe(history);
});
for(const lang of Object.keys(copy))test(`Legado con TAE ${lang}: mensaje sin plazo inventado`,async({page})=>{
 const debt={...original,apr:12};delete debt.amort;const sheet=await open(page,lang,debt),before=await saved(page),history=await links(page),t=copy[lang];
 await sheet.locator('[data-debt-field="monthly"]').fill('10');await sheet.getByRole('button',{name:t.save,exact:true}).click();await expect(sheet.getByRole('alert')).toContainText(t.error);await expect(sheet.getByRole('status')).toContainText(t.unknown);
 await expect(sheet.getByRole('button',{name:/Alargar|Extend|Allarga/})).toHaveCount(0);expect((await saved(page)).debts).toEqual(before.debts);expect(await links(page)).toBe(history);
});
test('Subir cuota mantiene el plazo y no ofrece alargar',async({page})=>{
 const sheet=await open(page,'es'),before=await saved(page);await sheet.locator('[data-debt-field="monthly"]').fill('210');await sheet.getByRole('button',{name:copy.es.save,exact:true}).click();await expect(sheet).toHaveCount(0);
 await expect.poll(async()=>(await saved(page)).debts).toEqual([{...before.debts[0],monthly:210,amort:210,value:2040,settledAt:null,archivedAt:null}]);
});
