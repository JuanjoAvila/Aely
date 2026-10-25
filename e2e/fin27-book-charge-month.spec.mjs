import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';
for(const proof of [false,true])test('FIN27: October still owes Netflix after September charge, '+(proof?'old persisted BOOK':'feed only'),async({page})=>{
 await page.clock.install({time:new Date('2026-10-18T12:00:00Z')});
 const f={id:'subscription',name:'Netflix',amount:12.99,freq:'mes',day:28,account:'sabadell'};
 const book={id:'-REF-A',ent:'sabadell',acc:'SYNTHETIC-ACCOUNT',date:'2026-10-02',merchant:'COMPRA NETFLIX',amount:12.99,status:'BOOK'};
 if(proof)f.paymentProofs={24322:{kind:'book',key:'sabadell|-REF-A',identity:JSON.stringify(['sabadell','2026-10-02',12.99,'COMPRA NETFLIX']),date:'2026-10-02',bank:'sabadell',merchant:'COMPRA NETFLIX',amount:12.99,modelVersion:2,receiptId:f.id,receiptName:f.name,model:JSON.stringify([f.id,'sabadell',12.99,null])}};
 await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:'account',ent:'sabadell',role:'ambos',spendFrom:true,value:1000,bankIban:'SYNTHETIC-ACCOUNT'}],fixed:[f],expenses:[{id:'charge',extId:'-REF-A',obAcc:'SYNTHETIC-ACCOUNT',date:'2026-09-30',merchant:'Netflix',obName:'COMPRA NETFLIX',amount:12.99,ent:'sabadell',category:'recibos',source:'ob',status:'BOOK'}],bankTx:[book],debts:[],oneoffs:[],flows:[],deleted:[],settings:{autoPrices:false,theme:'green',lang:'es'}});
 await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
 await page.locator('.botnav-tab[data-tour="plan"]').click();
 const pending=page.locator('div[data-seg="recibos"] .v4-charge:not(.v4-paid), div[data-seg="recibos"] .v4-mov:not(.v4-paid)').filter({hasText:'Netflix'});
 await expect(pending).toHaveCount(1);await expect(pending).toContainText(/12[,.]99/);
 // La ficha y los cálculos reales siguen nombrando septiembre, sin mover el asiento de caja.
 const result=await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey());return {september:planChargesMonth(s,9,2026,30).paidBillsTotal,october:planChargesMonth(s,10,2026,18).pendingBillsTotal,day:fixedPaymentDerivedDay(s,fixedPaymentState(s,s.fixed[0],2026,9,30)),cash:reconcileBank(s,2026,10,18).feed.reduce((v,t)=>v-Math.round(t.amount*100),0),balance:s.accounts[0].value};});
 expect(result).toEqual({september:12.99,october:12.99,day:30,cash:-1299,balance:1000});
 await page.reload();await dismissNews(page);await page.locator('.botnav-tab[data-tour="plan"]').click();await expect(pending).toHaveCount(1);
});
