import { createHash } from "node:crypto";

/* Sólo altera la respuesta local del test. Ningún byte de producto se escribe.
   Las tres anclas completas fallan cerradas si cambia el contrato observado. */
export const RECENT = 'const recent=(state.expenses||[]).filter(function(e){ return !expenseIsTombstoned(e,expenseDeletedSet(state)); }).sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); }).slice(0,3);';
export const DASH = 'function Dashboard({state, totals, budgetStreak, set, onOpenSettings, onOpenProfile, onGoGastos, onGoPlan, showToast}){';
export const SYNC = 'const syncCloudExpenses=function(){';

export function instrumentDashboard(html){
  for(const anchor of [RECENT,DASH,SYNC]){
    if(html.split(anchor).length!==2)throw new Error("Ancla de perfil ausente/duplicada: "+anchor.slice(0,50));
  }
  const transformed=html
    .replace(DASH,DASH+'\nwindow.__dashProfile.guardBanks();window.__dashProfile.state=state;window.__dashProfile.set=set;window.__dashProfile.totals=totals;')
    .replace(RECENT,'const recent=window.__dashProfile.derive(state,function(e){ return !expenseIsTombstoned(e,expenseDeletedSet(state)); },function(a,b){ return String(b.date).localeCompare(String(a.date)); });')
    .replace(SYNC,'const syncCloudExpenses=window.__dashProfile.sync=function(){');
  return {html:transformed,sourceSHA256:createHash("sha256").update(html).digest("hex"),instrumentedSHA256:createHash("sha256").update(transformed).digest("hex"),anchors:3};
}

/* Se serializa con addInitScript; todo estado queda en el navegador sintético.
   La comparación oracle se ejecuta FUERA de la ventana medida para no ocultar el A/B. */
export function installDashboardProfile(){
  const p=window.__dashProfile={mode:"baseline",last:null,active:false,frames:[],longtasks:[],samples:[],writes:0,expensesWrites:0,bankCalls:[]};
  // Un doble sin red también puede esconder un sync bancario automático indebido.
  // Se observa desde el primer render, antes de efectos, sin sustituir retornos/receiver.
  p.guardBanks=function(api){
    if(p.bankOriginals) return;
    api=api||cloud;
    const names=["bankSync","bankSyncHistory"];
    if(names.some(name=>typeof api[name]!=="function"))throw new Error("Falta frontera bancaria del perfil");
    p.bankApi=api;p.bankOriginals=names.map(name=>[name,api[name]]);
    for(const [name,fn] of p.bankOriginals)api[name]=function(){p.bankCalls.push(name);return fn.apply(this,arguments);};
  };
  const metrics=()=>({renders:0,computes:0,hits:0,rows:0,comparisons:0,filterMs:0,sortMs:0,deriveMs:0});
  p.metrics=metrics();
  p.derive=function(state,predicate,compare){
    const start=performance.now(),m=p.metrics;m.renders++;
    const expenses=state.expenses,deleted=state.deleted;
    if(p.mode==="virtual-cache"&&p.last&&p.last.expenses===expenses&&p.last.deleted===deleted){
      m.hits++;m.deriveMs+=performance.now()-start;p.rows=p.last.rows;return p.rows;
    }
    m.computes++;const input=expenses||[],f=performance.now();
    const filtered=input.filter(predicate);m.rows+=input.length;m.filterMs+=performance.now()-f;
    const s=performance.now();filtered.sort(function(a,b){m.comparisons++;return compare(a,b);});m.sortMs+=performance.now()-s;
    p.rows=filtered.slice(0,3);p.last={expenses,deleted,rows:p.rows};m.deriveMs+=performance.now()-start;
    return p.rows;
  };
  p.verify=function(){
    const state=p.state;
    const expected=(state.expenses||[]).filter(function(e){return !expenseIsTombstoned(e,expenseDeletedSet(state));}).sort(function(a,b){return String(b.date).localeCompare(String(a.date));}).slice(0,3);
    if(expected.length!==p.rows.length||expected.some((e,i)=>e!==p.rows[i]))throw new Error("Recent cambió filas/orden/referencias");
    return {rows:expected.map(e=>({id:e.id,date:e.date,amount:e.amount,merchant:e.merchant,source:e.source})),netWorth:p.totals.netWorth,budget:state.budget,accounts:state.accounts};
  };
  p.verifyDOM=function(){
    const elements=[...document.querySelectorAll('.v4-screen:has(>.v4-inicio-head) .v4-mov')];
    if(elements.length!==p.rows.length)throw new Error("DOM recientes no tiene las filas esperadas");
    const actual=elements.map(el=>({merchant:el.querySelector('.nm').textContent,amount:el.querySelector('.am').textContent}));
    const expected=p.rows.map(e=>({merchant:e.merchant||catName(e.category),amount:(e.amount<0?"+":"")+eur(Math.abs(e.amount))}));
    if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error("DOM recientes cambió importes o textos");
    return actual;
  };
  p.begin=function(mode){p.mode=mode;p.last=null;p.metrics=metrics();p.frames=[];p.longtasks=[];p.prev=null;p.start=performance.now();p.active=true;p.startWrites=p.expensesWrites;};
  p.end=function(){p.active=false;return {mode:p.mode,metrics:{...p.metrics},frames:p.frames.slice(),longtasks:p.longtasks.slice(),expensesWrites:p.expensesWrites-p.startWrites,elapsed:performance.now()-p.start};};
  const frame=function(t){if(p.active){if(p.prev!=null)p.frames.push(t-p.prev);p.prev=t;}p.raf=requestAnimationFrame(frame);};p.raf=requestAnimationFrame(frame);
  p.observer=new PerformanceObserver(list=>{if(p.active)for(const e of list.getEntries())if(e.startTime>=p.start)p.longtasks.push(e.duration);});p.observer.observe({entryTypes:["longtask"]});
  const put=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){p.writes++;if(k==="micartera_v3_exp")p.expensesWrites++;return put.apply(this,arguments);};
  p.dispose=function(){p.active=false;cancelAnimationFrame(p.raf);p.observer.disconnect();Storage.prototype.setItem=put;
    if(p.bankOriginals){for(const [name,fn] of p.bankOriginals)p.bankApi[name]=fn;p.bankOriginals=null;}
  };
}
