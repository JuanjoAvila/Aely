import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { codeMask } from "../scripts/beta-source-code.mjs";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const htmlArg=process.argv.indexOf("--html");
const html=fs.readFileSync(htmlArg<0?new URL("../public/index.html",import.meta.url):process.argv[htmlArg+1],"utf8").replace(/\r\n/g,"\n");
const cents=v=>Math.round(v*100),NativeDate=Date,originalTZ=process.env.TZ;
let checks=0;
function body(source,token){
  const mask=codeMask(source),start=mask.indexOf(token),open=mask.indexOf("{",start);
  assert.ok(start>=0&&open>start,"callback de producto presente");
  let end=open+1,depth=1;
  while(depth&&end<mask.length){if(mask[end]==="{")depth++;if(mask[end]==="}")depth--;end++;}
  assert.equal(depth,0);return source.slice(open+1,end-1);
}
function context(iso,tz,source=html){
  process.env.TZ=tz;
  const c=loadPureLogic(source);
  c.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[iso]));}static now(){return NativeDate.parse(iso);}};
  return c;
}
function manual(c,changes={},source=html){
  let state={debts:[]};
  const add=vm.runInContext("(function(form,set,showToast,setForm,setAdding){"+body(source,"const addDebt=()=>{")+"})",c);
  add({name:"FIN36 sintética",value:"1000",monthly:"100",months:"10",day:"5",paid:"0",account:"sabadell",down:"",balloon:"",...changes},update=>{state=update(state);},()=>{},()=>{},()=>{});
  assert.equal(state.debts.length,1);return state.debts[0];
}
function purchase(c,day=5,source=html){
  let state={debts:[]};
  const add=vm.runInContext("(function(quota,amt,dw,nM,bank,dd,finName,set,setFinDone){"+body(source,"const createDebt=function(){")+"})",c);
  add(100,1000,0,10,"sabadell",day,"Compra FIN36",update=>{state=update(state);},()=>{});
  assert.equal(state.debts.length,1);return state.debts[0];
}
function equal(actual,expected,label){assert.equal(actual,expected,label);checks++;}
const cases=[
  {iso:"2026-09-30T22:30:00Z",today:"2026-10-01",before:"2026-09-30",month:2026*12+9},
  {iso:"2026-11-30T23:30:00Z",today:"2026-12-01",before:"2026-11-30",month:2026*12+11},
  {iso:"2026-12-31T23:30:00Z",today:"2027-01-01",before:"2026-12-31",month:2027*12},
];
// El oráculo es el calendario pactado: al día 1 sólo se cobra la cuota con cargo día 1.
// Primero Madrid acredita el control; UTC debe conservar los mismos céntimos al mismo instante.
try{
  for(const sample of cases)for(const tz of ["Europe/Madrid","UTC","America/Los_Angeles","Asia/Tokyo"]){
    const c=context(sample.iso,tz);
    for(const origin of ["manual","compra"])for(const day of [5,1]){
      const d=origin==="manual"?manual(c,{day:String(day)}):purchase(c,day),expected=day===1?90000:100000;
      const label=sample.today+" "+tz+" "+origin+" cargo"+day;
      equal(cents(c.debtBalance(d)),expected,label+": saldo sin cuota fantasma");
      equal(c.debtPaidCount(d),day===1?1:0,label+": pagos de calendario");
      const p=c.netWorthDebtPolicy({debts:[d]},sample.today);
      equal(cents(p.current),expected,label+": motor de Inicio sin current suministrado");
      equal(d.asOf,sample.month,label+": ancla mensual Madrid");
      equal(d.startMonth,sample.month,label+": mes de origen Madrid");
      equal(d.startDay,sample.today,label+": día de nacimiento Madrid");
      equal(cents(p.at(sample.before)),0,label+": deuda ausente antes del nacimiento");
      const state={accounts:[{id:"cash",ent:"efectivo",value:5000,role:"fijos"}],expenses:[],investments:[],assets:[],debts:[d],accountBalanceHistory:{"acc:cash":[{day:sample.before,value:5000}]}};
      const series=c.netWorthSeries(state,{today:sample.today,liquid:5000,invested:0,debtTotal:p.current});
      equal(cents(series.find(x=>x.day===sample.before).value),500000,label+": serie anterior");
      equal(cents(series.at(-1).value),500000-expected,label+": serie actual");
    }
    for(const day of [5,1]){
      const d=manual(c,{day:String(day),paid:"3"});
      equal(c.debtPaidCount(d),3,tz+": cuotas previas no se duplican");
      equal(cents(c.debtBalance(d)),70000,tz+": saldo con tres cuotas previas");
      equal(d.asOf,sample.month-(day===1?2:3),tz+": ancla ajustada a cuotas previas");
      equal(Object.hasOwn(d,"startDay"),false,"cuotas previas no acreditan nacimiento diario");
    }
    const open=manual(c,{months:""});
    equal(cents(c.debtBalance(open)),100000,tz+": sin plazo no cobra cuota del mismo mes");
    equal(Object.hasOwn(open,"startDay"),false,"sin plazo no inventa nacimiento");
    const old={id:"legacy",name:"Legado",value:1000,monthly:100,months:10,day:5};
    const seeded=c.seedFlows({accounts:[],debts:[old],_dynBalAnchored:true});
    equal(seeded.debts[0].asOf,sample.month,tz+": migración usa mes Madrid");
    equal(cents(c.debtBalance(seeded.debts[0])),100000,tz+": migración sin cuota fantasma");
    equal(cents(c.netWorthDebtPolicy(seeded,sample.today).current),100000,tz+": migración e Inicio comparten saldo");
    equal(Object.hasOwn(seeded.debts[0],"startDay"),false,"migración no inventa fecha");
    equal(Object.hasOwn(seeded.debts[0],"startMonth"),false,"migración no inventa mes de origen");
    const existing={...old,asOf:sample.month-2,unknown:{keep:7}};
    const migrated=c.seedFlows({accounts:[],debts:[existing],_dynBalAnchored:true}).debts[0];
    equal(migrated.asOf,sample.month-2,"migración no reancla fechas existentes");
    const born=manual(c),edited=c.debtEditResult(born,{...c.debtEditDraft(born),balance:"900"});
    equal(edited.error,undefined,"edición de saldo aceptada");
    equal(cents(c.debtBalance(edited.item)),90000,"saldo editado exacto");
    equal(edited.item.startDay,sample.today,"editar conserva nacimiento acreditado");
    const oldOpen={id:"open",name:"Préstamo",value:1000,monthly:100,day:5,asOf:sample.month-2};
    equal(cents(c.debtBalance(oldOpen)),80000,"saldo previo sin plazo");
    const reanchored=c.debtEditResult(oldOpen,{...c.debtEditDraft(oldOpen),balance:"900"});
    equal(reanchored.error,undefined,"edición sin plazo aceptada");
    equal(reanchored.item.asOf,sample.month,"edición sin plazo reancla al mes Madrid");
    equal(cents(reanchored.item.value),90000,"saldo ancla editado sin plazo");
    equal(cents(c.debtBalance(reanchored.item)),90000,"saldo editado sin plazo");
    equal(Object.hasOwn(reanchored.item,"startDay"),false,"edición sin plazo no inventa día de origen");
    equal(Object.hasOwn(reanchored.item,"startMonth"),false,"edición sin plazo no inventa mes de origen");
    const balloon=manual(c,{balloon:"400",day:"1"});
    equal(cents(c.debtBalance(balloon)),94000,"pago final conserva amortización lineal");
    equal(cents(c.debtBalance({...balloon,asOf:sample.month-9})),0,"último mes liquida el pago final");
    console.log("PASS "+sample.today+" "+tz);
  }
  // Antes, en y después del cargo, con el ancla ya existente: el día también es Madrid.
  for(const [iso,expected]of [["2026-10-03T22:30:00Z",100000],["2026-10-04T22:30:00Z",90000],["2026-10-05T22:30:00Z",90000]])for(const tz of ["Europe/Madrid","UTC","America/Los_Angeles"]){
    const c=context(iso,tz),d={value:1000,monthly:100,amort:100,months:10,day:5,asOf:2026*12+9};
    equal(cents(c.debtBalance(d)),expected,iso+" "+tz+": frontera del cargo");
  }
  // Volver al mes local del dispositivo reproduce dinero incorrecto sin cambiar el oráculo.
  const local='const ymNow=()=>{ const n=new Date(); return ymAbs(n.getFullYear(), n.getMonth()); };';
  const calendar=html.match(/const ymNow=\(\)=>\{[^\n]+\};/);
  assert.ok(calendar,"auxiliar de mes presente");
  assert.notEqual(calendar[0],local,"el mutante mensual cambia la fuente");
  const monthSource=html.replace(calendar[0],local),monthContext=context(cases[0].iso,"UTC",monthSource),monthDebt=manual(monthContext,{},monthSource);
  assert.notEqual(cents(monthContext.netWorthDebtPolicy({debts:[monthDebt]},cases[0].today).current),100000,"mutante mensual muere por saldo de Inicio sin current suministrado");checks++;
  const charge=html.match(/function debtPaidCount\(d\)\{[^\n]+\}/);
  assert.ok(charge,"cálculo real de pagos presente");
  assert.equal(charge[0].split("madridYmdParts(Date.now()).d").length,2,"punto diario único");
  const daySource=html.replace(charge[0],charge[0].replace("madridYmdParts(Date.now()).d","new Date().getDate()")),dayContext=context(cases[0].iso,"UTC",daySource),dayDebt=manual(dayContext,{},daySource);
  assert.notEqual(cents(dayContext.debtBalance(dayDebt)),100000,"mutante diario muere por saldo de deuda");checks++;
  console.log("FIN36 PASS "+checks+" comprobaciones al céntimo");
}finally{if(originalTZ===undefined)delete process.env.TZ;else process.env.TZ=originalTZ;}
