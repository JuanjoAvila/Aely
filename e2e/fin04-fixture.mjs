// Dos clientes reales y SDK incluido; solo auth y transporte se simulan. Sin red externa.
import assert from "node:assert/strict";import crypto from "node:crypto";
export async function runFin04({browser,baseURL,scenario,onEvidence=()=>{}}){
const clone=x=>x===undefined?null:JSON.parse(JSON.stringify(x)),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const owner='11111111-1111-4111-8111-111111111111',partner='22222222-2222-4222-8222-222222222222',expenseId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',house='33333333-3333-4333-8333-333333333333';
const fixed={id:'fixed-fin04',name:'Servicio sintético',amount:42.37,freq:'mes',day:25,cat:'servicios',account:'sabadell'};
const debt={id:'debt-fin04',name:'Deuda sintética',value:1200.23,original:1200.23,monthly:100.11,amort:100.11,asOf:2026*12+9,day:25,account:'sabadell',ent:'familia'};
const base={fx:1,budget:500,monthStartNet:3000,accounts:[{id:'acc',name:'Cuenta sintética',ent:'sabadell',value:3000,role:'diario',spendFrom:true}],investments:[],assets:[],debts:[debt],fixed:[fixed],flows:[],oneoffs:[],aportaciones:[],goals:[],shared:[],expenses:[],history:[],catOverrides:{},obAccounts:[],obLabels:{},verNotes:[],settings:{autoPrices:false,theme:'green',lang:'es',reservaRules:[]},onboarded:true,tourSeen:true,setupHint:false,_dataVer:6,_savedAt:Date.now()-60000,lastBackup:Date.now(),trAnchor:'2026-10',reservaLog:[]};
const expense={id:expenseId,user_id:owner,fecha:new Date().toISOString(),importe:12.34,comercio:'Compra sintética',cat:'super',source:'manual:sabadell',no_card:false,nota:'Nota inicial',nota_edit:true};
const ids=[owner,owner];
const db={app_state:[...new Set(ids)].map(uid=>({user_id:uid,data:{...clone(base),_historyOwner:uid},updated_at:'2026-10-19T10:00:00.000Z'})),expenses:[clone(expense)],households:[{id:house,name:'Hogar sintético',created_by:owner}],household_members:[{household_id:house,user_id:owner,role:'owner'},{household_id:house,user_id:partner,role:'member'}],household_snapshots:[]};
if(scenario==='rename-unrelated')db.expenses.push({...clone(expense),id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',importe:-8.97,comercio:'Otro movimiento',cat:'ingreso',nota:'Intocable'});
if(scenario==='permanent-rename')db.expenses.push({...clone(expense),id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',importe:4.56,comercio:'Otra compra',cat:'ocio',nota:'Intocable'});
const evidence={scenario,baseSHA:'408d8d3484568e1c02fa25dcd2df30ad71477bf1',startedAt:new Date().toISOString(),workers:1,retries:0,CPU6Calls:0,profileCalls:0,traceCalls:0,initial:clone(db),requests:[],blockedExternal:[],pageErrors:[],snapshots:[],assertions:[],events:[]};
let seq=0,hold=null,held=[],contexts=[];const offline=new Set();
const rejectedNames=new Set(scenario==='permanent-rename'?['Nombre bloqueado']:scenario==='late-rename-failure'?['Primero']:[]);
function record(label,data){evidence.events.push({seq:++seq,label,data:clone(data),at:Date.now()});}
function check(name,actual,expected){let ok=true,error;try{assert.deepEqual(actual,expected);}catch(e){ok=false;error=e.message;}evidence.assertions.push({name,ok,actual:clone(actual),expected:clone(expected),error});if(!ok)throw Object.assign(new Error(name),{productFailure:true});return ok;}
function matches(row,params){for(const [k,v] of params){if(['select','order','limit','offset','on_conflict'].includes(k))continue;const ix=v.indexOf('.'),op=v.slice(0,ix),rhs=v.slice(ix+1),val=row[k];if(op==='eq'&&String(val)!==rhs)return false;if(op==='lt'&&!(val<rhs))return false;if(op==='gt'&&!(val>rhs))return false;if(op==='is'&&rhs==='null'&&val!=null)return false;if(op==='in'&&!rhs.slice(1,-1).split(',').map(x=>x.replaceAll('"','')).includes(String(val)))return false;if(!['eq','lt','gt','is','in'].includes(op))throw Error('Unsupported filter '+k+':'+v);}return true;}
function visible(table,row,uid,write){if(table==='households')return row.id===house;if(['household_members','household_snapshots'].includes(table)&&!write)return row.household_id===house;return !('user_id' in row)||row.user_id===uid;}
function processQuery(req,actor,uid){const u=new URL(req.url()),table=u.pathname.split('/').at(-1),method=req.method(),headers=req.headers(),prefer=headers.prefer||'',body=req.postDataJSON(),params=u.searchParams;
 const entry={seq:++seq,actor,uid,table,method,filters:[...params],prefer,body,at:Date.now()};let all=db[table]||(db[table]=[]),result=[],error=null;
 const selected=()=>all.filter(x=>visible(table,x,uid,method!=='GET')&&matches(x,params));
 if(method==='GET')result=clone(selected());
 else if(method==='PATCH'){result=selected();for(const row of result)Object.assign(row,clone(body));result=clone(result);}
 else if(method==='DELETE'){result=selected();db[table]=all.filter(x=>!result.includes(x));result=clone(result);}
 else if(method==='POST'){
  const items=Array.isArray(body)?body:[body],keys=(params.get('on_conflict')||(table==='app_state'?'user_id':'id')).split(',');
  for(const row of items){if(row.user_id&&row.user_id!==uid){error={code:'42501',message:'synthetic own-row RLS'};break;}
   const prior=all.find(x=>keys.every(k=>x[k]===row[k]));
   if(prior){if(prefer.includes('resolution=ignore-duplicates'))continue;Object.assign(prior,clone(row));result.push(clone(prior));}
   else if(row.id&&all.some(x=>x.id===row.id)){error={code:'23505',message:'synthetic primary key duplicate'};break;}
   else {const next=clone(row);if(table==='expenses'&&!next.id)next.id=crypto.randomUUID();all.push(next);result.push(clone(next));}
  }
 }else throw Error('Unsupported method '+method);
 if(method==='GET'){const order=params.get('order');if(order){const [k,d]=order.split('.');result.sort((a,b)=>(a[k]<b[k]?-1:a[k]>b[k]?1:0)*(d==='desc'?-1:1));}const limit=Number(params.get('limit')||result.length);result=result.slice(0,limit);}
 entry.affectedRows=result.length;entry.databaseAfter=method==='GET'?undefined:clone(db[table]);
 const cols=params.get('select');if(cols&&cols!=='*')result=result.map(x=>Object.fromEntries(cols.split(',').map(k=>[k,x[k]])));
 let status=method==='GET'?200:prefer.includes('return=representation')?200:204,data=method==='GET'||prefer.includes('return=representation')?result:null;
 if((headers.accept||'').includes('vnd.pgrst.object')){if(result.length===1){data=result[0];status=200;}else {error={code:'PGRST116',details:`The result contains ${result.length} rows`,message:'JSON object requested, multiple (or no) rows returned'};status=406;}}
 if(error){status=error.code==='23505'?409:error.code==='42501'?403:status;data=error;}
 entry.status=status;entry.response=clone(data);evidence.requests.push(entry);return {status,data};
}
async function execute(route,actor,uid){
 const req=route.request();if(req.method()==='PATCH'&&new URL(req.url()).pathname.endsWith('/expenses')&&rejectedNames.has(req.postDataJSON()?.comercio)){
  evidence.requests.push({seq:++seq,actor,uid,table:'expenses',method:'PATCH',body:req.postDataJSON(),status:409,syntheticPermanentError:true,affectedRows:0});
  return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'synthetic_permanent',message:'Synthetic permanent refusal'})});
 }
 const answer=processQuery(req,actor,uid);await route.fulfill({status:answer.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:answer.status===204?'':JSON.stringify(answer.data)});
}
async function install(ctx,actor,uid){await ctx.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===baseURL)return route.continue();
 if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/rest/v1/')){if(offline.has(actor))return route.abort('internetdisconnected');const q={route,actor,uid};if(hold&&hold(route.request(),actor)){held.push(q);record('held',{actor,urlPath:url.pathname,method:route.request().method()});return;}return execute(route,actor,uid);}
 if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/functions/v1/')){record('mock-function',{actor,name:url.pathname.split('/').at(-1)});return route.fulfill({status:200,contentType:'application/json',body:'{}'});}
 evidence.blockedExternal.push({actor,method:route.request().method(),host:url.hostname,path:url.pathname});await route.abort();});
 await ctx.addInitScript(({base,uid,actor,scenario})=>{
  const session={access_token:'synthetic-only',expires_at:4102444800,user:{id:uid,email:actor.toLowerCase()+'@example.invalid'}};let lib;
  Object.defineProperty(window,'supabase',{configurable:true,get:()=>lib,set:value=>{
   if(!value?.createClient){lib=value;return;}
   lib={...value,createClient:(url,key)=>{
    const c=value.createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    c.auth.getSession=async()=>({data:{session},error:null});
    c.auth.onAuthStateChange=cb=>{setTimeout(()=>cb('INITIAL_SESSION',session),0);return {data:{subscription:{unsubscribe(){}}}};};
    return c;
   }};
  }});
  if(scenario==='sandbox'){localStorage.setItem('_mcSandbox','1');if(!localStorage.getItem('micartera_sandbox'))localStorage.setItem('micartera_sandbox',JSON.stringify({...base,_historyOwner:uid}));}
  if(!localStorage.getItem('__finSeeded')){localStorage.setItem('micartera_v3',JSON.stringify({...base,_historyOwner:uid}));localStorage.setItem('__finSeeded','1');}
  localStorage.setItem('_seenVersion','dev');['dash','metas','gastos','fijos','inv'].forEach(k=>localStorage.setItem('_coach_'+k,'1'));localStorage.setItem('_mr2026-10','1');
  window.__finToastCalls=[];const nativeTimeout=window.setTimeout.bind(window);
  window.setTimeout=function(fn,delay,...args){if((delay===4000||delay===2200)&&new Error().stack.includes('showToast'))window.__finToastCalls.push({at:Date.now(),delay});return nativeTimeout(fn,delay,...args);};
  window.__finToasts=[];addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{for(const e of document.querySelectorAll('.toast')){const t=e.textContent;if(t&&!window.__finToasts.some(x=>x.text===t))window.__finToasts.push({text:t,at:Date.now()});}}).observe(document.body,{subtree:true,childList:true,characterData:true}));
 },{base,uid,actor,scenario});}
