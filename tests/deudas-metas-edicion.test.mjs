import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { createLogicSandbox, extractPureLogicSource, loadPureLogic, loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";
import { estadoHeredado } from "../e2e/fixtures.mjs";
const baseHTML=()=>execFileSync("git",["show","33d39cb80764aaf22998f69ac8bbaeffeadf4013:public/index.html"],{encoding:"utf8",maxBuffer:8e6});
const html=process.argv.includes("--baseline")?baseHTML():fs.readFileSync("public/index.html","utf8");
const ctx=process.argv.includes("--baseline")?loadPureLogic(html):loadPureLogicFromFile();
const plain=v=>JSON.parse(JSON.stringify(v));
const cents=v=>Math.round(v*100);
const month=new Date().getFullYear()*12+new Date().getMonth();
const debts=[
  {id:"floating",name:"Sin plazo",value:11212.37,original:15000,monthly:197,asOf:month-4,account:"sabadell",unknown:{keep:true}},
  {id:"linear",name:"Con plazo",value:176714.8,original:180000,monthly:660.85,amort:450.15,months:309,asOf:month-40,day:1,apr:1.05},
  {id:"balloon",name:"Pago final",value:2600.35,original:3000.35,monthly:110.25,amort:100.15,months:12,balloon:600.2,downPayment:500.1,asOf:month-5,day:29,apr:0}
];
// Ejecuta los handlers del componente real con hooks en memoria. No sustituye al DOM:
// reproduce el texto controlado que React devolverá después de cada pulsación.
function decimalComponent(raw){
 const ui=createLogicSandbox(),slots=[];let cursor=0;
 ui.React.useState=init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==="function"?init():init;return[slots[i],v=>{slots[i]=typeof v==="function"?v(slots[i]):v;}];};
 ui.React.useRef=value=>{const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i];};
 ui.React.createElement=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)});
 vm.runInNewContext(extractPureLogicSource(html),ui);
 const d={...debts[1],apr:2};let state={debts:[d],accounts:[],expenses:[]};
 const render=()=>{cursor=0;return ui.DebtEditSheet?ui.DebtEditSheet({debt:d,state,set:f=>{state=f(state);},onClose(){},onDelete(){},showToast(){}}):ui.AmortAdvisor({state,set:f=>{state=f(state);},onAmort(){}});};
 const nodes=()=>{const all=[],walk=n=>{if(!n||typeof n!=="object")return;all.push(n);(n.children||[]).forEach(walk);};walk(render());return all;};
 const input=()=>nodes().find(n=>n.type==="input"&&(n.props["data-debt-field"]==="apr"||!ui.DebtEditSheet));
 input().props.onChange({target:{value:""}});
 let expected="";
 for(const char of raw){expected+=char;const before=input();before.props.onChange({target:{value:String(before.props.value)+char}});assert.equal(String(input().props.value),expected,"Se conserva texto intermedio "+expected);}
 if(ui.DebtEditSheet){assert.equal(state.debts[0].apr,2,"El borrador no escribe antes de Guardar");nodes().find(n=>n.type==="button"&&n.props.className==="btn btn-primary btn-block").props.onClick();}
 return state.debts[0];
}
for(const raw of ["1,05","1.05","","0"])assert.equal(decimalComponent(raw).apr,raw===""?null:raw==="0"?0:1.05);
if(process.argv.includes("--decimal-only"))process.exit(0);
assert.equal(typeof ctx.debtEditDraft,"function","Falta hoja individual con borrador textual de deuda");
for(const d of debts){
 const draft=ctx.debtEditDraft(d), same=ctx.debtEditResult(d,draft);
 assert.equal(same.error,undefined);assert.equal(same.item,d,"Guardar sin cambios conserva el objeto y todos sus campos");
 for(const raw of ["1,05","1.05","","0"]){
  const changed=ctx.debtEditResult(d,{...draft,apr:raw});
  if(raw==="") assert.equal(changed.item.apr==null,true);
  else assert.equal(changed.item.apr,raw==="0"?0:1.05);
  for(const key of ["value","asOf","amort","months","original","monthly","day","balloon","downPayment"])
   assert.equal(changed.item[key],d[key],"Cambiar solo TAE no altera "+key);
  assert.equal(cents(ctx.debtBalance(changed.item)),cents(ctx.debtBalance(d)));
 }
 const corrected=ctx.debtEditResult(d,{...draft,balance:"750,25"}).item;
 assert.equal(cents(ctx.debtBalance(corrected)),75025,"Saldo corregido exacto");
 assert.equal(corrected.id,d.id);assert.equal(corrected.asOf,d.months==null?month:d.asOf);
 const moved=ctx.debtEditResult(d,{...draft,day:d.day===1?"29":"1"}).item;
 assert.equal(cents(ctx.debtBalance(moved)),cents(ctx.debtBalance(d)),"Mover el cargo no inventa una amortización");
}
for(const raw of ["abc","-1","1,0,5","Infinity","1e2"])
 assert.ok(ctx.debtEditResult(debts[1],{...ctx.debtEditDraft(debts[1]),apr:raw}).error,"Rechaza TAE inválida "+raw);
