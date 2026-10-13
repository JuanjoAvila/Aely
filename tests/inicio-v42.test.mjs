import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile,loadPureLogic } from "../scripts/load-pure-logic.mjs";
import { codeMask } from "../scripts/beta-source-code.mjs";
import { estadoHeredado } from "../e2e/fixtures.mjs";
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
// Antes el banco con el histórico más corto recortaba la serie entera («cobertura de TODOS los
// bancos»): con gastos desde junio la gráfica empezaba en septiembre (13/10). Ahora arranca en el
// primer movimiento y el banco tardío se declara en la «i» con su fecha.
const lateBank=c.netWorthSeries({...base,expenses:[coverage[0],entry("late","2026-09-03",0,"revolut")]},opts);
assert.equal(lateBank[0].day,"2026-09-01","empieza en el primer movimiento de cualquier banco");
assert.deepEqual(plain(lateBank.coverage.filter(g=>g.later)),[{later:true,day:"2026-09-03",kind:"bank",name:"Revolut"}],"el banco que empieza después se declara, no recorta");
const manual={...base,accounts:base.accounts.concat({id:"cash",ent:"efectivo",value:100,role:"fijos"}),accountBalanceHistory:{...base.accountBalanceHistory,"acc:cash":[{day:"2026-09-01",value:50},{day:"2026-09-03",value:100}]}};
assert.deepEqual(plain(c.netWorthSeries(manual,{...opts,liquid:700})).map(p=>p.value),[650,650,700,700],"manual sin movimientos cambia en escalón");
assert.deepEqual(plain(c.netWorthSeries({...manual,accountBalanceHistory:{}},{...opts,liquid:700})).map(p=>p.value),[700,700,700,700],"manual sin historial permanece constante");
const invested={...base,assets:[{id:"known",value:200,history:[{day:"2026-09-01",value:200,born:true}]}],debts:[{id:"loan",value:20,asOf:2026*12+7}],investments:[{value:100}],invHistory:[{d:"2026-09-02",v:50},{d:today,v:100}]};
// La primera foto de inversión ya no recorta: antes de ella se mantiene su valor (13/10).
assert.deepEqual(plain(c.netWorthSeries(invested,{...opts,invested:100,debtTotal:20})),[{day:"2026-09-01",value:830},{day:"2026-09-02",value:830},{day:"2026-09-03",value:830},{day:today,value:880}],"inversiones desde su historial y, antes, la primera foto; bienes y deuda constantes");
assert.deepEqual(plain(c.netWorthSeries(invested,{...opts,invested:100,debtTotal:20}).coverage.filter(g=>g.kind==="investment")),[{day:"2026-09-02",kind:"investment",constant:true}],"y se declara desde qué foto hay valor propio");
const noPhoto=c.netWorthSeries({...invested,invHistory:[]},{...opts,invested:100,debtTotal:20});
assert.deepEqual(plain(noPhoto).map(p=>p.value),[880,880,880,880],"sin ninguna foto se mantiene el valor de hoy, como un bien heredado");
assert.deepEqual(plain(noPhoto.coverage.filter(g=>g.kind==="investment")),[{day:today,kind:"investment",constant:true}]);
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
assert.deepEqual(plain(c.netWorthRanges(series)).map(r=>r.id),["1m","3m","6m","1y","all"]);
assert.deepEqual(plain(c.netWorthRanges(series,"2026-10-10")).map(r=>r.id),["all"],"una foto atrasada no compara meses respecto de hoy");
assert.deepEqual(plain(c.netWorthRanges(series,series.at(-1).day)).map(r=>r.id),["1m","3m","6m","1y","all"]);
// Con cuatro meses de histórico (el caso del 13/10) salen 1M y 3M, no sólo «Todo».
assert.deepEqual(plain(c.netWorthRanges(series.slice(-120))).map(r=>r.id),["1m","3m","all"]);
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
const bankToManual={accounts:[account("a","sabadell"),{id:"cash",ent:"revolut",value:600,role:"fijos"}],
  expenses:[entry("manual-cover","2026-09-01",0),entry("manual-out","2026-09-02",300,"sabadell","traspaso"),entry("manual-in","2026-09-02",-300,"revolut","traspaso")],
  accountBalanceHistory:{"acc:cash":[{day:"2026-09-01",value:300},{day:"2026-09-02",value:600}]}};
assert.deepEqual(plain(realSeries(bankToManual,today).result).map(p=>p.value),[900,900,900,900],"banco a manual con escalones: la pata de flujo compensa el cambio del cierre");
const sameBankPair={...base,expenses:coverage.concat(entry("same-out","2026-09-02",300,"sabadell","traspaso"),entry("same-in","2026-09-03",-300,"sabadell","traspaso"))};
assert.deepEqual(values(sameBankPair),[600,300,600,600],"dos cargos de la misma cuenta no son dos patas entre cuentas propias");
// Antes recortaba al primer cierre: un sobre de efectivo con cierres de hace dos semanas dejaba
// sin gráfica meses de bancos (13/10). Se mantiene el primer saldo, como sin historial.
const partial=c.netWorthSeries({...manual,accountBalanceHistory:{"acc:cash":[{day:"2026-09-03",value:100}]}},{...opts,liquid:700});
assert.deepEqual(plain(partial).map(p=>[p.day,p.value]),[["2026-09-01",700],["2026-09-02",700],["2026-09-03",700],[today,700]],"antes del primer cierre manual se mantiene ese primer saldo");
assert.deepEqual(plain(partial.coverage),[{day:"2026-09-03",kind:"manual",name:"efectivo",constant:true,prior:true}],"y se declara en la nota");
assert.deepEqual(plain(c.netWorthSeries({...manual,accountBalanceHistory:{"acc:cash":[{day:"2026-09-02",value:40},{day:"2026-09-03",value:100}]}},{...opts,liquid:700})).map(p=>p.value),[640,640,700,700],"el primer cierre vale hacia atrás y los escalones siguen en su día");
assert.equal(c.netWorthSeries({...base,accounts:[{...base.accounts[0],value:Infinity}]},opts).length,0,"saldo no finito nunca acredita un tramo");
const cashToday={...base,accounts:base.accounts.concat({id:"cash-today",ent:"efectivo",value:100,role:"fijos"}),expenses:coverage.concat(entry("cash-use",today,10,"efectivo"))};
assert.equal(c.netWorthSeries(cashToday,{...opts,liquid:690})[0].day,"2026-09-01","el primer gasto del sobre no elimina la cobertura bancaria anterior");
const loan={accounts:[{id:"a",ent:"sabadell",value:1000,role:"diario"}],expenses:[entry("cover","2026-09-01",0),entry("loan-income",today,-10000,"sabadell","ingreso")],
  debts:[{id:"loan",value:10000,asOf:2026*12+8,monthly:500,amort:400}]};
