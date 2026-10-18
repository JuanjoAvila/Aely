import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from "./fixtures.mjs";
const texts={es:{tab:'Deudas',edit:'Editar deuda',save:'Guardar cambios',error:'El plazo y la cuota no encajan con el saldo pendiente. Revisa el plazo o la cuota.',range:'Con 6 cuotas por pagar, la cuota tiene que estar entre 200,00 € y 239,99 €.'},en:{tab:'Debts',edit:'Edit debt',save:'Save changes',error:'The term and payment do not match the remaining balance. Check the term or payment.',range:'With 6 payments left, the payment must be between 200,00 € and 239,99 €.'},ca:{tab:'Deutes',edit:'Edita el deute',save:'Desa els canvis',error:'El termini i la quota no encaixen amb el saldo pendent. Revisa el termini o la quota.',range:"Amb 6 quotes per pagar, la quota ha d'estar entre 200,00 € i 239,99 €."}};
const original={id:'feedback',name:'Préstamo sintético',value:2000,monthly:200,amort:200,months:10,day:25,asOf:2026*12+5,original:2000,apr:null,unknown:{keep:7}};
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('micartera_v3')).debts);
async function open(page,lang,debt=original){
 await page.clock.install({time:new Date('2026-10-18T12:00:00Z')});await seedLoggedInDashboard(page,{__seedOnce:true,debts:[debt],expenses:[],settings:{lang,autoPrices:false,theme:'green',reservaRules:[]}});
 await page.goto('/');await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);await page.locator('.botnav-tab[data-tour="plan"]').click();await page.getByRole('tab',{name:texts[lang].tab,exact:true}).click();await page.locator('[data-debt-id="feedback"] .plan-item-open').click();return page.getByRole('dialog',{name:texts[lang].edit,exact:true});
}
for(const lang of Object.keys(texts))test(`Guardar ${lang}: rechazo visible, segundo intento y corrección persistida`,async({page},info)=>{
 const sheet=await open(page,lang),t=texts[lang],before=await saved(page),button=sheet.getByRole('button',{name:t.save,exact:true});
 await sheet.locator('[data-debt-field="monthly"]').fill('100');await button.click();const alert=sheet.getByRole('alert');
 await expect(alert).toHaveText(t.error+' '+t.range);expect(await saved(page)).toEqual(before);await expect(alert).toBeInViewport({ratio:1});await expect(alert).toBeFocused();await page.screenshot({path:info.outputPath('rechazo-'+lang+'.png')});
 // Mismo rechazo, mismo texto: debe responder también después de apartarse del aviso.
 await sheet.locator('[data-debt-field="monthly"]').fill('90');await button.click();await expect(alert).toBeFocused();await expect(alert).toBeInViewport({ratio:1});expect(await saved(page)).toEqual(before);
 await sheet.locator('[data-debt-field="monthly"]').fill('200,01');await sheet.locator('[data-debt-field="apr"]').fill('1,50');await sheet.locator('[data-debt-field="name"]').fill('Nombre corregido');await button.click();await expect(sheet).toHaveCount(0);
 const expected={...before[0],name:'Nombre corregido',monthly:200.01,amort:200.01,apr:1.5,value:2000.04,settledAt:null,archivedAt:null};await expect.poll(async()=>saved(page)).toEqual([expected]);expect(await page.evaluate(d=>Math.round(debtBalance(d)*100),expected)).toBe(120000);
 await page.reload();await page.waitForFunction(()=>!document.getElementById('mc-load'));expect(await saved(page)).toEqual([expected]);
});
test('Guardar: rechazo repetido sin rango y deuda terminada conservan datos',async({page})=>{
 const debt={...original,value:2000,asOf:2026*12+9-10},sheet=await open(page,'es',debt),before=await saved(page),button=sheet.getByRole('button',{name:texts.es.save,exact:true});
 for(const key of ['balance','monthly','months','day','apr'])await expect(sheet.locator('[data-debt-field="'+key+'"]')).toBeDisabled();
 for(let i=0;i<2;i++){await sheet.locator('[data-debt-field="name"]').fill(' ');await button.click();await expect(sheet.getByRole('alert')).toBeFocused();await expect(sheet.getByRole('alert')).toBeInViewport({ratio:1});expect(await saved(page)).toEqual(before);await sheet.locator('[data-debt-field="name"]').fill('Temporal');}
 await sheet.locator('[data-debt-field="name"]').fill('Terminada corregida');await button.click();await expect(sheet).toHaveCount(0);await expect.poll(async()=>saved(page)).toEqual([{...before[0],name:'Terminada corregida'}]);
});
