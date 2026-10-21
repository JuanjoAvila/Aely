import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { codeMask } from "../scripts/beta-source-code.mjs";
import { loadPureLogicFromFile, loadPureLogic } from "../scripts/load-pure-logic.mjs";

const c=loadPureLogicFromFile(), cents=v=>Math.round(v*100);
const debts=[
  {id:"roomba",name:"Roomba sintética",value:600.03,monthly:50.01,months:12,day:16,asOf:2026*12+9,startMonth:2026*12+9},
  {id:"gym",name:"Gimnasio sintético",value:360.09,monthly:30.01,months:12,day:20,asOf:2026*12+10,startMonth:2026*12+10},
  {id:"floor",name:"Suelo sintético",value:1200.07,monthly:100.01,months:12,day:25,asOf:2026*12+11,startMonth:2026*12+11},
];
const fixture=ds=>({accounts:[{id:"cash",ent:"efectivo",value:5000.13,role:"fijos"}],expenses:[],investments:[],assets:[],debts:ds,
  accountBalanceHistory:{"acc:cash":[{day:"2026-09-30",value:5000.13}]}});

const atOctober=fn=>{
  const NativeDate=c.Date;
  c.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:["2026-10-28T12:00:00Z"]));}static now(){return NativeDate.parse("2026-10-28T12:00:00Z");}};
  try{return fn();}finally{c.Date=NativeDate;}
};
function callbackBody(source,token){
  const mask=codeMask(source),start=mask.indexOf(token);
  assert.ok(start>=0,"callback real presente: "+token);
  const open=mask.indexOf("{",start);let end=open+1,depth=1;
  while(depth&&end<mask.length){if(mask[end]==="{")depth++;if(mask[end]==="}")depth--;end++;}
  assert.equal(depth,0);return source.slice(open+1,end-1);
}
function manualDebt(form,source=html){
  let state={debts:[]};
  const fn=vm.runInContext("(function(form,set,showToast,setForm,setAdding){"+callbackBody(source,"const addDebt=()=>{")+"})",c);
  fn({name:"Alta sintética",value:"600,03",monthly:"50,01",months:"12",day:"16",account:"sabadell",down:"",balloon:"",paid:"",...form},update=>{state=update(state);},()=>{},()=>{},()=>{});
  assert.equal(state.debts.length,1);return state.debts[0];
}
function affordDebt(source=html){
  let state={debts:[]},done=false;
  const fn=vm.runInContext("(function(quota,amt,dw,nM,bank,dd,finName,set,setFinDone){"+callbackBody(source,"const createDebt=function(){")+"})",c);
  fn(50.01,700.03,100,12,"sabadell",16,"Compra sintética",update=>{state=update(state);},v=>{done=v;});
  assert.equal(done,true);assert.equal(state.debts.length,1);return state.debts[0];
}
test("revision1: alta09 guarda inicio después de convertir cuotas pagadas",()=>atOctober(()=>{
  for(const [paid,day,month] of [[0,16,9],[3,16,7],[3,28,7],[3,30,6]]){
    const d=manualDebt({paid:String(paid),day:String(day)});
    assert.equal(d.asOf,2026*12+month);assert.equal(d.startMonth,d.asOf);
    assert.equal(cents(d.value),60003);assert.equal(cents(d.monthly),5001);
    const before=`2026-${String(month).padStart(2,"0")}-15`,begin=`2026-${String(month+1).padStart(2,"0")}-01`;
    assert.equal(cents(c.netWorthDebtPolicy({debts:[d]},"2026-10-28").at(before)),0);
    assert.equal(cents(c.netWorthDebtPolicy({debts:[d]},"2026-10-28").at(begin)),60003);
  }
  assert.equal(Object.hasOwn(manualDebt({months:""}),"startMonth"),false,"sin plazo no inventa origen");
}));
test("revision1: alta08 AffordCard guarda inicio y conserva entrada y cuota",()=>atOctober(()=>{
  const d=affordDebt();
  assert.equal(d.asOf,2026*12+9);assert.equal(d.startMonth,d.asOf);
  assert.equal(cents(d.value),60003);assert.equal(cents(d.downPayment),10000);assert.equal(cents(d.monthly),5001);
  assert.equal(cents(c.netWorthDebtPolicy({debts:[d]},"2026-10-28").at("2026-09-30")),0);
  assert.equal(cents(c.netWorthDebtPolicy({debts:[d]},"2026-10-28").at("2026-10-01")),60003);
}));
test("revision1: mutaciones de altas mueren por importes históricos",()=>atOctober(()=>{
  for(const [line,writer] of [["if(months>0) it.startMonth=it.asOf;",manualDebt.bind(null,{})],["    it.startMonth=it.asOf;",affordDebt]]){
    assert.equal(html.split(line).length,2,"punto único fuera del oráculo");
    const mutantSource=html.replace(line,"");
    const correct=writer(html),mutant=writer(mutantSource);
    const before=d=>cents(c.netWorthDebtPolicy({debts:[d]},"2026-10-28").at("2026-09-30"));
    assert.equal(before(correct),0);assert.equal(before(mutant),60003);
  }
  const line="if(months>0) it.startMonth=it.asOf;";
  const moved=html.replace(line,"").replace("if(paid>0){ let anchor=ymNow()-paid;",line+"\n    if(paid>0){ let anchor=ymNow()-paid;");
  const correct=manualDebt({paid:"3"}),mutant=manualDebt({paid:"3"},moved);
  const august=d=>cents(c.netWorthDebtPolicy({debts:[d]},"2026-10-28").at("2026-08-01"));
  assert.equal(august(correct),60003);assert.equal(august(mutant),0,"guardar antes de convertir paid borra principal real");
}));
test("revision1: migración real no acredita nacimiento",()=>atOctober(()=>{
  const legacy={value:600.03,monthly:50.01,months:12,day:16};
  const migrated=c.seedFlows({...fixture([legacy]),_dynBalAnchored:true}).debts[0];
  assert.deepEqual(JSON.parse(JSON.stringify(migrated)),{...legacy,asOf:2026*12+9},"la migración no escribe procedencia ni fecha de alta");
  assert.equal(cents(c.netWorthDebtPolicy({debts:[migrated]},"2026-10-28").at("2026-08-15")),60003,"el ancla migrada conserva principal anterior");
}));
// La beta 4.26.138 cambió el editor global (useEditable) por la hoja de cada deuda: el caso se
// porta a `debtEditResult`, que es lo que guarda hoy (integración 4.26.139).
test("revision1: editor real con amort cero conserva el inicio sin acreditar nacimiento",()=>atOctober(()=>{
  const d={id:"zero",name:"Legado",value:600.03,monthly:50.01,months:12,amort:0,day:16,asOf:2026*12+7};
  const edit=(x,changes)=>{const r=c.debtEditResult(x,{...c.debtEditDraft(x),...changes});assert.equal(r.error,undefined,"se guarda");return JSON.parse(JSON.stringify(r.item));};
  for(const changes of [{name:"Legado corregido"},{apr:"1,5"},{day:"20"}]){
    const edited=edit(d,changes);
    assert.equal(Object.hasOwn(edited,"startMonth"),false,"editar legado no inventa inicio");
    assert.equal(cents(c.netWorthDebtPolicy({debts:[edited]},"2026-10-28").at("2026-08-15")),60003,"editar no borra la deuda anterior");
  }
  const explicit={...d,startMonth:2026*12+7};
  for(const changes of [{name:"Con inicio"},{day:"20"}]){
    const reanchored=edit(explicit,changes);
    assert.equal(reanchored.startMonth,2026*12+7,"el inicio explícito viaja con la edición");
    assert.equal(cents(c.netWorthDebtPolicy({debts:[reanchored]},"2026-10-28").at("2026-07-31")),0);
    assert.equal(cents(c.netWorthDebtPolicy({debts:[reanchored]},"2026-10-28").at("2026-08-15")),60003);
  }
  const migrated=c.seedFlows({...fixture([explicit]),_dynBalAnchored:true}).debts[0];
  assert.equal(migrated.startMonth,explicit.startMonth);
}));
test("revision1: inicio inválido no inventa origen y asOf no lo sustituye",()=>{
  for(const startMonth of [undefined,null,"24321",24321.5,NaN,Infinity]){
    const d={...debts[0],startMonth};
    assert.equal(cents(c.netWorthDebtPolicy({debts:[d]},"2026-10-28").at("2026-08-15")),60003);
  }
});
test("revision1: nube real proyecta, push/pull y merge conservan startMonth",async()=>{
  const plain=x=>JSON.parse(JSON.stringify(x));let row=null;const writes=[];
  const storage=new Map();c.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};c.window.localStorage=c.localStorage;
  const db={auth:{getSession:async()=>({data:{session:{user:{id:"synthetic"}}},error:null})},from(table){
    assert.equal(table,"app_state");
    const write=value=>{row=plain(value);writes.push(row);return {select:async()=>({data:[{updated_at:row.updated_at}],error:null})};};
    return {
      select(columns){assert.equal(columns,"data,updated_at");return {maybeSingle:async()=>({data:plain(row),error:null})};},
      insert(value){assert.equal(row,null,"INSERT no sustituye una fila existente");return write(value);},
      update(value){const eq=[];return {eq(key,v){eq.push([key,v]);return this;},select:async()=>{
        assert.deepEqual(eq,[["user_id","synthetic"],["updated_at",row.updated_at]]);
        row=plain(value);writes.push(row);return {data:[{updated_at:row.updated_at}],error:null};
      }};}
    };
  }};
  const a=html.indexOf('const cloud = (function(){'),b=html.indexOf('\n})();',a),start=html.indexOf('  return {',a);
  assert.ok(a>=0&&b>start&&start>a);
  const cloud=vm.runInContext('(function(sb){const statePushCache=new Map();'+html.slice(start,b)+'})',c)(db);
  const d=atOctober(()=>manualDebt({paid:"3"})),remote={...fixture([d]),_savedAt:20,_dynBalAnchored:true};
  await cloud.pushState("synthetic",c.slimForCloud(remote),null);
  let pack=await cloud.pullState();assert.equal(pack.data.debts[0].startMonth,2026*12+7);
  await cloud.pushState("synthetic",c.slimForCloud(pack.data),pack.updated_at);
  assert.equal(writes.length,1,'payload idéntico y mismo CAS no reenvían el estado');
  await cloud.pushState("synthetic",c.slimForCloud({...pack.data,budget:1234}),pack.updated_at);
  pack=await cloud.pullState();assert.equal(writes.length,2);
  assert.deepEqual(pack.data.debts,plain(remote.debts),"el transporte JSON conserva todos los campos de la deuda");
  const app=fs.readFileSync(new URL("../src/modules/11-app-main.js",import.meta.url),"utf8");
  const body=callbackBody(app.slice(app.indexOf("const syncFromCloud=function(")),"function(prev){");
  const factory=vm.runInContext("(function(sessionRef,cloudState,cloudPack,u,opts,freshLogin,mergeExpenses,fixMovInvasion,fixRevoDupes,fixInvAuto,fixInvSold,reconcileTR,seedFlows,reconcileEarlyIncomeAnchors){const obAbsorbedWriteBlocked={current:false},read={owner:u,ready:false},cloudReadRef={current:read};return function(prev){"+body+"};})",c);
  const identity=x=>x;
  const merge=(local,freshLogin=false)=>factory({current:{user:{id:"synthetic"}}},pack.data,pack,"synthetic",{},freshLogin,(a,b)=>({list:a}),identity,identity,identity,identity,identity,c.seedFlows,identity)(local);
  const withBase={...fixture([d]),_savedAt:30};Object.assign(withBase,c.planSyncPull(withBase,pack.data,"synthetic",pack.updated_at,false));withBase.debts=[{...d,name:"Cambio local"}];
  for(const local of [{...fixture([]),_savedAt:10},{...fixture([{...d,name:"Cambio local"}]),_savedAt:30},withBase]){
    const merged=merge(local);
    assert.equal(merged.debts[0].startMonth,2026*12+7);
    assert.equal(merged.debts[0].name,local._planSync?"Cambio local":d.name);
    if(!local._planSync&&local.debts.length)assert.equal(merged._planSync.conflicts[0].local.name,"Cambio local","sin base el cambio queda recuperable, sin LWW por reloj");
    assert.equal(cents(c.netWorthDebtPolicy(merged,"2026-10-28").at("2026-07-31")),0);
    assert.equal(cents(c.netWorthDebtPolicy(merged,"2026-10-28").at("2026-08-01")),60003);
  }
  assert.equal(merge({...fixture([]),_savedAt:30},true).debts[0].startMonth,2026*12+7,"login nuevo recupera fecha de nube");
});
test("revision1: suelo sin ancla 600,03; mutante 700,05 cae por cifra",()=>{
  const d={value:600.03,monthly:50.01,months:12,day:16};
  const amount=m=>cents(m.netWorthDebtPolicy({debts:[d]},"2026-10-28").at("2026-08-15"));
  assert.equal(amount(c),60003);
  const from='if(d.months!=null||!rebuilt(d)) n=Math.max(0,n);',to='if(d.months==null) n=Math.max(0,n);';
  assert.equal(html.split(from).length,2,"punto de mutación único, fuera del oráculo");
  const mutant=loadPureLogic(html.replace(from,to));
  assert.equal(amount(mutant),70005,"el mutante se ejecuta y obtiene la cifra errónea conocida");
  assert.notEqual(amount(mutant),60003,"muerte por cifra, no por carga ni texto ausente");
});

