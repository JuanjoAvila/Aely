import {test,expect} from '@playwright/test';

const OWNER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const copy=x=>JSON.parse(JSON.stringify(x));
function seed(owner=OWNER){
  const now=new Date();
  return {fx:0.92,budget:500,monthStartNet:3000,
    accounts:[{id:'acc',name:'Cuenta sintética',ent:'sabadell',value:3000,role:'diario',spendFrom:true}],
    investments:[{id:'inv',name:'Inversión sintética',ent:'trade_republic',value:200.34,cost:190.12,cur:'EUR'}],assets:[],
    debts:[{id:'debt',name:'Deuda compartida',value:1200.23,original:1200.23,monthly:100.11,asOf:now.getFullYear()*12+now.getMonth(),day:28,account:'sabadell',ent:'familia',legacy:{keep:'debt'}}],
    fixed:[{id:'fixed',name:'Recibo sintético',amount:42.37,freq:'mes',day:25,cat:'servicios',account:'sabadell',legacy:{keep:'fixed'}}],
    flows:[],oneoffs:[],aportaciones:[],goals:[],shared:[],expenses:[],history:[],invHistory:[],budgetByMonth:{},
    catOverrides:{},obAccounts:[],obLabels:{},verNotes:[],settings:{autoPrices:false,theme:'green',lang:'es',reservaRules:[]},
    onboarded:true,tourSeen:true,setupHint:false,_dataVer:6,_savedAt:Date.now()-86400000,lastBackup:Date.now(),
    trAnchor:now.toISOString().slice(0,7),reservaLog:[],_historyOwner:owner,unknown:{keep:['whole','state']}};
}
async function editDay(page,day){
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.getByRole('tab',{name:'Deudas',exact:true}).click();
  await page.locator('[data-debt-id="debt"] .plan-item-open').click();
  const sheet=page.getByRole('dialog',{name:'Editar deuda',exact:true});
  await sheet.locator('[data-debt-field="day"]').fill(String(day));
  await sheet.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(sheet).toHaveCount(0);
}
function money(s){return [Math.round(s.fixed[0].amount*100),Math.round(s.debts[0].value*100),Math.round(s.debts[0].monthly*100)];}

