import {readFileSync} from 'node:fs';

const prior=readFileSync(new URL('./rendimiento-sostenido.spec.mjs',import.meta.url),'utf8');
function existing(name){
  const match=prior.match(new RegExp('^(?:async )?function '+name+'\\([^]*?^}', 'm'));
  if(!match)throw new Error('Recorrido anterior sin '+name);
  return match[0];
}
// Reutiliza las acciones publicadas, sin importar el spec y registrar sus tests otra vez.
// Su lifecycle antiguo toma heap dentro de la ventana; éste observa sólo contadores pequeños.
const cycleSource=existing('cycle').replace('const states=await lifecycle(page,cdp);','const states=await lifecycle(page);')
  .replace('await page.evaluate(()=>{document.querySelector(".page-scroll-host").scrollTop=0;});','')
  .replace('await delay(1200);','await bankReport(page);')
  .replace('if(tab==="gastos"){','if(tab==="gastos"){\n      await filters(page);')
  .replace('const states=await lifecycle(page);','await click(page,\'.botnav-fab\');await apunta(page);\n  const states=await lifecycle(page);');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const make=new Function('delay','scroll','markAction','lifecycle','bankReport','filters','apunta',existing('fixture')+'\n'+existing('click')+'\n'+cycleSource+'\nreturn {fixture,cycle};');
async function markAction(page,name){await page.evaluate(name=>{window.__lagBanco.actionName=name;},name);}

export function planScroll(context,down){
  if(context.error)throw new Error(context.error);
  const room=down?context.max-context.top:context.top;
  if(!Number.isFinite(room)||room<120)throw new Error('scroll-insufficient-room');
  if(!context.point)throw new Error('scroll-target-not-visible');
  return {...context.point,travel:Math.min(96,Math.floor(room/3)),steps:6,stepMs:16,room,down};
}

export function contextoScroll(down){
  const p=window.__lagBanco;
  return p.measureSync('harness-scroll-context',()=>{
    const tabs=[...document.querySelectorAll('.botnav-tab')],active=tabs.findIndex(b=>b.classList.contains('active'));
    const page=document.querySelectorAll('.track > .page')[active];
    if(!page)return {error:'scroll-active-page-missing',active};
    const rect=page.getBoundingClientRect(),max=Math.max(0,page.scrollHeight-page.clientHeight);
    const out={active,tab:tabs[active].dataset.tour,top:page.scrollTop,max,height:page.clientHeight,scrollHeight:page.scrollHeight,
      rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom},host:page.classList.contains('page-scroll-host'),
      touchAction:getComputedStyle(page).touchAction,overlay:document.documentElement.classList.contains('sheet-open'),point:null};
    if(out.overlay)return {...out,error:'scroll-overlay-open'};
    const left=Math.max(rect.left+60,60),right=Math.min(rect.right-60,window.innerWidth-60);
    const top=Math.max(rect.top+120,120),bottom=Math.min(rect.bottom-130,window.innerHeight-130);
    for(const fy of (down?[.8,.6,.4]:[.2,.4,.6]))for(const fx of [.5,.3,.7]){
      const x=Math.round(left+(right-left)*fx),y=Math.round(top+(bottom-top)*fy),el=document.elementFromPoint(x,y);
      if(!el||!page.contains(el)||el.closest('[data-noswipe],button,a,[role="button"],input,textarea,select,canvas,.botnav'))continue;
      let horizontal=false;
      for(let n=el;n&&n!==page;n=n.parentElement){const css=getComputedStyle(n);
        if(n.scrollWidth>n.clientWidth+4&&/^(auto|scroll)$/.test(css.overflowX)){horizontal=true;break;}}
      if(horizontal)continue;
      out.point={x,y,target:el.tagName,classes:String(el.className||'').slice(0,100)};break;
    }
    p.scrollTarget=new WeakRef(page);return out;
  },'e2e/lag-banco-recorrido.mjs');
}

// Los dos comandos salen antes de esperar: no meter un viaje Node entre lectura y touchEnd.
export async function liberaDedo(cdp){
  const read=cdp.send('Runtime.evaluate',{expression:"(()=>{const p=window.__lagBanco,h=p.scrollTarget?.deref();p.physicalRelease={top:h?h.scrollTop:null,at:performance.now()};})()"});
  const end=cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const [result]=await Promise.all([read,end]);
  if(result?.exceptionDetails)throw new Error('scroll-release-evaluation-failed');
}

export function validaScroll(record){
  if(!record.after?.connected)throw new Error('scroll-page-detached');
  if(!Number.isFinite(record.release?.top)||!Number.isFinite(record.after?.top))throw new Error('scroll-release-unavailable');
  const sign=record.down?1:-1,delta=sign*(record.after.top-record.before.top),inertia=sign*(record.after.top-record.release.top);
  if(delta<20)throw new Error('scroll-no-land');
  if(inertia<=1||record.down&&!record.after.hidden)throw new Error('scroll-without-inertia');
  return {delta,inertia};
}

export async function scroll(page,cdp,down){
  const record={action:down?'scroll-down':'scroll-up',down,valid:false};
  try{
    record.before=await page.evaluate(contextoScroll,down);record.plan=planScroll(record.before,down);
    const {x,y,travel,steps,stepMs}=record.plan;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=steps;i++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(down?-1:1)*i*travel/steps}]});await delay(stepMs);
    }
    await liberaDedo(cdp);await delay(500);
    const after=await page.evaluate(()=>{const p=window.__lagBanco,h=p.scrollTarget?.deref();return {release:p.physicalRelease,
      after:{top:h?h.scrollTop:null,connected:!!h?.isConnected,hidden:!!document.querySelector('.botnav')?.classList.contains('botnav-hidden')}};});
    Object.assign(record,after);Object.assign(record,validaScroll(record));record.valid=true;
  }catch(error){record.failure={code:error.message};error.scrollRecord=record;throw error;}
  finally{await page.evaluate(record=>{const p=window.__lagBanco;(p.landings||(p.landings=[])).push(record);p.scrollTarget=null;},record).catch(()=>{});}
}

