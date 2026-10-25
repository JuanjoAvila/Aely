import {test,expect} from '@playwright/test';
const owner='11111111-1111-4111-8111-111111111111',copy=x=>JSON.parse(JSON.stringify(x));
function seed(){const now=new Date();return {fx:1,budget:500,monthStartNet:3000,accounts:[{id:'acc',name:'Cuenta sintética',ent:'sabadell',value:3000,role:'diario',spendFrom:true}],investments:[],assets:[],debts:[{id:'d',name:'Deuda',value:1200.23,monthly:100.11,asOf:now.getFullYear()*12+now.getMonth(),day:28,account:'sabadell'}],fixed:[{id:'f',name:'Recibo',amount:42.37,freq:'mes',day:25,cat:'servicios',account:'sabadell'}],flows:[],oneoffs:[],aportaciones:[],goals:[],shared:[],expenses:[],history:[],catOverrides:{},obAccounts:[],obLabels:{},verNotes:[],settings:{autoPrices:false,theme:'green',lang:'es',reservaRules:[]},onboarded:true,tourSeen:true,setupHint:false,_dataVer:6,_savedAt:Date.now()-60000,lastBackup:Date.now(),trAnchor:now.toISOString().slice(0,7),reservaLog:[],_historyOwner:owner};}
for(const retry of ['reconnect','edit','pending-edit','expense-edit'])test('B3 invalid Plan has one GET and one notice over 12 seconds, then explicit retry='+retry,async({browser,baseURL},info)=>{
 const local={...seed(),lastSync:Date.now()},valid=copy(local);valid._savedAt+=30000;const invalid=copy(valid);invalid.fixed.push(copy(invalid.fixed[0]));
 let recover=false,gets=0,revision='2026-10-25T01:00:00.000Z',serverData=copy(valid),release,releaseExpenses,heldExpenses=false;const writes=[],errors=[],snapshots=[];
 const ctx=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,timezoneId:'Europe/Madrid',serviceWorkers:'block'});
 await ctx.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin===baseURL)return route.continue();
  if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/rest/v1/')){
   let data=[];
   if(url.pathname.endsWith('/app_state')){
    if(req.method()==='GET'){gets++;const pending=retry==='pending-edit'&&gets===1;if(pending)await new Promise(resolve=>{release=resolve;});data=[{data:copy(!pending&&recover?serverData:invalid),updated_at:revision}];}
    else{const body=req.postDataJSON(),filters=Object.fromEntries(url.searchParams),beforeRevision=revision,applied=req.method()==='PATCH'&&filters.updated_at==='eq.'+revision&&filters.user_id==='eq.'+owner&&body.user_id===owner;
     if(applied){revision=new Date(Date.parse(revision)+1).toISOString();serverData=copy(body.data);data=[{updated_at:revision}];}
     writes.push({method:req.method(),body,filters,beforeRevision,applied,afterRevision:revision});}
   }
   if(retry==='expense-edit'&&url.pathname.endsWith('/expenses')&&req.method()==='GET'&&!heldExpenses){heldExpenses=true;await new Promise(resolve=>{releaseExpenses=resolve;});}
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  }
  if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/functions/v1/'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  return route.abort();
 });
 await ctx.addInitScript(({local,owner})=>{
  let lib,react;window.__planNotices=0;
  Object.defineProperty(window,'React',{configurable:true,get:()=>react,set:value=>{react=new Proxy(value,{get(target,key){if(key!=='useState')return target[key];return function(...args){const pair=target.useState(...args);return [pair[0],function(value){if(typeof value==='string'&&value.includes('No se ha podido leer el Plan'))window.__planNotices++;return pair[1](value);}];};}});}});
  const session={access_token:'synthetic-only',expires_at:4102444800,user:{id:owner}};
  Object.defineProperty(window,'supabase',{configurable:true,get:()=>lib,set:value=>{if(!value?.createClient){lib=value;return;}lib={...value,createClient:(url,key)=>{const c=value.createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});c.auth.getSession=async()=>({data:{session},error:null});c.auth.onAuthStateChange=()=>({data:{subscription:{unsubscribe(){}}}});return c;}};}});
  localStorage.setItem('micartera_v3',JSON.stringify(local));localStorage.setItem('_seenVersion','dev');['dash','metas','gastos','fijos','inv'].forEach(k=>localStorage.setItem('_coach_'+k,'1'));
 },{local,owner});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 const edit=async()=>{await page.locator('.botnav-tab[data-tour="plan"]').click();await page.getByRole('tab',{name:'Deudas',exact:true}).click();await page.locator('[data-debt-id="d"] .plan-item-open').click();const dialog=page.getByRole('dialog',{name:'Editar deuda',exact:true});await dialog.locator('[data-debt-field="day"]').fill('30');await dialog.getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect(dialog).toHaveCount(0);};
 try{
  await page.goto(baseURL+'/');await page.waitForFunction(()=>typeof loadState==='function'&&!document.getElementById('mc-load'));
  if(retry==='expense-edit'){await expect.poll(()=>page.evaluate(()=>window.__planNotices)).toBe(1);await expect.poll(()=>typeof releaseExpenses).toBe('function');await edit();await page.waitForTimeout(1500);expect(writes).toHaveLength(0);expect(gets).toBe(1);recover=true;releaseExpenses();}
  else if(retry==='pending-edit'){await edit();await page.waitForTimeout(1500);expect(writes).toHaveLength(0);expect(gets).toBe(1);recover=true;release();}
  else await page.waitForTimeout(12500);
  if(!['pending-edit','expense-edit'].includes(retry)){
  snapshots.push(await page.evaluate(()=>({state:loadState(),notices:window.__planNotices})));
  expect(gets).toBe(1);expect(snapshots[0].notices).toBe(1);expect(writes).toHaveLength(0);
  expect(snapshots[0].state.fixed).toHaveLength(1);expect(Math.round(snapshots[0].state.fixed[0].amount*100)).toBe(4237);expect(Math.round(snapshots[0].state.debts[0].value*100)).toBe(120023);
  recover=true;
  if(retry==='edit')await edit();
  else{await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await page.waitForTimeout(50);await page.evaluate(()=>window.dispatchEvent(new Event('online')));}
  }
  await expect.poll(()=>gets).toBe(2);await expect.poll(()=>page.evaluate(()=>loadState()._planSync?.owner)).toBe(owner);
  if(retry==='reconnect')await edit();
  await expect.poll(()=>writes.filter(w=>w.body?.data?.debts?.[0]?.day===30).length).toBeGreaterThan(0);
  const saved=writes.find(w=>w.body?.data?.debts?.[0]?.day===30);expect(saved.method).toBe('PATCH');expect(saved.applied).toBe(true);expect(saved.filters.updated_at).toBe('eq.'+saved.beforeRevision);expect(saved.filters.user_id).toBe('eq.'+owner);expect(saved.body.user_id).toBe(owner);
  expect(Math.round(saved.body.data.fixed[0].amount*100)).toBe(4237);expect(Math.round(saved.body.data.debts[0].value*100)).toBe(120023);expect(Math.round(saved.body.data.debts[0].monthly*100)).toBe(10011);expect(errors).toEqual([]);
 }finally{await info.attach('pr297-r2-loop',{body:JSON.stringify({gets,writes,errors,snapshots},null,2),contentType:'application/json'});await ctx.close();}
});
