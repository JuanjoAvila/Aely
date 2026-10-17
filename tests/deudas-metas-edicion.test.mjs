import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { createLogicSandbox, extractPureLogicSource, loadPureLogic, loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";
import { estadoHeredado } from "../e2e/fixtures.mjs";
const originalBase="33d39cb80764aaf22998f69ac8bbaeffeadf4013",executionBase="38a1eed020628b247f3ec97e54b3ca06ff92077d";
const argRef=process.argv.indexOf("--compare-ref"),compareRef=argRef>=0?process.argv[argRef+1]:executionBase;
const baseHTML=(ref=originalBase)=>execFileSync("git",["show",ref+":public/index.html"],{encoding:"utf8",maxBuffer:8e6});
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
 ui.React.startTransition=fn=>fn();
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
const base=process.argv.includes("--compare-base")||argRef>=0?loadPureLogic(baseHTML(compareRef)):ctx;
const metrics=(logic,s)=>{const series=logic.netWorthSeries(s);return{debts:s.debts.map(d=>({balance:cents(logic.debtBalance(d)),paid:logic.debtPaidCount(d),left:logic.debtLeft(d),amort:cents(d.amort!=null?d.amort:d.monthly||0),paidAmount:cents(Math.max(0,(d.original||logic.debtBalance(d))-logic.debtBalance(d)))})),totalDebt:cents(s.debts.reduce((a,d)=>a+logic.debtBalance(d),0)),monthly:cents(s.debts.reduce((a,d)=>a+(logic.debtActive(d)?d.monthly||0:0),0)),series:plain(series),coverage:plain(series.coverage||[]),goals:plain(s.goals),rules:plain(s.settings.reservaRules)};};
const evidence=[];
for(let i=0;i<3;i++){
 let state={...estadoHeredado(),debts:[debts[i]],goals:[g],settings:{autoPrices:false,lang:"es",reservaRules:[{id:"r",kind:"fixed",value:50.25,goalId:g.id,mensual:true}]}};
 // Tras rebasar131, los tres estados incluyen sin parte, manual al50% y OB al50% con
 // obAcc/bankUid. Se usa la base autorizada para preparar la cartera, nunca un matcher propio.
 if(i===1)state=ctx.setAccountShare(state,state.accounts[0],"account",50);
 if(i===2){
  const joint={key:"synthetic-joint",ent:"revolut",iban:"ES00SYNTH0000000000000002",value:900,cur:"EUR",name:"Cuenta conjunta sintética"};
  state={...state,obAccounts:[joint],expenses:state.expenses.concat([{id:"shared-mov",ent:"revolut",amount:100.25,date:"2026-10-10T12:00:00Z",merchant:"Compra sintética",category:"otros",obAcc:joint.iban,bankUid:joint.key}])};
  state=ctx.setAccountShare(state,joint,"ob",50);
 }
 const before=metrics(base,state),after=metrics(ctx,state);
 assert.deepEqual(after,before,"Antes/después: misma serie y cifras en estado "+i);
 const saved={...state,debts:state.debts.map(d=>ctx.debtEditResult(d,ctx.debtEditDraft(d)).item)};
 assert.deepEqual(metrics(ctx,saved),before,"Guardar sin cambios: mismas cifras en estado "+i);
 evidence.push({state:i,share:i===0?"none":i===1?"manual50":"ob50-with-obAcc-bankUid",before,after,unchangedSave:true});
}
if(process.env.OWN_FINANCIAL_EVIDENCE)fs.writeFileSync(process.env.OWN_FINANCIAL_EVIDENCE,JSON.stringify({compareRef,originalBase,exactCentsEqual:true,evidence},null,2));
// Usa el React/ReactDOM de la app, sin navegador ni dependencias nuevas. El contenedor mínimo
// no pinta: permite reproducir las prioridades reales que desmontaban la hoja antes del rechazo.
async function queuedEditGuard({field,queued=false,transition=false,strict=false,replay=false,unchanged=false,remove=false},hookSource=extractPureLogicSource(html)){
 const bundles=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 const react=bundles.find(s=>s.startsWith("/* React */")),dom=bundles.find(s=>s.startsWith("/* ReactDOM */"));
 assert.ok(react&&dom,"React y ReactDOM reales del artefacto");
 class Element{
  constructor(doc,type="div"){this.nodeType=1;this.nodeName=type.toUpperCase();this.tagName=this.nodeName;this.ownerDocument=doc;this.style={};this.children=[];this.attributes={};}
  addEventListener(){} removeEventListener(){} setAttribute(k,v){this.attributes[k]=v;} removeAttribute(k){delete this.attributes[k];}
  appendChild(n){this.children.push(n);n.parentNode=this;return n;} removeChild(n){this.children.splice(this.children.indexOf(n),1);n.parentNode=null;}
  insertBefore(n,b){this.children.splice(this.children.indexOf(b),0,n);n.parentNode=this;}
 }
 const document={nodeType:9,addEventListener(){},removeEventListener(){},createElement(t){return new Element(this,t);},createTextNode(t){return{nodeType:3,nodeValue:t,ownerDocument:this};},activeElement:null};
 document.documentElement=document.createElement("html");document.body=document.createElement("body");
 const runtime={console,setTimeout,clearTimeout,performance,document,navigator:{userAgent:"node"},HTMLElement:Element,HTMLIFrameElement:class extends Element{},addEventListener(){},removeEventListener(){}};
 runtime.window=runtime;runtime.self=runtime;document.defaultView=runtime;vm.createContext(runtime);vm.runInContext(react,runtime);vm.runInContext(dom,runtime);
 const start=hookSource.indexOf("function planEditSame("),end=hookSource.indexOf("function PlanEditSheet(",start);assert.ok(start>=0&&end>start);
 vm.runInContext("const {useState,useRef,useLayoutEffect}=React;function t(s){return s;}\n"+hookSource.slice(start,end),runtime);
 const isDebt=field==="debts",item=isDebt?{id:"debt",value:176714.8,apr:2,unknown:{keep:7}}:{id:"goal",saved:1500.25,target:4000.55,unknown:{keep:8}},amount=isDebt?"value":"saved",changed=isDebt?"apr":"target";
 const next=unchanged?item:{...item,[changed]:isDebt?1.05:4200.55},correction=isDebt?99999.25:2222.25,toasts=[],commits=[];let control;
 function Sheet({state,set,onClose}){
  const [draft]=runtime.React.useState("1,05"),save=runtime.usePlanEditSave({state,set,field,item,onClose,showToast:x=>toasts.push(x)});
  Object.assign(control,{fire:()=>save.save({item:next}),error:save.error,pending:save.pending,draft});return null;
 }
 function App(){
  const [state,setStateRaw]=runtime.React.useState({[field]:[item]}),[open,setOpen]=runtime.React.useState(true);
  // Mismo contrato de App.set: calcula desde prev y no escribe ni confirma fuera del commit.
  const set=runtime.React.useCallback(updater=>setStateRaw(prev=>{if(replay)updater(prev);const updated=updater(prev);return updated===prev?prev:Object.assign({},updated,{_savedAt:Date.now()});}),[]);
  control={state,open,set};runtime.React.useLayoutEffect(()=>{commits.push({open,rows:plain(state[field])});});
  return open?runtime.React.createElement(Sheet,{state,set,onClose(){setOpen(false);}}):null;
 }
 const root=runtime.ReactDOM.createRoot(document.createElement("div"));
 try{
  runtime.ReactDOM.flushSync(()=>root.render(runtime.React.createElement(strict?runtime.React.StrictMode:runtime.React.Fragment,null,runtime.React.createElement(App))));
  if(queued){const update=()=>control.set(s=>({...s,[field]:remove?[]:s[field].map(x=>({...x,[amount]:correction}))}));if(transition)runtime.React.startTransition(update);else update();}
  runtime.ReactDOM.flushSync(()=>control.fire());
  // Espera a una condición observable; el plazo solo falla el test si React no resuelve la cola.
  const deadline=Date.now()+2000;while(Date.now()<deadline){const rows=control.state[field],corrected=!queued||(remove?rows.length===0:rows[0][amount]===correction);if(corrected&&(!control.open||control.error))break;await new Promise(r=>setTimeout(r,0));}
  const actual={rows:plain(control.state[field]),open:control.open,error:control.error||null,draft:control.draft||null,toasts,commits};
  if(queued){
   assert.equal(actual.open,true,"El rechazo encolado conserva la hoja y el borrador");assert.equal(actual.error,"plan_edit_changed");assert.equal(actual.draft,"1,05");assert.deepEqual(actual.toasts,[],"No anuncia como guardada una escritura descartada");
   if(remove)assert.deepEqual(actual.rows,[]);else{assert.equal(actual.rows[0][amount],correction);assert.equal(actual.rows[0][changed],item[changed]);assert.deepEqual(actual.rows[0].unknown,item.unknown);}
  }else{assert.equal(actual.open,false);assert.deepEqual(actual.rows,[next]);assert.deepEqual(actual.toasts,["plan_edit_saved"]);}
  return actual;
 }finally{runtime.ReactDOM.flushSync(()=>root.unmount());}
}
// Repite el árbol StrictMode de producción y también el updater sin cambiar el prev: protege
// replay/encolado sin atribuir al bundle de producción el doble montaje de React de desarrollo.
const queueCases=[];
for(const field of ["debts","goals"]){
 for(const strict of [false,true])for(const replay of [false,true]){
  for(const options of [{},{unchanged:true},{queued:true},{queued:true,unchanged:true},{queued:true,transition:true},{queued:true,remove:true}]){
   const config={field,strict,replay,...options};await queuedEditGuard(config);queueCases.push(config);
  }
 }
}
// Control causal: volver a separar el pendiente de la escritura resucita el cierre prematuro.
const currentHook=extractPureLogicSource(html).replace(/\r\n/g,"\n"),withoutTransition=currentHook.replace("React.startTransition(function(){ setPending(next); set(function(s){","setPending(next); set(function(s){").replace("      return changed;\n    }); });\n  };","      return changed;\n    });\n  };");
assert.notEqual(withoutTransition,currentHook,"El control retira la agrupación de prioridades");
await assert.rejects(()=>queuedEditGuard({field:"debts",queued:true},withoutTransition),assert.AssertionError,"El guardián detecta la regresión original");
const urgentPending=currentHook.replace("React.startTransition(function(){ setPending(next); set(function(s){","setPending(next); React.startTransition(function(){ set(function(s){");
assert.notEqual(urgentPending,currentHook);
await assert.rejects(()=>queuedEditGuard({field:"goals",queued:true,unchanged:true},urgentPending),assert.AssertionError,"Un pendiente urgente tampoco confirma un no-op antes de la corrección");
if(process.env.OWN_QUEUE_EVIDENCE)fs.writeFileSync(process.env.OWN_QUEUE_EVIDENCE,JSON.stringify({runtime:"Actual bundled React and ReactDOM in a minimal nonvisual Node container",cases:queueCases,passed:queueCases.length,causalMutantsRejected:2,productionStrictModeTreeIncluded:true,explicitUpdaterReplayIncluded:true,developmentStrictModeNotClaimed:true,browserExecuted:false},null,2));
console.log("deudas-metas-edicion: tres estados al céntimo, null/0/decimales y "+queueCases.length+" colas React reales; dos regresiones causales rechazadas");
