// El desplazamiento afecta al calendario, no a RAF, performance ni al scheduler nativo.
export function instalaRetorno({epoch,startup=null}){
  const p=window.__lagBanco,Native=window.Date;
  let offset=epoch-Native.now();
  function Clock(...args){return new.target?Reflect.construct(Native,args.length?args:[Native.now()+offset],new.target):new Native(Native.now()+offset).toString();}
  Object.setPrototypeOf(Clock,Native);Clock.prototype=Native.prototype;Clock.now=()=>Native.now()+offset;
  window.Date=Clock;p.advanceCalendar=ms=>{offset+=ms;};p.longtasks=[];
  const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())
    p.longtasks.push({start:e.startTime,duration:e.duration});});
  observer.observe({entryTypes:['longtask']});
  const stringify=JSON.stringify;JSON.stringify=function(...args){return p.measureSync('serialize',()=>stringify.apply(this,args));};
  p.installCauses=function(){
    const originals={};
    const methods=[['period','dashboardBudgetStats'],['period','monthBudgetStats'],['month','ensureBudgetMonthSnap'],
      ['month','applyReservaMensual'],['receipts-index','fixedPaymentExpenses'],['receipts','fixedPaymentState'],
      ['bank-ack-read','obAckLoad'],['bank-ack-save','obAckSave'],
      ['update','_mcCheckOtaUpdates'],['update','_mcCheckApkUpdate'],['render-app','App'],
      ['render-inicio','Dashboard'],['render-gastos','Expenses'],['render-plan','PlanTab'],['render-cartera','CarteraTab']];
    for(const [kind,name]of methods){if(typeof window[name]!=='function')continue;
      const real=window[name];originals[name]=real;window[name]=function(...args){return p.measureSync(kind,()=>real.apply(this,args));};}
    for(const name of ['pullExpenses','pullState','bankSync','bankSyncHistory']){
      if(typeof cloud[name]!=='function')continue;const real=cloud[name];originals['cloud.'+name]=real;
      cloud[name]=function(...args){const start=performance.now();const work=p.measureSync(name,()=>real.apply(this,args));
        // Observar no sustituye la promesa que recibe el llamador ni guarda sus filas.
        if(work&&typeof work.then==='function')work.then(()=>done(false),()=>done(true));
        function done(failed){if(p.active)p.events.push({kind:name+'-async',source:'unmapped',start,duration:performance.now()-start,async:true,failed});}
        return work;};
    }
    p.restoreCauses=function(){for(const [name,fn]of Object.entries(originals)){if(name.startsWith('cloud.'))cloud[name.slice(6)]=fn;else window[name]=fn;}};
  };
  const begin=p.begin;
  p.begin=function(){p.longtasks=[];begin();};
  p.finishWindow=function(){
    for(const e of observer.takeRecords())if(e.startTime+e.duration>p.elapsedStart)p.longtasks.push({start:e.startTime,duration:e.duration});
    const end=performance.now(),metric=p.end();
    const longtasks=p.longtasks.filter(e=>e.start<end&&e.start+e.duration>p.elapsedStart)
      .map(e=>({start:Math.max(e.start,p.elapsedStart),duration:Math.min(end,e.start+e.duration)-Math.max(e.start,p.elapsedStart)}));
    return {...metric,start:p.elapsedStart,end,longtasks,calendar:Date.now()};
  };
  p.armWindow=function(ms){p.begin();p.windowDone=new Promise(resolve=>{p.defer(()=>{p.windowResult=p.finishWindow();resolve(p.windowResult);},ms);});};
  let splashObserver;
  if(startup){
    let seen=false;
    p.startupStarted=new Promise(resolve=>{
      splashObserver=new MutationObserver(()=>{
        if(document.getElementById('mc-load')){seen=true;return;}
        if(!seen)return;
        splashObserver.disconnect();p.observers.delete(splashObserver);
        p.armWindow(5000);p.splashRemoved=p.elapsedStart;
        if(startup.tab!=='inicio'){
          const button=document.querySelector('.botnav-tab[data-tour="'+startup.tab+'"]');
          if(!button)throw new Error('Pestaña de arranque ausente');button.click();
        }
        resolve(p.elapsedStart);
      });
      p.observers.add(splashObserver);splashObserver.observe(document,{childList:true,subtree:true});
    });
  }
  p.restoreForeground=function(){observer.disconnect();JSON.stringify=stringify;window.Date=Native;p.begin=begin;};
}

export function instrumentaTotales(html,main){
  const start='const totals=useMemo(()=>{',end='state.trRewardsTotal,state.fx,state.fxRates,calendarDay]);';
  if(html.split(start).length!==2||html.split(end).length!==2)throw new Error('Ancla de totales ausente/ambigua');
  const first=html.indexOf(start),last=html.indexOf(end,first),deps=html.lastIndexOf('},[',last);
  if(deps<first)throw new Error('Dependencias de totales ausentes');
  const line=main.slice(0,main.indexOf(start)).split(/\r?\n/).length;
  const head=html.slice(0,first)+html.slice(first,deps).replace(start,"const totals=useMemo(()=>window.__lagBanco.measureSync('totals',()=>{");
  return head+html.slice(deps).replace('},[',"},'src/modules/11-app-main.js:"+line+"'),[");
}

export function instrumentaArranque(html){
  const anchor="ReactDOM.createRoot(document.getElementById('root')).render(";
  if(html.split(anchor).length!==2)throw new Error('Ancla de arranque ausente/ambigua');
  return html.replace(anchor,'window.__lagBanco.installCauses();'+anchor);
}

// Un gesto rechazado no acorta los5/15s pactados; sin ventana iniciada no inventar métricas.
export async function ventanaCruda(page){
  return page.evaluate(async()=>{const p=window.__lagBanco;return p.windowDone?await p.windowDone:null;});
}

// Intersección de longtasks con tramos medidos; no sumar tiempos anidados como trabajo exclusivo.
export function bloqueoPorCausa(tasks,events){
  const totals={};
  for(const task of tasks){
    const cuts=new Set([task.start,task.start+task.duration]);
    const sync=events.filter(e=>!e.async&&e.start<task.start+task.duration&&e.start+e.duration>task.start);
    for(const e of sync){cuts.add(Math.max(task.start,e.start));cuts.add(Math.min(task.start+task.duration,e.start+e.duration));}
    const sorted=[...cuts].sort((a,b)=>a-b);
    for(let i=1;i<sorted.length;i++){const a=sorted[i-1],b=sorted[i],mid=(a+b)/2;
      const covering=sync.filter(e=>mid>=e.start&&mid<e.start+e.duration).sort((x,y)=>(y.depth||0)-(x.depth||0));
      const kind=covering[0]?.kind||'unattributed';totals[kind]=(totals[kind]||0)+b-a;
    }
  }
  return totals;
}
