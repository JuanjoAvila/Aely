import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createLogicSandbox,extractPureLogicSource} from "../scripts/load-pure-logic.mjs";

const arg=process.argv.indexOf("--html"),html=fs.readFileSync(arg<0?"public/index.html":process.argv[arg+1],"utf8"),source=extractPureLogicSource(html),cents=n=>Math.round(n*100),plain=x=>JSON.parse(JSON.stringify(x));
function logic(text=source){
 let time=Date.parse("2026-10-14T12:00:00Z");
 class Clock extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
 const c=createLogicSandbox({Date:Clock});vm.runInNewContext(text,c);return{c,at:(month,day)=>{time=Date.UTC(2026,month,day,12);}};
}
const anchor=2026*12+9-4,debt=()=>({id:"debt-second",name:"Deuda sintética",value:2000,monthly:200,months:10,day:15,asOf:anchor,unknown:{keep:7}});
function edited(c,d,changes){const r=c.debtEditResult(d,{...c.debtEditDraft(d),...changes});assert.equal(r.error,undefined);return r.item;}
// Oráculo independiente: cada descenso del principal se suma en céntimos, incluido el último
// residual y el pago final. Llegar al fin del plazo con saldo positivo es el fallo R1.
function schedule(runtime,d,expectedBalance,expectedLeft,expectedTotal,expectedLast){
 const {c,at}=runtime;assert.equal(cents(c.debtBalance(d)),expectedBalance);assert.equal(c.debtLeft(d),expectedLeft);assert.equal(d.months,expectedTotal);
 let previous=expectedBalance,total=0,last=0;
 for(let i=0;i<expectedLeft;i++){at(9+(d.day<=14?1:0)+i,d.day);const balance=cents(c.debtBalance(d));assert.ok(balance<=previous);last=previous-balance;total+=last;previous=balance;}
 assert.equal(previous,0,"No queda principal huérfano al acabar el plazo");assert.equal(c.debtLeft(d),0);assert.equal(total,expectedBalance,"La proyección cubre exactamente el saldo, sin crear céntimos");assert.equal(last,expectedLast,"La última cuota solo cancela el residual y el pago final");
}
const cases=[
 ["R1-dia",r=>{const d=debt();assert.equal(r.c.debtLeft(d),6);const n=edited(r.c,d,{day:"1"});assert.equal(n.asOf,anchor);assert.equal(n.value,2200);schedule(r,n,120000,6,11,20000);}],
 ["R1-cuota",r=>{const n=edited(r.c,debt(),{monthly:"100"});assert.equal(n.value,1600);schedule(r,n,120000,12,16,10000);}],
 ["M5-saldo-residual",r=>{const n=edited(r.c,debt(),{balance:"1300,25"});schedule(r,n,130025,7,11,10025);}],
 ["M5-saldo-dia-cuota",r=>{const n=edited(r.c,debt(),{balance:"1300,25",day:"1",monthly:"100"});schedule(r,n,130025,14,19,25);}],
 ["R1-dia-retrocede",r=>{const d={...debt(),day:1};assert.equal(cents(r.c.debtBalance(d)),100000);const n=edited(r.c,d,{day:"15"});schedule(r,n,100000,5,9,20000);}],
 ["R1-amort-distinta-cuota",r=>{const n=edited(r.c,{...debt(),amort:200},{monthly:"100"});assert.equal(n.amort,200);schedule(r,n,120000,6,10,20000);}],
 ["R1-pago-final",r=>{const n=edited(r.c,{...debt(),value:2400.11,balloon:400.11},{monthly:"100"});assert.equal(n.balloon,400.11);schedule(r,n,160011,12,16,50011);}],
 ["R1-centimos-sin-cuota-fantasma",r=>{const d={...debt(),value:0.14,monthly:0.01,months:14,asOf:2026*12+9};const n=edited(r.c,d,{day:"1"});schedule(r,n,14,14,15,1);}],
 ...["debts","goals"].map(field=>["M2-id-"+field,r=>{
  const first=field==="debts"?{...debt(),id:"debt-first",name:"Primera deuda",value:900}:{id:"goal-first",name:"Primera meta",target:900,saved:100},second=field==="debts"?debt():{id:"goal-second",name:"Segunda meta",target:4000.55,saved:1500.25,unknown:{keep:8}};
  const next=field==="debts"?edited(r.c,second,{name:"Deuda segunda editada"}):r.c.goalEditResult(second,{...r.c.goalEditDraft(second),name:"Meta segunda editada"}).item;
  for(const rows of [[first,second],[second,first]]){const state={debts:field==="debts"?rows:[debt(),{...debt(),id:"another"}],goals:field==="goals"?rows:[{id:"g1"},{id:"g2"}],expenses:[{id:"unaffected"}],reservaLog:[{id:"history"}],settings:{reservaRules:[{id:"rule"}]}};
   const result=r.c.planEditCommit(state,field,second,next);assert.deepEqual(plain(result[field]),rows.map(x=>plain(x.id===second.id?next:x)));assert.equal(result[field].find(x=>x.id===first.id),first);assert.equal(result.expenses,state.expenses);assert.equal(result.reservaLog,state.reservaLog);assert.equal(result.settings,state.settings);assert.equal(result[field==="debts"?"goals":"debts"],state[field==="debts"?"goals":"debts"]);
  }
 }]),
 ["M7-objetivo-baja-done",r=>{const g={id:"goal",name:"Meta",saved:1500.25,target:2000,done:false,unknown:{keep:8}},n=r.c.goalEditResult(g,{...r.c.goalEditDraft(g),target:"1400,15"}).item;assert.equal(n.done,true);assert.equal(n.doneAt,"2026-10-14T12:00:00.000Z");assert.equal(n.saved,1500.25);assert.equal(n.id,g.id);assert.deepEqual(plain(n.unknown),g.unknown);}],
 ["M7-objetivo-sube-reabre",r=>{const g={id:"goal",name:"Meta",saved:1500.25,target:1400.15,done:true,doneAt:"2026-10-01T12:00:00.000Z"},n=r.c.goalEditResult(g,{...r.c.goalEditDraft(g),target:"2000"}).item;assert.equal(n.done,false);assert.equal(n.doneAt,null);assert.equal(n.saved,1500.25);}]
];
function evaluate(text,ids=cases.map(x=>x[0])){return cases.filter(([id])=>ids.includes(id)).map(([id,run])=>{try{run(logic(text));return{id,passed:true};}catch(e){return{id,passed:false,error:e.message};}});}
const results=evaluate(source),failed=results.filter(x=>!x.passed),mutations=[];
if(!failed.length&&process.argv.includes("--mutations")){
 const definitions=[
  {id:"M2-indice-en-vez-de-id",find:"s[field].map(function(x){ return x.id===before.id?next:x; })",replace:"s[field].map(function(x,i){ return i===0?next:x; })",cases:["M2-id-debts","M2-id-goals"]},
  {id:"M5-no-recalcular-plazo",find:/if\(\(amountChanged\|\|quotaChanged\|\|dayChanged\)&&!termChanged&&next.months!=null&&am>0\)/,replace:"if(false)",cases:["R1-dia","R1-cuota","M5-saldo-residual","M5-saldo-dia-cuota"]},
  {id:"M7-done-no-recalculado",find:/  if\(next.target!==g.target\|\|next.saved!==g.saved\)\{[^\n]+\}\r?\n/,replace:"",cases:["M7-objetivo-baja-done","M7-objetivo-sube-reabre"]}
 ];
 for(const m of definitions){const mutated=source.replace(m.find,m.replace);assert.notEqual(mutated,source,"Mutación aplicada "+m.id);const witnesses=evaluate(mutated,m.cases);assert.ok(witnesses.every(x=>!x.passed),"Todos los guardianes específicos detectan "+m.id);mutations.push({id:m.id,killed:true,witnesses});}
}
const report={runtime:"Node con funciones financieras reales y reloj fijo; no navegador",results,passed:results.length-failed.length,failed:failed.length,mutations,browserExecuted:false};
if(process.env.OWN_REVIEW_EVIDENCE)fs.writeFileSync(process.env.OWN_REVIEW_EVIDENCE,JSON.stringify(report,null,2)+"\n");
for(const r of results)console.log((r.passed?"PASS ":"FAIL ")+r.id+(r.error?"\n"+r.error:""));
for(const m of mutations)console.log("KILLED "+m.id+": "+m.witnesses.map(x=>x.id).join(", "));
console.log(JSON.stringify({passed:report.passed,failed:report.failed,mutantsKilled:mutations.length,browserExecuted:false}));process.exitCode=failed.length?1:0;
