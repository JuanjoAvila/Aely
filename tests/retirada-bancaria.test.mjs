import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { mock } from "node:test";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

// Las magnitudes del mes deben probar la retirada, no la zona horaria del runner al cambiar de mes.
mock.timers.enable({apis:["Date"],now:Date.parse("2026-09-26T12:00:00Z")});
const ctx=loadPureLogicFromFile();
const expense={id:"550e8400-e29b-41d4-a716-446655440000",date:"2026-09-28T12:00:00.000Z",merchant:"Disposición ficticia",amount:80,category:"otros",source:"ob",ent:"caixabank"};
const row={id:expense.id,fecha:expense.date,comercio:expense.merchant,importe:80,cat:"otros",source:"ob:caixabank"};
const core=fs.readFileSync("src/modules/00-core.js","utf8");
const body=core.match(/async confirmExpenseWithdrawal\(e, readState\)\{([\s\S]*?)\n    \},/)[1];
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const method=new AsyncFunction("sb","isExpenseUuid","canRecognizeWithdrawal","withdrawalRowMatches","e","readState",body);
function client(opts={}){
  const data=structuredClone(opts.row||row), ops=[];
  let updates=0;
  return {data,ops,get updates(){return updates;},sb:{
    auth:{getSession:async()=>{if(opts.afterSession)await opts.afterSession();return {data:{session:opts.noSession?null:{user:{id:"fixture-owner"}}}};}},
    from(table){
      const filters=[]; let patch=null;
      const q={select(cols){ops.push(["select",cols]);return q;},eq(k,v){filters.push([k,v]);return q;},
        update(p){patch=p;updates++;return q;},
        async maybeSingle(){ops.push(["read",table,filters]);if(opts.afterRead)await opts.afterRead();return {data:opts.missing?null:structuredClone(data),error:opts.readError||null};},
        async then(resolve){
          ops.push(["update",table,patch,filters]);
          if(opts.afterSend)await opts.afterSend();
          if(opts.zero) return resolve({data:[],error:null});
          if(opts.error) return resolve({data:null,error:new Error("denied")});
          Object.assign(data,patch);
          if(opts.afterAck)await opts.afterAck();
          return resolve({data:opts.ack===undefined?[structuredClone(data)]:opts.ack,error:null});
        }};
      return q;
    }}};
}
const run=(c,e=expense,readState=()=>({expenses:[e],fixed:[]}))=>method(c.sb,ctx.isExpenseUuid,ctx.canRecognizeWithdrawal,ctx.withdrawalRowMatches,e,readState);
let cases=0;
async function check(name,fn){await fn();cases++;console.log("✓ "+name);}

await check("ACK solo cambia cat; UUID, banco, importe y saldo intactos",async()=>{
  const c=client();const ack=await run(c);
  assert.equal(ack.cat,"traspaso");
  assert.deepEqual(c.data,{...row,cat:"traspaso"});
  const update=c.ops.find(op=>op[0]==="update");
  assert.deepEqual(update[2],{cat:"traspaso"});
  for(const kv of [["user_id","fixture-owner"],["id",expense.id],["source",row.source],["cat","otros"],["fecha",row.fecha],["importe",80],["comercio",row.comercio]])
    assert.ok(update[3].some(v=>v[0]===kv[0]&&v[1]===kv[1]),JSON.stringify(kv));
});
for(const [name,opts] of [["sesión ausente",{noSession:true}],["UUID no existe",{missing:true}],
  ["UUID remoto divergente",{row:{...row,id:"550e8400-e29b-41d4-a716-446655440001"}}],
  ["origen cambiado",{row:{...row,source:"ob:sabadell"}}],["importe cambiado",{row:{...row,importe:81}}],
  ["fecha cambiada",{row:{...row,fecha:"2026-09-27"}}],["comercio cambiado",{row:{...row,comercio:"Otro"}}],
  ["categoría de otro móvil",{row:{...row,cat:"super"}}],["error lectura",{readError:new Error("denied")}]] )
  await check(name+": no UPDATE",async()=>{const c=client(opts);await assert.rejects(()=>run(c));assert.equal(c.updates,0);});