// App, React, reloj y SDK reales. Se simulan solamente auth, REST, FX y el puente nativo.
// Ningún sello se adelanta: B edita en el DOM antes de abrir la copia antigua A.
async function harness(browser,baseURL,info,options={}){
  const old=seed();
  if(options.assets){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Date.now()-86400000));
    const part=k=>parts.find(p=>p.type===k).value,day=part('year')+'-'+part('month')+'-'+part('day');
    old.assets=[{id:'asset',name:'Bien sintético',value:500}];
    old.assetValueHistory={asset:[{day,value:400}]};
  }
  if(options.broker)old.investments[0].isin='SYNTHETIC0001';
  const remote=copy(old),other=seed(OTHER),rows=new Map(),requests=[],contexts=[],held=[],errors=[],traces=[];
  if(options.assets)remote.assets[0].value=700;
  remote.remoteUnknown={keep:'added on another client'};remote.debts[0].remoteUnknown={keep:17};
  other.budget=901.23;other.fixed[0].amount=98.76;
  for(const [u,s] of [[OWNER,remote],[OTHER,other]])rows.set(u,{user_id:u,data:s,updated_at:new Date(s._savedAt).toISOString(),serverOnly:'preserved'});
  let holdA=true,failA=false;
  async function answer(route,actor,u){
    const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').at(-1),method=req.method(),body=req.postData()?req.postDataJSON():null;
    const event={sequence:requests.length+1,actor,u,table,method,body,filters:Object.fromEntries(url.searchParams),before:copy(rows.get(u)),at:Date.now(),beforeFirstPullRelease:actor==='A'&&holdA};requests.push(event);
    let data=[],status=200;
    if(table==='app_state'){
      const row=rows.get(u);
      if(actor==='A'&&failA){status=400;data={code:'synthetic_offline',message:'Synthetic offline'};}
      else if(method==='GET')data=row?[{data:copy(row.data),updated_at:row.updated_at}]:[];
      else if(method==='POST'){
        if(row){status=409;data={code:'23505',message:'Synthetic unique user_id'};}
        else if(body.user_id===u){rows.set(u,copy(body));data=[{updated_at:body.updated_at}];}
      }else if(method==='PATCH'){
        if(row&&body.user_id===u&&url.searchParams.get('user_id')==='eq.'+u&&url.searchParams.get('updated_at')==='eq.'+row.updated_at){rows.set(u,{...row,...copy(body)});data=[{updated_at:body.updated_at}];}
      }else throw Error('Unexpected app_state method '+method);
    }else if(table==='myinvestor_links'&&options.broker&&actor==='A'&&method==='GET'){
      data=[{status:'active',last_sync:null,updated_at:new Date().toISOString(),device_id:'synthetic-device'}];
    }else if(table==='myinvestor-sync'&&options.broker){
      if(actor!=='A'||method!=='POST')throw Error('Unexpected synthetic broker request');
      data={ok:true,positions:[{isin:'SYNTHETIC0001',shares:2,value:333.21,cost:190.12}]};
    }else if(table==='state_backups'&&actor==='B'&&method==='POST'){
      // B ya puede cumplir su timer antes de editar. Mantener su backup pendiente
      // permite probar la copia de A tras el pull, sin falsear el control diario.
      status=503;data={code:'synthetic_backup_unavailable',message:'Synthetic B backup unavailable'};
    }
    event.status=status;event.response=copy(data);event.after=copy(rows.get(u));
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  }
  async function open(actor,u,local){
    const ctx=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,timezoneId:'Europe/Madrid',serviceWorkers:'block'});contexts.push(ctx);
    await ctx.route('**/*',route=>{
      const url=new URL(route.request().url());if(url.origin===baseURL)return route.continue();
      if(url.hostname==='api.frankfurter.dev')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({date:new Date().toISOString().slice(0,10),rates:{USD:2,GBP:0.8}})});
      if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/rest/v1/')){
        if(actor==='A'&&holdA&&url.pathname.endsWith('/app_state')&&route.request().method()==='GET'){held.push({route,actor,u});return;}
        return answer(route,actor,u);
      }
      if(url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/functions/v1/')){
        if(options.broker&&url.pathname.endsWith('/myinvestor-sync'))return answer(route,actor,u);
        return route.fulfill({status:200,contentType:'application/json',body:'{}'});
      }
      return route.abort();
    });
    await ctx.addInitScript(({local,u})=>{
      let lib;const session={access_token:'synthetic-only',expires_at:4102444800,user:{id:u}};
      Object.defineProperty(window,'supabase',{configurable:true,get:()=>lib,set:v=>{
        if(!v?.createClient){lib=v;return;}lib={...v,createClient:(url,key)=>{
          const c=v.createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
          c.auth.getSession=async()=>({data:{session},error:null});c.auth.onAuthStateChange=()=>({data:{subscription:{unsubscribe(){}}}});return c;
        }};
      }});
      if(!localStorage.getItem('__savedatSeeded')){localStorage.setItem('micartera_v3',JSON.stringify(local));localStorage.setItem('__savedatSeeded','1');}
      localStorage.setItem('_seenVersion','dev');['dash','metas','gastos','fijos','inv'].forEach(k=>localStorage.setItem('_coach_'+k,'1'));
      const addListener=async()=>({remove(){}});
      window.Capacitor={isNativePlatform:()=>false,Plugins:{App:{addListener},MiCartera:new Proxy({addListener,widgetContract:async()=>({v:2}),appInfo:async()=>({versionCode:61}),updateWidget:async()=>({})},{get:(t,k)=>t[k]||(()=>Promise.resolve({}))})}};
    },{local,u});
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push({actor,message:e.message}));await page.goto(baseURL+'/');
    return {ctx,page,async ready(){await page.waitForFunction(()=>typeof loadState==='function'&&!document.getElementById('mc-load'));}};
  }
  async function prepare(){
    const c=await open('C',OTHER,other);await c.ready();await c.page.waitForTimeout(1600);const otherBefore=copy(rows.get(OTHER));await c.ctx.close();
    const b=await open('B',OWNER,remote);await b.ready();await editDay(b.page,29);await expect.poll(()=>rows.get(OWNER).data.debts[0].day).toBe(29);
    const fromB=copy(rows.get(OWNER));expect(fromB.data._savedAt).toBeLessThanOrEqual(Date.now());expect(fromB.data._savedAt).toBeGreaterThan(old._savedAt);expect(fromB.data.lastBackup).toBe(old.lastBackup);await b.ctx.close();
    const a=await open('A',OWNER,old);await expect.poll(()=>held.length).toBeGreaterThan(0);
    await a.page.waitForFunction(()=>{const s=typeof loadState==='function'&&loadState();return s&&s.gmLevel!=null&&s.fx===0.5&&s.widgetPeriod?.v===2&&s.invHistory?.length&&Object.keys(s.budgetByMonth||{}).length;});
    // Dejar vencer el timer real demuestra que el GET retenido bloquea el backup.
    await a.page.waitForTimeout(4100);
    expect(requests.filter(r=>r.actor==='A'&&r.table==='state_backups'&&r.method==='POST')).toHaveLength(0);
    expect(await a.page.evaluate(()=>loadState().lastBackup)).toBe(old.lastBackup);
    const before=await a.page.evaluate(()=>({state:loadState()}));traces.push({stage:'before first pull',before,fromB});
    expect(requests.filter(r=>r.actor==='A'&&r.table==='app_state'&&r.method!=='GET')).toHaveLength(0);
    return {a,fromB,before,otherBefore};
  }
  async function backup(a,expected){
    const posts=()=>requests.filter(r=>r.actor==='A'&&r.table==='state_backups'&&r.method==='POST');
    await expect.poll(()=>posts().length,{timeout:10000}).toBeGreaterThan(0);
    await expect.poll(()=>a.page.evaluate(()=>loadState().lastBackup)).toBe(new Date().toISOString().slice(0,10));
    const body=posts().at(-1).body;
    expect(body.user_id).toBe(OWNER);expect(body.data._historyOwner).toBe(OWNER);
    expect(body.data._savedAt).toBe(expected._savedAt);expect(body.data.debts[0].day).toBe(expected.debts[0].day);
    expect(money(body.data)).toEqual([4237,120023,10011]);
    expect(await a.page.evaluate(()=>loadState()._savedAt)).toBe(expected._savedAt);
  }
  return {prepare,backup,old,rows,requests,errors,traces,async release(){holdA=false;for(const h of held.splice(0))await answer(h.route,h.actor,h.u);},fail(){failA=true;},recover(){failA=false;},async close(){for(const h of held)await h.route.abort();await info.attach('savedat-evidence',{body:JSON.stringify({old,rows:[...rows],requests,errors,traces},null,2),contentType:'application/json'});for(const ctx of contexts)await ctx.close();}};
}

