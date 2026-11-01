import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {execFileSync} from "node:child_process";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";

const base="c89bb12c528f079640a514b95334c21b9df2d2c1";
const root=new URL("../",import.meta.url),read=p=>fs.readFileSync(new URL(p,root),"utf8");
const copy=x=>JSON.parse(JSON.stringify(x)),cents=x=>Math.round(Number(x)*100);
const y=2026,m=10,today=18,ym=y*12+m;
function logic(source=process.env.AELY_T4_SOURCE){
  let motor=source==="base"?execFileSync("git",["show",base+":src/modules/08-motor-bank.js"],{cwd:root,encoding:"utf8"}):read("src/modules/08-motor-bank.js");
  const mutant=process.env.AELY_T4_MUTANT;
  if(mutant&&source!=="base"){
    const replacement={patch:["!pagadoPersistido||contractChanged||cambio","true"],
      steps:["!pagadoPersistido||contrato||cambio","true"],
      "persisted-patch":["!pagadoPersistido||contractChanged||cambio","contractChanged||cambio"],
      "persisted-steps":["!pagadoPersistido||contrato||cambio","contrato||cambio"],
      "steps-top-day":["cleanDay(old.day)!==cleanDay(n.day)","false"]}[mutant];
    const from=replacement&&replacement[0];
    assert.ok(from&&motor.includes(from),"el mutante debe alcanzar el guard real");
    assert.equal(motor.split(from).length-1,1,"una sola frontera causal por mutante");
    motor=motor.replace(from,replacement[1]);
  }
  const js=JSON.parse(read("src/build-order.json")).map(f=>f==="08-motor-bank.js"?motor:read("src/modules/"+f)).join("\n");
  const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
  c.Date=class extends Date{
    constructor(...args){super(...(args.length?args:["2026-10-18T12:00:00+02:00"]));}
    static now(){return Date.parse("2026-10-18T12:00:00+02:00");}
  };
  const main=read("src/modules/11-app-main.js").replaceAll("\r\n","\n");
  const start=main.indexOf("const totals=useMemo(()=>{"),end=main.indexOf("\n\n  const budgetMonth=",start);
  assert.ok(start>=0&&end>start,"cargar callback real de totals y minByBank");
  c.realTotals=vm.runInNewContext("(function(state,calendarDay){"+main.slice(start,end)+";return totals;})",c);
  return c;
}
const c=logic(),baseline=logic("base");
function fixture(ctx=c,kind="book"){
  let s={accounts:[{id:"account-synthetic",ent:"sabadell",role:"fijos",value:100}],
    fixed:[{id:"bill-synthetic",name:"Recibo sintético",amount:12.99,day:28,freq:"mes",account:"sabadell"}],
    bankTx:[],expenses:[],debts:[],oneoffs:[],flows:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],settings:{}};
  if(kind==="book"){
    s.bankTx=[{id:"ref-synthetic",ent:"sabadell",date:"2026-10-10",amount:12.99,merchant:"RECIBO SINTETICO",status:"BOOK"}];
    s=ctx.reconcileFixedPaymentProofs(s,y,m,today);
  }else if(kind==="manual")Object.assign(s.fixed[0],{paidYm:ym,paidDay:10});
  else if(kind==="wallet")s.expenses=[{id:"wallet-synthetic",ent:"sabadell",date:"2026-10-10",amount:12.99,merchant:"RECIBO SINTETICO",source:"wallet",category:"recibos"}];
  return copy(s);
}
function edit(ctx,s,route,patch,scope="desde"){
  if(route==="steps")return ctx.fixedEditarRecibo(s,"bill-synthetic",patch,scope,y,m,today);
  let out;ctx.patchFixedById(fn=>{out=fn(s);},"bill-synthetic",patch);return out;
}
function snapshot(ctx,s){
  const f=s.fixed[0],st=ctx.fixedPaymentState(s,f,y,m,today),leido=ctx.saldoLeidoDelBanco(s,"sabadell");
  const events=ctx.pendingWalkEvents(s,y,m,today),totals=ctx.realTotals(s,"2026-10-18");
  return copy({paid:st.paid,day:st.day,paidAmount:cents(st.paidAmount||0),proof:st.proof,
    paidYm:f.paidYm,paidDay:f.paidDay,wait:f.wait,inBalance:ctx.reciboEnElSaldo(s,f,y,m,today,leido,st.day),
    events:events.map(e=>({...e,amt:cents(e.amt)})),walk:cents(ctx.minWalk(100,events).min),
    minByBank:cents(totals.minByBank.sabadell),shown:cents(totals.bankBal.sabadell),projected:cents(totals.projectedByBank.sabadell)});
}
for(const route of ["patch","steps"])test("BOOK "+route+": mismo importe y día conserva prueba, fila y céntimos",()=>{
  for(const patch of [{amount:12.99,day:28},{amount:"12.990",day:"28"},{amount:12.990000001,day:"028"},{name:"RECIBO SINTÉTICO",day:28}]){
    const s=fixture(),frozen=copy(s),before=snapshot(c,s),n=edit(c,s,route,patch),after=snapshot(c,n);
    assert.equal(before.paid,true);assert.equal(before.paidYm,undefined);assert.equal(before.inBalance,false);
    assert.equal(before.proof.kind,"book");assert.equal(before.proof.identity,'["sabadell","2026-10-10",12.99,"RECIBO SINTETICO"]');
    assert.equal(before.paidAmount,1299);assert.deepEqual(before.events,[{bank:"sabadell",day:28,amt:-1299,sinRestar:true}]);
    assert.equal(before.walk,8701);
    assert.equal(before.minByBank,8701);assert.equal(before.shown,10000);assert.equal(before.projected,8701);
    assert.equal(after.paidYm,undefined,"guardar sin cambio no fabrica paidYm ni acredita saldo leído");
    assert.deepEqual(after,before,"estado, prueba BOOK, fila pendiente y previsiones exactos antes/después");
    assert.equal(n.fixed[0].id,s.fixed[0].id);assert.equal(cents(n.fixed[0].amount),1299);
    for(const key of ["accounts","expenses","bankTx","deleted"])assert.deepEqual(n[key],frozen[key],key);
    assert.deepEqual(s,frozen,"el editor no muta la entrada");
  }
});

