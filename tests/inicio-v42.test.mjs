import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile,loadPureLogic } from "../scripts/load-pure-logic.mjs";
const c=loadPureLogicFromFile(), plain=x=>JSON.parse(JSON.stringify(x));
const today="2026-09-04", opts={today,liquid:600,invested:0,debtTotal:0};
const account=(id,ent)=>({id,ent,value:300,role:"fijos",bankIban:"synthetic-"+id});
const entry=(id,date,amount,ent="sabadell",category="super")=>({id,date:date+"T12:00:00Z",amount,ent,category});
const coverage=[entry("first-a","2026-09-01",0),entry("first-b","2026-09-01",0,"revolut")];
const base={accounts:[account("a","sabadell"),account("b","revolut")],investments:[],assets:[],debts:[],expenses:coverage,
  accountBalanceHistory:{"acc:a":[{day:"2026-09-01",value:500},{day:"2026-09-02",value:300}],
    "acc:b":[{day:"2026-09-01",value:100},{day:"2026-09-03",value:300}]},history:[0,9999999]};
const values=s=>plain(c.netWorthSeries(s,opts)).map(p=>p.value);
for(const commonEnd of [false,true]){
  const state={...base,accountBalanceHistory:{...base.accountBalanceHistory,"acc:a":base.accountBalanceHistory["acc:a"].concat(commonEnd?[{day:"2026-09-03",value:300}]:[])},
    expenses:coverage.concat(entry("out","2026-09-02",200,"sabadell","traspaso"),entry("in","2026-09-03",-200,"revolut","traspaso"))};
  assert.deepEqual(values(state),[600,600,600,600],"ambos contraejemplos de fotos escalonadas conservan el total");
  assert.deepEqual(values({...state,accountBalanceHistory:{}}),values(state),"las fotos bancarias no deciden el total");
}
assert.deepEqual(values({...base,expenses:coverage.concat(entry("expense","2026-09-02",100))}),[700,600,600,600],"el gasto baja ese día");
assert.deepEqual(values({...base,expenses:coverage.concat(entry("income","2026-09-03",-200))}),[400,400,600,600],"el ingreso sube ese día");
assert.deepEqual(values({...base,expenses:coverage.concat(entry("investment","2026-09-02",50,"sabadell","inversion"))}),[650,600,600,600],"invertir resta efectivo");
assert.deepEqual(values({...base,expenses:coverage.concat({...entry("payment","2026-09-02",50,"sabadell","deudas"),debtId:"debt"})}),[650,600,600,600],"un vínculo solo no borra la salida: la amortización se calcula desde su deuda");
assert.deepEqual(values({...base,expenses:coverage.concat(entry("payment","2026-09-02",50,"sabadell","deudas"))}),[650,600,600,600],"una cuota sin vínculo no se presume neutra");
assert.deepEqual(values({...base,expenses:coverage.concat({...entry("pending","2026-09-02",999),status:"PDNG"},{...entry("dup","2026-09-02",999),possibleDup:true},entry("future","2026-09-05",999),{id:"broken",date:"fecha rota",amount:999})}),[600,600,600,600]);
assert.deepEqual(values({...base,expenses:[coverage[0]]}),[600,600,600,600],"una cuenta conocida sin movimientos no oculta las demás");
assert.equal(c.netWorthSeries({...base,expenses:[coverage[0],entry("late","2026-09-03",0,"revolut")]},opts)[0].day,"2026-09-03","empieza con cobertura de TODOS los bancos");
const manual={...base,accounts:base.accounts.concat({id:"cash",ent:"efectivo",value:100,role:"fijos"}),accountBalanceHistory:{...base.accountBalanceHistory,"acc:cash":[{day:"2026-09-01",value:50},{day:"2026-09-03",value:100}]}};
assert.deepEqual(plain(c.netWorthSeries(manual,{...opts,liquid:700})).map(p=>p.value),[650,650,700,700],"manual sin movimientos cambia en escalón");
assert.deepEqual(plain(c.netWorthSeries({...manual,accountBalanceHistory:{}},{...opts,liquid:700})).map(p=>p.value),[700,700,700,700],"manual sin historial permanece constante");
const invested={...base,assets:[{id:"known",value:200,history:[{day:"2026-09-01",value:200,born:true}]}],debts:[{id:"loan",value:20,asOf:2026*12+7}],investments:[{value:100}],invHistory:[{d:"2026-09-02",v:50},{d:today,v:100}]};
assert.deepEqual(plain(c.netWorthSeries(invested,{...opts,invested:100,debtTotal:20})),[{day:"2026-09-02",value:830},{day:"2026-09-03",value:830},{day:today,value:880}],"inversiones desde su historial, bienes y deuda constantes");
assert.deepEqual(plain(c.netWorthSeries({...invested,invHistory:[]},{...opts,invested:100})),[],"sin historial no inventa inversiones");
const cent=c.netWorthSeries(invested,{...opts,liquid:600.23,invested:100.17,debtTotal:20.01}).at(-1);
assert.equal(cent.value,880.39,"último punto igual al patrimonio de hoy al céntimo");
assert.equal(c.netWorthSeries({...invested,assets:[]},{...opts,liquid:.004,invested:.004}).at(-1).value,.01,"se redondea el total completo como Inicio, también al convertir divisas");
assert.deepEqual(plain(c.netWorthSeries({...invested,investments:[{value:10,cur:"XYZ"}]},{...opts,invested:0})),[],"sin conversión fiable no inventa inversión cero");
assert.deepEqual(values({...base,history:[-900000]}),values(base),"state.history no afecta a la gráfica");
// Contraste independiente por cada fecha, sin la agrupación por horas del lector optimizado.
// Atraviesa medianoches y ambos cambios horarios: el gasto pertenece al día civil de Madrid.
for(const start of ["2026-03-27T20:00:00Z","2026-10-23T20:00:00Z"]){
  const initial=Date.parse(start), fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"});
  const movements=Array.from({length:145},(_,i)=>({id:"calendar-"+i,date:new Date(initial+i*1800000).toISOString(),amount:i===0?0:i%3===0?-2:1,category:"super",ent:"sabadell"}));
  const through=fmt.format(initial+144*1800000), current=1000;
  const result=plain(c.netWorthSeries({accounts:[account("a","sabadell")],expenses:movements},{today:through,liquid:current,invested:0,debtTotal:0}));
  for(const point of result){
    const after=movements.filter(e=>fmt.format(Date.parse(e.date))>point.day).reduce((sum,e)=>sum+e.amount,0);
    assert.equal(point.value,current+after,"cada cierre equivale al total actual menos los flujos posteriores, incluso con cambio horario");
  }
  assert.equal(result.at(-1).value,current);
}

