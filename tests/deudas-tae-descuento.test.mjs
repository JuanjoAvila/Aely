// La TAE no puede convertir un descuento pendiente en dinero que te deben al guardar.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createLogicSandbox,extractPureLogicSource} from "../scripts/load-pure-logic.mjs";
const html=fs.readFileSync("public/index.html","utf8"),source=extractPureLogicSource(html);
const instant=Date.parse("2026-10-18T12:00:00Z"),YM=2026*12+10;
class Clock extends Date{constructor(...a){super(...(a.length?a:[instant]));}static now(){return instant;}}
const plain=x=>JSON.parse(JSON.stringify(x));
const debt=extra=>({id:"d",name:"Préstamo sintético",value:6000,monthly:260,amort:300,months:20,day:20,asOf:YM-1,account:"banco",unknown:{keep:1},...extra});
const share={id:"p",n:"Persona",via:"debt",debtId:"d",amt:40};
const bill=extra=>({id:"f",name:"Fibra",amount:50,bankAmount:90,freq:"mes",day:20,account:"banco",reparto:[share],...extra});
const state=(fixed=[],d=debt())=>({debts:[d],fixed,goals:[{id:"g",name:"Meta",target:1000,saved:20}],expenses:[],accounts:[],flows:[],oneoffs:[],settings:{keep:true}});
function harness(initial,field="debts"){
  const c=createLogicSandbox({Date:Clock}),slots=[];let cursor=0,effects=[],current=initial,queued=[],closed=0,toasts=[],writes=0;
  c.React.useState=init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==="function"?init():init;return[slots[i],v=>{slots[i]=typeof v==="function"?v(slots[i]):v;}];};
  c.React.useRef=v=>{const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i];};
  c.React.useLayoutEffect=fn=>effects.push(fn);c.React.startTransition=fn=>fn();
  vm.runInNewContext(source,c);
  const item=initial[field][0];
  const render=()=>{cursor=0;effects=[];const view=c.usePlanEditSave({state:current,set:fn=>queued.push(fn),field,item,onClose(){closed++;},showToast:x=>toasts.push(x)});effects.forEach(fn=>fn());return view;};
  return {c,item,render,get state(){return current;},get writes(){return writes;},get closed(){return closed;},get toasts(){return toasts;},
    arrive(next){current=next;},flush(){queued.splice(0).forEach(fn=>{const before=current;current=fn(current);if(current!==before)writes++;});render();return render();}};
}
const edited=h=>h.c.debtEditResult(h.item,{...h.c.debtEditDraft(h.item),apr:"2.5",name:"Nombre cambiado",note:"Nota nueva"});
let cases=0;
function caso(name,fn){fn();cases++;console.log("PASS "+name);}
for(const [name,f] of [["activa",bill()],["pausada",bill({pausedFrom:YM,pausedUntil:YM+2})],["futura",bill({months:[12],freq:"anual"})]]){
  caso("TAE bloquea relación "+name+" sin escritura parcial",()=>{
    const s=state([f]),before=JSON.stringify(s),h=harness(s),result=h.c.debtEditResult(h.item,{...h.c.debtEditDraft(h.item),apr:"2.5",name:"Nombre cambiado",note:"Nota nueva",monthly:"270"});h.render().save(result);const view=h.flush();
    assert.equal(h.state,s,"El rechazo conserva la identidad del estado completo");assert.equal(JSON.stringify(s),before);
    assert.equal(view.error,"db_rate_discount_remove");assert.equal(h.writes,0);assert.equal(h.closed,0);assert.deepEqual(h.toasts,[]);
    assert.equal(h.c.planEditCommit(s,"debts",h.item,edited(h).item),s,"También protege la frontera pura");
  });
}
caso("relación recibida después del render se revalida en updater",()=>{
  const s=state(),h=harness(s);h.render().save(edited(h));const fresh={...s,fixed:[bill()]},raw=JSON.stringify(fresh);h.arrive(fresh);const view=h.flush();
  assert.equal(h.state,fresh);assert.equal(JSON.stringify(fresh),raw);assert.equal(view.error,"db_rate_discount_remove");assert.equal(h.writes,0);assert.equal(h.closed,0);assert.deepEqual(h.toasts,[]);
});
caso("sin relaciones acepta TAE preservando el resto del modelo",()=>{
  const s=state(),h=harness(s),result=edited(h);h.render().save(result);h.flush();assert.equal(h.state.debts[0],result.item);assert.equal(h.state.fixed,s.fixed);assert.equal(h.writes,1);assert.equal(h.closed,1);
  for(const k of ["monthly","amort","months","value","asOf","unknown"])assert.deepEqual(h.state.debts[0][k],s.debts[0][k]);
});
caso("quitar descuento por productor real permite TAE sin borrar historia pagada",()=>{
  const s=state([bill({day:10,paidYm:YM,paidDay:10})]),h=harness(s);
  const removed=h.c.deudasTrasReparto(s,h.c.fixedEditarRecibo(s,"f",{amount:90,reparto:null},"ahora",2026,10,18));
  assert.ok(removed.fixed[0].soloMes[YM].reparto.some(x=>x.debtId==="d"),"La retirada conserva el reparto pagado");
  const history=JSON.stringify(removed.fixed),next=harness(removed);next.render().save(edited(next));assert.equal(next.flush().error,"");assert.equal(next.state.debts[0].apr,2.5);assert.equal(JSON.stringify(next.state.fixed),history);
});
for(const [name,key,paid,blocked] of [["pasado",YM-1,false,false],["actual pagado",YM,true,false],["actual pendiente",YM,false,true],["futuro",YM+1,false,true]]){
  caso("reparto congelado "+name,()=>{
    const f=bill({reparto:[],day:20,soloMes:{[key]:{amt:50,reparto:[share]}},...(paid?{paidYm:YM,paidDay:10}:{})}),s=state([f]),h=harness(s);
    h.render().save(edited(h));const view=h.flush();assert.equal(view.error,blocked?"db_rate_discount_remove":"");assert.equal(h.writes,blocked?0:1);assert.equal(h.state.fixed,s.fixed);
  });
}
caso("TAE positiva previa permite metadatos sin reparación",()=>{
  const s=state([bill()],debt({apr:2})),h=harness(s),result=h.c.debtEditResult(h.item,{...h.c.debtEditDraft(h.item),name:"Renombrada"});h.render().save(result);assert.equal(h.flush().error,"");assert.equal(h.state.debts[0].apr,2);assert.equal(h.state.fixed,s.fixed);
});
caso("cero y desconocida no son transición positiva",()=>{
  for(const apr of ["0",""]){const s=state([bill()]),h=harness(s),result=h.c.debtEditResult(h.item,{...h.c.debtEditDraft(h.item),apr,name:"Renombrada"});h.render().save(result);assert.equal(h.flush().error,"");assert.equal(h.writes,1);}
});
caso("metas mantienen el guardado compartido",()=>{
  const s=state([bill()]),h=harness(s,"goals"),next={...s.goals[0],name:"Meta nueva"};h.render().save({item:next});assert.equal(h.flush().error,"");assert.equal(h.state.goals[0],next);assert.equal(h.state.debts,s.debts);assert.equal(h.closed,1);
});
console.log("deudas-tae-descuento: "+cases+" casos; TZ="+process.env.TZ);
