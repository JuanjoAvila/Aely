import {test,expect} from '@playwright/test';
const owner='11111111-1111-4111-8111-111111111111',copy=x=>JSON.parse(JSON.stringify(x));
function seed(){const now=new Date();return {fx:1,budget:500,monthStartNet:3000,accounts:[{id:'acc',name:'Cuenta sintética',ent:'sabadell',value:3000,role:'diario',spendFrom:true}],investments:[],assets:[],debts:[{id:'debt',name:'Deuda inicial',value:1200.23,original:1200.23,monthly:100.11,asOf:now.getFullYear()*12+now.getMonth(),day:28,account:'sabadell',ent:'familia',unknown:{keep:null}}],fixed:[{id:'fixed',name:'Recibo inicial',amount:42.37,freq:'mes',day:25,cat:'servicios',account:'sabadell'}],flows:[],oneoffs:[],aportaciones:[],goals:[],shared:[],expenses:[],history:[],catOverrides:{},obAccounts:[],obLabels:{},verNotes:[],settings:{autoPrices:false,theme:'green',lang:'es',reservaRules:[]},onboarded:true,tourSeen:true,setupHint:false,_dataVer:6,_savedAt:Date.now(),lastBackup:Date.now(),trAnchor:now.toISOString().slice(0,7),reservaLog:[],_historyOwner:owner};}
// Dos SDK/React reales, transporte cerrado y CAS determinista; ningún sello futuro oculta LWW.
async function harness(browser,baseURL,info,lang='es',count=1,link=false){
 const initial=seed();if(link)initial.expenses=[{id:771,date:"2026-10-25T12:00:00.000Z",amount:99.12,merchant:"Cuota sintética",source:"ob",ent:"sabadell",category:"otros"}];initial.settings.lang=lang;if(count>1)initial.debts=Array.from({length:count},(_,i)=>({...copy(initial.debts[0]),id:'debt'+i,name:'Deuda inicial '+i}));let row={user_id:owner,data:copy(initial),updated_at:'2026-10-19T10:00:00.000Z'},hold=null;
 const expenses=initial.expenses.map(e=>({id:e.id,user_id:owner,fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,source:"ob:sabadell"}));
 const contexts=[],requests=[],held=[],errors=[],offline=new Set();
 async function answer(route,actor){const req=route.request(),url=new URL(req.url()),method=req.method(),table=url.pathname.split('/').at(-1),body=req.postData()?req.postDataJSON():null;
  const entry={actor,table,method,body,filters:Object.fromEntries(url.searchParams),before:table==='app_state'?copy(row):null};requests.push(entry);let data=[],status=200;
  if(table==='expenses'){if(method==='GET')data=copy(expenses);else if(method==='PATCH'){for(const e of expenses)if(!url.searchParams.get('id')||url.searchParams.get('id')==='eq.'+e.id)Object.assign(e,body);data=copy(expenses);}}
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
   if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/rest/v1/')){if(offline.has(actor))return route.abort();if(hold?.(route.request(),actor)){held.push({route,actor});return;}return answer(route,actor);}
   if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/functions/v1/'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});return route.abort();});
  await c.addInitScript(({initial,owner})=>{let lib,cb,session={access_token:'synthetic-only',expires_at:4102444800,user:{id:owner}};
   Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>localStorage.getItem('__planOffline')!=='1'});
   window.__planSignOut=()=>{session=null;cb?.('SIGNED_OUT',null);};
   Object.defineProperty(window,'supabase',{configurable:true,get:()=>lib,set:value=>{if(!value?.createClient){lib=value;return;}lib={...value,createClient:(url,key)=>{const c=value.createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});c.auth.getSession=async()=>({data:{session},error:null});c.auth.onAuthStateChange=f=>{cb=f;return {data:{subscription:{unsubscribe(){}}}};};return c;}};}});
   if(!localStorage.getItem('__planSeed')){localStorage.setItem('micartera_v3',JSON.stringify(initial));localStorage.setItem('__planSeed','1');}
   localStorage.setItem('_seenVersion','dev');['dash','metas','gastos','fijos','inv'].forEach(k=>localStorage.setItem('_coach_'+k,'1'));
  },{initial,owner});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(baseURL+'/');await ready(p);return p;
 }
 return {client,requests,held,errors,offline,get row(){return row;},hold(fn){hold=fn;},async release(actor){const i=held.findIndex(h=>h.actor===actor);if(i<0)throw Error('No held request');await answer(held.splice(i,1)[0].route,actor);},async close(){hold=null;for(const h of held)try{await h.route.abort();}catch{};await info.attach('plan-three-way-evidence',{body:JSON.stringify({initial,row,requests,errors},null,2),contentType:'application/json'});for(const c of contexts)await c.close();}};
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