function freshPending(){
  const s=fixture(c,"pending");
  s.lastBankSync=Date.parse("2026-10-18T12:00:00+02:00")-60000;
  s.bankTx=[{id:"other-synthetic",ent:"sabadell",date:"2026-10-10",amount:45,merchant:"OTRO SEGURO",status:"BOOK"}];
  return s;
}
function sameAsBase(s,route,patch,scope="desde"){
  const before=copy(s),inputBase=copy(s),n=edit(c,s,route,patch,scope),b=edit(baseline,inputBase,route,patch,scope);
  assert.deepEqual(snapshot(c,n),snapshot(baseline,b),"paidYm/paidDay/wait/proof/events/minByBank/céntimos frente a funciones reales de base");
  assert.deepEqual(copy(n.fixed),copy(b.fixed),"contrato completo del recibo frente a la base");
  for(const key of ["accounts","expenses","bankTx","deleted"]){assert.deepEqual(n[key],before[key],key);assert.deepEqual(b[key],before[key],key+" base");}
  assert.deepEqual(s,before,"sin mutación de la entrada candidata");
  assert.deepEqual(inputBase,before,"sin mutación de la entrada base");
  return n;
}
function newBook(wait){
  const s=fixture(c,"pending");
  s.bankTx=[{id:"ref-synthetic",ent:"sabadell",date:"2026-10-10",amount:12.99,merchant:"RECIBO SINTETICO",status:"BOOK"}];
  if(wait)s.fixed[0].wait=ym;
  return s;
}
for(const route of ["patch","steps"])for(const wait of [true,false])test("sin persistida "+route+": BOOK nuevo "+(wait?"con wait":"sin wait")+" conserva base",()=>{
  for(const patch of [{day:28,amount:12.99},{day:"028",amount:"12.990"}]){
    const s=newBook(wait),before=snapshot(c,s);
    assert.equal(s.fixed[0].paymentProofs,undefined);assert.equal(before.proof,null);assert.equal(before.paid,true);
    const n=sameAsBase(s,route,patch),st=snapshot(c,n);
    assert.equal(n.fixed[0].paidYm,ym,"el feed nuevo sin prueba persistida conserva confirmación previa");
    assert.equal(n.fixed[0].paidDay,10);assert.equal(n.fixed[0].wait,undefined);
    assert.equal(st.proof,null);assert.equal(st.inBalance,true);assert.deepEqual(st.events,[]);
    assert.equal(st.shown,8701);assert.equal(st.minByBank,8701);assert.equal(st.projected,8701);
  }
});
for(const route of ["patch","steps"])test("paidYm inválido "+route+": no basta que exista la marca",()=>{
  for(const mark of [{paidYm:ym,paidDay:0},{paidYm:ym,paidDay:19},{paidYm:ym,paidDay:null},
    {paidYm:ym,paidDay:"inválido"},{paidYm:ym-1,paidDay:10},{paidYm:ym+1,paidDay:10}]){
    const s=newBook(true);Object.assign(s.fixed[0],mark);
    assert.equal(c.fixedPaymentProof(s,s.fixed[0],y,m,today),null);
    const n=sameAsBase(s,route,{day:28});
    assert.equal(n.fixed[0].paidYm,ym);assert.equal(n.fixed[0].paidDay,10);assert.equal(n.fixed[0].wait,undefined);
  }
});
for(const route of ["patch","steps"])test("prueba inválida "+route+": BOOK guardado no reconocido conserva base",()=>{
  for(const invalid of ["contrato","mes"]){
    const s=fixture(),f=s.fixed[0];f.wait=ym;
    if(invalid==="contrato")f.paymentProofs[ym].model="contrato ajeno";
    else{
      const p=f.paymentProofs[ym];p.date="2026-09-10";p.identity=c.fixedPaymentIdentity(p.bank,p);
      f.paidYm=ym;f.paidDay=10;
    }
    assert.equal(c.fixedPaymentProof(s,f,y,m,today),null);
    const n=sameAsBase(s,route,{day:28}),st=snapshot(c,n);
    assert.equal(n.fixed[0].paidYm,ym);assert.equal(n.fixed[0].paidDay,10);assert.equal(n.fixed[0].wait,undefined);
    assert.equal(st.proof,null);assert.equal(st.paid,true);assert.equal(st.inBalance,true);
  }
});
for(const route of ["patch","steps"])test("sin persistida "+route+": Wallet detectada no es prueba guardada",()=>{
  const s=fixture(c,"wallet");s.fixed[0].wait=ym;
  assert.equal(c.fixedPaymentProof(s,s.fixed[0],y,m,today),null);
  assert.equal(c.fixedPaymentState(s,s.fixed[0],y,m,today).paid,true);
  const n=sameAsBase(s,route,{day:28});
  assert.equal(n.fixed[0].wait,undefined,"detección visual sin prueba no activa guardia no-op");
  assert.equal(n.fixed[0].paidYm,undefined);
});
function persisted(kind){
  if(kind==="paidYm")return fixture(c,"manual");
  const s=fixture(c,"pending");
  s.expenses=[{id:"linked-synthetic",ent:"sabadell",date:"2026-10-10",amount:12.99,merchant:"Cargo vinculado sintético",source:kind==="Wallet"?"wallet":"ob-hist",category:"recibos"}];
  const linked=c.linkFixedPayment(s,"linked-synthetic","bill-synthetic",y,m,today);
  assert.ok(c.fixedPaymentProof(linked,linked.fixed[0],y,m,today),"fixture con vínculo real reconocido");
  return copy(linked);
}
for(const route of ["patch","steps"])for(const kind of ["Wallet","bancaria","paidYm"])test("persistida "+route+": "+kind+" conserva no-op y prueba",()=>{
  for(const patch of [{day:28,amount:12.99},{day:"028",amount:"12.990"}]){
    const s=persisted(kind),before=copy(s),st=snapshot(c,s),n=edit(c,s,route,patch),b=edit(baseline,copy(s),route,patch);
    assert.equal(st.paid,true);assert.equal(st.inBalance,kind!=="Wallet");
    assert.deepEqual(snapshot(c,n),st,"la prueba persistida reconocida y la frontera monetaria no cambian");
    assert.equal(n.fixed[0].id,s.fixed[0].id);assert.deepEqual(s,before);
    assert.equal(n.fixed[0].paidYm,kind==="paidYm"?ym:undefined);
    if(kind==="bancaria"){
      if(route==="patch"&&typeof patch.amount==="string"){
        assert.equal(b.fixed[0].paidYm,undefined,"la base invalida la prueba al cambiar la representación del importe");
        assert.equal(b.fixed[0].paidDay,undefined);
        assert.equal(baseline.fixedPaymentProof(b,b.fixed[0],y,m,today),null);
        assert.equal(b.fixed[0].amount,patch.amount,"la base conserva exactamente el importe textual recibido");
      }else assert.equal(b.fixed[0].paidYm,ym,"base acredita que el guard evita la marca redundante");
    }
    if(kind==="Wallet"){
      assert.equal(n.fixed[0].paymentProofs[ym].identity,s.fixed[0].paymentProofs[ym].identity);
      assert.deepEqual(st.events,[{bank:"sabadell",day:28,amt:-1299,sinRestar:true}]);
      assert.equal(st.shown,10000);assert.equal(st.minByBank,8701);assert.equal(st.projected,8701);
    }else{
      assert.deepEqual(st.events,[]);assert.equal(st.shown,8701);assert.equal(st.minByBank,8701);assert.equal(st.projected,8701);
    }
  }
});
test("frontera día efectivo: Desde ahora retira override mensual sin cambiar día global",()=>{
  const s=freshPending();s.fixed[0].soloMes={[ym]:{day:17}};s.fixed[0].wait=ym;
  const n=sameAsBase(s,"steps",{day:28}),f=n.fixed[0],st=snapshot(c,n);
  assert.equal(f.day,28);assert.equal(c.dayIn(s.fixed[0],m,y),17);assert.equal(c.dayIn(f,m,y),28);
  assert.equal(f.soloMes,undefined);assert.equal(f.wait,undefined,"el día futuro retira la espera anterior como en base");
  assert.equal(f.paidYm,undefined);assert.equal(f.paidDay,undefined);assert.equal(st.paid,false);assert.equal(st.proof,null);
  assert.deepEqual(st.events,[{bank:"sabadell",day:28,amt:-1299}]);
  assert.equal(st.shown,10000);assert.equal(st.minByBank,8701);assert.equal(st.projected,8701);
});
test("frontera importe efectivo: retirar override con day igual conserva trigger previo",()=>{
  const s=freshPending();s.fixed[0].day=17;s.fixed[0].soloMes={[ym]:{amt:14.01}};
  const n=sameAsBase(s,"steps",{amount:12.99,day:17}),f=n.fixed[0],st=snapshot(c,n);
  assert.equal(cents(c.occAmountIn(s.fixed[0],m,y)),1401);assert.equal(cents(c.occAmountIn(f,m,y)),1299);
  assert.equal(f.day,17);assert.equal(c.dayIn(f,m,y),17);assert.equal(f.soloMes,undefined);
  assert.equal(f.wait,ym,"importe efectivo real con day presente conserva recálculo de base");
  assert.equal(f.paidYm,undefined);assert.equal(f.paidDay,undefined);assert.equal(st.paid,false);assert.equal(st.proof,null);
  assert.deepEqual(st.events,[{bank:"sabadell",day:18,amt:-1299}]);
  assert.equal(cents(c.monthNetForAccount(n,"sabadell",y,m,today)),0);
  assert.equal(st.shown,10000);assert.equal(st.minByBank,8701);assert.equal(st.projected,8701);
});
test("frontera día global: mes BOOK congelado no oculta cambio real del día",()=>{
  const s=fixture(),identity=snapshot(c,s).proof.identity,n=sameAsBase(s,"steps",{day:29}),f=n.fixed[0],st=snapshot(c,n);
  assert.equal(f.day,29);assert.equal(c.dayIn(f,m,y),28);assert.equal(c.dayIn(f,11,y),29);
  assert.equal(f.paidYm,ym,"cambio global real mantiene la marca del contrato anterior");assert.equal(f.paidDay,10);assert.equal(f.wait,undefined);
  assert.equal(st.paid,true);assert.equal(st.proof.kind,"book");assert.equal(st.proof.identity,identity);
  assert.equal(st.inBalance,true);assert.deepEqual(st.events,[]);
  assert.equal(st.shown,8701);assert.equal(st.minByBank,8701);assert.equal(st.projected,8701);
});
test("frontera importe global: BOOK congelado conserva prueba y contrato anterior",()=>{
  const s=fixture(),identity=snapshot(c,s).proof.identity,n=sameAsBase(s,"steps",{amount:14.01,day:28}),f=n.fixed[0],st=snapshot(c,n);
  assert.equal(cents(f.amount),1401);assert.equal(cents(c.occAmountIn(f,m,y)),1299);assert.equal(cents(c.occAmountIn(f,11,y)),1401);
  assert.equal(f.paidYm,ym);assert.equal(f.paidDay,10);assert.equal(st.proof.identity,identity);
  assert.equal(st.paid,true);assert.equal(st.inBalance,true);assert.deepEqual(st.events,[]);
  assert.equal(st.shown,8701);assert.equal(st.minByBank,8701);assert.equal(st.projected,8701);
});
for(const route of ["patch","steps"])for(const patch of [{day:17},{amount:14.01},{amount:14.01,day:17}])test("cambio real "+route+": "+JSON.stringify(patch)+" conserva base",()=>{
  const s=freshPending(),n=sameAsBase(s,route,patch),f=n.fixed[0],st=snapshot(c,n),amount="amount" in patch?1401:1299;
  assert.equal(cents(f.amount),amount);assert.equal(st.paid,false);assert.equal(st.proof,null);
  assert.equal(f.paidYm,undefined);assert.equal(f.paidDay,undefined);
  if("day" in patch)assert.equal(f.wait,ym);else assert.equal(f.wait,undefined);
  assert.deepEqual(st.events,[{bank:"sabadell",day:"day" in patch?18:28,amt:-amount}]);
  assert.equal(st.shown,10000);assert.equal(st.minByBank,10000-amount);assert.equal(st.projected,10000-amount);
});
for(const route of ["patch","steps"])for(const kind of ["manual","wallet","pending"])test(route+": exclusión "+kind+" no cambia frente a la base",()=>{
  const s=fixture(c,kind),b=fixture(baseline,kind),patch={amount:12.99,day:28};
  const n=edit(c,s,route,patch),bn=edit(baseline,b,route,patch);
  assert.deepEqual(snapshot(c,n),snapshot(c,s),"el no-op conserva la frontera previa del pago");
  assert.deepEqual(snapshot(c,n),snapshot(baseline,bn),"comparación causal con funciones base en cada exclusión");
  if(kind==="manual"){assert.equal(n.fixed[0].paidYm,ym);assert.equal(n.fixed[0].paidDay,10);}
  else assert.equal(n.fixed[0].paidYm,undefined);
});
test("Solo este mes pendiente conserva otros meses y Desde ahora congela el ya pagado",()=>{
  const s=fixture(c,"pending"),n=edit(c,s,"steps",{amount:14.01,day:29},"mes");
  assert.equal(cents(c.occAmountIn(n.fixed[0],m,y)),1401);assert.equal(c.dayIn(n.fixed[0],m,y),29);
  assert.equal(cents(c.occAmountIn(n.fixed[0],11,y)),1299);assert.equal(c.dayIn(n.fixed[0],11,y),28);
  const paid=fixture(),out=edit(c,paid,"steps",{amount:14.01,day:29});
  assert.equal(cents(c.occAmountIn(out.fixed[0],m,y)),1299);assert.equal(c.dayIn(out.fixed[0],m,y),28);
  assert.equal(cents(c.occAmountIn(out.fixed[0],11,y)),1401);assert.equal(c.dayIn(out.fixed[0],11,y),29);
  assert.equal(c.fixedPaymentState(out,out.fixed[0],y,m,today).paid,true);
  assert.deepEqual(out.accounts,paid.accounts);assert.deepEqual(out.bankTx,paid.bankTx);
});
test("Solo este mes cruza vencimiento con sync fresca: conserva wait y céntimos de la base",()=>{
  const s=fixture(c,"pending");
  s.lastBankSync=Date.parse("2026-10-18T12:00:00+02:00")-60000;
  s.bankTx=[{id:"other-synthetic",ent:"sabadell",date:"2026-10-10",amount:45,merchant:"OTRO SEGURO",status:"BOOK"}];
  const before=copy(s),patch={day:17};
  const n=edit(c,s,"steps",patch,"mes"),b=edit(baseline,copy(s),"steps",patch,"mes");
  assert.equal(c.dayIn(n.fixed[0],m,y),17);assert.equal(n.fixed[0].day,28);
  assert.equal(n.fixed[0].wait,ym,"la ausencia de cargo en una sync fresca no acredita pago");
  assert.equal(c.fixedPaymentState(n,n.fixed[0],y,m,today).paid,false);
  assert.equal(cents(c.monthNetForAccount(n,"sabadell",y,m,today)),0);
  assert.deepEqual(snapshot(c,n),snapshot(baseline,b),"cambio real conserva el contrato de la base");
  assert.deepEqual(snapshot(c,n).events,[{bank:"sabadell",day:18,amt:-1299}]);
  assert.equal(snapshot(c,n).walk,8701);assert.deepEqual(s,before);
  const repeated=edit(c,n,"steps",{day:"017"},"mes"),repeatBase=edit(baseline,b,"steps",{day:"017"},"mes");
  assert.deepEqual(snapshot(c,repeated),snapshot(c,n),"repetir el día efectivo de soloMes conserva wait");
  assert.deepEqual(snapshot(c,repeated),snapshot(baseline,repeatBase));
});