for(const [spent,budget,elapsed,days,id,tone] of [[1001,1000,1,30,"over","coral"],[900,1000,2,30,"start","mint"],
  [250,1000,12,30,"comfort","mint"],[500,1000,12,30,"good","mint"],[800,1000,12,30,"tight","tan"],[801,1000,12,30,"slow","tan"]]){
  const result=c.cyclePaceState(spent,budget,elapsed,days); assert.equal(result.id,id); assert.equal(result.tone,tone);
}
assert.equal(c.cyclePaceState(100,0,10,30).id,"over");
assert.equal(c.cyclePaceState(1000,1000,29,30).id,"good","agotado no es excedido");
assert.equal(c.cyclePaceState(1000.00000001,1000,29,30).id,"good","el ruido de coma flotante no crea exceso");
assert.equal(c.cyclePaceState(1000.01,1000,29,30).excess,.01);
assert.equal(c.cycleMoney(-.01),"-0,01 €","el exceso de un céntimo no se oculta");
const payState={settings:{budgetCycle:true},flows:[],expenses:[{id:"salary",date:"2026-08-31T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso",ent:"sabadell"}]};
const start=new Date(2026,7,31).getTime(), now=new Date(2026,8,29,12).getTime();
const nativeDate=c.Date;
c.Date=class extends Date{ constructor(...args){ super(...(args.length?args:[now])); } static now(){ return now; } };
const detected=c.dashboardBudgetStats(payState);
assert.equal(detected.periodStart,start);assert.equal(detected.cycle,true,"el lector acredita la nómina, no el calendario");
const time=c.cycleTiming(detected,now);
assert.deepEqual(plain(time),{days:30,elapsed:29,left:1,reliable:true},"el próximo cobro desde el31 se acota al mes corto");
assert.equal(c.cycleTiming(c.dashboardBudgetStats({...payState,expenses:[]}),now).reliable,false,"preferencia activa sin nómina fiable no inventa ritmo");
c.Date=nativeDate;
const madridMonth=c.cycleTiming({periodStart:Date.parse("2026-08-31T22:00:00Z"),cycle:false},Date.parse("2026-09-26T12:00:00Z"));
assert.deepEqual(plain(madridMonth),{days:30,elapsed:25,left:5,reliable:false},"el mes natural de Madrid no dura un día en un dispositivo UTC");
assert.equal(c.cyclePaceState(950,1000,madridMonth.elapsed,madridMonth.days).id,"tight","un límite casi agotado no puede decir sobrado por la zona horaria");
for(const [start,now,cycle,expected] of [
  ["2026-08-30T22:00:00Z","2026-09-29T12:00:00Z",true,{days:30,elapsed:29,left:1,reliable:true}],
  ["2026-10-24T22:00:00Z","2026-10-25T23:30:00Z",true,{days:31,elapsed:1,left:30,reliable:true}],
  ["2026-03-27T23:00:00Z","2026-03-29T22:30:00Z",true,{days:31,elapsed:2,left:29,reliable:true}],
  ["2024-01-31T23:00:00Z","2024-02-29T12:00:00Z",false,{days:29,elapsed:28,left:1,reliable:false}],
  ["2026-12-30T23:00:00Z","2027-01-01T12:00:00Z",true,{days:31,elapsed:1,left:30,reliable:true}],
]) assert.deepEqual(plain(c.cycleTiming({periodStart:Date.parse(start),cycle},Date.parse(now))),expected,"mes, ciclo, mes corto y cambio horario usan días civiles de Madrid");
const midnight=Date.parse("2026-09-25T22:30:00Z");
c.Date=class extends Date{ constructor(...args){ super(...(args.length?args:[midnight])); } static now(){ return midnight; } };
const midnightSeries=c.netWorthSeries({...base,accounts:[{...base.accounts[0],value:500},base.accounts[1]],
  expenses:coverage.concat({id:"midnight-income",date:"2026-09-25T22:10:00Z",amount:-200,category:"ingreso",ent:"sabadell"})},{liquid:800,invested:0,debtTotal:0});