async function connection(h,p,actor,online){if(online)h.offline.delete(actor);else h.offline.add(actor);await p.evaluate(online=>{localStorage.setItem('__planOffline',online?'0':'1');window.dispatchEvent(new Event(online?'online':'offline'));},online);await p.waitForTimeout(100);}
async function debtDelete(p){await debtOpen(p);await p.getByRole('dialog',{name:'Editar deuda',exact:true}).getByRole('button',{name:'Eliminar esta deuda',exact:true}).click();const dialog=p.locator('[aria-labelledby="ask-dialog-title"]');await dialog.getByRole('button',{name:'Eliminar esta deuda',exact:true}).click();await expect(p.locator('[data-debt-id="debt"]')).toHaveCount(0);}
for(const deleter of ['A','B'])for(const edited of [false,true])test('FIN04 reconstruida borrado '+(edited?'con edición':'sin edición')+' · '+deleter,async({browser,baseURL},info)=>{
 const h=await harness(browser,baseURL,info);try{const a=await h.client('A'),b=await h.client('B'),actors={A:a,B:b},peer=deleter==='A'?'B':'A',stale=actors[peer];
  await connection(h,stale,peer,false);await debtDelete(actors[deleter]);await expect.poll(()=>h.row.data.debts.length).toBe(0);
  if(edited)await debtEdit(stale,{name:'Edición conservada',monthly:'101.12'});else await fixedEdit(stale,'Recibo independiente');
  await connection(h,stale,peer,true);
  await expect.poll(()=>h.row.data.fixed[0].name,{timeout:10000}).toBe(edited?'Recibo inicial':'Recibo independiente');
  await expect.poll(()=>h.row.data.debts.length,{timeout:10000}).toBe(edited?1:0);
  if(edited)expect(h.row.data.debts[0]).toMatchObject({id:'debt',name:'Edición conservada',value:1200.23,monthly:101.12,unknown:{keep:null}});
  for(const p of [a,b]){await p.reload();await ready(p);expect(await p.evaluate(()=>loadState().debts.length)).toBe(edited?1:0);if(edited)expect(await p.evaluate(()=>Math.round(loadState().debts[0].monthly*100))).toBe(10112);}
  expect(Math.round(h.row.data.fixed[0].amount*100)).toBe(4237);expect(h.errors).toEqual([]);
 }finally{await h.close();}
});
test('FIN04 reconstruida Plan inválido avisa y reabre lectura válida',async({browser,baseURL},info)=>{
 const h=await harness(browser,baseURL,info);try{const a=await h.client('A'),original=copy(h.row.data),before=h.requests.length;
  await connection(h,a,'A',false);h.row.data.fixed.push(copy(h.row.data.fixed[0]));h.row.updated_at='2026-10-25T01:00:00.000Z';await connection(h,a,'A',true);
  await expect(a.getByText('No se ha podido leer el Plan. Tus datos se conservan; vuelve a intentarlo.',{exact:true})).toBeVisible({timeout:7000});
  expect(await a.evaluate(()=>loadState().fixed.length)).toBe(1);expect(h.requests.slice(before).filter(r=>r.table==='app_state'&&r.method==='PATCH')).toHaveLength(0);
  await connection(h,a,'A',false);h.row.data=original;h.row.data.debts[0].name='Lectura recuperada';h.row.updated_at='2026-10-25T01:00:01.000Z';await connection(h,a,'A',true);
  await expect.poll(()=>a.evaluate(()=>loadState().debts[0].name),{timeout:8000}).toBe('Lectura recuperada');await debtEdit(a,{name:'Guardado posterior'});await expect.poll(()=>h.row.data.debts[0].name).toBe('Guardado posterior');
  await a.reload();await ready(a);expect(await a.evaluate(()=>loadState().debts[0].name)).toBe('Guardado posterior');expect(h.errors).toEqual([]);
 }finally{await h.close();}
});

