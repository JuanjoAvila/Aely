import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createLogicSandbox,extractPureLogicSource} from "../scripts/load-pure-logic.mjs";

let source=extractPureLogicSource(fs.readFileSync("public/index.html","utf8"));
const mutant=process.argv.includes("--mutant")?process.argv[process.argv.indexOf("--mutant")+1]:null;
if(mutant){
 const edits={submit:["disabled:save.pending||confirmPending,onClick:submit","disabled:save.pending||confirmPending,onClick:function(){save.save(debtEditResult(debt,form));}"],plural:['change.after===1?"db_edit_term_summary_one":"db_edit_term_summary"','"db_edit_term_summary"']};
 assert.ok(edits[mutant]);const [a,b]=edits[mutant];assert.equal(source.split(a).length,2);source=source.replace(a,b);
}
class Clock extends Date{constructor(...args){super(...(args.length?args:["2026-10-18T12:00:00Z"]));}static now(){return Date.parse("2026-10-18T12:00:00Z");}}
const phrases={es:["Plazo total: 2 → 1 mes. Cuotas pendientes: 2 → 1.","Plazo total: 1 → 2 meses. Cuotas pendientes: 1 → 2."],en:["Total term: 2 → 1 month. Remaining payments: 2 → 1.","Total term: 1 → 2 months. Remaining payments: 1 → 2."],ca:["Termini total: 2 → 1 mes. Quotes pendents: 2 → 1.","Termini total: 1 → 2 mesos. Quotes pendents: 1 → 2."]};
function render(lang,months,balance){
 const calls=[],dialogs=[],c=createLogicSandbox({Date:Clock});
 c.React={...c.React,createElement:(type,props,...children)=>({type,props:props||{},children}),useLayoutEffect:fn=>fn(),useState:init=>{const value=typeof init==="function"?init():init;return [value&&typeof value==="object"&&"balance" in value?{...value,balance:String(balance)}:value,()=>{}];}};
 const context=vm.createContext(c);vm.runInContext(source,context);
 // El HTML solo lleva español; el navegador carga estos paquetes al elegir idioma.
 c.__en=JSON.parse(fs.readFileSync("public/i18n/en.json","utf8"));c.__ca=JSON.parse(fs.readFileSync("public/i18n/ca.json","utf8"));
 vm.runInContext('Object.assign(LANG.en,__en);Object.assign(LANG.ca,__ca);CURLANG="'+lang+'";',context);
 c.usePlanEditSave=()=>({save:r=>calls.push(r),pending:false,error:""});
 c.askConfirm=options=>new Promise(resolve=>dialogs.push({options,resolve}));
 const debt={id:"submit",name:"Deuda sintética",value:months*100,monthly:100,months,day:25,asOf:2026*12+9};
 const tree=c.DebtEditSheet({debt,state:{debts:[debt]},set:()=>{},onClose:()=>{},onDelete:()=>{}});
 const nodes=[];function visit(n){if(!n||typeof n!=="object")return;nodes.push(n);for(const child of (n.children||[]).flat(Infinity))visit(child);}visit(tree);
 const button=nodes.find(n=>n.type==="button"&&n.props.className.includes("btn-primary"));assert.ok(button,"Guardar existe");
 return {button,calls,dialogs};
}
let failed=0,passed=0;
async function check(name,fn){try{await fn();passed++;console.log("PASS "+name);}catch(e){failed++;console.error("FAIL "+name+": "+e.message);}}
for(const lang of ["es","en","ca"])for(const [i,months,balance,after] of [[0,2,50,1],[1,1,150,2]])await check(lang+" submit y "+(i?"plural":"singular"),async()=>{
 const r=render(lang,months,balance);r.button.props.onClick();assert.equal(r.dialogs.length,1,"Guardar debe abrir askConfirm");assert.equal(r.calls.length,0,"no guarda antes de confirmar");assert.equal(r.dialogs[0].options.sub,phrases[lang][i]);
 r.dialogs[0].resolve(false);await Promise.resolve();assert.equal(r.calls.length,0,"cancelar no guarda");
 r.button.props.onClick();assert.equal(r.dialogs.length,2);r.dialogs[1].resolve(true);await Promise.resolve();assert.equal(r.calls.length,1);assert.equal(r.calls[0].item.months,after);assert.equal(r.calls[0].item.value,balance);
});
await check("sin cambio implícito sigue guardando directamente",()=>{const r=render("es",2,200);r.button.props.onClick();assert.equal(r.dialogs.length,0);assert.equal(r.calls.length,1);assert.equal(r.calls[0].item.months,2);});
console.log(JSON.stringify({passed,failed,mutant}));if(failed)process.exitCode=1;