assert.equal(midnightSeries.at(-1).day,"2026-09-26","hoy y los movimientos usan Madrid también antes de medianoche UTC");
assert.equal(midnightSeries.at(-2).value,600,"el ingreso de hoy no se adelanta al día anterior");
assert.equal(midnightSeries.at(-1).value,800);
c.Date=nativeDate;
const points=Array.from({length:400},(_,i)=>({day:new Date(Date.UTC(2025,7,i+1)).toISOString().slice(0,10),value:i}));
const hist={"acc:a":points},last=points.at(-1).day;
assert.equal(c.recordAccountBalances(hist,last,[{key:"acc:a",value:399}]),hist,"sin cambio mantiene referencia completa");
const updated=c.recordAccountBalances(hist,last,[{key:"acc:a",value:400}]);
assert.equal(updated["acc:a"].length,400); assert.equal(updated["acc:a"][0].day,points[0].day);
assert.equal(c.recordAccountBalances(hist,"2027-01-01",[{key:"acc:a",value:0}])["acc:a"].length,400);
const interrupted=new Map(); let failedKey="";
c.localStorage={getItem:k=>interrupted.get(k)??null,setItem:(k,v)=>{if(k===failedKey)throw new Error("storage lleno");interrupted.set(k,v);},removeItem:k=>interrupted.delete(k)};
for(const key of ["fallback-real","fallback-sandbox"]){
  const old={expenses:[],accountBalanceHistory:hist};
  interrupted.set(key,JSON.stringify(old));c.mcSaveRaw(key,old);
  failedKey=key+"_balhist";
  const newer={...old,accountBalanceHistory:updated};c.mcSaveRaw(key,newer,{expenses:false});
  assert.deepEqual(plain(c.mcLoadRaw(key).accountBalanceHistory),plain(updated),"partida H1 antigua + fallo al guardar H2: recargar conserva H2 del mismo día");
  failedKey="";c.mcSaveRaw(key,newer,{expenses:false});
  assert.equal(JSON.parse(interrupted.get(key)).accountBalanceHistory,undefined,"el mismo objeto reintenta tras recuperar espacio");
  assert.deepEqual(plain(c.mcLoadRaw(key).accountBalanceHistory),plain(updated));
  failedKey=key+"_balhist";
  const third=c.recordAccountBalances(updated,last,[{key:"acc:a",value:401.01}]);
  c.mcSaveRaw(key,{...old,accountBalanceHistory:third},{expenses:false});
  failedKey=key;
  const fourth=c.recordAccountBalances(third,last,[{key:"acc:a",value:402.02}]);
  c.mcSaveRaw(key,{...old,accountBalanceHistory:fourth},{expenses:false});failedKey="";
  assert.deepEqual(plain(c.mcLoadRaw(key).accountBalanceHistory),plain(fourth),"principal fallback antiguo + partida nueva durable gana aunque falle limpiar principal");
}
const key="main-cleanup";
interrupted.set(key,JSON.stringify({expenses:[],accountBalanceHistory:hist}));
failedKey=key;c.mcSaveRaw(key,{expenses:[],accountBalanceHistory:updated});failedKey="";
assert.deepEqual(plain(c.mcLoadRaw(key).accountBalanceHistory),plain(updated),"partida H2 durable + fallo al limpiar principal H1: recargar conserva H2");
console.log("inicio-v42: escrituras interrumpidas H1/H2 y recuperación OK");
const disk=new Map(), writes=[];
c.localStorage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>{disk.set(k,v);writes.push({key:k,bytes:Buffer.byteLength(v)});},removeItem:k=>disk.delete(k)};
for(const key of ["micartera_v3","micartera_sandbox"]){
  const old={accounts:[],expenses:[],accountBalanceHistory:hist};
  disk.set(key,JSON.stringify(old));
  const loaded=c.mcLoadRaw(key);
  assert.deepEqual(plain(loaded.accountBalanceHistory),hist,"carga la cartera anterior sin perder cierres");
  c.mcSaveRaw(key,loaded,{expenses:false});
  assert.deepEqual(JSON.parse(disk.get(key+"_balhist")).history,hist,"migra TODOS los 400 puntos en ambos modos");
  assert.equal(JSON.parse(disk.get(key)).accountBalanceHistory,undefined,"el estado principal queda ligero");
  writes.length=0;
  c.mcSaveRaw(key,{...loaded,_savedAt:1},{expenses:false});
  c.mcSaveRaw(key,{...loaded,accountBalanceHistory:plain(hist),_savedAt:2},{expenses:false});
  assert.equal(writes.filter(w=>w.key.endsWith("_balhist")).length,0,"referencia o sello nuevos sin cambio de valor no escriben historial");
  const beforeBytes=Buffer.byteLength(JSON.stringify({...old,_savedAt:2,expenses:undefined}));
  assert.ok(writes.filter(w=>w.key===key).every(w=>w.bytes<=beforeBytes),"cada escritura de primer plano no crece frente a la base");
  c.mcSaveRaw(key,{...loaded,accountBalanceHistory:updated},{expenses:false});
  assert.equal(writes.filter(w=>w.key.endsWith("_balhist")).length,1,"un cambio de valor escribe una sola vez");
  assert.deepEqual(plain(c.mcLoadRaw(key).accountBalanceHistory),plain(updated),"recargar conserva el valor cambiado");
}
c.mcResetSandbox();
assert.equal(disk.has("micartera_sandbox_balhist"),false,"reset sandbox limpia su tercera clave");
assert.equal(disk.has("micartera_v3_balhist"),true,"reset sandbox conserva la cartera real");
const brokenDisk=new Map([["legacy",JSON.stringify({expenses:[],accountBalanceHistory:hist})]]);
c.localStorage={getItem:k=>brokenDisk.get(k)??null,setItem:(k,v)=>{if(k.endsWith("_balhist"))throw new Error("storage lleno");brokenDisk.set(k,v);},removeItem:k=>brokenDisk.delete(k)};
c.mcSaveRaw("legacy",c.mcLoadRaw("legacy"),{expenses:false});
assert.deepEqual(JSON.parse(brokenDisk.get("legacy")).accountBalanceHistory,hist,"si falla la migración no elimina la única copia durable");
const series=Array.from({length:370},(_,i)=>({day:new Date(Date.UTC(2025,8,i+1)).toISOString().slice(0,10),value:i}));
assert.deepEqual(plain(c.netWorthRanges(series)).map(r=>r.id),["1m","6m","1y","all"]);
assert.deepEqual(plain(c.netWorthRanges(series,"2026-10-10")).map(r=>r.id),["all"],"una foto atrasada no compara meses respecto de hoy");
assert.deepEqual(plain(c.netWorthRanges(series,series.at(-1).day)).map(r=>r.id),["1m","6m","1y","all"]);
assert.deepEqual(plain(c.netWorthRanges(series.slice(-10))).map(r=>r.id),["all"]);
assert.deepEqual(plain(c.netWorthRanges(series.slice(-1))),[]);
for(const values of [[0,0,0,100],[-100,0,0,0],[1000,1001,1000,1002]]){
  const plot=c.netWorthChartGeometry(values.map(value=>({value})));
  assert.ok(plot.xy.every(p=>p.y>=8&&p.y<=72),"los extremos sesgados no se recortan");
  assert.ok(plot.span>=Math.abs(values.reduce((a,b)=>a+b,0)/values.length)*.06);
}
assert.equal(c.netWorthDeltaMoney(-1234.4),"1.234 €","variación sin signo ni decimales y con miles separados");
console.log("inicio-v42: motor, cobertura, seis estados, límites y rangos OK");

