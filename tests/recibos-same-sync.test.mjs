import assert from "node:assert/strict";
import fs from "node:fs";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";

// Se ejercitan el importador y el anclaje reales, sin banco ni reloj de servidor simulado
// como reloj del móvil. El servidor queda deliberadamente un día POR DETRÁS del cliente.
const source=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const order=JSON.parse(source("src/build-order.json"));
const main=source("src/modules/11-app-main.js");
const js=order.map(f=>source("src/modules/"+f)).join("\n");
const shell=source("src/shell.html");
function logic(code=js){
  const c=loadPureLogic(shell.replace("<!--MC_APP_SCRIPT-->",()=>code));
  c.Date=class extends Date {constructor(...a){super(...(a.length?a:["2026-10-31T16:00:00+01:00"]));}static now(){return Date.parse("2026-10-31T16:00:00+01:00");}};
  return c;
}
const c=logic(),bank="sabadell",aspsp="Banco de Sabadell",balanceAt="2026-10-30T07:00:00Z";
const sync={at:Date.parse("2026-10-31T15:00:00Z"),id:"synthetic-client-read-alpha"};
const fixture=()=>({accounts:[{id:"account-a",ent:bank,role:"fijos",value:500,bankUid:"account-a"}],
  fixed:[{id:"receipt-a",name:"Sindicato Alfa",amount:42.37,freq:"mes",day:31,account:bank}],
  bankTx:[],expenses:[],debts:[],oneoffs:[],flows:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],settings:{}});
const links=()=>[{aspsp,ok:true,accountPhases:1,balanceAt,accounts:[{uid:"account-a",ok:true,balanceOk:true,
  balances:[{type:"ITAV",amount:457.63,currency:"EUR"}],transactions:[{ext_id:"charge-a",date:"2026-10-31",amount:42.37,merchant:"Sindicato Alfa",status:"BOOK"}]}]}];
function read(ctx=c,s=fixture(),ls=links(),stamp=sync){
  const txs=ctx.flattenBankTx(ls,s.bankTx,stamp),added=ctx.importObExpenses(s,txs,ls)||[];
  const expenses=ctx.tagObAccountsFromBankTx(ctx.enrichNotesFromBankTx(added.concat(s.expenses),txs),txs);
  const withTx={...s,bankTx:txs,expenses};
  const proofs=ctx.reconcileFixedPaymentProofs(withTx,2026,10,31);
  const anchored=ctx.reconcileEarlyIncomeAnchors(proofs,2026,10,31);
  const applied=ctx.applyBankBalances(anchored,ls,stamp).state;
  return {...applied,obBalAt:{...(s.obBalAt||{}),...Object.fromEntries(ls.filter(l=>l.balanceAt).map(l=>[l.aspsp,l.balanceAt]))}};
}
const pending=(s,ctx=c)=>ctx.bankPendingEvents(s,bank,2026,10,31);
const cents=n=>Math.round(n*100);
function included(s,ctx=c){assert.equal(pending(s,ctx).length,0,"BOOK de la misma lectura ya está incluido");}
function deferred(s){assert.equal(pending(s).length,1);assert.equal(pending(s)[0].sinRestar,true);assert.equal(cents(pending(s)[0].amt),-4237);}
let count=0;
function check(name,fn){fn();count++;console.log("PASS "+name);}

