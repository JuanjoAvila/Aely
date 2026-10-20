import {test,expect} from '@playwright/test';
// App y SDK reales: solo auth y transporte son sintéticos. El GET se libera explícitamente.
// La nube tiene un sello posterior al arranque local para aislar esta carrera del LWW existente.
const owner='11111111-1111-4111-8111-111111111111';
const copy=x=>JSON.parse(JSON.stringify(x));
function seed(){const now=new Date();return {fx:1,budget:500,monthStartNet:3000,accounts:[{id:'acc',name:'Cuenta sintética',ent:'sabadell',value:3000,role:'diario',spendFrom:true}],investments:[],assets:[],debts:[{id:'debt',name:'Deuda remota',value:1200.23,original:1200.23,monthly:100.11,asOf:now.getFullYear()*12+now.getMonth(),day:28,account:'sabadell',ent:'familia'}],fixed:[{id:'fixed',name:'Recibo remoto',amount:42.37,freq:'mes',day:25,cat:'servicios',account:'sabadell'}],flows:[],oneoffs:[],aportaciones:[],goals:[],shared:[],expenses:[],history:[],catOverrides:{},obAccounts:[],obLabels:{},verNotes:[],settings:{autoPrices:false,theme:'green',lang:'es',reservaRules:[]},onboarded:true,tourSeen:true,setupHint:false,_dataVer:6,_savedAt:Date.now()+60000,lastBackup:Date.now(),trAnchor:now.toISOString().slice(0,7),reservaLog:[],_historyOwner:owner};}
test.describe.configure({mode:'serial'});
for(const scenario of ['debounce','online','read-error','invalid','missing-revision','signed-out','empty','collision'])test('FIN04 primera lectura · '+scenario,async({browser,baseURL},info)=>{
 const remote=seed(),local=copy(remote);local.fixed[0].name='Copia antigua';local.fixed[0].amount=7.77;local._savedAt-=120000;
 let row=scenario==='empty'?null:{user_id:owner,data:copy(remote),updated_at:'2026-10-19T10:00:00.000Z'};
 const initial=copy(row),requests=[],held=[],contexts=[],errors=[];let hold=true;
 async function answer(route,actor){const req=route.request(),url=new URL(req.url()),method=req.method(),table=url.pathname.split('/').at(-1),headers=req.headers(),body=req.postData()?req.postDataJSON():null;
  const entry={actor,table,method,body,select:url.searchParams.get('select'),prefer:headers.prefer||'',filters:Object.fromEntries(url.searchParams),before:table==='app_state'?copy(row):null};requests.push(entry);
  let data=[],status=200;
  if(table==='app_state'){
   if(method==='GET'){
    if(scenario==='read-error'){status=400;data={code:'synthetic_read_error',message:'Synthetic read failure'};}
    else if(scenario==='invalid')data=[{data:{fixed:'invalid'},updated_at:row.updated_at}];
    else if(scenario==='missing-revision')data=[{data:copy(row.data)}];
    else if(scenario==='collision')data=[];
    else data=row?[{data:copy(row.data),updated_at:row.updated_at}]:[];
   }else if(method==='POST'){
    if(row&&!entry.prefer.includes('resolution=merge-duplicates')){status=409;data={code:'23505',message:'Synthetic unique user_id'};}
    else {row=copy(body);data=[{updated_at:row.updated_at}];}
   }else if(method==='PATCH'){
    if(row&&url.searchParams.get('user_id')==='eq.'+row.user_id&&url.searchParams.get('updated_at')==='eq.'+row.updated_at){row=copy(body);data=[{updated_at:row.updated_at}];}
   }else throw Error('Unexpected app_state method '+method);
  }
  entry.after=table==='app_state'?copy(row):null;entry.status=status;entry.response=copy(data);
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 }
 async function install(ctx,actor,stored=local){await ctx.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===baseURL)return route.continue();
   if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/rest/v1/')){if(hold&&url.pathname.endsWith('/app_state')&&route.request().method()==='GET'){held.push({route,actor});return;}return answer(route,actor);}
   if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/functions/v1/'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});
   return route.abort();});
  await ctx.addInitScript(({local,owner})=>{let lib,authCallback,session={access_token:'synthetic-only',expires_at:4102444800,user:{id:owner}};window.__signOut=()=>{session=null;authCallback?.('SIGNED_OUT',null);};
   Object.defineProperty(window,'supabase',{configurable:true,get:()=>lib,set:value=>{if(!value?.createClient){lib=value;return;}lib={...value,createClient:(url,key)=>{const c=value.createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});c.auth.getSession=async()=>({data:{session},error:null});c.auth.onAuthStateChange=cb=>{authCallback=cb;return {data:{subscription:{unsubscribe(){}}}};};return c;}};}});
   if(!localStorage.getItem('__firstPullSeed')){localStorage.setItem('micartera_v3',JSON.stringify(local));localStorage.setItem('__firstPullSeed','1');}
   localStorage.setItem('_seenVersion','dev');['dash','metas','gastos','fijos','inv'].forEach(k=>localStorage.setItem('_coach_'+k,'1'));
   window.__debounces=0;const timeout=window.setTimeout.bind(window);window.setTimeout=(fn,delay,...args)=>timeout(delay===1200?function(){window.__debounces++;return fn(...args);}:fn,delay,...args);
  },{local:stored,owner});
 }
 try{
  const ctx=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,timezoneId:'Europe/Madrid',serviceWorkers:'block'});contexts.push(ctx);await install(ctx,'A');const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(baseURL+'/');
  await expect.poll(()=>held.length).toBeGreaterThan(0);
  if(scenario==='online'){await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await page.waitForTimeout(50);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(200);}
  else await page.waitForFunction(()=>window.__debounces>0);
  expect(requests.filter(r=>r.table==='app_state'&&r.method!=='GET'),'no write before initial pull').toHaveLength(0);expect(row).toEqual(initial);
  if(scenario==='signed-out')await page.evaluate(()=>window.__signOut());
  hold=false;for(const h of held.splice(0))await answer(h.route,h.actor);
  if(['read-error','invalid','missing-revision','signed-out','collision'].includes(scenario)){
   await page.waitForTimeout(1800);await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await page.waitForTimeout(50);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(300);
   expect(row).toEqual(initial);expect(requests.filter(r=>r.table==='app_state'&&r.method==='PATCH')).toHaveLength(0);
   const writes=requests.filter(r=>r.table==='app_state'&&r.method==='POST');if(scenario==='collision'){expect(writes.length).toBeGreaterThan(0);expect(writes.every(r=>r.status===409&&!r.prefer.includes('resolution='))).toBe(true);}else expect(writes).toHaveLength(0);
  }else{
   await page.waitForFunction(()=>loadState().fixed[0]?.name==='Recibo remoto'||loadState().fixed[0]?.name==='Copia antigua');
   if(scenario==='empty')await expect.poll(()=>row?.data?.fixed?.[0]?.amount).toBe(7.77);
   else await expect.poll(()=>page.evaluate(()=>loadState().fixed[0]?.name)).toBe('Recibo remoto');
   await page.waitForTimeout(1500);
   expect(requests.filter(r=>r.table==='app_state'&&r.prefer.includes('resolution='))).toHaveLength(0);
   expect(Math.round(row.data.fixed[0].amount*100)).toBe(scenario==='empty'?777:4237);expect(Math.round(row.data.debts[0].value*100)).toBe(120023);expect(Math.round(row.data.debts[0].monthly*100)).toBe(10011);
   // Otro contexto lee la misma nube; no se confunde el estado de A con la persistencia remota.
   const stored=await page.evaluate(()=>loadState());stored._savedAt=0;stored.fixed[0].name='Segundo móvil atrasado';
   const b=await browser.newContext({serviceWorkers:'block',timezoneId:'Europe/Madrid'});contexts.push(b);await install(b,'B',stored);const pb=await b.newPage();await pb.goto(baseURL+'/');await expect.poll(()=>pb.evaluate(()=>typeof loadState==='function'?loadState().fixed[0]?.name:null)).toBe(row.data.fixed[0].name);
  }
  expect(errors).toEqual([]);
 }finally{await info.attach('first-pull-evidence',{body:JSON.stringify({scenario,initial,row,requests,errors},null,2),contentType:'application/json'});for(const c of contexts)await c.close();}
});