await check("identidad corta y nube ausente no fingen guardar",async()=>{
  const c=client();await assert.rejects(()=>run(c,{...expense,id:"short"}));assert.equal(c.updates,0);
  await assert.rejects(()=>run({sb:null}));
});
for(const [name,opts] of [["UPDATE cero filas",{zero:true}],["RLS denegada",{error:true}],
  ["ACK vacío",{ack:null}],["ACK de otra fila",{ack:[{...row,cat:"traspaso",id:"other"}]}],
  ["ACK no neutro",{ack:[row]}],["ACK cambia importe",{ack:[{...row,cat:"traspaso",importe:1}]}]])
  await check(name+": rechazo",async()=>{await assert.rejects(()=>run(client(opts)));});
await check("reintento tras commit o móvil B ya neutro: no segundo UPDATE",async()=>{
  const c=client();await run(c);await run(c);assert.equal(c.updates,1);
  const b=client({row:c.data});await run(b);assert.equal(b.updates,0);
});
const state=()=>({accounts:[{id:"cb",ent:"caixabank",value:920,bankIban:"fixture"},{id:"cash",ent:"efectivo",value:30}],expenses:[structuredClone(expense)],settings:{expenseBanks:["caixabank"]}});
await check("idempotencia, recarga y doble importación no suman efectivo ni recrean fila",()=>{
  const s=state(), next=ctx.applyRecognizedWithdrawal(s,expense,100);
  assert.equal(next.accounts,s.accounts);
  assert.equal(next.expenses.length,1);assert.equal(next.expenses[0].id,expense.id);
  assert.equal(next.expenses[0].category,"traspaso");
  assert.equal(ctx.expenseCountsBudget(next.expenses[0],next),false);
  assert.equal(ctx.expenseCountsCash(next.expenses[0],next),ctx.expenseCountsCash(expense,s));
  assert.equal(ctx.applyRecognizedWithdrawal(next,expense,101),next);
  const reload=structuredClone(next);
  assert.equal(ctx.applyRecognizedWithdrawal(reload,expense,102),reload);
  const merged=ctx.mergeExpensesFromCloud(reload.expenses,[{...expense,category:"traspaso"},{...expense,category:"traspaso"}],103);
  assert.equal(merged.list.length,1);assert.equal(merged.list[0].id,expense.id);
  assert.equal(reload.accounts[1].value,30);
});
await check("pull anterior al ACK no deshace; pull posterior de B se admite",()=>{
  const next=ctx.applyRecognizedWithdrawal(state(),expense,100);
  const old=ctx.mergeExpensesFromCloud(next.expenses,[expense],99);
  assert.equal(old.list[0].category,"traspaso");
  const b=ctx.mergeExpensesFromCloud([expense],[{...expense,category:"traspaso"}],101);
  assert.equal(b.list[0].category,"traspaso");
  const later=ctx.mergeExpensesFromCloud(next.expenses,[{...expense,category:"super"}],101);
  assert.equal(later.list[0].category,"super");
});
await check("fila eliminada, cambiada o duplicada no se reescribe tras respuesta tardía",()=>{
  for(const expenses of [[],[{...expense,amount:81}],[{...expense,category:"super"}],[expense,{...expense}]]){
    const s={...state(),expenses};assert.equal(ctx.applyRecognizedWithdrawal(s,expense,100),s);
  }
});
await check("dups, ingresos, deudas e inversión no ofrecen este camino",()=>{
  for(const patch of [{possibleDup:true},{amount:-80},{amount:0},{category:"deudas"},{debtId:"d"},{category:"inversion"},{source:"manual"}])
    assert.equal(ctx.canRecognizeWithdrawal({...expense,...patch}),false);
});
await check("doble importación bancaria conserva la retirada corregida y sus saldos",()=>{
  const s={...state(),fixed:[],debts:[],flows:[],oneoffs:[]};
  const tx={ent:"caixabank",id:"fixture-bank-transaction",date:new Date().toISOString().slice(0,10),amount:80,
    merchant:"Disposición ficticia",note:"",card:false,status:"BOOK"};
  const first=ctx.importObExpenses({...s,expenses:[]},[tx]);
  assert.equal(first.length,1);
  const imported={...s,expenses:first}, e=first[0];
  const marked=ctx.applyRecognizedWithdrawal(imported,e,100);
  assert.equal(marked.expenses[0].category,"traspaso");
  assert.equal(ctx.importObExpenses(marked,[tx,tx]),null);
  assert.equal(marked.accounts,imported.accounts);
});
for(const role of ["fijos","diario","ambos"])await check(`magnitud bancaria ${role}: ACK 80→0 de presupuesto conserva banco 420 antes/después y tras sync B`,async()=>{
  const now=new Date(), day=now.toISOString().slice(0,10);
  const e={...expense,date:now.toISOString(),extId:"withdrawal-book-fixture",noCard:true};
  const tx={ent:"caixabank",id:e.extId,date:day,amount:80,merchant:e.merchant,card:false,status:"BOOK"};
  const input={...state(),budget:500,fixed:[],debts:[],oneoffs:[],flows:[],goals:[],obAccounts:[],bankTx:[tx],
    expenses:[e],accounts:[{id:"cb",ent:"caixabank",value:500,bankIban:"fixture-iban",role,spendFrom:role!=="fijos",inject:0},
      {id:"cash",ent:"efectivo",value:0,role:"fijos"}]};
  const links=[{ok:true,aspsp:"CaixaBank",accounts:[{ok:true,uid:"fixture-account",iban:"fixture-iban",
    balances:[{type:"CLBD",amount:420,currency:"EUR"}],transactions:[tx]}]}];
  const shown=s=>{
    const ins=ctx.insumosSaldoGasto(s);
    return ctx.saldoCuentaMostrada(s.accounts.find(a=>a.id==="cb"),{
      injTR:ins.injTR,spentByBank:ins.spentByBank,paidNetByBank:ins.paidNetByBank,
      roundup:ins.roundup,monthlyInvest:ins.monthlyInvest});
  };
  const before=ctx.applyBankBalances(input,links).state;
  assert.equal(before.accounts[0].balSaldo,420,"saldo crudo CLBD ya incluye retirada BOOK de 80");
  assert.equal(before.accounts[0].balTipo,"CLBD");
  assert.equal(shown(before),420,"se ejecuta la misma fórmula que pinta Cartera");
  assert.equal(ctx.monthBudgetStats(before).spent,80);
  const c=client({row:{...row,fecha:e.date}}), ack=await run(c,e);
  const marked=ctx.applyRecognizedWithdrawal(before,e,Date.now());
  assert.equal(ctx.monthBudgetStats(marked).spent,0);
  assert.equal(ctx.monthBudgetStats(marked).against,0);
  assert.equal(shown(marked),420,"neutra de presupuesto sigue siendo salida del banco; nunca 500");
  assert.equal(marked.accounts,before.accounts,"el ACK no cambia base, rastro ni sobre");
  assert.equal(marked.bankTx,before.bankTx,"la evidencia BOOK se conserva");
  assert.equal(marked.obAccounts,before.obAccounts,"no crea una cuenta bancaria extra");
  assert.equal(marked.accounts[1].value,0,"sin registro explícito el efectivo sigue en cero");
  assert.equal(ctx.insumosSaldoGasto(marked).spentByBank.caixabank,ctx.insumosSaldoGasto(before).spentByBank.caixabank);
  const repeated=ctx.applyBankBalances(marked,links).state;
  assert.equal(shown(repeated),420,"mismo saldo bancario después de sync no introduce otros 80");
  assert.equal(repeated.accounts[0].value,before.accounts[0].value);
  assert.equal(ctx.importObExpenses(repeated,[tx,tx]),null);
  const b=structuredClone(before);
  const merge=ctx.mergeExpensesFromCloud(b.expenses,[ctx.expenseFromRow(ack)],Date.now()+1);
  const syncedB=ctx.applyBankBalances({...b,expenses:merge.list},links).state;
  assert.equal(merge.list.length,1);assert.equal(merge.list[0].id,e.id);
  assert.equal(ctx.monthBudgetStats(syncedB).spent,0);assert.equal(shown(syncedB),420);
  assert.equal(syncedB.accounts[0].value,before.accounts[0].value);
  assert.equal(syncedB.accounts[1].value,0,"no se suma efectivo por el pull de B");
});