// El ancla mensual no distingue un préstamo nuevo de una hipoteca dada de alta antes de esta
// versión: recortar «por si acaso» dejó a un usuario real sin gráfica (13/10). Sin fecha
// explícita la deuda se reconstruye hacia atrás; sólo asOfDate acredita desde cuándo existe.
const loanResult=realSeries(loan,today).result;
assert.equal(loanResult.length,4,"una deuda sin fecha explícita no recorta la serie");
assert.equal(loanResult.at(-1).value,1000);
assert.ok(loanResult.coverage.some(g=>g.kind==="debt"&&g.estimated&&g.name==null),"se declara que el tramo anterior se estima con su cuadro");
// Con fecha explícita tampoco recorta: antes de ese día la deuda es cero y el dinero del
// préstamo aún no estaba en la cuenta, así que pedirlo no mueve el patrimonio.
assert.deepEqual(plain(realSeries({...loan,debts:[{...loan.debts[0],asOfDate:today}]},today).result).map(p=>p.value),[1000,1000,1000,1000],"con fecha explícita de hoy no hay deuda antes del préstamo y la serie sigue entera");
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
const legacyGood=realSeries({...bought,assets:[{id:"car",name:"Coche",value:15000}]},today).result;
assert.deepEqual(plain(legacyGood).map(p=>p.value),[31000,31000,31000,16000],"el valor ya mostrado del bien antiguo se mantiene constante hacia atrás");
assert.ok(legacyGood.coverage.some(g=>g.kind==="asset"&&g.constant&&!g.day&&g.name==="Coche"),"se declara que el valor actual se mantiene en todo el tramo");
const cloudHome={accounts:[],obAccounts:[{id:"a",ent:"sabadell",value:5000,cur:"EUR"}],
  expenses:[entry("home-cover","2026-08-01",0),entry("home-use","2026-08-20",100)],assets:[{id:"home",name:"Piso",value:200000}]};
assert.equal(realSeries(cloudHome,today).result[0].value,205100,"un piso legado recibido en el pull no nace hoy");
assert.equal(realSeries(cloudHome,today).result.at(-1).value,205000);
const steppedGood={...cloudHome,assetValueHistory:{home:[{day:"2026-08-15",value:190000},{day:"2026-09-02",value:200000}]}};
// El primer escalón real ya no recorta: antes de él se mantiene ese primer valor (13/10).
assert.equal(realSeries(steppedGood,today).result[0].day,"2026-08-01","un bien con escalones propios no recorta la serie");
assert.equal(realSeries(steppedGood,today).result[0].value,195100);
assert.equal(realSeries(steppedGood,today).result.find(p=>p.day==="2026-08-14").value,195100,"antes del primer escalón vale el primer escalón");
assert.equal(realSeries(steppedGood,today).result.find(p=>p.day==="2026-09-02").value,205000,"y los escalones siguen en su día");
assert.deepEqual(plain(realSeries(steppedGood,today).result.coverage.filter(g=>g.kind==="asset")),[{day:"2026-08-15",kind:"asset",name:"Piso",constant:true,prior:true}]);
for(const category of ["inversion","traspaso"]){
  const investmentState={accounts:[{id:"a",ent:"sabadell",value:3000,role:"diario"}],expenses:[entry("cover","2026-09-01",0),
    {...entry("contribute",today,500,"sabadell",category),merchant:"Aportación Trade Republic"}],investments:[{id:"fund",ent:"trade_republic",value:500}],
    invHistory:[{d:"2026-09-01",v:0},{d:"2026-09-07",v:500}]};
  assert.deepEqual(plain(realSeries(investmentState,"2026-09-07").result).map(p=>p.value),[3000,3000,3000,3000,3000,3000,3000],"una aportación propia entre fotos no crea un valle de500");
}
const futurePhoto=c.netWorthSeries({...base,investments:[{value:100}],invHistory:[{d:"2026-09-05",v:100}]},{...opts,invested:100});
assert.deepEqual(plain(futurePhoto).map(p=>p.value),[700,700,700,700],"una foto futura no vale: se mantiene el valor de hoy y se declara");
assert.deepEqual(plain(futurePhoto.coverage.filter(g=>g.kind==="investment")),[{day:today,kind:"investment",constant:true}]);
const yearPayments=Array.from({length:12},(_,i)=>{const d=new Date(Date.UTC(2025,9+i,4,12)).toISOString().slice(0,10);return entry("year-payment-"+i,d,500,"sabadell","deudas");});
const yearMortgage={accounts:[],obAccounts:[{id:"a",ent:"sabadell",value:4000,cur:"EUR"}],expenses:[entry("year-cover","2025-10-01",0)].concat(yearPayments),
  debts:[{id:"year-loan",value:10000,monthly:500,amort:400,months:24,day:4,asOf:2025*12+9,asOfDate:"2025-10-01"}]};
