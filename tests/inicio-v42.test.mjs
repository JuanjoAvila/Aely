import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";
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
assert.deepEqual(values({...base,expenses:coverage.concat({...entry("payment","2026-09-02",50,"sabadell","deudas"),debtId:"debt"})}),[600,600,600,600],"la cuota vinculada es neutra");
assert.deepEqual(values({...base,expenses:coverage.concat(entry("payment","2026-09-02",50,"sabadell","deudas"))}),[650,600,600,600],"una cuota sin vínculo no se presume neutra");
assert.deepEqual(values({...base,expenses:coverage.concat({...entry("pending","2026-09-02",999),status:"PDNG"},{...entry("dup","2026-09-02",999),possibleDup:true},entry("future","2026-09-05",999),{id:"broken",date:"fecha rota",amount:999})}),[600,600,600,600]);
assert.deepEqual(plain(c.netWorthSeries({...base,expenses:[coverage[0]]},opts)),[],"falta cobertura de un banco que suma");
assert.equal(c.netWorthSeries({...base,expenses:[coverage[0],entry("late","2026-09-03",0,"revolut")]},opts)[0].day,"2026-09-03","empieza con cobertura de TODOS los bancos");
const manual={...base,accounts:base.accounts.concat({id:"cash",ent:"efectivo",value:100,role:"fijos"}),accountBalanceHistory:{...base.accountBalanceHistory,"acc:cash":[{day:"2026-09-01",value:50},{day:"2026-09-03",value:100}]}};
assert.deepEqual(plain(c.netWorthSeries(manual,{...opts,liquid:700})).map(p=>p.value),[650,650,700,700],"manual sin movimientos cambia en escalón");
assert.deepEqual(plain(c.netWorthSeries({...manual,accountBalanceHistory:{}},{...opts,liquid:700})).map(p=>p.value),[700,700,700,700],"manual sin historial permanece constante");
const invested={...base,assets:[{value:200}],investments:[{value:100}],invHistory:[{d:"2026-09-02",v:50},{d:today,v:100}]};
assert.deepEqual(plain(c.netWorthSeries(invested,{...opts,invested:100,debtTotal:20})),[{day:"2026-09-02",value:830},{day:"2026-09-03",value:830},{day:today,value:880}],"inversiones desde su historial, bienes y deuda constantes");
assert.deepEqual(plain(c.netWorthSeries({...invested,invHistory:[]},{...opts,invested:100})),[],"sin historial no inventa inversiones");
const cent=c.netWorthSeries(invested,{...opts,liquid:600.23,invested:100.17,debtTotal:20.01}).at(-1);
assert.equal(cent.value,880.39,"último punto igual al patrimonio de hoy al céntimo");
assert.equal(c.netWorthSeries({...invested,assets:[]},{...opts,liquid:.004,invested:.004}).at(-1).value,.01,"se redondea el total completo como Inicio, también al convertir divisas");
assert.deepEqual(plain(c.netWorthSeries({...invested,investments:[{value:10,cur:"XYZ"}]},{...opts,invested:0})),[],"sin conversión fiable no inventa inversión cero");
assert.deepEqual(values({...base,history:[-900000]}),values(base),"state.history no afecta a la gráfica");

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