for(const [i,d] of debts.entries()) test(d.name+": antes, inicio, cuota y después",()=>{
  const m=10+i,begin=`2026-${m}-01`,before=i?`2026-${m-1}-${m===11?31:30}`:"2026-09-30";
  const policy=c.netWorthDebtPolicy({debts:[d]},`2026-${m}-28`);
  assert.equal(cents(policy.at(before)),0,"antes del mes de inicio aún no existe");
  assert.equal(cents(policy.at(begin)),cents(d.value),"desde el inicio, antes de la cuota, debe el principal");
  assert.equal(cents(policy.at(`2026-${m}-${d.day-1}`)),cents(d.value));
  assert.equal(cents(policy.at(`2026-${m}-${d.day}`)),cents(d.value-d.monthly));
  assert.equal(cents(policy.at(`2026-${m}-${d.day+1}`)),cents(d.value-d.monthly));
  assert.equal(cents(policy.current),cents(d.value-d.monthly));
});

test("serie completa: altas sucesivas sin cambiar céntimos actuales ni estado",()=>{
  const state=fixture(debts),saved=JSON.stringify(state);
  // A 26/12: tres cuotas Roomba, dos gimnasio y una suelo.
  const current=1850.13,series=c.netWorthSeries(state,{today:"2026-12-26",liquid:5000.13,invested:0,debtTotal:current});
  const at=day=>cents(series.find(p=>p.day===day).value);
  assert.equal(at("2026-09-30"),500013);
  assert.equal(at("2026-10-01"),440010);
  assert.equal(at("2026-10-16"),445011);
  assert.equal(at("2026-11-01"),409002);
  assert.equal(at("2026-12-01"),296997);
  assert.equal(at("2026-12-26"),315000);
  assert.equal(cents(c.netWorthDebtPolicy(state,"2026-12-26").current),185013);
  assert.equal(JSON.stringify(state),saved,"mirar la gráfica no cambia deuda ni anclas");
});