check("mismo sync: saldo real y recorrido exactos al céntimo con relojes distintos",()=>{
  const s=read();assert(c.fixedPaymentState(s,s.fixed[0],2026,10,31).paid);included(s);
  assert.equal(s.accounts[0].balSaldo,457.63);assert.equal(cents(c.minWalk(457.63,pending(s)).end),45763);
  assert.equal(s.bankTx[0].obSync.at,sync.at);assert.equal(s.expenses[0].obSync.id,sync.id);
  assert.equal(s.fixed[0].paidYm,undefined,"no inventa una marca que mueva el saldo");
});
check("otro sync con el MISMO milisegundo: d+1",()=>{const s=read();s.bankTx[0].obSync={...s.bankTx[0].obSync,id:"other-client-read"};deferred(s);});
check("otra hora aunque comparta id: d+1",()=>{const s=read();s.bankTx[0].obSync={...s.bankTx[0].obSync,at:sync.at+1};deferred(s);});
check("sin sello de transacción y cliente viejo: d+1",()=>{const s=read();delete s.bankTx[0].obSync;deferred(s);const old=read(c,fixture(),links(),null);deferred(old);assert.equal(old.accounts[0].obSync,undefined);});
check("sin evidencia cliente de saldo o sin obBalAt: d+1",()=>{const s=read();delete s.accounts[0].obSync;deferred(s);const x=read();delete x.obBalAt;deferred(x);});
check("saldo posterior d+1 conserva comportamiento antiguo",()=>{const s=read(c,fixture(),links(),null);s.obBalAt[aspsp]="2026-11-01T01:00:00Z";included(s);});
check("BOOK por gasto OB local sin extracto conserva sello comprobado",()=>{const s=read();s.bankTx=[];assert(c.fixedPaymentState(s,s.fixed[0],2026,10,31).paid);included(s);s.expenses[0].amount=43.37;deferred(s);});
check("prueba BOOK persistida tras renombrar conserva su lectura, PDNG explícito no",()=>{
  const s=read();s.fixed[0].name="Nombre editado";included(s);s.bankTx=[];included(s);
  s.expenses[0].status="PDNG";deferred(s);
});
check("otra referencia/cuenta y saldo editado no heredan sello",()=>{
  for(const mutate of [s=>{s.bankTx[0].id="other-ref";},s=>{s.bankTx[0].acc="other-account";},s=>{s.accounts[0].value+=1;},s=>{s.accounts[0].balSaldo+=1;},s=>{s.obBalAt[aspsp]="2026-10-31T07:00:00Z";}]){const s=read();mutate(s);deferred(s);}
});
check("una cuenta antigua o con saldo fallido veta la excepción del banco entero",()=>{
  const s=read();s.accounts.push({id:"account-b",ent:bank,role:"diario",value:100});deferred(s);
  const x=read();x.accounts[0].balanceStale=true;deferred(x);
});
check("saldo idéntico refresca sello, y una aplicación legacy lo invalida",()=>{
  const s=read(),again=read(c,s,links(),{...sync,id:"second-read"});included(again);assert.equal(again.accounts[0].obSync.id,"second-read");
  assert.equal(again.expenses.length,1);assert.equal(again.expenses[0].obSync.id,"second-read","también actualiza un gasto que ya existía");
  const legacy=c.applyBankBalances(again,links()).state;assert.equal(legacy.accounts[0].obSync,undefined);deferred(legacy);
});
check("respuesta parcial conserva la fila vieja sin resellarla como nueva",()=>{
  const s=read(),ls=links();ls[0].accounts[0].transactions=[];ls[0].accounts[0].transactionError="synthetic interrupted";ls[0].accounts[0].ok=false;
  const x=read(c,s,ls,{...sync,id:"partial-read"});assert.equal(x.bankTx[0].obSync.id,sync.id);deferred(x);
});
check("sin balanceAt de servidor no se fabrica equivalencia",()=>{const ls=links();delete ls[0].balanceAt;deferred(read(c,fixture(),ls));});
check("sin generador seguro la lectura conserva d+1",()=>{const s=read(c,fixture(),links(),{at:sync.at,id:null});deferred(s);assert.equal(s.bankTx[0].obSync,undefined);});
check("el puente nativo y un pagador de otra entidad no usan esta excepción",()=>{
  const s=read(),st=c.fixedPaymentState(s,s.fixed[0],2026,10,31);
  assert.equal(c.reciboEnMismoSync(s,s.fixed[0],{...st,paidBank:"revolut"}),false);
  const tr=JSON.parse(JSON.stringify(s).replaceAll("sabadell","trade_republic").replaceAll(aspsp,"Trade Republic"));
  tr.settings.brokersOn=[];
  assert.equal(c.fixedPaymentState(tr,tr.fixed[0],2026,10,31).paid,true);
  assert.equal(c.reciboEnMismoSync(tr,tr.fixed[0],c.fixedPaymentState(tr,tr.fixed[0],2026,10,31)),true);
  tr.settings.brokersOn=["trade_republic"];
  assert.equal(c.reciboEnMismoSync(tr,tr.fixed[0],c.fixedPaymentState(tr,tr.fixed[0],2026,10,31)),false);
});
check("mutante: ignorar identidad de lectura cae con mismo milisegundo",()=>{
  const marker="b.id===stamp.id&&";assert(js.includes(marker));const mutant=logic(js.replace(marker,""));
  const s=read(mutant);s.bankTx[0].obSync={...s.bankTx[0].obSync,id:"other-client-read"};
  assert.throws(()=>assert.equal(pending(s,mutant).length,1,"sync distinto debe conservar pendiente"),{code:"ERR_ASSERTION"});
});
check("mutante: retirar la excepción cae en el caso positivo causal",()=>{
  const marker="if(reciboEnMismoSync(state,e,status||fixedPaymentState(state,e,y,m,today))) return true;";assert(js.includes(marker));
  const mutant=logic(js.replace(marker,""));assert.throws(()=>included(read(mutant),mutant),{code:"ERR_ASSERTION"});
});
check("runBankSync comparte sello fuera del updater y no usa fallback inseguro",()=>{
  assert.match(main,/sync=\{at:at,id:mcRandomToken\(\)\}/);assert.match(main,/flattenBankTx\(links, prev\.bankTx, sync\)/);assert.match(main,/applyBankBalances\(anchored, links, sync\)/);
});
console.log("R6-2: "+count+" casos causales, sin red ni datos reales");