// Los totales salen del mismo camino de saldo pintado que App, nunca de un líquido
// escrito a mano: así una nómina modelada no puede camuflar el precipicio manual.
const realSeries=function(state,day){
  const time=Date.parse(day+"T12:00:00Z"),Original=c.Date;
  c.Date=class extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}};
  try{
    const ins=c.insumosSaldoGasto(state);
    const liquid=(state.accounts||[]).reduce((n,a)=>n+c.saldoCuentaMostrada(a,ins),0)+(state.obAccounts||[]).reduce((n,a)=>n+c.toEurAmt(a.value,a.cur||"EUR",state),0);
    const invested=(state.investments||[]).reduce((n,i)=>n+(c.invValueEur(i,state)||0),0);
    const debtTotal=(state.debts||[]).reduce((n,d)=>n+c.debtBalance(d),0);
    const result=c.netWorthSeries(state,{today:day,liquid,invested,debtTotal,balanceInputs:{...ins,roundupThisMonth:ins.roundup,monthlyInvestThisMonth:ins.monthlyInvest}});
    return {result,liquid,invested,debtTotal};
  }finally{c.Date=Original;}
};
const modelled={accounts:[{id:"bank",ent:"sabadell",value:1000,role:"fijos",bankIban:"synthetic"},
  {id:"manual",ent:"revolut",value:3000,role:"fijos"}],flows:[{id:"salary-model",kind:"income",to:"revolut",amount:1500,day:1,freq:"M"}],
  expenses:[entry("cover","2026-09-01",0)],accountBalanceHistory:{"acc:manual":[{day:"2026-09-01",value:4500},{day:"2026-09-03",value:4500},{day:"2026-09-04",value:4500}]}};
