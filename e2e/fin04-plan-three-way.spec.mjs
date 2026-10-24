import {test,expect} from '@playwright/test';
const owner='11111111-1111-4111-8111-111111111111',copy=x=>JSON.parse(JSON.stringify(x));
function seed(){const now=new Date();return {fx:1,budget:500,monthStartNet:3000,accounts:[{id:'acc',name:'Cuenta sintética',ent:'sabadell',value:3000,role:'diario',spendFrom:true}],investments:[],assets:[],debts:[{id:'debt',name:'Deuda inicial',value:1200.23,original:1200.23,monthly:100.11,asOf:now.getFullYear()*12+now.getMonth(),day:28,account:'sabadell',ent:'familia',unknown:{keep:null}}],fixed:[{id:'fixed',name:'Recibo inicial',amount:42.37,freq:'mes',day:25,cat:'servicios',account:'sabadell'}],flows:[],oneoffs:[],aportaciones:[],goals:[],shared:[],expenses:[],history:[],catOverrides:{},obAccounts:[],obLabels:{},verNotes:[],settings:{autoPrices:false,theme:'green',lang:'es',reservaRules:[]},onboarded:true,tourSeen:true,setupHint:false,_dataVer:6,_savedAt:Date.now(),lastBackup:Date.now(),trAnchor:now.toISOString().slice(0,7),reservaLog:[],_historyOwner:owner};}
// Dos SDK/React reales, transporte cerrado y CAS determinista; ningún sello futuro oculta LWW.
async function harness(browser,baseURL,info,lang='es',count=1){
 const initial=seed();initial.settings.lang=lang;if(count>1)initial.debts=Array.from({length:count},(_,i)=>({...copy(initial.debts[0]),id:'debt'+i,name:'Deuda inicial '+i}));let row={user_id:owner,data:copy(initial),updated_at:'2026-10-19T10:00:00.000Z'},hold=null;
 const contexts=[],requests=[],held=[],errors=[];
 async function answer(route,actor){const req=route.request(),url=new URL(req.url()),method=req.method(),table=url.pathname.split('/').at(-1),body=req.postData()?req.postDataJSON():null;
  const entry={actor,table,method,body,filters:Object.fromEntries(url.searchParams),before:table==='app_state'?copy(row):null};requests.push(entry);let data=[],status=200;
  if(table==='app_state'){
   if(method==='GET')data=row?[{data:copy(row.data),updated_at:row.updated_at}]:[];
   else if(method==='PATCH'){if(row&&url.searchParams.get('user_id')==='eq.'+row.user_id&&url.searchParams.get('updated_at')==='eq.'+row.updated_at){row=copy(body);data=[{updated_at:row.updated_at}];}}
   else if(method==='POST'){if(row){status=409;data={code:'23505',message:'Synthetic unique user_id'};}else{row=copy(body);data=[{updated_at:row.updated_at}];}}
   else throw Error('Unexpected app_state method '+method);
  }
  entry.after=table==='app_state'?copy(row):null;entry.response=copy(data);entry.status=status;
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 }
 async function client(actor){const c=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,timezoneId:'Europe/Madrid',serviceWorkers:'block'});contexts.push(c);
  await c.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===baseURL)return route.continue();
   if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/rest/v1/')){if(hold?.(route.request(),actor)){held.push({route,actor});return;}return answer(route,actor);}
   if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/functions/v1/'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});return route.abort();});
  await c.addInitScript(({initial,owner})=>{let lib,cb,session={access_token:'synthetic-only',expires_at:4102444800,user:{id:owner}};
   window.__planSignOut=()=>{session=null;cb?.('SIGNED_OUT',null);};
   Object.defineProperty(window,'supabase',{configurable:true,get:()=>lib,set:value=>{if(!value?.createClient){lib=value;return;}lib={...value,createClient:(url,key)=>{const c=value.createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});c.auth.getSession=async()=>({data:{session},error:null});c.auth.onAuthStateChange=f=>{cb=f;return {data:{subscription:{unsubscribe(){}}}};};return c;}};}});
   if(!localStorage.getItem('__planSeed')){localStorage.setItem('micartera_v3',JSON.stringify(initial));localStorage.setItem('__planSeed','1');}
   localStorage.setItem('_seenVersion','dev');['dash','metas','gastos','fijos','inv'].forEach(k=>localStorage.setItem('_coach_'+k,'1'));
  },{initial,owner});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(baseURL+'/');await ready(p);return p;
 }
 return {client,requests,held,errors,get row(){return row;},hold(fn){hold=fn;},async release(actor){const i=held.findIndex(h=>h.actor===actor);if(i<0)throw Error('No held request');await answer(held.splice(i,1)[0].route,actor);},async close(){hold=null;for(const h of held)try{await h.route.abort();}catch{};await info.attach('plan-three-way-evidence',{body:JSON.stringify({initial,row,requests,errors},null,2),contentType:'application/json'});for(const c of contexts)await c.close();}};
}
async function ready(p){await p.waitForFunction(()=>typeof loadState==='function'&&!document.getElementById('mc-load'));await p.waitForTimeout(1800);}
async function debtOpen(p,id='debt'){await p.locator('.botnav-tab[data-tour="plan"]').click();await p.getByRole('tab',{name:/^(Deudas|Debts|Deutes)$/}).click();await p.locator('[data-debt-id="'+id+'"] .plan-item-open').click();}
async function debtEdit(p,fields,id='debt'){await debtOpen(p,id);const sheet=p.getByRole('dialog',{name:/^(Editar deuda|Edit debt|Edita el deute)$/});for(const [k,v] of Object.entries(fields))await sheet.locator('[data-debt-field="'+k+'"]').fill(v);await sheet.getByRole('button',{name:/^(Guardar cambios|Save changes|Desa els canvis)$/}).click();await expect(sheet).toHaveCount(0);}
async function fixedOpen(p){await p.locator('.botnav-tab[data-tour="plan"]').click();const name=await p.evaluate(()=>t('v4_gestionar'));await p.locator('.v4-screen > [data-seg="recibos"]').getByRole('button',{name,exact:true}).click();await p.locator('[data-bills-manage] [data-group="serv"]').first().click();await p.locator('[data-bill-id="fixed"]').click();}
async function fixedEdit(p,name){await fixedOpen(p);const sheet=p.locator('[data-sheet="bill"]');await sheet.locator('input.v4-bills-search').first().fill(name);await sheet.locator('[data-act="back"]').click();await expect(sheet).toHaveCount(0);}
test('FIN04 B conserva nombre y día de dos móviles con CAS concurrente',async({browser,baseURL},info)=>{
 const h=await harness(browser,baseURL,info);try{const a=await h.client('A'),b=await h.client('B');
  h.hold((r,actor)=>actor==='B'&&r.method()==='PATCH'&&new URL(r.url()).pathname.endsWith('/app_state'));
  await debtEdit(b,{day:'29'});await expect.poll(()=>h.held.length).toBeGreaterThan(0);
  await debtEdit(a,{name:'Nombre de A'});await expect.poll(()=>h.row.data.debts[0].name).toBe('Nombre de A');
  h.hold(null);await h.release('B');await b.waitForTimeout(3500);
  expect(h.requests.some(r=>r.actor==='B'&&r.table==='app_state'&&r.method==='PATCH'&&r.response.length===0),'CAS miss real').toBe(true);
  expect(h.row.data.debts[0]).toMatchObject({name:'Nombre de A',day:29,value:1200.23,monthly:100.11,unknown:{keep:null}});
  expect(Math.round(h.row.data.fixed[0].amount*100)).toBe(4237);
  for(const p of [a,b]){await p.reload();await ready(p);expect(await p.evaluate(()=>loadState().debts[0])).toMatchObject({name:'Nombre de A',day:29,value:1200.23,monthly:100.11});}
  expect(h.errors).toEqual([]);
 }finally{await h.close();}
});

