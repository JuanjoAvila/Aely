import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";
const c=loadPureLogicFromFile(), plain=x=>JSON.parse(JSON.stringify(x));
const account=(id,ent)=>({id,ent,value:500,role:"fijos"});
const base={accounts:[account("a","sabadell"),account("b","revolut")],investments:[],assets:[{value:200}],expenses:[],
  accountBalanceHistory:{"acc:a":[{day:"2026-09-01",value:500},{day:"2026-09-03",value:300}],
    "acc:b":[{day:"2026-09-01",value:100},{day:"2026-09-03",value:300}]},history:[0,9999999]};
assert.deepEqual(plain(c.netWorthSeries(base)).map(p=>p.value),[800,800,800],"el traspaso propio conserva el total");
const partial={...base,accountBalanceHistory:{...base.accountBalanceHistory,"acc:a":[{day:"2026-09-01",value:500}]}};
assert.deepEqual(plain(c.netWorthSeries(partial)),[],"destino fresco y origen sin sincronizar no acreditan una foto conjunta");
assert.deepEqual(plain(c.netWorthSeries({...base,accounts:base.accounts.concat(account("missing","caixa"))})),[],"no se omite una cuenta desconocida");
assert.deepEqual(plain(c.netWorthSeries({...base,investments:[{value:100}]})),[],"inversión sin historial no se inventa");
assert.deepEqual(plain(c.netWorthSeries({...base,invHistory:[{d:"2026-09-01",v:50},{d:"2026-09-03",v:100}]})).map(p=>p.value),[850,850,900]);
assert.deepEqual(plain(c.netWorthSeries({...base,invHistory:[{d:"2026-09-02",v:50},{d:"2026-09-03",v:100}]})),[],
  "también las inversiones requieren fotos conjuntas para no mezclar fechas de observación");
assert.deepEqual(plain(c.netWorthSeries({...base,history:[-900000]})),plain(c.netWorthSeries(base)),"state.history no tiene influencia");
const invalidHistory={...base,accountBalanceHistory:{...base.accountBalanceHistory,"acc:a":base.accountBalanceHistory["acc:a"].concat([
  {day:"2026-09-31",value:999999},{day:"2026-99-10",value:999999},{day:"2026-02-29",value:999999}])}};
assert.deepEqual(plain(c.netWorthSeries(invalidHistory)),plain(c.netWorthSeries(base)),"fechas imposibles no acreditan saldos ni cobertura");
const reconstruct={accounts:[account("a","sabadell")],assets:[],investments:[],accountBalanceHistory:{"acc:a":[{day:"2026-09-04",value:550}]},expenses:[
  {id:"g",date:"2026-09-02T12:00:00Z",amount:100,ent:"sabadell",category:"super"},
  {id:"i",date:"2026-09-03T12:00:00Z",amount:-200,ent:"sabadell",category:"ingreso"},
  {id:"inv",date:"2026-09-04T12:00:00Z",amount:50,ent:"sabadell",category:"inversion"}]};
const coverage={"acc:a":{from:"2026-09-01",through:"2026-09-04",complete:true}};
assert.deepEqual(plain(c.netWorthSeries(reconstruct,{coverage})).map(p=>p.value),[500,400,600,550],"gasto baja, ingreso sube, inversión sale del efectivo y empalme es exacto");
assert.equal(c.netWorthSeries(reconstruct).length,1,"la primera fila no acredita completitud");
assert.equal(c.netWorthSeries(reconstruct,{coverage:{"acc:a":{...coverage["acc:a"],complete:false}}}).length,1);
const internal={accounts:[account("a","sabadell"),account("b","revolut")],assets:[],investments:[],
  accountBalanceHistory:{"acc:a":[{day:"2026-09-04",value:450}],"acc:b":[{day:"2026-09-04",value:150}]},expenses:[
    {id:"out",date:"2026-09-02T12:00:00Z",amount:50,ent:"sabadell",category:"traspaso"},
    {id:"in",date:"2026-09-02T12:00:00Z",amount:-50,ent:"revolut",category:"traspaso"}]};
const bothCoverage={...coverage,"acc:b":coverage["acc:a"]};
assert.deepEqual(plain(c.netWorthSeries(internal,{coverage:bothCoverage})).map(p=>p.value),[600,600,600,600],
  "reconstrucción causal: salida y entrada entre dos cuentas propias no mueven patrimonio");
assert.deepEqual(plain(c.netWorthSeries({...internal,expenses:internal.expenses.slice(0,1)},
  {coverage:{...bothCoverage,"acc:b":{...coverage["acc:a"],complete:false}}})),[{day:"2026-09-04",value:600}],
  "sin cobertura de la contrapartida no se inventan saldos anteriores");
const staggered={...base,assets:[],accountBalanceHistory:{
  "acc:a":[{day:"2026-09-01",value:500},{day:"2026-09-02",value:300}],
  "acc:b":[{day:"2026-09-01",value:100},{day:"2026-09-03",value:300}]},expenses:[
    {id:"out",date:"2026-09-02T12:00:00Z",amount:200,ent:"sabadell",category:"traspaso"},
    {id:"in",date:"2026-09-02T12:00:00Z",amount:-200,ent:"revolut",category:"traspaso"}]};
assert.deepEqual(plain(c.netWorthSeries(staggered,{coverage:bothCoverage})),[],
  "el traspaso con fotos escalonadas falla cerrado, no pinta la caída ficticia de 600 a 400");
const sameLast={...staggered,accountBalanceHistory:{...staggered.accountBalanceHistory,
  "acc:a":staggered.accountBalanceHistory["acc:a"].concat({day:"2026-09-03",value:300})}};
assert.deepEqual(plain(c.netWorthSeries(sameLast,{coverage:bothCoverage})),[],
  "un cierre final común no acredita el tramo intermedio de fotos escalonadas");
const invalid={...reconstruct,expenses:reconstruct.expenses.concat({id:"bad",date:"fecha rota",amount:999,category:"super",ent:"sabadell"})};
assert.deepEqual(plain(c.netWorthSeries(invalid,{coverage})),plain(c.netWorthSeries(reconstruct,{coverage})),"una fecha inválida no es hoy");
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