function receiptFixture(){
  const e={...expense,date:"2026-09-25T12:00:00.000Z",merchant:"DISPOSICION OFICINA PRUEBA",obName:"DISPOSICION OFICINA PRUEBA",noCard:true};
  const fixed={id:"agua-prueba",name:"Agua doméstica sintética",amount:40,bankAmount:80,freq:"mes",day:25,account:"caixabank",wait:2026*12+9};
  const base={...state(),fixed:[fixed],expenses:[e],bankTx:[{ent:e.ent,date:"2026-09-25",amount:80,merchant:e.merchant,status:"BOOK"}],debts:[],oneoffs:[],flows:[],goals:[]};
  assert.equal(ctx.fixedPaymentState(base,fixed,2026,9,26).paid,false);
  const linked=ctx.linkFixedPayment(base,e.id,fixed.id,2026,9,26);
  assert.equal(ctx.fixedPaymentState(linked,linked.fixed[0],2026,9,26).paid,true);
  return {e,base,linked,fixed,remote:{...row,fecha:e.date,comercio:e.merchant}};
}
function assertPaidBoth(s,paid){
  const b=ctx.slimForCloud(s);
  assert.equal(Object.hasOwn(b,"expenses"),false);assert.equal(Object.hasOwn(b,"bankTx"),false);
  assert.equal(ctx.fixedPaymentState(s,s.fixed[0],2026,9,26).paid,paid);
  assert.equal(ctx.fixedPaymentState(b,b.fixed[0],2026,9,26).paid,paid);
}
const gastosSource=fs.readFileSync("src/modules/04-tab-gastos.js","utf8");
function realHandler(name,env){
  const start=gastosSource.indexOf("  const "+name+"=function("),end=gastosSource.indexOf("\n  };",start);
  assert.ok(start>=0&&end>start,name);
  const source=gastosSource.slice(start,end+6).replace("  const "+name+"=","return ");
  return new Function(...Object.keys(env),source)(...Object.values(env));
}
function handlerEnv(initial){
  let current=initial,resolveDialog;const pending={current:{}},ref={current:initial},toasts=[],statuses=[];
  const env={canRecognizeWithdrawal:ctx.canRecognizeWithdrawal,withdrawalReceiptLink:ctx.withdrawalReceiptLink,
    applyRecognizedWithdrawal:ctx.applyRecognizedWithdrawal,withdrawalRowMatches:ctx.withdrawalRowMatches,
    reconcileConfirmedWithdrawal:ctx.reconcileConfirmedWithdrawal,
    expenseSourceForCloud:ctx.expenseSourceForCloud,fixedPaymentIdentity:ctx.fixedPaymentIdentity,
    expenseBankOf:ctx.expenseBankOf,fixedPaymentModel:ctx.fixedPaymentModel,linkFixedPayment:ctx.linkFixedPayment,
    accOf:vm.runInContext("accOf",ctx),occAmountIn:ctx.occAmountIn,entOf:vm.runInContext("entOf",ctx),fmtIsoCorto:x=>x,
    state:initial,withdrawalState:ref,withdrawalPending:pending,setWithdrawalStatus:x=>statuses.push(x),
    askConfirm:()=>new Promise(resolve=>{resolveDialog=resolve;}),showToast:x=>toasts.push(x),t:x=>x,tf:x=>x,eur:x=>String(x),
    set:update=>{current=update(current);ref.current=current;},ReactDOM:{flushSync:fn=>fn()},mcSandbox:()=>false};
  return {env,pending,ref,toasts,statuses,get current(){return current;},setCurrent:s=>{current=s;ref.current=s;},yes:()=>resolveDialog(true)};
}
await check("recibo compartido: puerta bloqueada, cero write y A/B sin feed conservan la prueba",async()=>{
  const {e,linked,remote}=receiptFixture(),c=client({row:remote});
  assert.equal(ctx.canRecognizeWithdrawal(e,linked),false);
  assert.equal(ctx.withdrawalReceiptLink(linked,e).id,"agua-prueba");
  await assert.rejects(()=>run(c,e,()=>linked));assert.equal(c.updates,0);assert.equal(c.ops.length,0);
  assert.equal(ctx.applyRecognizedWithdrawal(linked,e,Date.now()),linked);assertPaidBoth(linked,true);
  const h=handlerEnv(linked);h.env.cloud={confirmExpenseWithdrawal:()=>{throw Error("no llamar");}};
  realHandler("recognizeWithdrawal",h.env)(e);assert.equal(h.toasts[0],"f_withdraw_receipt_blocked");assert.equal(h.current,linked);
});
await check("vínculo llega durante diálogo real: no nube, no neutralidad ni cambio de pago A/B",async()=>{
  const {e,base,linked,remote}=receiptFixture(),c=client({row:remote}),h=handlerEnv(base);
  h.env.cloud={confirmExpenseWithdrawal:(x,read)=>run(c,x,read)};
  realHandler("recognizeWithdrawal",h.env)(e);h.setCurrent(linked);h.yes();await new Promise(setImmediate);
  assert.equal(c.updates,0);assert.equal(c.ops.length,0);assert.equal(h.current,linked);assertPaidBoth(h.current,true);
  assert.equal(h.toasts.at(-1),"f_withdraw_receipt_blocked");assert.equal(h.pending.current[e.id],undefined);
});
for(const stage of ["afterSession","afterRead"])await check("vínculo llega en "+stage+": CAS no empieza",async()=>{
  const {e,base,linked,remote}=receiptFixture();let current=base;
  const c=client({row:remote,[stage]:()=>{current=linked;}});
  await assert.rejects(()=>run(c,e,()=>current));assert.equal(c.updates,0);assertPaidBoth(current,true);
});
for(const stage of ["afterSend","afterAck"])await check("vínculo en "+stage+": handler+ACK concilian pago A/B tras pull, banco420 y cash30 intactos",async()=>{
  const {e,base,remote}=receiptFixture();
  const input={...base,budget:500,obAccounts:[],accounts:[{...base.accounts[0],value:500,role:"ambos",spendFrom:true,inject:0},base.accounts[1]]};
  const links=[{ok:true,aspsp:"CaixaBank",accounts:[{ok:true,uid:"fixture-account",iban:"fixture",
    balances:[{type:"CLBD",amount:420,currency:"EUR"}],transactions:input.bankTx}]}];
  const before=ctx.applyBankBalances(input,links).state,h=handlerEnv(before);
  const linked=ctx.linkFixedPayment(before,e.id,"agua-prueba",2026,9,26);
  assertPaidBoth(linked,true);assert.equal(ctx.monthBudgetStats(before).spent,80);
  const c=client({row:remote,[stage]:()=>h.setCurrent(linked)});
  h.env.cloud={confirmExpenseWithdrawal:(x,read)=>run(c,x,read)};
  realHandler("recognizeWithdrawal",h.env)(e);h.yes();await new Promise(setImmediate);
  assert.equal(c.updates,1);assert.equal(c.data.cat,"traspaso");
  assert.equal(h.statuses.at(-1).status,"done");assert.equal(h.statuses.at(-1).receiptUndone,true);
  assert.equal(h.toasts.at(-1),"f_withdraw_receipt_undone");assert.equal(h.pending.current[e.id],undefined);
  assert.equal(h.current.expenses[0].category,"traspaso");assert.equal(h.current.expenses.length,1);
  assert.equal(h.current.accounts,before.accounts);assert.equal(h.current.bankTx,before.bankTx);
  assert.equal(h.current.deleted,before.deleted);assert.equal(h.current.accounts[1].value,30);
  assert.equal(h.current.fixed[0].amount,40);assert.equal(h.current.fixed[0].bankAmount,80);
  assert.equal(h.current.fixed[0].paidYm,linked.fixed[0].paidYm);assert.equal(h.current.fixed[0].paidDay,linked.fixed[0].paidDay);
  assert.equal(ctx.monthBudgetStats(h.current).spent,0);assertPaidBoth(h.current,false);
  const shown=s=>{const ins=ctx.insumosSaldoGasto(s);return ctx.saldoCuentaMostrada(s.accounts[0],ins);};
  assert.equal(shown(before),420);assert.equal(shown(h.current),420);
  const merged=ctx.mergeExpensesFromCloud(h.current.expenses,[ctx.expenseFromRow(c.data)],Date.now()+1);
  const pulled=ctx.applyBankBalances({...h.current,expenses:merged.list},links).state;
  assert.equal(merged.list.length,1);assert.equal(merged.list[0].id,e.id);
  assert.equal(shown(pulled),420);assert.equal(pulled.accounts[1].value,30);assertPaidBoth(pulled,false);
});
for(const [name,opts] of [["fallo",{error:true}],["cero ACK",{zero:true}],
  ["UUID distinto",{ack:[{...row,cat:"traspaso",id:"other"}]}],
  ["identidad distinta",{ack:[{...row,cat:"traspaso",importe:81}]}]])
  await check("vínculo tardío sin ACK válido ("+name+"): handler no deshace prueba ni neutraliza",async()=>{
    const {e,base,linked,remote}=receiptFixture(),h=handlerEnv(base);
    const c=client({row:remote,...opts,afterSend:()=>h.setCurrent(linked)});
    h.env.cloud={confirmExpenseWithdrawal:(x,read)=>run(c,x,read)};
    realHandler("recognizeWithdrawal",h.env)(e);h.yes();await new Promise(setImmediate);
    assert.equal(c.updates,1);assert.equal(h.current,linked);assertPaidBoth(h.current,true);
    assert.equal(h.current.expenses[0].category,"otros");assert.equal(h.statuses.at(-1).status,"error");
    assert.equal(h.pending.current[e.id],undefined);
  });