const mortgageSeries=realSeries(yearMortgage,"2026-09-05").result;
assert.equal(mortgageSeries[0].value,0,"antes de doce cuotas quedan10000 en banco y10000 de deuda");
assert.equal(mortgageSeries.at(-1).value,-1200,"doce cuotas500 menos doce amortizaciones400 pierden1200 de intereses");
const noTermMortgage={...yearMortgage,debts:yearMortgage.debts.map(d=>({...d,months:null}))};
const noTermSeries=realSeries(noTermMortgage,"2026-09-05").result,atNoTerm=day=>noTermSeries.find(p=>p.day===day).value;
// Sin plazo, el saldo de hoy de la app (5.600) sólo cuenta once amortizaciones aunque el banco
// pagó doce cuotas; hacia atrás cada día de cargo deshace una, también el del mes ancla, así que
// el 1/10 la deuda era 10.400 (antes el suelo del mes ancla la dejaba en 10.000, 13/10).
assert.equal(noTermSeries[0].value,-400);
assert.equal(atNoTerm("2025-10-04")-atNoTerm("2025-10-03"),-100,"la cuota del mes ancla también se deshace en su día");
assert.equal(noTermSeries.at(-1).value,-1600,"se conserva el saldo actual de la fórmula vigente de préstamos sin plazo");
for(let i=1;i<12;i++){
  const month=new Date(Date.UTC(2025,9+i,1,12)).toISOString().slice(0,7);
  const previous=new Date(Date.UTC(2025,9+i,0,12)).toISOString().slice(0,10);
  assert.equal(atNoTerm(month+"-01"),atNoTerm(previous),"sin plazo: no se amortiza antes del día de cuota conocido");
  assert.equal(atNoTerm(month+"-04")-atNoTerm(month+"-03"),-100,"cuota500 y amort400 ocurren el mismo día, sin sierra mensual");
}
const unknownDay=realSeries({...noTermMortgage,debts:noTermMortgage.debts.map(({day,...d})=>d)},"2026-09-05").result;
assert.ok(unknownDay.coverage.some(g=>g.kind==="debt"&&g.timingUnknown),"sin día de cargo se conserva y declara la convención anterior");
assert.equal(unknownDay.find(p=>p.day==="2025-11-01").value-unknownDay.find(p=>p.day==="2025-10-31").value,400);
const brokerUnlinked={...base,investments:[{id:"fund",ent:"trade_republic",value:500}],invHistory:[{d:"2026-09-01",v:0},{d:today,v:500}],
  expenses:coverage.concat(entry("unlinked-broker","2026-09-02",500,"sabadell","traspaso"))};
// Un traspaso de una sola pata sin pista de bróker ya no recorta hasta la foto siguiente (en la
// cartera real del 13/10 dejaba la gráfica en dos semanas): sale como lo que dice la cuenta y la
// foto siguiente lo recoge. Con fotos diarias el valle dura un día.
assert.deepEqual(plain(c.netWorthSeries(brokerUnlinked,{...opts,invested:500})).map(p=>[p.day,p.value]),[["2026-09-01",1100],["2026-09-02",600],["2026-09-03",600],[today,1100]],"sin pista de destino la serie no se recorta");
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
assert.equal(oldAssetsHistory,undefined,"montar un bien legado no fabrica un escalón ni un alta");
assert.equal(c.recordAssetValues(undefined,today,legacyAssets,[]),undefined,"pull tras reinstalar: el diff vacío no prueba un alta");
const newAssetsHistory=c.recordAssetValues(undefined,today,legacyAssets,[],"old-car");
assert.equal(newAssetsHistory["old-car"][0].born,true,"un alta real en la app sí acredita que no existía antes");
assert.equal(c.recordAssetValues(newAssetsHistory,"2026-09-05",legacyAssets,legacyAssets),newAssetsHistory,"un precio sin cambio no fabrica otra escritura diaria");
assert.equal(c.recordAssetValues(newAssetsHistory,"2026-09-05",[],legacyAssets)["old-car"].at(-1).value,0,"borrar el bien conserva su escalón a cero");
console.log("inicio-v42: nube bytes "+beforeCloud+" -> "+afterCloud+", local400/cliente30 y lecturas estables0 OK");

// Se ejecutan los callbacks de producción: un diff de listas o un mock del merge
// no reproduce ni el alta del formulario ni la carrera al aplicar un pull tardío.
function callback(source,token,from=0){
  const mask=codeMask(source),start=mask.indexOf(token,from),open=mask.indexOf("{",start);
  assert.ok(start>=0&&open>=0,"callback real: "+token);
  let depth=1,end=open+1;
  for(;depth&&end<mask.length;end++){if(mask[end]==="{")depth++;else if(mask[end]==="}")depth--;}
  assert.equal(depth,0);return source.slice(start,end);
}
const goodsSource=fs.readFileSync(new URL("../src/modules/07-tab-patri-fijos.js",import.meta.url),"utf8");
const goodsSave=callback(goodsSource,"function(s){",goodsSource.indexOf("const save=function(){",goodsSource.indexOf("function AssetSheet(")));
const saveGood=vm.runInContext("(function(asset,next){return "+goodsSave+";})",c);
const actualGoods=saveGood({},legacyAssets[0])({assets:[]});
assert.equal(actualGoods.assetValueHistory["old-car"][0].born,true,"el formulario registra el alta, no el efecto de montaje");
const pullHistory=c.recordAssetValues(undefined,today,cloudHome.assets,[]);
assert.equal(pullHistory,undefined);
const editHistory=c.recordAssetValues(undefined,"2026-09-05",[{id:"old-car",value:14000}],legacyAssets);
assert.deepEqual(plain(editHistory["old-car"]),[{day:"2026-09-04",value:15000,legacy:true},{day:"2026-09-05",value:14000}],"una edición real registra valor propio y el anterior, sin inventar el alta");
const appSource=fs.readFileSync(new URL("../src/modules/11-app-main.js",import.meta.url),"utf8");
const cloudApply=callback(appSource,"function(prev){",appSource.indexOf("const syncFromCloud=function("));
const identity=x=>x,sessionRef={current:null};
const applyCloud=vm.runInContext("(function(sessionRef,cloudState,u,opts,mergeExpenses,fixMovInvasion,fixRevoDupes,fixInvAuto,fixInvSold,reconcileTR,seedFlows,reconcileEarlyIncomeAnchors){const freshLogin=false;return "+cloudApply+";})",c);
const localHistory={...cloudState,_historyOwner:"same-owner",assetValueHistory:{home:points}};
const incomingHistory={...cloudState,accountBalanceHistory:{"acc:history-0":largeHistory["acc:history-0"].slice(-14)},assetValueHistory:{home:points.slice(-14)}};
const cloudCallback=applyCloud(sessionRef,incomingHistory,"same-owner",{},(a,b)=>({list:a}),identity,identity,identity,identity,identity,identity,identity);
assert.equal(cloudCallback(localHistory),localHistory,"sesión nula al ejecutar el callback conserva el estado entero y los400 cierres");
sessionRef.current={user:{id:"other-owner"}};
assert.equal(cloudCallback(localHistory),localHistory,"un pull tardío tampoco sustituye el historial de otro dueño");
sessionRef.current={user:{id:"same-owner"}};
const sameOwner=cloudCallback(localHistory);
assert.equal(sameOwner.accountBalanceHistory,largeHistory,"la ventana nube14 se une sin sustituir el local400");
assert.equal(sameOwner.assetValueHistory,localHistory.assetValueHistory);
console.log("inicio-v42: ronda3 alta explícita, legado constante, escalones propios y carrera de sesión OK");