const actualManual=realSeries(modelled,today);
assert.equal(actualManual.liquid,5500,"la fórmula real suma el cobro modelado a la cuenta manual");
assert.deepEqual(plain(actualManual.result).map(p=>p.value),[5500,5500,5500,5500],"el cierre pintado4500 y el saldo actual pintado4500 no crean un precipicio de1500");
const separate=current=>values({...base,expenses:coverage.concat(current)});
assert.deepEqual(separate(entry("cent-flow","2026-09-02",1.37)),[601.37,600,600,600],"céntimos del flujo no se truncan");
const deleted=entry("deleted","2026-09-02",1.37);
assert.deepEqual(values({...base,expenses:coverage.concat(deleted),deleted:[c.keyOfExpense(deleted)]}),[600,600,600,600],"una lápida real no entra en la serie");
assert.deepEqual(values({...base,expenses:coverage.concat(entry("removed-bank","2026-09-02",200,"ing"))}),[600,600,600,600],"un banco que no forma parte del patrimonio no suma dinero ficticio");
for(const categories of [["traspaso","otros"],["otros","traspaso"]])assert.deepEqual(values({...base,expenses:coverage.concat(
  entry("pair-out","2026-09-02",300,"sabadell",categories[0]),entry("pair-in","2026-09-03",-300,"revolut",categories[1]))}),[600,600,600,600],"dos patas propias se emparejan aunque una categoría falte");
assert.deepEqual(separate(entry("external","2026-09-02",300,"sabadell","traspaso")),[900,600,600,600],"una sola pata a una cuenta ajena reduce el patrimonio");
assert.deepEqual(values({...base,expenses:coverage.concat(entry("out-not-salary","2026-09-02",300,"sabadell","traspaso"),entry("salary-coincides","2026-09-03",-300,"revolut","ingreso"))}),[600,300,600,600],"un ingreso conocido del mismo importe no se disfraza de la otra pata");
const recurring={...base,expenses:[entry("cover-a","2026-08-01",0),entry("cover-b","2026-08-01",0,"revolut"),
  entry("aug-out","2026-08-02",300,"sabadell","traspaso"),entry("aug-in","2026-08-03",-300,"revolut","otros"),
  entry("sep-out","2026-09-02",300,"sabadell","otros"),entry("sep-in","2026-09-03",-300,"revolut","traspaso")]};