test('SAVEDAT mantenimiento de arranque conserva el sello de la copia antigua',async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info);try{const {before,otherBefore}=await h.prepare();expect(before.state._savedAt).toBe(h.old._savedAt);expect(h.rows.get(OTHER)).toEqual(otherBefore);expect(h.errors).toEqual([]);}finally{await h.close();}
});
test('SAVEDAT dos móviles: abrir A antigua conserva la edición real de B, campos e identidad',async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info);try{
    const {a,fromB,otherBefore}=await h.prepare();await h.release();await a.ready();
    await expect.poll(()=>a.page.evaluate(()=>loadState().debts[0].day)).toBe(29);await h.backup(a,fromB.data);
    const local=await a.page.evaluate(()=>loadState()),row=h.rows.get(OWNER);
    h.traces.push({stage:'after first pull',local});
    for(const s of [local,row.data]){expect(s._savedAt).toBe(fromB.data._savedAt);expect(money(s)).toEqual([4237,120023,10011]);expect(s.debts).toEqual(fromB.data.debts);expect(s.fixed).toEqual(fromB.data.fixed);expect(s.accounts).toEqual(fromB.data.accounts);expect(s.unknown).toEqual(h.old.unknown);expect(s.remoteUnknown).toEqual(fromB.data.remoteUnknown);}
    expect(row.user_id).toBe(OWNER);expect(row.serverOnly).toBe('preserved');expect(h.rows.get(OTHER)).toEqual(otherBefore);
    await a.page.reload();await a.ready();await expect.poll(()=>a.page.evaluate(()=>loadState().debts[0].day)).toBe(29);expect(await a.page.evaluate(()=>loadState()._savedAt)).toBe(fromB.data._savedAt);expect(h.errors).toEqual([]);
  }finally{await h.close();}
});
test('SAVEDAT edición real sin conexión conserva sello, recarga y guarda por CAS al volver',async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info);try{
    const {a,fromB}=await h.prepare();await h.release();await a.ready();await expect.poll(()=>a.page.evaluate(()=>loadState().debts[0].day)).toBe(29);
    await h.backup(a,fromB.data);
    h.fail();await a.page.evaluate(()=>window.dispatchEvent(new Event('offline')));await editDay(a.page,30);
    await expect.poll(()=>a.page.evaluate(()=>loadState().debts[0].day)).toBe(30);const edited=await a.page.evaluate(()=>loadState());expect(edited._savedAt).toBeGreaterThan(fromB.data._savedAt);
    await a.page.reload();await a.ready();expect(await a.page.evaluate(()=>loadState().debts[0].day)).toBe(30);expect(await a.page.evaluate(()=>loadState()._savedAt)).toBe(edited._savedAt);
    h.recover();await a.page.evaluate(()=>window.dispatchEvent(new Event('offline')));await a.page.waitForTimeout(50);await a.page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await expect.poll(()=>h.rows.get(OWNER).data.debts[0].day).toBe(30);expect(money(h.rows.get(OWNER).data)).toEqual([4237,120023,10011]);
    expect(h.requests.filter(r=>r.actor==='A'&&r.table==='app_state'&&r.method==='PATCH').every(r=>r.filters.updated_at&&r.filters.user_id==='eq.'+OWNER)).toBe(true);expect(h.errors).toEqual([]);
  }finally{await h.close();}
});

