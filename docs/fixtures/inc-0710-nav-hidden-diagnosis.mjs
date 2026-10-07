// Contratos de fuente y modelo sintético: NO es layout/CSS/React de navegador.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.argv[2]||process.cwd(),base='067371705615e9cc58923509e3f60c3d0c9003ff';
const files=['src/modules/11-app-main.js','src/shell.html'];
execFileSync('git',['diff','--exit-code',base,'--',...files],{cwd:root});
const [source,css]=files.map(f=>fs.readFileSync(path.join(root,f),'utf8'));
const digest=s=>createHash('sha256').update(s).digest('hex');
const checks=[];
function check(label,fn){fn();checks.push(label);}
function classes(){const s=new Set();return {add(...ks){ks.forEach(k=>s.add(k));},remove(...ks){ks.forEach(k=>s.delete(k));},contains(k){return s.has(k);},toggle(k,v){if(v)s.add(k);else s.delete(k);}};}
const start=source.indexOf('  const [navHidden,setNavHidden]'),end=source.indexOf('  const applyNavHideRef=',start);
assert.ok(start>0&&end>start);
const fragment=source.slice(start,end);
function world(){
 const trace=[],timers=new Map();let clock=10000,next=0;
 const nav={classList:classes()},page={classList:classes(),scrollTop:0,scrollHeight:2000,clientHeight:600};
 const c={useState:()=>[false,v=>trace.push(v)],useRef:v=>({current:v}),document:{querySelector:()=>nav},
 Date:{now:()=>clock},setTimeout:(f,ms)=>{timers.set(++next,{f,ms});return next;},clearTimeout:id=>timers.delete(id),
 trackRef:{current:{children:[page]}},tab:0,tabIds:['inicio'],dragging:{current:false},gestureMode:{current:null}};
 vm.createContext(c);vm.runInContext(fragment+'\n globalThis.api={onPageScroll,applyNavHide,armNavHide,revealNav,pinNavVisible,flushNavHide,discardNavHideFlush,navHiddenRef,navFlush,fingerScrollDir,fingerScrollAt,bottomOverscroll};',c);
 return {c,nav,page,trace,timers,api:c.api,scroll(y,target=page){target.scrollTop=y;c.api.onPageScroll({currentTarget:target});},time(ms){clock+=ms;}};
}
check('normal scroll hides/reveals by class and mirrors state',()=>{const w=world();w.scroll(40);assert.ok(w.nav.classList.contains('botnav-hidden'));assert.equal(w.api.navHiddenRef.current,true);assert.deepEqual(w.trace,[true]);w.scroll(25);assert.ok(!w.nav.classList.contains('botnav-hidden'));assert.deepEqual(w.trace,[true,false]);});
check('finger movement defers React state; reversal before flush uses latest ref',()=>{const w=world();w.c.dragging.current=true;w.scroll(40);assert.deepEqual(w.trace,[]);assert.ok(w.api.navFlush.current);w.scroll(25);assert.deepEqual(w.trace,[]);w.api.flushNavHide();assert.deepEqual(w.trace,[false]);assert.equal(w.api.navFlush.current,false);});
check('terminal flush path is idempotent and edge discard retains class/ref',()=>{const w=world();w.c.dragging.current=true;w.scroll(40);w.api.flushNavHide();w.api.flushNavHide();assert.deepEqual(w.trace,[true]);w.api.navFlush.current=true;w.api.discardNavHideFlush();assert.equal(w.api.navFlush.current,false);assert.ok(w.nav.classList.contains('botnav-hidden'));assert.equal(w.api.navHiddenRef.current,true);});
check('inactive-page and tab swipe cannot alter nav',()=>{const w=world();w.scroll(40,{classList:classes(),scrollHeight:2000,clientHeight:600});assert.deepEqual(w.trace,[]);w.c.dragging.current=true;w.c.gestureMode.current='tab';w.scroll(40);assert.deepEqual(w.trace,[]);});
check('visible pin prevents hide until expiration',()=>{const w=world();w.api.pinNavVisible(320);w.scroll(40);assert.deepEqual(w.trace,[]);w.time(321);w.scroll(60);assert.deepEqual(w.trace,[true]);});
check('top reveal pins; tiny movement is ignored',()=>{const w=world();w.scroll(40);w.scroll(38);assert.deepEqual(w.trace,[true]);w.scroll(4);assert.deepEqual(w.trace,[true,false]);w.scroll(50);assert.deepEqual(w.trace,[true,false]);});
check('bottom bounce preserves hidden nav until opposing recent finger direction',()=>{const w=world();w.scroll(40);w.scroll(1400);w.scroll(1350);assert.deepEqual(w.trace,[true]);w.api.fingerScrollDir.current=-1;w.api.fingerScrollAt.current=10000;w.scroll(1300);assert.deepEqual(w.trace,[true,false]);});
const markerMatch=source.match(/className:"botnav-ind"\+\(([^\n]+?)\),ref:indRef/);assert.ok(markerMatch);
const marker=new Function('drawerOpen','profileOpen','navHidden','navHiddenRef','return "botnav-ind"+('+markerMatch[1]+');');
check('exact marker class ignores hidden state, while overlays hide it',()=>{assert.equal(marker(false,false,true,{current:true}),'botnav-ind');assert.equal(marker(false,false,false,{current:false}),'botnav-ind');assert.equal(marker(true,false,true,{current:true}),'botnav-ind hide');assert.equal(marker(false,true,true,{current:true}),'botnav-ind hide');});
const declarations=css.replace(/\/\*[\s\S]*?\*\//g,'');
function block(selector){const at=declarations.indexOf('\n  '+selector+'{');assert.ok(at>=0,selector);const begin=at+3+selector.length+1;return declarations.slice(begin,declarations.indexOf('}',begin));}
const hidden=block('.app-shell.scroll-host-on .botnav.botnav-hidden'),markerCSS=block('.botnav-ind'),cyber=block('html[data-theme="cyber"] .botnav::after'),host=block('.app-shell.scroll-host-on .botnav'),baseNav=block('.botnav'),nonHostHidden=block('.botnav.botnav-hidden');
const pixel=(s,k)=>Number(s.match(new RegExp('(?:^|[;\\s])'+k+':(-?[\\d.]+)px'))?.[1]);
const top=pixel(markerCSS,'top'),height=pixel(markerCSS,'height'),margin=pixel(hidden,'overflow-clip-margin');
check('declared collapsed geometry admits marker band inside clip margin',()=>{assert.ok(hidden.includes('max-height:0'));assert.ok(hidden.includes('overflow:clip'));assert.equal(top,-9);assert.equal(height,3);assert.equal(margin,30);assert.ok(top>=-margin&&top+height<0);});
check('selective virtual marker suppression preserves Cyberpunk pseudo rule',()=>{const virtual=marker(false,false,true,{current:true})+' hide';assert.ok(virtual.endsWith(' hide'));assert.ok(block('.botnav-ind.hide').includes('opacity:0'));assert.ok(cyber.includes('top:-1px'));assert.ok(cyber.includes('animation:cybercurrent'));assert.equal(digest(cyber),digest(block('html[data-theme="cyber"] .botnav::after')));});
check('source supplies normal host/nonhost transition and reduced-motion controls',()=>{assert.ok(host.includes('transition:max-height .55s'));assert.ok(host.includes('padding .55s'));assert.ok(baseNav.includes('transition:transform .55s'));assert.ok(nonHostHidden.includes('translateY(120%)'));assert.ok(css.includes('.app-shell.scroll-host-on .botnav:not(.botnav-hidden){transition:none;}'));assert.ok(css.includes('html.reduce-motion *'));assert.ok(host.includes('background:var(--bg-2)'));});
check('positive geometry control rejects a zero-margin clipping model',()=>{assert.ok(!(top>=0&&top+height<=0));});
console.log(JSON.stringify({schema:1,baseSHA:base,sourceHashes:Object.fromEntries(files.map((f,i)=>[f,digest(i?css:source)])),fragmentSHA256:digest(fragment),checks,exit:0,DOMExecuted:0,geometry:{markerTop:top,markerHeight:height,clipMargin:margin,collapsedBoxModelOnly:true},limits:['No browser CSS cascade/layout/transition sampling','No Android touch or human symptom reproduction','No runtime/financial/network changes','Reduced-motion intended immediate; normal smoothness not proven','Host topology switch changes animated properties; cause unknown']},null,2));