test("medianoche Madrid al entrar al mes, invierno y verano",()=>{
  for(const [before,on,month] of [["2026-09-30T21:59:59.999Z","2026-09-30T22:00:00.000Z",9],["2026-11-30T22:59:59.999Z","2026-11-30T23:00:00.000Z",11]]){
    const d={...debts[0],asOf:2026*12+month,startMonth:2026*12+month};
    assert.equal(cents(c.netWorthDebtPolicy({debts:[d]},c.netWorthDay(Date.parse(before))).current),0);
    assert.equal(cents(c.netWorthDebtPolicy({debts:[d]},c.netWorthDay(Date.parse(on))).current),60003);
  }
});

test("hipoteca y referencia de alta no se convierten en nacimiento",()=>{
  const d={id:"mortgage",value:5000.07,monthly:100.01,day:1,asOf:2026*12+9,asOfDate:"2026-10-01"};
  assert.equal(cents(c.netWorthDebtPolicy({debts:[d]},"2026-10-16").at("2026-09-30")),510008);
  assert.equal(cents(c.netWorthDebtPolicy({debts:[{...d,months:12,asOf:undefined}]},"2026-10-16").at("2026-09-30")),500007,"sin ancla no se inventa fecha");
  assert.equal(cents(c.netWorthDebtPolicy({debts:[{...debts[0],asOfDate:"2026-10-20"}]},"2026-10-28").at("2026-10-01")),60003,"asOfDate es referencia, no fecha de compra");
});

