import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";
const c=loadPureLogicFromFile();
c.Date=class extends Date { constructor(...args){ super(...(args.length?args:[new Date("2026-09-30T12:00:00+02:00").getTime()])); } };
const fixed={id:"gas",name:"Gas ficticio",amount:42,freq:"mes",day:25,account:"sabadell",wait:2026*12+9};
const tx={id:"gas-bank",ent:"sabadell",date:"2026-09-25",amount:42,merchant:"Gas ficticio",status:"BOOK"};
const base={accounts:[{id:"sb",ent:"sabadell",role:"fijos",value:800}],fixed:[fixed],bankTx:[tx],debts:[],oneoffs:[],expenses:[]};
const check=(overrides={},f=fixed,m=9,y=2026,t=30)=>c.fixedPaymentState(Object.assign({},base,overrides),f,y,m,t);
assert.equal(check().paid,true,"el pago BOOK vence a wait");
assert.equal(check().day,25);
assert.equal(check({bankTx:[]}).overdue,true,"pasar el día no acredita pago");
assert.equal(check({bankTx:[]},Object.assign({},fixed,{wait:undefined})).paid,false);
for(const patch of [{status:"PDNG"},{status:""},{status:undefined},{date:"2026-10-25"},{date:"2026-08-25"},{date:"2026-09-31"},{ent:"revolut"},{amount:-42},{amount:99},{merchant:"Compra distinta"},{possibleDup:true}]){
  assert.equal(check({bankTx:[Object.assign({},tx,patch)]}).paid,false,JSON.stringify(patch));
}
assert.equal(check({bankTx:[Object.assign({},tx,{date:"2026-09-29"})]},fixed,9,2026,28).paid,false,"fecha bancaria futura");
assert.equal(check({bankTx:[tx,Object.assign({},tx,{id:"other"})]}).paid,false,"dos pagos compatibles son ambiguos");
assert.equal(check({fixed:[fixed,Object.assign({},fixed,{id:"other"})]}).paid,false,"dos recibos compatibles son ambiguos");
assert.equal(check({oneoffs:[{id:"other",name:fixed.name,amount:42,account:"sabadell",month:9,year:2026,day:25}]}).paid,false,"un puntual también puede reclamar el cargo");
assert.equal(check({accounts:base.accounts.concat([{id:"sb2",ent:"sabadell",role:"fijos"}])}).paid,false,"sin identidad de cuenta no se atribuye a dos cuentas del banco");
assert.equal(check({bankTx:[]},Object.assign({},fixed,{day:31})).overdue,false);
assert.equal(check({bankTx:[]},Object.assign({},fixed,{day:null})).day,null,"sin fecha no inventa día 1");
const schedule=Object.assign({},fixed,{freq:"año",schedule:[{m:9,day:25,amt:51}]});
assert.equal(check({fixed:[schedule],bankTx:[Object.assign({},tx,{amount:51})]},schedule).paid,true,"importe del calendario");
const persisted=Object.assign({},fixed,{paidYm:2026*12+9,paidDay:25});
assert.equal(check({bankTx:[]},persisted).paid,true,"confirmación persistida sin extracto local");
assert.equal(check({bankTx:[]},persisted,10).paid,false,"no arrastra confirmación al mes siguiente");
assert.equal(check({bankTx:[]},Object.assign({},persisted,{paidDay:31})).paid,false,"confirmación futura no es pago de hoy");
assert.equal(check({bankTx:[]},Object.assign({},persisted,{paidDay:undefined})).paid,false,"el mes solo no acredita una fecha");
const saved=JSON.stringify(base);
check();
assert.equal(JSON.stringify(base),saved,"la lectura no cambia saldos, fijos ni movimientos");
let edited;
c.patchFixedById(updater=>{ edited=updater(Object.assign({},base,{bankTx:[Object.assign({},tx,{status:"PDNG"})]})); },"gas",{day:25});
assert.equal(edited.fixed[0].paidYm,undefined,"editar con cargo PDNG no persiste una confirmación falsa");
assert.equal(JSON.stringify(edited.expenses),JSON.stringify(base.expenses));
assert.equal(JSON.stringify(edited.accounts),JSON.stringify(base.accounts));
console.log("fixed-payment-state: OK");