// Revalorar un bien heredado reiniciaba la gráfica en el día del cambio (revisión 13/10):
// banco 5.000 plano, coche de 15.000 que el día 5 pasa a 12.000 en el formulario real.
const carDay="2026-09-07",carOpts={today:carDay,liquid:5000,invested:0,debtTotal:0};
const carAsset={id:"old-car",name:"Coche sintético",kind:"coche",value:15000};
const carState={accounts:[{...account("a","sabadell"),value:5000}],investments:[],debts:[],expenses:[entry("car-cover","2026-09-01",0)],assets:[carAsset]};
const carValues=(m,s)=>plain(m.netWorthSeries(s,carOpts)).map(p=>p.value);
const carEdit=(m,s,day,value)=>{
  const assets=value==null?[]:s.assets.map(a=>({...a,value}));
  return {...s,assets,assetValueHistory:m.recordAssetValues(s.assetValueHistory,day,assets,s.assets)};
};
assert.deepEqual(carValues(c,carState),Array(7).fill(20000),"antes de tocarlo, el coche heredado se mantiene constante");
const realDay=c.netWorthDay;c.netWorthDay=()=>"2026-09-05";
const carSaved=saveGood(carAsset,{...carAsset,value:12000})(carState);c.netWorthDay=realDay;
assert.deepEqual(plain(carSaved.assetValueHistory["old-car"]),[{day:"2026-09-04",value:15000,legacy:true},{day:"2026-09-05",value:12000}],"Guardar anota el valor anterior la víspera y el nuevo en su día");
const carSeries=c.netWorthSeries(carSaved,carOpts);
assert.deepEqual(plain(carSeries),["01","02","03","04"].map(d=>({day:"2026-09-"+d,value:20000})).concat(["05","06","07"].map(d=>({day:"2026-09-"+d,value:17000}))),"20.000 hasta el día 4 y 17.000 desde el 5");
assert.equal(carSeries.at(-1).value-carSeries[0].value,-3000,"la comparación dice 3.000 menos, que es verdad");
assert.deepEqual(plain(carSeries.coverage),[{day:"2026-09-05",kind:"asset",name:"Coche sintético",constant:true,prior:true}],"la nota declara desde qué día hay valor propio y que antes se mantiene el que tenía");
const carTwice=carEdit(c,carSaved,"2026-09-06",10000);
assert.equal(carTwice.assetValueHistory["old-car"].filter(p=>p.legacy).length,1,"revalorar dos veces no repite el valor anterior");
assert.deepEqual(carValues(c,carTwice),[20000,20000,20000,20000,17000,15000,15000],"dos revaloraciones son dos escalones en sus días");
const carSameDay=carEdit(c,carSaved,"2026-09-05",11000);
assert.deepEqual(plain(carSameDay.assetValueHistory["old-car"]),[{day:"2026-09-04",value:15000,legacy:true},{day:"2026-09-05",value:11000}],"corregir el mismo día conserva el valor anterior");
const carGone=carEdit(c,carSaved,"2026-09-06",null);
assert.deepEqual(carValues(c,carGone),[20000,20000,20000,20000,17000,5000,5000],"revalorar y borrar: el bien deja de contar desde el día del borrado");
assert.deepEqual(carValues(c,carEdit(c,carState,"2026-09-06",null)),[20000,20000,20000,20000,20000,5000,5000],"borrar un bien heredado tampoco reinicia la gráfica");
const carStepped={...carState,assetValueHistory:{"old-car":[{day:"2026-08-15",value:15000}]}};
assert.ok(!carEdit(c,carStepped,"2026-09-05",12000).assetValueHistory["old-car"].some(p=>p.legacy),"un bien que ya tiene escalones no recibe otro valor anterior");
assert.deepEqual(plain(saveGood({},{id:"new-car",value:9000})({assets:[]}).assetValueHistory["new-car"].map(p=>[p.value,p.born,p.legacy])),[[9000,true,null]],"el alta del formulario sigue sin existir antes de su fecha");
// La copia de nube y la unión entre dispositivos: ni se pierde ni se duplica.
const carCloud=c.slimForCloud(carTwice).assetValueHistory;
assert.deepEqual(plain(carCloud),plain(carTwice.assetValueHistory),"la ventana de nube lleva el valor anterior mientras quepa");
assert.deepEqual(carValues(c,{...carTwice,assetValueHistory:c.mergeAccountBalanceHistory(undefined,carCloud)}),carValues(c,carTwice),"un móvil nuevo pinta la misma serie");
assert.equal(c.mergeAccountBalanceHistory(carTwice.assetValueHistory,carCloud),carTwice.assetValueHistory,"volver a recibirlo no duplica nada");
const carOther=carEdit(c,carState,"2026-09-07",10000).assetValueHistory;
const carUnion=c.mergeAccountBalanceHistory(carSaved.assetValueHistory,carOther);
assert.deepEqual(plain(carUnion["old-car"]).map(p=>p.day+(p.legacy?"L":"")),["2026-09-04L","2026-09-05","2026-09-06L","2026-09-07"]);
assert.deepEqual(carValues(c,{...carState,assets:[{...carAsset,value:10000}],assetValueHistory:carUnion}),[20000,20000,20000,20000,17000,17000,15000],"dos móviles que revaloran el mismo bien no pintan una subida a 20.000 el día 6");
let carLong=carState;for(let i=0;i<15;i++)carLong=carEdit(c,carLong,"2026-08-"+String(10+i).padStart(2,"0"),13000+i);
const carWindow=c.slimForCloud(carLong).assetValueHistory["old-car"];
assert.ok(carWindow.length===14&&!carWindow.some(p=>p.legacy),"fuera de la ventana no viaja un valor anterior que ya no describe esos días");
console.log("inicio-v42: bien heredado revalorado conserva su valor anterior (20.000 -> 17.000, -3.000), nube y unión OK");