async function lifecycle(page){
  const change=async state=>{
    await page.evaluate(state=>{window.__lagBanco.visibility=state;document.dispatchEvent(new Event('visibilitychange'));},state);
    await delay(state==='visible'?1500:250);
  };
  const before=await page.evaluate(()=>({pull:window.__lagBanco.transport.pullExpenses?.succeeded||0,
    bank:window.__lagBanco.bankSync,writes:window.__lagBanco.expensesWrites}));
  await change('hidden');await change('visible');
  // Veinte páginas con retardo real del doble tardan más que una pausa fija. Esperar su
  // promesa acredita el final sin polling DOM ni cambiar el timeout/oráculo del test.
  await page.evaluate(async()=>{if(window.__lagBanco.lastPull)await window.__lagBanco.lastPull;});
  const after=await page.evaluate(()=>({pull:window.__lagBanco.transport.pullExpenses?.succeeded||0,
    bank:window.__lagBanco.bankSync,writes:window.__lagBanco.expensesWrites,
    visible:document.visibilityState==='visible'&&!document.hidden}));
  if(!after.visible||after.pull<=before.pull)throw new Error('foreground-no-pull');
  if(after.bank!==before.bank)throw new Error('automatic-bank-sync');
  if(after.writes!==before.writes)throw new Error('unchanged-history-write');
  return {visible:after.visible,pullDelta:after.pull-before.pull,automaticBankDelta:after.bank-before.bank,
    historyWritesDelta:after.writes-before.writes};
}
async function bankReport(page){
  await page.evaluate(()=>new Promise(resolve=>{
    const p=window.__lagBanco;
    const ready=()=>{if(document.querySelector('.sync-report')){observer.disconnect();p.observers.delete(observer);resolve();}};
    const observer=new MutationObserver(ready);p.observers.add(observer);
    observer.observe(document.body,{childList:true,subtree:true});ready();
  }));
}
async function filters(page){
  await markAction(page,'expense-filter');
  await page.evaluate(()=>{const button=[...document.querySelectorAll('button.v4-chip')].find(b=>b.textContent.includes('🎛️'));if(!button)throw new Error('filters-missing');button.click();});await delay(500);
  for(const label of [/Todos los bancos|All banks|Tots els bancs/i,/Listo|Done|Fet/i]){
    await page.evaluate(pattern=>{const button=[...document.querySelectorAll('button')].find(b=>new RegExp(pattern,'i').test(b.textContent));if(!button)throw new Error('filters-choice-missing');button.click();},label.source);await delay(500);
  }
}
async function apunta(page){
  await markAction(page,'apuntar-save');
  for(const digit of ['2','3']){
    await page.evaluate(digit=>{const key=[...document.querySelectorAll('.v4-keys button')].find(b=>b.textContent.trim()===digit);if(!key)throw new Error('apuntar-key-missing');key.click();},digit);await delay(100);
  }
  const amount=await page.evaluate(()=>{const button=document.querySelector('.v4-exp-sheet .v4-cta');if(!button)throw new Error('apuntar-cta-missing');const text=button.textContent;button.click();return text;});
  if(!amount.includes('23'))throw new Error('apuntar-amount-mismatch');await delay(850);
  if(await page.evaluate(()=>!!document.querySelector('.v4-exp-sheet')))throw new Error('apuntar-not-saved');
}
const base=make(delay,scroll,markAction,lifecycle,bankReport,filters,apunta);
export const syntheticAck='2026-09-25T23:59:59.999Z|enlace-sintetico';
export const recorrido={cycle:base.cycle,fixture:function(n){
  const f=base.fixture(n);
  // La119 guarda el acuse después de sus filas; omitirlo mediría el contrato anterior.
  f.__cloudFns['bank-sync'].data.links[0].ack=syntheticAck;
  // Dos grupos reales de recibos dan recorrido a Inicio; ningún relleno CSS fabrica scroll.
  f.fixed=Array.from({length:6},(_,i)=>({id:'lag-fixed-'+i,name:'Recibo sintético '+i,amount:12+i,freq:'m',day:i<3?10:28,account:'sabadell'}));
  return f;
}};
export async function preparaTransporte(page){
  await page.evaluate(()=>{
    const p=window.__lagBanco;
    const originals={};
    // No modifica consultas ni copia datos: observa la closure real con el cliente doble.
    for(const name of ['pullExpenses','bankSync']){
      const real=cloud[name];originals[name]=real;cloud[name]=function(...args){
        const work=(async()=>{
          const t=p.transport[name]||(p.transport[name]={started:0,succeeded:0,failed:0});
          t.started++;if(name==='bankSync'){p.bankSync++;p.lastBankRequest={recoverGaps:args[0]?.recoverGaps,acks:args[0]?.acks};}
          try{const result=await real.apply(this,args);t.succeeded++;return result;}
          catch(error){t.failed++;throw error;}
        })();
        if(name==='pullExpenses')p.lastPull=work.then(()=>{},()=>{});
        return work;
      };
    }
    p.restoreTransport=function(){for(const [name,fn]of Object.entries(originals))cloud[name]=fn;};
    window.__lag=p;
  });
}
