import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

export const startupBase='3625fa7ed5134cfbc5e364adc4f588bfdaf670c0';
export const lagReference='05704393b6e776659417bfffbd2df9f28ed7ffd0';
export const hash=value=>createHash('sha256').update(value).digest('hex');

// El ensamblador oficial lee las fuentes originales; no invertimos el parche para
// fabricar un «antes». Git sólo presta su almacén de objetos a las notas históricas.
export function baselineHTML(){
  const temporaryRoot=fs.realpathSync(os.tmpdir());
  const directory=fs.mkdtempSync(path.join(temporaryRoot,'aely-startup-base-'));
  const archive=path.join(directory,'source.tar'),source=path.join(directory,'source');
  try{
    fs.mkdirSync(source);
    execFileSync('git',['archive','--format=tar','-o',archive,startupBase],{stdio:'pipe'});
    execFileSync('tar',['-xf',archive,'-C',source],{stdio:'pipe'});
    const gitDir=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
    execFileSync(process.execPath,[path.join(source,'scripts/build-app.mjs')],{cwd:source,
      env:{...process.env,GIT_DIR:gitDir,GIT_WORK_TREE:source,SENTRY_DSN:''},stdio:'pipe',timeout:60000});
    return fs.readFileSync(path.join(source,'public/index.html'),'utf8');
  }finally{
    const real=fs.realpathSync(directory);
    if(path.dirname(real)!==temporaryRoot||!path.basename(real).startsWith('aely-startup-base-'))throw Error('baseline cleanup outside own temporary directory');
    fs.rmSync(real,{recursive:true,force:true});
  }
}

// Misma ventana por retirada real del nodo y mismo delta RAF/>32ms que PR219.
// Se omiten sus sondas de listeners/timers/serialización para no gravar el arranque.
export function installStartupProbe({windowMs=3000}){
  const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
  const p=window.__startupProbe={loadedAt:performance.now(),frames:[],calls:[],stage:'splash',bankCalls:0,
    windowMs,done:null,start:null,end:null,firstAmount:null,firstExpenseCount:null,liveTabs:null};
  let previous=null,rafId=null,observer,resolveDone;
  p.done=new Promise(resolve=>{resolveDone=resolve;});
  function frame(t){
    if(p.start!==null&&previous!==null&&t>previous)p.frames.push({at:t-p.start,delta:t-previous});
    previous=p.start===null?null:t;
    if(p.start!==null&&t-p.start>=windowMs){p.end=t;p.stage='finished';resolveDone(p);return;}
    rafId=raf(frame);
  }
  rafId=raf(frame);
  p.installCauses=function(){
    for(const name of ['netWorthSeries','Dashboard','Expenses']){
      const real=window[name];if(typeof real!=='function')throw Error('startup function absent '+name);
      function measured(...args){
        const from=performance.now();
        if(name==='Dashboard'){p.latestCount=args[0].state.expenses.length;p.latestNetWorth=args[0].totals.netWorth;}
        try{return real.apply(this,args);}finally{p.calls.push({name,at:from-p.loadedAt,duration:performance.now()-from,afterSplash:p.start!==null});}
      }
      Object.assign(measured,real);window[name]=measured;
    }
    for(const name of ['bankSync','bankSyncHistory']){
      const real=cloud[name];if(typeof real!=='function')continue;
      cloud[name]=function(...args){p.bankCalls++;return real.apply(this,args);};
    }
  };
  let seen=false;
  observer=new MutationObserver(()=>{
    if(document.getElementById('mc-load')){seen=true;return;}
    if(!seen||p.start!==null)return;
    observer.disconnect();p.start=performance.now();previous=p.start;p.stage='measuring';
    p.firstAmount=document.querySelector('[data-testid="inicio-net-current"] .v4-hero-amt')?.textContent||null;
    p.firstExpenseCount=p.latestCount;p.firstNetWorth=p.latestNetWorth;
    p.liveTabs=document.querySelectorAll('.track>.page-live').length;
    p.bootReady=window.__mcBootReady===true;p.timedOut=window.__mcSplashTimedOut===true;
  });
  observer.observe(document,{childList:true,subtree:true});
  p.restore=function(){cancel(rafId);observer.disconnect();};
}

// Adaptación literal de instrumentaArranque(PR219): sólo cambia el nombre de la sonda.
export function instrumentStartup(html,{withoutCloud=false}={}){
  const anchor="ReactDOM.createRoot(document.getElementById('root')).render(";
  if(html.split(anchor).length!==2)throw Error('startup anchor absent/ambiguous');
  let out=html.replace(anchor,'window.__startupProbe.installCauses();'+anchor);
  if(withoutCloud){
    const pattern=/SUPABASE_URL:\s*"[^"]*"/g;
    if([...out.matchAll(pattern)].length!==1)throw Error('cloud config ambiguous');
    out=out.replace(pattern,'SUPABASE_URL: ""');
  }
  return out;
}

export function startupSummary(p){
  if(p.start===null||p.end===null)throw Error('startup window incomplete');
  const elapsed=p.end-p.start,valid=p.frames.filter(f=>Number.isFinite(f.delta)&&f.delta>0);
  if(elapsed<3000||!valid.length)throw Error('startup physical window missing');
  return {splashMs:p.start-p.loadedAt,elapsedMs:elapsed,frames:valid.length,
    slowFrames:valid.filter(f=>f.delta>32).length,maxFrame:Math.max(...valid.map(f=>f.delta)),
    seriesCalls:p.calls.filter(c=>c.name==='netWorthSeries').length,
    seriesAfterSplash:p.calls.filter(c=>c.name==='netWorthSeries'&&c.afterSplash).length,
    expensesAfterSplash:p.calls.filter(c=>c.name==='Expenses'&&c.afterSplash).length,
    bankCalls:p.bankCalls,liveTabs:p.liveTabs,bootReady:p.bootReady,timedOut:p.timedOut};
}