// Incidente 13/10 (beta 4.26.121): con una cartera real —hipoteca y préstamo dados de alta antes,
// sin fecha explícita— la serie se recortaba a hoy y en Inicio salía «Faltan saldos fiables» con
// un muro de seis líneas. El estado lo comparte el e2e. Contraste independiente del saldo hacia
// atrás: saldo de hoy + la cuota por cada día de cargo entre esa fecha y hoy, contados uno a uno.
const inherited=estadoHeredado("2026-10-13"),inheritedToday="2026-10-13";
const inheritedRun=realSeries(inherited,inheritedToday),inheritedSeries=inheritedRun.result;
// Feedback 13/10: «tengo historial desde junio… ¿por qué solo me sale "Todo"?». La primera foto
// de inversión (30/9) ya no recorta: la gráfica arranca en el primer movimiento (15/6).
assert.equal(inheritedSeries.length,121,"la gráfica arranca en el primer movimiento (15/6), no en la primera foto de inversión");
assert.equal(inheritedSeries[0].day,"2026-06-15");
assert.equal(inheritedSeries.at(-1).day,inheritedToday);
assert.deepEqual(plain(c.netWorthRanges(inheritedSeries,inheritedToday)).map(r=>r.id),["1m","3m","all"],"con cuatro meses salen 1M y 3M");
assert.equal(inheritedSeries.find(p=>p.day==="2026-09-29").value,inheritedSeries.find(p=>p.day==="2026-09-30").value,"la víspera de la primera foto vale esa foto (el 30/9 no tiene flujos): sin escalón inventado");
assert.equal(inheritedSeries.at(-1).value,Math.round((inheritedRun.liquid+inheritedRun.invested+195000-inheritedRun.debtTotal)*100)/100,"último punto = patrimonio de la app");
assert.equal(Math.round(inheritedRun.debtTotal*100)/100,188277.18,"hipoteca 176.714,80 + préstamo 11.212 + financiación 350,38 + archivada 0");
assert.ok(!inheritedSeries.coverage.some(g=>g.kind==="debt"&&g.day),"ninguna deuda sin fecha explícita recorta");
assert.ok(inheritedSeries.coverage.every(g=>!g.unknown));
const limitsShown=inheritedSeries.coverage.filter(g=>g.day&&!g.constant);
assert.deepEqual(plain(limitsShown),[{later:true,day:"2026-07-05",kind:"bank",name:"Cuenta sintética"},{later:true,day:"2026-07-10",kind:"bank",name:"Revolut sintética"}],"ya no hay límites: los bancos que empiezan después se declaran con su fecha");
assert.deepEqual(plain(inheritedSeries.coverage.filter(g=>g.kind==="investment")),[{day:"2026-09-30",kind:"investment",constant:true}],"la inversión se mantiene antes de su primera foto y se declara");
assert.deepEqual(plain(inheritedSeries.coverage.filter(g=>g.kind==="debt")).map(g=>[g.name,g.estimated]),
  [["Hipoteca sintética",true],["Préstamo coche sintético",true],["Financiación sintética",true],["Financiación archivada sintética",true]]);