async function snap(label,pages){const clients=[];for(const p of pages)clients.push(await p.evaluate(()=>({state:loadState(),main:localStorage.getItem('micartera_v3'),exp:localStorage.getItem('micartera_v3_exp'),toasts:window.__finToasts,text:document.body.innerText})));const data={label,at:Date.now(),clients,db:clone(db)};evidence.snapshots.push(data);return data;}
async function waitHeld(n){for(let i=0;i<200;i++){if(held.length>=n)return;await sleep(50);}throw Error('Held timeout '+held.length+'/'+n);}
async function release(actor){const i=held.findIndex(x=>x.actor===actor);if(i<0)throw Error('missing held '+actor);const q=held.splice(i,1)[0];await execute(q.route,q.actor,q.uid);}
async function ready(p){await p.waitForFunction(()=>typeof cloud!=='undefined'&&document.querySelector('.botnav-tab')&&!document.getElementById('mc-load'),null,{timeout:20000});await sleep(1800);}
async function expOpen(p,id=expenseId){await p.locator('.botnav-tab[data-tour="gastos"]').click();await p.locator(`[data-expense-id="${id}"]`).click();}
async function noteEdit(p,text){await p.getByRole('button',{name:/Nota/}).last().click();await p.locator('input.v4-exp-note-in').fill(text);await p.locator('input.v4-exp-note-in').press('Tab');}
try{
 evidence.browser=browser.version();const pages=[];
 for(let i=0;i<2;i++){const c=await browser.newContext({viewport:{width:393,height:820},isMobile:true,hasTouch:true,timezoneId:'Europe/Madrid',serviceWorkers:'block'});contexts.push(c);await install(c,i?'B':'A',ids[i]);const p=await c.newPage();p.on('pageerror',e=>evidence.pageErrors.push({actor:i?'B':'A',error:String(e)}));pages.push(p);await p.goto(baseURL+"/");await ready(p);}
 await sleep(2200);const initial=await snap('boot-ready',pages);record('boot-query-count',{count:evidence.requests.length});
 if(scenario.startsWith('rename')){
  const expected=[[expenseId,1234,'super',1,'manual:sabadell']];
  if(scenario==='rename-unrelated')expected.push(['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',-897,'ingreso',-1,'manual:sabadell']);
  const localValues=s=>s.clients.map(x=>x.state.expenses.map(e=>[e.id,Math.round(e.amount*100),e.category,Math.sign(e.amount)]).sort((a,b)=>a[0].localeCompare(b[0])));
  const expectedLocal=expected.map(x=>x.slice(0,4));
  for(const p of pages)await expOpen(p);record('edit-start',{scenario});
  await noteEdit(pages[0],'Nota A');await sleep(600);
  check('peer note accepted before rename',db.expenses[0].nota,'Nota A');
  await pages[1].locator('input.v4-ficha-concept').fill('Comercio B');await pages[1].locator('input.v4-ficha-concept').press('Tab');await sleep(2200);
  const beforePull=await snap('after-writes-before-pull',pages);
  check('both local identities and financial values before pull',localValues(beforePull),[expectedLocal,expectedLocal]);
  for(const p of pages){await p.reload();await ready(p);}await sleep(1600);const final=await snap('after-both-reload',pages);
  check('remote exact identity and financial values',db.expenses.map(x=>[x.id,Math.round(x.importe*100),x.cat,Math.sign(x.importe),x.source]).sort((a,b)=>a[0].localeCompare(b[0])),expected);
  if(scenario==='rename-unrelated')check('unrelated remote row entirely unchanged',db.expenses.find(e=>e.id!==expenseId),evidence.initial.expenses[1]);
  if(scenario==='rename-local')check('one exact UUID in both local states',final.clients.map(x=>x.state.expenses.filter(e=>e.id===expenseId).length),[1,1]);
  check('rename preserves already persisted human note',db.expenses[0].nota,'Nota A');
  check('merchant change persisted',db.expenses[0].comercio,'Comercio B');
  check('one exact UUID in both local states',final.clients.map(x=>x.state.expenses.filter(e=>e.id===expenseId).length),[1,1]);
  check('local cents categories signs and identities unchanged',localValues(final),[expectedLocal,expectedLocal]);
  check('both clients retain accepted peer note',final.clients.map(x=>x.state.expenses.find(e=>e.id===expenseId).note),['Nota A','Nota A']);
 }else if(scenario==='note-zero'){
  await expOpen(pages[0]);db.expenses=[];record('delete-remote-before-note',{});
  await noteEdit(pages[0],'Nota pendiente');await sleep(700);const before=await snap('zero-note-response',pages);
  check('zero-row note has visible unconfirmed warning',before.clients[0].toasts.some(x=>/no.*(guard|confirm)|could not|no.*desat/i.test(x.text)),true);
  check('pending intent survives locally',before.clients[0].state.expenses[0].note,'Nota pendiente');
  check('pending note is not marked confirmed',before.clients[0].state.expenses[0].notePending,true);
  await pages[0].reload();await ready(pages[0]);await expOpen(pages[0]);
  check('pending survives reload',await pages[0].getByTestId('expense-note-pending').count(),1);
  await pages[0].getByTestId('expense-note-pending').getByRole('button',{name:'Reintentar',exact:true}).click();await sleep(500);
  check('retry receives single-row ACK',await pages[0].evaluate(()=>loadState().expenses[0].notePending),false);
  check('retried note persisted',db.expenses[0].nota,'Nota pendiente');
 }else if(scenario==='note-api'){
  const e=await pages[0].evaluate(()=>loadState().expenses[0]);
  const call=async(ex,n)=>pages[0].evaluate(async({ex,n})=>{try{return {ok:true,value:await cloud.setExpenseNote(ex,n)};}catch(e){return {ok:false,error:e.message};}},{ex,n});
  const zero=await call({...e,id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'},'Nada');record('zero-note-result',zero);check('zero-row note rejects',zero.ok,false);
  const yes=await call(e,'Nota ACK');record('positive-note-result',yes);check('single-row note succeeds',yes.ok,true);check('explicit exact ACK',yes.value?.id,expenseId);check('ACK note matches',yes.value?.nota,'Nota ACK');
  check('category zero remains explicit',await pages[0].evaluate(async e=>await cloud.setExpenseCat(e,'ocio'),{...e,id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}),0);
 }else if(scenario==='sandbox'){
  const before=await pages[0].evaluate(()=>localStorage.getItem('micartera_v3'));
  await expOpen(pages[0]);await noteEdit(pages[0],'Nota de pruebas');
  await pages[0].locator('input.v4-ficha-concept').fill('Nombre de pruebas');await pages[0].locator('input.v4-ficha-concept').press('Tab');await sleep(500);
  await pages[0].evaluate(async()=>{const e=loadState().expenses[0];await cloud.renameExpense(e,'Directo');await cloud.setExpenseNote(e,'Directo');});
  check('test mode sends zero business mutations',evidence.requests.filter(x=>x.method!=='GET').length,0);
  check('real local partition unchanged',await pages[0].evaluate(()=>localStorage.getItem('micartera_v3')),before);
  check('mock table unchanged',db.expenses,[expense]);
 }else if(scenario==='late-note-ack'){
  await expOpen(pages[0]);hold=req=>req.method()==='PATCH'&&new URL(req.url()).pathname.endsWith('/expenses');
  await noteEdit(pages[0],'Primera');await waitHeld(1);
  await pages[0].locator('input.v4-exp-note-in').fill('Segunda');await pages[0].locator('input.v4-exp-note-in').press('Tab');await waitHeld(2);
  // El almacenamiento partido se vuelca a los 400 ms; una petición retenida no lo fuerza.
  await pages[0].waitForFunction(()=>loadState().expenses[0].note==='Segunda'&&loadState().expenses[0].notePending);
  await release('A');await sleep(100);let s=await snap('old-ack-with-new-intent',pages);
  check('old ACK cannot confirm newer intention',s.clients[0].state.expenses[0].notePending,true);check('new intention remains',s.clients[0].state.expenses[0].note,'Segunda');
  await release('A');hold=null;await pages[0].waitForFunction(()=>loadState().expenses[0].notePending===false);s=await snap('new-ack',pages);
  check('new ACK confirms exact intent',s.clients[0].state.expenses[0].notePending,false);check('new note persisted',db.expenses[0].nota,'Segunda');
 }else if(scenario==='late-rename-ack'){
  for(const p of pages)await expOpen(p);
  hold=req=>req.method()==='PATCH'&&new URL(req.url()).pathname.endsWith('/expenses')&&Object.hasOwn(req.postDataJSON(),'comercio');
  await pages[1].locator('input.v4-ficha-concept').fill('Comercio B');await pages[1].locator('input.v4-ficha-concept').press('Tab');await waitHeld(1);
  await noteEdit(pages[1],'Nota más reciente');await sleep(300);await release('B');hold=null;await sleep(400);
  const s=await snap('rename-after-new-note',pages);check('rename ACK keeps newer local note',s.clients[1].state.expenses[0].note,'Nota más reciente');
  check('rename preserves concurrent persisted note',db.expenses[0].nota,'Nota más reciente');check('rename persists independently',db.expenses[0].comercio,'Comercio B');
 }else if(scenario==='legacy-duplicates'){
  await pages[0].evaluate(()=>{const s=loadState(),e=s.expenses[0];s.expenses=[{...e,expenseEditAt:10,noteEditAt:30,note:'Intención nueva',notePending:true},{...e,merchant:'Nombre nuevo',expenseEditAt:20,noteEditAt:5,note:'Antigua'}];mcSaveRaw(mcStateKey(),s);});
  await pages[0].reload();await ready(pages[0]);const s=await snap('legacy-duplicate-reload',pages);
  check('legacy same UUID only once',s.clients[0].state.expenses.length,1);check('latest local note preserved',s.clients[0].state.expenses[0].note,'Intención nueva');
  check('same cents and category',s.clients[0].state.expenses.map(e=>[Math.round(e.amount*100),e.category,Math.sign(e.amount)]),[[1234,'super',1]]);
 }else if(scenario==='late-rename-intent'){
  await expOpen(pages[0]);hold=req=>req.method()==='PATCH'&&new URL(req.url()).pathname.endsWith('/expenses')&&Object.hasOwn(req.postDataJSON(),'comercio');
  const edit=async name=>{await pages[0].locator('input.v4-ficha-concept').fill(name);await pages[0].locator('input.v4-ficha-concept').press('Tab');};
  await edit('Primero');await waitHeld(1);await edit('Segundo');
  await pages[0].waitForFunction(()=>loadState().expenses[0].renamePending?.merchant==='Segundo');
  await release('A');await waitHeld(1);
  let s=await snap('old-rename-ack-new-intent',pages);
  check('old rename ACK keeps latest durable intention',s.clients[0].state.expenses[0].renamePending?.merchant,'Segundo');
  check('new rename remains visibly pending',await pages[0].getByTestId('expense-rename-pending').count(),1);
  await release('A');hold=null;await pages[0].waitForFunction(()=>loadState().expenses[0].merchant==='Segundo'&&!loadState().expenses[0].renamePending);
  for(const p of pages){await p.reload();await ready(p);}s=await snap('latest-rename-confirmed-reloaded',pages);
  check('both clients see only latest ACK and unchanged cents',s.clients.map(x=>x.state.expenses.map(e=>[e.id,e.merchant,Math.round(e.amount*100),e.note,!!e.renamePending])),[[[expenseId,'Segundo',1234,'Nota inicial',false]],[[expenseId,'Segundo',1234,'Nota inicial',false]]]);
  check('rename intentions never DELETE',evidence.requests.filter(x=>x.table==='expenses'&&x.method==='DELETE').length,0);
 }else if(scenario==='legacy-unstamped'||scenario==='legacy-amounts'){
  offline.add('A');offline.add('B');
  for(let i=0;i<pages.length;i++)await pages[i].evaluate(({i,scenario})=>{
    const s=loadState(),e=s.expenses[0],old={...e,merchant:'Nombre borrado'},live={...e};
    delete old.expenseEditAt;delete live.expenseEditAt;delete old.noteEditAt;delete live.noteEditAt;
    if(scenario==='legacy-amounts'){old.amount=-8.97;s.expenses=[old,live];}
    else{
      const edited=i?live:old;Object.assign(edited,{category:'ocio',catStale:['super'],debtId:'debt-fin04',noCard:true,note:'Humana legacy',noteEdited:true});
      const other=i?old:live;delete other.debtId;delete other.noCard;delete other.note;delete other.noteEdited;
      s.expenses=i?[live,old]:[old,live];s.deleted=[keyOfExpense(old)];
    }
    mcSaveRaw(mcStateKey(),s);
  },{i,scenario});
  for(const p of pages){await p.reload();await ready(p);}let s=await snap('legacy-offline-reload',pages);
  const amounts=x=>x.state.expenses.filter(e=>!e.deleted).map(e=>Math.round(e.amount*100)).sort((a,b)=>a-b);
  if(scenario==='legacy-amounts')check('conflicting signed amounts survive both load and split storage',s.clients.map(amounts),[[-897,1234],[-897,1234]]);
  else check('live UUID and metadata from either copy survive reload',s.clients.map(x=>x.state.expenses.map(e=>[e.merchant,Math.round(e.amount*100),e.category,e.debtId,e.noCard,e.note])),[[['Compra sintética',1234,'ocio','debt-fin04',true,'Humana legacy']],[['Compra sintética',1234,'ocio','debt-fin04',true,'Humana legacy']]]);
  offline.clear();for(const p of pages){await p.reload();await ready(p);}s=await snap('legacy-online-stale-pull',pages);
  if(scenario==='legacy-amounts')check('cloud pull preserves both conflicting amounts',s.clients.map(amounts),[[-897,1234],[-897,1234]]);
  else check('stale pull keeps recovered category debt card and human note',s.clients.map(x=>x.state.expenses.map(e=>[Math.round(e.amount*100),e.category,e.debtId,e.noCard,e.note])),[[[1234,'ocio','debt-fin04',true,'Humana legacy']],[[1234,'ocio','debt-fin04',true,'Humana legacy']]]);
 }else if(scenario==='permanent-rename'){
  await expOpen(pages[0]);const noticeStart=await pages[0].evaluate(()=>window.__finToastCalls.length);await pages[0].locator('input.v4-ficha-concept').fill('Nombre bloqueado');await pages[0].locator('input.v4-ficha-concept').press('Tab');
  await sleep(800);for(let i=0;i<3;i++){await pages[0].evaluate(()=>window.dispatchEvent(new Event('online')));await sleep(120);}
  // Un rechazo del servidor no es falta de red: `online` no lo adelanta y los intentos esperan 2 s y 8 s.
  check('online does not hurry a server refusal',evidence.requests.filter(x=>x.syntheticPermanentError).length,1);
  await pages[0].waitForFunction(()=>loadState().expenses.find(e=>e.id==='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').renamePending?.quarantined,null,{timeout:20000});
  check('one actual showToast call despite repeated online events',await pages[0].evaluate(()=>window.__finToastCalls.length)-noticeStart,1);
  let s=await snap('three-failures-quarantined',pages);const rejected=()=>evidence.requests.filter(x=>x.syntheticPermanentError).length;
  check('exactly three permanent failures',rejected(),3);check('single paused notice',s.clients[0].toasts.filter(x=>x.text.startsWith('No se ha podido confirmar el nombre.')).length,1);
  check('failed merchant remains unconfirmed',s.clients[0].state.expenses.find(e=>e.id===expenseId).merchant,'Compra sintética');
  await pages[0].locator('.v4-ficha-done').click();await sleep(450);await pages[0].locator('[data-expense-id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]').click();
  await pages[0].locator('input.v4-ficha-concept').fill('Independiente');await pages[0].locator('input.v4-ficha-concept').press('Tab');
  await pages[0].waitForFunction(()=>loadState().expenses.some(e=>e.merchant==='Independiente'&&!e.renamePending));
  check('later independent edit reaches server',db.expenses.find(e=>e.id!==expenseId).comercio,'Independiente');check('closing sheet does not retry quarantine',rejected(),3);
  await pages[0].reload();await ready(pages[0]);for(let i=0;i<5;i++){await pages[0].evaluate(()=>window.dispatchEvent(new Event('online')));await sleep(80);}await expOpen(pages[0]);
  s=await snap('quarantine-reloaded-online',pages);check('reload and online do not restart automatic failures',rejected(),3);check('quarantine durable with exact attempt count',s.clients[0].state.expenses.find(e=>e.id===expenseId).renamePending,{merchant:'Nombre bloqueado',at:s.clients[0].state.expenses.find(e=>e.id===expenseId).renamePending.at,failures:3,quarantined:true});
  check('reload does not repeat notice',s.clients[0].toasts.filter(x=>x.text.startsWith('No se ha podido confirmar el nombre.')).length,0);
  rejectedNames.clear();await pages[0].getByTestId('expense-rename-pending').getByRole('button',{name:'Reintentar',exact:true}).click();
  await pages[0].waitForFunction(()=>loadState().expenses.some(e=>e.merchant==='Nombre bloqueado'&&!e.renamePending));
  for(const p of pages){await p.reload();await ready(p);}s=await snap('explicit-retry-both-clients',pages);
  check('both clients retain money category note and identity',s.clients.map(x=>x.state.expenses.map(e=>[e.id,Math.round(e.amount*100),e.category,e.note,e.merchant,!!e.renamePending]).sort()),Array.from({length:2},()=>[[expenseId,1234,'super','Nota inicial','Nombre bloqueado',false],['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',456,'ocio','Intocable','Independiente',false]].sort()));
 }else if(scenario==='late-rename-failure'){
  await expOpen(pages[0]);hold=req=>req.method()==='PATCH'&&req.postDataJSON()?.comercio==='Primero';
  await pages[0].locator('input.v4-ficha-concept').fill('Primero');await pages[0].locator('input.v4-ficha-concept').press('Tab');await waitHeld(1);
  await pages[0].locator('input.v4-ficha-concept').fill('Segundo');await pages[0].locator('input.v4-ficha-concept').press('Tab');await pages[0].waitForFunction(()=>loadState().expenses[0].renamePending?.merchant==='Segundo');
  await release('A');hold=null;await pages[0].waitForFunction(()=>loadState().expenses[0].merchant==='Segundo'&&!loadState().expenses[0].renamePending);const s=await snap('old-failure-new-intent',pages);
  check('old failure cannot quarantine new intent',s.clients[0].state.expenses[0].merchant,'Segundo');check('no false paused notice',s.clients[0].toasts.some(x=>x.text.startsWith('No se ha podido confirmar el nombre.')),false);check('latest intent persisted with exact amount',db.expenses.map(e=>[e.id,e.comercio,Math.round(e.importe*100)]),[[expenseId,'Segundo',1234]]);
 }else if(scenario==='offline-rename'||scenario==='unuploaded-rename'){
  await expOpen(pages[0]);offline.add('A');if(scenario==='unuploaded-rename')db.expenses=[];
  await pages[0].locator('input.v4-ficha-concept').fill('Nombre pendiente');await pages[0].locator('input.v4-ficha-concept').press('Tab');await sleep(650);
  let s=await snap('offline-rename-queued',pages);
  check('offline rename retains durable intention',s.clients[0].state.expenses[0].renamePending?.merchant,'Nombre pendiente');
  check('offline rename does not claim confirmed merchant',s.clients[0].state.expenses[0].merchant,'Compra sintética');
  check('offline rename visibly pending',await pages[0].getByTestId('expense-rename-pending').count(),1);
  await pages[0].reload();await ready(pages[0]);await expOpen(pages[0]);
  check('offline rename draft survives reload',await pages[0].locator('input.v4-ficha-concept').inputValue(),'Nombre pendiente');
  check('pending survives reload',await pages[0].getByTestId('expense-rename-pending').count(),1);
  // Cinco caídas de red seguidas (cada `online` adelanta el reintento) no lo apartan ni lo cuentan.
  await pages[0].evaluate(()=>{window.__rnNetFails=0;const o=cloud.renameExpense;cloud.renameExpense=function(){return o.apply(this,arguments).catch(e=>{window.__rnNetFails++;throw e;});};});
  for(let i=1;i<=5;i++){await pages[0].evaluate(()=>window.dispatchEvent(new Event('online')));await pages[0].waitForFunction(n=>window.__rnNetFails>=n,i);}
  s=await snap('offline-rename-five-network-failures',pages);
  check('network failures never quarantine nor count',s.clients[0].state.expenses[0].renamePending,{merchant:'Nombre pendiente',at:s.clients[0].state.expenses[0].renamePending.at});
  check('still visibly pending after network failures',await pages[0].getByTestId('expense-rename-pending').count(),1);
  offline.delete('A');await pages[0].evaluate(()=>window.dispatchEvent(new Event('online')));
  await pages[0].waitForFunction(()=>loadState().expenses[0].merchant==='Nombre pendiente'&&!loadState().expenses[0].renamePending);
  for(const p of pages){await p.reload();await ready(p);}s=await snap('rename-reconnected-reloaded',pages);
  check('one remote row exact money source and note',db.expenses.map(e=>[e.id,e.comercio,Math.round(e.importe*100),e.cat,e.source,e.nota]),[[expenseId,'Nombre pendiente',1234,'super','manual:sabadell','Nota inicial']]);
  check('both local clients confirmed rename',s.clients.map(x=>x.state.expenses.map(e=>[e.id,e.merchant,Math.round(e.amount*100),e.category,!!e.renamePending])),[[[expenseId,'Nombre pendiente',1234,'super',false]],[[expenseId,'Nombre pendiente',1234,'super',false]]]);
  check('rename queue never deletes the cloud expense',evidence.requests.filter(x=>x.table==='expenses'&&x.method==='DELETE').length,0);
 }else throw Error('Unknown scenario '+scenario);


 evidence.status='PASS';
}catch(e){evidence.status=e.productFailure?'PRODUCT_RED':'HARNESS_ERROR';evidence.error=String(e.stack||e);throw e;
}finally{hold=null;for(const q of held){try{await q.route.abort();}catch{}}for(const c of contexts)await c.close();evidence.finalDatabase=clone(db);evidence.cleanup={contextsClosed:true};await onEvidence(evidence);}
}
