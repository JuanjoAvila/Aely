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
  .replace('await delay(1200);','await bankReport(page);');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const make=new Function('delay','scroll','markAction','lifecycle','bankReport',existing('fixture')+'\n'+existing('click')+'\n'+cycleSource+'\nreturn {fixture,cycle};');
async function markAction(page,name){await page.evaluate(name=>{window.__lagBanco.actionName=name;},name);}

async function scroll(page,cdp,down){
  const before=await page.evaluate(()=>document.querySelector('.page-scroll-host').scrollTop);
  const y=down?600:230;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:187,y}]});
  for(let i=1;i<=14;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:187,y:y+(down?-1:1)*i*22}]});
    await delay(16);
  }
  const fingerEnd=await page.evaluate(()=>document.querySelector('.page-scroll-host').scrollTop);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(500);
  const after=await page.evaluate(()=>({top:document.querySelector('.page-scroll-host').scrollTop,
    hidden:document.querySelector('.botnav').classList.contains('botnav-hidden')}));
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
export const recorrido=make(delay,scroll,markAction,lifecycle,bankReport);
export async function preparaTransporte(page){
  await page.evaluate(()=>{
    const p=window.__lagBanco;
    const originals={};
    // No modifica consultas ni copia datos: observa la closure real con el cliente doble.
    for(const name of ['pullExpenses','bankSync']){
      const real=cloud[name];originals[name]=real;cloud[name]=function(...args){
        const work=(async()=>{
          const t=p.transport[name]||(p.transport[name]={started:0,succeeded:0,failed:0});
          t.started++;if(name==='bankSync')p.bankSync++;
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