for(const legacy of [false,true])for(const mark of ['paid','wait'])test('FIN04 reconstruida marca offline '+mark+(legacy?' legacy':'')+' sobrevive ACK y ambos clientes',async({browser,baseURL},info)=>{
 const h=await harness(browser,baseURL,info);try{const a=await h.client('A'),b=await h.client('B');await connection(h,b,'B',false);
  await b.evaluate(({mark,legacy})=>{const state=loadState();if(legacy)delete state._planSync;const now=new Date(),ym=now.getFullYear()*12+now.getMonth()+1;state.fixed=state.fixed.map(f=>({...f,...(mark==='paid'?{paidYm:ym,paidDay:12}:{wait:ym})}));mcSaveRaw(mcStateKey(),state);},{mark,legacy});
  await b.reload();await ready(b);await fixedEdit(a,'Nombre independiente');await expect.poll(()=>h.row.data.fixed[0].name).toBe('Nombre independiente');await connection(h,b,'B',true);
  const ym=await b.evaluate(()=>{const n=new Date();return n.getFullYear()*12+n.getMonth()+1;});
  await expect.poll(()=>h.row.data.fixed[0][mark==='paid'?'paidYm':'wait'],{timeout:10000}).toBe(ym);
  for(const p of [a,b]){await p.reload();await ready(p);const f=await p.evaluate(()=>loadState().fixed[0]);expect(f.name).toBe('Nombre independiente');expect(Math.round(f.amount*100)).toBe(4237);if(mark==='paid'){expect(f.paidYm).toBe(ym);expect(f.paidDay).toBe(12);expect(await p.evaluate(()=>{const s=loadState(),d=new Date();return fixedPaymentState(s,s.fixed[0],d.getFullYear(),d.getMonth()+1,d.getDate()).paid;})).toBe(true);}else expect(f.wait).toBe(ym);expect(f.paymentProofs).toBeUndefined();}
  expect(h.errors).toEqual([]);
 }finally{await h.close();}
});

test('FIN04 reconstruida borrar una revisión no contamina otra deuda',async({browser,baseURL},info)=>{
 const h=await harness(browser,baseURL,info,'es',2);try{const a=await h.client('A'),b=await h.client('B');h.hold((r,x)=>x==='B'&&r.method()==='PATCH'&&new URL(r.url()).pathname.endsWith('/app_state'));
  await debtEdit(b,{name:'Borrador de primera'},'debt0');await expect.poll(()=>h.held.length).toBeGreaterThan(0);await debtEdit(a,{name:'Actual primera'},'debt0');await expect.poll(()=>h.row.data.debts[0].name).toBe('Actual primera');h.hold(null);await h.release('B');await expect.poll(()=>b.evaluate(()=>loadState()._planSync?.conflicts.length)).toBe(1);
  await debtOpen(b,'debt0');await b.locator('[data-plan-conflict="debts"]').getByRole('button',{name:'Revisar mi cambio',exact:true}).click();await b.getByRole('dialog',{name:'Editar deuda',exact:true}).getByRole('button',{name:'Eliminar esta deuda',exact:true}).click();await b.locator('[aria-labelledby="ask-dialog-title"]').getByRole('button',{name:'Eliminar esta deuda',exact:true}).click();
  await expect(b.locator('[data-debt-id="debt0"]')).toHaveCount(0);await debtOpen(b,'debt1');const sheet=b.getByRole('dialog',{name:'Editar deuda',exact:true});await expect(sheet.locator('[data-debt-field="name"]')).toHaveValue('Deuda inicial 1');await sheet.locator('[data-debt-field="name"]').fill('Segunda guardada');await sheet.getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect(sheet).toHaveCount(0);await expect.poll(()=>h.row.data.debts.find(d=>d.id==='debt1')?.name).toBe('Segunda guardada');expect(Math.round(h.row.data.debts.find(d=>d.id==='debt1').value*100)).toBe(120023);expect(h.errors).toEqual([]);
 }finally{await h.close();}
});

