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
  .replace('await delay(1200);','await bankReport(page);')
  .replace('if(tab==="gastos"){','if(tab==="gastos"){\n      await filters(page);')
  .replace('const states=await lifecycle(page);','await click(page,\'.botnav-fab\');await apunta(page);\n  const states=await lifecycle(page);');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const make=new Function('delay','scroll','markAction','lifecycle','bankReport','filters','apunta',existing('fixture')+'\n'+existing('click')+'\n'+cycleSource+'\nreturn {fixture,cycle};');
async function markAction(page,name){await page.evaluate(name=>{window.__lagBanco.actionName=name;},name);}

export async function scroll(page,cdp,down){
  const before=await page.evaluate(()=>{
    const host=document.querySelector('.page-scroll-host');
    document.addEventListener('touchend',()=>{window.__lagBanco.fingerEnd=host.scrollTop;},{once:true,capture:true});
    return host.scrollTop;
  });
  const y=down?600:230;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:187,y}]});
  for(let i=1;i<=14;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:187,y:y+(down?-1:1)*i*22}]});
    await delay(16);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(500);
  const after=await page.evaluate(()=>({top:document.querySelector('.page-scroll-host').scrollTop,
    fingerEnd:window.__lagBanco.fingerEnd,hidden:document.querySelector('.botnav').classList.contains('botnav-hidden')}));
  const fingerEnd=after.fingerEnd;
  if(down&&after.top<before+20||!down&&after.top>before-20)throw new Error('scroll-no-land');
  const inertia=Math.abs(after.top-fingerEnd);
  await windowlessRecord(page,{action:down?'scroll-down':'scroll-up',before,fingerEnd,after:after.top,inertia,hidden:after.hidden});
  if(down&&(!after.hidden||inertia<=1))throw new Error('scroll-without-inertia');
}
async function windowlessRecord(page,record){await page.evaluate(record=>window.__lagBanco.landings.push(record),record);}

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
