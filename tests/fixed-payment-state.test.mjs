import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";
// Las reproducciones de revisión se leen de src: public puede ser todavía el último
// bundle entregado y el turno para regenerarlo pertenece al coordinador (12/10).
const refIndex=process.argv.indexOf("--source-ref"),sourceRef=refIndex<0?null:process.argv[refIndex+1];
const source=file=>sourceRef?execFileSync("git",["show",sourceRef+":"+file],{encoding:"utf8",maxBuffer:8e6}):fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const order=JSON.parse(source("src/build-order.json"));
function paymentLogic(change){
  const js=order.map(file=>{const code=source("src/modules/"+file);return change&&file==="08-motor-bank.js"?change(code):code;}).join("\n");
  const ctx=loadPureLogic(source("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
  ctx.Date=class extends Date { constructor(...args){ super(...(args.length?args:[new Date("2026-09-30T12:00:00+02:00").getTime()])); } };
  return ctx;
}
const c=paymentLogic();
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

// Gastos conserva cargos aunque el extracto local falte en otro móvil (INC-3009-01).
const recorded=Object.assign({},expense,{source:"ob",ent:"sabadell",merchant:"Nombre legible",obName:fixed.name});
const recordedState=Object.assign({},base,{bankTx:[],expenses:[recorded]});
assert.equal(c.fixedPaymentState(recordedState,fixed,2026,9,30).paid,true,"el nombre original acredita el cargo guardado sin feed");
assert.equal(c.fixedPaymentState(recordedState,fixed,2026,9,30).day,25,"fecha real del cargo, no la prevista");
for(const source of ["ob","ob-hist","wallet","macrodroid","tr"]){
  const row=Object.assign({},recorded,{source:source,ent:"revolut"});
  const state=Object.assign({},recordedState,{expenses:[row]});
  const before=JSON.stringify(state);
  const result=c.fixedPaymentState(state,fixed,2026,9,30);
  assert.equal(result.paid,true,"cargo reconocido desde otra entidad: "+source);
  assert.equal(result.paidBank,"revolut");
  assert.equal(result.paidAmount,42);
  assert.equal(c.planChargesMonth(state,9,2026,30).pendingBills.length,0);
  assert.equal(JSON.stringify(state),before,"leer evidencia no escribe dinero ni movimientos");
}
for(const patch of [{obName:"Comercio ajeno"},{obName:"Otro ficticio"},{obName:"Ficticio"},{obName:"Gas ficticios"},{amount:42.4},{source:"manual:sabadell"},{status:"PDNG"},{possibleDup:true},{date:"2026-09-31"},{date:"2026-10-25"},{debtId:"deuda"},{category:"traspaso"},{currency:"USD"},{ent:"efectivo"}]){
  const state=Object.assign({},recordedState,{expenses:[Object.assign({},recorded,patch)]});
  assert.equal(c.fixedPaymentState(state,fixed,2026,9,30).paid,false,"cargo guardado sin identidad suficiente: "+JSON.stringify(patch));
}
const otherBill=Object.assign({},fixed,{id:"gas-otro",account:"revolut"});
assert.equal(c.fixedPaymentState(Object.assign({},recordedState,{fixed:[fixed,otherBill]}),fixed,2026,9,30).paid,false,"no elige entre recibos compatibles de bancos distintos");
assert.equal(c.fixedPaymentState(Object.assign({},recordedState,{expenses:[recorded,Object.assign({},recorded,{id:"duplicado"})]}),fixed,2026,9,30).paid,false,"dos cargos guardados no acreditan un único pago");
assert.equal(c.fixedPaymentState(Object.assign({},recordedState,{deleted:[c.keyOfExpense(recorded)]}),fixed,2026,9,30).paid,false,"borrado no acredita pago");
assert.equal(c.fixedPaymentState(Object.assign({},recordedState,{bankTx:[Object.assign({},recorded,{status:"PDNG"})]}),fixed,2026,9,30).paid,false,"feed contradice el cargo guardado");
const remoteRecord=c.expenseFromRow({id:"id-remoto",fecha:recorded.date,comercio:recorded.merchant,importe:42,cat:"otros",source:"ob:sabadell",ob_name:recorded.obName});
assert.equal(c.fixedPaymentState(Object.assign({},recordedState,{expenses:[remoteRecord]}),fixed,2026,9,30).paid,true,"pull con UUID nuevo y nombre bancario conserva el pago sin vínculo local");
const eligible=c.fixedExpenseEligible;
for(const length of [500,20000]){
  let checks=0;
  c.fixedExpenseEligible=function(){ checks++;return eligible.apply(this,arguments); };
  const history=Array.from({length:length},(_,i)=>Object.assign({},recorded,{id:"historico-"+i,merchant:"Negocio "+i,obName:"Negocio "+i}));
  const state=Object.assign({},recordedState,{expenses:history});
  const started=performance.now();
  assert.equal(c.fixedPaymentState(state,fixed,2026,9,30).paid,false);
  assert.equal(checks,0,"un histórico sin nombre compatible no repite el barrido de unicidad por compra");
  console.log("fixed-payment-state: histórico "+length+", eligible="+checks+", ms="+Math.round(performance.now()-started));
}
c.fixedExpenseEligible=eligible;
console.log("fixed-payment-state: cargos guardados sin feed OK");

test("notificación visual no escribe una confirmación financiera al editar",()=>{
  const row=Object.assign({},recorded,{source:"macrodroid",ent:"revolut"});
  for(const source of ["macrodroid","wallet","ob","ob-hist","tr"]){
    for(const patch of [{day:26},{amount:42},{account:"sabadell"}]){
      const charge=Object.assign({},row,{source});
      let state=Object.assign({},recordedState,{expenses:[charge]});
      assert.equal(c.fixedPaymentState(state,fixed,2026,9,30).paid,true);
      c.patchFixedById(update=>{ state=update(state); },fixed.id,patch);
      assert.equal(state.fixed[0].paidYm,undefined,"solo BOOK único permite guardar paidYm");
      assert.equal(state.fixed[0].paidDay,undefined);
      assert.equal(state.accounts,recordedState.accounts);
      assert.equal(state.expenses[0],charge);
    }
  }
  let state=base;
  c.patchFixedById(update=>{ state=update(state); },fixed.id,{day:26});
  assert.equal(state.fixed[0].paidYm,2026*12+9,"BOOK único conserva la escritura existente");
  assert.equal(state.fixed[0].paidDay,25);
});

test("Agua no acredita una compra de otra categoría en otro banco",()=>{
  const bill=Object.assign({},fixed,{name:"Agua",amount:30,category:"hogar"});
  const row=Object.assign({},recorded,{obName:"AGUA MINERAL BAR PEPE",amount:30,ent:"revolut",category:"bares"});
  const state=Object.assign({},recordedState,{fixed:[bill],expenses:[row]});
  assert.equal(c.fixedPaymentState(state,bill,2026,9,30).paid,false);
  for(const category of ["hogar","otros",undefined]){
    assert.equal(c.fixedPaymentState(Object.assign({},state,{expenses:[Object.assign({},row,{category})]}),bill,2026,9,30).paid,true,"otra entidad con categoría compatible o sin clasificar");
  }
  assert.equal(c.fixedPaymentState(Object.assign({},state,{expenses:[Object.assign({},row,{ent:"sabadell"})]}),bill,2026,9,30).paid,true,"mismo banco conserva el contrato anterior");
});

test("un cargo tiene un único recibo más específico desde la primera lectura",()=>{
  const specific=Object.assign({},fixed,{id:"seguro",name:"Seguro Mapfre"});
  // La especificidad resuelve competidores del mismo banco; los homónimos de otro
  // banco no disputan un BOOK propio (H1, revisión independiente12/10).
  const generic=Object.assign({},fixed,{id:"mapfre",name:"Mapfre"});
  const row=Object.assign({},recorded,{obName:"SEGURO MAPFRE SA",merchant:"SEGURO MAPFRE SA"});
  const book=Object.assign({},tx,{merchant:row.obName});
  for(const bills of [[specific,generic],[generic,specific]]){
    for(const bankTx of [[],[book]]){
      const state=Object.assign({},recordedState,{accounts:base.accounts.concat([{id:"rv",ent:"revolut",role:"fijos"}]),fixed:bills,expenses:[row],bankTx});
      const before=JSON.stringify(state);
      assert.equal(c.fixedPaymentState(state,generic,2026,9,30).paid,false,"el genérico no se adelanta por tener el feed local");
      assert.equal(c.fixedPaymentState(state,specific,2026,9,30).paid,true,"gana el nombre completo más específico");
      assert.equal(JSON.stringify(state),before,"la asignación no depende de una escritura previa");
      const reconciled=c.reconcileFixedPaymentProofs(state,2026,9,30);
      assert.equal(reconciled.fixed.filter(f=>c.fixedPaymentState(reconciled,f,2026,9,30).paid).length,1);
    }
  }
  const tie=Object.assign({},specific,{id:"empate",name:"SEGURO MAPFRE"});
  for(const bankTx of [[],[book]]){
    const state=Object.assign({},recordedState,{accounts:base.accounts.concat([{id:"rv",ent:"revolut",role:"fijos"}]),fixed:[specific,tie],expenses:[row],bankTx});
    assert.equal(state.fixed.some(f=>c.fixedPaymentState(state,f,2026,9,30).paid),false,"empate real no acredita ninguno, tampoco primero el BOOK local");
  }
  const sameBank=Object.assign({},generic,{account:"sabadell"});
  const localBook=Object.assign({},book,{ent:"sabadell"});
  const state=Object.assign({},base,{fixed:[sameBank,specific],bankTx:[localBook]});
  const reconciled=c.reconcileFixedPaymentProofs(state,2026,9,30),snapshot=c.slimForCloud(reconciled);
  assert.equal(c.fixedPaymentState(state,specific,2026,9,30).paid,true,"BOOK usa la misma preferencia por especificidad");
  assert.equal(c.fixedPaymentState(state,sameBank,2026,9,30).paid,false);
  assert.equal(c.fixedPaymentState(snapshot,snapshot.fixed[1],2026,9,30).paid,true,"la prueba BOOK conserva el ganador sin extracto");
  assert.equal(c.fixedPaymentState(snapshot,snapshot.fixed[0],2026,9,30).paid,false);
});

test("BOOK tolerante y gasto exacto no reparten el mismo cargo entre dos recibos",()=>{
  const specific=Object.assign({},fixed,{id:"seguro",name:"Seguro Mapfre",amount:42.4});
  const generic=Object.assign({},fixed,{id:"mapfre",name:"Mapfre",account:"revolut"});
  const book=Object.assign({},tx,{merchant:"SEGURO MAPFRE SA"});
  const row=Object.assign({},recorded,{date:book.date,merchant:book.merchant,obName:book.merchant});
  for(const bills of [[specific,generic],[generic,specific]]){
    const state=Object.assign({},base,{fixed:bills,bankTx:[book],expenses:[row]});
    const before=JSON.stringify(state);
    assert.equal(c.fixedPaymentState(state,specific,2026,9,30).paid,true,"el BOOK conserva su tolerancia y ganador específico");
    assert.equal(c.fixedPaymentState(state,generic,2026,9,30).paid,false,"el gasto exacto no vuelve a adjudicar ese BOOK");
    assert.equal(JSON.stringify(state),before);
    const reconciled=c.reconcileFixedPaymentProofs(state,2026,9,30);
    assert.equal(reconciled.fixed.filter(f=>c.fixedPaymentState(reconciled,f,2026,9,30).paid).length,1);
  }
});

test("una identidad de recibo ausente o repetida no comparte el ganador por nombre",()=>{
  const row=Object.assign({},recorded,{merchant:"SEGURO MAPFRE SA",obName:"SEGURO MAPFRE SA"});
  const book=Object.assign({},tx,{merchant:row.obName});
  for(const id of ["duplicado",undefined]){
    const specific=Object.assign({},fixed,{id,name:"Seguro Mapfre"});
    const generic=Object.assign({},fixed,{id,name:"Mapfre"});
    for(const bills of [[specific,generic],[generic,specific]]){
      for(const bankTx of [[],[book]]){
        const state=Object.assign({},base,{fixed:bills,expenses:[row],bankTx});
        const before=JSON.stringify(state);
        assert.equal(state.fixed.some(f=>c.fixedPaymentState(state,f,2026,9,30).paid),false,"sin identidad única no acredita ninguno");
        const reconciled=c.reconcileFixedPaymentProofs(state,2026,9,30);
        assert.equal(reconciled.fixed.some(f=>c.fixedPaymentState(reconciled,f,2026,9,30).paid),false);
        assert.equal(JSON.stringify(state),before,"no repara ni modifica identidades al leer");
        const manual=Object.assign({},row,{source:"manual:sabadell",merchant:"Cargo ficticio",obName:"Cargo ficticio"});
        const ambiguous=Object.assign({},state,{bankTx:[],expenses:[manual]});
        assert.equal(c.linkFixedPayment(ambiguous,manual.id,id,2026,9,30),ambiguous,"confirmar no multiplica una identidad ambigua");
        const unique=Object.assign({},specific,{id:"prueba-unica"});
        const linked=c.linkFixedPayment(Object.assign({},ambiguous,{fixed:[unique]}),manual.id,unique.id,2026,9,30);
        const proof=linked.fixed[0].paymentProofs[2026*12+9];
        const saved=Object.assign({},ambiguous,{fixed:bills.map(f=>Object.assign({},f,{paymentProofs:{[2026*12+9]:Object.assign({},proof,{model:c.fixedPaymentModel(f,9)})}}))});
        for(const restored of [saved,c.slimForCloud(saved)]){
          assert.equal(restored.fixed.some(f=>c.fixedPaymentState(restored,f,2026,9,30).paid),false,"una prueba guardada no comparte un identificador ambiguo, tampoco sin extracto");
        }
      }
    }
  }
});

test("H1: un homónimo de otro banco no anula el BOOK propio ni su prueba viajada",()=>{
  const a=Object.assign({},fixed,{id:"netflix-sb",name:"Netflix ficticio"});
  const b=Object.assign({},a,{id:"netflix-rv",account:"revolut"});
  const charge=Object.assign({},tx,{merchant:a.name});
  const remoteCharge=Object.assign({},charge,{id:"rv-book",ent:"revolut"});
  const accounts=base.accounts.concat([{id:"rv",ent:"revolut",role:"fijos",value:500}]);
  const own=Object.assign({},base,{accounts,fixed:[a],bankTx:[charge]});
  const saved=c.reconcileFixedPaymentProofs(own,2026,9,30).fixed[0];
  for(const competitor of [
    {fixed:[b]},
    {oneoffs:[{id:"puntual",name:a.name,amount:42,account:"revolut",month:9,year:2026,day:25}]},
    {debts:[{id:"deuda",name:a.name,monthly:42,value:500,account:"revolut",day:25}]}
  ]){
    const state=Object.assign({},own,competitor,{fixed:[a].concat(competitor.fixed||[])});
    assert.equal(c.fixedPaymentState(state,a,2026,9,30).paid,true,"BOOK acotado a su banco: "+JSON.stringify(competitor));
    const traveled=c.slimForCloud(Object.assign({},state,{fixed:[saved].concat(competitor.fixed||[])}));
    assert.equal(c.fixedPaymentState(traveled,traveled.fixed[0],2026,9,30).paid,true,"la prueba BOOK no depende del extracto local");
  }
  const both=Object.assign({},own,{fixed:[a,b],bankTx:[charge,remoteCharge]});
  assert.equal(c.planChargesMonth(both,9,2026,30).pendingBills.length,0);
  assert.equal(c.planChargesMonth(both,9,2026,30).paidBills.length,2);
  const snapshot=c.slimForCloud(c.reconcileFixedPaymentProofs(both,2026,9,30));
  assert.equal(c.planChargesMonth(snapshot,9,2026,30).paidBills.length,2);
  const tolerant=Object.assign({},a,{amount:42.4});
  const toleranceState=Object.assign({},both,{fixed:[tolerant,b],bankTx:[charge]});
  assert.equal(c.fixedPaymentState(toleranceState,tolerant,2026,9,30).paid,true,"exacto ajeno no vence a tolerancia propia");
  assert.equal(c.fixedPaymentState(toleranceState,b,2026,9,30).paid,false,"BOOK no acredita el banco ajeno sin gasto guardado");
  assert.equal(c.fixedPaymentAutoOwner(toleranceState,b,2026,9,"sabadell",charge.merchant,42,null,true),false,"el modo BOOK exige banco incluso al llamarlo directamente");
});

test("H2: cambiar el día conserva una prueba BOOK sin extracto y no duplica descuento",()=>{
  const oldDate=c.Date;
  c.Date=class extends Date { constructor(...args){ super(...(args.length?args:[new Date("2026-09-15T12:00:00+02:00").getTime()])); } };
  try{
    const bill=Object.assign({},fixed,{day:12,wait:undefined});
    const state=Object.assign({},base,{fixed:[bill],bankTx:[Object.assign({},tx,{date:"2026-09-12"})]});
    let traveled=c.slimForCloud(c.reconcileFixedPaymentProofs(state,2026,9,15));
    const before=c.monthNetForAccount(traveled,"sabadell",2026,9,15),proof=traveled.fixed[0].paymentProofs[2026*12+9];
    assert.equal(proof.kind,"book");assert.equal(traveled.bankTx,undefined);
    c.patchFixedById(update=>{traveled=update(traveled);},bill.id,{day:25});
    assert.equal(traveled.fixed[0].paidYm,2026*12+9,"el saldo reconoce el BOOK viajado");
    assert.equal(traveled.fixed[0].paidDay,12);
    assert.equal(traveled.fixed[0].paymentProofs[2026*12+9],proof,"editar el día no cambia prueba ni importe");
    assert.equal(c.monthNetForAccount(traveled,"sabadell",2026,9,15),before,"mover el calendario no vuelve a descontar");
    assert.equal(c.bankPendingEvents(traveled,"sabadell",2026,9,15).filter(x=>x.id===bill.id||x.id==="fixed_"+bill.id).length,0);
  }finally{c.Date=oldDate;}
});

test("H3: el histórico se indexa una vez por referencia de expenses",()=>{
  for(const length of [2000,20000]){
    const history=Array.from({length},(_,i)=>Object.assign({},recorded,{id:"hist-"+i,merchant:"Compra ficticia "+i,obName:"Compra ficticia "+i}));
    let reads=0;
    const expenses=new Proxy(history,{get(target,key,receiver){if(/^\d+$/.test(String(key)))reads++;return Reflect.get(target,key,receiver);}});
    const bills=Array.from({length:30},(_,i)=>Object.assign({},fixed,{id:"recibo-"+i,name:"Servicio ficticio "+i}));
    const state=Object.assign({},base,{bankTx:[],fixed:bills,expenses});
    assert.equal(c.planChargesMonth(state,9,2026,30).pendingBills.length,30);
    reads=0;
    for(let i=0;i<3;i++)assert.equal(c.planChargesMonth(Object.assign({},state),9,2026,30).pendingBills.length,30);
    assert.ok(reads<100,"misma referencia no recorre otra vez "+length+" filas: "+reads);
    assert.equal(state.expenses,expenses,"la lectura no sustituye el array");
    const hit=Object.assign({},recorded,{obName:bills[0].name,merchant:bills[0].name});
    const next=Object.assign({},state,{expenses:history.concat([hit])});
    assert.equal(c.fixedPaymentState(next,bills[0],2026,9,30).paid,true,"referencia nueva invalida el índice");
  }
});

test("H4: importObExpenses no quita pagado al añadir el BOOK de una notificación",()=>{
  for(const sourceName of ["wallet","macrodroid","tr"]){
    const notification=Object.assign({},recorded,{id:"noti",ent:"revolut",source:sourceName,merchant:"Gas ficticio",obName:undefined});
    const state=Object.assign({},base,{bankTx:[],expenses:[notification]});
    assert.equal(c.fixedPaymentState(state,fixed,2026,9,30).paid,true);
    const book=Object.assign({},tx,{id:"nuevo-book",ent:"revolut",date:"2026-09-26",merchant:"GAS FICTICIO SA"});
    const incoming=c.importObExpenses(state,[book]);
    assert.equal(incoming.length,1,"se prueba la ruta real del importador, no una fila fabricada");
    const synced=Object.assign({},state,{bankTx:[book],expenses:state.expenses.concat(incoming)});
    const before=JSON.stringify(synced);
    assert.equal(c.fixedPaymentState(synced,fixed,2026,9,30).paid,true,"segunda fuente concordante del mismo pago: "+sourceName);
    assert.equal(c.planChargesMonth(synced,9,2026,30).pendingBills.length,0);
    assert.equal(JSON.stringify(synced),before,"no fusiona ni borra movimientos por inferencia");
    assert.equal(c.fixedPaymentState(Object.assign({},synced,{bankTx:[]}),fixed,2026,9,30).paid,true,"Gastos conserva ambas fuentes sin feed");
    const repeated=Object.assign({},synced,{expenses:synced.expenses.concat([Object.assign({},incoming[0],{id:"otro-book",date:"2026-09-27T12:00:00.000Z"})])});
    assert.equal(c.fixedPaymentState(repeated,fixed,2026,9,30).paid,false,"dos BOOK no se agrupan como un solo pago");
    const distant=Object.assign({},synced,{bankTx:[],expenses:[notification,Object.assign({},incoming[0],{date:"2026-09-29T12:00:00.000Z"})]});
    assert.equal(c.fixedPaymentState(distant,fixed,2026,9,30).paid,false,"fuera de la ventana no se supone la misma compra");
  }
});

test("H7: expenses con fila nula no lanza y un recibo sin id no inventa identidad",()=>{
  const state=Object.assign({},recordedState,{expenses:[null,recorded]});
  assert.equal(c.fixedExpenseEligible(state,recorded,fixed,2026,9,30),true);
  assert.equal(c.fixedPaymentState(state,fixed,2026,9,30).paid,true);
  const missing=Object.assign({},fixed,{id:undefined}),withoutId=Object.assign({},base,{fixed:[missing]});
  const before=JSON.stringify(withoutId),result=c.fixedPaymentState(withoutId,missing,2026,9,30);
  assert.equal(result.paid,false);assert.equal(result.overdue,true);assert.equal(result.bankTx,null);
  assert.equal(c.reconcileFixedPaymentProofs(withoutId,2026,9,30),withoutId);
  assert.equal(JSON.stringify(withoutId),before,"sin id no se repara ni se guarda una prueba al leer");
});

const paymentGuards=[
  {id:"nombre-corto",from:'n.length>=4&&(" "+name+" ")',to:'true&&(" "+name+" ")',check(ctx){
    const bill=Object.assign({},fixed,{name:"Gas"}),state=Object.assign({},recordedState,{fixed:[bill]});
    assert.equal(ctx.fixedPaymentAutoOwner(state,bill,2026,9,"sabadell","GAS SA",42,"otros",false),false,"nombre corto no identifica automáticamente");
  }},
  {id:"fuente-manual",from:'["ob","ob-hist","wallet","macrodroid","tr"].indexOf(x.source)<0',to:'["ob","ob-hist","wallet","macrodroid","tr","manual:sabadell"].indexOf(x.source)<0',all:true,check(ctx){
    const state=Object.assign({},recordedState,{expenses:[Object.assign({},recorded,{source:"manual:sabadell"})]});
    assert.equal(ctx.fixedPaymentState(state,fixed,2026,9,30).paid,false,"apunte manual necesita confirmación expresa");
  }},
  {id:"dos-book",from:'&&matches.length<2&&',to:'&&true&&',check(ctx){
    const row=Object.assign({},recorded,{date:tx.date,obName:tx.merchant,merchant:tx.merchant});
    const state=Object.assign({},base,{bankTx:[tx,Object.assign({},tx,{id:"segundo",date:"2026-09-26"})],expenses:[row]});
    assert.equal(ctx.fixedPaymentState(state,fixed,2026,9,30).paid,false,"un gasto guardado no rescata dos BOOK ambiguos");
  }},
  {id:"prueba-invalida",from:'&&!(e.paymentProofs&&e.paymentProofs[y*12+m])',to:'&&true',check(ctx){
    const stale=Object.assign({},fixed,{paymentProofs:{[2026*12+9]:{kind:"expense",model:"modelo sustituido",identity:ctx.fixedPaymentIdentity("sabadell",recorded),date:"2026-09-25",amount:42,bank:"sabadell"}}});
    const state=Object.assign({},recordedState,{fixed:[stale]});
    assert.equal(ctx.fixedPaymentState(state,stale,2026,9,30).paid,false,"una prueba invalidada no se sustituye por inferencia");
  }},
  {id:"cargo-ya-vinculado",from:'return f.id!==e.id&&p&&p.identity===fixedPaymentIdentity(tx.ent,tx);',to:'return false;',check(ctx){
    const other=Object.assign({},fixed,{id:"explicito",name:"Otro recibo ficticio"});
    const charge=Object.assign({},recorded,{date:tx.date,obName:tx.merchant,merchant:tx.merchant});
    const state=Object.assign({},base,{fixed:[fixed,other],bankTx:[],expenses:[charge]});
    const linked=ctx.linkFixedPayment(state,charge.id,other.id,2026,9,30);
    const traveled=Object.assign({},ctx.slimForCloud(linked),{bankTx:[tx]});
    assert.equal(ctx.fixedPaymentState(traveled,traveled.fixed[1],2026,9,30).paid,true,"prueba explícita vigente");
    assert.equal(ctx.fixedPaymentState(traveled,traveled.fixed[0],2026,9,30).paid,false,"BOOK no puede reutilizar el cargo ya vinculado");
  }},
  {id:"book-sin-banco",from:'f.bank!==bank||!recNameMatch(f.name,merchant)',to:'!recNameMatch(f.name,merchant)',check(ctx){
    const other=Object.assign({},fixed,{account:"revolut"}),state=Object.assign({},base,{fixed:[other]});
    assert.equal(ctx.fixedPaymentAutoOwner(state,other,2026,9,"sabadell",tx.merchant,42,null,true),false,"modo BOOK exige banco propio");
  }}
];
for(const guard of paymentGuards){
  test("guarda causal: "+guard.id,()=>guard.check(c));
  test("mutación rechazada: "+guard.id,()=>{
    let changes=0;
    const mutant=paymentLogic(code=>{
      const apply=()=>{assert.ok(code.includes(guard.from),"la mutación tiene una guarda real");code=code.replace(guard.from,guard.to);changes++;};
      apply();if(guard.all)while(code.includes(guard.from))apply();
      return code;
    });
    assert.ok(changes>0);assert.throws(()=>guard.check(mutant),assert.AssertionError,"la aserción causal cae sin su guarda");
  });
}