test('SAVEDAT editar A mientras espera GET conserva una edición local realmente posterior',async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info);try{
    const {a,fromB}=await h.prepare();await a.ready();await editDay(a.page,30);
    await expect.poll(()=>a.page.evaluate(()=>loadState().debts[0].day)).toBe(30);
    const edited=await a.page.evaluate(()=>loadState());expect(edited._savedAt).toBeGreaterThan(fromB.data._savedAt);expect(edited._savedAt).toBeLessThanOrEqual(Date.now());
    expect(h.requests.filter(r=>r.actor==='A'&&r.table==='app_state'&&r.method!=='GET')).toHaveLength(0);
    await h.release();await expect.poll(()=>h.rows.get(OWNER).data.debts[0].day).toBe(30);
    await h.backup(a,edited);
    h.traces.push({stage:'edit during GET',edited,local:await a.page.evaluate(()=>loadState())});
    expect(h.rows.get(OWNER).data._savedAt).toBe(edited._savedAt);expect(money(h.rows.get(OWNER).data)).toEqual([4237,120023,10011]);expect(h.errors).toEqual([]);
  }finally{await h.close();}
});

test('SAVEDAT dos móviles: cerrar el historial de bienes en un día nuevo no adelanta la copia antigua',async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info,{assets:true});try{
    const {a,fromB,before,otherBefore}=await h.prepare();
    const day=await a.page.evaluate(()=>netWorthDay()),point=before.state.assetValueHistory.asset.at(-1);
    // El historial discordante fuerza el mantenimiento: cambiar sólo el día con el mismo valor es un no-op.
    expect(point).toEqual({day,value:500});expect(before.state._savedAt).toBe(h.old._savedAt);
    await h.release();await a.ready();
    await expect.poll(()=>a.page.evaluate(()=>loadState().assets[0].value)).toBe(700);
    await expect.poll(()=>h.rows.get(OWNER).data.assets[0].value).toBe(700);
    await h.backup(a,fromB.data);
    const local=await a.page.evaluate(()=>loadState()),row=h.rows.get(OWNER);
    h.traces.push({stage:'asset history after first pull',before,fromB,local});
    for(const s of [local,row.data]){
      expect(s._savedAt).toBe(fromB.data._savedAt);expect(s.debts[0].day).toBe(29);
      expect(s.assets).toEqual(fromB.data.assets);expect(s.assetValueHistory.asset.at(-1)).toEqual({day,value:700});
      expect(money(s)).toEqual([4237,120023,10011]);expect(s.remoteUnknown).toEqual(fromB.data.remoteUnknown);
    }
    expect(row.user_id).toBe(OWNER);expect(row.serverOnly).toBe('preserved');expect(h.rows.get(OTHER)).toEqual(otherBefore);
    await a.page.reload();await a.ready();
    expect(await a.page.evaluate(()=>loadState()._savedAt)).toBe(fromB.data._savedAt);
    expect(await a.page.evaluate(()=>loadState().assets[0].value)).toBe(700);expect(h.errors).toEqual([]);
  }finally{await h.close();}
});