const g={id:"g",name:"Meta",target:4000.55,saved:1500.25,monthly:75.1,emoji:"✈️",unknown:{keep:7}};
assert.equal(ctx.goalEditResult(g,ctx.goalEditDraft(g)).item,g);
const edited=ctx.goalEditResult(g,{...ctx.goalEditDraft(g),name:"Meta nueva",target:"4200,75",saved:"1600.35"}).item;
assert.equal(edited.target,4200.75);assert.equal(edited.saved,1600.35);assert.deepEqual(plain(edited.unknown),g.unknown);
const s={debts:[debts[0]],goals:[g],expenses:[{id:"untouched"}],settings:{reservaRules:[{id:"rule"}]}};
const next={...debts[0],apr:1.05};
const committed=ctx.planEditCommit(s,"debts",debts[0],next);
assert.equal(committed.debts[0],next);assert.equal(committed.expenses,s.expenses);assert.equal(committed.goals,s.goals);assert.equal(committed.settings,s.settings);
assert.equal(ctx.planEditCommit(committed,"debts",debts[0],next),committed,"Replay no duplica la edición");
const fresh={...s,debts:[{...debts[0],value:777}]};
assert.equal(ctx.planEditCommit(fresh,"debts",debts[0],next),fresh,"No pisa una corrección de otro móvil");
assert.equal(ctx.planEditCommit({...s,debts:[]},"debts",debts[0],next).debts.length,0,"No resucita una deuda borrada");
const base=process.argv.includes("--compare-base")?loadPureLogic(baseHTML()):ctx;
const metrics=(logic,s)=>({debts:s.debts.map(d=>({balance:cents(logic.debtBalance(d)),paid:logic.debtPaidCount(d),left:logic.debtLeft(d),amort:cents(d.amort!=null?d.amort:d.monthly||0),paidAmount:cents(Math.max(0,(d.original||logic.debtBalance(d))-logic.debtBalance(d)))})),totalDebt:cents(s.debts.reduce((a,d)=>a+logic.debtBalance(d),0)),monthly:cents(s.debts.reduce((a,d)=>a+(logic.debtActive(d)?d.monthly||0:0),0)),series:plain(logic.netWorthSeries(s)),goals:plain(s.goals),rules:plain(s.settings.reservaRules)});
for(let i=0;i<3;i++){
 const state={...estadoHeredado(),debts:[debts[i]],goals:[g],settings:{autoPrices:false,lang:"es",reservaRules:[{id:"r",kind:"fixed",value:50.25,goalId:g.id,mensual:true}]}};
 assert.deepEqual(metrics(ctx,state),metrics(base,state),"Antes/después: misma serie y cifras en estado "+i);
 const saved={...state,debts:state.debts.map(d=>ctx.debtEditResult(d,ctx.debtEditDraft(d)).item)};
 assert.deepEqual(metrics(ctx,saved),metrics(base,state),"Guardar sin cambios: mismas cifras en estado "+i);
}
console.log("deudas-metas-edicion: tres estados al céntimo, null/0/decimales, guardar sin cambios, campos ajenos y escritura fresca OK");
