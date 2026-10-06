// Guion propuesto: no se pudo ejecutar la captura por bloqueo del navegador.
// Usa únicamente fixtures inventados y sirve el public/ del checkout elegido.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Se comprueba tanto el nombre normalizado como el destino canónico del archivo.
function contained(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}
export function resolvePublicFile(publicRoot, requestTarget) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestTarget.split('?')[0]);
    if (!pathname.startsWith('/') || pathname.includes('\0')) return { status: 400 };
  } catch { return { status: 400 }; }
  const root = fs.realpathSync(publicRoot);
  const candidate = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!contained(root, candidate)) return { status: 403 };
  try {
    const canonical = fs.realpathSync(candidate);
    if (!contained(root, canonical)) return { status: 403 };
    if (!fs.statSync(canonical).isFile()) return { status: 404 };
    return { status: 200, file: canonical };
  } catch (error) { return { status: error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 403 }; }
}
export function exactOrigin(candidate, origin) {
  try { return new URL(candidate).origin === new URL(origin).origin; }
  catch { return false; }
}
export function auditPhases(frames) {
  const issues = [];
  const phase = name => frames.filter(frame => frame.phase === name);
  for (const name of ['hide', 'reveal', 'cancel']) {
    const touch = phase(name + '-touch'), settle = phase(name + '-settle');
    if (!touch.some(frame => frame.touchActive && frame.host)) issues.push(name + ': sin frames del dedo sobre el host');
    if (!settle.length || settle.some(frame => frame.touchActive)) issues.push(name + ': espera final ausente o dedo todavía marcado');
    const scrolling = touch.filter(frame => frame.host);
    if (scrolling.length < 2) issues.push(name + ': sin delta de scroll medible');
    else if (name === 'reveal' ? scrolling.at(-1).scroll >= scrolling[0].scroll : scrolling.at(-1).scroll <= scrolling[0].scroll)
      issues.push(name + ': el scroll no siguió la dirección requerida');
    if (settle.length && settle.at(-1).hidden !== (name !== 'reveal')) issues.push(name + ': estado final incorrecto');
  }
  return issues;
}
async function main() {
 const { chromium } = await import('@playwright/test');
 const { seedLoggedInDashboard, dismissNews } = await import('../../e2e/fixtures.mjs');
const repo=process.cwd();
const blob=execFileSync('git',['rev-parse','HEAD:src/shell.html'],{cwd:repo,encoding:'utf8'}).trim();
if(blob!=='26e2795fefcd99c5075daa1624c62a0f6c5595af')throw new Error('El shell no coincide con la fuente auditada; revisar antes de medir.');
const root=path.join(repo,'public');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'aely-fab-synthetic-evidence-'));
const capture=process.env.AELY_AUDIT_CAPTURE==='1';
const server=http.createServer((req,res)=>{
 const target=resolvePublicFile(root,req.url);
 if(target.status!==200){res.writeHead(target.status).end();return;}
 try {
  const data=fs.readFileSync(target.file);
  const type={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'}[path.extname(target.file)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type});res.end(data);
 } catch {res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let browser;const summaries=[];
try{
 browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{}),headless:true});
for(const config of [{name:'green-normal-safe0',theme:'green',safe:0,width:393,reduce:false},{name:'cyber-normal-safe34',theme:'cyber',safe:34,width:320,reduce:false},{name:'green-ui-reduced-safe34',theme:'green',safe:34,width:430,reduce:true,osReduce:false},{name:'green-os-reduced-safe34',theme:'green',safe:34,width:430,reduce:false,osReduce:true}]){
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:config.width,height:812},hasTouch:true,isMobile:true,deviceScaleFactor:1,timezoneId:'UTC',reducedMotion:config.osReduce?'reduce':'no-preference'});
 const page=await context.newPage();await page.route('**/*',route=>exactOrigin(route.request().url(),url)?route.continue():route.abort());
 await seedLoggedInDashboard(page,{settings:{autoPrices:false,theme:config.theme,reduceMotion:config.reduce}});
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('.botnav')&&!document.getElementById('mc-load'));await dismissNews(page);
 await page.addStyleTag({content:':root{--safe-bottom:'+config.safe+'px!important;}'});
 await page.evaluate(()=>{const host=document.querySelector('.page.page-live');const spacer=document.createElement('div');spacer.style.height='2000px';spacer.dataset.syntheticAudit='true';host.appendChild(spacer);window.__fabFrames=[];window.__fabPhase='initial';window.__fabTouchActive=false;window.__fabObservedTouchActive=false;window.__fabWait='initial-wait';window.__fabEvents=[];window.__fabStop=false;for(const type of ['touchstart','touchend','touchcancel'])document.addEventListener(type,()=>{window.__fabObservedTouchActive=type==='touchstart';window.__fabEvents.push({type,t:performance.now(),phase:window.__fabPhase});},{capture:true,passive:true});function record(){const n=document.querySelector('.botnav'),f=document.querySelector('.botnav-fab'),shell=document.querySelector('.app-shell'),h=document.querySelector('.page.page-scroll-host');if(n&&f){const nr=n.getBoundingClientRect(),fr=f.getBoundingClientRect(),cs=getComputedStyle(n),fc=getComputedStyle(f);window.__fabFrames.push({t:performance.now(),phase:window.__fabPhase,touchActive:window.__fabTouchActive,observedTouchActive:window.__fabObservedTouchActive,wait:window.__fabWait,hidden:n.classList.contains('botnav-hidden'),host:!!h,shellHost:shell.classList.contains('scroll-host-on'),scroll:h?h.scrollTop:0,scrollMax:h?h.scrollHeight-h.clientHeight:0,navTop:nr.top,navBottom:nr.bottom,navHeight:nr.height,fabTop:fr.top,fabBottom:fr.bottom,fabHeight:fr.height,overflow:cs.overflow,transform:cs.transform,bottom:cs.bottom,maxHeight:cs.maxHeight,opacity:fc.opacity,transition:cs.transitionDuration,clipTop:cs.overflow==='hidden'?Math.min(fr.height,Math.max(0,nr.top-fr.top)):0,clipBottom:cs.overflow==='hidden'?Math.min(fr.height,Math.max(0,fr.bottom-nr.bottom)):0,rectangularVisibleHeight:cs.overflow==='hidden'?Math.max(0,Math.min(fr.bottom,nr.bottom)-Math.max(fr.top,nr.top)):fr.height,viewport:innerHeight});}if(!window.__fabStop)requestAnimationFrame(record);}requestAnimationFrame(record);});
 await page.waitForTimeout(1100);const cdp=await context.newCDPSession(page);const x=Math.round(config.width/2);
 const mark=(phase,touchActive,wait)=>page.evaluate(v=>{window.__fabPhase=v.phase;window.__fabTouchActive=v.touchActive;window.__fabWait=v.wait;},{phase,touchActive,wait});
 await mark('hide-touch',false,'dispatch-start');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:600}]});await mark('hide-touch',true,'move-wait');
 for(let i=1;i<=16;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:600-i*16}]});await page.waitForTimeout(16);if(capture&&i===5){await mark('hide-touch',true,'capture-wait');await page.screenshot({path:path.join(out,config.name+'-hide.png')});await mark('hide-touch',true,'move-wait');}}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mark('hide-settle',false,'settle-wait');await page.waitForTimeout(650);
 await mark('reveal-touch',false,'dispatch-start');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:240}]});await mark('reveal-touch',true,'move-wait');
 for(let i=1;i<=14;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:240+i*16}]});await page.waitForTimeout(16);if(capture&&i===5){await mark('reveal-touch',true,'capture-wait');await page.screenshot({path:path.join(out,config.name+'-reveal.png')});await mark('reveal-touch',true,'move-wait');}}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mark('reveal-settle',false,'settle-wait');await page.waitForTimeout(1100);
 await mark('cancel-touch',false,'dispatch-start');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:600}]});await mark('cancel-touch',true,'move-wait');
 for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:600-i*16}]});await page.waitForTimeout(16);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await mark('cancel-settle',false,'settle-wait');await page.waitForTimeout(700);
 await page.evaluate(()=>window.__fabStop=true);const frames=await page.evaluate(()=>window.__fabFrames);const events=await page.evaluate(()=>window.__fabEvents);fs.writeFileSync(path.join(out,config.name+'.json'),JSON.stringify(frames));
 const phaseIssues=auditPhases(frames);
 const phaseSummary=phase=>{const f=frames.filter(v=>v.phase===phase);const partial=f.filter(v=>v.host&&v.overflow==='hidden'&&v.navHeight>2&&v.navHeight<73+config.safe-1&&v.clipTop>1);return{frames:f.length,partialRectangularClipFrames:partial.length,touchActiveFrames:f.filter(v=>v.touchActive).length,observedTouchActiveFrames:f.filter(v=>v.observedTouchActive).length,waitKinds:[...new Set(f.map(v=>v.wait))],maxRectangularClipTop:Math.max(0,...f.map(v=>v.clipTop)),maxRectangularClipBottom:Math.max(0,...f.map(v=>v.clipBottom)),scrollMin:Math.min(...f.map(v=>v.scroll)),scrollMax:Math.max(...f.map(v=>v.scroll)),hiddenFirst:f[0]?.hidden,hiddenLast:f.at(-1)?.hidden,transformValues:[...new Set(f.filter(v=>v.host).map(v=>v.transform))],navOverflowBelowViewport:Math.max(0,...f.map(v=>v.navBottom-v.viewport)),firstPartial:partial[0]||null};};
 if(!frames.some(v=>v.host&&v.scroll>40))phaseIssues.push('El dedo no movió el host más de40px.');
 const summary={sourceBlob:blob,config,captureEnabled:capture,timingContaminated:capture,phaseIssues,validProtocol:phaseIssues.length===0,geometry:'rectangular intersection only; circular contour unmeasured',cancelScope:'synthetic cancellation, not Android edge/stretch',events,browser:browser.version(),timezone:'UTC',phases:Object.fromEntries(['initial','hide-touch','hide-settle','reveal-touch','reveal-settle','cancel-touch','cancel-settle'].map(p=>[p,phaseSummary(p)]))};summaries.push(summary);console.log(JSON.stringify(summary));await context.close();if(phaseIssues.length)throw new Error('Protocolo inválido; no interpretar el recorte: '+phaseIssues.join('; '));
}
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summaries,null,2));console.log('Evidencia sintética local: '+out);}

}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