test('SAVEDAT dos móviles: el bróker de arranque espera al primer pull válido de la copia antigua',async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info,{broker:true});try{
    const {a,fromB,before,otherBefore}=await h.prepare();
    const syncs=()=>h.requests.filter(r=>r.actor==='A'&&r.table==='myinvestor-sync');
    expect(syncs()).toHaveLength(0);expect(before.state.investments[0].value).toBe(200.34);
    expect(before.state.lastMiSync||0).toBe(0);expect(before.state._savedAt).toBe(h.old._savedAt);
    await h.release();await a.ready();
    await expect.poll(()=>syncs().length).toBe(1);
    await expect.poll(()=>a.page.evaluate(()=>loadState().investments[0].value)).toBe(333.21);
    await expect.poll(()=>h.rows.get(OWNER).data.investments[0].value).toBe(333.21);
    const sync=syncs()[0],pull=h.requests.find(r=>r.actor==='A'&&r.table==='app_state'&&r.method==='GET');
    expect(sync.body).toEqual({userInitiated:false});expect(sync.beforeFirstPullRelease).toBe(false);
    expect(pull.status).toBe(200);expect(sync.sequence).toBeGreaterThan(pull.sequence);
    const updated=await a.page.evaluate(()=>loadState());
    expect(updated._savedAt).toBeGreaterThan(fromB.data._savedAt);await h.backup(a,updated);
    const local=await a.page.evaluate(()=>loadState()),row=h.rows.get(OWNER);
    h.traces.push({stage:'broker after first pull',before,fromB,local,sync,pull});
    for(const s of [local,row.data]){
      expect(s.debts[0].day).toBe(29);expect(s.investments[0].value).toBe(333.21);
      expect(s.investments[0].isin).toBe('SYNTHETIC0001');expect(s.investments[0].shares).toBe(2);
      expect(money(s)).toEqual([4237,120023,10011]);expect(s.remoteUnknown).toEqual(fromB.data.remoteUnknown);
    }
    expect(row.user_id).toBe(OWNER);expect(row.serverOnly).toBe('preserved');expect(h.rows.get(OTHER)).toEqual(otherBefore);expect(h.errors).toEqual([]);
  }finally{await h.close();}
});