await check("ACK de lectura o inexistente no permite revocar vínculo; otra categoría/identidad local tampoco",()=>{
  const {e,linked,remote}=receiptFixture(),ack={...remote,cat:"traspaso"};
  assert.equal(ctx.reconcileConfirmedWithdrawal(linked,e,ack,Date.now()),linked);
  assert.equal(ctx.reconcileConfirmedWithdrawal(linked,e,null,Date.now()),linked);
  for(const patch of [{category:"super"},{amount:81},{date:"2026-09-24"},{source:"manual"}]){
    const changed={...linked,expenses:[{...e,...patch}]};
    assert.equal(ctx.reconcileConfirmedWithdrawal(changed,e,{...ack,withdrawalUpdated:true},Date.now()),changed);
    assert.equal(changed.fixed,linked.fixed);
  }
  const paidOther={...linked,fixed:[{...linked.fixed[0],paymentProofs:{...linked.fixed[0].paymentProofs,[2026*12+8]:{kind:"expense",key:"other-month"}}},
    {id:"other",paymentProofs:{[2026*12+9]:{kind:"expense",expenseId:"other-uuid",key:"other",identity:"other"}}}]};
  const applied=ctx.reconcileConfirmedWithdrawal(paidOther,e,{...ack,withdrawalUpdated:true},Date.now());
  assert.deepEqual(applied.fixed[0].paymentProofs[2026*12+8],paidOther.fixed[0].paymentProofs[2026*12+8]);
  assert.equal(applied.fixed[1],paidOther.fixed[1]);
});
await check("handler fuera de sandbox no toma un retorno vacío por una confirmación",async()=>{
  const {e,base,linked}=receiptFixture();
  for(const ack of [undefined,null,{}, {cat:"traspaso",id:"other"}]){
    const h=handlerEnv(base);h.env.cloud={confirmExpenseWithdrawal:async()=>{h.setCurrent(linked);return ack;}};
    realHandler("recognizeWithdrawal",h.env)(e);h.yes();await new Promise(setImmediate);
    assert.equal(h.current,linked);assertPaidBoth(h.current,true);assert.equal(h.statuses.at(-1).status,"error");
  }
  const h=handlerEnv(base);h.env.cloud={confirmExpenseWithdrawal:async()=>undefined};
  realHandler("recognizeWithdrawal",h.env)(e);h.yes();await new Promise(setImmediate);
  assert.equal(h.current,base);assert.equal(h.current.expenses[0].category,"otros");
  assert.equal(h.statuses.at(-1).status,"error");
});
await check("deshacer por linkFixedPayment habilita retirada ACK sin pago residual en B",async()=>{
  const {e,linked,remote}=receiptFixture();const unlinked=ctx.linkFixedPayment(linked,e.id,null,2026,9,26);
  assert.equal(unlinked.accounts,linked.accounts);assert.equal(unlinked.expenses,linked.expenses);
  assert.equal(ctx.canRecognizeWithdrawal(e,unlinked),true);assertPaidBoth(unlinked,false);
  const c=client({row:remote});await run(c,e,()=>unlinked);
  const marked=ctx.applyRecognizedWithdrawal(unlinked,e,Date.now());
  assert.equal(marked.expenses[0].category,"traspaso");assert.equal(c.updates,1);assert.equal(marked.fixed,unlinked.fixed);
  assert.equal(marked.accounts,linked.accounts);assertPaidBoth(marked,false);
});
await check("renombrar conserva vínculo real por UUID/identidad y su puerta de deshacer",()=>{
  const {e,linked}=receiptFixture(),renamed={...e,merchant:"Nombre visible cambiado"};
  const rekeyed=ctx.rekeyFixedPaymentExpense(linked,e,renamed),s={...rekeyed,expenses:[renamed]};
  assert.equal(ctx.canRecognizeWithdrawal(renamed,s),false);assert.equal(ctx.withdrawalReceiptLink(s,renamed).id,"agua-prueba");
  const unlinked=ctx.linkFixedPayment(s,renamed.id,null,2026,9,26);assert.equal(ctx.canRecognizeWithdrawal(renamed,unlinked),true);
});
await check("puerta real Paga un recibo bloquea inicio y confirmación tardía mientras Retirada espera",async()=>{
  const {e,base,fixed}=receiptFixture(),h=handlerEnv(base),setReceipt=realHandler("setReceipt",h.env);
  h.pending.current[e.id]=true;setReceipt(e,fixed.id);assert.equal(h.current,base);assert.equal(h.toasts.at(-1),"f_withdraw_receipt_pending");
  delete h.pending.current[e.id];setReceipt(e,fixed.id);h.pending.current[e.id]=true;h.yes();await new Promise(setImmediate);
  assert.equal(h.current,base);assert.equal(h.toasts.at(-1),"f_withdraw_receipt_pending");
  delete h.pending.current[e.id];setReceipt(e,fixed.id);h.yes();await new Promise(setImmediate);assertPaidBoth(h.current,true);
});
await check("sin feed local válido el vínculo durable conserva bloqueo y deshacer accesible",()=>{
  const {e,linked}=receiptFixture(),s={...linked,bankTx:linked.bankTx.map(tx=>({...tx,status:"PDNG"}))};
  assert.equal(ctx.fixedPaymentProof(s,s.fixed[0],2026,9,26),null);
  assert.equal(ctx.withdrawalReceiptLink(s,e).id,"agua-prueba");assert.equal(ctx.canRecognizeWithdrawal(e,s),false);
  const h=handlerEnv(s);realHandler("setReceipt",h.env)(e,null);
  assert.equal(h.current.accounts,s.accounts);assert.equal(h.current.expenses,s.expenses);assertPaidBoth(h.current,false);
});
await check("nube exige lector actual: no se omite el bloqueo llamando sin estado",async()=>{
  const c=client();await assert.rejects(()=>run(c,expense,null));assert.equal(c.updates,0);assert.equal(c.ops.length,0);
});

console.log(`retirada-bancaria: ${cases} casos OK`);