const orphanTexts={
 es:{notice:'Una deuda se borró en otro móvil mientras la editabas.',recover:'Recuperar',discard:'Descartar'},
 en:{notice:'A debt was deleted on another device while you were editing it.',recover:'Recover',discard:'Discard'},
 ca:{notice:"Un deute s'ha esborrat en un altre mòbil mentre l'editaves.",recover:'Recupera',discard:'Descarta'}
};
async function orphanDeleteDebt(p){
 await debtOpen(p);const labels=await p.evaluate(()=>({edit:t('db_edit_title'),remove:t('db_delete')}));
 await p.getByRole('dialog',{name:labels.edit,exact:true}).getByRole('button',{name:labels.remove,exact:true}).click();
 const ask=p.locator('[aria-labelledby="ask-dialog-title"]');await expect(ask).toBeVisible();await ask.getByRole('button',{name:labels.remove,exact:true}).click();
 await expect(ask).toHaveCount(0);await expect(p.locator('[data-debt-id="debt"]')).toHaveCount(0);
}
async function showOrphanDebt(p){
 await p.locator('.botnav-tab[data-tour="plan"]').click();await p.getByRole('tab',{name:/^(Deudas|Debts|Deutes)$/}).click();
 return p.locator('[data-plan-orphan="debt"]');
}
async function createOrphanDebt(h){
 const a=await h.client('A'),b=await h.client('B');
 h.hold((r,actor)=>actor==='B'&&r.method()==='PATCH'&&new URL(r.url()).pathname.endsWith('/app_state'));
 await debtEdit(b,{name:'Nombre local pendiente'});await expect.poll(()=>h.held.length).toBeGreaterThan(0);
 await debtEdit(a,{name:'Nombre actual remoto'});await expect.poll(()=>h.row.data.debts[0].name).toBe('Nombre actual remoto');h.hold(null);await h.release('B');
 await expect.poll(()=>b.evaluate(()=>loadState()._planSync?.conflicts.length)).toBe(1);
 expect(await b.evaluate(()=>loadState()._planSync.conflicts[0].local.name)).toBe('Nombre local pendiente');
 expect(h.requests.some(r=>r.actor==='B'&&r.table==='app_state'&&r.method==='PATCH'&&r.response.length===0),'conflict must come from a real CAS miss').toBe(true);
 await connection(h,b,'B',false);await orphanDeleteDebt(a);await expect.poll(()=>h.row.data.debts.length).toBe(0);await connection(h,b,'B',true);
 await expect.poll(()=>b.evaluate(()=>loadState().debts.length)).toBe(0);await expect.poll(()=>b.evaluate(()=>loadState()._planSync?.conflicts.length)).toBe(1);
 await b.reload();await ready(b);const panel=await showOrphanDebt(b);await expect(panel).toBeVisible();
 expect(await b.evaluate(()=>loadState().debts.length)).toBe(0);expect(h.row.data.debts).toEqual([]);
 return {a,b,panel};
}
for(const lang of ['es','en','ca'])test('FIN04 huérfano: cancelar Descartar y recuperar con guardado explícito · '+lang,async({browser,baseURL},info)=>{
 const h=await harness(browser,baseURL,info,lang),txt=orphanTexts[lang];try{
  const {a,b,panel}=await createOrphanDebt(h);await expect(panel.getByText(txt.notice,{exact:true})).toBeVisible();
  await expect(panel.locator('[data-act="plan-orphan-recover"]')).toHaveText(txt.recover);await expect(panel.locator('[data-act="plan-orphan-discard"]')).toHaveText(txt.discard);
  const draft=await b.evaluate(()=>loadState()._planSync.conflicts[0]);await panel.locator('[data-act="plan-orphan-discard"]').click();
  const ask=b.locator('[aria-labelledby="ask-dialog-title"]');await expect(ask).toBeVisible();const cancel=await b.evaluate(()=>t('fj_cancel'));await ask.getByRole('button',{name:cancel,exact:true}).click();await expect(ask).toHaveCount(0);
  expect(await b.evaluate(()=>loadState()._planSync.conflicts[0])).toEqual(draft);await expect(panel).toBeVisible();expect(h.row.data.debts).toEqual([]);
  const writesBefore=h.requests.filter(r=>r.table==='app_state'&&r.method==='PATCH').length;
  await panel.locator('[data-act="plan-orphan-recover"]').click();const sheet=b.getByRole('dialog',{name:/^(Editar deuda|Edit debt|Edita el deute)$/});await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-debt-field="name"]')).toHaveValue('Nombre local pendiente');await expect(sheet.locator('[data-debt-field="name"]')).toBeEditable();await expect(sheet.locator('[data-debt-field="note"]')).toBeEditable();
  for(const field of ['balance','monthly','day','months','apr'])await expect(sheet.locator('[data-debt-field="'+field+'"]')).toHaveJSProperty('readOnly',true);
  await expect(sheet.locator('[data-debt-field="balance"]')).toHaveValue('1200.23');await expect(sheet.locator('[data-debt-field="monthly"]')).toHaveValue('100.11');await sheet.locator('[data-debt-field="note"]').fill('Nota al recuperar');
  await b.waitForTimeout(1600);expect(h.requests.filter(r=>r.table==='app_state'&&r.method==='PATCH').length).toBe(writesBefore);expect(h.row.data.debts).toEqual([]);expect(await b.evaluate(()=>loadState().debts.length)).toBe(0);
  await sheet.locator('[data-act="plan-orphan-save"]').click();await expect(sheet).toHaveCount(0);await expect.poll(()=>h.row.data.debts.length).toBe(1);await expect.poll(()=>b.evaluate(()=>loadState()._planSync.conflicts.length)).toBe(0);
  expect(h.row.data.debts[0]).toMatchObject({id:'debt',name:'Nombre local pendiente',note:'Nota al recuperar',value:1200.23,monthly:100.11,unknown:{keep:null}});expect(Number.isFinite(Date.parse(h.row.data.debts[0].restoredAt))).toBe(true);
  expect(Math.round(h.row.data.debts[0].value*100)).toBe(120023);expect(Math.round(h.row.data.debts[0].monthly*100)).toBe(10011);expect(Math.round(h.row.data.fixed[0].amount*100)).toBe(4237);
  for(const p of [a,b]){await p.reload();await ready(p);const rows=await p.evaluate(()=>loadState().debts);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({id:'debt',name:'Nombre local pendiente',value:1200.23,monthly:100.11,unknown:{keep:null}});}
  expect(h.errors).toEqual([]);
 }finally{await h.close();}
});
for(const lang of ['es','en','ca'])test('FIN04 huérfano: confirmar Descartar no recupera deuda en ninguno de los dos clientes · '+lang,async({browser,baseURL},info)=>{
 const h=await harness(browser,baseURL,info,lang),txt=orphanTexts[lang];try{
  const {a,b,panel}=await createOrphanDebt(h);await expect(panel.getByText(txt.notice,{exact:true})).toBeVisible();await panel.locator('[data-act="plan-orphan-discard"]').click();
  const ask=b.locator('[aria-labelledby="ask-dialog-title"]');await expect(ask).toBeVisible();expect(await b.evaluate(()=>loadState()._planSync.conflicts.length)).toBe(1);await ask.getByRole('button',{name:txt.discard,exact:true}).click();await expect(ask).toHaveCount(0);
  await expect(panel).toHaveCount(0);await expect.poll(()=>b.evaluate(()=>loadState()._planSync.conflicts.length)).toBe(0);expect(h.row.data.debts).toEqual([]);
  for(const p of [a,b]){await p.reload();await ready(p);expect(await p.evaluate(()=>loadState().debts)).toEqual([]);const visible=await showOrphanDebt(p);await expect(visible).toHaveCount(0);}
  expect(h.row.data.debts).toEqual([]);expect(Math.round(h.row.data.fixed[0].amount*100)).toBe(4237);expect(h.errors).toEqual([]);
 }finally{await h.close();}
});