assert.ok(c.netWorthSeries(recurring,opts).every(p=>p.value===600),"los traspasos mensuales repetidos se emparejan en su propia ventana");
assert.deepEqual(values({...base,expenses:coverage.concat(entry("prototype-bank","2026-09-02",200,"constructor"))}),[600,600,600,600],"un nombre heredado de Object tampoco es un banco propio");
const partial=c.netWorthSeries({...manual,accountBalanceHistory:{"acc:cash":[{day:"2026-09-03",value:100}]}},{...opts,liquid:700});
assert.equal(partial[0].day,"2026-09-03","antes del primer cierre manual no hay valor acreditado");
assert.equal(c.netWorthSeries({...base,accounts:[{...base.accounts[0],value:Infinity}]},opts).length,0,"saldo no finito nunca acredita un tramo");
const cashToday={...base,accounts:base.accounts.concat({id:"cash-today",ent:"efectivo",value:100,role:"fijos"}),expenses:coverage.concat(entry("cash-use",today,10,"efectivo"))};
assert.equal(c.netWorthSeries(cashToday,{...opts,liquid:690})[0].day,"2026-09-01","el primer gasto del sobre no elimina la cobertura bancaria anterior");
const loan={accounts:[{id:"a",ent:"sabadell",value:1000,role:"diario"}],expenses:[entry("cover","2026-09-01",0),entry("loan-income",today,-10000,"sabadell","ingreso")],
  debts:[{id:"loan",value:10000,asOf:2026*12+8,monthly:500,amort:400}]};
const loanResult=realSeries(loan,today).result;
assert.deepEqual(plain(loanResult),[{day:today,value:1000}],"sin día exacto del ancla se recorta, nunca deuda antes del préstamo");
for(const linked of [false,true]){
  const debtState={accounts:[{id:"a",ent:"sabadell",value:6500,role:"diario"}],expenses:[entry("cover","2026-09-01",0),
    {...entry("pay","2026-09-04",500,"sabadell","deudas"),...(linked?{debtId:"loan"}:{})}],
    debts:[{id:"loan",value:10000,monthly:500,amort:400,months:24,day:4,asOf:2026*12+8,asOfDate:"2026-09-01"}]};
  assert.deepEqual(plain(realSeries(debtState,"2026-09-05").result).map(p=>p.value),[-3500,-3500,-3500,-3600,-3600],"cuota500 amortiza400: solo100 de interés, con y sin vínculo");
}
const bought={accounts:[{id:"a",ent:"sabadell",value:16000,role:"diario"}],expenses:[entry("cover","2026-09-01",0),entry("car-pay",today,15000)],
  assets:[{id:"car",value:15000,history:[{day:today,value:15000,born:true}]}]};
assert.deepEqual(plain(realSeries(bought,today).result).map(p=>p.value),[16000,16000,16000,16000],"el coche no existe antes de su alta acreditada y su compra no duplica patrimonio");
const revalued={...bought,assets:[{...bought.assets[0],value:12000,history:bought.assets[0].history.concat({day:"2026-09-05",value:12000})}]};
assert.deepEqual(plain(realSeries(revalued,"2026-09-05").result).map(p=>p.value),[16000,16000,16000,16000,13000],"revalorar hoy no reescribe todos los días anteriores");
assert.deepEqual(plain(realSeries({...bought,assets:[{id:"car",value:15000}]},today).result),[{day:today,value:16000}],"un bien antiguo sin valores no se inventa antes de hoy");
for(const category of ["inversion","traspaso"]){
  const investmentState={accounts:[{id:"a",ent:"sabadell",value:3000,role:"diario"}],expenses:[entry("cover","2026-09-01",0),
    {...entry("contribute",today,500,"sabadell",category),merchant:"Aportación Trade Republic"}],investments:[{id:"fund",ent:"trade_republic",value:500}],
    invHistory:[{d:"2026-09-01",v:0},{d:"2026-09-07",v:500}]};
  assert.deepEqual(plain(realSeries(investmentState,"2026-09-07").result).map(p=>p.value),[3000,3000,3000,3000,3000,3000,3000],"una aportación propia entre fotos no crea un valle de500");
}
assert.equal(c.netWorthSeries({...base,investments:[{value:100}],invHistory:[{d:"2026-09-05",v:100}]},{...opts,invested:100}).length,0,"una foto futura no acredita inversión pasada");
const yearPayments=Array.from({length:12},(_,i)=>{const d=new Date(Date.UTC(2025,9+i,4,12)).toISOString().slice(0,10);return entry("year-payment-"+i,d,500,"sabadell","deudas");});
const yearMortgage={accounts:[],obAccounts:[{id:"a",ent:"sabadell",value:4000,cur:"EUR"}],expenses:[entry("year-cover","2025-10-01",0)].concat(yearPayments),
  debts:[{id:"year-loan",value:10000,monthly:500,amort:400,months:24,day:4,asOf:2025*12+9,asOfDate:"2025-10-01"}]};