for(const lang of ['es','en','ca'])test('FIN04 B conflicto de nombre, revisión validada y persistencia · '+lang,async({browser,baseURL},info)=>{
 const h=await harness(browser,baseURL,info,lang),txt={es:['Valor actual','Tu cambio','Revisar mi cambio','Descartar'],en:['Current value','Your change','Review my change','Discard'],ca:['Valor actual','El teu canvi','Revisa el meu canvi','Descarta']}[lang];
 try{const a=await h.client('A'),b=await h.client('B');h.hold((r,x)=>x==='B'&&r.method()==='PATCH'&&new URL(r.url()).pathname.endsWith('/app_state'));
  await debtEdit(b,{name:'Mi nombre'});await expect.poll(()=>h.held.length).toBeGreaterThan(0);await debtEdit(a,{name:'Nombre actual'});await expect.poll(()=>h.row.data.debts[0].name).toBe('Nombre actual');h.hold(null);await h.release('B');
  await expect.poll(()=>b.evaluate(()=>loadState()._planSync?.conflicts.length)).toBe(1);await b.reload();await ready(b);await debtOpen(b);
  const panel=b.locator('[data-plan-conflict="debts"]');await expect(panel.getByText(txt[0],{exact:true})).toBeVisible();await expect(panel.getByText(txt[1],{exact:true})).toBeVisible();await expect(panel.getByText('Nombre actual',{exact:true})).toBeVisible();await expect(panel.getByText('Mi nombre',{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:txt[3],exact:true})).toBeVisible();await panel.getByRole('button',{name:txt[2],exact:true}).click({trial:true});await info.attach('conflict-'+lang,{body:await b.screenshot({animations:'disabled'}),contentType:'image/png'});
  await panel.getByRole('button',{name:txt[2],exact:true}).click();const sheet=b.locator('.plan-edit-sheet');await expect(sheet.locator('[data-debt-field="name"]')).toHaveValue('Mi nombre');
  expect(h.row.data.debts[0].name).toBe('Nombre actual');await sheet.locator('[data-debt-field="balance"]').fill('-1');await sheet.getByRole('button',{name:/^(Guardar cambios|Save changes|Desa els canvis)$/}).click();await expect(sheet.getByRole('alert')).toBeVisible();expect(h.row.data.debts[0].value).toBe(1200.23);
  await sheet.locator('[data-debt-field="balance"]').fill('1200.23');await sheet.getByRole('button',{name:/^(Guardar cambios|Save changes|Desa els canvis)$/}).click();await expect(sheet).toHaveCount(0);await expect.poll(()=>h.row.data.debts[0].name).toBe('Mi nombre');
  await expect.poll(()=>b.evaluate(()=>loadState()._planSync.conflicts.length)).toBe(0);for(const p of [a,b]){await p.reload();await ready(p);expect(await p.evaluate(()=>loadState().debts[0].name)).toBe('Mi nombre');}
  expect(h.row.data.debts[0]).toMatchObject({value:1200.23,monthly:100.11,unknown:{keep:null}});expect(h.requests.filter(r=>r.table==='app_state'&&r.method!=='GET').every(r=>!r.body._planSync&&!r.body.data?._planSync)).toBe(true);expect(h.errors).toEqual([]);
 }finally{await h.close();}
});
test('FIN04 B finanzas de deuda atómicas; descartar no amortiza',async({browser,baseURL},info)=>{
 const h=await harness(browser,baseURL,info);try{const a=await h.client('A'),b=await h.client('B');h.hold((r,x)=>x==='B'&&r.method()==='PATCH'&&new URL(r.url()).pathname.endsWith('/app_state'));
  await debtEdit(b,{monthly:'101.12'});await expect.poll(()=>h.held.length).toBeGreaterThan(0);await debtEdit(a,{balance:'1100.12'});await expect.poll(()=>h.row.data.debts[0].value).toBe(1100.12);h.hold(null);await h.release('B');await expect.poll(()=>b.evaluate(()=>loadState()._planSync?.conflicts.length)).toBe(1);
  await debtOpen(b);const panel=b.locator('[data-plan-conflict="debts"]');await expect(panel).toBeVisible();const before=copy(h.row.data.debts);await panel.getByRole('button',{name:'Descartar',exact:true}).click();await expect(panel).toHaveCount(0);await b.waitForTimeout(1600);
  expect(h.row.data.debts).toEqual(before);expect(Math.round(h.row.data.debts[0].value*100)).toBe(110012);expect(Math.round(h.row.data.debts[0].monthly*100)).toBe(10011);expect(Math.round(h.row.data.fixed[0].amount*100)).toBe(4237);await expect.poll(()=>b.evaluate(()=>loadState()._planSync.conflicts.length)).toBe(0);expect(h.errors).toEqual([]);
 }finally{await h.close();}
});
test('FIN04 B recibo: borrador visible, precarga sin guardar y confirmación explícita',async({browser,baseURL},info)=>{
 const h=await harness(browser,baseURL,info);try{const a=await h.client('A'),b=await h.client('B');h.hold((r,x)=>x==='B'&&r.method()==='PATCH'&&new URL(r.url()).pathname.endsWith('/app_state'));
  await fixedEdit(b,'Mi recibo');await expect.poll(()=>h.held.length).toBeGreaterThan(0);await fixedEdit(a,'Recibo actual');await expect.poll(()=>h.row.data.fixed[0].name).toBe('Recibo actual');h.hold(null);await h.release('B');await expect.poll(()=>b.evaluate(()=>loadState()._planSync?.conflicts.length)).toBe(1);
  await b.reload();await ready(b);await fixedOpen(b);const panel=b.locator('[data-plan-conflict="fixed"]');await expect(panel.getByText('Mi recibo',{exact:true})).toBeVisible();await panel.getByRole('button',{name:'Revisar mi cambio',exact:true}).click();const sheet=b.locator('[data-sheet="bill"]');await expect(sheet.locator('input.v4-bills-search').first()).toHaveValue('Mi recibo');await b.waitForTimeout(1500);expect(h.row.data.fixed[0].name).toBe('Recibo actual');
  await sheet.getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect(sheet).toHaveCount(0);await expect.poll(()=>h.row.data.fixed[0].name).toBe('Mi recibo');expect(Math.round(h.row.data.fixed[0].amount*100)).toBe(4237);await expect.poll(()=>b.evaluate(()=>loadState()._planSync.conflicts.length)).toBe(0);expect(h.errors).toEqual([]);
 }finally{await h.close();}
});
test('FIN04 B ACK tardío conserva una edición posterior de la misma deuda',async({browser,baseURL},info)=>{
 const h=await harness(browser,baseURL,info);try{const a=await h.client('A'),b=await h.client('B');h.hold((r,x)=>x==='B'&&r.method()==='PATCH'&&new URL(r.url()).pathname.endsWith('/app_state'));
  await debtEdit(b,{day:'29'});await expect.poll(()=>h.held.length).toBeGreaterThan(0);await debtEdit(b,{name:'Editado durante envío'});await h.release('B');h.hold(null);for(let i=0;i<4&&h.held.length;i++)await h.release('B');
  await expect.poll(()=>h.row.data.debts[0].name,{timeout:10000}).toBe('Editado durante envío');expect(h.row.data.debts[0]).toMatchObject({day:29,value:1200.23,monthly:100.11});await a.reload();await ready(a);expect(await a.evaluate(()=>loadState().debts[0].name)).toBe('Editado durante envío');expect(h.errors).toEqual([]);
 }finally{await h.close();}
});
test('FIN04 B veinte conflictos DOM sobreviven recarga sin truncarse',async({browser,baseURL},info)=>{
 test.setTimeout(150000);const h=await harness(browser,baseURL,info,'es',20);try{const a=await h.client('A'),b=await h.client('B');h.hold((r,x)=>x==='B'&&r.method()==='PATCH'&&new URL(r.url()).pathname.endsWith('/app_state'));
  for(let i=0;i<20;i++)await debtEdit(b,{name:'Local '+i},'debt'+i);await expect.poll(()=>h.held.length).toBeGreaterThan(0);
  for(let i=0;i<20;i++)await debtEdit(a,{name:'Actual '+i},'debt'+i);await expect.poll(()=>h.row.data.debts[19].name).toBe('Actual 19');h.hold(null);while(h.held.length)await h.release('B');await expect.poll(()=>b.evaluate(()=>loadState()._planSync?.conflicts.length),{timeout:10000}).toBe(20);
  await b.reload();await ready(b);await debtOpen(b,'debt19');const panel=b.locator('[data-plan-conflict="debts"]');await expect(panel.getByText('Actual 19',{exact:true})).toBeVisible();await expect(panel.getByText('Local 19',{exact:true})).toBeVisible();
  expect(await b.evaluate(()=>JSON.parse(localStorage.getItem(mcStateKey()+'_plan_conflicts')).records.length)).toBe(20);expect(h.row.data.debts.map(d=>Math.round(d.value*100))).toEqual(Array(20).fill(120023));expect(h.errors).toEqual([]);
 }finally{await h.close();}
});
