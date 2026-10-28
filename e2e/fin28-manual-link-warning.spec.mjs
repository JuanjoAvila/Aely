import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {seedLoggedInDashboard,dismissNews,esperaNubeQuieta} from './fixtures.mjs';

// FIN28: el parecido exige una decisión de la persona, sin convertirlo en identidad bancaria.
const labels={es:{warning:'Puede ser el mismo cargo que Netflix del ',other:'Es otro pago'},en:{warning:'This may be the same charge as Netflix on ',other:'It is another payment'},ca:{warning:'Pot ser el mateix càrrec que Netflix del ',other:'És un altre pagament'}};
async function open(page,lang='es',extra={}){
 await page.clock.install({time:new Date('2026-10-18T12:00:00Z')});
 await seedLoggedInDashboard(page,{__seedOnce:true,budget:1000,
  accounts:[{id:'account',ent:'sabadell',role:'ambos',spendFrom:true,value:1000}],
  fixed:[{id:'netflix',name:'Netflix',amount:12.99,freq:'mes',day:5,account:'sabadell'},{id:'classes',name:'Clases',amount:12.99,freq:'mes',day:6,account:'sabadell'}],
  expenses:[{id:'wallet',date:'2026-10-06',merchant:'Cargo sintético',amount:12.99,ent:'sabadell',category:'otros',source:'wallet'}],
  bankTx:[{id:'SYNTHETIC-BOOK',ent:'sabadell',date:'2026-10-05',merchant:'NETFLIX',amount:12.99,status:'BOOK'}],
  debts:[],oneoffs:[],flows:[],deleted:[],settings:{autoPrices:false,theme:'green',lang},...extra});
 const served=await page.request.get('/');
 expect(crypto.createHash('sha256').update(await served.body()).digest('hex')).toBe(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/index.html',import.meta.url))).digest('hex'));
 await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
}
async function choose(page,door){
 await page.evaluate(door=>document.querySelector('.botnav-tab[data-tour="'+door+'"]').click(),door);
 if(door==='gastos'){
  await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:'Cargo sintético'}).click();
  await page.getByTestId('exp-receipt').click();await page.getByTestId('exp-receipt-classes').click();
 }else{
  await page.locator('div[data-seg="recibos"] [data-recibo="fixed_classes"]').click();
  await page.locator('[data-act="pagado"]').click();await page.locator('[data-cargo="wallet"]').click();
 }
}
const snapshot=page=>page.evaluate(()=>{const s=mcLoadRaw(mcStateKey());return {fixed:s.fixed,expenses:s.expenses,bankTx:s.bankTx,accounts:s.accounts,spent:monthBudgetStats(s).spent,net:monthNetForAccount(s,'sabadell',2026,10,18)};});
const linked=page=>page.evaluate(()=>!!mcLoadRaw(mcStateKey()).fixed.find(f=>f.id==='classes').paymentProofs?.[24322]);
for(const door of ['gastos','plan'])for(const lang of ['es','en','ca'])test(door+' '+lang+': aviso, cancelar, segundo toque, recargar y deshacer',async({page})=>{
 await open(page,lang);const before=await snapshot(page);await choose(page,door);
 const ask=page.locator('.askback');await expect(ask).toContainText(labels[lang].warning);await expect(ask).toContainText('5');
 await expect(ask.getByRole('button',{name:labels[lang].other,exact:true})).toBeVisible();expect(await linked(page)).toBe(false);expect(await snapshot(page)).toEqual(before);
 await ask.locator('.btn-ghost').click();expect(await snapshot(page)).toEqual(before);
 if(door==='gastos')await page.getByTestId('exp-receipt-classes').click();else await page.locator('[data-cargo="wallet"]').click();
 await expect(ask).toContainText(labels[lang].warning);await ask.getByRole('button',{name:labels[lang].other,exact:true}).click();await expect.poll(()=>linked(page)).toBe(true);
 const after=await snapshot(page);expect(after.expenses).toEqual(before.expenses);expect(after.bankTx).toEqual(before.bankTx);expect(after.accounts).toEqual(before.accounts);expect(after.spent).toBe(before.spent);expect(after.net).toBe(before.net);
 expect(after.fixed.find(f=>f.id==='netflix')).toEqual(before.fixed.find(f=>f.id==='netflix'));
 await expect(page.locator('.askback')).toHaveCount(0);if(door==='plan')await expect(page.locator('[data-sheet="recibo"]')).toHaveCount(0);
 await page.reload();await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);expect(await linked(page)).toBe(true);await expect(page.locator('.askback')).toHaveCount(0);
 await page.evaluate(()=>document.querySelector('.botnav-tab[data-tour="gastos"]').click());await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:'Cargo sintético'}).click();await page.getByTestId('exp-receipt').click();await page.getByTestId('exp-receipt-unlink').click();await expect.poll(()=>linked(page)).toBe(false);
});
for(const door of ['gastos','plan'])test(door+': fuera de cuatro días no añade aviso',async({page})=>{
 await open(page,'es',{bankTx:[{id:'SYNTHETIC-BOOK',ent:'sabadell',date:'2026-10-01',merchant:'NETFLIX',amount:12.99,status:'BOOK'}]});await choose(page,door);
 if(door==='gastos'){await expect(page.locator('.askback')).not.toContainText('Puede ser el mismo cargo');await page.locator('.askback .btn-primary').click();}
 await expect.poll(()=>linked(page)).toBe(true);
});
for(const door of ['gastos','plan'])test(door+': otro banco no añade aviso',async({page})=>{
 await open(page,'es',{accounts:[{id:'account',ent:'sabadell',role:'ambos',spendFrom:true,value:1000},{id:'other',ent:'caixabank',role:'fijos',value:1000}],fixed:[{id:'netflix',name:'Netflix',amount:12.99,freq:'mes',day:5,account:'caixabank'},{id:'classes',name:'Clases',amount:12.99,freq:'mes',day:6,account:'sabadell'}],bankTx:[{id:'SYNTHETIC-BOOK',ent:'caixabank',date:'2026-10-05',merchant:'NETFLIX',amount:12.99,status:'BOOK'}]});
 await choose(page,door);if(door==='gastos'){await expect(page.locator('.askback')).not.toContainText('Puede ser el mismo cargo');await page.locator('.askback .btn-primary').click();}await expect.poll(()=>linked(page)).toBe(true);
});
for(const door of ['gastos','plan'])test(door+': una edición remota con el aviso abierto impide guardar y anunciar éxito',async({page})=>{
 await open(page);await esperaNubeQuieta(page);await choose(page,door);await expect(page.locator('.askback')).toContainText(labels.es.warning);
 await page.evaluate(async()=>{window.dispatchEvent(new Event('offline'));await new Promise(requestAnimationFrame);});
 await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey()),at=Date.now()+10000;const remote=planSyncEditState({...s,fixed:s.fixed.map(f=>f.id==='classes'?{...f,amount:13.99}:f)},at);window.__e2eCloudRows.app_state=[{user_id:'e2e-user',data:slimForCloud(remote),updated_at:new Date(at).toISOString()}];window.dispatchEvent(new Event('online'));});
 await expect.poll(()=>page.evaluate(()=>mcLoadRaw(mcStateKey()).fixed.find(f=>f.id==='classes').amount)).toBe(13.99);
 const before=await snapshot(page),writes=await page.evaluate(()=>(window.__e2eUpdates||[]).filter(r=>r.tabla==='expenses').length);
 await page.locator('.askback').getByRole('button',{name:labels.es.other,exact:true}).click();await expect(page.locator('.askback')).toHaveCount(0);
 await expect.poll(()=>linked(page)).toBe(false);expect(await snapshot(page)).toEqual(before);expect(await page.evaluate(()=>(window.__e2eUpdates||[]).filter(r=>r.tabla==='expenses').length)).toBe(writes);
 if(door==='plan')await expect(page.locator('.toast')).toContainText(await page.evaluate(()=>t('pr6_link_fail')));
});
test('plan: reponer la marca de un BOOK vetado conserva el flujo sin proof nueva',async({page})=>{
 const identity=JSON.stringify(['sabadell','2026-10-06',12.99,'CLASES']);
 await open(page,'es',{fixed:[{id:'classes',name:'Clases',amount:12.99,freq:'mes',day:6,account:'sabadell'}],expenses:[{id:'wallet',source:'ob',status:'BOOK',extId:'SYNTHETIC-RESTORE',date:'2026-10-06',amount:12.99,merchant:'Cargo sintético',obName:'CLASES',category:'recibos',ent:'sabadell'}],bankTx:[{id:'SYNTHETIC-RESTORE',ent:'sabadell',date:'2026-10-06',merchant:'CLASES',amount:12.99,status:'BOOK'}],reciboNo:['classes|'+identity,'classes|#wallet|'+identity]});
 await choose(page,'plan');await expect.poll(()=>page.evaluate(()=>mcLoadRaw(mcStateKey()).expenses[0].reciboId)).toBe('classes');
 expect(await linked(page)).toBe(false);await expect(page.locator('[data-sheet="recibo"]')).toHaveCount(0);await expect(page.locator('.toast')).toContainText('Clases pagado');
 expect(await page.evaluate(()=>mcLoadRaw(mcStateKey()).reciboNo.length)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>(window.__e2eUpdates||[]).filter(r=>r.tabla==='expenses'&&String(r.value.source).includes('recibo.classes')).length)).toBe(1);
});