const mortgageSeries=realSeries(yearMortgage,"2026-09-05").result;
assert.equal(mortgageSeries[0].value,0,"antes de doce cuotas quedan10000 en banco y10000 de deuda");
assert.equal(mortgageSeries.at(-1).value,-1200,"doce cuotas500 menos doce amortizaciones400 pierden1200 de intereses");
const withdrawal={accounts:[],obAccounts:[{id:"a",ent:"sabadell",value:1500,cur:"EUR"}],expenses:[entry("withdraw-cover","2026-09-01",0),
  {...entry("withdraw-own","2026-09-04",-500,"sabadell","inversion"),investmentId:"fund"}],investments:[{id:"fund",value:1500}],invHistory:[{d:"2026-09-01",v:2000},{d:"2026-09-07",v:1500}]};
assert.ok(realSeries(withdrawal,"2026-09-07").result.every(p=>p.value===3000),"recuperar500 de la inversión propia no inventa ganancia entre fotos");
const cached=c.netWorthSeries(base,opts);
assert.equal(c.netWorthSeries({...base,_savedAt:12345},opts),cached,"volver sin cambiar dinero conserva la serie completa por referencia");
assert.notEqual(c.netWorthSeries({...base,accountBalanceHistory:{}},opts),cached,"cambiar cierres invalida la caché, aunque no cambien los movimientos");
console.log("inicio-v42: NO-GO cifras causales, dos patas, anclas, principal/intereses, bienes y aportaciones OK");

for(const cycle of [false,true]){
  const lastDay=c.cycleTiming({periodStart:Date.parse("2026-08-31T22:00:00Z"),cycle},Date.parse("2026-09-30T12:00:00Z"));
  assert.equal(lastDay.left,1,"el último día sigue siendo un día, en mes natural y ciclo");
  assert.equal(c.cycleDailyMoney(100,lastDay.left),"100 €");
}
for(const [remaining,days] of [[0,1],[-1,1],[100,0],[100,-1],[NaN,1],[100,NaN]])assert.equal(c.cycleDailyMoney(remaining,days),null,"sin restante/plazo fiable no se inventa línea diaria");
assert.equal(c.cycleDailyMoney(200,3),"66 €");
vm.runInContext("DISP.k=0.9;DISP.sym='USD';",c);
assert.equal(c.cycleDailyMoney(1.01,1),"0 USD","el límite se trunca en la moneda visible y nunca permite gastar más que el restante");
vm.runInContext("DISP.k=1;DISP.sym='€';",c);
assert.equal(c.cyclePaceState(251,1000,12,30).id,"good","justo por encima de -15 puntos ya no es sobrado");

const largeHistory=Object.fromEntries(Array.from({length:8},(_,i)=>["acc:history-"+i,points.map((p,j)=>({day:p.day,value:50000.37+i*100+j}))]));
const cloudState={accounts:[],expenses:[],bankTx:[],accountBalanceHistory:largeHistory};
const projected=c.slimForCloud(cloudState);
const beforeCloud=Buffer.byteLength(JSON.stringify(cloudState)),afterCloud=Buffer.byteLength(JSON.stringify(projected));
assert.ok(afterCloud<beforeCloud*.2,"otro dispositivo recibe una ventana acotada, no115 KB por cada push");
assert.ok(Object.values(projected.accountBalanceHistory).every(a=>a.length<=14));
assert.equal(cloudState.accountBalanceHistory,largeHistory,"proyectar nube no recorta el local");
const union=c.mergeAccountBalanceHistory(largeHistory,{"acc:history-0":largeHistory["acc:history-0"].slice(-30)});
assert.equal(union,largeHistory,"un cliente antiguo que conserva30 no elimina los400 del nuevo ni crea otra referencia");
const storeMap=new Map(),reads=[];
c.localStorage={getItem:k=>{reads.push(k);return storeMap.get(k)??null;},setItem:(k,v)=>storeMap.set(k,v),removeItem:k=>storeMap.delete(k)};
c.mcSaveRaw("steady-history",{...cloudState,_historyOwner:"same-owner"});reads.length=0;
for(let i=0;i<5;i++)c.mcSaveRaw("steady-history",{...cloudState,_historyOwner:"same-owner",_savedAt:i+1},{expenses:false});
assert.equal(reads.filter(k=>k==="steady-history_balhist"||k==="steady-history").length,0,"un guardado estable no relee ni reinterpreta claves grandes");
c.mcSaveRaw("steady-history",{...cloudState,_historyOwner:"same-owner",accountBalanceHistory:{"acc:history-0":largeHistory["acc:history-0"].slice(-30)}},{expenses:false});
assert.equal(c.mcLoadRaw("steady-history").accountBalanceHistory["acc:history-0"].length,400);
c.mcSaveRaw("empty-history",{accounts:[],expenses:[]});reads.length=0;
for(let i=0;i<5;i++)c.mcSaveRaw("empty-history",{accounts:[],expenses:[],_savedAt:i+1},{expenses:false});
assert.equal(reads.filter(k=>k==="empty-history"||k==="empty-history_balhist").length,0,"sin historial tampoco se relee el principal en cada guardado");
c.mcSaveRaw("owner-history",{accounts:[],expenses:[],_historyOwner:"owner-a",accountBalanceHistory:{"acc:same-id":[{day:today,value:111}]}});
c.mcSaveRaw("owner-history",{accounts:[],expenses:[],_historyOwner:"owner-b",accountBalanceHistory:{"acc:same-id":[{day:"2026-09-03",value:222}]}});
assert.deepEqual(plain(c.mcLoadRaw("owner-history").accountBalanceHistory),{"acc:same-id":[{day:"2026-09-03",value:222}]},"ni siquiera con IDs iguales se mezcla historial entre dueños");
const legacyAssets=[{id:"old-car",value:15000}];
const oldAssetsHistory=c.recordAssetValues(undefined,today,legacyAssets,legacyAssets);
assert.equal(oldAssetsHistory["old-car"][0].born,undefined,"un bien ya cargado no recibe un alta antigua inventada");
const newAssetsHistory=c.recordAssetValues(undefined,today,legacyAssets,[]);
assert.equal(newAssetsHistory["old-car"][0].born,true,"un alta real en la app sí acredita que no existía antes");
assert.equal(c.recordAssetValues(newAssetsHistory,"2026-09-05",legacyAssets,legacyAssets),newAssetsHistory,"un precio sin cambio no fabrica otra escritura diaria");
assert.equal(c.recordAssetValues(newAssetsHistory,"2026-09-05",[],legacyAssets)["old-car"].at(-1).value,0,"borrar el bien conserva su escalón a cero");
console.log("inicio-v42: nube bytes "+beforeCloud+" -> "+afterCloud+", local400/cliente30 y lecturas estables0 OK");