const chargesBetween=(day,charge)=>{let n=0;for(let ms=Date.parse(day+"T12:00:00Z")+864e5;ms<=Date.parse(inheritedToday+"T12:00:00Z");ms+=864e5)if(new Date(ms).getUTCDate()===charge)n++;return n;};
const debtAt=(d,day)=>c.netWorthDebtPolicy({debts:[d]},inheritedToday,undefined).at(day);
for(const [id,charge,balToday] of [["hipo",1,176714.8],["car-loan",3,11212]]){
  const d=inherited.debts.find(x=>x.id===id);
  assert.equal(debtAt(d,inheritedToday),balToday);
  for(const day of ["2026-09-30","2026-09-02","2026-08-31",charge===1?"2026-09-01":"2026-09-03"])
    assert.equal(Math.round(debtAt(d,day)*100)/100,Math.round((balToday+d.monthly*chargesBetween(day,charge))*100)/100,id+" al céntimo el "+day);
}
assert.equal(Math.round(debtAt(inherited.debts[0],"2026-09-30")*100)/100,177375.65);
assert.equal(Math.round(debtAt(inherited.debts[0],"2026-08-31")*100)/100,178036.5);
assert.equal(debtAt(inherited.debts[1],"2026-09-02"),11606);
const gym=inherited.debts.find(d=>d.id==="gym");
assert.equal(Math.round(debtAt(gym,inheritedToday)*100)/100,350.38);
assert.equal(Math.round(debtAt(gym,"2026-09-28")*100)/100,525.57,"con plazo: la cuota del 29/9 se deshace hacia atrás");
assert.equal(debtAt({...gym,original:undefined},"2026-05-15"),875.95,"con plazo no se debe más que el saldo ancla antes del inicio, aunque no conste lo pedido");
const archived=inherited.debts.find(d=>d.id==="old");
assert.equal(debtAt(archived,inheritedToday),0);assert.equal(debtAt(archived,"2026-09-26"),149.75,"la archivada existía el mes pasado");
const hipoDay=inheritedSeries.find(p=>p.day==="2026-10-01").value-inheritedSeries.find(p=>p.day==="2026-09-30").value;
assert.equal(Math.round(hipoDay*100)/100,Math.round((-12.5-20-660.85+660.85+2400+15)*100)/100,"el día de la cuota la gráfica no baja la amortización: nómina, compras y foto de inversión");
const capped={debts:[{id:"capped",value:900,original:1000,monthly:100,day:1,asOf:2026*12+9}]};
assert.equal(c.netWorthDebtPolicy(capped,inheritedToday,undefined).at("2026-07-15"),1000,"hacia atrás nunca se debe más que lo pedido");
assert.equal(c.netWorthDebtPolicy({debts:[{id:"no-quota",value:5000,day:1,asOf:2026*12+9}]},inheritedToday,undefined).at("2026-07-15"),5000,"sin cuota se mantiene el saldo de hoy");
const settled={debts:[{id:"settled",value:100,monthly:100,day:1,asOf:2026*12+8,settledAt:"2026-10-02T10:00:00Z"}]};
assert.equal(c.netWorthDebtPolicy(settled,inheritedToday,undefined).at("2026-07-15"),100,"una deuda ya liquidada no se reconstruye por cuotas más allá de su ancla");
for(const empty of [{...inherited,accountBalanceHistory:{}},{...inherited,assets:[]},{...inherited,debts:[]}])
  assert.ok(realSeries(empty,inheritedToday).result.length>=14,"quitar cualquier pieza heredada tampoco deja sin gráfica");
const nothing=realSeries({accounts:[],obAccounts:[],investments:[],assets:[],debts:[],expenses:[]},inheritedToday).result;
assert.equal(nothing.length,1);assert.equal(nothing.fresh,true,"sin ningún dato: un punto y «Tu histórico empieza hoy»");
console.log("inicio-v42: cartera heredada (13/10) pinta 121 días desde el 15/6 con 1M/3M, deudas al céntimo hacia atrás OK");