// Nombres distintos y otro banco: se confirma la identidad, nunca solo el importe (rechazo 30/9).
const otherName=Object.assign({},tx,{merchant:"PROVEEDOR SINTETICO SA"});
const expense={id:"cargo",date:"2026-09-25T12:00:00.000Z",merchant:otherName.merchant,amount:42,ent:"revolut",source:"wallet",category:"otros"};
const unlinked=Object.assign({},base,{bankTx:[],expenses:[expense]});
assert.equal(check({bankTx:[otherName],expenses:[expense]}).paid,false,"importe 1:1 no acredita identidad");
const confirmed=c.linkFixedPayment(unlinked,expense.id,fixed.id,2026,9,30);
assert.notEqual(confirmed,unlinked);
assert.equal(c.fixedPaymentState(confirmed,confirmed.fixed[0],2026,9,30).paid,true,"confirmación explícita con nombre y banco distintos");
assert.equal(c.fixedPaymentState(confirmed,confirmed.fixed[0],2026,9,30).paidBank,"revolut","el banco del pago es el del cargo, no el previsto");
assert.equal(confirmed.expenses,unlinked.expenses,"no reescribe ni retira el cargo");
assert.equal(confirmed.accounts,unlinked.accounts,"no cambia los anclajes de saldo");
assert.equal(c.monthNetForAccount(confirmed,"sabadell",2026,9,30),c.monthNetForAccount(unlinked,"sabadell",2026,9,30));
assert.equal(c.monthBudgetStats(confirmed).spent,c.monthBudgetStats(unlinked).spent,"no añade otro descuento");
assert.equal(confirmed.fixed[0].paidYm,unlinked.fixed[0].paidYm,"no convierte prueba en calendario financiero");
const snapshot=c.slimForCloud(confirmed);
assert.equal(snapshot.bankTx,undefined);
assert.equal(c.fixedPaymentState(snapshot,snapshot.fixed[0],2026,9,30).paid,true,"sobrevive sin feed ni expenses locales");
assert.equal(c.fixedPaymentState(confirmed,confirmed.fixed[0],2026,10,30).paid,false,"no arrastra al mes siguiente");
assert.equal(c.fixedPaymentState(confirmed,Object.assign({},confirmed.fixed[0],{amount:50}),2026,9,30).paid,false,"cambiar el modelo invalida prueba");
for(const patch of [{possibleDup:true},{amount:-42},{amount:Infinity},{date:"2026-10-25"},{date:"2026-09-31"},{category:"deudas"},{category:"traspaso"},{status:"PDNG"},{debtId:"deuda"}]){
  const bad=Object.assign({},unlinked,{expenses:[Object.assign({},expense,patch)]});
  assert.equal(c.linkFixedPayment(bad,expense.id,fixed.id,2026,9,30),bad,JSON.stringify(patch));
}
const second=Object.assign({},fixed,{id:"otro",name:"Otro recibo ficticio"});
const two=Object.assign({},confirmed,{fixed:confirmed.fixed.concat([second])});
assert.equal(c.linkFixedPayment(two,expense.id,second.id,2026,9,30),two,"no reutiliza cargo para otro recibo");
const removed=c.linkFixedPayment(confirmed,expense.id,null,2026,9,30);
assert.equal(c.fixedPaymentState(removed,removed.fixed[0],2026,9,30).paid,false,"deshacer vuelve a sin acreditar");
const synced=c.reconcileFixedPaymentProofs(base,2026,9,30);
assert.equal(synced.expenses,base.expenses);
assert.equal(synced.accounts,base.accounts);
assert.equal(c.fixedPaymentState(c.slimForCloud(synced),synced.fixed[0],2026,9,30).paid,true,"BOOK inequívoco se conserva al cambiar dispositivo");
assert.equal(c.reconcileFixedPaymentProofs(synced,2026,9,30),synced,"pasada repetida no escribe de nuevo");
for(const patch of [{possibleDup:true},{status:"PDNG"}]){
  const invalid=Object.assign({},synced,{bankTx:[Object.assign({},tx,patch)]});
  assert.equal(c.fixedPaymentState(invalid,invalid.fixed[0],2026,9,30).paid,false,"evidencia contradicha: "+JSON.stringify(patch));
}
const deleted=Object.assign({},confirmed,{deleted:[c.keyOfExpense(expense)]});
assert.equal(c.fixedPaymentState(deleted,deleted.fixed[0],2026,9,30).paid,false,"lápida invalida el vínculo");
const remoteDup=Object.assign({},confirmed,{expenses:[Object.assign({},expense,{possibleDup:true})]});
assert.equal(c.fixedPaymentState(remoteDup,remoteDup.fixed[0],2026,9,30).paid,false,"duplicidad observada en otro dispositivo");
for(const patch of [{status:"PDNG"},{debtId:"deuda"},{category:"ingreso"},{amount:21},{ent:"sabadell"},{merchant:"CARGO REEMPLAZADO"}]){
  const contradicted=Object.assign({},confirmed,{expenses:[Object.assign({},expense,patch)]});
  assert.equal(c.fixedPaymentState(contradicted,contradicted.fixed[0],2026,9,30).paid,false,"cargo confirmado contradicho: "+JSON.stringify(patch));
}
const manualExpense=Object.assign({},expense,{source:"manual:revolut"});
const manualLinked=c.linkFixedPayment(Object.assign({},unlinked,{expenses:[manualExpense]}),manualExpense.id,fixed.id,2026,9,30);
const legacyDeleted=Object.assign({},c.slimForCloud(manualLinked),{deleted:[c.keyOfExpenseLegacy(manualExpense)]});
assert.equal(c.fixedPaymentState(legacyDeleted,legacyDeleted.fixed[0],2026,9,30).paid,false,"lápida manual antigua sin fila local invalida prueba");
const fromImport=Object.assign({},base,{bankTx:[otherName],expenses:[]});
const imported=c.importObExpenses(fromImport,[otherName]);
assert.equal(imported.length,1,"ruta R1: nombre diferente entra en Gastos");
const r1=Object.assign({},fromImport,{expenses:imported});
const linkedR1=c.linkFixedPayment(r1,imported[0].id,fixed.id,2026,9,30);
assert.equal(c.fixedPaymentState(linkedR1,linkedR1.fixed[0],2026,9,30).paid,true,"R1 también requiere identidad explícita");
assert.equal(c.reconcileFixedPaymentProofs(fromImport,2026,9,30),fromImport,"importe solo no se persiste");
assert.equal(c.linkFixedPayment(Object.assign({},unlinked,{expenses:[expense,Object.assign({},expense,{id:"dup"})]}),expense.id,fixed.id,2026,9,30).fixed,unlinked.fixed,"dos filas iguales no se acreditan");
const expected={identity:c.fixedPaymentIdentity(expense.ent,expense),model:c.fixedPaymentModel(fixed,9)};
const race=Object.assign({},unlinked,{expenses:[Object.assign({},expense,{merchant:"OTRO CARGO SINTETICO"})]});
assert.equal(c.linkFixedPayment(race,expense.id,fixed.id,2026,9,30,expected),race,"diálogo obsoleto no acredita cargo sustituido");
const paidDuringDialog=Object.assign({},unlinked,{fixed:[Object.assign({},fixed,{paidYm:2026*12+9,paidDay:25})]});
assert.equal(c.linkFixedPayment(paidDuringDialog,expense.id,fixed.id,2026,9,30,expected),paidDuringDialog,"no sustituye pago confirmado mientras el diálogo estaba abierto");
const named=Object.assign({},expense,{obName:expense.merchant});
const namedLinked=c.linkFixedPayment(Object.assign({},unlinked,{expenses:[named]}),named.id,fixed.id,2026,9,30);
const renamed=Object.assign({},namedLinked,{expenses:[Object.assign({},named,{merchant:"Nombre legible"})]});
assert.equal(c.fixedPaymentState(renamed,renamed.fixed[0],2026,9,30).paid,true,"renombrar no sustituye identidad bancaria");
const renamedByEditor=Object.assign({},renamed,{deleted:[c.keyOfExpense(named)]});
const rekeyed=c.rekeyFixedPaymentExpense(renamedByEditor,named,renamed.expenses[0]);
assert.equal(c.fixedPaymentState(rekeyed,rekeyed.fixed[0],2026,9,30).paid,true,"editor retira clave anterior, no el cargo renombrado");
const remoteRenamed=c.slimForCloud(rekeyed);
assert.equal(c.fixedPaymentState(remoteRenamed,remoteRenamed.fixed[0],2026,9,30).paid,true,"nueva clave permite snapshot sin fila después de renombrar");
const deletedRenamed=Object.assign({},rekeyed,{expenses:[],deleted:rekeyed.deleted.concat([c.keyOfExpense(renamed.expenses[0])])});
assert.equal(c.fixedPaymentState(deletedRenamed,deletedRenamed.fixed[0],2026,9,30).paid,false,"borrar el cargo renombrado sí invalida la prueba");
for(const patch of [{status:"PDNG"},{possibleDup:true},{debtId:"deuda"},{category:"ingreso"}]){
  const changedCharge=Object.assign({},renamed.expenses[0],patch);
  const initial=Object.assign({},renamedByEditor,{expenses:[changedCharge]});
  assert.equal(c.rekeyFixedPaymentExpense(initial,named,changedCharge),initial,"renombrar no refresca prueba inelegible: "+JSON.stringify(patch));
  assert.equal(c.fixedPaymentState(c.slimForCloud(initial),initial.fixed[0],2026,9,30).paid,false,"lápida anterior impide trasladar prueba inválida a otro móvil");
}
const undoneRename=c.linkFixedPayment(renamed,named.id,null,2026,9,30);
assert.equal(c.fixedPaymentState(undoneRename,undoneRename.fixed[0],2026,9,30).paid,false,"también puede deshacer tras renombrar");
const renamedDup=Object.assign({},namedLinked,{expenses:[named,Object.assign({},named,{id:"otro-id",merchant:"Nombre alternativo"})]});
assert.equal(c.fixedPaymentState(renamedDup,renamedDup.fixed[0],2026,9,30).paid,false,"dos nombres visibles no ocultan identidad duplicada");
const syncedId=Object.assign({},renamed,{expenses:[Object.assign({},renamed.expenses[0],{id:"nuevo-id-remoto"})]});
assert.equal(c.fixedPaymentState(syncedId,syncedId.fixed[0],2026,9,30).paid,true,"UUID remoto nuevo conserva identidad bancaria");
const undoneId=c.linkFixedPayment(syncedId,"nuevo-id-remoto",null,2026,9,30);
assert.equal(c.fixedPaymentState(undoneId,undoneId.fixed[0],2026,9,30).paid,false,"deshacer funciona también con UUID remoto nuevo");
for(const txPatch of [{status:"PDNG"},{status:undefined},{possibleDup:true}]){
  const remoteFeed=Object.assign({},namedLinked,{bankTx:[Object.assign({},otherName,{ent:"revolut"},txPatch)]});
  assert.equal(c.fixedPaymentState(remoteFeed,remoteFeed.fixed[0],2026,9,30).paid,false,"extracto contradice prueba explícita: "+JSON.stringify(txPatch));
  const beforeLink=Object.assign({},unlinked,{bankTx:remoteFeed.bankTx});
  assert.equal(c.linkFixedPayment(beforeLink,expense.id,fixed.id,2026,9,30),beforeLink,"extracto contradictorio no ofrece confirmación");
}
const dupFeed=Object.assign({},namedLinked,{bankTx:[Object.assign({},otherName,{ent:"revolut"}),Object.assign({},otherName,{ent:"revolut",id:"dup-feed"})]});
assert.equal(c.fixedPaymentState(dupFeed,dupFeed.fixed[0],2026,9,30).paid,false,"dos BOOK idénticos no son evidencia única");
console.log("fixed-payment-state: vínculo y persistencia OK");

