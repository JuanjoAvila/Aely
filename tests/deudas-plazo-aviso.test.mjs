import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createLogicSandbox,extractPureLogicSource} from "../scripts/load-pure-logic.mjs";

let source=extractPureLogicSource(fs.readFileSync("public/index.html","utf8"));
const mutants={
  aviso:["return {before:d.months,after:result.item.months,leftBefore:debtLeft(d),leftAfter:debtLeft(result.item)};","return null;"],
  fresco:["rows.length!==1||!planEditSame(rows[0],debt)","rows.length!==1"],
  recalculo:["const result=debtEditResult(rows[0],form);","const result={item:confirmed.item};"],
  confirmado:["if(!planEditSame(result.item,confirmed.item)||!planEditSame(debtEditTermChange(rows[0],form,result),confirmed.change))","if(false)"]
};
const mutant=process.argv[process.argv.indexOf("--mutant")+1];
if(process.argv.includes("--mutant")){assert.ok(mutants[mutant]);const [a,b]=mutants[mutant];assert.equal(source.split(a).length,2);source=source.replace(a,b);}
let time=Date.parse("2026-10-18T12:00:00Z");class Clock extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
const c=createLogicSandbox({Date:Clock});vm.runInNewContext(source,c);
const d={id:"aviso",name:"Deuda sintética",value:2000,monthly:200,months:10,day:25,asOf:2026*12+5,original:2000,unknown:{keep:7}},plain=x=>JSON.parse(JSON.stringify(x));
const form=(changes={},debt=d)=>({...c.debtEditDraft(debt),...changes});
const confirmation=(f,debt=d)=>{const result=c.debtEditResult(debt,f);return{item:result.item,change:c.debtEditTermChange(debt,f,result)};};
const cases=[
 ["saldo: muestra total y pendientes distintos",()=>assert.deepEqual(plain(confirmation(form({balance:"1300,25"})).change),{before:10,after:11,leftBefore:6,leftAfter:7})],
 ["dia: no confunde total con pendientes",()=>assert.deepEqual(plain(confirmation(form({day:"1"})).change),{before:10,after:11,leftBefore:6,leftAfter:6})],
 ["acortar tambien requiere aviso",()=>assert.deepEqual(plain(confirmation(form({balance:"800"})).change),{before:10,after:8,leftBefore:6,leftAfter:4})],
 ["sin cambio implicito no pregunta",()=>{for(const f of [form(),form({day:"26"}),form({balance:"1300,25",months:"11"}),form({balance:"x"})])assert.equal(confirmation(f).change,null);const noTerm={...d};delete noTerm.months;assert.equal(confirmation(form({balance:"1300,25"},noTerm),noTerm).change,null);}],
 ["confirmacion vigente devuelve recalculo exacto sin mutar",()=>{const f=form({balance:"1300,25"}),before=JSON.stringify({d,f}),confirmed=confirmation(f),r=c.debtEditConfirmResult({debts:[{...d}]},d,f,confirmed);assert.deepEqual(plain(r.item),plain(confirmed.item));assert.equal(Math.round(c.debtBalance(r.item)*100),130025);assert.equal(JSON.stringify({d,f}),before);}],
 ["deuda modificada no se pisa",()=>{const f=form({balance:"1300,25"});assert.equal(c.debtEditConfirmResult({debts:[{...d,value:2050}]},d,f,confirmation(f)).error,"plan_edit_changed");}],
 ["deuda borrada no resucita",()=>{const f=form({balance:"1300,25"});assert.equal(c.debtEditConfirmResult({debts:[]},d,f,confirmation(f)).error,"plan_edit_changed");}],
 ["identidad duplicada se rechaza",()=>{const f=form({balance:"1300,25"});assert.equal(c.debtEditConfirmResult({debts:[d,{...d}]},d,f,confirmation(f)).error,"plan_edit_changed");}],
 ["otro borrador necesita nueva confirmacion",()=>{const f=form({balance:"1300,25"});assert.equal(c.debtEditConfirmResult({debts:[d]},d,{...f,balance:"1400"},confirmation(f)).error,"db_edit_projection_changed");}],
 ["nuevo error se valida al confirmar",()=>{const f=form({balance:"1300,25"});assert.equal(c.debtEditConfirmResult({debts:[d]},d,{...f,balance:"x"},confirmation(f)).error,"plan_edit_invalid");}],
 ["pasar el dia de cobro invalida la proyeccion confirmada",()=>{const f=form({balance:"1300,25"}),confirmed=confirmation(f);time=Date.parse("2026-10-25T12:00:00Z");try{assert.equal(c.debtEditConfirmResult({debts:[d]},d,f,confirmed).error,"db_edit_projection_changed");}finally{time=Date.parse("2026-10-18T12:00:00Z");}}]
];
let failed=0;for(const [name,run] of cases){try{run();console.log("PASS "+name);}catch(e){failed++;console.error("FAIL "+name+": "+e.message);}}
console.log(JSON.stringify({cases:cases.length,passed:cases.length-failed,failed,mutant:process.argv.includes("--mutant")?mutant:null}));if(failed)process.exitCode=1;