// Feedback 13/10: «963 € menos desde que empezaste» a quien ahorra e invierte. Comparaba el
// primer punto (el día del cobro) con hoy, a mitad de ciclo. La comparación es de igual a igual:
// hoy frente al mismo día del ciclo anterior (misma distancia desde el cobro). Barrido de los 30
// días del ciclo: quien cobra 2.400, gasta 30 €/día, aporta 300 al bróker y paga la hipoteca
// nunca sale en rojo; quien gasta 110 €/día sale en rojo todos los días.
const cycleState=function(spendPerDay,options){
  options=options||{};const invest=options.invest==null?300:options.invest,expenses=[],invHistory=[];let acc=0;
  for(let ms=Date.parse("2026-05-28T12:00:00Z");ms<=Date.parse("2026-10-27T12:00:00Z");ms+=864e5){
    const day=new Date(ms).toISOString().slice(0,10),d=Number(day.slice(8));
    if(d===28)expenses.push({id:"pay-"+day,date:day+"T09:00:00Z",amount:-2400,merchant:"Nómina sintética",category:"ingreso",ent:"sabadell"});
    if(d===1)expenses.push({id:"hipo-"+day,date:day+"T09:00:00Z",amount:660.85,category:"deudas",ent:"sabadell",debtId:"hipo"});
    if(d===5&&invest){expenses.push({id:"inv-"+day,date:day+"T09:00:00Z",amount:invest,category:"inversion",ent:"sabadell"});acc+=invest;}
    expenses.push({id:"spend-"+day,date:day+"T12:00:00Z",amount:spendPerDay,category:"super",ent:"sabadell"});
    invHistory.push({d:day,v:acc});
  }
  return {settings:{budgetCycle:options.cycle!==false,autoPrices:false},budget:1500,
    accounts:[{id:"a",ent:"sabadell",value:3000,role:"diario",spendFrom:true,bankIban:"SYN-CYCLE"}],
    investments:invest?[{id:"fund",ent:"trade_republic",value:acc}]:[],invHistory,
    debts:[{id:"hipo",name:"Hipoteca sintética",value:150000,original:180000,monthly:660.85,amort:450,day:1,asOf:2026*12+9}],expenses};
};
const onDay=function(state,day,rangeId){
  const run=realSeries(state,day),time=Date.parse(day+"T12:00:00Z"),Original=c.Date;
  c.Date=class extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}};
  try{
    const bud=c.dashboardBudgetStats(state),anchors=c.netWorthCycleAnchors(state,bud);
    return {series:run.result,anchors,compare:c.netWorthCompare(run.result,anchors,rangeId||"1m",day,run.invested),bud};
  }finally{c.Date=Original;}
};
const saver=cycleState(30),spender=cycleState(110);
let saverSeries=null,saverAnchors=null;
for(let ms=Date.parse("2026-09-28T12:00:00Z");ms<=Date.parse("2026-10-27T12:00:00Z");ms+=864e5){
  const day=new Date(ms).toISOString().slice(0,10),good=onDay(saver,day),bad=onDay(spender,day);
  assert.equal(good.bud.cycle,true,"el lector acredita la nómina del 28");
  assert.ok(good.compare&&["up","flat"].includes(good.compare.verdict),day+": quien ahorra e invierte nunca sale en rojo ("+JSON.stringify(good.compare)+")");
  assert.ok(bad.compare&&bad.compare.verdict==="down",day+": quien se come los ahorros sale en rojo ("+JSON.stringify(bad.compare)+")");
  assert.equal(good.compare.cycles,1);
  if(day==="2026-10-13"){saverSeries=good.series;saverAnchors=good.anchors;
    assert.deepEqual(plain(good.anchors).slice(0,3),["2026-09-28","2026-08-28","2026-07-28"],"las anclas son los cobros reales, de hoy hacia atrás");
    assert.equal(good.compare.day,"2026-09-12","mismo día del ciclo anterior: 15 días después del cobro del 28/8");
    // Un ciclo de nómina a nómina (del 12/9 al 13/10, 31 días): +2.400 − 31 días de 30 € − 660,85 de cuota
    // + 450 de amortización. Las aportaciones al bróker no restan: salen de la cuenta y entran en la foto.
    assert.equal(good.compare.delta,Math.round((2400-30*31-660.85+450)*100)/100,"la aportación al bróker y el capital amortizado no son pérdidas");
    assert.equal(bad.compare.delta,Math.round((2400-110*31-660.85+450)*100)/100);
    assert.equal(onDay(saver,day,"3m").compare.day,"2026-07-13","3M compara con el mismo punto tres ciclos atrás (cobro del 28/6 + 15 días)");
    assert.equal(onDay(saver,day,"6m").compare,null,"sin seis ciclos no se compara ni se inventa");
    assert.equal(onDay(saver,day,"all").compare.cycles,4,"«Todo» compara con el ciclo equivalente más antiguo con dato");
  }
}
const monthly=onDay(cycleState(30,{cycle:false}),"2026-10-13");
assert.deepEqual(plain(monthly.anchors).slice(0,2),["2026-10-01","2026-09-01"],"con mes natural el ancla es el día 1");
assert.equal(monthly.compare.day,"2026-09-13","mismo día del mes anterior");
const fresh=onDay({...saver,expenses:saver.expenses.filter(e=>e.date>="2026-09-20")},"2026-10-13");
assert.equal(fresh.compare,null,"sin ciclo anterior con dato no hay veredicto");
assert.equal(c.netWorthCompare(saverSeries,saverAnchors.slice(0,1),"1m","2026-10-13",0),null,"una sola ancla no compara");
assert.equal(c.netWorthCompare(saverSeries,["2026-09-30","2026-09-20","2026-08-20"],"1m","2026-10-13",0).day,"2026-09-29","si el ciclo anterior fue más corto se toma su víspera de cobro");
const flatSeries=saverSeries.map(p=>({day:p.day,value:1000}));flatSeries[flatSeries.length-1]={day:flatSeries.at(-1).day,value:1005};
assert.equal(c.netWorthCompare(flatSeries,saverAnchors,"1m","2026-10-13",0).verdict,"flat","cinco euros no dan veredicto: ni verde ni rojo");
assert.equal(c.netWorthCompare(flatSeries,saverAnchors,"1m","2026-10-13",5000).margin,100,"el margen es el 2 % de lo invertido, con suelo de 10 €");
assert.equal(c.netWorthCompare(flatSeries.map((p,i)=>i===flatSeries.length-1?{...p,value:1011}:p),saverAnchors,"1m","2026-10-13",0).verdict,"up");
console.log("inicio-v42: comparación de igual a igual por ciclo (ahorra → nunca rojo; se funde → rojo) OK");