// El previsto no es una factura: agua variable o divisa necesitan identidad humana, no tolerancias.
for(const [planned,actual] of [[32,32.40],[32,35.10],[18,18.15],[32,70],[42,21]]){
  const bill=Object.assign({},fixed,{amount:planned});
  const charge=Object.assign({},expense,{amount:actual});
  const initial=Object.assign({},unlinked,{fixed:[bill],expenses:[charge]});
  assert.equal(c.fixedPaymentState(initial,bill,2026,9,30).paid,false,"diferencia o parcial nunca se acredita automáticamente");
  const linked=c.linkFixedPayment(initial,charge.id,bill.id,2026,9,30);
  assert.equal(c.fixedPaymentState(linked,linked.fixed[0],2026,9,30).paid,true,"confirmación humana de pago completo admite previsto distinto");
  assert.equal(linked.fixed[0].amount,planned,"no convierte el pago real en nuevo importe previsto");
  assert.equal(linked.fixed[0].paymentProofs[2026*12+9].amount,actual);
  assert.equal(c.planChargesMonth(linked,9,2026,30).paidBills[0].paidAmount,actual,"Ya pagado recibe importe bancario real sin sustituir previsión");
  assert.equal(linked.expenses,initial.expenses);
  assert.equal(linked.accounts,initial.accounts);
}
const sharedBill=Object.assign({},fixed,{amount:21,bankAmount:42});
const sharedCharge=Object.assign({},expense,{amount:44});
const sharedState=Object.assign({},unlinked,{fixed:[sharedBill],expenses:[sharedCharge]});
const sharedLinked=c.linkFixedPayment(sharedState,sharedCharge.id,sharedBill.id,2026,9,30);
const sharedPaid=c.planChargesMonth(sharedLinked,9,2026,30).paidBills[0];
assert.equal(sharedPaid.amount,21,"cargo variable no permite inferir una parte propia nueva");
assert.equal(sharedPaid.plannedBankAmount,42);
assert.equal(sharedPaid.paidAmount,44);
assert.equal(sharedLinked.accounts,sharedState.accounts);
assert.equal(sharedLinked.expenses,sharedState.expenses);