// Cada mutante ejecuta un oráculo monetario/temporal, no una búsqueda de texto en fuente.
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const mutantCases=[
  ["céntimos","daily[day]=(daily[day]||0)-Math.round(e.amount*100)","daily[day]=(daily[day]||0)-Math.trunc(e.amount)*100",m=>assert.equal(m.netWorthSeries({...base,expenses:coverage.concat(entry("mut-cent","2026-09-02",1.37))},opts)[0].value,601.37)],
  ["borrados","expenseIsTombstoned(e,del)","false",m=>assert.equal(m.netWorthSeries({...base,expenses:coverage.concat(deleted),deleted:[m.keyOfExpense(deleted)]},opts)[0].value,600)],
  ["manual actual","day===today||!s.points.length?s.value","!s.points.length?s.value",m=>assert.equal(m.netWorthSeries({...manual,accounts:manual.accounts.map(a=>a.id==="cash"?{...a,value:101.37}:a)},{...opts,liquid:701.37}).at(-1).value,701.37)],
  ["sobrado","CYCLE_COMFORT_DIFF=-15","CYCLE_COMFORT_DIFF=-5",m=>assert.equal(m.cyclePaceState(251,1000,12,30).id,"good")],
  ["no finito","if(values.some(function(v){ return typeof v!==\"number\"||!Number.isFinite(v); }))","if(false)",m=>assert.equal(m.netWorthSeries({...base,accounts:[{...base.accounts[0],value:Infinity}]},opts).length,0)],
  ["primer manual","if(points.length) limits.push({day:points[0].day,kind:\"manual\"","if(false) limits.push({day:points[0].day,kind:\"manual\"",m=>assert.equal(m.netWorthSeries({...manual,accountBalanceHistory:{"acc:cash":[{day:"2026-09-03",value:100}]}},{...opts,liquid:700})[0].day,"2026-09-03")],
  ["foto futura","!Number.isFinite(v)||d>today","!Number.isFinite(v)||false",m=>{const s=m.netWorthSeries({...base,investments:[{value:100}],invHistory:[{d:"2026-09-05",v:100}]},{...opts,invested:100});assert.ok(s.coverage.every(g=>!g.unknown),"el valor actual conocido sigue visible aunque falte foto histórica");}],
];
for(const [name,from,to,check] of mutantCases){
  assert.equal(html.split(from).length,2,"mutante único real: "+name);
  const mutated=loadPureLogic(html.replace(from,to));
  assert.throws(()=>check(mutated),assert.AssertionError,"se mata el mutante: "+name);
}
console.log("inicio-v42: siete mutaciones NO-GO muertas con oráculos reales");