// Cada mutante ejecuta un oráculo monetario/temporal, no una búsqueda de texto en fuente.
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8").replace(/\r\n/g,"\n");
const mutantCases=[
  ["céntimos","daily[day]=(daily[day]||0)-Math.round(e.amount*100)","daily[day]=(daily[day]||0)-Math.trunc(e.amount)*100",m=>assert.equal(m.netWorthSeries({...base,expenses:coverage.concat(entry("mut-cent","2026-09-02",1.37))},opts)[0].value,601.37)],
  ["borrados","expenseIsTombstoned(e,del)","false",m=>assert.equal(m.netWorthSeries({...base,expenses:coverage.concat(deleted),deleted:[m.keyOfExpense(deleted)]},opts)[0].value,600)],
  ["manual actual","day===today||!s.points.length?s.value","!s.points.length?s.value",m=>assert.equal(m.netWorthSeries({...manual,accounts:manual.accounts.map(a=>a.id==="cash"?{...a,value:101.37}:a)},{...opts,liquid:701.37}).at(-1).value,701.37)],
  ["sobrado","CYCLE_COMFORT_DIFF=-15","CYCLE_COMFORT_DIFF=-5",m=>assert.equal(m.cyclePaceState(251,1000,12,30).id,"good")],
  ["no finito","if(values.some(function(v){ return typeof v!==\"number\"||!Number.isFinite(v); }))","if(false)",m=>assert.equal(m.netWorthSeries({...base,accounts:[{...base.accounts[0],value:Infinity}]},opts).length,0)],
  ["primer manual hacia atrás","before:points.length?points[0].value:0","before:0",m=>assert.equal(m.netWorthSeries({...manual,accountBalanceHistory:{"acc:cash":[{day:"2026-09-03",value:100}]}},{...opts,liquid:700})[0].value,700)],
  ["deuda con fecha explícita vale cero antes","&&day<(d.asOfDate||d.startDate)) return 0;","&&false) return 0;",m=>assert.equal(m.netWorthDebtPolicy({debts:[{id:"dated",value:5000,monthly:100,day:1,asOf:2026*12+9,asOfDate:"2026-09-01"}]},inheritedToday,undefined).at("2026-08-15"),0)],
  ["inversión antes de la primera foto","const photo=invIndex>=0?investments[invIndex]:invKnown;","const photo=invIndex>=0?investments[invIndex]:null;",m=>assert.equal(m.netWorthSeries(invested,{...opts,invested:100,debtTotal:20})[0].value,830)],
  ["bien con escalones no recorta","const stepped=!legacy&&points.length>0&&!points[0].born;","const stepped=false;",m=>assert.equal(m.netWorthSeries(steppedGood,{today,liquid:5000,invested:0,debtTotal:0})[0].value,195100)],
  ["cuotas entre esa fecha y hoy","const between=(month+(charge<=parts[2]?1:0))-((p[0]*12+p[1]-1)+(charge<=p[2]?1:0));","const between=0;",m=>assert.equal(Math.round(m.netWorthDebtPolicy({debts:[inherited.debts[0]]},inheritedToday,undefined).at("2026-09-30")*100)/100,177375.65)],
  ["sin plazo reconstruye","if(d.months!=null||!rebuilt(d)) n=Math.max(0,n);","if(true) n=Math.max(0,n);",m=>assert.equal(Math.round(m.netWorthDebtPolicy({debts:[inherited.debts[0]]},inheritedToday,undefined).at("2026-09-30")*100)/100,177375.65)],
  ["con plazo no inventa principal","if(d.months!=null||!rebuilt(d)) n=Math.max(0,n);","if(false) n=Math.max(0,n);",m=>assert.equal(m.netWorthDebtPolicy({debts:[{...gym,original:undefined}]},inheritedToday,undefined).at("2026-05-15"),875.95)],
  ["día de cargo hacia atrás","(charge<=p[2]?1:0));\n    let n=paidToday-between;","1);\n    let n=paidToday-between;",m=>assert.equal(Math.round(m.netWorthDebtPolicy({debts:[inherited.debts[1]]},inheritedToday,undefined).at("2026-09-02")*100)/100,11606)],
  ["tope de lo pedido","if(n<0&&d.original>0) value=Math.min(value,Math.max(Number(d.original),Number(d.value)));","if(false) value=Math.min(value,Math.max(Number(d.original),Number(d.value)));",m=>assert.equal(m.netWorthDebtPolicy(capped,inheritedToday,undefined).at("2026-07-15"),1000)],
  ["liquidada no se reconstruye","&&!d.settledAt; };","; };",m=>assert.equal(m.netWorthDebtPolicy(settled,inheritedToday,undefined).at("2026-07-15"),100)],
  ["foto futura","!Number.isFinite(v)||d>today","!Number.isFinite(v)||false",m=>assert.equal(m.netWorthSeries({...base,investments:[{value:100}],invHistory:[{d:"2026-09-05",v:100}]},{...opts,invested:100}).coverage.find(g=>g.kind==="investment").day,today,"una foto futura no acredita valor propio")],
  ["misma cuenta empareja","a.bank===b.bank||a.cents!==-b.cents","false||a.cents!==-b.cents",m=>assert.deepEqual(plain(m.netWorthSeries(sameBankPair,opts)).map(p=>p.value),[600,300,600,600])],
  ["valor anterior anotado","value:prior.value,legacy:true","value:value,legacy:true",m=>assert.equal(carValues(m,carEdit(m,carState,"2026-09-05",12000))[0],20000)],
  ["valor anterior la víspera","Date.parse(day+\"T12:00:00Z\")-864e5).toISOString()","Date.parse(day+\"T12:00:00Z\")).toISOString()",m=>assert.deepEqual(carValues(m,carEdit(m,carState,"2026-09-05",12000)),[20000,20000,20000,20000,17000,17000,17000])],
  ["sólo heredado sin escalones","if(!last&&!born&&prior&&Number.isFinite(prior.value))","if(!born&&prior&&Number.isFinite(prior.value))",m=>assert.ok(!carEdit(m,carStepped,"2026-09-05",12000).assetValueHistory["old-car"].some(p=>p.legacy))],
  ["marca intermedia","filter(function(p,i){return !i||!p.legacy;})","filter(function(p,i){return true;})",m=>assert.equal(carValues(m,{...carState,assets:[{...carAsset,value:10000}],assetValueHistory:carUnion})[5],17000)],
  ["anterior hacia atrás","before:legacy||stepped?points[0].value:0","before:0",m=>assert.equal(carValues(m,carSaved)[0],20000)],
  ["lectura del anterior","s.points[indices[i]].value:s.before||0","s.points[indices[i]].value:0",m=>assert.equal(carValues(m,carSaved)[0],20000)],
  ["comparar con el mismo punto del ciclo","const cap=civil(anchors[n-1])-864e5, ms=Math.min(civil(anchors[n])+elapsed*864e5,cap);","const cap=civil(anchors[n-1])-864e5, ms=Math.min(civil(anchors[n]),cap);",m=>assert.equal(m.netWorthCompare(saverSeries,saverAnchors,"1m","2026-10-13",0).day,"2026-09-13")],
  ["margen sin veredicto","const margin=Math.max(10,Math.abs(invested||0)*.02);","const margin=0;",m=>assert.equal(m.netWorthCompare(flatSeries,saverAnchors,"1m","2026-10-13",0).verdict,"flat")],
  ["ciclo anterior más corto: su víspera","ms=Math.min(civil(anchors[n])+elapsed*864e5,cap);","ms=civil(anchors[n])+elapsed*864e5;",m=>assert.equal(m.netWorthCompare(saverSeries,["2026-09-30","2026-09-20","2026-08-20"],"1m","2026-10-13",0).day,"2026-09-29")],
];
for(const [name,from,to,check] of mutantCases){
  assert.equal(html.split(from).length,2,"mutante único real: "+name);
  const mutated=loadPureLogic(html.replace(from,to));
  assert.throws(()=>check(mutated),assert.AssertionError,"se mata el mutante: "+name);
}
console.log("inicio-v42: "+mutantCases.length+" mutaciones NO-GO muertas con oráculos reales");