for(const mode of ['manual','automatic'])test('FIN04 vinculacion real engine REST CAS conserva deuda · '+mode,async({browser,baseURL},info)=>{const h=await harness(browser,baseURL,info,'es',1,true);try{const a=await h.client('A'),b=await h.client('B');await connection(h,b,'B',false);await b.evaluate(mode=>{const s=loadState(),e=s.expenses.find(e=>e.id===771);if(mode==='automatic'){e.category='deudas';s.cuotaAlias={[cuotaAliasKey(e)]:'debt'};}const r=mode==='manual'?marcarCuotaAMano(s,771,'debt'):marcarCuotasDeDeuda(s);if(!r)throw Error('actual linking engine returned null');const next=r.state;next._savedAt=Date.now();mcSaveRaw(mcStateKey(),next);},mode);await b.reload();await ready(b);expect(await b.evaluate(()=>loadState().debts[0].debtLinkRevision)).toBeGreaterThan(0);await debtDelete(a);await expect.poll(()=>h.row.data.debts.length).toBe(0);h.offline.delete('B');await b.evaluate(async()=>{await cloud.setExpenseDeuda(loadState().expenses.find(e=>e.id===771));});await connection(h,b,'B',true);await expect.poll(()=>h.row.data.debts.length,{timeout:10000}).toBe(1);for(const p of[a,b]){await p.reload();await ready(p);const s=await p.evaluate(()=>loadState());expect(s.debts[0].id).toBe('debt');expect(s.expenses.find(e=>e.id===771).debtId).toBe('debt');expect(Math.round(s.debts[0].value*100)).toBe(120023);expect(Math.round(s.expenses.find(e=>e.id===771).amount*100)).toBe(9912);}expect(h.requests.some(r=>r.table==='app_state'&&r.method==='PATCH'&&r.filters.updated_at)).toBe(true);expect(h.requests.some(r=>r.table==='expenses'&&r.method==='PATCH')).toBe(true);expect(h.errors).toEqual([]);}finally{await h.close();}});

