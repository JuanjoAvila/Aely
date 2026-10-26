import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews,esperaNubeQuieta} from './fixtures.mjs';
const epoch=Date.parse('2026-10-18T12:00:00Z');
function fixture(bank='sabadell'){
 const f={id:'subscription',name:'Netflix',amount:12.99,freq:'mes',day:28,account:bank,paidYm:24322,paidDay:2};
 const book={id:'-REF-A',ent:bank,acc:'SYNTHETIC-ACCOUNT',date:'2026-10-02',merchant:'COMPRA NETFLIX',amount:12.99,status:'BOOK'};
 f.paymentProofs={24322:{kind:'book',key:bank+'|-REF-A',identity:JSON.stringify([bank,book.date,12.99,book.merchant]),date:book.date,bank,merchant:book.merchant,amount:12.99,modelVersion:2,receiptId:f.id,receiptName:f.name,model:JSON.stringify([f.id,bank,12.99,null])}};
 return {__seedOnce:true,_historyOwner:'e2e-user',accounts:[{id:'account',name:'Cuenta sintética',ent:bank,role:'ambos',spendFrom:true,value:1000,bankIban:'SYNTHETIC-ACCOUNT'}],fixed:[f],expenses:[{id:'charge',extId:'-REF-A',obAcc:'SYNTHETIC-ACCOUNT',date:'2026-09-30',merchant:'Netflix',obName:book.merchant,amount:12.99,ent:bank,category:'recibos',source:'ob',status:'BOOK'}],bankTx:[book],debts:[],oneoffs:[],flows:[],investments:[],deleted:[],budget:1000,settings:{autoPrices:false,theme:'green',lang:'es',expenseBanks:[bank],brokersOn:bank==='trade_republic'?['trade_republic']:[]}};
}
async function open(page,s){
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
 await page.clock.install({time:new Date(epoch)});await seedLoggedInDashboard(page,s);await page.goto('/');
 await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
 await page.locator('.botnav-tab[data-tour="cartera"]').click();
}
const account=page=>page.locator('button[data-account-id="account"]');
async function money(page,expected){
 const result=await page.evaluate(()=>{const s=mcLoadRaw(mcStateKey()),i=insumosSaldoGasto(s);return {shown:Math.round(saldoCuentaMostrada(s.accounts[0],i)*100),september:Math.round(planChargesMonth(s,9,2026,30).paidBillsTotal*100),october:Math.round(planChargesMonth(s,10,2026,18).paidBillsTotal*100),pending:Math.round(planChargesMonth(s,10,2026,18).pendingBillsTotal*100),cash:s.bankTx.reduce((n,tx)=>n-Math.round(tx.amount*100),0),expenseDate:s.expenses[0].date,bookDate:s.bankTx[0].date};});
 expect(result).toEqual({shown:expected,september:1299,october:0,pending:1299,cash:-1299,expenseDate:'2026-09-30',bookDate:'2026-10-02'});
}
async function snapshot(page,label){
 const state=await page.evaluate(()=>{const local=mcLoadRaw(mcStateKey());return {local:{accounts:local.accounts,fixed:local.fixed,_planSync:local._planSync??null},remote:window.__e2eCloudRows.app_state,acceptedWrites:window.__e2eStateWrites||0};});
 await test.info().attach(label,{body:JSON.stringify(state,null,2),contentType:'application/json'});
 return state;
}
test('cloud pull conserva el saldo entrante al retirar la marca de octubre',async({page})=>{
 const s=fixture(),incoming=JSON.parse(JSON.stringify(s));incoming.accounts[0].value=1400;incoming.fixed[0].day=29;incoming._savedAt=epoch+60000;delete incoming.__seedOnce;
 await open(page,{...s,__cloudRows:{app_state:[{user_id:'e2e-user',data:incoming,updated_at:'2026-10-18T12:00:01Z'}]}});
 await expect.poll(()=>page.evaluate(()=>mcLoadRaw(mcStateKey()).fixed[0].day)).toBe(29);
 await expect(account(page)).toContainText(/1\.?387,01/);await money(page,138701);
 await esperaNubeQuieta(page);
 await snapshot(page,'cloud-before-reload');
 const remote=await page.evaluate(()=>window.__e2eCloudRows.app_state);
 expect(remote[0].data.accounts[0].value).toBe(1387.01);
 expect(remote[0].data.fixed[0].paidYm).toBeUndefined();
 // El doble vive en la página: una recarga debe conservar las escrituras que el servidor
 // ya aceptó, en lugar de resucitar su respuesta inicial por addInitScript.
 await page.addInitScript(rows=>{window.__e2eCloudRows.app_state=rows;},remote);
 await page.reload();await dismissNews(page);await page.locator('.botnav-tab[data-tour="cartera"]').click();
 await expect(account(page)).toContainText(/1\.?387,01/);await money(page,138701);
 await esperaNubeQuieta(page);await snapshot(page,'cloud-after-reload');
});
for(const bank of ['sabadell','trade_republic'])test('sync real '+bank+' conserva saldo durante rekey sin saldo bancario aplicable',async({page})=>{
 const s=fixture(bank),aspsp=bank==='sabadell'?'Banco de Sabadell':'Trade Republic';
 const link=bank==='sabadell'?{aspsp,ok:false}:{aspsp,ok:true,accounts:[{uid:'synthetic',iban:'SYNTHETIC-ACCOUNT',ok:true,balances:[{type:'CLBD',amount:888.88,currency:'EUR'}],transactions:[{ext_id:'-REF-A',date:'2026-10-02',merchant:'COMPRA NETFLIX',amount:12.99,status:'BOOK'}]}]};
 await open(page,{...s,hasBankLink:true,__cloudRows:{bank_links:[{aspsp_name:aspsp,status:'active'}]},__cloudFns:{'bank-sync':{data:{ok:true,links:[link]},error:null}}});
 await expect(account(page)).toContainText(/987,01/);
 // El evento usa el sincronizador y su updater reales; no se invoca el helper aislado.
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mc-bank-role-changed')));
 await expect.poll(()=>page.evaluate(()=>mcLoadRaw(mcStateKey()).fixed[0].paymentProofs[24321]?.chargeDate)).toBe('2026-09-30');
 await expect(account(page)).toContainText(/987,01/);await money(page,98701);
 const calls=await page.evaluate(()=>(window.__e2eInvokes||[]).filter(x=>x.name==='bank-sync').length);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mc-bank-role-changed')));
 await expect.poll(()=>page.evaluate(()=>(window.__e2eInvokes||[]).filter(x=>x.name==='bank-sync').length)).toBe(calls+1);
 await expect(account(page)).toContainText(/987,01/);await money(page,98701);
});