test("saldo actual suministrado conserva contrato de Inicio",()=>{
  const p=c.netWorthDebtPolicy({debts},"2026-12-26",1900.17);
  assert.equal(cents(p.current),190017);
  assert.equal(cents(p.at("2026-12-26")),190017);
});

test("pago final y financiación archivada conservan su historia desde el inicio",()=>{
  const d={...debts[0],months:2,balloon:500.01,amort:50.01,archivedAt:"2026-12-01T12:00:00Z"};
  const p=c.netWorthDebtPolicy({debts:[d]},"2026-12-26");
  assert.equal(cents(p.at("2026-09-30")),0);
  assert.equal(cents(p.at("2026-10-01")),60003);
  assert.equal(cents(p.at("2026-11-15")),55002);
  assert.equal(cents(p.at("2026-11-16")),0);
});

const guard='if(d.months!=null&&Number.isInteger(d.startMonth)&&p[0]*12+p[1]-1<d.startMonth) return 0;';
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8").replace(/\r\n/g,"\n");
const money=(m,d,day,today="2026-10-28")=>cents(m.netWorthDebtPolicy({debts:[d]},today).at(day));
const mutations=[
  ["sin guarda",guard,"",m=>assert.equal(money(m,debts[0],"2026-09-30"),0)],
  ["excluye mes inicial",guard,guard.replace("<d.startMonth","<=d.startMonth"),m=>assert.equal(money(m,debts[0],"2026-10-01"),60003)],
  ["mes desplazado",guard,guard.replace("p[1]-1","p[1]"),m=>assert.equal(money(m,debts[0],"2026-09-30"),0)],
  ["aplica a hipoteca",guard,guard.replace("d.months!=null&&",""),m=>assert.equal(money(m,{...debts[0],months:undefined},"2026-09-30"),65004)],
  ["confunde asOf con inicio",guard,guard.replaceAll("d.startMonth","d.asOf"),m=>assert.equal(money(m,{...debts[0],startMonth:undefined},"2026-09-30"),60003)],
  ["cuota confundida con inicio",guard,guard+'\n    if(d.months!=null&&p[0]*12+p[1]-1===anchor&&p[2]<charge) return 0;',m=>assert.equal(money(m,debts[0],"2026-10-01"),60003)],
  ["referencia confundida con nacimiento",guard,guard+'\n    if(day<(d.asOfDate||"")) return 0;',m=>assert.equal(money(m,{...debts[0],asOfDate:"2026-10-20"},"2026-10-01"),60003)],
  ["hoy deja de ser saldo suministrado","const value=current!=null?current:sum(today);","const value=sum(today);",m=>assert.equal(cents(m.netWorthDebtPolicy({debts},"2026-12-26",1900.17).current),190017)],
  ["medianoche UTC","timeZone:\"Europe/Madrid\",year:\"numeric\",month:\"2-digit\",day:\"2-digit\"","timeZone:\"UTC\",year:\"numeric\",month:\"2-digit\",day:\"2-digit\"",m=>assert.equal(m.netWorthDay(Date.parse("2026-09-30T22:00:00Z")),"2026-10-01")],
];
for(const [name,from,to,check] of mutations) test("mutación semántica: "+name,()=>{
  assert.ok(html.includes(from),"existe el punto de mutación");
  check(c);
  const mutant=loadPureLogic(html.replaceAll(from,to));
  assert.throws(()=>check(mutant),assert.AssertionError,"el oráculo mata el mutante");
});