for(const kind of ['schedule','bankAmount','absence'])test('FIN04 revision financiera DOM conserva grupo completo · '+kind,async({browser,baseURL},info)=>{const h=await harness(browser,baseURL,info);try{const a=await h.client('A'),b=await h.client('B');await connection(h,b,'B',false);await b.evaluate(kind=>{const s=loadState(),f=s.fixed[0];if(kind==='schedule'){f.freq='año';f.months=[new Date().getMonth()+1];f.schedule=[{m:new Date().getMonth()+1,day:25,amt:45.67}];}else if(kind==='bankAmount')f.bankAmount=45.67;else delete f.account;s._savedAt=Date.now();mcSaveRaw(mcStateKey(),s);},kind);await b.reload();await ready(b);if(kind==='absence')h.row.data.fixed[0].bankAmount=49.99;else h.row.data.fixed[0].account='caixabank';h.row.updated_at=new Date().toISOString();await connection(h,b,'B',true);await expect.poll(()=>b.evaluate(()=>loadState()._planSync?.conflicts.length)).toBe(1);await fixedOpen(b);await b.locator('[data-plan-conflict="fixed"]').getByRole('button',{name:'Revisar mi cambio',exact:true}).click();await b.locator('[data-sheet="bill"]').getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect.poll(()=>b.evaluate(()=>loadState()._planSync.conflicts.length)).toBe(0);await expect.poll(()=>h.row.data.fixed[0].account).toBe(kind==='absence'?undefined:'sabadell');if(kind==='schedule')expect(h.row.data.fixed[0].schedule[0].amt).toBe(45.67);if(kind==='bankAmount')expect(h.row.data.fixed[0].bankAmount).toBe(45.67);if(kind==='absence')expect(h.row.data.fixed[0].bankAmount).toBeUndefined();for(const p of[a,b]){await p.reload();await ready(p);const f=await p.evaluate(()=>loadState().fixed[0]);expect(f.account).toBe(kind==='absence'?undefined:'sabadell');expect(Math.round(f.amount*100)).toBe(4237);if(kind==='schedule')expect(Math.round(f.schedule[0].amt*100)).toBe(4567);if(kind==='bankAmount')expect(Math.round(f.bankAmount*100)).toBe(4567);}expect(h.errors).toEqual([]);}finally{await h.close();}});
test('FIN04 frecuencia ya seleccionada DOM conserva pago offline',async({browser,baseURL},info)=>{const h=await harness(browser,baseURL,info);try{const a=await h.client('A');await connection(h,a,'A',false);await a.evaluate(()=>{const s=loadState(),n=new Date();s.fixed[0].paidYm=n.getFullYear()*12+n.getMonth()+1;s.fixed[0].paidDay=12;mcSaveRaw(mcStateKey(),s);});await a.reload();await ready(a);await fixedOpen(a);const name=await a.evaluate(()=>gbTxt('gb_freq_m'));await a.locator('[data-sheet="bill"]').getByRole('button',{name,exact:true}).click();await expect.poll(()=>a.evaluate(()=>loadState().fixed[0].paidDay)).toBe(12);expect(h.errors).toEqual([]);}finally{await h.close();}});
