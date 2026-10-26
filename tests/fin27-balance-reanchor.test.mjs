// La migración del BOOK cambia su mes, no el dinero que ya mostraba la cuenta.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPureLogic} from '../scripts/load-pure-logic.mjs';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const js=JSON.parse(read('src/build-order.json')).map(f=>read('src/modules/'+f)).join('\n');
const c=loadPureLogic(read('src/shell.html').replace('<!--MC_APP_SCRIPT-->',()=>js));
c.Date=class extends Date {constructor(...a){super(...(a.length?a:['2026-10-18T12:00:00Z']));}static now(){return Date.parse('2026-10-18T12:00:00Z');}};
const cents=v=>Math.round(Number(v)*100),clone=v=>JSON.parse(JSON.stringify(v));
const selected=process.argv[2];let checks=0;
function check(name,fn){if(selected&&!selected.split(',').includes(name))return;fn();checks++;console.log('PASS '+name);}
function fixture({bank='sabadell',value=1000,day=28}={}){
 const f={id:'subscription',name:'Netflix',amount:12.99,freq:'mes',day,account:bank,paidYm:24322,paidDay:2};
 const tx={id:'-REF-A',ent:bank,acc:'SYNTHETIC-ACCOUNT',date:'2026-10-02',merchant:'COMPRA NETFLIX',amount:12.99,status:'BOOK'};
 f.paymentProofs={24322:c.fixedPaymentBind({kind:'book',key:bank+'|-REF-A',identity:c.fixedPaymentIdentity(bank,tx),date:tx.date,bank,merchant:tx.merchant,amount:12.99},f,10)};
 return {accounts:[{id:'account',ent:bank,role:'ambos',spendFrom:true,value,bankIban:'SYNTHETIC-ACCOUNT'}],fixed:[f],expenses:[{id:'charge',extId:'-REF-A',obAcc:'SYNTHETIC-ACCOUNT',date:'2026-09-30',merchant:'Netflix',obName:tx.merchant,amount:12.99,ent:bank,category:'recibos',source:'ob',status:'BOOK'}],bankTx:[tx],debts:[],oneoffs:[],flows:[],deleted:[],settings:{brokersOn:bank==='trade_republic'?['trade_republic']:[]}};
}
function shown(s){return cents(c.saldoCuentaMostrada(s.accounts[0],c.insumosSaldoGasto(s)));}
// Segundo oráculo desde los asientos originales: el débito sigue en octubre y sólo paga septiembre.
function money(s,bank='sabadell'){
 assert.equal(s.bankTx.reduce((n,tx)=>n-cents(tx.amount),0),-1299,'caja original BOOK');
 assert.equal(c.reconcileBank(s,2026,10,18).feed.reduce((n,tx)=>n-cents(tx.amount),0),-1299,'caja del producto');
 assert.equal(cents(c.planChargesMonth(s,9,2026,30).paidBillsTotal),1299,'una cuota pagada en septiembre');
 assert.equal(cents(c.planChargesMonth(s,10,2026,18).paidBillsTotal),0,'octubre sigue pendiente');
 assert.equal(cents(c.planChargesMonth(s,10,2026,18).pendingBillsTotal),1299);
 assert.equal(s.expenses[0].date,'2026-09-30');assert.equal(s.bankTx[0].date,'2026-10-02');
 assert.equal(cents(c.monthNetForAccount(s,bank,2026,10,null)),-1299,'proyección mensual conserva una cuota');
}
check('cloud',()=>{
 const prev=fixture(),incoming={...clone(prev),accounts:[{...prev.accounts[0],value:1400}]};
 const before=JSON.stringify(incoming),next=c.planSyncDerived(incoming,prev);
 assert.equal(shown(incoming),138701,'saldo entrante, incluye el cambio legítimo de la nube');
 console.log(JSON.stringify({path:'cloud',beforeCents:shown(incoming),afterCents:shown(next),deltaCents:shown(next)-shown(incoming)}));
 assert.equal(shown(next),138701,'derivar las marcas no suma 1299c ni resta el cambio de nube');
 assert.equal(JSON.stringify(incoming),before,'no muta el estado entrante');money(next);
 assert.equal(shown(c.planSyncDerived(next,incoming)),138701,'replay sin doble reanclaje');
});
for(const bank of ['sabadell','trade_republic'])check(bank,()=>{
 const s=fixture({bank}),before=JSON.stringify(s),rekey=c.reconcileFixedPaymentProofs(s,2026,10,18);
 const links=bank==='sabadell'?[{aspsp:'Banco de Sabadell',ok:false}]:[{aspsp:'Trade Republic',ok:true,balances:[{type:'CLBD',amount:888.88,currency:'EUR'}]}];
 const next=c.applyBankBalances(rekey,links).state;
 assert.equal(shown(s),98701,'saldo anterior a la migración');
 console.log(JSON.stringify({path:bank,beforeCents:shown(s),afterCents:shown(next),deltaCents:shown(next)-shown(s)}));
 assert.equal(shown(next),98701,'el banco fallido o el puente TR no reparan el salto de la migración');
 assert.equal(JSON.stringify(s),before,'no muta la fuente');money(next,bank);
 assert.equal(next.fixed[0].paymentProofs[24322],undefined);assert.equal(next.fixed[0].paymentProofs[24321].chargeDate,'2026-09-30');
 assert.equal(shown(c.reconcileFixedPaymentProofs(next,2026,10,18)),98701,'rekey idempotente');
});
check('incoming-accounts',()=>{
 const prev=fixture(),incoming=clone(prev);
 incoming.accounts=[{id:'other',ent:'revolut',role:'fijos',value:72.35},{...incoming.accounts[0],value:1400,name:'Nombre entrante'}];
 const next=c.planSyncDerived(incoming,prev),input=c.insumosSaldoGasto(next);
 assert.equal(cents(c.saldoCuentaMostrada(next.accounts[1],input)),138701);
 assert.equal(cents(c.saldoCuentaMostrada(next.accounts[0],input)),7235);
 assert.equal(next.accounts[1].name,'Nombre entrante');assert.equal(next.accounts[0],incoming.accounts[0]);
 assert.equal(c.planSyncDerived(next,next),next,'no hace trabajo si no cambia fixed');money(next);
});
check('zero-negative-roles',()=>{
 for(const value of [12.99,0,-100.05])for(const role of ['fijos','ambos']){
  const s=fixture({value});s.accounts[0].role=role;s.accounts[0].spendFrom=role!=='fijos';
  const expected=cents(value)-1299,prev=clone(s);
  for(const migrate of [state=>c.reconcileFixedPaymentProofs(state,2026,10,18),state=>c.planSyncDerived(state,prev)]){
   const n=migrate(s);assert.equal(shown(s),expected);assert.equal(shown(n),expected,role+' '+value);
   assert.equal(shown(migrate(n)),expected,'repetir no vuelve a compensar');money(n);
  }
 }
});
check('later-successful-sync',()=>{
 const s=fixture(),migrated=c.reconcileFixedPaymentProofs(s,2026,10,18);
 const link={aspsp:'Banco de Sabadell',ok:true,accounts:[{uid:'synthetic',iban:'SYNTHETIC-ACCOUNT',balances:[{type:'CLBD',amount:765.43,currency:'EUR'}]}]};
 const synced=c.applyBankBalances(migrated,[link]);
 assert.equal(synced.synced.length,1);assert.equal(shown(synced.state),76543,'el saldo nuevo del banco sí sustituye al anterior');money(synced.state);
 const replay=c.reconcileFixedPaymentProofs(synced.state,2026,10,18);
 assert.equal(replay,synced.state);assert.equal(shown(c.applyBankBalances(replay,[link]).state),76543);
 const cloud={...clone(replay),bankTx:[],expenses:[]},derived=c.planSyncDerived(cloud,replay);
 assert.equal(shown(derived),76543,'viaje cloud sin extracto no compensa una segunda vez');
 assert.equal(cents(c.planChargesMonth(derived,9,2026,30).paidBillsTotal),1299);
 assert.equal(cents(c.planChargesMonth(derived,10,2026,18).paidBillsTotal),0);
});
check('missing-allocation-source',()=>{
 for(const missing of ['reference','feed','charge']){
  const s=fixture();if(missing==='reference')s.expenses[0].extId='OTHER';if(missing==='feed'){s.bankTx=[];s.expenses=[];}if(missing==='charge')s.expenses=[];
  const before=JSON.stringify(s),n=c.reconcileFixedPaymentProofs(s,2026,10,18),d=c.planSyncDerived(clone(s),s);
  for(const result of [n,d]){assert.equal(shown(result),98701,missing);assert.equal(result.fixed[0].paidYm,24322,'sin fuente exacta conserva la marca');assert.equal(result.fixed[0].paymentProofs[24321],undefined);}
  assert.equal(JSON.stringify(s),before);
 }
 const partial=fixture();partial.bankTx=[];
 const moved=c.reconcileFixedPaymentProofs(partial,2026,10,18);
 assert.equal(shown(moved),98701,'la fila exacta local basta aunque falte el feed');
 assert.equal(moved.fixed[0].paymentProofs[24321].chargeDate,'2026-09-30');
 assert.equal(cents(c.planChargesMonth(moved,9,2026,30).paidBillsTotal),1299);
 assert.equal(cents(c.planChargesMonth(moved,10,2026,18).paidBillsTotal),0);
});
check('year-boundary',()=>{
 const previousDate=c.Date;c.Date=class extends Date{constructor(...a){super(...(a.length?a:['2027-01-10T12:00:00Z']));}static now(){return Date.parse('2027-01-10T12:00:00Z');}};
 const s=fixture(),f=s.fixed[0],tx=s.bankTx[0];tx.date='2027-01-02';s.expenses[0].date='2026-12-31';f.paidYm=24325;
 f.paymentProofs={24325:c.fixedPaymentBind({kind:'book',key:'sabadell|-REF-A',identity:c.fixedPaymentIdentity('sabadell',tx),date:tx.date,bank:'sabadell',merchant:tx.merchant,amount:12.99},f,1)};
 for(const n of [c.reconcileFixedPaymentProofs(s,2027,1,10),c.planSyncDerived(clone(s),s)]){
  assert.equal(shown(n),98701,'el cambio de año tampoco mueve el saldo');
  assert.equal(cents(c.planChargesMonth(n,12,2026,31).paidBillsTotal),1299);
  assert.equal(cents(c.planChargesMonth(n,1,2027,10).paidBillsTotal),0);
 }
 c.Date=previousDate;
});
assert(checks>0,'caso focal existente');
console.log(checks+' FIN27 balance reanchor checks; TZ='+process.env.TZ);
